// Prueba de extremo a extremo del pipeline de fotogramas, sin gastar API:
// servidor que imita la API de Gemini → gen_sprites.py → process_frames.py → el juego reproduce el atlas.
// Uso: node arcade/tests/pipeline.test.cjs
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync, execFile } = require('child_process');
const run = (args, env) => new Promise((res, rej) => execFile('python3', args, { env, maxBuffer: 1 << 24 }, (e, out, err) => e ? rej(new Error(String(err || e.message).slice(-800))) : res(out)));

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-pipe-'));
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const step = async (name, fn) => { try { await fn(); results.push([name, true]); } catch (e) { results.push([name, false, e.message]); throw e; } };

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
}

// Tiras sintéticas: N copias del sprite de Luis, algo giradas, sobre verde croma
function makeStrip(n) {
  const out = path.join(TMP, `strip${n}.png`);
  if (!fs.existsSync(out)) execFileSync('python3', ['-c', `
from PIL import Image
n=${n}; spr=Image.open(${JSON.stringify(path.join(ROOT, 'assets/sprites/luis.png'))}).convert('RGBA')
W=max(1400, n*(spr.width+60)); im=Image.new('RGBA',(W,spr.height+80),(0,255,0,255))
for i in range(n):
  f=spr.rotate((i-n/2)*3, expand=True); im.alpha_composite(f,(30+i*(spr.width+60), 40))
im.convert('RGB').save(${JSON.stringify(out)})`]);
  return fs.readFileSync(out).toString('base64');
}

(async () => {
  const requests = [];
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const j = JSON.parse(body);
      const parts = j.contents[0].parts;
      const text = parts.find(p => p.text).text;
      requests.push({ url: req.url, key: req.headers['x-goog-api-key'], refs: parts.filter(p => p.inline_data).length, cfg: j.generationConfig, text });
      const m = /Exactly (\d+) animation frames/.exec(text);
      const data = makeStrip(m ? +m[1] : 1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data } }] } }] }));
    });
  });
  await new Promise(r => mock.listen(0, r));
  const env = { ...process.env, GEMINI_API_KEY: 'clave-de-prueba', GEMINI_API_BASE: `http://localhost:${mock.address().port}`, SPRITES_RAW: path.join(TMP, 'raw'), FRAMES_OUT: path.join(TMP, 'frames'), FRAMES_JS: path.join(TMP, 'frame-index.js') };
  try {
    await step('gen_sprites.py: peticiones bien formadas a la API y tiras guardadas', async () => {
      await run([path.join(ROOT, 'tools/gen_sprites.py'), '--char', 'luis'], env);
      const raws = fs.readdirSync(path.join(TMP, 'raw/luis'));
      assert(raws.length === 30, 'tiras guardadas: ' + raws.length);
      const r0 = requests[0], r1 = requests.find(r => r.text.includes('Exactly 6'));
      assert(r0.url.includes('gemini-3-pro-image-preview:generateContent') && r0.key === 'clave-de-prueba', 'endpoint o clave');
      assert(r0.cfg.responseModalities.includes('IMAGE') && r0.cfg.imageConfig.aspectRatio === '3:4', 'config de la ficha');
      assert(r1 && r1.refs === 2, 'las animaciones deben llevar referencia + ficha aprobada: ' + (r1 && r1.refs));
      assert(requests.every(r => /#00FF00/.test(r.text) && /facing RIGHT/.test(r.text)), 'prompt sin croma o sin orientación');
    });
    await step('process_frames.py: croma fuera, fotogramas separados y atlas', async () => {
      await run([path.join(ROOT, 'tools/process_frames.py'), '--char', 'luis'], env);
      const meta = JSON.parse(fs.readFileSync(path.join(TMP, 'frames/luis/atlas.json')));
      const counts = Object.fromEntries(Object.entries(meta.anims).map(([k, v]) => [k, v.frames.length]));
      assert(Object.keys(counts).length === 29, 'animaciones: ' + Object.keys(counts).length);
      assert(counts.idle === 6 && counts.lp === 3 && counts.super === 5 && counts.down === 2, 'fotogramas por animación ' + JSON.stringify(counts));
      results.push([`   ↳ ${Object.values(counts).reduce((a, b) => a + b, 0)} fotogramas en ${Object.keys(counts).length} animaciones`, true]);
    });
    const { chromium } = loadPlaywright();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      let f = u === '/js/frame-index.js' ? path.join(TMP, 'frame-index.js') : u.startsWith('/assets/frames/') ? path.join(TMP, 'frames', u.slice(15)) : path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => srv.listen(0, r));
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(`http://localhost:${srv.address().port}/index.html?test=1&seed=5`);
    await p.waitForFunction(() => window.SA && SA.ready, null, { timeout: 20000 });
    await step('El juego carga el atlas y elige animación por estado y fase del golpe', async () => {
      const r = await p.evaluate(() => {
        const g = SA.game; g.startSelect('cpu'); g.beginMatch(0, 1); g.startRound(); SA.step(120);
        const set = FrameSprites.sets.luis, f = g.f1, seen = {};
        for (let i = 0; i < 1800; i++) { SA.step(1); const c = FrameSprites.choose(set, f, {}); if (c) seen[c[0]] = (seen[c[0]] || 0) + 1; }
        f.state = 'attack'; f.move = f.moves.lp; f.mf = 0; const a0 = FrameSprites.choose(set, f, {});
        f.mf = f.move.startup; const a1 = FrameSprites.choose(set, f, {});
        f.mf = f.move.startup + f.move.active + f.move.recovery - 1; const a2 = FrameSprites.choose(set, f, {});
        f.state = 'idle'; f.move = null;
        return { frames: SA.frames, seen, a0, a1, a2, errs: g.errors };
      });
      assert(r.frames.includes('luis'), 'atlas no cargado');
      assert(r.a0[0] === 'lp' && r.a0[1] === 0 && r.a1[1] === 1 && r.a2[1] === 2, 'fases del puñetazo: ' + JSON.stringify([r.a0, r.a1, r.a2]));
      assert(Object.keys(r.seen).length >= 5, 'pocas animaciones en combate: ' + JSON.stringify(r.seen));
      assert(r.errs.length === 0 && errs.length === 0, r.errs.concat(errs).join('; '));
      results.push([`   ↳ animaciones vistas en 30 s de CPU vs CPU: ${Object.keys(r.seen).join(', ')}`, true]);
      if (process.env.SHOTS) await p.locator('canvas').screenshot({ path: path.join(process.env.SHOTS, 'pipeline-fight.png') });
    });
    await browser.close(); srv.close();
  } catch (e) { /* ya registrado */ }
  mock.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  let fail = 0;
  for (const [n, ok, m] of results) { console.log(`${ok ? 'PASA' : 'FALLA'}  ${n}${m ? '  → ' + m : ''}`); if (!ok) fail++; }
  console.log(`\n${fail ? fail + ' fallidas' : 'pipeline OK'}`);
  process.exit(fail ? 1 : 0);
})();

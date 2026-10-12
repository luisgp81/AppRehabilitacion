// Pruebas end-to-end del juego con Chromium headless (Playwright).
// Uso: node arcade/tests/game.test.cjs   (requiere playwright instalado local o globalmente)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* probar global */ }
  const root = execSync('npm root -g').toString().trim();
  return require(path.join(root, 'playwright'));
}
const { chromium } = loadPlaywright();
const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS || '';

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

const results = [];
async function main() {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/index.html`;
  // SwiftShader explícito: el respaldo automático de WebGL en headless es ~40x más lento y no representa un navegador real
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  async function open(q = '') {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.errs = [];
    page.on('pageerror', e => page.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) page.errs.push(m.text()); });
    // Las fuentes de Google pueden no estar disponibles en CI: se bloquean para que la prueba sea reproducible
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(`${base}?test=1&seed=42${q}`);
    await page.waitForFunction(() => window.SA && window.SA.step);
    page.step = n => page.evaluate(n => SA.step(n), n);
    page.g = fn => page.evaluate(fn);
    page.tap = async (k, hold = 2, after = 2) => { await page.keyboard.down(k); await page.step(hold); await page.keyboard.up(k); await page.step(after); };
    page.hold = async (keys, n) => { for (const k of keys) await page.keyboard.down(k); await page.step(n); for (const k of keys) await page.keyboard.up(k); };
    page.shot = async n => { if (SHOTS) await page.locator('canvas').screenshot({ path: path.join(SHOTS, n + '.png') }); };
    return page;
  }
  // Navega del título al combate en el modo elegido (índice de menú) y personajes
  async function waitFight(page) {
    for (let i = 0; i < 60; i++) {
      const st = await page.g(() => ({ sc: SA.game.screen, ph: SA.game.phase }));
      if (st.sc === 'fight' && st.ph === 'fight') return;
      if (st.sc === 'vs') await page.tap('Enter');
      await page.step(10);
    }
    throw new Error('no se llega a la fase de combate');
  }
  // Navega del título al combate en el modo elegido (índice de menú) eligiendo personajes por índice
  async function toFight(page, modeIdx, picks = []) {
    await page.step(5); await page.tap('Enter'); // título → menú
    for (let i = 0; i < modeIdx; i++) await page.tap('KeyS');
    await page.tap('Enter');
    for (let n = 0; n < picks.length; n++) {
      for (let i = 0; i < 3; i++) {
        const cur = await page.g(() => SA.game.sel[SA.game.selStep].idx);
        if (cur === picks[n]) break;
        await page.tap('KeyD');
      }
      await page.tap('KeyJ');
    }
    if (picks.length) await waitFight(page);
  }
  async function test(name, fn) {
    let page;
    try { page = await fn(open); results.push([name, true]); }
    catch (e) { results.push([name, false, e.message]); }
  }
  const assert = (c, msg) => { if (!c) throw new Error(msg); };

  await test('Carga sin errores y muestra el título', async open => {
    const p = await open();
    await p.step(20);
    const s = await p.g(() => ({ screen: SA.game.screen, n: SA.CHARS.length, ids: SA.CHARS.map(c => c.id) }));
    assert(s.screen === 'title', 'pantalla inicial ' + s.screen);
    assert(s.n === 3 && s.ids.join() === 'luis,jc,sebas', 'personajes ' + s.ids);
    await p.shot('t01-title');
    assert(p.errs.length === 0, p.errs.join('; '));
    await p.close();
  });

  await test('Sprites HD: cargan en WebGL, se dibujan y cuestan poco por frame', async open => {
    const p = await open();
    await p.waitForFunction(() => SA.ready, null, { timeout: 20000 });
    const r = await p.g(() => ({ ok: SA.sprites, has: ['luis', 'jc', 'sebas'].map(id => SpriteRig.has(id)), layers: ['luis', 'jc', 'sebas'].map(id => SpriteRig.rigs[id].layers.length) }));
    assert(r.ok && r.has.every(Boolean), 'sprites no disponibles ' + JSON.stringify(r));
    assert(r.layers.every(n => n === 5), 'capas por personaje (base + 2 piezas por brazo) ' + r.layers);
    await p.g(() => { const g = SA.game; g.startSelect('cpu'); g.beginMatch(0, 2); g.startRound(); });
    await p.step(130);
    // el luchador cambia de verdad los píxeles de su zona (comparado con la escena sin él)
    const changed = await p.g(() => {
      const g = SA.game, c = g.ctx, f = g.f1;
      const rx = Math.round((f.x - 45) * RES), ry = Math.round((GROUND - 170) * RES), rw = 90 * RES, rh = 160 * RES;
      g.render(); const a = c.getImageData(rx, ry, rw, rh).data;
      const x0 = f.x; f.x = -500; g.render(); const b = c.getImageData(rx, ry, rw, rh).data; f.x = x0;
      let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++;
      return n / (rw * rh);
    });
    assert(changed > 0.2, 'el sprite apenas aparece en pantalla: ' + changed.toFixed(3));
    await p.close();
    const p2 = await open();
    await p2.waitForFunction(() => SA.ready, null, { timeout: 20000 });
    const t = await p2.g(() => { const g = SA.game; g.startSelect('cpu'); g.beginMatch(1, 2); g.startRound(); SA.step(120);
      const t0 = performance.now(); for (let i = 0; i < 60; i++) g.render(); return (performance.now() - t0) / 60; });
    results.push([`   ↳ render de combate: ${t.toFixed(2)} ms/frame (Chromium headless, SwiftShader)`, true]);
    assert(t < 16, 'render demasiado lento: ' + t);
    await p2.close();
  });

  await test('Funciona abriendo index.html con file:// (sprites embebidos)', async () => {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('file://' + path.join(ROOT, 'index.html') + '?test=1');
    await page.waitForFunction(() => window.SA && SA.ready, null, { timeout: 20000 });
    const ok = await page.evaluate(() => SA.sprites && SpriteRig.has('luis'));
    assert(ok, 'sin sprites en file://');
    assert(errs.length === 0, errs.join('; '));
    await page.close();
  });

  await test('Menús: opciones (persisten), controles (4 páginas) y volver', async open => {
    const p = await open();
    await p.step(5); await p.tap('Enter');
    for (let i = 0; i < 4; i++) await p.tap('KeyS');
    await p.tap('Enter');
    assert(await p.g(() => SA.game.screen) === 'options', 'no entra en opciones');
    await p.tap('KeyD'); // dificultad normal → difícil
    const saved = await p.g(() => JSON.parse(localStorage.getItem('seleccion-arcade-settings')).difficulty);
    assert(saved === 'hard', 'dificultad guardada: ' + saved);
    await p.shot('t02-options');
    await p.tap('Escape');
    assert(await p.g(() => SA.game.screen) === 'menu', 'no vuelve al menú');
    await p.tap('KeyS'); await p.tap('Enter');
    assert(await p.g(() => SA.game.screen) === 'controls', 'no entra en controles');
    for (let i = 0; i < 4; i++) { await p.shot('t03-controls-' + i); await p.tap('KeyD'); }
    assert(await p.g(() => SA.game.ctlPage) === 0, 'paginación de controles');
    await p.tap('Escape');
    assert(await p.g(() => SA.game.screen) === 'menu', 'no vuelve desde controles');
    assert(p.errs.length === 0, p.errs.join('; '));
    await p.close();
  });

  await test('Entrenamiento: andar, puño conecta y el sparring recibe daño', async open => {
    const p = await open();
    await toFight(p, 3, [0, 1]); // Luis vs Juan Carlos
    const st0 = await p.g(() => ({ ph: SA.game.phase, x: SA.game.f1.x, mode: SA.game.mode, n2: SA.game.f2.ch.id }));
    assert(st0.ph === 'fight' && st0.mode === 'training' && st0.n2 === 'jc', JSON.stringify(st0));
    await p.hold(['KeyD'], 35);
    const x1 = await p.g(() => SA.game.f1.x);
    assert(x1 > st0.x + 60, 'no avanza: ' + st0.x + '→' + x1);
    await p.tap('KeyJ', 2, 6);
    const r = await p.g(() => ({ hits: SA.game.f1.stats.hits, hp: SA.game.f2.hp, max: SA.game.f2.maxHp, st: SA.game.f2.state }));
    assert(r.hits === 1 && r.hp < r.max, 'el puño no conecta ' + JSON.stringify(r));
    await p.shot('t04-hit');
    await p.close();
  });

  await test('Especial con botón SP: proyectil que viaja e impacta', async open => {
    const p = await open();
    await toFight(p, 3, [0, 0]);
    await p.tap('KeyL', 2, 14);
    const pr = await p.g(() => SA.game.projectiles.map(x => ({ fx: x.fx, x: x.x })));
    assert(pr.length === 1 && pr[0].fx === 'euro', 'sin proyectil ' + JSON.stringify(pr));
    await p.shot('t05-projectile');
    await p.step(60);
    const h = await p.g(() => SA.game.f1.stats.hits);
    assert(h >= 1, 'el proyectil no impacta');
    await p.close();
  });

  await test('Inputs clásicos: 236+P proyectil y 623+P antiaéreo', async open => {
    const p = await open();
    await toFight(p, 3, [2, 0]); // Sebas vs Luis
    const k = p.keyboard;
    await k.down('KeyS'); await p.step(2); await k.down('KeyD'); await p.step(2); await k.up('KeyS'); await p.step(2);
    await p.tap('KeyJ', 1, 1); await k.up('KeyD'); await p.step(14);
    let r = await p.g(() => ({ m: SA.game.f1.move && SA.game.f1.move.id, pr: SA.game.projectiles.length, fx: SA.game.projectiles[0] && SA.game.projectiles[0].fx }));
    assert(r.pr === 1 && r.fx === 'vhs', '236+P falla ' + JSON.stringify(r));
    await p.step(90);
    await k.down('KeyD'); await p.step(2); await k.up('KeyD'); await k.down('KeyS'); await p.step(2); await k.down('KeyD'); await p.step(1);
    await p.tap('KeyJ', 1, 0); await k.up('KeyS'); await k.up('KeyD');
    await p.step(4);
    r = await p.g(() => ({ m: SA.game.f1.move && SA.game.f1.move.id, y: SA.game.f1.y }));
    assert(r.m === 'dp' && r.y > 0, '623+P falla ' + JSON.stringify(r));
    await p.shot('t06-dp');
    await p.close();
  });

  await test('Combo: puño cancelado en embestida suma 2+ golpes', async open => {
    const p = await open();
    await toFight(p, 3, [1, 0]); // JC vs Luis
    await p.hold(['KeyD'], 40);
    await p.keyboard.down('KeyJ'); await p.step(1); await p.keyboard.up('KeyJ'); await p.step(4);
    await p.keyboard.down('KeyD'); await p.keyboard.down('KeyL'); await p.step(2); await p.keyboard.up('KeyL'); await p.keyboard.up('KeyD');
    await p.step(40);
    const c = await p.g(() => ({ max: SA.game.f1.stats.maxCombo, hits: SA.game.f1.stats.hits }));
    assert(c.max >= 2, 'no hay combo ' + JSON.stringify(c));
    await p.close();
  });

  await test('Super (SP+abajo con barra llena): cinemática y multi-impacto', async open => {
    const p = await open();
    await toFight(p, 3, [0, 1]);
    await p.hold(['KeyD'], 20);
    await p.keyboard.down('KeyS'); await p.step(1); await p.tap('KeyL', 2, 0); await p.keyboard.up('KeyS');
    const fr = await p.g(() => ({ fz: SA.game.freezeT, m: SA.game.f1.move && SA.game.f1.move.id }));
    assert(fr.fz > 0 && fr.m === 'super', 'super no arranca ' + JSON.stringify(fr));
    await p.step(30); await p.shot('t07-super-cutin');
    await p.step(40); await p.shot('t08-super-beam');
    await p.step(40);
    const h = await p.g(() => SA.game.f1.stats.hits);
    assert(h >= 5, 'pocos impactos del super: ' + h);
    await p.close();
  });

  await test('Combo arcade: puño, puño, patada → remate que lanza (3+ golpes)', async open => {
    const p = await open();
    await toFight(p, 3, [0, 1]);
    await p.hold(['KeyD'], 34);
    const seen = new Set();
    const watch = async n => { for (let i = 0; i < n; i++) { await p.step(1); const m = await p.g(() => SA.game.f1.move && SA.game.f1.move.id); if (m) seen.add(m); } };
    await p.keyboard.down('KeyJ'); await watch(1); await p.keyboard.up('KeyJ'); await watch(6);
    await p.keyboard.down('KeyJ'); await watch(1); await p.keyboard.up('KeyJ'); await watch(6);
    await p.keyboard.down('KeyK'); await watch(1); await p.keyboard.up('KeyK'); await watch(20);
    const r = await p.g(() => ({ max: SA.game.f1.stats.maxCombo, st: SA.game.f2.state }));
    assert(seen.has('remate'), 'no sale el remate: ' + [...seen]);
    assert(r.max >= 3, 'combo corto: ' + r.max);
    await p.close();
  });

  await test('Super 2 (K+SP): embestida multigolpe que gasta 1 barra', async open => {
    const p = await open();
    await toFight(p, 3, [2, 0]);
    await p.hold(['KeyD'], 20);
    await p.keyboard.down('KeyK'); await p.keyboard.down('KeyL'); await p.step(2); await p.keyboard.up('KeyK'); await p.keyboard.up('KeyL');
    const st = await p.g(() => ({ m: SA.game.f1.move && SA.game.f1.move.id, supers: SA.game.f1.stats.supers }));
    assert(st.m === 'super2' && st.supers === 1, 'super 2 no arranca ' + JSON.stringify(st));
    await p.step(110);
    const h = await p.g(() => SA.game.f1.stats.hits);
    assert(h >= 4, 'pocos impactos del super 2: ' + h);
    await p.close();
  });

  await test('Golpe Final (P+K+SP): cinemática de 9 impactos y KO especial', async open => {
    const p = await open();
    await toFight(p, 3, [1, 2]);
    await p.hold(['KeyD'], 30);
    for (const k of ['KeyJ', 'KeyK', 'KeyL']) await p.keyboard.down(k);
    await p.step(2); for (const k of ['KeyJ', 'KeyK', 'KeyL']) await p.keyboard.up(k);
    const a = await p.g(() => ({ m: SA.game.f1.move && SA.game.f1.move.id, supers: SA.game.f1.stats.supers }));
    assert(a.m === 'ultra' && a.supers === 1, 'golpe final no arranca ' + JSON.stringify(a));
    await p.step(70);
    const u = await p.g(() => !!SA.game.ultra);
    assert(u, 'no entra en la cinemática');
    await p.shot('t13-golpe-final');
    await p.step(200);
    const r = await p.g(() => ({ ultra: !!SA.game.ultra, max: SA.game.f1.stats.maxCombo, st: SA.game.f2.state }));
    assert(!r.ultra && r.max >= 9, 'cinemática incompleta ' + JSON.stringify(r));
    await p.close();
    // KO con golpe final en versus
    const q = await open();
    await toFight(q, 1, []);
    await q.tap('KeyJ'); await q.tap('Numpad1'); await q.step(40); await waitFight(q);
    await q.g(() => { const g = SA.game; g.f1.meter = 200; g.f2.hp = 150; g.f2.x = g.f1.x + 90; });
    for (const k of ['KeyJ', 'KeyK', 'KeyL']) await q.keyboard.down(k);
    await q.step(2); for (const k of ['KeyJ', 'KeyK', 'KeyL']) await q.keyboard.up(k);
    const used = await q.g(() => SA.game.f1.meter);
    assert(used === 0, 'el golpe final debe gastar las 2 barras: ' + used);
    await q.step(240);
    const k = await q.g(() => ({ ph: SA.game.phase, ko: SA.game.ultraKO, w: SA.game.roundWinner && SA.game.roundWinner.idx }));
    assert(k.ko && k.w === 0, 'KO por golpe final no registrado ' + JSON.stringify(k));
    await q.shot('t14-ko-golpe-final');
    await q.close();
  });

  await test('Versus 2P: bloqueo alto, barrido rompe guardia de pie, guardia agachada lo para', async open => {
    const p = await open();
    await toFight(p, 1, []); // versus: cada jugador confirma con su botón
    await p.tap('KeyJ'); await p.tap('Numpad1'); await p.step(40);
    await waitFight(p);
    assert(await p.g(() => SA.game.screen === 'fight' && SA.game.phase === 'fight' && !SA.game.ai[0] && !SA.game.ai[1]), 'versus no arranca sin IA');
    await p.hold(['KeyD'], 38);
    await p.keyboard.down('ArrowRight'); // P2 mira a la izquierda: atrás = derecha
    await p.tap('KeyJ', 1, 8);
    let r = await p.g(() => ({ b: SA.game.f2.stats.blocks, hp: SA.game.f2.hp, max: SA.game.f2.maxHp }));
    assert(r.b === 1 && r.hp === r.max, 'no bloquea el puño ' + JSON.stringify(r));
    await p.step(20);
    await p.keyboard.down('KeyS'); await p.tap('KeyK', 1, 10); await p.keyboard.up('KeyS');
    r = await p.g(() => ({ b: SA.game.f2.stats.blocks, hp: SA.game.f2.hp, st: SA.game.f2.state }));
    assert(r.hp < 950 && r.b === 1, 'el barrido debería romper la guardia de pie ' + JSON.stringify(r));
    await p.step(80);
    for (let i = 0; i < 40 && await p.g(() => Math.abs(SA.game.f2.x - SA.game.f1.x)) > 85; i++) await p.hold(['KeyD'], 2);
    await p.keyboard.down('ArrowDown');
    await p.keyboard.down('KeyS'); await p.tap('KeyK', 1, 10); await p.keyboard.up('KeyS');
    const r2 = await p.g(() => ({ b: SA.game.f2.stats.blocks, hp: SA.game.f2.hp }));
    assert(r2.b === 2 && r2.hp === r.hp, 'guardia agachada no para el barrido ' + JSON.stringify(r2));
    await p.keyboard.up('ArrowDown'); await p.keyboard.up('ArrowRight');
    await p.close();
  });

  await test('Pausa: ESC pausa y reanuda', async open => {
    const p = await open();
    await toFight(p, 3, [0, 0]);
    await p.tap('Escape');
    assert(await p.g(() => SA.game.screen) === 'pause', 'no pausa');
    await p.shot('t09-pause');
    await p.tap('Escape');
    assert(await p.g(() => SA.game.screen) === 'fight', 'no reanuda');
    await p.close();
  });

  for (const diff of ['easy', 'normal', 'hard']) {
    await test(`CPU vs CPU (${diff}): el combate termina con ganador y sin errores`, async open => {
      const p = await open();
      await p.evaluate(d => { SA.game.settings.difficulty = d; }, diff);
      await toFight(p, 2, [diff === 'hard' ? 2 : 0, diff === 'easy' ? 1 : 2]);
      let screen, frames = 0, sawSpecial = false;
      while (frames < 60 * 60 * 6) {
        await p.step(300); frames += 300;
        const s = await p.g(() => ({ sc: SA.game.screen, sp: SA.game.f1 ? SA.game.f1.stats.specials + SA.game.f2.stats.specials : 0 }));
        screen = s.sc; if (s.sp) sawSpecial = true;
        if (screen === 'result') break;
      }
      const r = await p.g(() => ({ w: SA.game.matchWinner && SA.game.matchWinner.ch.id, w1: SA.game.f1.wins, w2: SA.game.f2.wins, st1: SA.game.f1.stats, st2: SA.game.f2.stats, errs: SA.game.errors }));
      assert(screen === 'result', `no termina (${frames} frames, pantalla ${screen})`);
      assert(r.errs.length === 0 && p.errs.length === 0, 'errores: ' + r.errs.concat(p.errs).join('; '));
      assert(sawSpecial, 'la IA no usa especiales');
      if (diff === 'normal') await p.shot('t10-result');
      results.push([`   ↳ ${diff}: ganador ${r.w || 'empate'} (${r.w1}-${r.w2}), golpes ${r.st1.hits}/${r.st2.hits}, especiales ${r.st1.specials}/${r.st2.specials}, supers ${r.st1.supers}/${r.st2.supers}, ${frames} frames`, true]);
      await p.close();
    });
  }

  await test('Arcade completo: ganar 2 combates y ver el final', async open => {
    const p = await open();
    await toFight(p, 0, [0]);
    for (let stage = 0; stage < 2; stage++) {
      for (let round = 0; round < 2; round++) {
        // se deja al rival a 1 de vida y se remata con un proyectil
        await p.g(() => { SA.game.f2.hp = 1; SA.game.f2.invuln = 0; SA.game.ai[1].level = 'dummy'; });
        await p.step(30);
        await p.tap('KeyL', 2, 2);
        let ph;
        for (let i = 0; i < 20; i++) { await p.step(20); ph = await p.g(() => SA.game.phase); if (ph === 'ko') break; }
        assert(ph === 'ko', `stage ${stage} ronda ${round}: no hay KO (${ph})`);
        if (stage === 0 && round === 0) await p.shot('t11-ko');
        await p.step(240);
        if (round === 0) await waitFight(p);
      }
      assert(await p.g(() => SA.game.screen) === 'result', 'no llega a resultado en stage ' + stage);
      await p.step(45); await p.tap('Enter');
      if (stage === 0) await waitFight(p);
    }
    assert(await p.g(() => SA.game.screen) === 'ending', 'no muestra final: ' + await p.g(() => SA.game.screen));
    await p.step(70); await p.shot('t12-ending');
    assert(p.errs.length === 0, p.errs.join('; '));
    await p.close();
  });

  await test('Mando (Gamepad API simulada): botón A confirma en el título', async open => {
    const p = await open();
    await p.evaluate(() => {
      const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
      window.__pad = pad; navigator.getGamepads = () => [pad, null];
    });
    await p.step(3);
    await p.evaluate(() => { __pad.buttons[0].pressed = true; });
    await p.step(2);
    await p.evaluate(() => { __pad.buttons[0].pressed = false; });
    await p.step(2);
    assert(await p.g(() => SA.game.screen) === 'menu', 'el mando no confirma');
    await p.close();
  });

  await test('Controles táctiles: se muestran y el botón P pulsa', async open => {
    const p = await open('&touch=1');
    assert(await p.locator('#touch').isVisible(), 'overlay táctil oculto');
    const box = await p.locator('[data-btn=p]').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down(); await p.step(2);
    const pressed = await p.g(() => !!SA.game.ctrls[0].held.p);
    await p.mouse.up(); await p.step(2);
    assert(pressed, 'el botón táctil no llega al mando');
    assert(await p.g(() => SA.game.screen) === 'menu', 'P táctil no confirma');
    await p.close();
  });

  await browser.close(); srv.close();
  let fail = 0;
  for (const [n, ok, msg] of results) { console.log(`${ok ? 'PASA' : 'FALLA'}  ${n}${msg ? '  → ' + msg : ''}`); if (!ok) fail++; }
  console.log(`\n${results.filter(r => !r[0].startsWith('   ')).length - fail} pruebas OK, ${fail} fallidas`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

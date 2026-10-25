'use strict';
// Efectos de especiales al estilo de los arcades de lucha de los 90: estelas, corte de super con retrato,
// fondo de energía, auras, destellos de impacto y zoom de cámara. Todo funciona por código; si existen las
// hojas de efectos y retratos generados (assets/fx, js/fx-index.js), se usan encima.

// ── Arte de efectos (hojas FX-xxx sobre negro: se dibujan en modo aditivo) y retratos de super ──
const FxArt = {
  sets: {}, portraits: {},
  load() {
    const idx = window.FX_INDEX || {};
    for (const id in idx) {
      if (id === 'retratos') {
        for (const cid of idx.retratos) { const im = new Image(); im.onload = () => { this.portraits[cid] = im; }; im.src = `assets/fx/retratos/${cid}.webp`; }
        continue;
      }
      const meta = idx[id], imgs = [];
      let left = meta.pages || 1;
      for (let i = 0; i < (meta.pages || 1); i++) {
        const im = new Image(); im.onload = () => { if (--left === 0) this.sets[id] = { meta, imgs }; }; im.src = `assets/fx/${id}/atlas-${i}.webp`; imgs.push(im);
      }
    }
  },
  has(id, an) { const s = this.sets[id]; return !!(s && s.meta.anims[an]); },
  count(id, an) { return this.has(id, an) ? this.sets[id].meta.anims[an].frames.length : 0; },
  // dibuja el fotograma i (se repite en bucle) centrado en x, y; k = escala (la fila más alta mide 256 px)
  draw(ctx, id, an, i, x, y, k = 1, dir = 1, alpha = 1) {
    const s = this.sets[id];
    if (!s || !s.meta.anims[an]) return false;
    const fr = s.meta.anims[an].frames, f = fr[((i % fr.length) + fr.length) % fr.length];
    const [sx, sy, sw, sh, pg] = f.r;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha;
    ctx.translate(x, y); ctx.scale(dir * k, k);
    ctx.drawImage(s.imgs[pg || 0], sx, sy, sw, sh, -f.ax, -f.ay, sw, sh);
    ctx.restore();
    return true;
  },
};
FxArt.load();

const FxPro = {
  // ── Estelas (imágenes fantasma) ──
  ghosts: [],
  trail(f, x, gy, facing, px, color, frame) {
    const id = f.look.head;
    if (!FrameSprites.has(id) || frame % 2) return;
    const set = FrameSprites.sets[id], c = FrameSprites.choose(set, f, {});
    if (!c) return;
    this.ghosts.push({ id, an: c[0], i: c[1], x, gy, facing, px, color, life: 14 });
    if (this.ghosts.length > 40) this.ghosts.shift();
  },
  drawGhosts(ctx) {
    for (const g of this.ghosts) {
      g.life--;
      ctx.save(); ctx.globalAlpha = Math.max(0, g.life / 14) * 0.42; ctx.globalCompositeOperation = 'lighter';
      FrameSprites.drawFrame(ctx, g.id, g.an, g.i, g.x, g.gy, g.facing, { px: g.px });
      ctx.restore();
    }
    this.ghosts = this.ghosts.filter(g => g.life > 0);
  },
  // ¿deja estela? embestidas, antiaéreos, supers y carreras
  trails(f) {
    const m = f.move;
    if (f.state === 'dash') return true;
    if (f.state !== 'attack' || !m) return false;
    return m.kind === 'super' || m.kind === 'ultra' || (m.kind === 'special' && (m.dash || m.rise)) || m.id === 'remate';
  },

  // ── Aura de poder (al arrancar un super) ──
  aura(ctx, x, gy, h, color, t, k = 1) {
    if (FxArt.has('energia', 'aura')) { FxArt.draw(ctx, 'energia', 'aura', Math.floor(t / 4), x, gy - h * 0.5, h / 200, 1, k); return; }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const ph = (t * 0.09 + i * 0.7) % 1, sx = x + Math.sin(i * 2.3 + t * 0.05) * h * 0.22, sy = gy - ph * h * 1.1;
      const r = (1 - ph) * h * 0.13 + 3;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(255,255,255,${0.55 * k})`); g.addColorStop(0.4, hexA(color, 0.45 * k)); g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    }
    const g = ctx.createRadialGradient(x, gy - h * 0.5, 0, x, gy - h * 0.5, h * 0.7);
    g.addColorStop(0, hexA(color, 0.35 * k)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - h, gy - h * 1.3, h * 2, h * 1.6);
    ctx.restore();
  },

  // ── Fondo de energía durante un super: oscurece y llena la pantalla de rayos del color del personaje ──
  superBG(ctx, x, y, color, t, a = 1) {
    ctx.save();
    ctx.fillStyle = `rgba(5,0,20,${0.55 * a})`; ctx.fillRect(-40, -40, W + 80, H + 80);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const an = i * Math.PI / 9 + t * 0.012, w = 0.05 + (i % 3) * 0.02;
      ctx.fillStyle = hexA(color, (i % 2 ? 0.16 : 0.09) * a);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an - w) * 900, y + Math.sin(an - w) * 900); ctx.lineTo(x + Math.cos(an + w) * 900, y + Math.sin(an + w) * 900); ctx.fill();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, 220);
    g.addColorStop(0, `rgba(255,255,255,${0.35 * a})`); g.addColorStop(0.3, hexA(color, 0.3 * a)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - 240, y - 240, 480, 480);
    ctx.restore();
  },

  // ── Corte de super al estilo KOF: franja diagonal, líneas de velocidad, retrato grande y nombre ──
  cutIn(ctx, ch, look, name, label, t, total, fromLeft, frame) {
    const k = Math.min(1, t / 8), out = Math.max(0, (t - (total - 8)) / 8);
    const ease = 1 - Math.pow(1 - k, 3);
    const y0 = 160, hh = 78 * ease * (1 - out);
    if (hh <= 1) return;
    ctx.save();
    // franja inclinada con degradado del color del personaje
    const g = ctx.createLinearGradient(0, y0 - hh, 0, y0 + hh);
    g.addColorStop(0, '#0c0718'); g.addColorStop(0.5, ch.color); g.addColorStop(1, '#0c0718');
    ctx.beginPath(); ctx.moveTo(0, y0 - hh + 24); ctx.lineTo(W, y0 - hh - 24); ctx.lineTo(W, y0 + hh - 24); ctx.lineTo(0, y0 + hh + 24); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    // líneas de velocidad
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const yy = y0 - hh + ((i * 37) % (hh * 2 + 1)), len = 60 + (i * 53) % 140;
      const xx = ((i * 97 + frame * (12 + i % 5)) % (W + len)) - len;
      ctx.fillStyle = `rgba(255,255,255,${0.12 + (i % 4) * 0.06})`;
      ctx.fillRect(fromLeft ? xx : W - xx - len, yy, len, 1 + (i % 3));
    }
    ctx.globalCompositeOperation = 'source-over';
    // retrato: arte generado si existe; si no, la cara del sprite en grande
    const slide = (1 - ease) * 260 * (fromLeft ? -1 : 1);
    const px = (fromLeft ? 150 : W - 150) + slide;
    const art = FxArt.portraits[ch.id];
    if (art) {
      const ph = 230, pw = art.width * ph / art.height;
      ctx.save(); ctx.translate(px, y0 + 20); if (!fromLeft) ctx.scale(-1, 1);
      ctx.drawImage(art, -pw / 2, -ph / 2 - 10, pw, ph); ctx.restore();
    } else drawPortrait(ctx, look, px, y0, 190, fromLeft ? 1 : -1, frame, 'win');
    ctx.restore();
    // bordes brillantes
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(0, y0 - hh + 24); ctx.lineTo(W, y0 - hh - 24); ctx.moveTo(0, y0 + hh + 24); ctx.lineTo(W, y0 + hh - 24); ctx.stroke();
    ctx.globalAlpha = 1;
    // textos
    const tx = fromLeft ? 410 : 230, sc = 1 + Math.max(0, (6 - t)) * 0.12;
    ctx.save(); ctx.translate(tx, y0 + 6); ctx.scale(sc, sc);
    comicText(ctx, label, 0, -34, label.length > 12 ? 9 : 11, label.startsWith('¡DESES') ? '#ff5b7a' : '#f4c20d');
    comicText(ctx, name, 0, 0, name.length > 18 ? 13 : 16, '#fff');
    ctx.restore();
    // destello inicial
    if (t < 5) { ctx.fillStyle = `rgba(255,255,255,${(5 - t) / 5})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  },

  // ── Impacto: estrella de luz en capas + anillos (o el arte FX-IMPACTO) ──
  impact(fx, x, y, heavy, color, cid, special) {
    const art = special && FxArt.has(cid, 'burst') ? [cid, 'burst', 1] : FxArt.has('impacto', heavy ? 'hit_l' : 'hit_s') ? ['impacto', heavy ? 'hit_l' : 'hit_s', heavy ? 0.9 : 0.5] : null;
    if (art) fx.add({ type: 'art', id: art[0], an: art[1], x, y, k: art[2], life: 18, rot: 0 });
    else fx.add({ type: 'star', x, y, col: color, r: heavy ? 46 : 26, life: heavy ? 16 : 11, rot: Math.random() * 6 });
    if (heavy) fx.add({ type: 'ring', x, y, life: 16, col: '#fff', r: 18 });
  },
  burst(fx, x, y, big, color) {
    if (FxArt.has('energia', 'burst')) fx.add({ type: 'art', id: 'energia', an: 'burst', x, y, k: big ? 1.1 : 0.7, life: 24, rot: 0 });
    else { fx.add({ type: 'star', x, y, col: color, r: big ? 90 : 50, life: 22, rot: 0 }); fx.add({ type: 'ring', x, y, life: 22, col: color, r: 30 }); }
  },
};

// color hex → rgba con alfa
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
// estrella de luz (para FX.draw)
function drawStar(ctx, x, y, r, col, rot, k) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(rot);
  const s = r * (1.2 - k * 0.4);
  for (const [sc, c, a] of [[1, col, 0.55], [0.62, '#ffffff', 0.9]]) {
    ctx.fillStyle = c; ctx.globalAlpha = a * Math.min(1, k * 1.8);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, rr = (i % 2 ? 0.28 : i % 4 ? 0.7 : 1) * s * sc; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.9);
  g.addColorStop(0, `rgba(255,255,255,${0.8 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, 7); ctx.fill();
  ctx.restore();
}

// ── Zoom de cámara (supers y KO) ──
function cameraZoom(o, x, y, k, t) { o.zoom = { x, y, k, t, max: t }; }
function applyZoom(ctx, o) {
  const z = o.zoom;
  if (!z || z.t <= 0) return;
  const p = z.t / z.max, e = p > 0.8 ? (1 - p) / 0.2 : p < 0.3 ? p / 0.3 : 1; // entra, se mantiene, sale
  const k = 1 + (z.k - 1) * e;
  const cx = W / 2 + (z.x - W / 2) * e * 0.5, cy = H / 2 + (z.y - H / 2) * e * 0.5;
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
}
function tickZoom(o) { if (o.zoom && o.zoom.t > 0) o.zoom.t--; }

// ── Consecuencias de los golpes (como el fuego de KOF): cada efecto deja al rival marcado unos segundos ──
// glitch: pixelado y con fallos, pierde vida poco a poco · cash: suelta billetes y monedas · comic: en blanco y negro y aturdido
// wet: empapado y más lento · shock: rayos X un instante y luego chamuscado y humeando · rewind: retrocede rebobinado
const STATUS_OF = { ai: 'glitch', euro: 'cash', chart: 'cash', notes: 'cash', comic: 'comic', clap: 'comic', wave: 'wet', sub: 'wet', metal: 'shock', horns: 'shock', vhs: 'rewind', board: 'rewind' };
const STATUS = {
  glitch: { max: 150, word: '¡GLITCH!', col: '#3ff0ff' },
  cash: { max: 60, word: null, col: '#5effa0' },
  comic: { max: 100, word: '¡EN VIÑETA!', col: '#f4c20d' },
  wet: { max: 180, word: '¡EMPAPADO!', col: '#4aa8ff' },
  shock: { max: 110, word: '¡CHAMUSCADO!', col: '#b37bff' },
  rewind: { max: 34, word: '¡REBOBINADO!', col: '#ff5b7a' },
};
Object.assign(FxPro, {
  // aplica la consecuencia de un golpe con efecto (m.fx) al que lo recibe; dir = hacia dónde sale despedido
  applyStatus(d, m, dir, fx, x, y) {
    const kind = m && STATUS_OF[m.fx];
    if (!kind || d.hp <= 0) return;
    const def = STATUS[kind], fresh = !d.status || d.status.kind !== kind;
    d.status = { kind, t: 0, max: def.max, dir };
    if (kind === 'comic' && d.state === 'hitstun') d.stun += 18;
    if (kind === 'shock' && d.state === 'hitstun') d.stun += 12;
    if (fresh && def.word) fx.word(x, y - 40, def.word, def.col, 9);
  },
  // efectos por fotograma: lentitud, daño continuo, retroceso y partículas
  statusTick(b, fx, x, top, h) {
    const s = b.status;
    if (!s) return;
    if (++s.t > s.max || b.hp <= 0) { b.status = null; return; }
    switch (s.kind) {
      case 'wet': if (b.state === 'walk' || b.state === 'idle') { b.vx *= 0.55; if (b.vz) b.vz *= 0.55; }
        if (s.t % 7 === 0) fx.add({ type: 'drip', x: x + (Math.random() - 0.5) * h * 0.35, y: top + h * (0.1 + Math.random() * 0.5), vy: 1.6, life: 22 });
        break;
      case 'glitch': if (s.t % 20 === 0 && b.hp > 1) b.hp = Math.max(1, b.hp - 8); break;
      case 'rewind': if (s.t < 20) b.x += s.dir * 2.4; break;
      case 'cash': if (s.t % 5 === 0) fx.icons(x, top + h * 0.4, s.t % 10 ? 'euro' : 'bill', 1); break;
      case 'shock': if (s.t > 24 && s.t % 9 === 0) fx.add({ type: 'smoke', x: x + (Math.random() - 0.5) * h * 0.3, y: top + h * 0.15, vy: -0.7, life: 34 }); break;
    }
  },
  // dibuja al personaje con su consecuencia (draw = función que lo dibuja con normalidad)
  drawStatus(ctx, b, draw, x, top, h, t) {
    const s = b.status;
    if (!s || !('filter' in ctx)) { draw(); return; }
    const k = Math.min(1, (s.max - s.t) / 20);
    ctx.save();
    switch (s.kind) {
      case 'comic': ctx.filter = `grayscale(${k}) contrast(${1 + 0.5 * k})`; draw(); ctx.filter = 'none';
        ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#000';
        for (let yy = top; yy < top + h; yy += 5) for (let xx = x - h * 0.3 + ((yy / 5) % 2) * 2.5; xx < x + h * 0.3; xx += 5) { ctx.fillRect(xx, yy, 1.4, 1.4); }
        break;
      case 'wet': ctx.filter = `saturate(${1 + 0.4 * k}) hue-rotate(${-20 * k}deg) brightness(${1 - 0.1 * k})`; draw(); ctx.filter = 'none';
        ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#7fc8ff'; ctx.fillRect(x - h * 0.22, top + h * 0.05, h * 0.44, 2); ctx.fillRect(x - h * 0.18, top + h * 0.45, h * 0.36, 2);
        break;
      case 'shock':
        ctx.filter = s.t < 24 && Math.floor(s.t / 3) % 2 ? 'invert(1) grayscale(1) brightness(1.7)' : `brightness(${1 - 0.45 * k}) sepia(${0.7 * k})`;
        draw(); ctx.filter = 'none';
        if (s.t < 24) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#e0c8ff'; ctx.lineWidth = 2; ctx.beginPath(); let px = x - h * 0.25; ctx.moveTo(px, top); for (let i = 1; i < 8; i++) { px = x + (Math.random() - 0.5) * h * 0.5; ctx.lineTo(px, top + i * h / 7); } ctx.stroke(); }
        break;
      case 'glitch': { // rodajas desplazadas + separación de color
        const n = 7, sh = h * 1.15 / n;
        for (let i = 0; i < n; i++) {
          const off = ((Math.sin(i * 12.9 + Math.floor(t / 3) * 7.1) * 43758) % 1) * 10 * k;
          ctx.save(); ctx.beginPath(); ctx.rect(x - h, top - h * 0.1 + i * sh, h * 2, sh + 1); ctx.clip(); ctx.translate(off, 0); draw(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * k;
        ctx.save(); ctx.translate(-3, 0); ctx.filter = 'sepia(1) hue-rotate(290deg) saturate(5)'; draw(); ctx.restore();
        ctx.save(); ctx.translate(3, 0); ctx.filter = 'sepia(1) hue-rotate(140deg) saturate(5)'; draw(); ctx.restore();
        ctx.globalAlpha = 0.6 * k; ctx.fillStyle = Math.floor(t / 4) % 2 ? '#3ff0ff' : '#ff3fb4';
        for (let i = 0; i < 4; i++) ctx.fillRect(x - h * 0.3 + ((i * 37 + t * 5) % (h * 0.6)), top + ((i * 53 + t * 3) % h), 8 + (i * 5) % 14, 2);
        break;
      }
      case 'rewind': { const jit = s.t < 20 ? Math.sin(s.t * 2.7) * 3 : 0; ctx.translate(jit, 0); draw(); ctx.translate(-jit, 0);
        ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#fff';
        for (let yy = top + (t * 3) % 6; yy < top + h; yy += 6) ctx.fillRect(x - h * 0.3, yy, h * 0.6, 1);
        ctx.globalAlpha = k; txt(ctx, '◀◀ REW', x, top - 8, 6, '#ff5b7a');
        break; }
      default: draw();
    }
    ctx.restore();
  },

  // ── Supers gigantes que ocupan todo el escenario (encima del fondo de energía) ──
  // x, y = posición del que lanza el super en pantalla; t = fotogramas desde que empezó; dir = hacia dónde mira
  giant(ctx, cid, t, x, y, dir, floor, a = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (cid === 'luis') { // rayo de IA gigante + lluvia de código y billetes
      const hh = 70 + Math.sin(t * 0.6) * 6, x0 = x, x1 = dir > 0 ? W + 40 : -40;
      const g = ctx.createLinearGradient(0, y - hh, 0, y + hh);
      g.addColorStop(0, 'rgba(40,120,255,0)'); g.addColorStop(0.35, `rgba(80,220,255,${0.6 * a})`); g.addColorStop(0.5, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.65, `rgba(80,220,255,${0.6 * a})`); g.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), y - hh, Math.abs(x1 - x0), hh * 2);
      ctx.font = `10px ${FONT}`; ctx.textAlign = 'center';
      for (let c = 0; c < 26; c++) { ctx.fillStyle = `rgba(90,255,200,${0.5 * a})`; for (let r = 0; r < 6; r++) ctx.fillText((c * 7 + r + Math.floor(t / 3)) % 2 ? '1' : '0', c * 25 + 8, ((t * (3 + c % 4) + c * 40 + r * 14) % (H + 60)) - 30); }
      for (let i = 0; i < 10; i++) { const bx = ((i * 71 + t * (5 + i % 3) * dir) % (W + 80) + W + 80) % (W + 80) - 40, by = y - hh * 1.6 + (i * 37) % (hh * 3.2);
        ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 0.1 + i); ctx.fillStyle = `rgba(94,255,160,${0.8 * a})`; ctx.fillRect(-9, -4, 18, 8); ctx.restore(); }
    } else if (cid === 'jc') { // ola amarilla y azul que cruza el escenario entero
      const front = x + dir * (t * 10 - 40), h0 = floor + 10;
      const left = dir > 0 ? -60 : front, right = dir > 0 ? front : W + 60;
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = 0.55 * a; ctx.fillStyle = i % 2 ? '#1f4fb8' : '#f4c20d';
        const top = 30 + i * 32 + Math.sin(t * 0.2 + i) * 8;
        ctx.beginPath(); ctx.moveTo(left, h0); ctx.lineTo(left, top + 20);
        for (let xx = left; xx <= right; xx += 20) ctx.lineTo(xx, top + Math.sin(xx * 0.03 + t * 0.25 + i) * 10);
        ctx.quadraticCurveTo(right + dir * 50, top - 20, right + dir * 20, top + 60 + i * 10); ctx.lineTo(right, h0); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.9 * a; ctx.fillStyle = '#fff';
      for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(front + dir * (10 + (i % 4) * 8) + Math.sin(t * 0.4 + i) * 6, 30 + i * 16, 4 + (i % 3) * 2, 0, 7); ctx.fill(); }
    } else { // rayos que caen por todo el escenario + altavoz gigante al fondo
      ctx.globalAlpha = 0.25 * a; ctx.fillStyle = '#b37bff';
      ctx.fillRect(W / 2 - 70, floor - 230, 140, 230); ctx.globalAlpha = 0.4 * a; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(W / 2, floor - 150, 48 + Math.sin(t * 0.8) * 4, 0, 7); ctx.arc(W / 2, floor - 55, 34 + Math.sin(t * 0.8) * 3, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const seed = Math.floor(t / 5);
      for (let i = 0; i < 7; i++) {
        const bx = ((Math.sin(seed * 9.1 + i * 3.7) * 43758) % 1 + 1) % 1 * W;
        for (const [lw, col, al] of [[10, '#b37bff', 0.45], [3, '#ffffff', 1]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = al * a; ctx.beginPath(); ctx.moveTo(bx, 0);
          for (let yy = 0; yy < floor; yy += 22) ctx.lineTo(bx + Math.sin(yy * 0.13 + seed + i) * 18, yy + 22);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(bx, floor, 0, bx, floor, 50); g.addColorStop(0, `rgba(230,200,255,${0.7 * a})`); g.addColorStop(1, 'rgba(180,120,255,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(bx - 50, floor - 50, 100, 60);
      }
    }
    ctx.restore();
  },
});

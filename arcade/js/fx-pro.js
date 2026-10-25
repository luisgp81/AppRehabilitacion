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

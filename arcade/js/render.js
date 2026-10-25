'use strict';
// Render: marioneta esquelética procedural, cabezas con rasgos, escenario, proyectiles y partículas.
const OUT = '#170f22';
const FONT = "'Press Start 2P', 'Courier New', monospace";

// ── Poses (ángulos en radianes: 0 = hacia abajo, +π/2 = hacia delante) ──
const BASE_POSE = { lean: 0.08, head: 0, a1: 0.6, a2: 1.9, b1: 0.95, b2: 1.65, l1: -0.25, l2: -0.3, m1: 0.5, m2: -0.42, lift: 0, rigid: 0 };
const P = o => Object.assign({}, BASE_POSE, o);
const CROUCH = { lean: 0.3, l1: 0.95, l2: -2.05, m1: 1.35, m2: -1.95, a1: 0.9, a2: 1.7, b1: 1.1, b2: 1.5 };
const POSES = {
  guard: P({}),
  crouch: P(CROUCH),
  prejump: P({ lean: 0.2, l1: 0.5, l2: -1.1, m1: 0.9, m2: -1.2 }),
  jump: P({ lean: 0, l1: 0.9, l2: -1.9, m1: 1.3, m2: -1.7, a1: 1.2, a2: 1.4, b1: 1.4, b2: 1.3 }),
  lpW: P({ b1: 0.9, b2: 1.1, lean: 0.12 }),
  lpH: P({ b1: 1.62, b2: 0.0, lean: 0.24, a1: 0.5, a2: 2.0, m1: 0.62 }),
  skW: P({ m1: 1.1, m2: -1.7, lean: -0.05 }),
  skH: P({ m1: 1.62, m2: -0.05, lean: -0.34, l1: -0.12, l2: -0.05, a1: 0.3, a2: 1.6, b1: 0.6, b2: 1.5 }),
  cpW: P(Object.assign({}, CROUCH, { b1: 1.0, b2: 1.2 })),
  cpH: P(Object.assign({}, CROUCH, { b1: 1.6, b2: 0.0, lean: 0.38 })),
  ckW: P(Object.assign({}, CROUCH, { lean: 0.45 })),
  ckH: P({ lean: 0.55, l1: 1.15, l2: -2.25, m1: 1.32, m2: 0, a1: 1.5, a2: 0.6, b1: 0.9, b2: 1.2 }),
  jpW: P({ lean: 0, l1: 0.9, l2: -1.9, m1: 1.3, m2: -1.7, a1: 1.2, a2: 1.4, b1: 0.6, b2: 1.6 }),
  jpH: P({ lean: 0.18, l1: 0.9, l2: -1.9, m1: 1.3, m2: -1.7, a1: 1.2, a2: 1.4, b1: 1.15, b2: 0 }),
  jkW: P({ lean: 0, l1: 0.9, l2: -1.9, m1: 1.4, m2: -2.0, a1: 1.2, a2: 1.4, b1: 1.4, b2: 1.3 }),
  jkH: P({ lean: -0.25, l1: 0.7, l2: -1.8, m1: 1.15, m2: 0, a1: 1.3, a2: 1.2, b1: 1.5, b2: 1.2 }),
  projW: P({ lean: -0.18, a1: -0.5, a2: 1.3, b1: -0.3, b2: 1.5, l1: -0.45, l2: -0.1, m1: 0.65, m2: -0.4 }),
  projH: P({ lean: 0.28, a1: 1.45, a2: 0.15, b1: 1.62, b2: 0, l1: -0.6, l2: 0, m1: 0.75, m2: -0.35 }),
  dpW: P(Object.assign({}, CROUCH, { b1: 0.6, b2: 2.0 })),
  dpH: P({ lean: -0.12, b1: 2.95, b2: 0.05, a1: 0.4, a2: 1.8, l1: -0.1, l2: -0.15, m1: 1.1, m2: -1.7 }),
  spinH: P({ m1: 1.6, m2: 0, lean: -0.25, l1: -0.1, l2: -0.05, a1: 1.6, a2: 0.2, b1: -1.2, b2: 0.3 }),
  chargeH: P({ lean: 0.65, a1: 1.0, a2: 1.9, b1: 1.3, b2: 1.9, l1: -0.7, l2: 0.0, m1: 0.7, m2: -0.6 }),
  flyH: P({ lean: -0.35, l1: 0.9, l2: -1.9, m1: 1.55, m2: 0, a1: -0.6, a2: 0.6, b1: 2.2, b2: 0.3 }),
  superW: P({ lean: -0.2, a1: 2.6, a2: 0.5, b1: 2.8, b2: 0.3, l1: -0.45, l2: -0.1, m1: 0.6, m2: -0.4 }),
  superH: P({ lean: 0.3, a1: 1.5, a2: 0.05, b1: 1.58, b2: 0, l1: -0.7, l2: 0, m1: 0.85, m2: -0.4 }),
  hit: P({ lean: -0.42, head: -0.35, a1: -0.3, a2: 0.8, b1: 0.2, b2: 1.2, l1: -0.35, l2: -0.2, m1: 0.35, m2: -0.3 }),
  hitC: P(Object.assign({}, CROUCH, { lean: -0.1, head: -0.35, b1: 0.3, b2: 1.0 })),
  block: P({ lean: -0.06, a1: 1.25, a2: 1.95, b1: 1.38, b2: 2.05, l1: -0.4, l2: -0.2 }),
  blockC: P(Object.assign({}, CROUCH, { lean: 0.15, a1: 1.25, a2: 1.95, b1: 1.38, b2: 2.05 })),
  launched: P({ lean: -0.9, head: -0.4, a1: -0.6, a2: 0.4, b1: -0.2, b2: 0.6, l1: 0.5, l2: -0.8, m1: 0.9, m2: -0.5, rigid: -0.7 }),
  down: P({ lean: -1.52, head: -0.2, a1: -1.9, a2: 0.2, b1: -1.4, b2: 0.4, l1: 1.45, l2: 0.05, m1: 1.5, m2: -0.05, lift: 7, rigid: -1.5 }),
  getup: P({ lean: 0.5, l1: 0.95, l2: -2.05, m1: 1.35, m2: -1.95, a1: 0.2, a2: 0.3, b1: 0.4, b2: 0.3 }),
  win: P({ lean: -0.05, b1: 3.0, b2: 0.25, a1: 0.25, a2: 1.6, l1: -0.25, l2: -0.1, m1: 0.35, m2: -0.1 }),
  dash: P({ lean: 0.38, l1: -0.6, l2: -0.2, m1: 0.8, m2: -0.6 }),
  dashB: P({ lean: -0.2, l1: -0.1, l2: -0.6, m1: 0.2, m2: -0.2 }),
  land: P({ lean: 0.2, l1: 0.5, l2: -1.1, m1: 0.9, m2: -1.2 }),
};
const lerp = (a, b, t) => a + (b - a) * t;
function lerpPose(a, b, t) { const o = {}; for (const k in BASE_POSE) o[k] = lerp(a[k], b[k], t); return o; }

function targetPose(f) {
  const t = f.t, st = f.state, m = f.move;
  if (st === 'attack' && m) {
    let w = POSES[m.anim + 'W'], h = POSES[m.anim + 'H'];
    if (m.anim === 'rush') { w = POSES.lpW; h = POSES[(m.style || 'charge') + 'H']; }
    if (m.id === 'proj') { w = POSES.projW; h = POSES.projH; }
    const mf = f.mf;
    if (mf < m.startup) return lerpPose(POSES.guard, w || POSES.guard, Math.min(1, (mf + 1) / Math.max(1, m.startup - 1)));
    if (mf < m.startup + m.active + 2) return h;
    const r = (mf - m.startup - m.active) / m.recovery;
    return lerpPose(h, f.airborne ? POSES.jump : (m.crouch ? POSES.crouch : POSES.guard), Math.min(1, r));
  }
  switch (st) {
    case 'walk': {
      const ph = f.x * 0.09 * f.facing;
      const s = Math.sin(ph), c = Math.cos(ph);
      return P({ lean: 0.1, l1: -0.15 + 0.38 * s, l2: -0.3 - 0.35 * Math.max(0, c), m1: 0.4 - 0.38 * s, m2: -0.42 - 0.35 * Math.max(0, -c), a2: 1.9 + 0.1 * s });
    }
    case 'crouch': return f.guarding ? POSES.blockC : POSES.crouch;
    case 'prejump': case 'land': return POSES.land;
    case 'jump': return POSES.jump;
    case 'hitstun': return f.crouching ? POSES.hitC : POSES.hit;
    case 'blockstun': return f.ctrl.held.down ? POSES.blockC : POSES.block;
    case 'launched': return POSES.launched;
    case 'knockdown': case 'ko': return f.airborne ? POSES.launched : POSES.down;
    case 'getup': return POSES.getup;
    case 'win': return t < 20 ? lerpPose(POSES.guard, POSES.win, t / 20) : P(Object.assign({}, POSES.win, { b1: 3.0 + Math.sin(t * 0.15) * 0.12, lift: Math.abs(Math.sin(t * 0.15)) * 3 }));
    case 'dash': return f.dashDir > 0 ? POSES.dash : POSES.dashB;
    default: {
      const b = Math.sin(t * 0.09);
      if (f.guarding) return POSES.block;
      return P({ lean: 0.08 + b * 0.025, a2: 1.9 + b * 0.08, b2: 1.65 - b * 0.06, l2: -0.3 - b * 0.03, m2: -0.42 - b * 0.03 });
    }
  }
}

function updatePose(f) {
  const tg = targetPose(f);
  if (!f.pose) { f.pose = Object.assign({}, tg); return; }
  const k = f.state === 'attack' ? 0.65 : f.state === 'hitstun' ? 0.7 : 0.35;
  f.pose = lerpPose(f.pose, tg, k);
}

// ── Dibujo de personaje ──
function seg(ctx, x0, y0, x1, y1, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
const dirv = a => ({ x: Math.sin(a), y: Math.cos(a) });

function drawShoe(ctx, L, foot, ang, shade) {
  ctx.save(); ctx.translate(foot.x, foot.y); ctx.rotate(-ang);
  const bh = L.boots ? 12 : 7;
  ctx.fillStyle = OUT; roundRect(ctx, -6, -bh - 1.5, 19, bh + 4, 3); ctx.fill();
  ctx.fillStyle = shade ? shadeCol(L.shoe, -25) : L.shoe; roundRect(ctx, -4.5, -bh, 16, bh + 1, 2.5); ctx.fill();
  ctx.fillStyle = L.sole; ctx.fillRect(-4.5, 0, 16, 2);
  if (!L.boots) { ctx.fillStyle = '#fff'; ctx.fillRect(1, -bh + 1, 5, 1.2); ctx.fillRect(2, -bh + 3, 4, 1.2); }
  ctx.restore();
}

function drawLeg(ctx, L, hip, a1, a2, back, bulk) {
  const th = 26, sh = 26;
  const k = { x: hip.x + th * Math.sin(a1), y: hip.y + th * Math.cos(a1) };
  const ft = { x: k.x + sh * Math.sin(a1 + a2), y: k.y + sh * Math.cos(a1 + a2) };
  const c = back ? L.pantsShade : L.pants;
  seg(ctx, hip.x, hip.y, k.x, k.y, 14 + bulk + 3, OUT);
  seg(ctx, k.x, k.y, ft.x, ft.y - 3, 11 + bulk + 3, OUT);
  seg(ctx, hip.x, hip.y, k.x, k.y, 14 + bulk, c);
  seg(ctx, k.x, k.y, ft.x, ft.y - 3, 11 + bulk, c);
  if (L.head === 'jc' && !back) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(k.x - 3, k.y - 1, 6, 2); }
  drawShoe(ctx, L, ft, a1 + a2, back);
  return ft;
}

function drawArm(ctx, L, sh, a1, a2, back, bulk, glow) {
  const ua = 20, fa = 19;
  const e = { x: sh.x + ua * Math.sin(a1), y: sh.y + ua * Math.cos(a1) };
  const h = { x: e.x + fa * Math.sin(a1 + a2), y: e.y + fa * Math.cos(a1 + a2) };
  const sk = back ? L.skinShade : L.skin;
  const c1 = L.sleeve === 'skin' ? sk : (back ? shadeCol(L.sleeve, -25) : L.sleeve);
  const c2 = L.forearm === 'skin' ? sk : (back ? shadeCol(L.forearm, -25) : L.forearm);
  seg(ctx, sh.x, sh.y, e.x, e.y, 10 + bulk + 3, OUT);
  seg(ctx, e.x, e.y, h.x, h.y, 9 + bulk + 3, OUT);
  seg(ctx, sh.x, sh.y, e.x, e.y, 10 + bulk, c1);
  seg(ctx, e.x, e.y, h.x, h.y, 9 + bulk, c2);
  // puño / muñequera
  const wx = lerp(e.x, h.x, 0.78), wy = lerp(e.y, h.y, 0.78);
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(wx, wy, 5.6 + bulk / 2, 0, 7); ctx.fill();
  ctx.fillStyle = L.cuff; ctx.beginPath(); ctx.arc(wx, wy, 4.4 + bulk / 2, 0, 7); ctx.fill();
  if (L.studs) { ctx.fillStyle = '#ccc'; ctx.fillRect(wx - 1, wy - 3, 2, 2); ctx.fillRect(wx - 1, wy + 1, 2, 2); }
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(h.x, h.y, 7 + bulk / 2, 0, 7); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(h.x, h.y, 5.4 + bulk / 2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(h.x - 3, h.y + 1, 6, 1.5);
  if (glow) {
    ctx.fillStyle = glow; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(h.x, h.y, 11, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  return h;
}

function drawTorso(ctx, L, tor, bulk, t) {
  const b = bulk;
  ctx.beginPath();
  ctx.moveTo(-10 - b, 3); ctx.lineTo(10 + b, 3); ctx.lineTo(14 + b * 1.4, -tor + 7); ctx.lineTo(9 + b, -tor);
  ctx.lineTo(-9 - b, -tor); ctx.lineTo(-14 - b * 1.4, -tor + 8); ctx.closePath();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.fillStyle = L.torso === 'vest' ? L.shirt : L.top;
  ctx.stroke(); ctx.fill();
  if (L.torso === 'suit') {
    ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.moveTo(-1, -tor); ctx.lineTo(10, -tor); ctx.lineTo(5, -tor + 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.tie; ctx.beginPath(); ctx.moveTo(3.6, -tor + 1); ctx.lineTo(6.6, -tor + 1); ctx.lineTo(7.4, -tor + 17); ctx.lineTo(5.2, -tor + 21); ctx.lineTo(3.2, -tor + 17); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = L.topShade; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-1, -tor + 1); ctx.lineTo(4, -tor + 18); ctx.lineTo(9, -tor + 5); ctx.stroke();
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-8, -tor + 10, 4, 2); // pañuelo de bolsillo
    ctx.fillStyle = L.topShade; ctx.fillRect(4, -tor + 24, 2.5, 2.5); ctx.fillRect(4, -tor + 31, 2.5, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-12 - b, -tor + 10, 5, tor - 8);
  } else if (L.torso === 'vest') {
    ctx.fillStyle = L.top;
    ctx.beginPath(); ctx.moveTo(-10 - b, 3); ctx.lineTo(-1, 3); ctx.lineTo(1, -tor + 4); ctx.lineTo(-9 - b, -tor); ctx.lineTo(-14 - b * 1.4, -tor + 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9 + b, 3); ctx.lineTo(13 + b, 3); ctx.lineTo(14 + b * 1.4, -tor + 7); ctx.lineTo(9 + b, -tor); ctx.lineTo(8, -tor + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    for (let i = 0; i < 5; i++) { ctx.fillRect(-1.5 - i * 0.4, -tor + 6 + i * 7, 2, 2); ctx.fillRect(9 + b - i * 0.2, -tor + 8 + i * 7, 2, 2); }
    ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(4.5, -tor + 21, 4, 0, 7); ctx.fill(); // calavera minimal
    ctx.fillStyle = L.shirt; ctx.fillRect(2.6, -tor + 20, 1.6, 1.6); ctx.fillRect(5, -tor + 20, 1.6, 1.6);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-10 - b, -2, 23 + 2 * b, 4); ctx.fillStyle = '#c9a227'; ctx.fillRect(2, -2, 5, 4);
  } else if (L.torso === 'jacket') {
    ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.moveTo(0, -tor); ctx.lineTo(9, -tor); ctx.lineTo(5, -tor + 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f4c20d'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-13 - b, -tor + 9); ctx.lineTo(-10, 2); ctx.stroke();
    ctx.strokeStyle = L.topShade; ctx.beginPath(); ctx.moveTo(5, -tor + 9); ctx.lineTo(4, 2); ctx.stroke();
    // emblema rayo (original)
    ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(-3, -tor + 18, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f4c20d'; ctx.beginPath(); ctx.moveTo(-2, -tor + 12.5); ctx.lineTo(-6, -tor + 19); ctx.lineTo(-3, -tor + 19); ctx.lineTo(-4, -tor + 23.5); ctx.lineTo(0.5, -tor + 16.5); ctx.lineTo(-2.5, -tor + 16.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#151515'; ctx.fillRect(-10 - b, -2, 21 + 2 * b, 4); ctx.fillStyle = '#bbb'; ctx.fillRect(2, -2, 4, 4);
  }
  if (L.scarf) {
    const [y1, y2] = L.scarf;
    ctx.fillStyle = OUT; ctx.fillRect(-10, -tor - 3, 21, 8);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? y2 : y1; ctx.fillRect(-9 + i * 4, -tor - 2, 4, 6); }
    const sw = Math.sin(t * 0.12) * 2;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = OUT; ctx.fillRect(-12 + sw * i * 0.3 - 1, -tor + 3 + i * 5 - 1, 7, 6); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? y2 : y1; ctx.fillRect(-12 + sw * i * 0.3, -tor + 3 + i * 5, 5, 5); }
  }
}

function drawHead(ctx, L, x, y, r, ang, expr, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const sk = L.skin;
  // pelo trasero
  if (L.head === 'luis') {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(-3, -3, r + 1.5, r + 1.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-3, -3, r, r, 0, 0, 7); ctx.fill();
  }
  // cara
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(1.5, 0, r * 0.92 + 1.6, r * 1.05 + 1.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(1.5, 0, r * 0.92, r * 1.05, 0, 0, 7); ctx.fill();
  ctx.fillStyle = L.skinShade; ctx.beginPath(); ctx.ellipse(-4, 1, 2.6, 3.4, 0, 0, 7); ctx.fill(); // oreja
  ctx.fillStyle = sk; ctx.fillRect(r * 0.85, -1, 3, 4); // nariz
  ctx.fillStyle = L.skinShade; ctx.fillRect(r * 0.85 + 1, 2.5, 2, 1);

  if (L.head === 'luis') {
    // flequillo ondulado canoso
    for (let i = 0; i < 6; i++) {
      const hx = -10 + i * 3.3, hy = -r + 2.5 + Math.sin(i * 1.7) * 0.8 + (i < 2 ? 1.5 : 0);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(hx, hy, 4.4, 3.4, -0.5, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const hx = -10 + i * 3.3, hy = -r + 2.5 + Math.sin(i * 1.7) * 0.8 + (i < 2 ? 1.5 : 0);
      ctx.fillStyle = i % 2 ? L.hairHi : L.hair; ctx.beginPath(); ctx.ellipse(hx, hy, 3.4, 2.5, -0.5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = L.hair; ctx.fillRect(-7, -4, 3, 8); // patilla
    // cinta (guiño a la imagen original)
    ctx.fillStyle = OUT; ctx.fillRect(-r - 2, -6.5, 2 * r + 4, 5);
    ctx.fillStyle = L.band; ctx.fillRect(-r - 1, -5.5, 2 * r + 3, 3);
    const wv = Math.sin(t * 0.25) * 2.5;
    ctx.beginPath(); ctx.moveTo(-r, -5); ctx.lineTo(-r - 13, -6 + wv); ctx.lineTo(-r - 12, -2.5 + wv); ctx.lineTo(-r, -3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r, -4); ctx.lineTo(-r - 9, 1 + wv * 0.6); ctx.lineTo(-r - 7, 3 + wv * 0.6); ctx.lineTo(-r, -2.5); ctx.fill();
  } else if (L.head === 'jc') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(1, -r * 0.62, 4.5, 2.2, -0.2, 0, 7); ctx.fill();
    ctx.fillStyle = L.hair; ctx.fillRect(-r * 0.75, -2, 4, 5);
  } else if (L.head === 'sebas') {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(-r - 1.5, 3); ctx.lineTo(-r - 1, -r * 0.6); ctx.quadraticCurveTo(-2, -r - 4.5, r * 0.75, -r * 0.62); ctx.lineTo(r * 0.9, -3.5); ctx.lineTo(-5, -4); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.moveTo(-r, 2); ctx.lineTo(-r + 0.5, -r * 0.6); ctx.quadraticCurveTo(-2, -r - 3, r * 0.68, -r * 0.6); ctx.lineTo(r * 0.78, -4.5); ctx.lineTo(-4, -5); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = L.hairHi; ctx.fillRect(-8, -r + 2, 2, 2); ctx.fillRect(-3, -r + 1, 2, 1.5); ctx.fillRect(-r + 1, -1, 2, 3);
  }
  // barba
  const bd = L.beard, big = L.head === 'jc';
  ctx.fillStyle = OUT; ctx.beginPath();
  ctx.moveTo(-4.5, 1); ctx.quadraticCurveTo(-3, r + (big ? 6 : 3), 4, r + (big ? 6.5 : 2.5)); ctx.quadraticCurveTo(r + 1.5, r * 0.7, r + 1.4, 2.5); ctx.lineTo(r - 1, 2.5); ctx.lineTo(-1.5, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bd; ctx.beginPath();
  ctx.moveTo(-3.5, 1.5); ctx.quadraticCurveTo(-2, r + (big ? 4.5 : 1.8), 4, r + (big ? 5 : 1.2)); ctx.quadraticCurveTo(r, r * 0.65, r + 0.2, 3.6); ctx.lineTo(r - 2, 3.4); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bd; ctx.fillRect(r - 5, 2.6, 7, 2.4); // bigote
  // boca
  if (expr === 'win') { ctx.fillStyle = OUT; ctx.fillRect(r - 5, 5, 6, 3.5); ctx.fillStyle = '#fff'; ctx.fillRect(r - 4.5, 5.2, 5, 1.5); }
  else if (expr === 'hurt' || expr === 'ko') { ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(r - 2, 6.5, 1.8, 2.2, 0, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = OUT; ctx.fillRect(r - 4.5, 6, 5, 1.2); }
  // ojo y ceja
  const ex = r * 0.45, ey = -1.5;
  if (expr === 'ko') { ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2); ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); ctx.stroke(); }
  else if (expr === 'hurt') { ctx.fillStyle = OUT; ctx.fillRect(ex - 2, ey, 4.5, 1.3); }
  else { ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.8, ey - 1.5, 4.4, 3.2); ctx.fillStyle = OUT; ctx.fillRect(ex + 0.6, ey - 1.2, 2, 2.8); }
  ctx.fillStyle = L.brow; ctx.save(); ctx.translate(ex + 0.5, ey - 3.6); ctx.rotate(expr === 'win' ? -0.15 : 0.22); ctx.fillRect(-3.2, -1, 7, 2.2); ctx.restore();
  if (L.glasses) {
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.fillStyle = 'rgba(170,220,255,0.35)';
    ctx.beginPath(); ctx.rect(ex - 3.2, ey - 3.2, 7.5, 5.8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - 3.2, ey - 1.5); ctx.lineTo(-3.5, -1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + 4.3, ey - 1); ctx.lineTo(r + 1.5, ey - 1.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(ex - 2, ey - 2.4, 2, 1);
  }
  ctx.restore();
}

// Dibuja un luchador en (x, groundY) con su pose. opts: {scale, facing, pose, alpha, expr, glow, silhouette}
function drawFighterAt(ctx, L, x, gy, pose, facing, t, opts = {}) {
  if (!opts.puppet && typeof FrameSprites !== 'undefined' && FrameSprites.has(L.head)) {
    if (FrameSprites.draw(ctx, L.head, x, gy, facing, { fighter: opts.fighter, anim: opts.anim || (opts.state === 'win' ? 'win' : 'idle'), t, scale: opts.scale, flash: opts.flash, alt: L.isAlt, tint: opts.tint })) return;
  }
  if (!opts.puppet && typeof SpriteRig !== 'undefined' && SpriteRig.has(L.head)) {
    const rest = opts.state === 'win' && RIGS[L.head].winRest;
    if (SpriteRig.draw(ctx, L.head, x, gy, pose, facing, { scale: opts.scale, glow: opts.glow, flash: opts.flash, alt: L.isAlt, rest })) return;
  }
  const s = L.scale * (opts.scale || 1), p = pose, bulk = L.bulk;
  ctx.save(); ctx.translate(x, gy); ctx.scale(facing * s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const th = 26, sh = 26, tor = 38 + bulk;
  const ext = (a1, a2) => th * Math.cos(a1) + sh * Math.cos(a1 + a2);
  const legH = Math.max(ext(p.l1, p.l2), ext(p.m1, p.m2), 6);
  const hip = { x: 0, y: -legH - p.lift };
  const up = { x: Math.sin(p.lean), y: -Math.cos(p.lean) };
  const neck = { x: hip.x + up.x * tor, y: hip.y + up.y * tor };
  const shF = { x: hip.x + up.x * (tor - 5) + 3, y: hip.y + up.y * (tor - 5) };
  const shB = { x: hip.x + up.x * (tor - 5) - 4, y: hip.y + up.y * (tor - 5) };
  drawArm(ctx, L, shB, p.a1, p.a2, true, bulk, opts.glow);
  drawLeg(ctx, L, { x: hip.x - 3, y: hip.y }, p.l1, p.l2, true, bulk);
  drawLeg(ctx, L, { x: hip.x + 3, y: hip.y }, p.m1, p.m2, false, bulk);
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(p.lean); drawTorso(ctx, L, tor, bulk, t); ctx.restore();
  // cuello y cabeza
  const r = 11.5 + bulk * 0.3;
  ctx.fillStyle = OUT; ctx.fillRect(neck.x - 4.5, neck.y - 6, 9, 8);
  ctx.fillStyle = L.skinShade; ctx.fillRect(neck.x - 3, neck.y - 6, 6, 7);
  const ha = p.lean * 0.5 + p.head;
  const hc = { x: neck.x + Math.sin(ha) * (r + 2) + 1.5, y: neck.y - Math.cos(ha) * (r + 2) };
  drawHead(ctx, L, hc.x, hc.y, r, p.head * 0.8 + p.lean * 0.2, opts.expr || 'normal', t);
  drawArm(ctx, L, shF, p.b1, p.b2, false, bulk, opts.glow);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shadeCol(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  return '#' + ((1 << 24) | (c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1);
}

// ── Escenario: atardecer malagueño en convención de cómic y arcade ──
const Stage = {
  bg: null,
  build() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, '#120d3a'); sky.addColorStop(0.45, '#4b2a78'); sky.addColorStop(0.75, '#c2508a'); sky.addColorStop(1, '#ff9a4d');
    g.fillStyle = sky; g.fillRect(0, 0, W, 240);
    // estrellas
    g.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) { const x = (i * 137.5) % W, y = (i * 71.3) % 110; g.globalAlpha = 0.3 + (i % 5) * 0.12; g.fillRect(x, y, 1 + (i % 3 === 0), 1); }
    g.globalAlpha = 1;
    // sol a rayas
    g.save(); g.beginPath(); g.arc(330, 214, 46, Math.PI, 0); g.clip();
    const sg = g.createLinearGradient(0, 168, 0, 214); sg.addColorStop(0, '#ffe36e'); sg.addColorStop(1, '#ff6b3d');
    g.fillStyle = sg; g.fillRect(280, 160, 100, 60);
    g.fillStyle = '#c2508a'; for (let i = 0; i < 5; i++) g.fillRect(280, 190 + i * 5, 100, 1 + i * 0.6);
    g.restore();
    // monte y alcazaba/castillo
    g.fillStyle = '#2b1748';
    g.beginPath(); g.moveTo(150, 230); g.quadraticCurveTo(250, 120, 340, 140); g.quadraticCurveTo(420, 150, 470, 230); g.fill();
    g.fillStyle = '#3a1f5c';
    const wall = (x, y, w, h) => { g.fillRect(x, y, w, h); for (let i = 0; i < w; i += 6) g.fillRect(x + i, y - 4, 3, 4); };
    wall(215, 150, 60, 30); wall(260, 132, 70, 26); wall(318, 140, 55, 30); wall(240, 120, 22, 30); wall(300, 112, 20, 22); wall(350, 128, 18, 20);
    g.fillStyle = '#ffd36b';
    [[226, 160], [246, 158], [272, 140], [286, 142], [306, 120], [330, 150], [352, 150], [244, 128]].forEach(([x, y]) => g.fillRect(x, y, 3, 4));
    // skyline con catedral de una sola torre
    g.fillStyle = '#24123d';
    for (let i = 0; i < 28; i++) { const x = i * 24 - 6, h = 18 + ((i * 53) % 34); g.fillRect(x, 222 - h, 22, h); }
    g.fillRect(470, 150, 26, 72); g.fillRect(476, 136, 14, 16); g.beginPath(); g.moveTo(476, 136); g.lineTo(483, 118); g.lineTo(490, 136); g.fill();
    g.fillRect(430, 176, 60, 46); g.beginPath(); g.arc(452, 176, 16, Math.PI, 0); g.fill();
    g.fillStyle = '#ffcf5a';
    for (let i = 0; i < 90; i++) { const x = (i * 97) % W, y = 190 + (i * 31) % 30; if ((i * 7) % 3) g.fillRect(x, y, 2, 2); }
    // mar
    const sea = g.createLinearGradient(0, 222, 0, 250); sea.addColorStop(0, '#5a3a8a'); sea.addColorStop(1, '#1d1846');
    g.fillStyle = sea; g.fillRect(0, 222, W, 30);
    // paseo marítimo y fondo del escenario
    const back = g.createLinearGradient(0, 252, 0, 296); back.addColorStop(0, '#1d1236'); back.addColorStop(1, '#2c1a48');
    g.fillStyle = back; g.fillRect(0, 252, W, 44);
    g.fillStyle = '#120a22'; for (let x = 0; x < W; x += 16) g.fillRect(x, 252, 2, 14);
    g.fillRect(0, 252, W, 3); g.fillRect(0, 264, W, 2);
    for (let x = 6; x < W; x += 22) { g.fillStyle = ['#ff5b7a', '#62e0ff', '#ffd36b'][(x / 22 | 0) % 3]; g.fillRect(x, 288, 6, 3); }
    // estructuras de escenario (truss) izq y der
    const truss = (x, w, top) => {
      g.strokeStyle = '#4a4a5e'; g.lineWidth = 2;
      g.strokeRect(x, top, w, 300 - top);
      for (let y = top; y < 300; y += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + 14); g.moveTo(x + w, y); g.lineTo(x, y + 14); g.stroke(); }
    };
    truss(8, 16, 40); truss(616, 16, 40);
    g.fillStyle = '#4a4a5e'; g.fillRect(8, 36, 624, 8);
    // pancartas originales
    const banner = (x, y, w, h, bg, txt, sub, col) => {
      g.fillStyle = '#0b0b14'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = bg; g.fillRect(x, y, w, h);
      g.fillStyle = col; g.font = `${Math.floor(h * 0.34)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, x + w / 2, y + h * 0.38);
      if (sub) { g.fillStyle = '#fff'; g.font = `${Math.floor(h * 0.18)}px ${FONT}`; g.fillText(sub, x + w / 2, y + h * 0.76); }
    };
    banner(446, 54, 160, 58, '#1a1a33', 'COMIC+ARCADE', 'MALAGA FEST', '#f4c20d');
    banner(36, 60, 56, 110, '#d23d4a', '', '', '#fff');
    g.fillStyle = '#fff'; g.font = `10px ${FONT}`; g.textAlign = 'center';
    ['M', 'A', 'L', 'A', 'G', 'A'].forEach((ch, i) => g.fillText(ch, 64, 76 + i * 15));
    // robot-boquerón gigante (diseño original)
    g.save(); g.translate(560, 120);
    g.fillStyle = '#28324a'; g.fillRect(-26, 20, 52, 70); g.fillRect(-44, 26, 16, 52); g.fillRect(28, 26, 16, 52);
    g.fillStyle = '#c9d6e8'; g.beginPath(); g.ellipse(0, 6, 30, 14, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-28, 6); g.lineTo(-44, -6); g.lineTo(-44, 18); g.closePath(); g.fill();
    g.fillStyle = '#e8423a'; g.beginPath(); g.arc(16, 2, 4, 0, 7); g.fill();
    g.fillStyle = '#4fc3f7'; g.fillRect(-14, 34, 28, 10);
    g.fillStyle = '#f4c20d'; g.fillRect(-20, 54, 40, 4);
    g.restore();
    // suelo-escenario
    const fl = g.createLinearGradient(0, 296, 0, H); fl.addColorStop(0, '#3b2550'); fl.addColorStop(1, '#130a20');
    g.fillStyle = fl; g.fillRect(0, 296, W, H - 296);
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
    for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(320 + i * 34, 296); g.lineTo(320 + i * 80, H); g.stroke(); }
    for (let y = 300; y < H; y += 9 + (y - 300) * 0.25) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#f4c20d'; g.fillRect(0, 296, W, 2);
    // altavoces / flight cases
    const amp = (x) => { g.fillStyle = '#111'; g.fillRect(x, 248, 40, 50); g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x + 20, 266, 11, 0, 7); g.fill(); g.beginPath(); g.arc(x + 20, 288, 6, 0, 7); g.fill(); g.strokeStyle = '#555'; g.strokeRect(x + 1, 249, 38, 48); };
    amp(30); amp(570);
    // tramado ordenado + paleta reducida: textura de fondo pixel-art (estilo placa arcade)
    const id = g.getImageData(0, 0, W, H), d = id.data;
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const lv = 10, stp = 255 / (lv - 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, th = (B[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * stp;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] + th) / stp) * stp));
    }
    g.putImageData(id, 0, 0);
    this.bg = c;
  },
  // Se pinta a resolución lógica y se escala sin suavizado: píxel gordo a juego con los sprites
  draw(ctx, t) {
    if (!this.lo) { this.lo = document.createElement('canvas'); this.lo.width = W; this.lo.height = H; }
    const lc = this.lo.getContext('2d');
    this.drawLo(lc, t);
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.lo, 0, 0, W, H);
    ctx.imageSmoothingEnabled = sm;
  },
  drawLo(ctx, t) {
    ctx.drawImage(this.bg, 0, 0);
    // brillo del mar
    ctx.fillStyle = 'rgba(255,200,140,0.45)';
    for (let i = 0; i < 14; i++) { const y = 226 + (i % 7) * 3.5, x = 300 + Math.sin(t * 0.03 + i) * 30 + (i - 7) * 6; ctx.fillRect(x, y, 10 - (i % 4) * 2, 1); }
    // noria
    ctx.save(); ctx.translate(140, 176); const rot = t * 0.006;
    ctx.strokeStyle = '#7e6aa8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = rot + i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.stroke();
      ctx.fillStyle = ['#ff5b7a', '#ffd36b', '#62e0ff'][(i + Math.floor(t / 20)) % 3];
      ctx.fillRect(Math.cos(a) * 40 - 2, Math.sin(a) * 40 - 2, 4, 4);
    }
    ctx.strokeStyle = '#5b4a80'; ctx.beginPath(); ctx.moveTo(-14, 54); ctx.lineTo(0, 0); ctx.lineTo(14, 54); ctx.stroke();
    ctx.restore();
    // palmeras
    [[200, 232], [410, 230], [600, 236]].forEach(([x, y], i) => {
      ctx.strokeStyle = '#1a0f2c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 30, x + 2, y - 58); ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55 + Math.sin(t * 0.02 + i + k) * 0.05;
        ctx.beginPath(); ctx.moveTo(x + 2, y - 58); ctx.quadraticCurveTo(x + 2 + Math.cos(a) * 14, y - 58 + Math.sin(a) * 14 - 6, x + 2 + Math.cos(a) * 26, y - 58 + Math.sin(a) * 26 + 8); ctx.stroke();
      }
    });
    // focos barriendo
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[60, 0.6], [300, -0.4], [580, 0.3]].forEach(([x, ph], i) => {
      const a = Math.sin(t * 0.012 + ph * 5) * 0.35 + (i === 0 ? 0.25 : i === 2 ? -0.25 : 0);
      const gr = ctx.createLinearGradient(x, 44, x, 300);
      gr.addColorStop(0, ['rgba(255,90,140,0.22)', 'rgba(120,200,255,0.18)', 'rgba(255,220,90,0.2)'][i]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 5, 44); ctx.lineTo(x + 5, 44);
      ctx.lineTo(x + Math.sin(a) * 260 + 50, 300); ctx.lineTo(x + Math.sin(a) * 260 - 50, 300); ctx.fill();
    });
    ctx.restore();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = (Math.floor(t / 8) + i) % 3 ? '#ffe9a8' : '#ff8f5a'; ctx.fillRect(40 + i * 70, 44, 6, 4); }
  },
  drawCrowd(ctx, t, hype) {
    for (let i = 0; i < 34; i++) {
      const x = i * 20 - 6 + (i % 2) * 6, base = 362;
      const b = Math.abs(Math.sin(t * (0.08 + hype * 0.06) + i * 1.3)) * (3 + hype * 6);
      const hy = base - 22 - (i % 3) * 4 - b;
      ctx.fillStyle = '#07040d';
      ctx.beginPath(); ctx.arc(x, hy, 7, 0, 7); ctx.fill();
      ctx.fillRect(x - 10, hy + 5, 20, 30);
      if (i % 3 === 0) { ctx.fillRect(x + 6, hy - 18 - b, 4, 22); }
      if (i % 7 === 2) { ctx.fillStyle = 'rgba(255,255,220,0.85)'; ctx.fillRect(x + 6, hy - 22 - b, 4, 5); }
    }
  },
};

// ── Partículas y textos de cómic ──
class FX {
  constructor() { this.list = []; }
  add(p) { p.life = p.life || 30; p.max = p.life; this.list.push(p); if (this.list.length > 400) this.list.shift(); }
  spark(x, y, col, n = 10, big = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 5) * big;
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 10 + Math.random() * 10, col });
    }
    this.add({ type: 'ring', x, y, life: 12, col, r: 8 * big });
  }
  word(x, y, text, col, size = 16) { this.add({ type: 'word', x, y, text, col, size, life: 38, rot: (Math.random() - 0.5) * 0.5, vy: -0.6 }); }
  icons(x, y, kind, n = 6) {
    for (let i = 0; i < n; i++) this.add({ type: 'icon', kind, x, y, vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 3, life: 30 + Math.random() * 20, rot: Math.random() * 6 });
  }
  dust(x, y) { for (let i = 0; i < 6; i++) this.add({ type: 'dust', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.2, life: 22 }); }
  update() {
    for (const p of this.list) { p.life--; if (p.vx !== undefined) p.x += p.vx; if (p.vy !== undefined) p.y += p.vy; if (p.type === 'icon') p.vy += 0.12; if (p.type === 'spark') { p.vx *= 0.85; p.vy *= 0.85; } }
    this.list = this.list.filter(p => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.list) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.type === 'spark') { ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); ctx.stroke(); }
      else if (p.type === 'ring') { ctx.strokeStyle = p.col; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (1 - k) * 26, 0, 7); ctx.stroke(); }
      else if (p.type === 'dust') { ctx.fillStyle = 'rgba(220,200,255,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (1 - k) * 6, 0, 7); ctx.fill(); }
      else if (p.type === 'word') {
        const sc = k > 0.8 ? 1 + (k - 0.8) * 3 : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(sc, sc);
        comicText(ctx, p.text, 0, 0, p.size, p.col); ctx.restore();
      } else if (p.type === 'icon') drawIcon(ctx, p.kind, p.x, p.y, p.rot + p.life * 0.1);
      else if (p.type === 'star') drawStar(ctx, p.x, p.y, p.r, p.col, p.rot, k);
      else if (p.type === 'art') { ctx.globalAlpha = 1; FxArt.draw(ctx, p.id, p.an, Math.floor((p.max - p.life) / 3), p.x, p.y, p.k, 1, Math.min(1, k * 2)); }
    }
    ctx.globalAlpha = 1;
  }
}

// La fuente pixel no trae bien las mayúsculas acentuadas: se normalizan.
const GLYPH = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U' };
const fixG = s => String(s).replace(/[ÁÉÍÓÚ]/g, c => GLYPH[c]);
function comicText(ctx, text, x, y, size, col, align = 'center') {
  text = fixG(text);
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 3.2); ctx.strokeStyle = OUT; ctx.strokeText(text, x, y + 1.5);
  ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y);
}

function drawIcon(ctx, kind, x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.3);
  ctx.font = `8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (kind === 'euro') { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#8a5d00'; ctx.fillText('€', 0, 1); }
  else if (kind === 'note') { ctx.fillStyle = '#9bf0ff'; ctx.fillRect(1, -7, 1.6, 8); ctx.beginPath(); ctx.ellipse(-0.5, 1.5, 3, 2.2, -0.4, 0, 7); ctx.fill(); ctx.fillRect(1, -7, 4, 1.6); }
  else if (kind === 'digit') { ctx.fillStyle = '#5effa0'; ctx.fillText(Math.random() < 0.5 ? '0' : '1', 0, 0); }
  else if (kind === 'chart') { ctx.fillStyle = '#5effa0'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 1); ctx.lineTo(-5, 1); ctx.fill(); }
  else if (kind === 'bubble') { ctx.strokeStyle = '#bfefff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.stroke(); }
  else if (kind === 'star') { ctx.fillStyle = '#f4c20d'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 2.4 : 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
  else if (kind === 'bolt') { ctx.fillStyle = '#d6b3ff'; ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(-3, 1); ctx.lineTo(0, 1); ctx.lineTo(-1, 7); ctx.lineTo(3, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill(); }
  else if (kind === 'film') { ctx.fillStyle = '#222'; ctx.fillRect(-5, -4, 10, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-4, -3, 2, 2); ctx.fillRect(2, -3, 2, 2); ctx.fillRect(-4, 1, 2, 2); ctx.fillRect(2, 1, 2, 2); }
  ctx.restore();
}

// ── Proyectiles ──
function drawProjectile(ctx, p, t) {
  // halo de energía y chispas alrededor (estilo arcade); con arte FX-<PERSONAJE> se usa su animación
  const col = p.desp ? '#ff3030' : p.owner.ch.color, cid = p.owner.ch.id, py = GROUND - p.y;
  if (p.kind !== 'beam') {
    const r = p.isSuper ? 70 : 34, cy = p.kind === 'ground' ? py - p.h * 0.5 : py;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.35, hexA(col, 0.45)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, cy, r, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) { // estela de chispas detrás
      const a = t * 0.3 + i, d = 10 + i * 9;
      ctx.fillStyle = hexA(i % 2 ? '#ffffff' : col, 0.7 - i * 0.1);
      ctx.fillRect(p.x - p.dir * d, cy + Math.sin(a * 1.7) * (6 + i * 2), 3, 3);
    }
    ctx.restore();
    if (!p.isSuper && FxArt.draw(ctx, cid, 'proj', Math.floor(t / 4), p.x, cy, 0.42, p.dir)) return;
    if (p.isSuper && FxArt.has(cid, 'super')) FxArt.draw(ctx, cid, 'super', Math.floor(t / 4), p.x, cy, p.h / 230, p.dir, 0.9);
  } else if (FxArt.has(cid, 'super')) FxArt.draw(ctx, cid, 'super', Math.floor(t / 4), p.x + p.dir * 40, py, 0.6, p.dir, 0.9);
  ctx.save(); ctx.translate(p.x, GROUND - p.y); ctx.scale(p.dir, 1);
  const k = p.fx;
  if (k === 'euro') {
    for (let i = 1; i < 5; i++) { ctx.globalAlpha = 0.5 - i * 0.1; ctx.fillStyle = '#5effa0'; ctx.fillRect(-i * 10 - 6, -4, 10, 8); }
    ctx.globalAlpha = 1;
    const sx = Math.abs(Math.cos(t * 0.3));
    ctx.save(); ctx.scale(Math.max(0.25, sx), 1);
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8a800'; ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4c00'; ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('€', 1, 1);
    ctx.restore();
  } else if (k === 'comic') {
    ctx.rotate(Math.sin(t * 0.2) * 0.12);
    ctx.fillStyle = OUT; ctx.fillRect(-22, -18, 44, 36);
    ctx.fillStyle = '#fff8d0'; ctx.fillRect(-20, -16, 40, 32);
    ctx.fillStyle = 'rgba(255,90,90,0.35)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(-17 + i * 7, -13 + j * 7, 1.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f4c20d'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 9 : 17; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.scale(p.dir, 1); comicText(ctx, 'POW!', 0, 0, 8, '#e8423a');
  } else if (k === 'vhs') {
    ctx.strokeStyle = '#6b3b1a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 30; i++) ctx.lineTo(-14 - i * 2, Math.sin(i * 0.5 + t * 0.4) * 5);
    ctx.stroke();
    ctx.rotate(t * 0.25);
    ctx.fillStyle = OUT; ctx.fillRect(-18, -11, 36, 22);
    ctx.fillStyle = '#262626'; ctx.fillRect(-16, -9, 32, 18);
    ctx.fillStyle = '#e8423a'; ctx.fillRect(-12, -8, 24, 5);
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(-7, 3, 4, 0, 7); ctx.arc(7, 3, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#262626'; ctx.fillRect(-8, 2, 2, 2); ctx.fillRect(6, 2, 2, 2);
  } else if (k === 'ai') { // rayo de red neuronal (super de Luis)
    const len = p.len;
    const fl = 1 + Math.sin(t * 0.8) * 0.08, hh = p.h / 2 * fl;
    const g = ctx.createLinearGradient(0, -hh, 0, hh);
    g.addColorStop(0, 'rgba(60,140,255,0)'); g.addColorStop(0.3, 'rgba(80,220,255,0.85)'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, 'rgba(80,220,255,0.85)'); g.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, -hh, len, hh * 2);
    ctx.fillStyle = 'rgba(10,40,80,0.8)'; ctx.font = `8px ${FONT}`; ctx.textBaseline = 'middle';
    for (let i = 0; i < len / 16; i++) ctx.fillText(((i * 7 + Math.floor(t / 3)) % 3 === 0) ? '1' : '0', i * 16 - (t * 6) % 16, ((i * 13) % 5 - 2) * 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    for (let i = 0; i < len / 40; i++) { const x = i * 40 + (t * 3) % 40; ctx.beginPath(); ctx.arc(x, -hh * 0.55, 3, 0, 7); ctx.moveTo(x + 3, -hh * 0.55); ctx.lineTo(x + 37, hh * 0.55); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 20, hh * 0.55, 3, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, hh * 0.9, 0, 7); ctx.fill();
  } else if (k === 'wave') { // ola amarilla y azul (super de JC)
    const hgt = p.h;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#1f4fb8' : '#f4c20d';
      ctx.beginPath(); ctx.moveTo(-50, 0);
      ctx.quadraticCurveTo(-30, -hgt * (1 - i * 0.13), 20 - i * 4, -hgt * (1 - i * 0.14));
      ctx.quadraticCurveTo(46 - i * 6, -hgt * (0.85 - i * 0.12), 30 - i * 5, -hgt * (0.6 - i * 0.08));
      ctx.lineTo(40 - i * 4, 0); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(24 + Math.sin(t * 0.3 + i) * 6, -hgt + 10 + i * 10, 3 + (i % 3), 0, 7); ctx.fill(); }
    ctx.scale(p.dir, 1); comicText(ctx, '¡PERMANENCIA!', 0, -hgt - 12, 9, '#fff');
  } else if (k === 'metal') { // rayos de guitarra (super de Sebas)
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = b === 1 ? '#fff' : '#b37bff'; ctx.lineWidth = b === 1 ? 3 : 6; ctx.globalAlpha = b === 1 ? 1 : 0.6;
      ctx.beginPath(); let x = (b - 1) * 14;
      ctx.moveTo(x, -p.h);
      for (let yy = -p.h; yy < 0; yy += 14) { x = (b - 1) * 14 + (Math.sin(yy * 0.3 + t * 1.3 + b) * 10); ctx.lineTo(x, yy + 14); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(200,150,255,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 8, 0, 0, 7); ctx.fill();
    ctx.scale(p.dir, 1); comicText(ctx, '\\m/', 0, -p.h - 10, 10, '#f4c20d');
  }
  ctx.restore();
}

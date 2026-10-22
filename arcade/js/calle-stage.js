'use strict';
// Modo Calle: fondos (paneles pintados si existen; si no, fondo dibujado por código), objetos y barras.

// Paneles pintados: assets/stages/<fase>/p1.webp, p2.webp… (los genera chatgpt_sheets.py import F1-P1 …).
// js/stage-index.js dice cuántos hay por fase. Se colocan uno tras otro; el suelo empieza al 70 % de su altura.
const StageArt = {
  sets: {},
  load(id) {
    const n = (window.STAGE_INDEX || {})[id] || 0;
    if (!n || this.sets[id]) return;
    const set = this.sets[id] = { imgs: [], ready: 0, n };
    for (let i = 1; i <= n; i++) {
      const img = new Image();
      img.onload = () => { set.ready++; };
      img.src = `assets/stages/${id}/p${i}.webp`;
      set.imgs.push(img);
    }
  },
  ok(id) { const s = this.sets[id]; return !!s && s.ready === s.n; },
  // largo de la fase en píxeles lógicos (paneles a 360 de alto)
  len(id) { return this.sets[id].imgs.reduce((a, im) => a + im.width * H / im.height, 0); },
  draw(ctx, id, cx) {
    let x = -cx;
    for (const im of this.sets[id].imgs) {
      const w = im.width * H / im.height;
      if (x + w > 0 && x < W) ctx.drawImage(im, Math.floor(x), 0, Math.ceil(w) + 1, H);
      x += w;
    }
  },
};

function drawStage(ctx, cx, t, stage) {
  if (StageArt.ok(stage.id)) return StageArt.draw(ctx, stage.id, cx);
  if (stage.theme === 'recreativo') return drawRecreativo(ctx, cx, t, stage);
  if (stage.theme === 'noche') return drawNoche(ctx, cx, t, stage);
  return drawPlaya(ctx, cx, t, stage);
}
function drawStageFront(ctx, cx, t, stage) {
  if (StageArt.ok(stage.id)) return;
  if (stage.theme === 'playa') drawPlayaFront(ctx, cx, t);
}

// Suelo con perspectiva común a los fondos de código
function drawFloor(ctx, cx, top, bot, line) {
  const F = CALLE.FLOOR, g = ctx.createLinearGradient(0, F - 4, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, F - 3, W, H - F + 3);
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  for (let y = F + 10, s = 10; y < H; s *= 1.25, y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let wx = Math.floor((cx - 200) / 56) * 56; wx < cx + W + 200; wx += 56) {
    const x = wx - cx;
    ctx.beginPath(); ctx.moveTo(x, F - 3); ctx.lineTo(x + (x - W / 2) * 0.35, H); ctx.stroke();
  }
}
function drawRecreativo(ctx, cx, t, stage) {
  ctx.fillStyle = '#140a26'; ctx.fillRect(0, 0, W, CALLE.FLOOR);
  // techo con neones
  for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ff3fb4', '#3ff0ff', '#ffe03f', '#7a3fff'][i]; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.07 + i); ctx.fillRect(0, 14 + i * 9, W, 3); }
  ctx.globalAlpha = 1;
  // filas de máquinas recreativas (paralaje 0.6 y 1)
  for (const [par, y0, hh, col] of [[0.6, 96, 120, '#2a1a4a'], [1, 120, 128, '#3a2160']]) {
    for (let wx = Math.floor(cx * par / 70) * 70; wx < cx * par + W + 70; wx += 70) {
      const x = wx - cx * par, seed = Math.abs(Math.sin(wx * 12.9898)) * 1000;
      ctx.fillStyle = col; ctx.fillRect(x + 4, y0, 58, hh);
      ctx.fillStyle = '#0a0616'; ctx.fillRect(x + 10, y0 + 18, 46, 36);
      const hue = Math.floor(seed) % 360;
      ctx.fillStyle = `hsl(${hue},90%,${45 + 15 * Math.sin(t * 0.1 + seed)}%)`; ctx.fillRect(x + 13, y0 + 21, 40, 30);
      ctx.fillStyle = `hsl(${(hue + 180) % 360},90%,60%)`; ctx.fillRect(x + 8, y0 + 4, 50, 10);
      ctx.fillStyle = '#d0c0ff'; ctx.fillRect(x + 18, y0 + 62, 4, 6); ctx.fillRect(x + 32, y0 + 62, 5, 5); ctx.fillRect(x + 42, y0 + 62, 5, 5);
    }
  }
  drawFloor(ctx, cx, '#2c1d4a', '#120a24', 'rgba(255,80,200,0.18)');
  // moqueta de recreativo: manchas de colores
  ctx.fillStyle = 'rgba(80,220,255,0.10)';
  for (let wx = Math.floor(cx / 90) * 90; wx < cx + W + 90; wx += 90) { const x = wx - cx; ctx.fillRect(x + 20, CALLE.FLOOR + 30, 14, 4); ctx.fillRect(x + 60, CALLE.FLOOR + 70, 10, 10); }
  const hx = stage.bossX + 80 - cx;
  if (hx > -260 && hx < W + 60) { comicText(ctx, 'HIGH SCORE', hx + 100, 70, 14, Math.floor(t / 10) % 2 ? '#ffe03f' : '#ff3fb4'); }
}
function drawNoche(ctx, cx, t, stage) {
  const g = ctx.createLinearGradient(0, 0, 0, CALLE.FLOOR);
  g.addColorStop(0, '#05040f'); g.addColorStop(1, '#1c1238');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, CALLE.FLOOR);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) ctx.fillRect((((i * 97 - cx * 0.05) % W) + W) % W, (i * 37) % 120, 1, 1);
  // naves del polígono y edificios (paralaje)
  for (const [par, base, col] of [[0.35, 170, '#140c26'], [0.7, 205, '#21153a']]) {
    for (let wx = Math.floor(cx * par / 110) * 110; wx < cx * par + W + 110; wx += 110) {
      const x = wx - cx * par, seed = Math.abs(Math.sin(wx * 78.233)), hh = 60 + seed * 90;
      ctx.fillStyle = col; ctx.fillRect(x, base - hh, 104, hh + 60);
      ctx.fillStyle = 'rgba(255,210,120,0.55)';
      for (let yy = base - hh + 10; yy < base + 40; yy += 16) for (let xx = x + 8; xx < x + 96; xx += 16) if (Math.sin(xx * 3.1 + yy * 7.7) > 0.3) ctx.fillRect(xx, yy, 6, 7);
    }
  }
  // muro con pintadas
  ctx.fillStyle = '#3a2a4a'; ctx.fillRect(0, 205, W, 45);
  for (let wx = Math.floor(cx / 160) * 160; wx < cx + W + 160; wx += 160) {
    const x = wx - cx, hue = Math.floor(Math.abs(Math.sin(wx)) * 360);
    ctx.fillStyle = `hsla(${hue},80%,55%,0.7)`; ctx.font = `14px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(['ZAS', 'MLG', '1989', 'ROCK'][Math.floor(Math.abs(Math.sin(wx * 3)) * 4)], x + 20, 235);
  }
  drawFloor(ctx, cx, '#2a2733', '#121019', 'rgba(255,255,255,0.06)');
  // charcos
  ctx.fillStyle = 'rgba(120,160,255,0.16)';
  for (let wx = Math.floor(cx / 330) * 330; wx < cx + W + 330; wx += 330) { const x = wx - cx; ctx.beginPath(); ctx.ellipse(x + 120, CALLE.FLOOR + 60, 40, 6, 0, 0, 7); ctx.fill(); }
  const hx = stage.bossX + 60 - cx;
  if (hx > -300 && hx < W + 60) {
    ctx.fillStyle = '#0a0612'; ctx.fillRect(hx, 120, 240, 130);
    comicText(ctx, 'DISCO', hx + 120, 140, 18, Math.floor(t / 8) % 3 ? '#3ff0ff' : '#ff3fb4');
  }
}

function hpBar(ctx, x, y, w, h, k, col) {
  ctx.fillStyle = '#3a0d16'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, k), h);
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}

// ── Escenario provisional: paseo marítimo al atardecer (todo dibujado por código) ──
function drawPlaya(ctx, cx, t, stage) {
  const F = CALLE.FLOOR;
  let g = ctx.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, '#2a1450'); g.addColorStop(0.6, '#c9466a'); g.addColorStop(1, '#ffb15e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 152);
  // sol y monte con castillo (paralaje lento)
  ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(470 - cx * 0.03, 138, 34, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b1d4f';
  const mx = -cx * 0.12;
  ctx.beginPath(); ctx.moveTo(mx - 50, 152);
  for (let x = -50; x < 1400; x += 70) ctx.lineTo(mx + x, 152 - 30 - 22 * Math.sin(x * 0.011) - 14 * Math.sin(x * 0.031));
  ctx.lineTo(mx + 1400, 152); ctx.fill();
  ctx.fillStyle = '#2c1440';
  for (let i = 0; i < 7; i++) ctx.fillRect(mx + 210 + i * 14, 92 - (i % 2) * 5, 10, 20 + (i % 2) * 5);
  ctx.fillRect(mx + 205, 106, 104, 10);
  // mar
  g = ctx.createLinearGradient(0, 152, 0, 234);
  g.addColorStop(0, '#e98a6b'); g.addColorStop(0.3, '#6a3d7d'); g.addColorStop(1, '#1d2a5e');
  ctx.fillStyle = g; ctx.fillRect(0, 152, W, 82);
  ctx.fillStyle = 'rgba(255,220,150,0.5)';
  for (let i = 0; i < 14; i++) { const y = 158 + i * 5.5, w = 60 - i * 3; ctx.fillRect(470 - cx * 0.03 - w / 2 + Math.sin(t * 0.05 + i) * 4, y, w, 1.5); }
  // faro a lo lejos
  const fx = 980 - cx * 0.3;
  if (fx > -40 && fx < W + 40) { ctx.fillStyle = '#efe6d8'; ctx.fillRect(fx - 5, 150, 10, 46); ctx.fillStyle = '#2c1440'; ctx.fillRect(fx - 7, 146, 14, 6); if (Math.floor(t / 20) % 2) { ctx.fillStyle = 'rgba(255,240,170,0.8)'; ctx.beginPath(); ctx.arc(fx, 149, 4, 0, 7); ctx.fill(); } }
  // palmeras tras la barandilla
  for (let wx = 120; wx < stage.len + 400; wx += 260) {
    const x = wx - cx * 0.85;
    if (x < -80 || x > W + 80) continue;
    ctx.strokeStyle = '#4a2b2b'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, 242); ctx.quadraticCurveTo(x + 10, 190, x + 4, 150); ctx.stroke();
    ctx.strokeStyle = '#1f5a3e'; ctx.lineWidth = 6;
    for (let a = 0; a < 7; a++) { const an = -Math.PI + a * Math.PI / 6 + Math.sin(t * 0.02 + a) * 0.05; ctx.beginPath(); ctx.moveTo(x + 4, 150); ctx.quadraticCurveTo(x + 4 + Math.cos(an) * 24, 138 + Math.sin(an) * 18, x + 4 + Math.cos(an) * 44, 156 + Math.sin(an) * 22 + 10); ctx.stroke(); }
  }
  // barandilla
  ctx.fillStyle = '#d9d2e8'; ctx.fillRect(0, 232, W, 4); ctx.fillRect(0, 244, W, 3);
  ctx.fillStyle = '#b3a9cc';
  for (let wx = Math.floor(cx / 22) * 22; wx < cx + W + 22; wx += 22) ctx.fillRect(wx - cx, 234, 3, 14);
  // suelo de baldosas con perspectiva
  g = ctx.createLinearGradient(0, F - 4, 0, H);
  g.addColorStop(0, '#8b6f8e'); g.addColorStop(1, '#5b3f63');
  ctx.fillStyle = g; ctx.fillRect(0, F - 3, W, H - F + 3);
  ctx.strokeStyle = 'rgba(30,15,40,0.35)'; ctx.lineWidth = 1;
  for (let y = F + 10, s = 10; y < H; s *= 1.25, y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let wx = Math.floor((cx - 200) / 56) * 56; wx < cx + W + 200; wx += 56) {
    const x = wx - cx;
    ctx.beginPath(); ctx.moveTo(x, F - 3); ctx.lineTo(x + (x - W / 2) * 0.35, H); ctx.stroke();
  }
  // chiringuito en la zona del jefe
  const hx = stage.bossX + 120 - cx;
  if (hx > -260 && hx < W + 60) {
    ctx.fillStyle = '#6b3b22'; ctx.fillRect(hx, 170, 200, 66);
    ctx.fillStyle = '#e8c070'; for (let i = 0; i < 10; i++) ctx.fillRect(hx - 10 + i * 22, 160, 20, 14);
    ctx.fillStyle = '#1a0d22'; ctx.fillRect(hx + 30, 196, 140, 26);
    comicText(ctx, 'CHIRINGUITO', hx + 100, 186, 9, Math.floor(t / 15) % 4 ? '#ff5bd0' : '#ffd0f4');
  }
}
function drawPlayaFront(ctx, cx, t) {
  // farolas en primer plano (paralaje rápido)
  for (let wx = 300; wx < 6000; wx += 700) {
    const x = wx - cx * 1.25;
    if (x < -30 || x > W + 30) continue;
    ctx.fillStyle = '#140b1f'; ctx.fillRect(x - 5, 40, 10, H - 40);
    ctx.fillRect(x - 22, 40, 44, 6);
    ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.fillRect(x - 20, 46, 12, 5); ctx.fillRect(x + 8, 46, 12, 5);
  }
}
function drawItem(ctx, it, t) {
  const x = it.x, y = groundY(it.z) - 4 - Math.abs(Math.sin(t * 0.08)) * 3;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, groundY(it.z) + 1, 14, 3, 0, 0, 7); ctx.fill();
  if (it.kind === 'espeto') { // caña con sardinas
    ctx.strokeStyle = '#c8a26a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y - 10); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#9fb3c8'; ctx.beginPath(); ctx.ellipse(x - 9 + i * 6, y - 3 - i * 2, 5, 2.4, -0.3, 0, 7); ctx.fill(); }
  } else if (it.kind === 'billetes') {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#7cc47a' : '#5fae5d'; ctx.fillRect(x - 12 + i * 3, y - 8 - i * 2, 20, 10); }
    ctx.fillStyle = '#e8d070'; ctx.fillRect(x - 4, y - 12, 4, 10);
  } else if (it.kind === 'vinilo') {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y - 8, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8423a'; ctx.beginPath(); ctx.arc(x, y - 8, 3.5, 0, 7); ctx.fill();
  } else if (it.kind === 'bate' || it.kind === 'guitarra' || it.kind === 'movil') {
    drawWeapon(ctx, it.kind, x - 10, y - 4, 1, 1.45);
  } else { // campero
    ctx.fillStyle = '#e8b964'; ctx.beginPath(); ctx.ellipse(x, y - 4, 14, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5fb04a'; ctx.fillRect(x - 12, y - 4, 24, 2);
    ctx.fillStyle = '#d7a050'; ctx.beginPath(); ctx.ellipse(x, y - 6, 13, 4, 0, Math.PI, 0); ctx.fill();
  }
}

// Objetos que lanzan los enemigos
function drawShot(ctx, s) {
  const x = s.x, y = groundY(s.z) - s.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, groundY(s.z) + 1, 6, 2, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y);
  if (s.kind === 'espeto') {
    ctx.scale(Math.sign(s.vx) || 1, 1);
    ctx.strokeStyle = '#c8a26a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    ctx.fillStyle = '#9fb3c8'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-6 + i * 7, -1, 4, 2, 0, 0, 7); ctx.fill(); }
  } else if (s.kind === 'canica') {
    ctx.fillStyle = '#5fc0ff'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-1, -2, 1.5, 1.5);
  } else if (s.kind === 'cinta') {
    ctx.rotate(s.rot); ctx.fillStyle = '#151515'; ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-6, -3, 12, 3); ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(-4, 2, 1.5, 0, 7); ctx.arc(4, 2, 1.5, 0, 7); ctx.fill();
  } else if (s.kind === 'movil') {
    ctx.rotate(s.rot); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-4, -9, 8, 18); ctx.fillStyle = '#7fd4ff'; ctx.fillRect(-3, -6, 6, 5); ctx.fillStyle = '#555'; ctx.fillRect(1, -13, 2, 5);
  } else { // píxeles de neón
    ctx.rotate(s.rot * 0.3); ctx.fillStyle = `hsl(${(s.rot * 40) % 360},100%,60%)`; ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.restore();
}
function drawDizzy(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 0.12 + i * 2.1;
    drawIcon(ctx, 'star', x + Math.cos(a) * 14, y + Math.sin(a) * 4, a);
  }
}

// los paneles se cargan al arrancar para que estén listos al empezar la fase
for (const id in (window.STAGE_INDEX || {})) StageArt.load(id);

// Armas: dibujadas por código, giradas alrededor de la empuñadura (ang 0 = horizontal hacia delante)
function drawWeapon(ctx, kind, x, y, facing, ang) {
  ctx.save(); ctx.translate(x, y); ctx.scale(facing * 1.4, 1.4); ctx.rotate(ang);
  if (kind === 'bate') {
    ctx.fillStyle = '#c8955a'; ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(34, -3.5); ctx.lineTo(36, 0); ctx.lineTo(34, 3.5); ctx.lineTo(0, 1.5); ctx.fill();
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(-4, -2, 8, 4);
  } else if (kind === 'guitarra') {
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, -1.5, 26, 3); // mástil
    ctx.fillStyle = '#e8423a'; ctx.beginPath(); ctx.moveTo(24, -9); ctx.lineTo(40, -6); ctx.lineTo(44, 0); ctx.lineTo(40, 7); ctx.lineTo(26, 9); ctx.lineTo(30, 0); ctx.fill();
    ctx.fillStyle = '#f4f0ff'; ctx.fillRect(32, -2, 6, 4); ctx.fillStyle = '#222'; ctx.fillRect(-4, -2.5, 5, 5);
  } else {
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-4, -9, 8, 18); ctx.fillStyle = '#7fd4ff'; ctx.fillRect(-3, -6, 6, 5);
  }
  ctx.restore();
}
// Objetos rompibles
function drawProp(ctx, pr, t) {
  const x = pr.x + (pr.shakeT > 0 ? Math.sin(pr.shakeT * 2.5) * 2 : 0), y = groundY(pr.z);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(pr.x, y + 1, 18, 4, 0, 0, 7); ctx.fill();
  if (pr.hp <= 0) { // restos
    ctx.fillStyle = '#5a4030'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + i * 8, y - 4 - (i % 2) * 2, 6, 3);
    return;
  }
  const cracked = pr.hp === 1;
  if (pr.kind === 'caja') {
    ctx.fillStyle = '#b07a3e'; ctx.fillRect(x - 16, y - 30, 32, 30);
    ctx.strokeStyle = '#6b4520'; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y - 30, 32, 30); ctx.beginPath(); ctx.moveTo(x - 16, y - 30); ctx.lineTo(x + 16, y); ctx.moveTo(x + 16, y - 30); ctx.lineTo(x - 16, y); ctx.stroke();
  } else if (pr.kind === 'nevera') {
    ctx.fillStyle = '#3a8fd8'; ctx.fillRect(x - 16, y - 24, 32, 24); ctx.fillStyle = '#f4f0ff'; ctx.fillRect(x - 17, y - 28, 34, 6); ctx.fillRect(x - 5, y - 32, 10, 4);
  } else if (pr.kind === 'maquina') { // máquina de bolas de chicle
    ctx.fillStyle = '#d83a2a'; ctx.fillRect(x - 8, y - 18, 16, 18); ctx.fillStyle = 'rgba(200,240,255,0.7)'; ctx.beginPath(); ctx.arc(x, y - 28, 12, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ff5bd0', '#5effa0', '#ffe03f'][i % 3]; ctx.beginPath(); ctx.arc(x - 6 + (i % 3) * 6, y - 30 + Math.floor(i / 3) * 6, 2.5, 0, 7); ctx.fill(); }
  } else if (pr.kind === 'papelera') {
    ctx.fillStyle = '#4a7a4a'; ctx.beginPath(); ctx.moveTo(x - 12, y - 30); ctx.lineTo(x + 12, y - 30); ctx.lineTo(x + 9, y); ctx.lineTo(x - 9, y); ctx.fill();
    ctx.fillStyle = '#2e5530'; ctx.fillRect(x - 13, y - 32, 26, 4);
  } else { // bidón
    ctx.fillStyle = '#7a8a96'; ctx.fillRect(x - 13, y - 34, 26, 34); ctx.fillStyle = '#5a6670'; ctx.fillRect(x - 13, y - 24, 26, 3); ctx.fillRect(x - 13, y - 11, 26, 3);
    ctx.fillStyle = '#c84a2a'; ctx.fillRect(x - 5, y - 20, 10, 6);
  }
  if (cracked) { ctx.strokeStyle = '#1a0d22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 6, y - 26); ctx.lineTo(x + 2, y - 16); ctx.lineTo(x - 3, y - 8); ctx.stroke(); }
}
// Cajero automático del bonus
function drawATM(ctx, a, t) {
  const x = a.x + (a.shakeT > 0 ? Math.sin(a.shakeT * 3) * 3 : 0), y = groundY(a.z), k = a.hp / a.maxHp;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(a.x, y + 2, 44, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = a.broken ? '#4a4a52' : '#d8d0e8'; ctx.fillRect(x - 36, y - 120, 72, 120);
  ctx.fillStyle = '#2a2440'; ctx.fillRect(x - 36, y - 120, 72, 16);
  comicText(ctx, a.broken ? 'X_X' : '€ 24H', x, y - 112, 8, a.broken ? '#ff5b7a' : '#5effa0');
  ctx.fillStyle = a.broken ? '#111' : (Math.floor(t / 6) % 2 ? '#3ff0ff' : '#ff3fb4'); ctx.fillRect(x - 24, y - 96, 48, 30);
  if (!a.broken) txt(ctx, ['ERROR', '¿PIN?', '$$$$', '404'][Math.floor(t / 20) % 4], x, y - 81, 6, '#120a24', 'center', false);
  ctx.fillStyle = '#8a80a0'; for (let i = 0; i < 9; i++) ctx.fillRect(x - 15 + (i % 3) * 11, y - 58 + Math.floor(i / 3) * 8, 8, 5);
  ctx.fillStyle = '#120a24'; ctx.fillRect(x - 20, y - 26, 40, 5);
  if (k < 0.66) { ctx.strokeStyle = '#120a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 30, y - 100); ctx.lineTo(x - 10, y - 70); ctx.lineTo(x - 22, y - 40); ctx.stroke(); }
  if (k < 0.33) { ctx.beginPath(); ctx.moveTo(x + 30, y - 110); ctx.lineTo(x + 12, y - 60); ctx.lineTo(x + 26, y - 20); ctx.stroke(); }
}

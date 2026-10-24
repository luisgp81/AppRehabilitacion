'use strict';
// Juego: pantallas, rondas, impactos, HUD y bucle a 60 FPS de paso fijo.
const PARAMS = new URLSearchParams(location.search);
const TEST = PARAMS.has('test');

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const RNG = PARAMS.has('seed') ? mulberry32(+PARAMS.get('seed') || 1) : Math.random;
const pickR = arr => arr[Math.floor(RNG() * arr.length)];
const overlap = (a, b) => a.l < b.r && a.r > b.l && a.b < b.t && a.t > b.b;

function txt(ctx, s, x, y, size, col, align = 'center', outline = true) {
  s = fixG(s);
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size / 3.5); ctx.strokeStyle = OUT; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrap(ctx, s, maxW, size) {
  s = fixG(s);
  ctx.font = `${size}px ${FONT}`;
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

const SETTINGS_KEY = 'seleccion-arcade-settings';
const DEFAULT_SETTINGS = { difficulty: 'normal', rounds: 2, time: 99, sfx: true, music: true, voice: true };
function loadSettings() {
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* sin almacenamiento */ } }

const MODES = [
  { id: 'arcade', label: 'ARCADE · 1 JUGADOR', desc: 'Derrota a los otros dos y llévate el bonus.' },
  { id: 'calle', label: 'MODO CALLE · BEAT EM UP', desc: 'Limpia el paseo marítimo de macarras. Prueba de la fase 1.' },
  { id: 'versus', label: 'VERSUS · 2 JUGADORES', desc: 'Mismo teclado o mandos. Que gane el mejor.' },
  { id: 'cpu', label: 'CPU CONTRA CPU', desc: 'Siéntate, palomitas y mira.' },
  { id: 'training', label: 'ENTRENAMIENTO', desc: 'Rival quieto, vida y super infinitos.' },
  { id: 'options', label: 'OPCIONES', desc: 'Dificultad, rondas, tiempo y sonido.' },
  { id: 'controls', label: 'CONTROLES Y GOLPES', desc: 'Todo lo que necesitas saber.' },
];

class Game {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.ctrls = [new Controller(0), new Controller(1)];
    this.settings = loadSettings();
    this.applyAudio();
    this.fx = new FX();
    this.frame = 0; this.screen = 'title'; this.st = 0;
    this.menuIdx = 0; this.optIdx = 0;
    this.projectiles = []; this.projId = 0;
    this.shakeT = 0; this.shakeA = 0; this.hitstop = 0; this.flashT = 0;
    this.errors = [];
    Stage.build();
  }
  applyAudio() { Object.assign(Audio8.opts, { sfx: this.settings.sfx, music: this.settings.music, voice: this.settings.voice }); }

  // ── Entrada de menús (cualquier jugador puede navegar) ──
  menuInput() {
    const a = this.ctrls[0].pressed, b = this.ctrls[1].pressed;
    const esc = Keys.has('Escape') && !this._esc; this._esc = Keys.has('Escape');
    return {
      up: a.up || b.up, down: a.down || b.down, left: a.left || b.left, right: a.right || b.right,
      ok: a.p || a.start || b.p || b.start, back: a.k || b.k || esc, esc,
      p1: a, p2: b,
    };
  }
  go(screen) { this.screen = screen; this.st = 0; }

  // ── Bucle ──
  tick() {
    this.frame++; this.st++;
    const freezeCtrl = this.screen === 'fight' && (this.hitstop > 0 || this.freezeT > 0);
    this.ctrls[0].update(this.f1 ? this.f1.facing : 1, freezeCtrl);
    this.ctrls[1].update(this.f2 ? this.f2.facing : -1, freezeCtrl);
    const fn = this['upd_' + this.screen];
    if (fn) fn.call(this);
    this.fx.update();
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
  }
  render() {
    const ctx = this.ctx;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (this.shakeT > 0) ctx.translate((RNG() - 0.5) * this.shakeA, (RNG() - 0.5) * this.shakeA);
    const fn = this['draw_' + this.screen];
    if (fn) fn.call(this, ctx);
    ctx.restore();
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flashT / 12})`; ctx.fillRect(0, 0, W, H); }
  }
  shake(a) { this.shakeT = 10; this.shakeA = a; }

  // ── TÍTULO ──
  upd_title() {
    const i = this.menuInput();
    if (i.ok || this.tapped) { this.tapped = false; Audio8.unlock(); Audio8.play('coin'); Audio8.music('menu'); this.go('menu'); }
  }
  draw_title(ctx) {
    Stage.draw(ctx, this.frame);
    ctx.fillStyle = 'rgba(10,5,25,0.45)'; ctx.fillRect(0, 0, W, H);
    CHARS.forEach((ch, i) => {
      const f = { t: this.frame + i * 20, state: 'idle', x: 0, facing: 1, guarding: false };
      drawFighterAt(ctx, ch.look, 170 + i * 150, 336, targetPose(f), i === 2 ? -1 : 1, this.frame, { scale: 0.78, state: 'idle' });
    });
    Stage.drawCrowd(ctx, this.frame, 0.3);
    const bob = Math.sin(this.frame * 0.05) * 3;
    comicText(ctx, 'SELECCIÓN', W / 2, 46 + bob, 34, '#f4c20d');
    comicText(ctx, 'ARCADE', W / 2, 88 + bob, 40, '#e8423a');
    txt(ctx, 'COMBATE EN MÁLAGA', W / 2, 120, 11, '#ffffff');
    if (Math.floor(this.frame / 30) % 2 === 0) txt(ctx, 'PULSA ENTER / J / TOCA', W / 2, 142, 9, '#9bf0ff');
    txt(ctx, 'Fan game original · sin marcas oficiales', W / 2, 352, 6, '#bbb', 'center', false);
  }

  // ── MENÚ ──
  upd_menu() {
    const i = this.menuInput();
    if (i.up) { this.menuIdx = (this.menuIdx + MODES.length - 1) % MODES.length; Audio8.play('select'); }
    if (i.down) { this.menuIdx = (this.menuIdx + 1) % MODES.length; Audio8.play('select'); }
    if (i.back) { Audio8.play('back'); this.go('title'); return; }
    if (i.ok) {
      Audio8.play('confirm');
      const m = MODES[this.menuIdx].id;
      if (m === 'options') { this.optIdx = 0; this.go('options'); }
      else if (m === 'controls') { this.ctlPage = 0; this.go('controls'); }
      else this.startSelect(m);
    }
  }
  draw_menu(ctx) {
    this.drawDimStage(ctx, 0.62);
    comicText(ctx, 'SELECCIÓN ARCADE', W / 2, 36, 22, '#f4c20d');
    MODES.forEach((m, i) => {
      const y = 76 + i * 32, sel = i === this.menuIdx;
      ctx.fillStyle = sel ? 'rgba(232,66,58,0.9)' : 'rgba(20,12,40,0.85)';
      ctx.fillRect(150, y - 14, 340, 28);
      ctx.strokeStyle = sel ? '#f4c20d' : '#4b3a78'; ctx.lineWidth = 2; ctx.strokeRect(150, y - 14, 340, 28);
      txt(ctx, m.label, W / 2, y, 10, sel ? '#fff' : '#cfc6ff', 'center', false);
      if (sel && Math.floor(this.frame / 15) % 2 === 0) txt(ctx, '>', 162, y, 10, '#f4c20d', 'center', false);
    });
    txt(ctx, MODES[this.menuIdx].desc, W / 2, 312, 8, '#9bf0ff');
    txt(ctx, 'ARRIBA/ABAJO ELEGIR · ENTER/J ACEPTAR · ESC/K VOLVER', W / 2, 340, 7, '#bbb', 'center', false);
  }
  drawDimStage(ctx, a) {
    Stage.draw(ctx, this.frame); Stage.drawCrowd(ctx, this.frame, 0.2);
    ctx.fillStyle = `rgba(10,5,25,${a})`; ctx.fillRect(0, 0, W, H);
  }

  // ── OPCIONES ──
  optionRows() {
    const s = this.settings, yn = v => v ? 'SÍ' : 'NO';
    return [
      { label: 'DIFICULTAD CPU', val: { easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' }[s.difficulty], ch: d => { const L = ['easy', 'normal', 'hard']; s.difficulty = L[(L.indexOf(s.difficulty) + d + 3) % 3]; } },
      { label: 'RONDAS PARA GANAR', val: String(s.rounds), ch: d => { s.rounds = ((s.rounds - 1 + d + 3) % 3) + 1; } },
      { label: 'TIEMPO POR RONDA', val: s.time ? String(s.time) : 'SIN LÍMITE', ch: d => { const L = [60, 99, 0]; s.time = L[(L.indexOf(s.time) + d + 3) % 3]; } },
      { label: 'EFECTOS', val: yn(s.sfx), ch: () => { s.sfx = !s.sfx; } },
      { label: 'MÚSICA', val: yn(s.music), ch: () => { s.music = !s.music; } },
      { label: 'VOZ LOCUTOR', val: yn(s.voice), ch: () => { s.voice = !s.voice; } },
      { label: 'VOLVER', val: '', back: true },
    ];
  }
  upd_options() {
    const i = this.menuInput(), rows = this.optionRows();
    if (i.up) { this.optIdx = (this.optIdx + rows.length - 1) % rows.length; Audio8.play('select'); }
    if (i.down) { this.optIdx = (this.optIdx + 1) % rows.length; Audio8.play('select'); }
    const r = rows[this.optIdx];
    if ((i.left || i.right || i.ok) && !r.back) { r.ch(i.left ? -1 : 1); this.applyAudio(); saveSettings(this.settings); Audio8.play('select'); }
    if (i.back || (i.ok && r.back)) { Audio8.play('back'); this.go('menu'); }
  }
  draw_options(ctx) {
    this.drawDimStage(ctx, 0.72);
    comicText(ctx, 'OPCIONES', W / 2, 36, 22, '#f4c20d');
    this.optionRows().forEach((r, i) => {
      const y = 86 + i * 32, sel = i === this.optIdx;
      ctx.fillStyle = sel ? 'rgba(47,123,240,0.85)' : 'rgba(20,12,40,0.85)'; ctx.fillRect(120, y - 12, 400, 24);
      txt(ctx, r.label, 136, y, 9, '#fff', 'left', false);
      if (r.val) txt(ctx, (sel ? '< ' : '') + r.val + (sel ? ' >' : ''), 504, y, 9, '#f4c20d', 'right', false);
    });
    txt(ctx, 'IZQ/DER CAMBIAR · ESC VOLVER', W / 2, 340, 7, '#bbb', 'center', false);
  }

  // ── CONTROLES ──
  upd_controls() {
    const i = this.menuInput();
    if (i.left || i.right) { this.ctlPage = (this.ctlPage + (i.right ? 1 : 3)) % 4; Audio8.play('select'); }
    if (i.back || i.ok) { Audio8.play('back'); this.go(this.ctlReturn || 'menu'); this.ctlReturn = null; }
  }
  draw_controls(ctx) {
    this.drawDimStage(ctx, 0.85);
    const pg = this.ctlPage;
    if (pg === 0) {
      comicText(ctx, 'CONTROLES', W / 2, 30, 20, '#f4c20d');
      const rows = [
        ['', 'JUGADOR 1', 'JUGADOR 2'],
        ['MOVER', 'W A S D', 'FLECHAS'],
        ['PUÑO', 'J', 'NUM1 o ,'],
        ['PATADA', 'K', 'NUM2 o .'],
        ['ESPECIAL', 'L', 'NUM3 o -'],
        ['PAUSA', 'ENTER / ESC', 'NUM ENTER'],
      ];
      rows.forEach((r, i) => { const y = 70 + i * 24, c = i ? '#fff' : '#9bf0ff'; txt(ctx, r[0], 70, y, 9, '#f4c20d', 'left', false); txt(ctx, r[1], 330, y, 9, c, 'center', false); txt(ctx, r[2], 520, y, 9, c, 'center', false); });
      const notes = ['Mando: cruceta/stick, X/A puño, Y/B patada, gatillos especial, START pausa.', 'Móvil/tablet: cruceta y botones táctiles en pantalla.', 'Bloquear: mantén ATRÁS (agachado para golpes bajos, de pie para aéreos).', 'Dash: doble toque adelante/atrás. Salto: ARRIBA (+ dirección).'];
      notes.forEach((n, i) => wrap(ctx, n, 560, 7).forEach((l, j) => txt(ctx, l, W / 2, 222 + i * 22 + j * 10, 7, '#cfc6ff', 'center', false)));
    } else if (pg === 1) {
      comicText(ctx, 'GOLPES COMUNES', W / 2, 30, 20, '#f4c20d');
      const rows = [
        ['ESPECIAL (L) solo', 'Proyectil'], ['ESPECIAL + ADELANTE', 'Embestida'], ['ESPECIAL + ATRÁS', 'Antiaéreo invencible'], ['ESPECIAL + ABAJO', 'SUPER (barra llena)'],
        ['Clásico: 236 + PUÑO', 'Proyectil'], ['Clásico: 623 + PUÑO', 'Antiaéreo'], ['Clásico: 214 + PATADA', 'Embestida'], ['Clásico: 236236 + PUÑO', 'SUPER'],
        ['(236 = abajo, abajo-adelante, adelante)', ''],
        ['PATADA + ESPECIAL', 'SUPER 2 (1 barra)'], ['PUÑO+PATADA+ESPECIAL', 'GOLPE FINAL (2 barras)'],
        ['COMBO', 'Puño, puño, patada = remate'],
      ];
      rows.forEach((r, i) => { const y = 60 + i * 23; txt(ctx, r[0], 60, y, 8, '#fff', 'left', false); txt(ctx, r[1], 590, y, 8, '#9bf0ff', 'right', false); });
    } else {
      const list = pg === 2 ? [CHARS[0], CHARS[1]] : [CHARS[2]];
      comicText(ctx, 'GOLPES POR PERSONAJE', W / 2, 26, 16, '#f4c20d');
      list.forEach((c, i) => {
        const y0 = 58 + i * 140;
        txt(ctx, c.name + ' · ' + c.title + ' · ' + c.style.toUpperCase(), 40, y0, 9, c.color, 'left');
        const mv = c.moves;
        [['PROYECTIL', mv.proj.name], ['ANTIAÉREO', mv.dp.name], ['EMBESTIDA', mv.rush.name], ['REMATE', mv.remate.name], ['SUPER 1', mv.super.name], ['SUPER 2', mv.super2.name], ['GOLPE FINAL', mv.ultra.name]]
          .forEach((r, j) => { txt(ctx, r[0], 56, y0 + 20 + j * 15, 7, '#cfc6ff', 'left', false); txt(ctx, r[1], 600, y0 + 20 + j * 15, 7, j === 6 ? '#f4c20d' : '#fff', 'right', false); });
      });
      if (pg === 3) {
        const lines = wrap(ctx, 'Luis: equilibrado. Juan Carlos: más vida y daño, más lento. Sebas: rápido y saltarín, menos vida.', 560, 8);
        lines.forEach((l, j) => txt(ctx, l, W / 2, 240 + j * 14, 8, '#9bf0ff', 'center', false));
      }
    }
    txt(ctx, `PÁGINA ${pg + 1}/4 · IZQ/DER PASAR · ESC VOLVER`, W / 2, 344, 7, '#bbb', 'center', false);
  }

  // ── SELECCIÓN ──
  startSelect(mode) {
    this.mode = mode;
    this.sel = [{ idx: 0, done: false }, { idx: 2, done: false }];
    this.selStep = 0; // para modos donde P1 elige ambos
    this.go('select');
  }
  upd_select() {
    const i = this.menuInput();
    const solo = this.mode !== 'versus';
    const moveCur = (s, inp) => {
      if (inp.left) { s.idx = (s.idx + 2) % 3; Audio8.play('select'); }
      if (inp.right) { s.idx = (s.idx + 1) % 3; Audio8.play('select'); }
    };
    if (solo) {
      const s = this.sel[this.selStep];
      const inp = { left: i.left, right: i.right };
      moveCur(s, inp);
      if (i.ok) {
        s.done = true; Audio8.play('confirm'); Audio8.say(CHARS[s.idx].name.toLowerCase());
        if (this.mode === 'arcade') { this.beginArcade(); return; }
        if (this.mode === 'calle') { this.beginCalle(s.idx); return; }
        if (this.selStep === 0) { this.selStep = 1; this.sel[1].idx = (s.idx + 1) % 3; }
        else { this.beginMatch(this.sel[0].idx, this.sel[1].idx); return; }
      }
      if (i.back) { Audio8.play('back'); if (this.selStep === 1) { this.selStep = 0; this.sel[0].done = false; } else this.go('menu'); }
    } else {
      [[this.sel[0], i.p1], [this.sel[1], i.p2]].forEach(([s, inp]) => {
        if (!s.done) { moveCur(s, inp); if (inp.p || inp.start) { s.done = true; Audio8.play('confirm'); } }
        else if (inp.k) { s.done = false; Audio8.play('back'); }
      });
      if (this.sel[0].done && this.sel[1].done && !this.selWait) this.selWait = 30;
      if (this.selWait && --this.selWait === 0) { this.beginMatch(this.sel[0].idx, this.sel[1].idx); return; }
      if (Keys.has('Escape') && this.st > 10) { this.go('menu'); }
    }
  }
  draw_select(ctx) {
    this.drawDimStage(ctx, 0.7);
    const titles = { calle: 'MODO CALLE', arcade: 'ARCADE', versus: 'VERSUS', cpu: 'CPU VS CPU', training: 'ENTRENAMIENTO' };
    comicText(ctx, 'ELIGE LUCHADOR', W / 2, 24, 18, '#f4c20d');
    txt(ctx, titles[this.mode], W / 2, 46, 8, '#9bf0ff', 'center', false);
    const solo = this.mode !== 'versus';
    const lbl = solo && this.mode !== 'arcade' && this.mode !== 'calle' ? (this.selStep === 0 ? (this.mode === 'training' ? 'TÚ' : 'CPU 1') : (this.mode === 'training' ? 'SPARRING' : 'CPU 2')) : null;
    // tarjetas
    CHARS.forEach((ch, k) => {
      const x = 200 + k * 80, y = 262;
      ctx.fillStyle = '#120a24'; ctx.fillRect(x - 34, y - 34, 68, 68);
      drawPortrait(ctx, ch.look, x, y, 64, 1, this.frame);
      ctx.strokeStyle = '#4b3a78'; ctx.lineWidth = 2; ctx.strokeRect(x - 34, y - 34, 68, 68);
      txt(ctx, ch.name.split(' ')[0], x, y + 44, 7, '#fff', 'center', false);
    });
    this.sel.forEach((s, side) => {
      if (solo && side !== this.selStep && !s.done) return;
      if ((this.mode === 'arcade' || this.mode === 'calle') && side === 1) return;
      const x = 200 + s.idx * 80, y = 262;
      const col = side === 0 ? '#e8423a' : '#2f7bf0';
      if (!s.done || Math.floor(this.frame / 6) % 2 || true) { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(x - 36 + side * 2, y - 36 + side * 2, 72 - side * 4, 72 - side * 4); }
      txt(ctx, solo ? (side === 0 ? '1P' : '2P') : (side === 0 ? '1P' : '2P'), x + (side ? 26 : -26), y - 42, 8, col);
      // vista grande
      const ch = CHARS[s.idx];
      const L = (side === 1 && this.sel[0].idx === s.idx) ? Object.assign({}, ch.look, ch.alt, { isAlt: true }) : ch.look;
      const px = side === 0 ? 92 : 548;
      const f = { t: this.frame, state: s.done ? 'win' : 'idle', x: 0, facing: 1, guarding: false };
      drawFighterAt(ctx, L, px, 212, targetPose(f), side === 0 ? 1 : -1, this.frame, { scale: 0.78, expr: s.done ? 'win' : 'normal', state: s.done ? 'win' : 'idle' });
      txt(ctx, ch.name, px, 228, 10, ch.color);
      txt(ctx, ch.title + ' · ' + ch.style.toUpperCase(), px, 244, 6, '#fff', 'center', false);
      if (s.done) txt(ctx, '¡LISTO!', px, 70, 10, '#5effa0');
    });
    const cur = CHARS[this.sel[solo ? this.selStep : 0].idx];
    wrap(ctx, cur.bio, 300, 7).forEach((l, j) => txt(ctx, l, W / 2, 92 + j * 12, 7, '#e0dcff', 'center', false));
    if (lbl) txt(ctx, 'ELIGE: ' + lbl, W / 2, 176, 9, '#f4c20d');
    if (!solo) txt(ctx, 'P1: A/D + J · P2: FLECHAS + NUM1 o ,', W / 2, 176, 7, '#9bf0ff', 'center', false);
    txt(ctx, 'IZQ/DER ELEGIR · J/ENTER CONFIRMAR · ESC VOLVER', W / 2, 348, 6, '#bbb', 'center', false);
  }

  // ── MODO CALLE (beat 'em up, js/calle.js) ──
  beginCalle(idx) { this.calle = new Calle(this, idx); Audio8.music('fight'); this.go('calle'); }
  upd_calle() {
    const c = this.calle;
    if (c.tryJoin()) return; // el jugador 2 se une con su START
    if ((this.ctrls[0].pressed.start || (c.players.length > 1 && this.ctrls[1].pressed.start) || this.menuInput().esc) && c.phase !== 'over' && c.phase !== 'clear') { this.paused = { idx: 0 }; this.pauseFrom = 'calle'; Audio8.play('select'); this.go('pause'); return; }
    c.update();
  }
  draw_calle(ctx) { this.calle.draw(ctx); }

  beginArcade() {
    const me = this.sel[0].idx;
    const others = [0, 1, 2].filter(i => i !== me);
    if (RNG() < 0.5) others.reverse();
    this.ladder = { me, opps: others, stage: 0, continues: 0 };
    this.beginMatch(me, others[0]);
  }
  beginMatch(i1, i2) {
    const c1 = CHARS[i1], c2 = CHARS[i2];
    this.f1 = new Fighter(this, 0, c1, false);
    this.f2 = new Fighter(this, 1, c2, i1 === i2);
    this.ctrls[0].virtual = null; this.ctrls[1].virtual = null;
    this.ai = [null, null];
    const diff = this.settings.difficulty;
    if (this.mode === 'arcade') {
      const lvl = this.ladder.stage === 1 ? ({ easy: 'normal', normal: 'hard', hard: 'hard' })[diff] : diff;
      this.ai[1] = new AI(this.f2, lvl, RNG);
    } else if (this.mode === 'cpu') { this.ai[0] = new AI(this.f1, diff, RNG); this.ai[1] = new AI(this.f2, diff, RNG); }
    else if (this.mode === 'training') this.ai[1] = new AI(this.f2, 'dummy', RNG);
    this.round = 1; this.draws = 0;
    this.vsQuote = [pickR(c1.quotes.intro), pickR(c2.quotes.intro)];
    Audio8.music('fight');
    this.go('vs');
  }

  // ── VS ──
  upd_vs() {
    const i = this.menuInput();
    if (this.st === 10) Audio8.say(`${this.f1.ch.name} contra ${this.f2.ch.name}`);
    if (this.st > 170 || (i.ok && this.st > 20)) this.startRound();
  }
  draw_vs(ctx) {
    ctx.fillStyle = '#0c0718'; ctx.fillRect(0, 0, W, H);
    const k = Math.min(1, this.st / 20);
    ctx.fillStyle = '#7a1f2b'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.56 * k, 0); ctx.lineTo(W * 0.44 * k, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = '#1b3b7a'; ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - W * 0.44 * k, 0); ctx.lineTo(W - W * 0.56 * k, H); ctx.lineTo(W, H); ctx.fill();
    const f = { t: this.frame, state: 'idle', x: 0, facing: 1, guarding: false };
    drawFighterAt(ctx, this.f1.look, -60 + 220 * k, 350, targetPose(f), 1, this.frame, { scale: 1.45, anim: 'intro' });
    drawFighterAt(ctx, this.f2.look, W + 60 - 220 * k, 350, targetPose(f), -1, this.frame, { scale: 1.45, anim: 'intro' });
    const s = 1 + Math.max(0, (30 - this.st) / 10);
    ctx.save(); ctx.translate(W / 2, H / 2 - 20); ctx.scale(s, s); comicText(ctx, 'VS', 0, 0, 48, '#f4c20d'); ctx.restore();
    txt(ctx, this.f1.ch.name, 20, 24, 14, '#fff', 'left'); txt(ctx, this.f2.ch.name, W - 20, 24, 14, '#fff', 'right');
    if (this.st > 30) {
      [[this.vsQuote[0], 24, 'left', 60], [this.vsQuote[1], W - 24, 'right', 300]].forEach(([q, x, al, y]) => {
        const lines = wrap(ctx, '"' + q + '"', 250, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(al === 'left' ? 14 : W - 274, y - 10, 260, lines.length * 12 + 10);
        lines.forEach((l, j) => txt(ctx, l, x, y + j * 12, 7, '#fff', al, false));
      });
    }
    if (this.mode === 'arcade') txt(ctx, `COMBATE ${this.ladder.stage + 1}/2`, W / 2, 24, 9, '#9bf0ff');
  }

  // ── COMBATE ──
  startRound() {
    this.f1.resetRound(220, 1); this.f2.resetRound(420, -1);
    this.projectiles = []; this.fx.list = [];
    this.time = (this.mode === 'training' || !this.settings.time) ? Infinity : this.settings.time * 60;
    this.phase = 'ready'; this.pt = 0; this.hitstop = 0; this.freezeT = 0;
    this.combos = [null, null]; this.callouts = [null, null];
    this.koSlow = 0; this.roundWinner = null; this.ultra = null; this.ultraKO = false;
    this.go('fight');
  }
  // ── GOLPE FINAL: cinemática de 9 impactos ──
  startUltra(a, d, m) {
    this.ultra = { a, d, m, t: 0, theme: a.ch.moves.ultra.theme, name: a.ch.moves.ultra.name };
    this.projectiles = this.projectiles.filter(p => p.owner !== d);
    a.invuln = 999; d.invuln = 0; a.vx = d.vx = 0; d.vy = 0; d.y = 0; a.y = 0;
    d.state = 'hitstun'; d.stun = 999; d.move = null; d.t = 0;
    d.x = Math.max(STAGE_L + 40, Math.min(STAGE_R - 40, a.x + a.facing * 70));
    this.flashT = 10; this.shake(10);
    Audio8.play('superStart'); Audio8.say(this.ultra.name.toLowerCase());
  }
  updUltra() {
    const u = this.ultra, a = u.a, d = u.d;
    u.t++;
    const HITS = [24, 34, 44, 54, 64, 74, 86, 100, 124];
    const seq = ['lp', 'sk', 'lp', 'cp', 'sk', 'rush', 'dp', 'super', 'super'];
    const k = HITS.indexOf(u.t);
    if (k >= 0) {
      const mv = a.moves[seq[k]];
      a.state = 'attack'; a.move = mv; a.mf = mv.startup; a.t = 0;
      if (k === 6) { a.y = 0.1; }
      // el atacante cambia de lado a mitad de la paliza
      if (k === 4) { a.x = Math.max(STAGE_L + 40, Math.min(STAGE_R - 40, d.x - a.facing * 70)); }
      const last = k === HITS.length - 1;
      const dmg = Math.round((last ? 120 : 30) * a.ch.stats.power);
      d.hp = Math.max(0, d.hp - dmg); d.combo++; d.comboDmg += dmg; a.stats.hits++;
      a.stats.maxCombo = Math.max(a.stats.maxCombo, d.combo);
      this.combos[a.idx] = { hits: d.combo, dmg: d.comboDmg, t: 120 };
      d.state = 'hitstun'; d.t = 0; d.flash = 5;
      const sx = d.x, sy = GROUND - 80;
      this.fx.spark(sx, sy, last ? '#fff' : '#ffe36e', last ? 30 : 14, last ? 2 : 1.3);
      this.fx.word(sx + (RNG() - 0.5) * 60, sy - 40, pickR(last ? ['¡KABOOM!', '¡FINAL!'] : HEAVY_WORDS.concat(KO_WORDS)), pickR(['#f4c20d', '#ff5b7a', '#5effa0', '#9bf0ff']), last ? 24 : 15);
      this.fx.icons(sx, sy, { bank: 'euro', stadium: 'star', metal: 'bolt' }[u.theme] || 'star', last ? 20 : 6);
      Audio8.play(last ? 'superHit' : 'hitHeavy'); this.shake(last ? 14 : 6);
      if (last) this.flashT = 14;
    }
    if (u.t === 150) {
      this.ultra = null;
      a.invuln = 12; a.state = 'idle'; a.move = null; a.y = 0; a.vy = 0;
      a.facing = d.x >= a.x ? 1 : -1;
      d.invuln = 0;
      if (d.hp <= 0) { this.ultraKO = true; this.ko(a, d); d.vx = 6 * a.facing; d.vy = 11; }
      else { d.state = 'launched'; d.vy = 10; d.y = 0.5; d.vx = 5 * a.facing; d.juggle = 3; d.invuln = 80; }
    }
  }
  drawUltra(ctx) {
    const u = this.ultra, t = u.t, k = Math.min(1, t / 12);
    ctx.save();
    if (u.theme === 'bank') {
      ctx.fillStyle = `rgba(2,24,12,${0.85 * k})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(94,255,160,0.55)'; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center';
      for (let i = 0; i < 40; i++) { const x = (i * 16.3) % W, y = ((t * (3 + i % 4) + i * 53) % (H + 40)) - 20; ctx.fillText(i % 5 ? (i % 2 ? '1' : '0') : '€', x, y); }
      ctx.strokeStyle = '#5effa0'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const x = i * 32, y = 300 - i * 11 * Math.min(1, t / 100) + Math.sin(i * 1.7) * 14; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    } else if (u.theme === 'stadium') {
      ctx.globalAlpha = 0.85 * k;
      ctx.translate(W / 2, H / 2); ctx.rotate(t * 0.01);
      for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#1f4fb8' : '#f4c20d'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 800, i * Math.PI / 8, (i + 1) * Math.PI / 8); ctx.fill(); }
      ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.globalAlpha = 1;
      for (let i = 0; i < 60; i++) { ctx.fillStyle = ['#fff', '#f4c20d', '#1f4fb8', '#e8423a'][i % 4]; ctx.fillRect((i * 37 + t * (1 + i % 3)) % W, (i * 61 + t * (2 + i % 4)) % H, 4, 6); }
    } else {
      ctx.fillStyle = `rgba(20,0,36,${0.88 * k})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#d6b3ff'; ctx.lineWidth = 2;
      for (let b = 0; b < 4; b++) { if ((t + b * 7) % 9 > 4) continue; let x = (b * 173 + t * 13) % W; ctx.beginPath(); ctx.moveTo(x, 0); for (let y = 0; y < H; y += 24) { x += (RNG() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
      for (let i = 0; i < 14; i++) { const x = (i * 47) % W, y = ((t * 4 + i * 71) % (H + 40)) - 20; ctx.fillStyle = '#111'; ctx.fillRect(x, y, 22, 13); ctx.fillStyle = '#e8423a'; ctx.fillRect(x + 3, y + 2, 16, 3); }
    }
    ctx.restore();
    // franja con el nombre
    const yb = 118;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, yb - 20, W, 40);
    comicText(ctx, 'GOLPE FINAL', W / 2, yb - 4, 10, '#f4c20d');
    comicText(ctx, u.name, W / 2 + Math.max(0, 40 - t * 3), yb + 12, 14, '#fff');
  }
  hasProjectile(f) { return this.projectiles.some(p => p.owner === f && !p.isSuper); }
  callout(f, name) { this.callouts[f.idx] = { text: name, t: 70 }; }
  endCombo(def) { /* el banner de combo caduca solo */ }
  superFreeze(f, m) {
    this.freezeT = 52; this.freezeBy = f; this.freezeName = m.name;
    Audio8.play('superStart'); Audio8.say(m.name.toLowerCase().replace(/[¡!]/g, ''));
    this.flashT = 6;
  }
  spawnProjectile(f, m) {
    const s = f.s;
    this.projectiles.push({ id: ++this.projId, owner: f, x: f.x + f.facing * 42 * s, y: 62 * s, dir: f.facing, vx: m.speed * f.facing, w: 30, h: 26, fx: m.fx, hits: 1, hitEvery: 99, hitsDone: 0, lastHit: -99, life: 220, age: 0, isSuper: false, mv: m });
    Audio8.play('proj', m.fx);
  }
  spawnSuper(f, m) {
    const s = f.s, dir = f.facing, base = { id: ++this.projId, owner: f, dir, hitsDone: 0, lastHit: -99, age: 0, isSuper: true, mv: m, fx: f.ch.moves.super.fx };
    if (m.sup === 'beam') Object.assign(base, { kind: 'beam', x: f.x + dir * 44 * s, y: 84 * s, vx: 0, w: 0, h: 50, len: 600, hits: 8, hitEvery: 5, life: 46, dmg: 36 });
    else if (m.sup === 'wave') Object.assign(base, { kind: 'ground', x: f.x + dir * 40, y: 0, vx: 5.4 * dir, w: 96, h: 150, hits: 6, hitEvery: 6, life: 150, dmg: 46 });
    else Object.assign(base, { kind: 'ground', x: f.x + dir * 50, y: 0, vx: 7.5 * dir, w: 64, h: 230, hits: 7, hitEvery: 5, life: 120, dmg: 40 });
    this.projectiles.push(base);
    Audio8.play('superHit'); this.shake(8);
  }
  projBox(p) {
    if (p.kind === 'beam') { const a = p.x, b = p.x + p.dir * p.len; return { l: Math.min(a, b), r: Math.max(a, b), b: p.y - p.h / 2, t: p.y + p.h / 2 }; }
    if (p.kind === 'ground') return { l: p.x - p.w / 2, r: p.x + p.w / 2, b: 0, t: p.h };
    return { l: p.x - p.w / 2, r: p.x + p.w / 2, b: p.y - p.h / 2, t: p.y + p.h / 2 };
  }

  upd_fight() {
    const f1 = this.f1, f2 = this.f2, i = this.menuInput();
    const startP = this.ctrls[0].pressed.start || this.ctrls[1].pressed.start || i.esc;
    if (startP && this.phase !== 'end') { this.paused = { idx: 0 }; this.pauseFrom = 'fight'; Audio8.play('select'); this.go('pause'); return; }
    this.pt++;
    if (this.freezeT > 0) { this.freezeT--; updatePose(f1); updatePose(f2); return; }
    if (this.ultra) { this.updUltra(); updatePose(f1); updatePose(f2); for (const f of [f1, f2]) { if (f.dispHp > f.hp) f.dispHp = Math.max(f.hp, f.dispHp - 8); } return; }
    if (this.hitstop > 0) { this.hitstop--; return; }
    if (this.koSlow > 0) { this.koSlow--; if (this.koSlow % 3) { return; } }

    if (this.phase === 'ready') {
      if (this.pt === 1) { Audio8.play('bell'); Audio8.say(this.round === 1 ? 'Asalto uno' : this.isFinal() ? 'Asalto final' : 'Asalto ' + ['uno', 'dos', 'tres', 'cuatro', 'cinco'][this.round - 1]); }
      if (this.pt === 70) Audio8.say('¡A luchar!');
      if (this.pt >= 100) { this.phase = 'fight'; f1.state = 'idle'; f2.state = 'idle'; f1.t = f2.t = 0; }
    }
    // IA
    if (this.phase === 'fight') {
      if (this.ai[0]) this.ai[0].update(this, f2);
      if (this.ai[1]) this.ai[1].update(this, f1);
    }
    if (this.phase === 'fight' || this.phase === 'ko' || this.phase === 'end') {
      f1.update(f2); f2.update(f1);
    }
    f1.physics(); f2.physics();
    this.separate();
    for (const [a, b] of [[f1, f2], [f2, f1]]) {
      if (GROUND_FREE.includes(a.state) || a.state === 'land' || a.state === 'intro') a.facing = b.x >= a.x ? 1 : -1;
    }
    if (this.phase === 'fight') this.resolveHits();
    this.updateProjectiles();
    // entrenamiento: vida y super infinitos
    if (this.mode === 'training') {
      for (const f of [f1, f2]) { if (f.combo === 0 && GROUND_FREE.includes(f.state)) f.hp = Math.min(f.maxHp, f.hp + 20); f.meter = 200; if (f.hp < 1) f.hp = 1; }
    }
    for (const f of [f1, f2]) {
      if (f.dispHp > f.hp) { if (!GROUND_FREE.includes(f.state) && f.state !== 'knockdown') { /* espera */ } else f.dispHp = Math.max(f.hp, f.dispHp - 6); }
      else f.dispHp = f.hp;
      f.meter = Math.min(200, f.meter);
      updatePose(f);
    }
    for (let k = 0; k < 2; k++) {
      if (this.combos[k] && --this.combos[k].t <= 0) this.combos[k] = null;
      if (this.callouts[k] && --this.callouts[k].t <= 0) this.callouts[k] = null;
    }
    if (this.phase === 'fight') {
      if (this.time !== Infinity) { this.time--; if (this.time <= 0) this.timeOver(); }
    } else if (this.phase === 'ko' || this.phase === 'timeup') {
      if (this.pt === 100) {
        const w = this.roundWinner;
        if (w) { w.state = 'win'; w.t = 0; w.move = null; w.vx = 0; }
        Audio8.say(w ? 'Gana ' + w.ch.name.toLowerCase() : 'Empate');
      }
      if (this.pt >= 220) this.nextRound();
    }
  }
  isFinal() { return this.f1.wins === this.settings.rounds - 1 && this.f2.wins === this.settings.rounds - 1; }
  separate() {
    const a = this.f1, b = this.f2;
    if (Math.abs(a.y - b.y) > 70 * Math.min(a.s, b.s)) return;
    if (a.state === 'ko' || b.state === 'ko') return;
    const wa = 20 * a.s, wb = 20 * b.s;
    const d = b.x - a.x, minD = wa + wb;
    if (Math.abs(d) < minD) {
      const sgn = d === 0 ? -a.facing : Math.sign(d), push = (minD - Math.abs(d)) / 2;
      a.x -= sgn * push; b.x += sgn * push;
      const lim = (f) => { const l = 18 * f.s; return [STAGE_L + l, STAGE_R - l]; };
      const [al, ar] = lim(a), [bl, br] = lim(b);
      if (a.x < al) { b.x += al - a.x; a.x = al; } if (a.x > ar) { b.x -= a.x - ar; a.x = ar; }
      if (b.x < bl) { a.x += bl - b.x; b.x = bl; } if (b.x > br) { a.x -= b.x - br; b.x = br; }
    }
  }
  resolveHits() {
    const hits = [];
    for (const [a, d] of [[this.f1, this.f2], [this.f2, this.f1]]) {
      const hb = a.hitbox(); if (!hb) continue;
      const m = a.move, maxH = m.hits || 1;
      if (a.hitsDone >= maxH || a.mf - a.lastHitF < (m.hitEvery || 99)) continue;
      const hu = d.hurtbox();
      if (hu && d.invuln <= 0 && overlap(hb, hu)) {
        hits.push([a, d, m, { x: (Math.max(hb.l, hu.l) + Math.min(hb.r, hu.r)) / 2, y: (Math.max(hb.b, hu.b) + Math.min(hb.t, hu.t)) / 2, last: a.hitsDone + 1 >= maxH }]);
      }
    }
    for (const [a, d, m, info] of hits) { a.hitsDone++; a.lastHitF = a.mf; a.hasHit = true; this.applyHit(a, d, m, info); }
  }
  updateProjectiles() {
    const ps = this.projectiles;
    for (const p of ps) {
      p.age++;
      if (p.kind === 'beam') {
        const o = p.owner; p.x = o.x + p.dir * 44 * o.s; p.life--;
        p.len = p.dir > 0 ? STAGE_R + 40 - p.x : p.x - (STAGE_L - 40);
        if (o.state !== 'attack') p.life = 0;
        if (p.age % 3 === 0) this.fx.icons(p.x + p.dir * Math.random() * p.len, GROUND - p.y, 'digit', 1);
      } else {
        p.x += p.vx; p.life--;
        if (p.age % 4 === 0) {
          const kinds = { euro: 'euro', comic: 'star', vhs: 'film', wave: 'bubble', metal: 'bolt' };
          this.fx.icons(p.x - p.dir * 10, GROUND - p.y - (p.kind === 'ground' ? 60 : 0), kinds[p.fx] || 'star', 1);
        }
        if (p.x < -80 || p.x > W + 80) p.life = 0;
      }
    }
    // choque entre proyectiles
    for (const a of ps) for (const b of ps) {
      if (a === b || a.owner === b.owner || a.life <= 0 || b.life <= 0 || a.kind === 'beam' && b.kind === 'beam') continue;
      if (overlap(this.projBox(a), this.projBox(b))) {
        if (!a.isSuper) { a.life = 0; this.fx.spark(a.x, GROUND - a.y, '#fff', 12); Audio8.play('block'); }
        if (!b.isSuper) b.life = 0;
      }
    }
    // impactos
    if (this.phase === 'fight') for (const p of ps) {
      if (p.life <= 0 || p.hitsDone >= p.hits || p.age - p.lastHit < p.hitEvery) continue;
      const d = p.owner === this.f1 ? this.f2 : this.f1;
      const hu = d.hurtbox(), box = this.projBox(p);
      if (hu && d.invuln <= 0 && overlap(box, hu)) {
        p.hitsDone++; p.lastHit = p.age;
        const last = p.hitsDone >= p.hits;
        const m = p.isSuper
          ? { kind: 'super', dmg: p.dmg, chip: 6, hitstun: 22, blockstun: 10, guard: 'mid', push: 1.4, knockdown: last, launch: last ? { vx: 4, vy: 8 } : null, fx: p.fx }
          : Object.assign({}, p.mv);
        this.applyHit(p.owner, d, m, { x: (Math.max(box.l, hu.l) + Math.min(box.r, hu.r)) / 2, y: (Math.max(box.b, hu.b) + Math.min(box.t, hu.t)) / 2, last, proj: true, dir: p.dir });
        if (!p.isSuper) p.life = 0;
      }
    }
    this.projectiles = ps.filter(p => p.life > 0 && p.hitsDone < p.hits || (p.isSuper && p.life > 0 && p.kind === 'beam'));
  }
  applyHit(a, d, m, info) {
    const sx = info.x, sy = GROUND - info.y;
    const dir = info.dir || a.facing;
    if (d.canBlock(m.guard)) {
      d.state = 'blockstun'; d.stun = m.blockstun; d.t = 0; d.move = null;
      d.hp -= (m.chip || 0);
      d.pushV = (m.push || 3) * dir * 1.1;
      if (d.atWall && !info.proj) a.vx = -(m.push || 3) * dir * 0.8, a.pushV = 0;
      a.meter += 2; d.meter += 4; d.stats.blocks++;
      this.hitstop = 5;
      Audio8.play('block'); this.fx.spark(sx, sy, '#7fd4ff', 6, 0.7);
      if (d.hp <= 0) this.ko(a, d);
      return 'block';
    }
    if (m.kind === 'ultra') { this.startUltra(a, d, m); return 'hit'; }
    const counter = d.state === 'attack' && d.counterable;
    const scale = Math.max(0.3, 1 - 0.12 * d.combo);
    const dmg = Math.max(1, Math.round(m.dmg * a.ch.stats.power * scale * (counter ? 1.25 : 1)));
    d.hp -= dmg; d.combo++; d.comboDmg += dmg; a.stats.hits++;
    a.stats.maxCombo = Math.max(a.stats.maxCombo, d.combo);
    a.meter += dmg * 0.09 + 1; d.meter += dmg * 0.05;
    d.move = null; d.flash = 5; d.t = 0;
    if (d.combo >= 2) this.combos[a.idx] = { hits: d.combo, dmg: d.comboDmg, t: 80 };
    const heavy = dmg >= 70 || m.kind === 'super';
    this.hitstop = m.kind === 'super' ? (info.last ? 14 : 4) : heavy ? 9 : 6;
    Audio8.play(heavy ? 'hitHeavy' : 'hitLight');
    if (counter) { Audio8.play('counter'); this.fx.word(sx, sy - 34, '¡CONTRA!', '#ff5b7a', 10); }
    this.fx.spark(sx, sy, heavy ? '#ffe36e' : '#fff', heavy ? 14 : 8, heavy ? 1.3 : 0.9);
    if (heavy || d.combo % 3 === 0) this.fx.word(sx + (RNG() - 0.5) * 30, sy - 22, pickR(heavy ? HEAVY_WORDS : KO_WORDS), pickR(['#f4c20d', '#ff5b7a', '#5effa0', '#9bf0ff']), heavy ? 14 : 11);
    const iconFor = { euro: 'euro', chart: 'chart', notes: 'note', ai: 'digit', comic: 'star', clap: 'film', sub: 'bubble', wave: 'bubble', vhs: 'film', horns: 'bolt', board: 'star', metal: 'bolt' };
    if (m.fx) { this.fx.icons(sx, sy, iconFor[m.fx] || 'star', m.kind === 'super' ? 3 : 6); if (m.text && info.last !== false && m.kind === 'special') this.fx.word(sx, sy - 44, m.text, '#fff', 10); }
    if (heavy) this.shake(m.kind === 'super' ? 7 : 4);
    if (d.hp <= 0) { this.ko(a, d); return 'hit'; }
    const air = d.airborne || d.state === 'launched';
    if (m.kind === 'super' && !info.last) {
      d.state = 'hitstun'; d.stun = m.hitstun; d.pushV = (m.push || 1.5) * dir;
      if (air) { d.vy = Math.max(d.vy, 2); }
    } else if ((m.knockdown && info.last !== false) || m.launch || air) {
      d.juggle++;
      d.state = 'launched'; d.vy = m.launch ? m.launch.vy : (air ? 5 : 6); d.y = Math.max(d.y, 0.5);
      d.vx = (m.launch ? m.launch.vx : 2.6) * dir;
      if (d.juggle >= 3) d.invuln = 80;
      if (m.guard === 'low' && !air) { d.vy = 3; d.vx = 1.2 * dir; }
    } else {
      d.state = 'hitstun'; d.stun = m.hitstun + (counter ? 6 : 0); d.pushV = (m.push || 3) * dir;
      if (d.atWall && !info.proj) { a.vx = -(m.push || 3) * dir * 0.8; }
    }
    return 'hit';
  }
  ko(a, d) {
    d.hp = 0; d.state = 'ko'; d.vy = 7; d.y = Math.max(d.y, 0.5); d.vx = 3.4 * (a.facing || 1); d.move = null; d.t = 0;
    const other = d === this.f1 ? this.f2 : this.f1;
    if (this.phase !== 'fight') return;
    this.phase = 'ko'; this.pt = 0; this.koSlow = 60; this.flashT = 12;
    this.roundWinner = other.hp > 0 ? other : null;
    if (other.hp <= 0) this.roundWinner = null;
    Audio8.play('ko'); Audio8.say('K. O.');
    this.shake(10);
  }
  timeOver() {
    this.phase = 'timeup'; this.pt = 0;
    const r1 = this.f1.hp / this.f1.maxHp, r2 = this.f2.hp / this.f2.maxHp;
    this.roundWinner = r1 > r2 ? this.f1 : r2 > r1 ? this.f2 : null;
    for (const f of [this.f1, this.f2]) if (f !== this.roundWinner && f.state !== 'ko') { f.state = 'idle'; f.move = null; }
    Audio8.play('bell'); Audio8.say('Tiempo');
  }
  nextRound() {
    const w = this.roundWinner;
    if (w) w.wins++; else this.draws++;
    const need = this.settings.rounds;
    const done = this.f1.wins >= need || this.f2.wins >= need || this.round >= need * 2 + 1;
    if (done) {
      this.matchWinner = this.f1.wins > this.f2.wins ? this.f1 : this.f2.wins > this.f1.wins ? this.f2 : null;
      this.winQuote = this.matchWinner ? pickR(this.matchWinner.ch.quotes.win) : 'Nadie gana. Como en una reunión de los lunes.';
      this.resIdx = 0; Audio8.music('win');
      this.go('result');
    } else { this.round++; this.startRound(); }
  }

  draw_fight(ctx) {
    const f1 = this.f1, f2 = this.f2;
    Stage.draw(ctx, this.frame);
    const fr = this.freezeT > 0;
    // reflejos y sombras
    for (const f of [f1, f2]) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(f.x, GROUND + 2, 26 * f.s * Math.max(0.5, 1 - f.y / 200), 5, 0, 0, 7); ctx.fill();
      if (f.pose) { ctx.save(); ctx.globalAlpha = 0.14; ctx.translate(0, GROUND * 2 + 4); ctx.scale(1, -1); drawFighterAt(ctx, f.look, f.x, GROUND + f.y, f.pose, this.visFacing(f), this.frame, { fighter: f }); ctx.restore(); }
    }
    if (fr) { ctx.fillStyle = 'rgba(5,0,20,0.72)'; ctx.fillRect(0, 0, W, H); }
    if (this.ultra) this.drawUltra(ctx);
    const order = (f2.state === 'attack' && f1.state !== 'attack') ? [f1, f2] : [f2, f1];
    for (const f of order) this.drawFighter(ctx, f);
    for (const p of this.projectiles) drawProjectile(ctx, p, this.frame);
    this.fx.draw(ctx);
    Stage.drawCrowd(ctx, this.frame, this.phase === 'ko' ? 1 : (this.combos[0] || this.combos[1]) ? 0.7 : 0.25);
    if (fr) this.drawCutIn(ctx);
    this.drawHUD(ctx);
    this.drawPhaseText(ctx);
  }
  visFacing(f) {
    if (f.state === 'attack' && f.move && f.move.anim === 'rush' && f.move.style === 'spin' && f.isActive()) return Math.floor(f.mf / 4) % 2 ? -f.facing : f.facing;
    return f.facing;
  }
  drawFighter(ctx, f) {
    if (!f.pose) return;
    if (f.state === 'getup' && Math.floor(f.t / 3) % 2) ctx.globalAlpha = 0.6;
    const useFilter = f.flash > 0 && 'filter' in ctx && !SpriteRig.has(f.look.head);
    if (useFilter) ctx.filter = 'brightness(1.9)';
    let glow = null;
    if (f.state === 'attack' && f.move && (f.move.kind === 'special' || f.move.kind === 'super')) glow = f.ch.color;
    const expr = f.state === 'ko' ? 'ko' : (f.state === 'hitstun' || f.state === 'launched' || f.state === 'knockdown') ? 'hurt' : f.state === 'win' ? 'win' : 'normal';
    // extras de golpe
    if (f.state === 'attack' && f.move && f.move.anim === 'rush') this.drawRushFx(ctx, f);
    if (f.state === 'attack' && f.move && f.move.id === 'dp' && f.isActive()) this.drawDpFx(ctx, f);
    const t0 = performance.now();
    drawFighterAt(ctx, f.look, f.x, GROUND - f.y, f.pose, this.visFacing(f), this.frame, { glow, expr, state: f.state, flash: f.flash > 0, fighter: f });
    if (!TEST) SpriteRig.sample(performance.now() - t0);
    if (useFilter) ctx.filter = 'none';
    ctx.globalAlpha = 1;
    if (PARAMS.has('boxes')) this.drawBoxes(ctx, f);
  }
  drawRushFx(ctx, f) {
    const st = f.move.style || 'charge', x = f.x, y = GROUND - f.y;
    if (!f.isActive()) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(f.facing, 1);
    if (st === 'charge') { // submarino amarillo
      ctx.fillStyle = 'rgba(244,194,13,0.85)'; ctx.beginPath(); ctx.ellipse(6, -62, 46, 30, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f4fb8'; ctx.fillRect(-10, -100, 8, 16); ctx.fillRect(-10, -100, 18, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; [[-16, -64], [4, -64], [24, -64]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 6, 0, 7); ctx.fill(); });
      if (this.frame % 3 === 0) this.fx.icons(x - f.facing * 30, y - 60, 'bubble', 1);
    } else if (st === 'fly') { // patinete volador
      ctx.fillStyle = OUT; roundRect(ctx, -28, -6, 56, 9, 4); ctx.fill();
      ctx.fillStyle = '#e83aa3'; roundRect(ctx, -26, -5, 52, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(120,220,255,0.6)'; ctx.fillRect(-26, 3, 52, 3 + Math.random() * 3);
    } else if (st === 'spin') {
      if (this.frame % 3 === 0) this.fx.icons(x, y - 70, 'note', 2);
      ctx.strokeStyle = 'rgba(155,240,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -60, 50, 14, 0, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  drawDpFx(ctx, f) {
    const x = f.x + f.facing * 20, y = GROUND - f.y - 100;
    const k = f.move.fx;
    if (k === 'chart') { ctx.strokeStyle = '#5effa0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 30 * f.facing, y + 80); ctx.lineTo(x - 15 * f.facing, y + 50); ctx.lineTo(x - 5 * f.facing, y + 60); ctx.lineTo(x, y); ctx.stroke(); }
    else if (k === 'clap') { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 * f.facing); ctx.fillStyle = '#111'; ctx.fillRect(-14, -4, 28, 18); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(-14 + i * 8, -10, 4, 6); ctx.restore(); }
    else if (k === 'horns') { if (this.frame % 2 === 0) this.fx.icons(x, y, 'bolt', 1); }
  }
  drawBoxes(ctx, f) {
    const box = (b, c) => { if (b) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(b.l, GROUND - b.t, b.r - b.l, b.t - b.b); } };
    box(f.hurtbox(), '#0f0'); box(f.hitbox(), '#f00');
    for (const p of this.projectiles) box(this.projBox(p), '#ff0');
  }
  drawCutIn(ctx) {
    const f = this.freezeBy, k = Math.min(1, (52 - this.freezeT) / 8);
    const y = 120, left = f.idx === 0;
    ctx.save();
    ctx.fillStyle = f.ch.color; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(0, y - 40 * k); ctx.lineTo(W, y - 60 * k); ctx.lineTo(W, y + 40 * k); ctx.lineTo(0, y + 60 * k); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, y - 40 * k); ctx.lineTo(W, y - 60 * k); ctx.lineTo(W, y + 40 * k); ctx.lineTo(0, y + 60 * k); ctx.clip();
    drawPortrait(ctx, f.look, left ? 120 : W - 120, y, 150, left ? 1 : -1, this.frame, 'win');
    ctx.restore();
    comicText(ctx, f.move ? f.move.name : this.freezeName, left ? 400 : 240, y, 14, '#fff');
    comicText(ctx, f.move && f.move.kind === 'ultra' ? 'GOLPE FINAL' : 'SUPER', left ? 400 : 240, y - 30, 10, '#f4c20d');
    ctx.restore();
  }
  drawHUD(ctx) {
    const f1 = this.f1, f2 = this.f2;
    const bar = (f, x, w, flip) => {
      const y = 14, h = 14;
      ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.fillStyle = '#3a0d14'; ctx.fillRect(x, y, w, h);
      const r = Math.max(0, f.hp / f.maxHp), rd = Math.max(0, f.dispHp / f.maxHp);
      ctx.fillStyle = '#ff3b3b';
      if (flip) ctx.fillRect(x + w * (1 - rd), y, w * rd, h); else ctx.fillRect(x, y, w * rd, h);
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fff27a'); g.addColorStop(0.5, '#f4c20d'); g.addColorStop(1, '#d08a00');
      if (r < 0.25) { g.addColorStop(0, '#ffb3a0'); }
      ctx.fillStyle = r < 0.25 && Math.floor(this.frame / 8) % 2 ? '#ff7a2a' : g;
      if (flip) ctx.fillRect(x + w * (1 - r), y, w * r, h); else ctx.fillRect(x, y, w * r, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 2, w, 2);
    };
    bar(f1, 56, 236, false); bar(f2, 348, 236, true);
    // retratos
    [[f1, 8], [f2, W - 48]].forEach(([f, x]) => {
      ctx.fillStyle = OUT; ctx.fillRect(x - 2, 4, 44, 44);
      ctx.fillStyle = '#1a1033'; ctx.fillRect(x, 6, 40, 40);
      drawPortrait(ctx, f.look, x + 20, 26, 40, f === f1 ? 1 : -1, this.frame, f.state === 'ko' ? 'ko' : f.state === 'hitstun' ? 'hurt' : 'normal');
      ctx.strokeStyle = f === f1 ? '#e8423a' : '#2f7bf0'; ctx.lineWidth = 2; ctx.strokeRect(x, 6, 40, 40);
    });
    txt(ctx, f1.ch.name, 58, 40, 8, '#fff', 'left'); txt(ctx, f2.ch.name, 582, 40, 8, '#fff', 'right');
    // victorias
    for (let i = 0; i < this.settings.rounds; i++) {
      [[f1, 280 - i * 14], [f2, 360 + i * 14]].forEach(([f, x]) => {
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, 40, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = f.wins > i ? '#f4c20d' : '#3a2a5a'; ctx.beginPath(); ctx.arc(x, 40, 4, 0, 7); ctx.fill();
      });
    }
    // reloj
    ctx.fillStyle = OUT; ctx.fillRect(298, 4, 44, 40);
    ctx.fillStyle = '#1a1033'; ctx.fillRect(300, 6, 40, 36);
    const tsec = this.time === Infinity ? '--' : String(Math.ceil(this.time / 60)).padStart(2, '0');
    txt(ctx, tsec, 320, 25, 16, this.time < 600 ? '#ff5b5b' : '#f4c20d');
    // barras de super
    [[f1, 16, false], [f2, W - 176, true]].forEach(([f, x, flip]) => {
      const y = 330, w = 160, lv = Math.floor(f.meter / 100);
      ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 2, w + 4, 12);
      for (let i = 0; i < 2; i++) {
        const sx = flip ? x + w / 2 * (1 - i) : x + w / 2 * i, part = Math.max(0, Math.min(100, f.meter - i * 100)) / 100;
        ctx.fillStyle = '#10213a'; ctx.fillRect(sx + 1, y, w / 2 - 2, 8);
        ctx.fillStyle = part >= 1 ? (Math.floor(this.frame / 5) % 2 ? (i ? '#f4c20d' : '#5effa0') : '#9bf0ff') : '#2f7bf0';
        if (flip) ctx.fillRect(sx + 1 + (w / 2 - 2) * (1 - part), y, (w / 2 - 2) * part, 8); else ctx.fillRect(sx + 1, y, (w / 2 - 2) * part, 8);
      }
      const label = lv >= 2 ? '¡GOLPE FINAL LISTO!' : lv === 1 ? 'SUPER x1' : 'SUPER';
      txt(ctx, label, flip ? x + w : x, y - 9, 7, lv >= 2 ? '#f4c20d' : lv ? '#5effa0' : '#9bf0ff', flip ? 'right' : 'left');
    });
    // combos y nombres de golpe
    for (let k = 0; k < 2; k++) {
      const left = k === 0, x = left ? 16 : W - 16, al = left ? 'left' : 'right';
      const c = this.combos[k];
      if (c) { comicText(ctx, `${c.hits} GOLPES`, x, 150, 14, '#f4c20d', al); txt(ctx, `${c.dmg} DAÑO`, x, 170, 8, '#fff', al); }
      const co = this.callouts[k];
      if (co) txt(ctx, co.text, x, 62, 8, k ? '#9bf0ff' : '#ffb0a8', al);
    }
    if (this.mode === 'training') txt(ctx, 'ENTRENAMIENTO · ESC: MENÚ', W / 2, 56, 7, '#5effa0');
  }
  drawPhaseText(ctx) {
    const pt = this.pt;
    if (this.phase === 'ready') {
      if (pt < 66) { const s = Math.min(1, pt / 10); ctx.save(); ctx.translate(W / 2, 150); ctx.scale(s, s); comicText(ctx, this.isFinal() ? 'ASALTO FINAL' : `ASALTO ${this.round}`, 0, 0, 26, '#fff'); ctx.restore(); }
      else { const s = 1 + Math.max(0, (80 - pt) / 14); ctx.save(); ctx.translate(W / 2, 150); ctx.scale(s, s); comicText(ctx, '¡A LUCHAR!', 0, 0, 30, '#e8423a'); ctx.restore(); }
    } else if (this.phase === 'ko' || this.phase === 'timeup') {
      if (pt < 100) {
        const s = 1 + Math.max(0, (14 - pt) / 6);
        ctx.save(); ctx.translate(W / 2, 150); ctx.scale(s, s);
        comicText(ctx, this.phase === 'ko' ? (this.ultraKO ? '¡GOLPE FINAL!' : this.roundWinner ? 'K.O.' : 'DOBLE K.O.') : 'TIEMPO', 0, 0, this.ultraKO ? 30 : 44, this.ultraKO ? '#f4c20d' : '#e8423a'); ctx.restore();
      } else {
        const w = this.roundWinner;
        comicText(ctx, w ? `GANA ${w.ch.name}` : 'EMPATE', W / 2, 140, 22, '#f4c20d');
        if (w && w.hp >= w.maxHp) comicText(ctx, '¡PERFECTO!', W / 2, 176, 16, '#5effa0');
      }
    }
  }

  // ── PAUSA ──
  pauseRows() { return ['CONTINUAR', 'CONTROLES', this.mode === 'arcade' ? 'RENDIRSE' : 'SELECCIÓN', 'MENÚ PRINCIPAL']; }
  upd_pause() {
    const i = this.menuInput(), rows = this.pauseRows();
    if (i.up) { this.paused.idx = (this.paused.idx + rows.length - 1) % rows.length; Audio8.play('select'); }
    if (i.down) { this.paused.idx = (this.paused.idx + 1) % rows.length; Audio8.play('select'); }
    const resume = () => { this.screen = this.pauseFrom || 'fight'; };
    if (i.esc || (this.ctrls[0].pressed.start && this.st > 2)) { resume(); return; }
    if (i.ok) {
      Audio8.play('confirm');
      const r = this.paused.idx;
      if (r === 0) resume();
      else if (r === 1) { this.ctlPage = 1; this.ctlReturn = 'pause'; this.go('controls'); }
      else if (r === 2) { if (this.mode === 'arcade') { this.go('title'); Audio8.music('menu'); } else { Audio8.music('menu'); this.startSelect(this.mode); } }
      else { Audio8.music('menu'); this.go('menu'); }
    }
  }
  draw_pause(ctx) {
    this['draw_' + (this.pauseFrom || 'fight')](ctx);
    ctx.fillStyle = 'rgba(5,0,20,0.7)'; ctx.fillRect(0, 0, W, H);
    comicText(ctx, 'PAUSA', W / 2, 90, 26, '#f4c20d');
    this.pauseRows().forEach((r, i) => {
      const y = 150 + i * 32, sel = i === this.paused.idx;
      ctx.fillStyle = sel ? 'rgba(232,66,58,0.9)' : 'rgba(20,12,40,0.9)'; ctx.fillRect(200, y - 12, 240, 24);
      txt(ctx, r, W / 2, y, 9, '#fff', 'center', false);
    });
  }

  // ── RESULTADO ──
  resultRows() {
    if (this.mode === 'arcade') {
      const won = this.matchWinner === this.f1;
      if (won) return [this.ladder.stage >= 1 ? 'VER FINAL' : 'SIGUIENTE RIVAL'];
      return ['CONTINUAR', 'RENDIRSE'];
    }
    return ['REVANCHA', 'SELECCIÓN', 'MENÚ'];
  }
  upd_result() {
    const i = this.menuInput(), rows = this.resultRows();
    if (this.st < 40) return;
    if (i.up) this.resIdx = (this.resIdx + rows.length - 1) % rows.length;
    if (i.down) this.resIdx = (this.resIdx + 1) % rows.length;
    if (!i.ok) return;
    Audio8.play('confirm');
    const r = rows[this.resIdx];
    const L = this.ladder;
    if (r === 'SIGUIENTE RIVAL') { L.stage++; this.beginMatch(L.me, L.opps[L.stage]); }
    else if (r === 'VER FINAL') { Audio8.music('win'); this.go('ending'); }
    else if (r === 'CONTINUAR') { L.continues++; Audio8.play('coin'); this.beginMatch(L.me, L.opps[L.stage]); }
    else if (r === 'RENDIRSE') { Audio8.music('menu'); this.go('title'); }
    else if (r === 'REVANCHA') this.beginMatch(CHARS.indexOf(this.f1.ch), CHARS.indexOf(this.f2.ch));
    else if (r === 'SELECCIÓN') { Audio8.music('menu'); this.startSelect(this.mode); }
    else { Audio8.music('menu'); this.go('menu'); }
  }
  draw_result(ctx) {
    this.drawDimStage(ctx, 0.55);
    const w = this.matchWinner, l = w === this.f1 ? this.f2 : this.f1;
    if (w) {
      const f = { t: this.st, state: 'win', x: 0, facing: 1, guarding: false };
      drawFighterAt(ctx, w.look, 150, 330, targetPose(f), 1, this.frame, { scale: 1.1, expr: 'win', state: 'win' });
      comicText(ctx, `¡GANA ${w.ch.name}!`, 420, 50, 18, w.ch.color);
      const lines = wrap(ctx, '"' + this.winQuote + '"', 300, 8);
      ctx.fillStyle = '#fff'; ctx.fillRect(268, 76, 316, lines.length * 14 + 16);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(268, 76, 316, lines.length * 14 + 16);
      ctx.beginPath(); ctx.moveTo(280, 76 + lines.length * 14 + 16); ctx.lineTo(250, 120 + lines.length * 14); ctx.lineTo(300, 76 + lines.length * 14 + 16); ctx.fillStyle = '#fff'; ctx.fill();
      lines.forEach((t, j) => txt(ctx, t, 426, 92 + j * 14, 8, OUT, 'center', false));
      const s = w.stats;
      txt(ctx, `Combo máximo: ${s.maxCombo} · Especiales: ${s.specials} · Supers: ${s.supers}`, 426, 170, 6, '#9bf0ff', 'center', false);
      void l;
    } else comicText(ctx, 'EMPATE TÉCNICO', W / 2, 80, 22, '#f4c20d');
    if (this.st >= 40) this.resultRows().forEach((r, i) => {
      const y = 214 + i * 30, sel = i === this.resIdx;
      ctx.fillStyle = sel ? 'rgba(232,66,58,0.9)' : 'rgba(20,12,40,0.9)'; ctx.fillRect(320, y - 12, 210, 24);
      txt(ctx, r, 425, y, 9, '#fff', 'center', false);
    });
  }
  // ── FINAL ARCADE ──
  upd_ending() { const i = this.menuInput(); if (this.st > 60 && i.ok) { Audio8.music('menu'); this.go('title'); } }
  draw_ending(ctx) {
    this.drawDimStage(ctx, 0.6);
    const ch = CHARS[this.ladder.me];
    const endings = {
      luis: 'Luis cierra el trimestre invicto. La IA le propone un ascenso, pero él prefiere otra ronda y un buen solo de guitarra.',
      jc: 'Juan Carlos levanta el trofeo y lo dedica al Cádiz. El club anuncia que la permanencia de este año va por él.',
      sebas: 'Sebas gana y abre un videoclub en el Soho malagueño. Primera norma: rebobinar antes de devolver. Segunda: subir el volumen.',
    };
    const f = { t: this.st, state: 'win', x: 0, facing: 1, guarding: false };
    drawFighterAt(ctx, ch.look, W / 2, 330, targetPose(f), 1, this.frame, { scale: 1.0, expr: 'win', state: 'win' });
    comicText(ctx, '¡CAMPEÓN DE MÁLAGA!', W / 2, 40, 18, '#f4c20d');
    wrap(ctx, endings[ch.id], 520, 8).forEach((t, j) => txt(ctx, t, W / 2, 74 + j * 14, 8, '#fff'));
    txt(ctx, `Continuaciones usadas: ${this.ladder.continues}`, W / 2, 130, 7, '#9bf0ff');
    if (this.st > 60) txt(ctx, 'FIN · PULSA ENTER', W / 2, 346, 8, '#bbb');
    if (this.frame % 6 === 0) this.fx.icons(RNG() * W, 0, 'star', 1);
    this.fx.draw(ctx);
  }
}

// Retrato: busto del personaje recortado
function drawPortrait(ctx, L, cx, cy, size, facing, t, expr = 'normal') {
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - size / 2, cy - size / 2, size, size); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); g.addColorStop(0, '#3a2a6a'); g.addColorStop(1, '#120a24');
  ctx.fillStyle = g; ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  if (SpriteRig.has(L.head)) {
    SpriteRig.face(ctx, L.head, cx, cy, size, facing);
    if (expr === 'ko' || expr === 'hurt') { ctx.fillStyle = expr === 'ko' ? 'rgba(0,0,0,0.5)' : 'rgba(255,40,40,0.25)'; ctx.fillRect(cx - size / 2, cy - size / 2, size, size); }
    ctx.restore(); return;
  }
  const k = size / 34 / L.scale;
  const pose = POSES.guard;
  const headY = 99 + L.bulk * 1.3;
  drawFighterAt(ctx, L, cx - 6 * k * L.scale * facing, cy + headY * k * L.scale + size * 0.16, pose, facing, t, { scale: k, expr });
  ctx.restore();
}

// ── Arranque ──
(function boot() {
  const canvas = document.getElementById('game');
  Keys.init();
  const game = new Game(canvas);
  window.SA = { game, CHARS };
  setupTouch(document.getElementById('touch'));
  const touchUI = document.getElementById('touch');
  if (PARAMS.has('touch') || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) touchUI.classList.add('show');
  canvas.addEventListener('pointerdown', () => { Audio8.unlock(); if (game.screen === 'title') game.tapped = true; });
  // Móvil: al primer toque, pantalla completa y horizontal (si el navegador lo permite)
  if (!TEST && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    const goFull = () => {
      const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
      const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* sin bloqueo */ } };
      if (req && !document.fullscreenElement) { try { const r = req.call(el); if (r && r.then) r.then(lock, () => {}); else lock(); } catch (e) { /* no disponible */ } } else lock();
    };
    window.addEventListener('pointerdown', goFull, { once: true });
  }
  // App instalable y sin conexión
  if (!TEST && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('error', e => game.errors.push(String(e.message)));

  window.SA.ready = false;
  SpriteRig.load(ok => { window.SA.sprites = ok; FrameSprites.load(() => { window.SA.ready = true; window.SA.frames = Object.keys(FrameSprites.sets); }); });
  const step = () => { try { game.tick(); } catch (e) { game.errors.push(e.stack || String(e)); throw e; } };
  if (TEST) {
    // Modo prueba: el test avanza los frames de forma determinista
    window.SA.step = (n = 1) => { for (let i = 0; i < n; i++) step(); game.render(); };
    if (document.fonts && document.fonts.load) document.fonts.load(`10px ${FONT}`).then(() => Stage.build(), () => {});
    game.render();
    return;
  }
  let last = performance.now(), acc = 0;
  const DT = 1000 / 60;
  function loop(now) {
    acc += Math.min(100, now - last); last = now;
    let n = 0;
    while (acc >= DT && n < 5) { step(); acc -= DT; n++; }
    game.render();
    requestAnimationFrame(loop);
  }
  const startLoop = () => requestAnimationFrame(t => { last = t; loop(t); });
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load(`10px ${FONT}`), new Promise(r => setTimeout(r, 1500))]).then(() => { Stage.build(); startLoop(); });
  else startLoop();
})();

'use strict';
// Entrada: teclado, mando (Gamepad API), controles táctiles y "mando virtual" de la IA.
const KEYMAP = [
  { // Jugador 1
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    p: ['KeyJ'], k: ['KeyK'], s: ['KeyL'], start: ['Enter', 'Space'],
  },
  { // Jugador 2
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    p: ['Numpad1', 'Comma'], k: ['Numpad2', 'Period'], s: ['Numpad3', 'Slash'], start: ['NumpadEnter'],
  },
];
const BTNS = ['up', 'down', 'left', 'right', 'p', 'k', 's', 'start'];

const Keys = {
  down: new Set(),
  init() {
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') return;
      if (/^(Arrow|Space|Numpad|Slash|Period|Comma|Backspace)/.test(e.code)) e.preventDefault();
      this.down.add(e.code);
      Audio8.unlock();
    });
    window.addEventListener('keyup', e => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  },
  has(code) { return this.down.has(code); },
};

// Estado táctil (solo alimenta al Jugador 1)
const Touch = { state: {}, active: false };

function readGamepad(index) {
  const out = {};
  if (!navigator.getGamepads) return out;
  let pads;
  try { pads = navigator.getGamepads(); } catch (e) { return out; }
  const gp = pads && pads[index];
  if (!gp || !gp.connected) return out;
  const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  out.left = ax < -0.45 || b(14); out.right = ax > 0.45 || b(15);
  out.up = ay < -0.5 || b(12); out.down = ay > 0.5 || b(13);
  out.p = b(2) || b(0); out.k = b(3) || b(1); out.s = b(5) || b(4) || b(7) || b(6);
  out.start = b(9);
  return out;
}

class Controller {
  constructor(idx) {
    this.idx = idx;
    this.held = {}; this.prev = {}; this.pressed = {};
    this.virtual = null; // si existe, la IA manda
    this.history = []; // direcciones numpad relativas al facing
    this.bufP = 0; this.bufK = 0; this.bufS = 0; // frames desde la última pulsación
    this.lastFwdTap = -99; this.lastBackTap = -99; this.frame = 0;
    this.dashReq = 0;
  }
  rawState() {
    if (this.virtual) return this.virtual;
    const st = {};
    const map = KEYMAP[this.idx];
    const gp = readGamepad(this.idx);
    for (const b of BTNS) {
      st[b] = map[b].some(c => Keys.has(c)) || !!gp[b] || (this.idx === 0 && !!Touch.state[b]);
    }
    return st;
  }
  update(facing, frozen = false) {
    this.frame++;
    this.prev = this.held;
    this.held = Object.assign({}, this.rawState());
    if (this.held.left && this.held.right) { this.held.left = this.held.right = false; }
    if (this.held.up && this.held.down) { this.held.up = false; }
    this.pressed = {};
    for (const b of BTNS) this.pressed[b] = !!this.held[b] && !this.prev[b];
    const inc = frozen ? 0 : 1; // durante el hitstop el búfer no caduca
    this.bufP = this.pressed.p ? 0 : this.bufP + inc;
    this.bufK = this.pressed.k ? 0 : this.bufK + inc;
    this.bufS = this.pressed.s ? 0 : this.bufS + inc;
    const d = this.dir(facing);
    if (this.pressed.s) this.sDir = d; // dirección en el instante de pulsar SP
    this.history.push(d);
    if (this.history.length > 40) this.history.shift();
    // Doble toque adelante/atrás = dash
    const fwd = facing > 0 ? 'right' : 'left', back = facing > 0 ? 'left' : 'right';
    if (this.pressed[fwd]) { if (this.frame - this.lastFwdTap < 14) this.dashReq = 1; this.lastFwdTap = this.frame; }
    if (this.pressed[back]) { if (this.frame - this.lastBackTap < 14) this.dashReq = -1; this.lastBackTap = this.frame; }
  }
  dir(facing) {
    const h = this.held;
    let dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    dx *= facing;
    const dy = h.up ? 1 : h.down ? -1 : 0;
    return 5 + dx + dy * 3; // notación numpad: 6 adelante, 4 atrás, 2 abajo, 8 arriba
  }
  fwd(facing) { return facing > 0 ? !!this.held.right : !!this.held.left; }
  back(facing) { return facing > 0 ? !!this.held.left : !!this.held.right; }
  // Busca una secuencia de direcciones en el historial reciente (en orden, con holgura)
  motion(seq, window = 18) {
    const h = this.history, start = Math.max(0, h.length - window);
    let si = seq.length - 1;
    for (let i = h.length - 1; i >= start && si >= 0; i--) {
      if (h[i] === seq[si]) si--;
    }
    return si < 0;
  }
  // Pulsación con búfer de unos frames (para encadenar y cancelar con margen)
  buffered(btn, frames = 4) {
    const v = btn === 'p' ? this.bufP : btn === 'k' ? this.bufK : this.bufS;
    return v < frames;
  }
  consume(btn) { if (btn === 'p') this.bufP = 99; else if (btn === 'k') this.bufK = 99; else this.bufS = 99; }
  clearAll() { this.bufP = this.bufK = this.bufS = 99; this.history.length = 0; this.dashReq = 0; }
}

// Controles táctiles: cruceta + 3 botones + START
function setupTouch(root) {
  const pad = root.querySelector('#tpad');
  const knob = root.querySelector('#tknob');
  let padId = null;
  const setDir = (cx, cy) => {
    const r = pad.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const dead = r.width * 0.16;
    Touch.state.left = dx < -dead; Touch.state.right = dx > dead;
    Touch.state.up = dy < -dead * 1.3; Touch.state.down = dy > dead;
    const m = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    const a = Math.atan2(dy, dx);
    knob.style.transform = `translate(${Math.cos(a) * m * r.width * 0.3}px, ${Math.sin(a) * m * r.width * 0.3}px)`;
  };
  const clearDir = () => { Touch.state.left = Touch.state.right = Touch.state.up = Touch.state.down = false; knob.style.transform = ''; };
  pad.addEventListener('pointerdown', e => { padId = e.pointerId; pad.setPointerCapture(e.pointerId); setDir(e.clientX, e.clientY); Audio8.unlock(); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === padId) setDir(e.clientX, e.clientY); });
  const end = e => { if (e.pointerId === padId) { padId = null; clearDir(); } };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  root.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.dataset.btn;
    el.addEventListener('pointerdown', e => { Touch.state[b] = true; el.classList.add('on'); Audio8.unlock(); e.preventDefault(); });
    const up = () => { Touch.state[b] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  });
}

'use strict';
// IA rival: maneja un "mando virtual" con las mismas reglas que un humano (sin trampas de inputs).
const AI_LEVELS = {
  easy: { react: 22, block: 0.18, aa: 0.12, combo: 0.15, super: 0.3, aggr: 0.35, low: 0.1, think: [26, 50] },
  normal: { react: 13, block: 0.5, aa: 0.45, combo: 0.5, super: 0.6, aggr: 0.55, low: 0.4, think: [14, 32] },
  hard: { react: 7, block: 0.82, aa: 0.8, combo: 0.85, super: 0.9, aggr: 0.7, low: 0.75, think: [6, 18] },
};

class AI {
  constructor(f, level, rng = Math.random) {
    this.f = f; this.level = level; this.cfg = AI_LEVELS[level] || AI_LEVELS.normal; this.rng = rng;
    this.v = {}; f.ctrl.virtual = this.v;
    this.act = null; this.hist = []; this.rolled = {}; this.wait = 30;
  }
  r() { return this.rng(); }
  pick(opts) { // [[peso, fn], ...]
    const tot = opts.reduce((a, o) => a + o[0], 0); let x = this.r() * tot;
    for (const o of opts) { x -= o[0]; if (x <= 0) return o[1](); }
    return opts[opts.length - 1][1]();
  }
  doAct(kind, o = {}) { this.act = Object.assign({ kind, t: 0, dur: 1, dir: 0, down: false, up: false, btn: null, at: 0 }, o); }
  once(key) { if (this.rolled[key]) return false; this.rolled[key] = true; return true; }
  update(game, opp) {
    const v = this.v, f = this.f, c = this.cfg;
    for (const k of BTNS) v[k] = false;
    if (this.level === 'dummy') return;
    this.hist.push({ x: opp.x, y: opp.y, vy: opp.vy, state: opp.state, move: opp.move, mf: opp.mf, serial: opp.moveSerial, jserial: opp.jumpSerial });
    if (this.hist.length > 40) this.hist.shift();
    const seen = this.hist[Math.max(0, this.hist.length - 1 - c.react)];
    const d = Math.abs(opp.x - f.x);
    const free = ['idle', 'walk', 'crouch'].includes(f.state);

    // 1) Confirmar golpe y cancelar a especial (combo)
    if (f.state === 'attack' && f.hasHit && f.move && f.move.cancel && this.once('c' + f.moveSerial)) {
      if (this.r() < c.combo) {
        const m = f.move.id;
        if (f.meter >= 200 && this.r() < c.super) this.doAct('ultra', { dur: 2 });
        else if (f.meter >= 100 && this.r() < c.super) this.r() < 0.5 ? this.doAct('press', { btn: 's', down: true, dur: 2 }) : this.doAct('super2', { dur: 2 });
        else if (m === 'lp' && f.chainCount === 0 && this.r() < 0.5) this.doAct('press', { btn: 'p', dur: 2 });
        else if (m === 'lp' && f.chainCount >= 1 && this.r() < 0.7) this.doAct('press', { btn: 'k', dur: 2 });
        else if (m === 'lp' && this.r() < 0.4) this.doAct('press', { btn: 'k', dur: 2 });
        else this.doAct('press', { btn: 's', dir: this.r() < 0.6 ? 1 : 0, dur: 2 });
      }
    }
    // 2) Reacciones defensivas (con retraso según dificultad)
    if (free && seen) {
      const incoming = game.projectiles.find(p => p.owner === opp && Math.sign(f.x - p.x) === p.dir && Math.abs(p.x - f.x) < 190);
      if (incoming && this.once('p' + incoming.id)) {
        if (this.r() < c.block) this.pick([[3, () => this.doAct('block', { dir: -1, dur: 26 })], [2, () => this.doAct('jump', { dir: 1, up: true, dur: 4 })], [1, () => !game.hasProjectile(f) ? this.doAct('press', { btn: 's', dur: 2 }) : this.doAct('block', { dir: -1, dur: 26 })]]);
      }
      if (seen.state === 'attack' && seen.move && seen.mf <= seen.move.startup + 2 && d < 150 && this.once('a' + seen.serial)) {
        if (this.r() < c.block) this.doAct('block', { dir: -1, down: seen.move.guard === 'low' ? this.r() < c.low + 0.2 : (seen.move.guard === 'overhead' ? false : this.r() < 0.3), dur: 18 });
      }
      if ((seen.state === 'jump' || (seen.state === 'attack' && seen.move && seen.move.kind === 'air')) && d < 150 && seen.y > 20 && this.once('j' + seen.jserial)) {
        if (this.r() < c.aa) this.doAct('press', { btn: 's', dir: -1, dur: 2 });
        else if (this.r() < c.block) this.doAct('block', { dir: -1, dur: 24 });
      }
    }
    // 3) Plan ofensivo/neutral
    if (!this.act && free) {
      if (--this.wait > 0) { this.doAct('idle', { dur: 1 }); }
      else {
        this.wait = c.think[0] + Math.floor(this.r() * (c.think[1] - c.think[0]));
        const ag = c.aggr, canProj = !game.hasProjectile(f);
        if (f.meter >= 200 && d < 120 && this.r() < c.super * 0.6) this.doAct('ultra', { dur: 2 });
        else if (f.meter >= 100 && d < 230 && this.r() < c.super * 0.5) this.r() < 0.5 ? this.doAct('press', { btn: 's', down: true, dur: 2 }) : this.doAct('super2', { dur: 2 });
        else if (d < 95) this.pick([
          [3 * ag, () => this.doAct('press', { btn: 'p', dur: 1 })],
          [1.5 * ag, () => this.doAct('press', { btn: 'p', down: true, dur: 1 })],
          [1.5 * ag, () => this.doAct('press', { btn: 'k', down: true, dur: 1 })],
          [1.5 * ag, () => this.doAct('press', { btn: 'k', dur: 1 })],
          [0.6, () => this.doAct('press', { btn: 's', dir: -1, dur: 2 })],
          [0.6, () => this.doAct('backdash', { dur: 6 })],
          [1.5 * (1 - ag), () => this.doAct('block', { dir: -1, dur: 14 })],
        ]);
        else if (d < 230) this.pick([
          [4, () => this.doAct('walk', { dir: 1, dur: 14 + Math.floor(this.r() * 20) })],
          [1.5 * ag, () => this.doAct('jump', { dir: 1, up: true, dur: 4, then: 'air' })],
          [1.2 * ag, () => this.doAct('press', { btn: 's', dir: 1, dur: 2 })],
          [canProj ? 1.5 : 0, () => this.doAct('press', { btn: 's', dur: 2 })],
          [1, () => this.doAct('walk', { dir: -1, dur: 10 })],
          [1 * (1 - ag), () => this.doAct('idle', { dur: 12 })],
        ]);
        else this.pick([
          [canProj ? 3 : 0, () => this.doAct('press', { btn: 's', dur: 2 })],
          [4, () => this.doAct('walk', { dir: 1, dur: 20 + Math.floor(this.r() * 25) })],
          [1, () => this.doAct('jump', { dir: 1, up: true, dur: 4, then: 'air' })],
          [1.5 * (1 - ag), () => this.doAct('idle', { dur: 15 })],
        ]);
      }
    }
    // Ataque aéreo al acercarse saltando
    if (f.state === 'jump' && !f.airAttackUsed && d < 110 && f.vy < 2 && this.once('air' + f.jumpSerial)) {
      this.doAct('press', { btn: this.r() < 0.5 ? 'k' : 'p', dur: 1 });
    }
    // 4) Ejecutar acción en curso sobre el mando virtual
    const a = this.act;
    if (a) {
      const fwd = f.facing > 0 ? 'right' : 'left', back = f.facing > 0 ? 'left' : 'right';
      if (a.kind === 'backdash') { if (a.t === 0 || a.t === 3) v[back] = true; }
      else if (a.kind === 'ultra') { if (a.t === 0) { v.p = v.k = v.s = true; } }
      else if (a.kind === 'super2') { if (a.t === 0) { v.k = v.s = true; } }
      else {
        if (a.dir > 0) v[fwd] = true; else if (a.dir < 0) v[back] = true;
        if (a.down) v.down = true;
        if (a.up && a.t < 2) v.up = true;
        if (a.btn && a.t === a.at) v[a.btn] = true;
      }
      a.t++;
      if (a.t >= a.dur) this.act = null;
    }
  }
}

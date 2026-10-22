'use strict';
// Modo Calle: beat 'em up de desplazamiento lateral al estilo de los 90 con los luchadores del juego.
// Reutiliza golpes (buildMoves), sprites (FrameSprites), efectos (FX) y sonido; el mundo tiene profundidad (z).
// Fase 1: un escenario provisional y enemigos con el arte de los protagonistas recoloreado.
const CALLE = {
  FLOOR: 250, ZMAX: 96, SC: 0.7, ZHIT: 13, GRAV: 0.6,
  CHAIN: ['lp', 'lp', 'sk', 'remate'], // combo de puño: jab, jab, patada, remate que lanza
};
const groundY = z => CALLE.FLOOR + z;

// Enemigos provisionales: arquetipos originales de los 80 y 90 (el arte definitivo llega en la fase 2)
const THUGS = {
  macarra: { name: 'MACARRA DE CRESTA', base: 'sebas', tint: '#b8282e', hp: 140, speed: 1.6, dmg: 0.55, moves: ['lp', 'lp', 'sk'], cool: 50, score: 300 },
  yuppie: { name: 'YUPPIE DE HOMBRERAS', base: 'luis', tint: '#c9a24a', hp: 170, speed: 1.4, dmg: 0.6, moves: ['lp', 'sk'], rusher: true, cool: 60, score: 500 },
  heavy: { name: 'HEAVY DE GASOLINERA', base: 'jc', tint: '#4a4a4a', hp: 260, speed: 1.1, dmg: 0.75, moves: ['sk', 'lp'], cool: 70, score: 700, drop: 'campero' },
  jefe: { name: 'EL DIRECTOR DE ZONA', base: 'luis', tint: '#d8d0c0', hp: 1100, speed: 1.5, dmg: 0.8, moves: ['lp', 'sk', 'lp', 'dp'], rusher: true, cool: 40, score: 5000, scale: 1.18, boss: true },
};

// Escenario 1 (provisional): paseo marítimo de Málaga. 'at' = posición del mundo donde arranca cada oleada.
const STAGES = [{
  name: 'PASEO MARÍTIMO', len: 3600,
  waves: [
    { at: 520, foes: ['macarra', 'macarra'] },
    { at: 1180, foes: ['macarra', 'yuppie', 'macarra'] },
    { at: 1880, foes: ['heavy', 'yuppie', 'macarra'] },
    { at: 2580, foes: ['macarra', 'heavy', 'yuppie', 'macarra', 'macarra'] },
    { at: 3300, foes: ['jefe', 'macarra', 'yuppie'], boss: true },
  ],
  items: [{ x: 900, z: 70, kind: 'campero' }, { x: 2250, z: 30, kind: 'espeto' }, { x: 3050, z: 80, kind: 'espeto' }],
}];
const ITEMS = { espeto: { name: '¡ESPETO!', hp: 0.6, score: 500 }, campero: { name: '¡CAMPERO!', hp: 0.3, score: 300 } };

class Brawler {
  constructor(world, ch, o) {
    this.w = world; this.ch = ch; this.def = o.def || null; this.isPlayer = !!o.player;
    this.look = ch.look; this.moves = buildMoves(ch);
    this.k = CALLE.SC * ((this.def && this.def.scale) || 1);
    this.maxHp = this.hp = o.hp;
    Object.assign(this, { x: o.x, z: o.z, y: 0, vx: 0, vz: 0, vy: 0, pushV: 0, facing: o.facing || 1 });
    Object.assign(this, { state: 'idle', t: 0, move: null, mf: 0, stun: 0, invuln: 0, flash: 0, landT: 0, cool: 30, serial: 0 });
    this.ctrl = o.ctrl || { held: {} }; this.idx = o.idx || 0; this.guarding = false; this.pose = null; this.walkX = 0;
    this.recent = 0; this.lastHurtF = -99; this.chain = 0; this.lastConnect = -99;
  }
  get crouching() { return false; }
  get airborne() { return this.y > 0 || this.vy > 0; }
  get free() { return this.state === 'idle' || this.state === 'walk'; }
  get gone() { return this.state === 'dead'; }
  get ls() { return this.look.scale * this.k; }
  isActive() { const m = this.move; return this.state === 'attack' && m && this.mf >= m.startup && this.mf < m.startup + m.active; }
  hurtbox() {
    if (['knockdown', 'getup', 'ko', 'dead'].includes(this.state) || this.invuln > 0 || this.hp <= 0) return null;
    if (this.def && !this.entered) return null; // fuera de pantalla no se le puede pegar
    const s = this.ls, w = 44 * s;
    return { l: this.x - w / 2, r: this.x + w / 2, b: this.y, t: this.y + (this.state === 'launched' ? 70 : 112) * s };
  }
  hitbox() {
    const m = this.move;
    if (!m || !m.hb || !this.isActive()) return null;
    const k = this.k;
    // el antiaéreo especial golpea a los dos lados, como el especial "de emergencia" de los beat 'em up
    if (m.id === 'dp' && this.isPlayer) { const w = (m.hb.x + m.hb.w) * k * 1.6; return { l: this.x - w, r: this.x + w, b: this.y, t: this.y + m.hb.y * k + m.hb.h * k / 2 }; }
    const cx = this.x + this.facing * m.hb.x * k;
    return { l: cx - m.hb.w * k / 2, r: cx + m.hb.w * k / 2, b: this.y + (m.hb.y - m.hb.h / 2) * k, t: this.y + (m.hb.y + m.hb.h / 2) * k };
  }
  startMove(id) {
    const m = this.moves[id];
    if (!m) return false;
    if (m.kind !== 'air') { this.vx = 0; this.vz = 0; }
    this.state = 'attack'; this.move = m; this.mf = 0; this.t = 0; this.serial++;
    this.hitsDone = 0; this.hasHit = false;
    if (m.invuln) this.invuln = m.invuln[1];
    Audio8.play(m.kind === 'special' || m.kind === 'super' ? 'special' : 'whoosh');
    return true;
  }
  update() {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    switch (this.state) {
      case 'attack': this.stepMove(); break;
      case 'hitstun': this.stun--; if (this.stun <= 0) { this.state = 'idle'; this.t = 0; } break;
      case 'land': this.vx = this.vz = 0; if (this.t >= this.landT) { this.state = 'idle'; this.t = 0; } break;
      case 'knockdown':
        if (this.t >= (this.isPlayer ? 40 : 46)) {
          if (this.hp <= 0) { this.state = 'dead'; this.t = 0; } else { this.state = 'getup'; this.t = 0; }
        }
        break;
      case 'getup': if (this.t >= 18) { this.state = 'idle'; this.t = 0; this.invuln = this.isPlayer ? 50 : 8; } break;
    }
  }
  stepMove() {
    const m = this.move, f = this.facing;
    this.mf++;
    if (m.rise && this.mf === m.rise.frame) { this.vy = m.rise.vy * 0.85; this.vx = m.rise.vx * f * 0.6; this.y = 0.1; }
    if (m.dash) {
      if (this.mf >= m.startup && this.mf < m.startup + m.active) {
        this.vx = (m.cost && this.hasHit ? 1.2 : m.dash * 0.8) * f;
        if (m.style === 'fly' && this.mf === m.startup) { this.vy = 2.6; this.y = 0.1; }
      } else this.vx *= 0.75;
    }
    const total = m.startup + m.active + m.recovery;
    if (m.kind === 'air') { if (this.mf >= total) { this.state = 'jump'; this.move = null; } return; }
    if (m.rise || (m.dash && m.style === 'fly')) {
      if (this.y <= 0 && this.mf > m.startup + 2) { this.state = 'land'; this.landT = 12; this.t = 0; this.move = null; this.vx = 0; }
      else if (this.mf > total + 60) { this.state = 'jump'; this.move = null; }
      return;
    }
    if (this.mf >= total) { this.state = 'idle'; this.move = null; this.t = 0; this.vx = 0; }
  }
  physics() {
    if (['hitstun', 'knockdown', 'getup', 'dead'].includes(this.state) && !this.airborne) { this.vx = this.pushV; this.pushV *= 0.82; }
    this.x += this.vx; this.z += this.vz;
    if (this.vx || this.vz) this.walkX += Math.hypot(this.vx, this.vz) * this.facing;
    this.z = Math.max(0, Math.min(CALLE.ZMAX, this.z));
    if (this.y > 0 || this.vy > 0) {
      const g = (this.state === 'attack' && this.move && this.move.style === 'fly') ? 0.25 : CALLE.GRAV;
      this.vy -= g; this.y += this.vy;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.landed(); }
    }
  }
  landed() {
    if (this.state === 'jump' || (this.state === 'attack' && this.move.kind === 'air')) {
      this.state = 'land'; this.landT = 4; this.t = 0; this.move = null; this.vx = this.vz = 0; Audio8.play('land');
    } else if (this.state === 'launched') {
      this.state = 'knockdown'; this.t = 0; this.pushV = this.vx * 0.4; this.vx = 0; this.thrown = false;
      this.w.shake(this.def && this.def.boss ? 6 : 3); Audio8.play('land');
      this.w.game.fx.dust(this.x, groundY(this.z));
    } else if (this.state === 'hitstun') { this.state = 'land'; this.landT = 2; this.t = 0; }
  }
}

class Calle {
  constructor(game, idx) {
    this.game = game; this.stage = STAGES[0]; this.frame = 0;
    const ch = CHARS[idx];
    this.player = new Brawler(this, ch, { player: true, hp: ch.stats.hp, x: 120, z: 56, ctrl: game.ctrls[0] });
    this.lives = 2; this.score = 0; this.meter = 0;
    this.camX = 0; this.lockX = null; this.waveI = 0; this.queue = []; this.foes = []; this.engaged = [];
    this.items = this.stage.items.map(it => Object.assign({ taken: false }, it));
    this.phase = 'intro'; this.pt = 0; this.hitstop = 0; this.shakeT = 0; this.shakeA = 0;
    this.foeHud = null; this.superFx = 0; this.nextId = 1;
    game.f1 = this.player; game.f2 = null;
  }
  shake(a) { this.shakeT = 10; this.shakeA = a; }

  // ── Bucle ──
  update() {
    this.frame++; this.pt++;
    if (this.shakeT > 0) this.shakeT--;
    if (this.superFx > 0) this.superFx--;
    if (this.foeHud && --this.foeHud.t <= 0) this.foeHud = null;
    if (this.phase === 'over') return this.updOver();
    if (this.hitstop > 0) { this.hitstop--; return; }
    const p = this.player;
    if (this.phase === 'intro' && this.pt >= 90) { this.phase = 'play'; this.pt = 0; }
    if (this.phase !== 'clear' && this.pt > (this.phase === 'intro' ? 40 : 0)) this.updPlayer();
    this.spawnQueue();
    this.pickEngaged();
    for (const e of this.foes) this.updFoe(e);
    for (const b of [p, ...this.foes]) { b.update(); b.physics(); updatePose(b); }
    // una vez dentro de la pantalla, los enemigos no vuelven a salir
    for (const e of this.foes) {
      const lo = this.camX + 14, hi = this.camX + W - 14;
      if (e.x > lo && e.x < hi) e.entered = true;
      if (e.entered) e.x = Math.max(lo, Math.min(hi, e.x));
    }
    // los enemigos no se amontonan en el mismo sitio
    for (const a of this.foes) for (const b of this.foes) {
      if (a === b || a.hp <= 0 || b.hp <= 0 || Math.abs(a.z - b.z) > 12) continue;
      const d = b.x - a.x, min = 30 * Math.max(a.ls, b.ls);
      if (Math.abs(d) < min) { const push = (min - Math.abs(d)) * 0.25 * (Math.sign(d) || 1); a.x -= push; b.x += push; }
    }
    this.updSuper();
    this.resolveHits();
    this.bowling();
    this.pickItems();
    this.cleanup();
    this.updCamera();
    this.updProgress();
    if (p.state === 'dead') this.playerDown();
    if (this.phase === 'clear' && this.pt === 60) { p.state = 'win'; p.t = 0; p.move = null; Audio8.music('win'); Audio8.say('Fase superada'); }
    if (this.phase === 'clear' && this.pt > 200 && this.game.menuInput().ok) { Audio8.music('menu'); this.game.go('menu'); }
  }

  updPlayer() {
    const p = this.player, c = p.ctrl, h = c.held;
    if (p.state === 'win') return;
    if (p.free) {
      if (c.buffered('s', 4)) {
        c.consume('s');
        if (this.meter >= 100) { this.meter -= 100; this.startSuper(); return; }
        p.startMove(c.fwd(p.facing) ? 'rush' : 'dp'); p.special = true;
        this.callout(p.move.name);
        return;
      }
      if (c.buffered('k', 4)) {
        c.consume('k');
        const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0), dz = (h.down ? 1 : 0) - (h.up ? 1 : 0);
        if (dx) p.facing = dx;
        Object.assign(p, { state: 'jump', t: 0, vy: p.ch.stats.jumpV * 0.82, y: 0.1, vx: dx * p.ch.stats.jumpX * 0.9, vz: dz * 1.3, airUsed: false });
        Audio8.play('jump'); return;
      }
      if (c.buffered('p', 4)) { c.consume('p'); this.punch(this.frame - p.lastConnect < 26 ? p.chain + 1 : 0); return; }
      const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0), dz = (h.down ? 1 : 0) - (h.up ? 1 : 0);
      p.vx = dx * p.ch.stats.walkF * 0.8; p.vz = dz * 1.6;
      if (dx) p.facing = dx;
      p.state = dx || dz ? 'walk' : 'idle';
    } else if (p.state === 'jump' && !p.airUsed && (c.buffered('p', 4) || c.buffered('k', 4))) {
      const id = c.buffered('k', 4) ? 'jk' : 'jp', vx = p.vx, vz = p.vz;
      c.consume('p'); c.consume('k'); p.startMove(id); p.vx = vx; p.vz = vz; p.airUsed = true;
    } else if (p.state === 'attack' && p.move.kind === 'normal' && p.hasHit && p.mf >= p.move.startup + p.move.active && c.buffered('p', 8) && p.chain < CALLE.CHAIN.length - 1) {
      c.consume('p'); this.punch(p.chain + 1);
    }
  }
  punch(step) {
    const p = this.player;
    p.chain = Math.min(step, CALLE.CHAIN.length - 1);
    p.startMove(CALLE.CHAIN[p.chain]); p.special = false;
    if (p.chain === CALLE.CHAIN.length - 1) this.callout(p.move.name);
  }
  callout(name) { if (name) this.game.fx.word(this.player.x, groundY(this.player.z) - 150 * this.player.ls / 1.1, name, '#9bf0ff', 9); }
  startSuper() {
    const p = this.player;
    p.startMove('super'); p.special = false; p.invuln = 60;
    this.superFx = 70; this.superHits = 0; this.game.flashT = 10;
    Audio8.play('superStart'); this.callout(p.ch.moves.super.name); this.shake(6);
  }
  // Super: golpea a todos los enemigos en pantalla, 4 impactos y el último lanza
  updSuper() {
    const p = this.player;
    if (!(p.state === 'attack' && p.move && p.move.id === 'super')) return;
    if (p.mf < 10 || (p.mf - 10) % 9 || this.superHits >= 4) return;
    this.superHits++;
    const last = this.superHits === 4;
    const m = { dmg: 55, hitstun: 30, push: 1, knockdown: last, launch: last ? { vx: 4, vy: 8 } : null, kind: 'super', fx: p.ch.moves.super.fx };
    for (const e of this.foes) if (e.hurtbox() && e.x > this.camX - 20 && e.x < this.camX + W + 20) this.applyHit(p, e, m, { x: e.x, y: 70 * e.ls });
    Audio8.play('superHit'); this.shake(5);
  }

  // ── Oleadas, cámara y progreso ──
  updCamera() {
    const p = this.player, st = this.stage;
    const wave = st.waves[this.waveI];
    let target = p.x - 250;
    if (this.lockX !== null) target = this.lockX;
    else if (wave) target = Math.min(target, wave.at - W * 0.62);
    this.camX = Math.max(this.camX, Math.min(target, st.len - W));
    const lo = this.camX + 18, hi = (this.lockX !== null ? this.lockX : this.camX) + W - 18;
    if (p.x < lo) p.x = lo;
    if (p.x > Math.min(hi, st.len - 18)) p.x = Math.min(hi, st.len - 18);
  }
  updProgress() {
    if (this.phase !== 'play') return;
    const wave = this.stage.waves[this.waveI];
    if (!wave) return;
    if (this.lockX === null && this.player.x > wave.at - W * 0.62 + 300) {
      this.lockX = this.camX;
      wave.foes.forEach((id, i) => this.queue.push({ id, delay: 20 + i * 45 }));
      if (wave.boss) { Audio8.say('¡Cuidado!'); this.bossIntro = 120; }
    }
    if (this.lockX !== null && !this.queue.length && !this.foes.length) {
      this.lockX = null; this.waveI++;
      if (this.waveI >= this.stage.waves.length) { this.phase = 'clear'; this.pt = 0; Audio8.play('bell'); }
      else { this.goT = 180; Audio8.play('coin'); }
    }
  }
  spawnQueue() {
    for (const q of this.queue) q.delay--;
    while (this.queue.length && this.queue[0].delay <= 0) {
      const q = this.queue.shift(), def = THUGS[q.id];
      const ch = CHARS.find(c => c.id === def.base);
      const side = def.boss ? 1 : (this.nextId % 3 === 0 ? -1 : 1);
      const x = this.lockX + (side > 0 ? W + 50 : -50);
      const e = new Brawler(this, ch, { def, hp: def.hp, x, z: 12 + RNG() * (CALLE.ZMAX - 24), facing: -side, idx: this.nextId++ });
      e.cool = 40 + RNG() * 40; e.slot = side; e.wait = 0;
      this.foes.push(e);
    }
  }
  // Solo dos enemigos (más el jefe) atacan a la vez; el resto rodea y espera
  pickEngaged() {
    if (this.frame % 30 && this.engaged.length) { this.engaged = this.engaged.filter(e => this.foes.includes(e) && e.hp > 0); return; }
    const p = this.player;
    const live = this.foes.filter(e => e.hp > 0).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.z - p.z) * 2 - (Math.abs(b.x - p.x) + Math.abs(b.z - p.z) * 2));
    this.engaged = live.filter(e => e.def.boss).concat(live.filter(e => !e.def.boss).slice(0, 2));
  }
  updFoe(e) {
    const p = this.player, d = e.def;
    if (e.cool > 0) e.cool--;
    if (!e.free) return;
    const dx = p.x - e.x, dz = p.z - e.z;
    e.facing = dx >= 0 ? 1 : -1;
    const lm = e.moves[d.moves[0]].hb;
    const reach = (lm.x + lm.w * 0.4) * e.k;
    const playerOk = p.hp > 0 && !['knockdown', 'getup', 'dead'].includes(p.state) && p.invuln <= 0;
    const engaged = this.engaged.includes(e) && playerOk;
    if (e.wait > 0) { e.wait--; e.vx = e.vz = 0; e.state = 'idle'; return; }
    let tx, tz;
    if (engaged) { const side = e.x < p.x ? -1 : 1; tx = p.x + side * reach * 0.75; tz = p.z; }
    else { const side = e.x < p.x ? -1 : 1; tx = p.x + side * (150 + (e.idx % 3) * 35); tz = Math.max(4, Math.min(CALLE.ZMAX - 4, p.z + (e.idx % 2 ? -34 : 34))); }
    if (engaged && Math.abs(dx) < reach + 6 && Math.abs(dz) < 9 && e.cool <= 0) {
      e.startMove(pickR(d.moves)); e.cool = d.cool + RNG() * 30;
      return;
    }
    if (engaged && d.rusher && Math.abs(dz) < 8 && Math.abs(dx) > 120 && Math.abs(dx) < 230 && e.cool <= 0 && RNG() < 0.03) { e.startMove('rush'); e.cool = d.cool * 2; return; }
    if (!engaged && RNG() < 0.006) { e.wait = 20 + RNG() * 40; return; }
    const ddx = tx - e.x, ddz = tz - e.z, sp = d.speed;
    e.vx = Math.abs(ddx) > 4 ? Math.sign(ddx) * Math.min(Math.abs(ddx), sp) : 0;
    e.vz = Math.abs(ddz) > 2 ? Math.sign(ddz) * Math.min(Math.abs(ddz), sp * 0.7) : 0;
    e.state = e.vx || e.vz ? 'walk' : 'idle';
  }

  // ── Impactos ──
  zOk(a, d) { return Math.abs(a.z - d.z) <= CALLE.ZHIT * Math.max((a.def && a.def.scale) || 1, (d.def && d.def.scale) || 1); }
  resolveHits() {
    const p = this.player;
    const tryHit = (a, d) => {
      const hb = a.hitbox(); if (!hb || !this.zOk(a, d)) return;
      const hu = d.hurtbox(); if (!hu || !overlap(hb, hu)) return;
      const m = a.move, maxH = m.hits || 1;
      const log = d.hitLog || (d.hitLog = {});
      const key = a === p ? 'p' + a.serial : 'e' + a.idx + '-' + a.serial;
      const rec = log[key] || (log[key] = { n: 0, f: -99 });
      if (rec.n >= maxH || a.mf - rec.f < (m.hitEvery || 99)) return;
      rec.n++; rec.f = a.mf; a.hasHit = true;
      this.applyHit(a, d, m, { x: (Math.max(hb.l, hu.l) + Math.min(hb.r, hu.r)) / 2, y: (Math.max(hb.b, hu.b) + Math.min(hb.t, hu.t)) / 2, last: rec.n >= maxH });
    };
    if (p.move && p.move.id !== 'super') for (const e of this.foes) tryHit(p, e);
    for (const e of this.foes) tryHit(e, p);
  }
  applyHit(a, d, m, info) {
    const toPlayer = d === this.player;
    const sx = info.x, sy = groundY(d.z) - info.y;
    const pow = a.isPlayer ? a.ch.stats.power : a.def.dmg;
    const dmg = Math.max(1, Math.round(m.dmg * pow));
    d.hp -= dmg; d.flash = 5; d.move = null; d.t = 0;
    d.recent = this.frame - d.lastHurtF < 45 ? d.recent + 1 : 1; d.lastHurtF = this.frame;
    if (toPlayer) { this.meter = Math.min(200, this.meter + dmg * 0.04); a.lastConnect = this.frame; }
    else {
      this.score += dmg * 10; this.meter = Math.min(200, this.meter + dmg * 0.1 + (m.kind === 'super' ? 0 : 1));
      if (a === this.player) a.lastConnect = this.frame;
      this.foeHud = { f: d, t: 150 };
      // el especial cuesta un poco de vida solo si conecta (como en los clásicos)
      if (a === this.player && a.special && a.specialPaid !== a.serial) { a.specialPaid = a.serial; a.hp = Math.max(1, a.hp - 30); }
    }
    const dir = Math.sign(d.x - a.x) || a.facing;
    if (!m.cost && m.kind !== 'super') d.facing = -dir;
    const heavy = dmg >= 60 || m.kind === 'super';
    const knock = d.hp <= 0 || m.knockdown && info.last !== false || m.launch || d.airborne || d.recent >= (toPlayer ? 4 : 6);
    if (knock) {
      d.state = 'launched'; d.y = Math.max(d.y, 0.5);
      d.vy = (m.launch ? m.launch.vy : 5.5) * 0.85; d.vx = (m.launch ? m.launch.vx : 2.4) * dir * 1.15; d.vz = 0;
      d.thrown = a.isPlayer && Math.abs(d.vx) > 2.5; d.recent = 0;
      if (d.def && d.def.boss) { d.vy *= 0.75; d.vx *= 0.6; }
    } else { d.state = 'hitstun'; d.stun = m.hitstun || 18; d.pushV = (m.push || 3) * dir * 0.55; d.vx = d.vz = 0; }
    if (d.hp <= 0) { d.hp = 0; if (!toPlayer) { this.score += d.def.score; this.killed(d); } else { Audio8.play('ko'); this.shake(8); } }
    this.hitstop = m.kind === 'super' ? 3 : heavy ? 8 : 5;
    Audio8.play(heavy ? 'hitHeavy' : 'hitLight');
    const fx = this.game.fx;
    fx.spark(sx, sy, heavy ? '#ffe36e' : '#fff', heavy ? 12 : 7, heavy ? 1.2 : 0.8);
    if (heavy || d.recent % 3 === 0) fx.word(sx + (RNG() - 0.5) * 24, sy - 18, pickR(heavy ? HEAVY_WORDS : KO_WORDS), pickR(['#f4c20d', '#ff5b7a', '#5effa0', '#9bf0ff']), heavy ? 12 : 9);
    const iconFor = { euro: 'euro', chart: 'chart', notes: 'note', ai: 'digit', comic: 'star', clap: 'film', sub: 'bubble', wave: 'bubble', vhs: 'film', horns: 'bolt', board: 'star', metal: 'bolt' };
    if (m.fx && (m.kind === 'special' || m.kind === 'super')) fx.icons(sx, sy, iconFor[m.fx] || 'star', 4);
    if (heavy) this.shake(m.kind === 'super' ? 5 : 3);
  }
  killed(e) {
    if (e.def.boss) { this.game.flashT = 14; Audio8.play('ko'); Audio8.say('K. O.'); this.shake(10); for (const o of this.foes) if (o !== e && o.hp > 0) { o.hp = 0; o.state = 'launched'; o.vy = 6; o.y = 0.5; o.vx = 3 * Math.sign(o.x - e.x || 1); } }
    if (e.def.drop) this.items.push({ x: e.x, z: e.z, kind: e.def.drop, taken: false, drop: true });
  }
  // Un enemigo lanzado arrolla a los que pilla por el camino
  bowling() {
    for (const t of this.foes) {
      if (t.state !== 'launched' || !t.thrown) continue;
      for (const o of this.foes) {
        if (o === t || !o.hurtbox() || Math.abs(o.x - t.x) > 34 * t.ls || Math.abs(o.z - t.z) > 16) continue;
        o.thrown = false;
        this.applyHit(this.player, o, { dmg: 30, knockdown: true, launch: { vx: 2.5, vy: 6 } }, { x: o.x, y: 60 * o.ls });
      }
    }
  }
  pickItems() {
    const p = this.player;
    if (!p.free) return;
    for (const it of this.items) {
      if (it.taken || Math.abs(it.x - p.x) > 26 || Math.abs(it.z - p.z) > 14) continue;
      const def = ITEMS[it.kind];
      it.taken = true; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * def.hp); this.score += def.score;
      Audio8.play('coin'); this.game.fx.word(it.x, groundY(it.z) - 40, def.name, '#5effa0', 11);
    }
  }
  cleanup() {
    for (const e of this.foes) if (e.state === 'dead') e.deadT = (e.deadT || 0) + 1;
    this.foes = this.foes.filter(e => !(e.state === 'dead' && e.deadT > 40));
  }
  playerDown() {
    const p = this.player;
    if (this.lives <= 0) { if (this.phase !== 'over') { this.phase = 'over'; this.pt = 0; this.cont = 600; Audio8.say('Fin de la partida'); } return; }
    this.lives--;
    Object.assign(p, { hp: p.maxHp, state: 'idle', t: 0, invuln: 150, y: 0, vx: 0, vy: 0, move: null });
    this.game.flashT = 10; this.shake(6); Audio8.play('superStart');
    this.game.fx.word(p.x, groundY(p.z) - 120, '¡OTRA VIDA!', '#f4c20d', 12);
    for (const e of this.foes) if (e.hp > 0 && Math.abs(e.x - p.x) < 160) { e.state = 'launched'; e.y = 0.5; e.vy = 5; e.vx = 3.5 * (Math.sign(e.x - p.x) || 1); e.move = null; }
  }
  updOver() {
    const i = this.game.menuInput();
    if (this.cont > 0) this.cont--;
    if (i.ok && this.pt > 40 && this.cont > 0) {
      const p = this.player;
      this.lives = 2; this.score = 0; this.phase = 'play'; this.pt = 0;
      Object.assign(p, { hp: p.maxHp, state: 'idle', t: 0, invuln: 150, move: null });
      Audio8.play('coin'); return;
    }
    if ((i.ok && this.cont <= 0) || i.back || this.cont <= 0 && this.pt > 900) { Audio8.music('menu'); this.game.go('menu'); }
  }

  // ── Dibujo ──
  draw(ctx) {
    ctx.save();
    if (this.shakeT > 0) ctx.translate((RNG() - 0.5) * this.shakeA, (RNG() - 0.5) * this.shakeA);
    const cx = this.camX;
    drawStreet(ctx, cx, this.frame, this.stage);
    ctx.save(); ctx.translate(-cx, 0);
    for (const it of this.items) if (!it.taken) drawItem(ctx, it, this.frame);
    const all = [this.player, ...this.foes].sort((a, b) => a.z - b.z);
    for (const b of all) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, groundY(b.z) + 1, 24 * b.ls * Math.max(0.5, 1 - b.y / 200), 5, 0, 0, 7); ctx.fill(); }
    if (this.superFx > 0) this.drawSuperFx(ctx);
    for (const b of all) this.drawBrawler(ctx, b);
    this.game.fx.draw(ctx);
    ctx.restore();
    drawStreetFront(ctx, cx, this.frame);
    ctx.restore();
    this.drawHUD(ctx);
  }
  drawBrawler(ctx, b) {
    if (b.state === 'dead' && Math.floor(b.deadT / 3) % 2) return;
    if (b.isPlayer && b.invuln > 0 && b.state !== 'attack' && Math.floor(this.frame / 3) % 2) ctx.globalAlpha = 0.45;
    drawFighterAt(ctx, b.look, b.x, groundY(b.z) - b.y, b.pose, b.facing, this.frame, { fighter: b, scale: b.k, flash: b.flash > 0, state: b.state, tint: b.def && b.def.tint });
    ctx.globalAlpha = 1;
  }
  drawSuperFx(ctx) {
    const p = this.player, k = this.superFx / 70;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2) * 0.55;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.ch.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(this.camX, 0, W, H);
    ctx.globalAlpha = Math.min(1, k * 2);
    const y = groundY(p.z) - 80 * p.ls;
    ctx.fillStyle = '#fff'; ctx.fillRect(this.camX, y - 6 * k, W, 12 * k);
    ctx.restore();
    if (this.frame % 3 === 0) this.game.fx.icons(this.camX + RNG() * W, groundY(RNG() * CALLE.ZMAX) - 60, { euro: 'euro', ai: 'digit', wave: 'bubble', metal: 'bolt' }[p.ch.moves.super.fx] || 'star', 1);
  }
  drawHUD(ctx) {
    const p = this.player;
    ctx.fillStyle = 'rgba(12,7,24,0.78)'; ctx.fillRect(6, 6, 250, 46);
    drawPortrait(ctx, p.look, 26, 29, 38, 1, this.frame, p.hp <= 0 ? 'ko' : p.state === 'hitstun' ? 'hurt' : 'normal');
    txt(ctx, p.ch.name, 50, 14, 7, p.ch.color, 'left');
    txt(ctx, 'x' + this.lives, 250, 14, 7, '#fff', 'right');
    hpBar(ctx, 50, 21, 196, 9, p.hp / p.maxHp, '#f4c20d');
    // barra de super: se llena golpeando; SP con barra llena = super
    ctx.fillStyle = '#1b1233'; ctx.fillRect(50, 34, 196, 5);
    ctx.fillStyle = this.meter >= 100 && Math.floor(this.frame / 8) % 2 ? '#ffffff' : '#5effa0'; ctx.fillRect(50, 34, 196 * Math.min(1, this.meter / 100), 5);
    if (this.meter > 100) { ctx.fillStyle = '#ff5b7a'; ctx.fillRect(50, 34, 196 * (this.meter - 100) / 100, 5); }
    txt(ctx, 'SUPER', 50, 45, 5, this.meter >= 100 ? '#5effa0' : '#8a80b0', 'left', false);
    txt(ctx, String(this.score).padStart(7, '0'), 246, 45, 6, '#fff', 'right', false);
    const fh = this.foeHud || (this.lockX !== null && this.foes.find(e => e.def.boss && e.hp > 0) ? { f: this.foes.find(e => e.def.boss && e.hp > 0) } : null);
    if (fh) {
      const e = fh.f;
      ctx.fillStyle = 'rgba(12,7,24,0.78)'; ctx.fillRect(W - 236, 6, 230, 30);
      txt(ctx, e.def.name, W - 12, 14, 6, e.def.boss ? '#ff5b7a' : '#fff', 'right');
      hpBar(ctx, W - 228, 21, 214, 8, e.hp / e.maxHp, e.def.boss ? '#ff5b7a' : '#e8423a');
    }
    if (this.phase === 'intro') {
      comicText(ctx, 'FASE 1', W / 2, 110, 22, '#f4c20d');
      txt(ctx, this.stage.name, W / 2, 140, 12, '#fff');
      txt(ctx, 'P GOLPE · K SALTO · SP ESPECIAL (CON BARRA: SUPER)', W / 2, 170, 6, '#9bf0ff');
    }
    if (this.goT > 0 && this.lockX === null && this.phase === 'play') {
      this.goT--;
      if (Math.floor(this.frame / 12) % 2) { comicText(ctx, '¡ADELANTE!', W - 110, 120, 14, '#f4c20d'); txt(ctx, '>>>', W - 110, 142, 12, '#f4c20d'); }
    }
    if (this.bossIntro > 0) { this.bossIntro--; comicText(ctx, '¡JEFE!', W / 2, 110, 26, '#ff5b7a'); txt(ctx, THUGS.jefe.name, W / 2, 140, 10, '#fff'); }
    if (this.phase === 'clear' && this.pt > 60) {
      comicText(ctx, '¡FASE SUPERADA!', W / 2, 100, 22, '#5effa0');
      txt(ctx, 'PUNTOS ' + this.score, W / 2, 132, 10, '#fff');
      if (this.pt > 200) txt(ctx, 'PULSA ENTER', W / 2, 160, 8, '#bbb');
    }
    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(5,0,20,0.6)'; ctx.fillRect(0, 0, W, H);
      comicText(ctx, 'FIN DE LA PARTIDA', W / 2, 120, 20, '#e8423a');
      if (this.cont > 0) txt(ctx, `¿CONTINUAR? ${Math.ceil(this.cont / 60)}  · ENTER`, W / 2, 160, 9, '#fff');
      else txt(ctx, 'PULSA ENTER', W / 2, 160, 9, '#bbb');
    }
  }
}

function hpBar(ctx, x, y, w, h, k, col) {
  ctx.fillStyle = '#3a0d16'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, k), h);
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}

// ── Escenario provisional: paseo marítimo al atardecer (todo dibujado por código) ──
function drawStreet(ctx, cx, t, stage) {
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
  const hx = stage.waves[stage.waves.length - 1].at + 120 - cx;
  if (hx > -260 && hx < W + 60) {
    ctx.fillStyle = '#6b3b22'; ctx.fillRect(hx, 170, 200, 66);
    ctx.fillStyle = '#e8c070'; for (let i = 0; i < 10; i++) ctx.fillRect(hx - 10 + i * 22, 160, 20, 14);
    ctx.fillStyle = '#1a0d22'; ctx.fillRect(hx + 30, 196, 140, 26);
    comicText(ctx, 'CHIRINGUITO', hx + 100, 186, 9, Math.floor(t / 15) % 4 ? '#ff5bd0' : '#ffd0f4');
  }
}
function drawStreetFront(ctx, cx, t) {
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
  } else { // campero
    ctx.fillStyle = '#e8b964'; ctx.beginPath(); ctx.ellipse(x, y - 4, 14, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5fb04a'; ctx.fillRect(x - 12, y - 4, 24, 2);
    ctx.fillStyle = '#d7a050'; ctx.beginPath(); ctx.ellipse(x, y - 6, 13, 4, 0, Math.PI, 0); ctx.fill();
  }
}

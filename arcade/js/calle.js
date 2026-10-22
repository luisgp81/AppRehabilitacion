'use strict';
// Modo Calle: beat 'em up de desplazamiento lateral al estilo de los 90 con los luchadores del juego.
// El mundo tiene profundidad (z). Plantilla de enemigos y fases en calle-roster.js; fondos en calle-stage.js.
const CALLE = {
  FLOOR: 250, ZMAX: 96, SC: 0.7, ZHIT: 13, GRAV: 0.6,
  CHAIN: ['lp', 'lp', 'sk', 'remate'], // combo de puño: jab, jab, patada, remate que lanza
};
const groundY = z => CALLE.FLOOR + z;
const PXM = 109 * CALLE.SC; // píxeles de pantalla por metro de estatura (mismo criterio que los protagonistas)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// golpes del jugador que atraviesan la guardia de los que se cubren
const GUARD_BREAK = ['remate', 'super', 'super2', 'dp', 'rush', 'jp', 'jk'];

// ── Jugador (y base de los enemigos): estados, físicas y golpes ──
class Brawler {
  constructor(world, ch, o) {
    this.w = world; this.ch = ch; this.def = o.def || null; this.isPlayer = !!o.player;
    this.look = ch.look; this.moves = buildMoves(ch);
    this.k = CALLE.SC;
    this.maxHp = this.hp = o.hp;
    Object.assign(this, { x: o.x, z: o.z, y: 0, vx: 0, vz: 0, vy: 0, pushV: 0, facing: o.facing || 1 });
    Object.assign(this, { state: 'idle', t: 0, move: null, mf: 0, stun: 0, invuln: 0, flash: 0, landT: 0, cool: 30, serial: 0 });
    this.ctrl = o.ctrl || { held: {} }; this.idx = o.idx || 0; this.guarding = false; this.pose = null; this.walkX = 0;
    this.recent = 0; this.lastHurtF = -99; this.chain = 0; this.lastConnect = -99;
  }
  get crouching() { return false; }
  get airborne() { return this.y > 0 || this.vy > 0; }
  get free() { return this.state === 'idle' || this.state === 'walk'; }
  get ls() { return this.look.scale * this.k; }
  get hpx() { return 112 * this.ls; } // estatura en pantalla
  isActive() { const m = this.move; return this.state === 'attack' && m && this.mf >= m.startup && this.mf < m.startup + m.active; }
  hurtbox() {
    if (['knockdown', 'getup', 'dead'].includes(this.state) || this.invuln > 0 || this.hp <= 0) return null;
    const s = this.ls, w = 44 * s;
    return { l: this.x - w / 2, r: this.x + w / 2, b: this.y, t: this.y + (this.state === 'launched' ? 70 : 112) * s };
  }
  hitbox() {
    const m = this.move;
    if (!m || !m.hb || !this.isActive()) return null;
    const k = this.k;
    // el antiaéreo especial golpea a los dos lados, como el especial "de emergencia" de los beat 'em up
    if (m.id === 'dp') { const w = (m.hb.x + m.hb.w) * k * 1.6; return { l: this.x - w, r: this.x + w, b: this.y, t: this.y + m.hb.y * k + m.hb.h * k / 2 }; }
    const cx = this.x + this.facing * m.hb.x * k;
    return { l: cx - m.hb.w * k / 2, r: cx + m.hb.w * k / 2, b: this.y + (m.hb.y - m.hb.h / 2) * k, t: this.y + (m.hb.y + m.hb.h / 2) * k };
  }
  startMove(id) {
    const m = this.moves[id];
    if (!m) return false;
    if (m.kind !== 'air') { this.vx = 0; this.vz = 0; }
    this.state = 'attack'; this.move = m; this.mf = 0; this.t = 0; this.serial++;
    this.hasHit = false;
    if (m.invuln) this.invuln = m.invuln[1];
    Audio8.play(m.kind === 'special' || m.kind === 'super' || m.name ? 'special' : 'whoosh');
    return true;
  }
  update() {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    switch (this.state) {
      case 'attack': this.stepMove(); break;
      case 'hitstun': this.stun--; if (this.stun <= 0) { this.state = 'idle'; this.t = 0; } break;
      case 'land': this.vx = this.vz = 0; if (this.t >= this.landT) { this.state = 'idle'; this.t = 0; this.threw = false; } break;
      case 'knockdown':
        if (this.t >= (this.isPlayer ? 40 : 46)) { this.state = this.hp <= 0 ? 'dead' : 'getup'; this.t = 0; }
        break;
      case 'getup': if (this.t >= 18) { this.state = 'idle'; this.t = 0; this.invuln = this.isPlayer ? 50 : 8; } break;
      case 'dizzy': this.vx = this.vz = 0; if (--this.dizzyT <= 0) { this.state = 'idle'; this.t = 0; } break;
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
    if (['hitstun', 'knockdown', 'getup', 'dead', 'guard'].includes(this.state) && !this.airborne) { this.vx = this.pushV; this.pushV *= 0.82; }
    if (this.state === 'grabbed' || this.state === 'hold') { this.vx = this.vz = 0; }
    this.x += this.vx; this.z += this.vz;
    if (this.vx || this.vz) this.walkX += Math.hypot(this.vx, this.vz) * this.facing;
    this.z = clamp(this.z, 0, CALLE.ZMAX);
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

// ── Enemigos: cada uno con sus golpes y su forma de pelear (ROSTER) ──
class Thug extends Brawler {
  constructor(world, id, o) {
    const def = ROSTER[id];
    super(world, CHARS.find(c => c.id === def.base), Object.assign({ def, hp: def.hp }, o));
    this.kind = id; this.moves = def.moves;
    this.size = PXM * def.height * (def.scale || 1);
    this.armorN = 0; this.armorF = -99; this.guardHits = 0;
  }
  get hpx() { return this.size * 0.9; }
  get ls() { return this.size / 136; } // para sombras y efectos
  hurtbox() {
    if (['knockdown', 'getup', 'dead'].includes(this.state) || this.invuln > 0 || this.hp <= 0 || !this.entered || this.fade > 0) return null;
    const h = this.size, w = 0.3 * h;
    return { l: this.x - w / 2, r: this.x + w / 2, b: this.y, t: this.y + (this.state === 'launched' ? 0.5 : 0.85) * h };
  }
  hitbox() {
    const m = this.move;
    if (!m || !m.hb || m.leap || !this.isActive()) return null;
    const h = this.size, [hx, hy, hw, hh] = m.hb;
    const cx = m.around ? this.x : this.x + this.facing * hx * h;
    return { l: cx - hw * h / 2, r: cx + hw * h / 2, b: this.y + (hy - hh / 2) * h, t: this.y + (hy + hh / 2) * h };
  }
  startMove(id) {
    const m = this.moves[id];
    if (!m) return false;
    this.vx = this.vz = 0;
    this.state = 'attack'; this.move = m; this.mf = 0; this.t = 0; this.serial++; this.hasHit = false;
    if (m.name) this.w.callout(m.name, this);
    Audio8.play(m.name ? 'special' : 'whoosh');
    return true;
  }
  update() {
    super.update();
    if (this.state === 'guard' && --this.guardT <= 0) { this.state = 'idle'; this.t = 0; this.guardHits = 0; }
    if (this.fade > 0) this.fade--;
  }
  stepMove() {
    const m = this.move, f = this.facing, p = this.w.player;
    this.mf++;
    if (m.dash) {
      if (this.mf >= m.startup && this.mf < m.startup + m.active) this.vx = m.dash * f;
      else this.vx *= 0.75;
    }
    if (m.leap && this.mf === m.startup) { // salta hacia donde está el jugador
      const T = 2 * 8 / CALLE.GRAV;
      Object.assign(this, { vy: 8, y: 0.1, vx: clamp((p.x - this.x) / T, -6, 6), vz: clamp((p.z - this.z) / T, -3, 3) });
      Audio8.play('jump');
    }
    if (m.tele && this.mf === 1) { this.fade = m.startup; Audio8.play('superStart'); }
    if (m.tele && this.mf === Math.floor(m.startup / 2)) { // reaparece a la espalda del jugador
      this.x = clamp(p.x - p.facing * 0.35 * this.size, this.w.camX + 20, this.w.camX + W - 20); this.z = p.z;
      this.facing = p.x >= this.x ? 1 : -1;
    }
    if (m.proj && this.mf === m.startup) this.w.throwProj(this, m);
    if (m.beam && this.mf === 1) this.w.beam = { e: this, z: this.z, t: 0, warn: m.startup, m };
    const total = m.startup + m.active + m.recovery;
    if (m.leap) { if (this.mf > total + 90) { this.state = 'idle'; this.move = null; } return; }
    if (this.mf >= total) { this.state = 'idle'; this.move = null; this.t = 0; this.vx = 0; }
  }
  landed() {
    if (this.state === 'attack' && this.move && this.move.leap) {
      this.w.leapLand(this); this.state = 'land'; this.landT = 18; this.t = 0; this.vx = this.vz = 0; this.move = null;
      return;
    }
    super.landed();
  }
}

class Calle {
  constructor(game, idx) {
    this.game = game; this.frame = 0;
    const ch = CHARS[idx];
    this.player = new Brawler(this, ch, { player: true, hp: ch.stats.hp, x: 120, z: 56, ctrl: game.ctrls[0] });
    this.lives = 2; this.score = 0; this.meter = 0;
    game.f1 = this.player; game.f2 = null;
    for (const st of CALLE_STAGES) StageArt.load(st.id);
    this.startStage(+(PARAMS.get('fase') || 1) - 1);
  }
  startStage(i) {
    const st = this.stage = Object.assign({}, CALLE_STAGES[i]);
    this.stageI = i;
    if (StageArt.ok(st.id)) st.len = StageArt.len(st.id);
    st.bossX = st.waves[st.waves.length - 1].at * st.len;
    this.camX = 0; this.lockX = null; this.waveI = 0; this.queue = []; this.foes = []; this.engaged = []; this.shots = [];
    this.items = st.items.map(it => ({ x: it.at * st.len, z: it.z, kind: it.kind, taken: false }));
    this.phase = 'intro'; this.pt = 0; this.hitstop = 0; this.shakeT = 0; this.shakeA = 0;
    this.foeHud = null; this.superFx = 0; this.nextId = 1; this.beam = null; this.goT = 0; this.bossIntro = 0;
    const p = this.player;
    Object.assign(p, { x: 120, z: 56, y: 0, vx: 0, vz: 0, vy: 0, hp: p.maxHp, state: 'idle', move: null, t: 0, invuln: 0 });
    Audio8.music('fight');
  }
  shake(a) { this.shakeT = 10; this.shakeA = a; }
  callout(name, who) { if (name) this.game.fx.word(who.x, groundY(who.z) - who.hpx - 14, name, who.isPlayer ? '#9bf0ff' : '#ff9b6b', 8); }

  // ── Bucle ──
  update() {
    this.frame++; this.pt++;
    if (this.shakeT > 0) this.shakeT--;
    if (this.superFx > 0) this.superFx--;
    if (this.foeHud && --this.foeHud.t <= 0) this.foeHud = null;
    if (this.phase === 'over') return this.updOver();
    if (this.phase === 'ending') { if (this.pt > 120 && this.game.menuInput().ok) { Audio8.music('menu'); this.game.go('menu'); } return; }
    if (this.hitstop > 0) { this.hitstop--; return; }
    const p = this.player;
    if (this.phase === 'intro' && this.pt >= 90) { this.phase = 'play'; this.pt = 0; }
    if (this.phase !== 'clear' && this.pt > (this.phase === 'intro' ? 40 : 0)) this.updPlayer();
    this.spawnQueue();
    this.pickEngaged();
    for (const e of this.foes) this.updFoe(e);
    for (const b of [p, ...this.foes]) { b.update(); b.physics(); if (b === p) updatePose(b); }
    this.keepOnScreen();
    this.updHolds();
    this.updSuper();
    this.updBeam();
    this.resolveHits();
    this.updShots();
    this.bowling();
    this.pickItems();
    this.cleanup();
    this.updCamera();
    this.updProgress();
    if (p.state === 'dead') this.playerDown();
    if (this.phase === 'clear') this.updClear();
  }
  updClear() {
    const p = this.player;
    if (this.pt === 60) { p.state = 'win'; p.t = 0; p.move = null; Audio8.music('win'); Audio8.say('Fase superada'); }
    if (this.pt > 200 && this.game.menuInput().ok) {
      if (this.stageI + 1 < CALLE_STAGES.length) this.startStage(this.stageI + 1);
      else { this.phase = 'ending'; this.pt = 0; Audio8.say('¡Málaga está a salvo!'); }
    }
  }

  // ── Jugador ──
  updPlayer() {
    const p = this.player, c = p.ctrl, h = c.held;
    if (p.state === 'win') return;
    if (p.state === 'grabbed' || p.state === 'dizzy') { // machacar botones para soltarse antes
      if (['p', 'k', 's', 'left', 'right', 'up', 'down'].some(b => c.pressed[b])) { p.mash = (p.mash || 0) + 1; if (p.state === 'dizzy') p.dizzyT -= 4; }
      return;
    }
    if (p.state === 'grab') return this.updGrab();
    if (p.free) {
      if (c.buffered('s', 4)) {
        c.consume('s');
        if (this.meter >= 100) { this.meter -= 100; this.startSuper(); return; }
        p.startMove(c.fwd(p.facing) ? 'rush' : 'dp'); p.special = true;
        this.callout(p.move.name, p);
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
      // agarre automático al chocar de frente con un enemigo, como en los clásicos
      if (dx) { const f = this.grabTarget(); if (f) this.startGrab(f); }
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
    if (p.chain === CALLE.CHAIN.length - 1) this.callout(p.move.name, p);
  }
  grabTarget() {
    const p = this.player;
    return this.foes.find(f => f.hp > 0 && f.entered && !f.def.boss && (f.def.armor || 0) < 2 && (f.free || f.state === 'hitstun')
      && Math.abs(f.z - p.z) < 8 && Math.sign(f.x - p.x) === p.facing && Math.abs(f.x - p.x) < 0.16 * f.size + 16);
  }
  startGrab(f) {
    const p = this.player;
    Object.assign(p, { state: 'grab', grabT: 0, held: f, knees: 0, kneeT: 0, vx: 0, vz: 0 });
    Object.assign(f, { state: 'grabbed', move: null, vx: 0, vz: 0 });
    Audio8.play('block');
  }
  // Agarre: P = rodillazo (al tercero, lanzamiento); atrás + P = lanzar por encima; K = soltar
  updGrab() {
    const p = this.player, c = p.ctrl, f = p.held;
    p.grabT++;
    if (p.kneeT > 0) p.kneeT--;
    const release = () => { p.state = 'idle'; p.held = null; p.t = 0; if (f.state === 'grabbed') { f.state = 'hitstun'; f.stun = 12; f.pushV = p.facing * 2; } };
    if (f.hp <= 0 || f.state !== 'grabbed') { p.state = 'idle'; p.held = null; return; }
    f.x = p.x + p.facing * (0.16 * f.size + 12); f.z = p.z; f.facing = -p.facing;
    if (c.buffered('p', 4) && p.kneeT === 0) {
      c.consume('p');
      const back = c.back(p.facing);
      if (back || p.knees >= 2) {
        const dir = back ? -p.facing : p.facing;
        if (back) { p.facing = -p.facing; f.x = p.x - dir * 10; }
        p.state = 'land'; p.landT = 18; p.held = null; p.t = 0; p.threw = true;
        this.applyHit(p, f, { dmg: 45, knockdown: true, launch: { vx: 5, vy: 6.5 }, kind: 'normal' }, { x: f.x, y: 0.5 * f.size, dir });
        this.callout(back ? '¡AL SUELO!' : '¡FUERA!', p);
        return;
      }
      p.knees++; p.kneeT = 14;
      this.applyHit(p, f, { dmg: 24, hitstun: 30, push: 0, kind: 'normal', grabHit: true }, { x: f.x, y: 0.45 * f.size });
      if (f.hp > 0) f.state = 'grabbed';
      return;
    }
    if (c.buffered('k', 4)) { c.consume('k'); release(); return; }
    if (p.grabT > 110) release();
  }
  startSuper() {
    const p = this.player;
    p.startMove('super'); p.special = false; p.invuln = 60;
    this.superFx = 70; this.superHits = 0; this.game.flashT = 10;
    Audio8.play('superStart'); this.callout(p.ch.moves.super.name, p); this.shake(6);
  }
  // Super: golpea a todos los enemigos en pantalla, 4 impactos y el último lanza
  updSuper() {
    const p = this.player;
    if (!(p.state === 'attack' && p.move && p.move.id === 'super')) return;
    if (p.mf < 10 || (p.mf - 10) % 9 || this.superHits >= 4) return;
    this.superHits++;
    const last = this.superHits === 4;
    const m = { dmg: 55, hitstun: 30, push: 1, knockdown: last, launch: last ? { vx: 4, vy: 8 } : null, kind: 'super', fx: p.ch.moves.super.fx };
    for (const e of this.foes) if (e.hurtbox() && e.x > this.camX - 20 && e.x < this.camX + W + 20) this.applyHit(p, e, m, { x: e.x, y: 0.5 * e.size });
    for (const s of this.shots) s.life = 0;
    Audio8.play('superHit'); this.shake(5);
  }

  // ── Habilidades de los enemigos ──
  throwProj(e, m) {
    const pr = m.proj;
    for (let i = 0; i < pr.n; i++) {
      const dz = pr.n > 1 ? (i - (pr.n - 1) / 2) * 20 : 0;
      this.shots.push({ x: e.x + e.facing * 0.3 * e.size, z: clamp(e.z + dz, 0, CALLE.ZMAX), y: 0.6 * e.size, vx: pr.vx * e.facing, vy: pr.vy || 0, arc: !!pr.vy, kind: pr.kind, dmg: pr.dmg, owner: e, life: 220, rot: 0 });
    }
    Audio8.play('whoosh');
  }
  updShots() {
    const p = this.player, phb = p.hitbox();
    for (const s of this.shots) {
      s.life--; s.x += s.vx; s.rot += 0.3;
      if (s.arc) { s.vy -= 0.16; s.y += s.vy; if (s.y <= 0) { s.life = 0; this.game.fx.spark(s.x, groundY(s.z), '#ccc', 5, 0.6); } }
      if (s.x < this.camX - 60 || s.x > this.camX + W + 60) s.life = 0;
      if (s.life <= 0) continue;
      // el jugador puede romper los objetos de un golpe
      if (phb && Math.abs(s.z - p.z) < 14 && s.x > phb.l && s.x < phb.r && s.y > phb.b - 10 && s.y < phb.t + 10) {
        s.life = 0; this.score += 50; this.game.fx.spark(s.x, groundY(s.z) - s.y, '#fff', 8); Audio8.play('block'); continue;
      }
      const hu = p.hurtbox();
      if (hu && Math.abs(s.z - p.z) < 12 && s.x > hu.l - 6 && s.x < hu.r + 6 && s.y > hu.b && s.y < hu.t) {
        s.life = 0;
        this.applyHit(s.owner, p, { dmg: s.dmg, hitstun: 20, push: 3, knockdown: s.kind === 'espeto' }, { x: s.x, y: s.y, dir: Math.sign(s.vx) });
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
  }
  leapLand(e) {
    const p = this.player, hu = p.hurtbox();
    this.shake(6); this.game.fx.dust(e.x, groundY(e.z)); Audio8.play('hitHeavy');
    if (hu && p.y < 30 && Math.abs(p.x - e.x) < 0.5 * e.size && Math.abs(p.z - e.z) < 18) this.applyHit(e, p, e.def.moves.skill, { x: p.x, y: 30 });
  }
  // Rayo a lo ancho de la pantalla: avisa con una franja roja en su carril; se esquiva cambiando de carril o saltando
  updBeam() {
    const b = this.beam;
    if (!b) return;
    b.t++;
    if (b.e.hp <= 0 || b.e.state !== 'attack') { this.beam = null; return; }
    if (b.t === b.warn) {
      const p = this.player, hu = p.hurtbox();
      this.game.flashT = 8; this.shake(8); Audio8.play('superHit');
      if (hu && Math.abs(p.z - b.z) < 16 && p.y < 40) this.applyHit(b.e, p, b.m, { x: p.x, y: 50, dir: Math.sign(p.x - b.e.x) || 1 });
    }
    if (b.t > b.warn + 24) this.beam = null;
  }
  // Agarres de enemigos: si el jugador machaca botones se suelta; si no, lo lanzan
  updHolds() {
    const p = this.player;
    if (p.state === 'grabbed' && (!p.by || p.by.state !== 'hold' || p.by.hp <= 0)) { p.state = 'idle'; p.by = null; p.t = 0; }
    for (const e of this.foes) {
      if (e.state !== 'hold') continue;
      if (p.state !== 'grabbed' || p.by !== e || e.hp <= 0) { e.state = 'idle'; continue; }
      e.holdT--;
      p.x = e.x + e.facing * (0.2 * e.size); p.z = e.z; p.facing = -e.facing;
      if (p.mash >= 10) {
        p.state = 'idle'; p.invuln = 30; p.t = 0; p.by = null;
        e.state = 'hitstun'; e.stun = 24; e.pushV = -e.facing * 3; e.cool = 80;
        this.game.fx.word(p.x, groundY(p.z) - p.hpx, '¡ZAFADO!', '#5effa0', 10); Audio8.play('block');
      } else if (e.holdT <= 0) {
        const g = e.def.moves.skill.grab, dir = -e.facing;
        p.by = null; e.state = 'land'; e.landT = 22; e.t = 0;
        p.x = e.x - e.facing * 12;
        this.applyHit(e, p, { dmg: g.dmg, knockdown: true, launch: { vx: 4.5, vy: 7.5 } }, { x: p.x, y: 60, dir });
      }
    }
  }

  // ── Oleadas, cámara y progreso ──
  updCamera() {
    const p = this.player, st = this.stage;
    const wave = st.waves[this.waveI];
    let target = p.x - 250;
    if (this.lockX !== null) target = this.lockX;
    else if (wave) target = Math.min(target, wave.at * st.len - W * 0.62);
    this.camX = Math.max(this.camX, Math.min(target, st.len - W));
    const lo = this.camX + 18, hi = (this.lockX !== null ? this.lockX : this.camX) + W - 18;
    p.x = clamp(p.x, lo, Math.min(hi, st.len - 18));
  }
  keepOnScreen() {
    for (const e of this.foes) {
      const lo = this.camX + 14, hi = this.camX + W - 14;
      if (e.x > lo && e.x < hi) e.entered = true;
      if (e.entered) e.x = clamp(e.x, lo, hi);
    }
    // los enemigos no se amontonan en el mismo sitio
    for (const a of this.foes) for (const b of this.foes) {
      if (a === b || a.hp <= 0 || b.hp <= 0 || Math.abs(a.z - b.z) > 12 || a.state === 'grabbed' || b.state === 'grabbed') continue;
      const d = b.x - a.x, min = 0.2 * Math.max(a.size, b.size);
      if (Math.abs(d) < min) { const push = (min - Math.abs(d)) * 0.25 * (Math.sign(d) || 1); a.x -= push; b.x += push; }
    }
  }
  updProgress() {
    if (this.phase !== 'play') return;
    const wave = this.stage.waves[this.waveI];
    if (!wave) return;
    if (this.lockX === null && this.player.x > wave.at * this.stage.len - W * 0.62 + 300) {
      this.lockX = this.camX;
      wave.foes.forEach((id, i) => this.queue.push({ id, delay: 20 + i * 45 }));
      if (wave.boss) { Audio8.say('¡Cuidado!'); this.bossIntro = 140; this.bossName = ROSTER[wave.foes[0]].name; }
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
      const q = this.queue.shift(), def = ROSTER[q.id];
      const side = def.boss ? 1 : (this.nextId % 3 === 0 ? -1 : 1);
      const x = this.lockX + (side > 0 ? W + 50 : -50);
      const e = new Thug(this, q.id, { x, z: 12 + RNG() * (CALLE.ZMAX - 24), facing: -side, idx: this.nextId++ });
      e.cool = 40 + RNG() * 40; e.wait = 0;
      this.foes.push(e);
    }
  }
  // Solo dos enemigos cuerpo a cuerpo (más el jefe) atacan a la vez; los de distancia disparan cuando pueden
  pickEngaged() {
    if (this.frame % 30 && this.engaged.length) { this.engaged = this.engaged.filter(e => this.foes.includes(e) && e.hp > 0); return; }
    const p = this.player;
    const live = this.foes.filter(e => e.hp > 0).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.z - p.z) * 2 - (Math.abs(b.x - p.x) + Math.abs(b.z - p.z) * 2));
    const melee = live.filter(e => !e.def.boss && e.def.ai !== 'ranged');
    this.engaged = live.filter(e => e.def.boss || e.def.ai === 'ranged').concat(melee.slice(0, 2));
  }
  updFoe(e) {
    const p = this.player, d = e.def;
    if (e.cool > 0) e.cool--;
    if (d.boss && d.summon && !e.summoned && e.hp < e.maxHp * 0.5) { // refuerzos a mitad de vida
      e.summoned = true; d.summon.forEach((id, i) => this.queue.push({ id, delay: 30 + i * 40 }));
      this.callout('¡REFUERZOS!', e);
    }
    if (!e.free) return;
    if (!e.entered) { // primero entra en pantalla, luego ya pelea
      const tx = e.x < this.camX + W / 2 ? this.camX + 60 : this.camX + W - 60;
      e.vx = Math.sign(tx - e.x) * Math.max(1.4, d.speed); e.vz = 0; e.state = 'walk'; e.facing = Math.sign(e.vx) || 1;
      return;
    }
    const dx = p.x - e.x, dz = p.z - e.z, adx = Math.abs(dx), adz = Math.abs(dz);
    e.facing = dx >= 0 ? 1 : -1;
    const atk = e.moves.atk, reach = (atk.hb[0] + atk.hb[2] / 2) * e.size - 4;
    const playerOk = p.hp > 0 && !['knockdown', 'getup', 'dead', 'grabbed'].includes(p.state) && p.invuln <= 0;
    const engaged = this.engaged.includes(e) && playerOk;
    if (e.wait > 0) { e.wait--; e.vx = e.vz = 0; e.state = 'idle'; return; }
    const pAttacking = p.state === 'attack' && p.move && p.move.kind !== 'super';
    const sk = e.moves.skill, sk2 = e.moves.skill2;
    const ready = e.cool <= 0;
    let tx, tz, act = null;
    switch (d.ai) {
      case 'blocker': // se cubre con el maletín cuando le atacan de frente
        if (pAttacking && adx < reach + 30 && adz < 14 && RNG() < 0.25) { e.state = 'guard'; e.guardT = 45; e.vx = e.vz = 0; return; }
        break;
      case 'charger': // se aleja, se alinea y cruza la pantalla patinando
        if (engaged && ready && adz < 10 && adx > 130 && adx < 320) act = 'skill';
        else if (engaged && adx < 150 && !(ready && adx < reach + 6 && adz < 9)) { tx = p.x - e.facing * 200; tz = p.z; }
        break;
      case 'ranged': { // mantiene la distancia y dispara cuando está en el carril del jugador
        const [k0, k1] = d.keep;
        if (d.dodge && pAttacking && adx < 90 && RNG() < 0.2) { Object.assign(e, { state: 'jump', vy: 6.5, y: 0.1, vx: -e.facing * 3.4, vz: 0 }); Audio8.play('jump'); return; }
        if (ready && adz < 9 && adx > k0 - 40 && adx < k1 + 60) act = 'skill';
        else if (ready && adx < reach + 6 && adz < 9) act = 'atk';
        else { tx = p.x - e.facing * (k0 + k1) / 2; tz = p.z; }
        break;
      }
      case 'grabber':
        if (engaged && ready && adx < 0.3 * e.size + 22 && adz < 8 && p.y <= 0 && RNG() < d.skillP) act = 'skill';
        else if (engaged) { tx = p.x + (e.x < p.x ? -1 : 1) * 0.28 * e.size; tz = p.z; }
        break;
      case 'spinner':
        if (engaged && ready && adx < 0.5 * e.size && adz < 14 && RNG() < 0.5) act = 'skill';
        break;
      case 'leaper':
        if (engaged && ready && adx > 110 && adx < 250 && RNG() < 0.05) act = 'skill';
        break;
      case 'boss': {
        const far = adx > reach + 40;
        if (ready && far) {
          const opts = [sk, sk2].filter(m => m && (m.proj || m.tele || m.beam || (m.dash && adz < 10)));
          if (opts.length && RNG() < 0.06) act = opts[Math.floor(RNG() * opts.length)] === sk ? 'skill' : 'skill2';
        } else if (ready && sk2 && sk2.tele && RNG() < 0.01) act = 'skill2';
        else if (ready && RNG() < 0.01) act = sk.proj || (sk.dash && adz < 10) ? 'skill' : sk2 && (sk2.dash || sk2.beam) ? 'skill2' : null;
        break;
      }
      default:
        if (engaged && ready && adx < reach + 6 && adz < 9 && sk && d.skillP && RNG() < d.skillP) act = 'skill';
    }
    if (!act && engaged && ready && adx < reach + 6 && adz < 9) act = 'atk';
    if (act && e.moves[act] && e.moves[act].startup) {
      e.startMove(act); e.cool = (d.boss ? 30 : 50) + RNG() * 40 * (e.hp < e.maxHp * 0.3 ? 0.5 : 1);
      return;
    }
    if (tx === undefined) {
      const side = e.x < p.x ? -1 : 1;
      if (engaged) { tx = p.x + side * reach * 0.75; tz = p.z; }
      else { tx = p.x + side * (150 + (e.idx % 3) * 35); tz = clamp(p.z + (e.idx % 2 ? -34 : 34), 4, CALLE.ZMAX - 4); }
    }
    if (!engaged && d.ai !== 'ranged' && RNG() < 0.006) { e.wait = 20 + RNG() * 40; return; }
    const ddx = tx - e.x, ddz = tz - e.z, sp = d.speed * (d.boss && e.hp < e.maxHp * 0.3 ? 1.3 : 1);
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
      const key = (a === p ? 'p' : 'e' + a.idx) + '-' + a.serial;
      const rec = log[key] || (log[key] = { n: 0, f: -99 });
      if (rec.n >= maxH || a.mf - rec.f < (m.hitEvery || m.every || 99)) return;
      rec.n++; rec.f = a.mf; a.hasHit = true;
      this.applyHit(a, d, m, { x: (Math.max(hb.l, hu.l) + Math.min(hb.r, hu.r)) / 2, y: (Math.max(hb.b, hu.b) + Math.min(hb.t, hu.t)) / 2, last: rec.n >= maxH });
    };
    if (p.move && p.move.id !== 'super') for (const e of this.foes) tryHit(p, e);
    for (const e of this.foes) tryHit(e, p);
  }
  applyHit(a, d, m, info) {
    const toPlayer = d === this.player, fx = this.game.fx;
    const sx = info.x, sy = groundY(d.z) - info.y;
    const dir = info.dir || Math.sign(d.x - a.x) || a.facing;
    // guardia frontal (yuppie): para los golpes normales que llegan de frente
    if (d.state === 'guard' && Math.sign(a.x - d.x) === d.facing && !GUARD_BREAK.includes(m.id) && m.kind !== 'super') {
      d.guardHits++; d.pushV = dir * 1.5;
      fx.spark(sx, sy, '#7fd4ff', 6, 0.7); Audio8.play('block');
      if (d.guardHits >= 3) { d.state = 'idle'; d.cool = 0; d.guardHits = 0; } // contraataca
      return;
    }
    // agarre enemigo: en vez de daño, sujeta al jugador
    if (m.grab && toPlayer && d.y <= 0 && !['grabbed', 'dizzy'].includes(d.state)) {
      Object.assign(d, { state: 'grabbed', by: a, mash: 0, move: null, vx: 0, vz: 0 });
      Object.assign(a, { state: 'hold', holdT: m.grab.hold, move: null });
      this.callout('¡TE TENGO!', a); Audio8.play('block');
      return;
    }
    const pow = a.isPlayer ? a.ch.stats.power : 1;
    const dmg = Math.max(1, Math.round(m.dmg * pow));
    d.hp -= dmg; d.flash = 5; d.t = 0;
    d.recent = this.frame - d.lastHurtF < 45 ? d.recent + 1 : 1; d.lastHurtF = this.frame;
    if (toPlayer) { this.meter = Math.min(200, this.meter + dmg * 0.04); a.lastConnect = this.frame; }
    else {
      this.score += dmg * 10; this.meter = Math.min(200, this.meter + dmg * 0.1 + (m.kind === 'super' ? 0 : 1));
      if (a === this.player) a.lastConnect = this.frame;
      this.foeHud = { f: d, t: 150 };
      // el especial cuesta un poco de vida solo si conecta (como en los clásicos)
      if (a === this.player && a.special && a.specialPaid !== a.serial) { a.specialPaid = a.serial; a.hp = Math.max(1, a.hp - 30); }
    }
    const heavy = dmg >= 55 || m.kind === 'super';
    const knockMove = m.knockdown || m.knock || m.launch;
    Audio8.play(heavy ? 'hitHeavy' : 'hitLight');
    fx.spark(sx, sy, heavy ? '#ffe36e' : '#fff', heavy ? 12 : 7, heavy ? 1.2 : 0.8);
    if (heavy || d.recent % 3 === 0) fx.word(sx + (RNG() - 0.5) * 24, sy - 18, pickR(heavy ? HEAVY_WORDS : KO_WORDS), pickR(['#f4c20d', '#ff5b7a', '#5effa0', '#9bf0ff']), heavy ? 12 : 9);
    const iconFor = { euro: 'euro', chart: 'chart', notes: 'note', ai: 'digit', comic: 'star', clap: 'film', sub: 'bubble', wave: 'bubble', vhs: 'film', horns: 'bolt', board: 'star', metal: 'bolt' };
    if (m.fx && (m.kind === 'special' || m.kind === 'super')) fx.icons(sx, sy, iconFor[m.fx] || 'star', 4);
    if (heavy) this.shake(m.kind === 'super' ? 5 : 3);
    this.hitstop = m.kind === 'super' ? 3 : heavy ? 8 : 5;
    if (d.hp <= 0) { d.hp = 0; if (!toPlayer) { this.score += d.def.score; this.killed(d); } else { Audio8.play('ko'); this.shake(8); } }
    else if (m.grabHit) return; // rodillazo en el agarre: sigue sujeto
    // armadura: los golpes sueltos no le interrumpen (destella en naranja)
    if (!toPlayer && d.def.armor && d.hp > 0 && !knockMove && m.kind !== 'super' && d.state !== 'hitstun' && d.state !== 'grabbed') {
      if (this.frame - d.armorF > 50) d.armorN = 0;
      d.armorF = this.frame;
      if (d.armorN < d.def.armor) { d.armorN++; fx.spark(sx, sy, '#ff9b3b', 6, 0.8); return; }
    }
    if (d.state === 'grabbed' && !toPlayer && a !== this.player) return;
    if (toPlayer && d.state === 'grabbed') d.by = null;
    d.move = null;
    if (!m.cost && m.kind !== 'super') d.facing = -dir;
    if (toPlayer && m.stun && d.hp > 0 && !knockMove) { Object.assign(d, { state: 'dizzy', dizzyT: m.stun, vx: 0, vz: 0, mash: 0 }); this.callout('¡ATONTADO!', d); return; }
    const knock = d.hp <= 0 || knockMove && info.last !== false || d.airborne || d.recent >= (toPlayer ? 4 : 6);
    if (knock) {
      if (d.state === 'grabbed' && this.player.held === d) { this.player.held = null; this.player.state = 'idle'; }
      d.state = 'launched'; d.y = Math.max(d.y, 0.5);
      d.vy = (m.launch ? m.launch.vy : m.knock ? 6 : 5.5) * 0.85; d.vx = (m.launch ? m.launch.vx : 2.4) * dir * 1.15; d.vz = 0;
      d.thrown = a.isPlayer && Math.abs(d.vx) > 2.5; d.recent = 0;
      if (d.def && d.def.boss) { d.vy *= 0.75; d.vx *= 0.6; }
    } else { d.state = 'hitstun'; d.stun = m.hitstun || 18; d.pushV = (m.push === undefined ? 3 : m.push) * dir * 0.55; d.vx = d.vz = 0; }
  }
  killed(e) {
    if (e.def.boss) {
      this.game.flashT = 14; Audio8.play('ko'); Audio8.say('K. O.'); this.shake(10); this.beam = null;
      for (const o of this.foes) if (o !== e && o.hp > 0) { o.hp = 0; o.state = 'launched'; o.vy = 6; o.y = 0.5; o.vx = 3 * Math.sign(o.x - e.x || 1); }
      this.queue = [];
    }
    if (e.def.drop) this.items.push({ x: e.x, z: e.z, kind: e.def.drop, taken: false, drop: true });
  }
  // Un enemigo lanzado arrolla a los que pilla por el camino
  bowling() {
    for (const t of this.foes) {
      if (t.state !== 'launched' || !t.thrown) continue;
      for (const o of this.foes) {
        if (o === t || !o.hurtbox() || Math.abs(o.x - t.x) > 0.25 * t.size || Math.abs(o.z - t.z) > 16) continue;
        t.thrown = false;
        this.applyHit(this.player, o, { dmg: 30, knockdown: true, launch: { vx: 2.5, vy: 6 } }, { x: o.x, y: 0.45 * o.size });
      }
    }
  }
  pickItems() {
    const p = this.player;
    if (!p.free) return;
    for (const it of this.items) {
      if (it.taken || Math.abs(it.x - p.x) > 26 || Math.abs(it.z - p.z) > 14) continue;
      const def = CALLE_ITEMS[it.kind];
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
    Object.assign(p, { hp: p.maxHp, state: 'idle', t: 0, invuln: 150, y: 0, vx: 0, vy: 0, move: null, by: null });
    this.game.flashT = 10; this.shake(6); Audio8.play('superStart');
    this.game.fx.word(p.x, groundY(p.z) - 120, '¡OTRA VIDA!', '#f4c20d', 12);
    for (const e of this.foes) {
      if (e.state === 'hold') e.state = 'idle';
      if (e.hp > 0 && Math.abs(e.x - p.x) < 160) { e.state = 'launched'; e.y = 0.5; e.vy = 5; e.vx = 3.5 * (Math.sign(e.x - p.x) || 1); e.move = null; }
    }
    this.shots = []; this.beam = null;
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
    drawStage(ctx, cx, this.frame, this.stage);
    ctx.save(); ctx.translate(-cx, 0);
    for (const it of this.items) if (!it.taken) drawItem(ctx, it, this.frame);
    if (this.beam) this.drawBeam(ctx);
    const all = [this.player, ...this.foes].sort((a, b) => a.z - b.z);
    for (const b of all) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, groundY(b.z) + 1, 0.18 * b.hpx * Math.max(0.5, 1 - b.y / 200), 5, 0, 0, 7); ctx.fill(); }
    if (this.superFx > 0) this.drawSuperFx(ctx);
    for (const b of all) b.isPlayer ? this.drawPlayer(ctx, b) : this.drawThug(ctx, b);
    for (const s of this.shots) drawShot(ctx, s);
    this.game.fx.draw(ctx);
    ctx.restore();
    drawStageFront(ctx, cx, this.frame, this.stage);
    ctx.restore();
    this.drawHUD(ctx);
  }
  drawPlayer(ctx, b) {
    if (b.invuln > 0 && b.state !== 'attack' && Math.floor(this.frame / 3) % 2) ctx.globalAlpha = 0.45;
    drawFighterAt(ctx, b.look, b.x, groundY(b.z) - b.y, b.pose, b.facing, this.frame, { fighter: b, scale: b.k, flash: b.flash > 0, state: b.state });
    ctx.globalAlpha = 1;
    if (b.state === 'dizzy') drawDizzy(ctx, b.x, groundY(b.z) - b.hpx - 6, this.frame);
    if (b.state === 'grabbed' && Math.floor(this.frame / 10) % 2) txt(ctx, '¡MACHACA BOTONES!', b.x, groundY(b.z) - b.hpx - 16, 6, '#f4c20d');
  }
  drawThug(ctx, e) {
    if (e.state === 'dead' && Math.floor(e.deadT / 3) % 2) return;
    if (e.fade > 0) ctx.globalAlpha = Math.abs(e.fade - e.move.startup / 2) / (e.move.startup / 2);
    const [set, anim, i] = thugFrame(e);
    FrameSprites.drawFrame(ctx, set, anim, i, e.x, groundY(e.z) - e.y, e.facing, { px: e.size, tint: set === e.def.base ? e.def.tint : null, flash: e.flash > 0 });
    ctx.globalAlpha = 1;
    if (e.state === 'guard') { ctx.strokeStyle = 'rgba(127,212,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + e.facing * 0.2 * e.size, groundY(e.z) - 0.55 * e.size, 0.28 * e.size, -1.2, 1.2); ctx.stroke(); }
    if (e.armorN > 0 && this.frame - e.armorF < 12) { ctx.fillStyle = 'rgba(255,155,59,0.25)'; ctx.fillRect(e.x - 0.18 * e.size, groundY(e.z) - e.size, 0.36 * e.size, e.size); }
  }
  drawBeam(ctx) {
    const b = this.beam, y = groundY(b.z);
    if (b.t < b.warn) {
      if (Math.floor(b.t / 5) % 2) { ctx.fillStyle = 'rgba(255,40,60,0.28)'; ctx.fillRect(this.camX, y - 16, W, 32); }
      txt(ctx, '¡APÁRTATE!', this.camX + W / 2, y - 26, 8, '#ff5b7a');
    } else {
      const k = 1 - (b.t - b.warn) / 24, by = y - 0.5 * b.e.size;
      ctx.fillStyle = `rgba(255,230,120,${0.8 * k})`; ctx.fillRect(this.camX, by - 14 * k, W, 28 * k);
      ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillRect(this.camX, by - 5 * k, W, 10 * k);
    }
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
    const boss = this.lockX !== null && this.foes.find(e => e.def.boss && e.hp > 0);
    const fh = this.foeHud || (boss ? { f: boss } : null);
    if (fh) {
      const e = fh.f;
      ctx.fillStyle = 'rgba(12,7,24,0.78)'; ctx.fillRect(W - 236, 6, 230, 30);
      txt(ctx, e.def.name, W - 12, 14, 6, e.def.boss ? '#ff5b7a' : '#fff', 'right');
      hpBar(ctx, W - 228, 21, 214, 8, e.hp / e.maxHp, e.def.boss ? '#ff5b7a' : '#e8423a');
    }
    if (this.phase === 'intro') {
      comicText(ctx, 'FASE ' + (this.stageI + 1), W / 2, 110, 22, '#f4c20d');
      txt(ctx, this.stage.name, W / 2, 140, 12, '#fff');
      txt(ctx, 'P GOLPE · K SALTO · SP ESPECIAL (CON BARRA: SUPER)', W / 2, 170, 6, '#9bf0ff');
      txt(ctx, 'CHOCA CON UN ENEMIGO PARA AGARRARLO · ATRÁS+P LO LANZA', W / 2, 184, 6, '#9bf0ff');
    }
    if (this.goT > 0 && this.lockX === null && this.phase === 'play') {
      this.goT--;
      if (Math.floor(this.frame / 12) % 2) { comicText(ctx, '¡ADELANTE!', W - 110, 120, 14, '#f4c20d'); txt(ctx, '>>>', W - 110, 142, 12, '#f4c20d'); }
    }
    if (this.bossIntro > 0) { this.bossIntro--; comicText(ctx, '¡JEFE!', W / 2, 110, 26, '#ff5b7a'); txt(ctx, this.bossName, W / 2, 140, 10, '#fff'); }
    if (this.phase === 'clear' && this.pt > 60) {
      comicText(ctx, '¡FASE SUPERADA!', W / 2, 100, 22, '#5effa0');
      txt(ctx, 'PUNTOS ' + this.score, W / 2, 132, 10, '#fff');
      if (this.pt > 200) txt(ctx, this.stageI + 1 < CALLE_STAGES.length ? 'ENTER: SIGUIENTE FASE' : 'ENTER', W / 2, 160, 8, '#bbb');
    }
    if (this.phase === 'ending') {
      ctx.fillStyle = 'rgba(5,0,20,0.7)'; ctx.fillRect(0, 0, W, H);
      comicText(ctx, '¡MÁLAGA ESTÁ A SALVO!', W / 2, 110, 18, '#f4c20d');
      txt(ctx, `${p.ch.name} limpia las calles · PUNTOS ${this.score}`, W / 2, 146, 8, '#fff');
      if (this.pt > 120) txt(ctx, 'PULSA ENTER', W / 2, 180, 8, '#bbb');
    }
    if (this.phase === 'over') {
      ctx.fillStyle = 'rgba(5,0,20,0.6)'; ctx.fillRect(0, 0, W, H);
      comicText(ctx, 'FIN DE LA PARTIDA', W / 2, 120, 20, '#e8423a');
      if (this.cont > 0) txt(ctx, `¿CONTINUAR? ${Math.ceil(this.cont / 60)}  · ENTER`, W / 2, 160, 9, '#fff');
      else txt(ctx, 'PULSA ENTER', W / 2, 160, 9, '#bbb');
    }
  }
}

// Fotograma de un enemigo: con su atlas propio ('e_<id>': idle, walk, atk, skill, skill2, hit, down) o, mientras
// no exista, con el atlas del protagonista base y la animación provisional 'ph' de cada golpe.
function thugFrame(e) {
  const own = FrameSprites.has('e_' + e.kind), set = own ? 'e_' + e.kind : e.def.base;
  const A = FrameSprites.sets[set].meta.anims;
  const n = an => (A[an] ? A[an].frames.length : 1);
  const loop = (an, t, fps = 8) => [an, Math.floor(t * fps / 60) % n(an)];
  let r;
  switch (e.state) {
    case 'attack': { const m = e.move, an = own ? m.anim : m.ph; r = [an, phaseFrame(e.mf, m, n(an))]; break; }
    case 'hold': r = own ? ['skill', Math.floor(n('skill') * 0.6)] : ['lp', 2]; break;
    case 'guard': r = own ? ['skill', Math.min(2, n('skill') - 1)] : ['block', 1]; break;
    case 'walk': { const an = own ? 'walk' : 'walk_f'; r = [an, ((Math.floor(Math.abs(e.walkX) / 9) % n(an)) + n(an)) % n(an)]; break; }
    case 'hitstun': case 'grabbed': r = ['hit', e.state === 'grabbed' || e.t >= 4 ? 1 : 0]; break;
    case 'launched': r = own ? ['down', e.vy > 0 ? 0 : 1] : ['launched', e.vy > 0 ? 0 : 1]; break;
    case 'knockdown': case 'dead': r = ['down', n('down') - 1]; break;
    case 'getup': r = own ? ['down', Math.max(0, n('down') - 1 - Math.floor(e.t / 4))] : ['getup', Math.min(n('getup') - 1, Math.floor(e.t / 6))]; break;
    case 'jump': r = own ? ['hit', 0] : ['jump', 2]; break;
    case 'land': r = own ? ['idle', 0] : ['jump', 0]; break;
    default: r = loop('idle', e.t + e.idx * 17);
  }
  if (!A[r[0]]) r = ['idle', 0];
  return [set, r[0], Math.min(r[1], n(r[0]) - 1)];
}
// Reparte los fotogramas de un golpe: arranque, impacto (zona central) y recuperación
function phaseFrame(mf, m, n) {
  if (n <= 1) return 0;
  const a = Math.max(1, Math.round(n * 0.35)), b = Math.max(a + 1, Math.round(n * 0.65));
  if (mf < m.startup) return Math.floor(mf / m.startup * a);
  if (mf < m.startup + m.active) return Math.min(b - 1, a + Math.floor((mf - m.startup) / m.active * (b - a)));
  return Math.min(n - 1, b + Math.floor((mf - m.startup - m.active) / Math.max(1, m.recovery) * (n - b)));
}

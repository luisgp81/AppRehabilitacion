'use strict';
// Lógica de luchador: golpes, estados, físicas y cajas de impacto.
const W = 640, H = 360, GROUND = 318, STAGE_L = 34, STAGE_R = 606, GRAV = 0.6;

function buildMoves(ch) {
  const st = ch.stats, sup = ch.moves.super.kind;
  const M = {
    lp: { kind: 'normal', anim: 'lp', startup: 4, active: 3, recovery: 8, dmg: 42, hitstun: 18, blockstun: 11, guard: 'mid', hb: { x: 44, y: 90, w: 44, h: 22 }, push: 3.5, cancel: ['lp', 'sk', 'sp', 'super'], chain: 3 },
    sk: { kind: 'normal', anim: 'sk', startup: 7, active: 4, recovery: 15, dmg: 72, hitstun: 19, blockstun: 14, guard: 'mid', hb: { x: 62, y: 68, w: 60, h: 24 }, push: 5, cancel: ['sp', 'super'] },
    cp: { kind: 'normal', anim: 'cp', startup: 4, active: 3, recovery: 8, dmg: 36, hitstun: 17, blockstun: 10, guard: 'mid', hb: { x: 46, y: 54, w: 44, h: 20 }, push: 3, cancel: ['cp', 'ck', 'sp', 'super'], chain: 3, crouch: true },
    ck: { kind: 'normal', anim: 'ck', startup: 8, active: 4, recovery: 22, dmg: 62, hitstun: 20, blockstun: 14, guard: 'low', hb: { x: 64, y: 12, w: 68, h: 20 }, push: 4, knockdown: true, cancel: ['super'], crouch: true },
    jp: { kind: 'air', anim: 'jp', startup: 4, active: 12, recovery: 4, dmg: 55, hitstun: 17, blockstun: 12, guard: 'overhead', hb: { x: 34, y: 42, w: 44, h: 34 }, push: 3 },
    jk: { kind: 'air', anim: 'jk', startup: 5, active: 14, recovery: 4, dmg: 66, hitstun: 19, blockstun: 13, guard: 'overhead', hb: { x: 42, y: 20, w: 56, h: 34 }, push: 3.5 },
    proj: { kind: 'special', anim: 'proj', startup: 13, active: 2, recovery: 26, spawn: 13, dmg: 85, chip: 14, hitstun: 21, blockstun: 17, guard: 'mid', push: 5, speed: st.projSpeed },
    dp: { kind: 'special', anim: 'dp', startup: 4, active: 12, recovery: 10, dmg: 115, chip: 12, hitstun: 30, blockstun: 18, guard: 'mid', hb: { x: 30, y: 100, w: 46, h: 76 }, launch: { vx: 2.5, vy: 9 }, knockdown: true, invuln: [0, 8], rise: { frame: 3, vy: 10.5, vx: 1.6 }, cancel: ['super'] },
    rush: { kind: 'special', anim: 'rush', startup: 8, active: 20, recovery: 18, dmg: 58, chip: 9, hits: 2, hitEvery: 9, hitstun: 20, blockstun: 14, guard: 'mid', hb: { x: 36, y: 64, w: 60, h: 74 }, push: 2.5, knockdown: true, dash: st.rushSpeed },
    super: { kind: 'super', anim: 'super', startup: 8, active: 44, recovery: 26, spawn: 8, sup, dmg: 40, chip: 6, hitstun: 24, blockstun: 10, guard: 'mid', invuln: [0, 20], knockdown: true, cost: 100 },
    // Remate del combo arcade (puño, puño, patada): lanza por los aires y se cancela en super
    remate: { kind: 'normal', anim: 'sk', startup: 6, active: 4, recovery: 18, dmg: 88, hitstun: 26, blockstun: 16, guard: 'mid', hb: { x: 64, y: 74, w: 66, h: 34 }, push: 3, launch: { vx: 3.2, vy: 8.5 }, knockdown: true, cancel: ['super'] },
    // Segundo super: embestida de 7 impactos
    super2: { kind: 'super', anim: 'rush', startup: 6, active: 34, recovery: 24, dmg: 34, chip: 8, hits: 7, hitEvery: 4, hitstun: 22, blockstun: 8, guard: 'mid', hb: { x: 42, y: 72, w: 72, h: 96 }, push: 1.2, dash: 9, invuln: [0, 14], knockdown: true, launch: { vx: 4, vy: 9 }, cost: 100 },
    // Golpe Final: 2 barras; si conecta, cinemática de 9 impactos
    ultra: { kind: 'ultra', anim: 'super', startup: 10, active: 8, recovery: 40, dmg: 0, chip: 30, hitstun: 30, blockstun: 22, guard: 'mid', hb: { x: 54, y: 86, w: 88, h: 130 }, push: 2, invuln: [0, 18], cost: 200, dash: 5 },
  };
  const s = ch.look.scale;
  for (const k in M) {
    const m = M[k]; m.id = k;
    if (m.hb) m.hb = { x: m.hb.x * s, y: m.hb.y * s, w: m.hb.w * s, h: m.hb.h * s };
    if (ch.moves[k]) { m.name = ch.moves[k].name; m.fx = ch.moves[k].fx; m.text = ch.moves[k].text; m.style = ch.moves[k].style; }
  }
  if (ch.moves.rush.style === 'fly') { M.rush.hb.y += 10; }
  M.super2.style = ch.moves.rush.style === 'fly' ? 'charge' : ch.moves.rush.style;
  M.lp.cancel = ['lp', 'remate', 'sk', 'sp', 'super'];
  if (ch.moves.rush.style === 'spin') { M.rush.hits = 3; M.rush.hitEvery = 6; M.rush.dmg = 42; }
  return M;
}

const GROUND_FREE = ['idle', 'walk', 'crouch'];

class Fighter {
  constructor(game, idx, ch, alt) {
    this.game = game; this.idx = idx; this.ch = ch;
    this.look = alt ? Object.assign({}, ch.look, ch.alt, { isAlt: true }) : ch.look;
    this.moves = buildMoves(ch);
    this.ctrl = game.ctrls[idx];
    this.maxHp = ch.stats.hp;
    this.wins = 0; this.meter = 0;
    this.pose = null;
    this.stats = { hits: 0, maxCombo: 0, specials: 0, supers: 0, blocks: 0 };
  }
  resetRound(x, facing) {
    Object.assign(this, {
      x, y: 0, vx: 0, vy: 0, facing, hp: this.maxHp, dispHp: this.maxHp,
      state: 'intro', t: 0, move: null, mf: 0, stun: 0, invuln: 0,
      combo: 0, comboDmg: 0, juggle: 0, hasHit: false, hitsDone: 0, lastHitF: -99,
      chainCount: 0, pushV: 0, flash: 0, guarding: false, airAttackUsed: false, landT: 0, counterable: false,
    });
    this.pose = null;
    this.ctrl.clearAll();
  }
  get s() { return this.look.scale; }
  get airborne() { return this.y > 0 || this.vy > 0; }
  get crouching() {
    if (this.state === 'crouch') return true;
    if (this.state === 'attack' && this.move.crouch) return true;
    if (this.state === 'blockstun' && this.ctrl.held.down) return true;
    return false;
  }
  isActive() { const m = this.move; return this.state === 'attack' && m && this.mf >= m.startup && this.mf < m.startup + m.active; }
  hurtbox() {
    if (['knockdown', 'getup', 'ko'].includes(this.state)) return null;
    const s = this.s, w = 44 * s;
    let h = 112 * s;
    if (this.crouching) h = 70 * s;
    else if (this.state === 'launched') h = 70 * s;
    else if (this.airborne) h = 92 * s;
    let off = 0;
    if (this.state === 'attack' && this.move.id === 'rush' && this.move.style === 'charge') off = 8;
    return { l: this.x - w / 2 + off * this.facing, r: this.x + w / 2 + off * this.facing, b: this.y + (this.state === 'launched' ? 10 : 0), t: this.y + h };
  }
  hitbox() {
    const m = this.move;
    if (!m || !m.hb || !this.isActive()) return null;
    const cx = this.x + this.facing * m.hb.x;
    return { l: cx - m.hb.w / 2, r: cx + m.hb.w / 2, b: this.y + m.hb.y - m.hb.h / 2, t: this.y + m.hb.y + m.hb.h / 2 };
  }
  canBlock(guard) {
    const okState = GROUND_FREE.includes(this.state) || this.state === 'blockstun';
    if (!okState || this.airborne) return false;
    if (!this.ctrl.back(this.facing)) return false;
    const crouch = !!this.ctrl.held.down;
    if (guard === 'low' && !crouch) return false;
    if (guard === 'overhead' && crouch) return false;
    return true;
  }
  startMove(id) {
    const m = this.moves[id];
    if (!m) return false;
    if (id === 'proj' && this.game.hasProjectile(this)) return false;
    if (m.kind !== 'air') this.vx = 0;
    if (m.cost) {
      if (this.meter < m.cost) return false;
      this.meter -= m.cost; this.stats.supers++;
      this.game.superFreeze(this, m);
    } else if (m.kind === 'special') {
      this.stats.specials++;
      Audio8.play('special');
      this.game.callout(this, m.name);
    } else { Audio8.play('whoosh'); if (id === 'remate') this.game.callout(this, m.name); }
    this.chainCount = (this.move && this.move.id === id) ? this.chainCount + 1 : 0;
    this.state = 'attack'; this.move = m; this.mf = 0; this.t = 0; this.moveSerial = (this.moveSerial || 0) + 1;
    this.hasHit = false; this.hitsDone = 0; this.lastHitF = -99;
    if (m.invuln) this.invuln = m.invuln[1];
    this.ctrl.consume('p'); this.ctrl.consume('k'); this.ctrl.consume('s');
    return true;
  }
  // Lectura de golpes desde neutral o desde cancelación
  pickMove(allowed) {
    const c = this.ctrl, f = this.facing;
    const ok = id => !allowed || allowed.includes(id) || (allowed.includes('sp') && ['proj', 'dp', 'rush'].includes(id)) || (allowed.includes('super') && ['super2', 'ultra'].includes(id));
    const sd = c.buffered('s', 5) ? (c.sDir || 5) : 5;
    const bP = c.buffered('p', 5), bK = c.buffered('k', 5), bS = c.buffered('s', 5);
    // Golpe Final: P+K+SP a la vez (o 214214+P) con 2 barras
    if (this.meter >= 200 && ok('ultra') && ((bP && bK && bS) || (bP && c.motion([2, 1, 4, 2, 1, 4], 34)))) return 'ultra';
    // Super 2: K+SP a la vez (o 236236+K)
    if (this.meter >= 100 && ok('super2') && ((bK && bS) || (bK && c.motion([2, 3, 6, 2, 3, 6], 34)))) return 'super2';
    if (this.meter >= 100 && ok('super')) {
      if ((c.buffered('p', 5) && c.motion([2, 3, 6, 2, 3, 6], 34)) || (c.buffered('s', 5) && (c.held.down || sd <= 3))) return 'super';
    }
    if (c.buffered('s', 5)) {
      const back = c.back(f) || [1, 4, 7].includes(sd), fwd = c.fwd(f) || [3, 6, 9].includes(sd);
      const id = back ? 'dp' : fwd ? 'rush' : 'proj';
      if (ok(id) && !(id === 'proj' && this.game.hasProjectile(this))) return id;
    }
    if (c.buffered('p', 5)) {
      if (ok('dp') && c.motion([6, 2, 3], 16)) return 'dp';
      if (ok('proj') && c.motion([2, 3, 6], 16) && !this.game.hasProjectile(this)) return 'proj';
      const id = c.held.down ? 'cp' : 'lp';
      if (ok(id)) return id;
    }
    if (c.buffered('k', 5)) {
      if (ok('rush') && c.motion([2, 1, 4], 16)) return 'rush';
      if (allowed && allowed.includes('remate') && this.move && this.move.id === 'lp' && this.chainCount >= 1 && !c.held.down) return 'remate';
      const id = c.held.down ? 'ck' : 'sk';
      if (ok(id)) return id;
    }
    return null;
  }
  threatNear(opp) {
    const d = Math.abs(opp.x - this.x);
    if (opp.state === 'attack' && opp.move && opp.mf < opp.move.startup + opp.move.active && d < 170) return true;
    return this.game.projectiles.some(p => p.owner === opp && Math.abs(p.x - this.x) < 150);
  }
  update(opp) {
    const c = this.ctrl, f = this.facing;
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    this.guarding = false;
    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': {
        if (c.dashReq && !c.held.down) {
          this.state = 'dash'; this.t = 0; this.dashDir = c.dashReq; c.dashReq = 0;
          if (this.dashDir < 0) this.invuln = 5;
          Audio8.play('whoosh');
          break;
        }
        c.dashReq = 0;
        const mv = this.pickMove(null);
        if (mv && this.startMove(mv)) break;
        if (c.held.up) { this.state = 'prejump'; this.t = 0; this.vx = 0; break; }
        if (c.held.down) { this.state = 'crouch'; this.vx = 0; this.guarding = c.back(f) && this.threatNear(opp); break; }
        if (c.back(f) && this.threatNear(opp)) { this.state = 'idle'; this.vx = 0; this.guarding = true; break; }
        if (c.fwd(f)) { this.state = 'walk'; this.vx = this.ch.stats.walkF * f; }
        else if (c.back(f)) { this.state = 'walk'; this.vx = -this.ch.stats.walkB * f; }
        else { this.state = 'idle'; this.vx = 0; }
        break;
      }
      case 'dash':
        this.vx = (this.dashDir > 0 ? 6.5 : -5.5) * f * (1 - this.t / 18);
        if (this.t >= 15) { this.state = 'idle'; this.vx = 0; }
        break;
      case 'prejump':
        if (this.t >= 3) {
          const dir = c.fwd(f) ? 1 : c.back(f) ? -1 : 0;
          this.state = 'jump'; this.t = 0; this.vy = this.ch.stats.jumpV; this.y = 0.1;
          this.vx = dir * this.ch.stats.jumpX * f; this.airAttackUsed = false; this.jumpSerial = (this.jumpSerial || 0) + 1;
          Audio8.play('jump');
        }
        break;
      case 'jump':
        if (!this.airAttackUsed && (c.buffered('p', 3) || c.buffered('k', 3))) {
          const id = c.buffered('k', 3) ? 'jk' : 'jp';
          this.airAttackUsed = true;
          const vx = this.vx;
          this.startMove(id); this.vx = vx;
        }
        break;
      case 'land':
        this.vx = 0;
        if (this.t >= this.landT) { this.state = 'idle'; this.t = 0; }
        break;
      case 'attack': this.stepMove(opp); break;
      case 'hitstun': case 'blockstun':
        this.stun--;
        if (this.stun <= 0) { this.state = c.held.down ? 'crouch' : 'idle'; this.t = 0; }
        break;
      case 'knockdown':
        this.vx *= 0.8;
        if (this.t >= 42) { this.state = 'getup'; this.t = 0; }
        break;
      case 'getup':
        if (this.t >= 18) { this.state = 'idle'; this.t = 0; this.invuln = 4; }
        break;
    }
    if (['idle', 'walk', 'crouch', 'jump', 'attack', 'dash', 'prejump', 'land', 'blockstun'].includes(this.state)) {
      if (this.combo > 0) this.game.endCombo(this);
      this.combo = 0; this.comboDmg = 0; this.juggle = 0;
    }
  }
  stepMove(opp) {
    const m = this.move, f = this.facing;
    this.mf++;
    this.counterable = this.mf < m.startup;
    if (m.rise && this.mf === m.rise.frame) { this.vy = m.rise.vy; this.vx = m.rise.vx * f; this.y = 0.1; }
    if (m.dash) {
      if (this.mf >= m.startup && this.mf < m.startup + m.active) {
        this.vx = (m.cost && this.hasHit ? 1.4 : m.dash) * f;
        if (m.style === 'fly' && this.mf === m.startup) { this.vy = 3.2; this.y = 0.1; }
      } else this.vx *= 0.75;
    }
    if (m.spawn && this.mf === m.spawn) {
      if (m.id === 'proj') this.game.spawnProjectile(this, m);
      else if (m.id === 'super') this.game.spawnSuper(this, m);
    }
    // Cancelaciones: golpe normal conectado → especial / super
    if (m.cancel && this.hasHit && this.mf >= m.startup) {
      const allowed = m.cancel.filter(id => !(id === m.id && this.chainCount >= (m.chain || 1) - 1));
      const nx = this.pickMove(allowed);
      if (nx && nx !== 'jp' && nx !== 'jk' && this.startMove(nx)) return;
    }
    const total = m.startup + m.active + m.recovery;
    if (m.kind === 'air') {
      if (this.mf >= total) { this.state = 'jump'; this.move = null; }
      return;
    }
    if (m.id === 'dp' || (m.id === 'rush' && m.style === 'fly')) {
      if (this.y <= 0 && this.mf > m.startup + 2) {
        this.state = 'land'; this.landT = m.id === 'dp' ? 14 : 12; this.t = 0; this.move = null; this.vx = 0;
      } else if (this.mf > total + 60) { this.state = 'jump'; this.move = null; }
      return;
    }
    if (this.mf >= total) { this.state = this.ctrl.held.down ? 'crouch' : 'idle'; this.move = null; this.t = 0; this.vx = 0; }
  }
  physics() {
    if (['hitstun', 'blockstun', 'knockdown', 'getup', 'ko'].includes(this.state) && !this.airborne) {
      this.vx = this.pushV * 0.9; this.pushV *= 0.82;
    }
    this.x += this.vx;
    if (this.y > 0 || this.vy > 0) {
      const g = (this.state === 'attack' && this.move && this.move.style === 'fly') ? 0.25 : GRAV;
      this.vy -= g; this.y += this.vy;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.landed(); }
    }
    const lim = 18 * this.s;
    if (this.x < STAGE_L + lim) { this.x = STAGE_L + lim; this.atWall = true; }
    else if (this.x > STAGE_R - lim) { this.x = STAGE_R - lim; this.atWall = true; }
    else this.atWall = false;
  }
  landed() {
    if (this.state === 'jump' || (this.state === 'attack' && this.move.kind === 'air')) {
      this.state = 'land'; this.landT = 3; this.t = 0; this.move = null; this.vx = 0;
      Audio8.play('land');
    } else if (this.state === 'launched') {
      this.state = 'knockdown'; this.t = 0; this.vx *= 0.4; this.pushV = this.vx;
      this.game.shake(4); Audio8.play('land');
    } else if (this.state === 'ko') {
      this.vx *= 0.3; this.pushV = 0; this.game.shake(6); Audio8.play('land');
    } else if (this.state === 'hitstun' || this.state === 'blockstun') {
      this.state = 'land'; this.landT = 2; this.t = 0;
    }
  }
}

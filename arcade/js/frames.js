'use strict';
// Animación por fotogramas (atlas generados con tools/gen_sprites.py + process_frames.py).
// Si un personaje no tiene atlas, o le falta una animación, se usa el rig de sprites.js.
const FrameSprites = (() => {
  const sets = {};
  const MOVE_ANIM = { lp: 'lp', sk: 'sk', cp: 'cp', ck: 'ck', jp: 'jp', jk: 'jk', proj: 'proj', dp: 'dp', rush: 'rush', super: 'super', remate: 'combo', super2: 'super2', ultra: 'ultra' };
  const FALLBACK = { combo: 'sk', super2: 'rush', ultra: 'super' };
  function load(onDone) {
    const idx = window.FRAME_INDEX || {};
    const ids = Object.keys(idx);
    if (!ids.length) { if (onDone) onDone(); return; }
    let left = ids.length;
    for (const id of ids) {
      const img = new Image();
      img.onload = () => { sets[id] = { meta: idx[id], img }; if (--left === 0 && onDone) onDone(); };
      img.onerror = () => { if (--left === 0 && onDone) onDone(); };
      img.src = `assets/frames/${id}/atlas.png`;
    }
  }
  const pick = (arr, k) => arr[Math.max(0, Math.min(arr.length - 1, k))];
  // Devuelve [animación, índice] para un luchador en combate o una petición directa {anim, t}
  function choose(set, f, opts) {
    const A = set.meta.anims;
    const loop = (an, t) => { const a = A[an]; return a ? [an, Math.floor(t * (a.fps || 8) / 60) % a.frames.length] : null; };
    if (!f) return loop(opts.anim || 'idle', opts.t || 0) || loop('idle', opts.t || 0);
    const st = f.state, m = f.move;
    let man = m && MOVE_ANIM[m.id];
    if (man && !A[man] && FALLBACK[man]) man = FALLBACK[man];
    if (st === 'attack' && m && A[man]) {
      const an = man, a = A[an], n = a.frames.length;
      const act = a.active && a.active.length ? a.active : [Math.floor(n / 2)];
      const first = act[0], last = act[act.length - 1];
      if (f.mf < m.startup) return [an, Math.min(first - 1 < 0 ? 0 : Math.floor((f.mf / m.startup) * first), first)];
      if (f.mf < m.startup + m.active) return [an, act[Math.min(act.length - 1, Math.floor((f.mf - m.startup) / m.active * act.length))]];
      const rest = n - 1 - last;
      if (rest <= 0) return [an, last];
      return [an, last + 1 + Math.min(rest - 1, Math.floor((f.mf - m.startup - m.active) / Math.max(1, m.recovery) * rest))];
    }
    const has = an => !!A[an];
    switch (st) {
      case 'walk': {
        const fwd = Math.sign(f.vx) === f.facing;
        const an = fwd || !has('walk_b') ? 'walk_f' : 'walk_b';
        if (!has(an)) break;
        const n = A[an].frames.length;
        return [an, ((Math.floor(Math.abs(f.x) / 9) % n) + n) % n];
      }
      case 'crouch': if (f.guarding && has('block_crouch')) return ['block_crouch', 0]; if (has('crouch')) return ['crouch', Math.min(1, f.t >> 2)]; break;
      case 'prejump': case 'land': if (has('jump')) return ['jump', 0]; break;
      case 'jump': if (has('jump')) return ['jump', f.vy > 4 ? 1 : f.vy > -3 ? 2 : 3]; break;
      case 'dash': if (has('dash')) return ['dash', Math.min(A.dash.frames.length - 1, f.t >> 2)]; break;
      case 'hitstun': { const an = f.crouching && has('hit_crouch') ? 'hit_crouch' : 'hit'; if (has(an)) return [an, f.t < 4 ? 0 : 1]; break; }
      case 'blockstun': { const an = f.ctrl.held.down && has('block_crouch') ? 'block_crouch' : 'block'; if (has(an)) return [an, f.t < 3 ? 0 : 1]; break; }
      case 'launched': if (has('launched')) return ['launched', f.vy > 0 ? 0 : 1]; break;
      case 'knockdown': if (has('down')) return ['down', f.airborne ? 0 : 1]; break;
      case 'getup': if (has('getup')) return ['getup', Math.min(A.getup.frames.length - 1, Math.floor(f.t / 6))]; break;
      case 'ko': if (has('ko')) return ['ko', f.airborne ? 0 : 1]; break;
      case 'win': return loop('win', f.t);
      case 'intro': return loop('intro', f.t) || loop('idle', f.t);
      default:
        if (f.guarding && has('block')) return ['block', 1];
        return loop('idle', f.t + f.idx * 17);
    }
    return null;
  }
  function draw(ctx, id, x, gy, facing, opts) {
    const set = sets[id];
    if (!set) return false;
    const c = choose(set, opts.fighter, opts);
    if (!c) return false;
    const fr = set.meta.anims[c[0]].frames[c[1]];
    const [sx, sy, sw, sh] = fr.r;
    // misma altura en pantalla que el rig: ~ RIGS.k * altura del PNG de referencia
    const rh = (typeof SpriteRig !== 'undefined' && SpriteRig.rigs[id]) ? SpriteRig.rigs[id].h : 335;
    const k = (RIGS[id] ? RIGS[id].k * rh / set.meta.height : 0.6) * (opts.scale || 1);
    ctx.save();
    ctx.translate(x, gy); ctx.scale(facing * k, k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (opts.alt && 'filter' in ctx) ctx.filter = 'hue-rotate(150deg) saturate(1.2)';
    ctx.drawImage(set.img, sx, sy, sw, sh, -fr.ax, -fr.ay, sw, sh);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.45; ctx.drawImage(set.img, sx, sy, sw, sh, -fr.ax, -fr.ay, sw, sh); }
    ctx.restore();
    return true;
  }
  return { load, draw, has: id => !!sets[id], sets, choose };
})();

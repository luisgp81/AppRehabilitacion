'use strict';
// Animación por fotogramas (atlas generados con tools/gen_sprites.py + process_frames.py).
// Si un personaje no tiene atlas, o le falta una animación, se usa el rig de sprites.js.
const FrameSprites = (() => {
  const sets = {};
  const MOVE_ANIM = { lp: 'lp', sk: 'sk', cp: 'cp', ck: 'ck', jp: 'jp', jk: 'jk', proj: 'proj', dp: 'dp', rush: 'rush', super: 'super', remate: 'combo', super2: 'super2', ultra: 'ultra', back: 'sk', w_bate: 'lp', w_guitarra: 'combo', w_movil: 'proj' };
  // sustitutos mientras falte la hoja de una animación (el rig desentona con el arte nuevo)
  const FALLBACK = { combo: 'sk', super2: 'rush', ultra: 'super', lp: 'super2', cp: 'super2', sk: 'rush', ck: 'rush', jp: 'dp', jk: 'dp' };
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
  // Color alternativo (combate espejo): los azules (traje, vaqueros, chaqueta) pasan a gris marengo y
  // lo demás se respeta; girar el tono de todo deja la piel verde. Se calcula una vez por atlas; si el
  // navegador no deja leer los píxeles (file://), se usa el filtro de tono sobre todo el sprite.
  function altImage(set) {
    if (set.alt !== undefined) return set.alt;
    set.alt = null;
    try {
      const c = document.createElement('canvas'); c.width = set.img.width; c.height = set.img.height;
      const g = c.getContext('2d'); g.drawImage(set.img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        const r = a[i], gg = a[i + 1], b = a[i + 2];
        if (b <= r + 12 || b <= gg) continue; // solo azules
        const y = 0.3 * r + 0.59 * gg + 0.11 * b, v = Math.min(255, y * 1.25 + 8);
        a[i] = v; a[i + 1] = v; a[i + 2] = Math.min(255, v * 1.08);
      }
      g.putImageData(d, 0, 0); set.alt = c;
    } catch (e) { set.alt = null; }
    return set.alt;
  }
  // Ropa de otro color (enemigos provisionales del modo Calle): los azules del traje pasan al color pedido
  // conservando el sombreado. Se cachea por fotograma, no por atlas entero, para no gastar memoria.
  function tintFrame(set, fr, col) {
    const cache = set.tints || (set.tints = {});
    const key = col + fr.r.join(',');
    if (key in cache) return cache[key];
    cache[key] = null;
    try {
      const [sx, sy, sw, sh] = fr.r;
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      const g = c.getContext('2d'); g.drawImage(set.img, sx, sy, sw, sh, 0, 0, sw, sh);
      const d = g.getImageData(0, 0, sw, sh), a = d.data;
      const tr = parseInt(col.slice(1, 3), 16), tg = parseInt(col.slice(3, 5), 16), tb = parseInt(col.slice(5, 7), 16);
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        const r = a[i], gg = a[i + 1], b = a[i + 2];
        if (b <= r + 12 || b <= gg) continue;
        const l = Math.min(1.6, (0.3 * r + 0.59 * gg + 0.11 * b) / 70);
        a[i] = Math.min(255, tr * l); a[i + 1] = Math.min(255, tg * l); a[i + 2] = Math.min(255, tb * l);
      }
      g.putImageData(d, 0, 0); cache[key] = c;
    } catch (e) { cache[key] = null; }
    return cache[key];
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
        const fwd = !f.vx || Math.sign(f.vx) === f.facing;
        const an = fwd || !has('walk_b') ? 'walk_f' : 'walk_b';
        if (!has(an)) return loop('idle', f.t);
        const n = A[an].frames.length;
        return [an, ((Math.floor(Math.abs(f.walkX !== undefined ? f.walkX : f.x) / 9) % n) + n) % n];
      }
      case 'crouch': if (f.guarding && has('block_crouch')) return ['block_crouch', 0]; if (has('crouch')) return ['crouch', Math.min(1, f.t >> 2)]; if (has('block_crouch')) return ['block_crouch', 0]; break;
      case 'prejump': case 'land': if (f.threw && has('throw')) return ['throw', Math.min(A.throw.frames.length - 1, Math.floor(f.t / 3))]; if (has('jump')) return ['jump', 0]; if (has('dp')) return ['dp', 0]; break;
      case 'jump': if (has('jump')) return ['jump', f.vy > 4 ? 1 : f.vy > -3 ? 2 : 3]; if (has('dp')) return ['dp', f.vy < 0 ? 2 : 4]; break;
      case 'dash': if (has('dash')) return ['dash', Math.min(A.dash.frames.length - 1, f.t >> 2)]; if (has('rush')) return ['rush', Math.min(3, 1 + (f.t >> 3))]; break;
      case 'hitstun': { const an = f.crouching && has('hit_crouch') ? 'hit_crouch' : 'hit'; if (has(an)) return [an, f.t < 4 ? 0 : 1]; break; }
      case 'blockstun': { const an = f.ctrl.held.down && has('block_crouch') ? 'block_crouch' : 'block'; if (has(an)) return [an, f.t < 3 ? 0 : 1]; break; }
      case 'launched': if (has('launched')) return ['launched', f.vy > 0 ? 0 : 1]; break;
      case 'knockdown': if (has('down')) return ['down', f.airborne ? 0 : 1]; break;
      case 'getup': if (has('getup')) return ['getup', Math.min(A.getup.frames.length - 1, Math.floor(f.t / 6))]; break;
      case 'ko': if (has('ko')) return ['ko', f.airborne ? 0 : 1]; break;
      // modo Calle: agarres y aturdido
      case 'grab': if (has('grab')) return f.kneeT > 0 && has('knee') ? ['knee', Math.min(A.knee.frames.length - 1, 3 - Math.ceil(f.kneeT / 4))] : ['grab', 1]; return f.kneeT > 0 && has('sk') ? ['sk', 2] : has('lp') ? ['lp', 1] : null;
      case 'grabbed': case 'dizzy': if (has('hit')) return ['hit', f.state === 'dizzy' ? Math.floor(f.t / 12) % 2 : 1]; break;
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
    // altura en pantalla proporcional a la estatura real (look.height, en metros): 1,78 m → ~194 px en guardia
    const ch = typeof CHARS !== 'undefined' && CHARS.find(c => c.id === id);
    const k = (ch && ch.look.height ? 109 * ch.look.height : 194) / set.meta.height * (opts.scale || 1);
    ctx.save();
    ctx.translate(x, gy); ctx.scale(facing * k, k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    let img = set.img, rx = sx, ry = sy;
    const tinted = opts.tint && tintFrame(set, fr, opts.tint);
    if (tinted) { img = tinted; rx = 0; ry = 0; }
    else if (opts.alt) { img = altImage(set) || set.img; if (img === set.img && 'filter' in ctx) ctx.filter = 'hue-rotate(150deg) saturate(1.2)'; }
    ctx.drawImage(img, rx, ry, sw, sh, -fr.ax, -fr.ay, sw, sh);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.45; ctx.drawImage(img, rx, ry, sw, sh, -fr.ax, -fr.ay, sw, sh); }
    ctx.restore();
    return true;
  }
  // Dibuja un fotograma concreto (enemigos del modo Calle). opts.px = altura en pantalla de la guardia.
  function drawFrame(ctx, id, anim, i, x, gy, facing, opts = {}) {
    const set = sets[id];
    if (!set || !set.meta.anims[anim]) return false;
    const fr = set.meta.anims[anim].frames[i] || set.meta.anims[anim].frames[0];
    const [sx, sy, sw, sh] = fr.r, k = (opts.px || 136) / set.meta.height;
    ctx.save();
    ctx.translate(x, gy); ctx.scale(facing * k, k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    let img = set.img, rx = sx, ry = sy;
    const tinted = opts.tint && tintFrame(set, fr, opts.tint);
    if (tinted) { img = tinted; rx = 0; ry = 0; }
    ctx.drawImage(img, rx, ry, sw, sh, -fr.ax, -fr.ay, sw, sh);
    if (opts.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.45; ctx.drawImage(img, rx, ry, sw, sh, -fr.ax, -fr.ay, sw, sh); }
    ctx.restore();
    return true;
  }
  return { load, draw, drawFrame, has: id => !!sets[id], sets, choose };
})();

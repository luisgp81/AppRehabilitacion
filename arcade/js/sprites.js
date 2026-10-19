'use strict';
// Sprites HD con rig esquelético: malla deformada por huesos (skinning) y render en WebGL.
// Si no hay WebGL o la imagen no carga, el juego usa la marioneta vectorial de render.js.
const RES = 2; // píxeles reales por píxel lógico (el canvas es 1280x720 para una lógica de 640x360)

// Articulaciones en coordenadas del PNG (personaje mirando a la derecha).
// F = brazo/pierna adelantados (hacia el rival), B = atrasados.
const RIGS = {
  luis: {
    // sprite con traje bancario (ficha LUIS-00 generada en Canva)
    k: 0.58, face: [112, 2, 72, 72],
    j: { hip: [145, 175], neck: [145, 72], head: [150, 35], shF: [172, 84], elF: [206, 118], haF: [190, 62], shB: [100, 80], elB: [66, 94], haB: [108, 78], hipF: [165, 180], knF: [214, 226], anF: [200, 300], hipB: [122, 180], knB: [80, 240], anB: [42, 300] },
  },
  jc: {
    k: 0.58, face: [86, 50, 90, 90],
    j: { hip: [116, 225], neck: [130, 118], head: [130, 82], shF: [166, 132], elF: [188, 184], haF: [168, 164], shB: [82, 104], elB: [58, 52], haB: [104, 16], hipF: [150, 232], knF: [176, 268], anF: [182, 334], hipB: [80, 232], knB: [44, 268], anB: [44, 334] },
    // en la imagen levanta el puño: en guardia se baja ese brazo
    guard: { ua_b: [0.3, 1], fa_b: [1, -0.55] },
    winRest: true,
  },
  sebas: {
    k: 0.58, face: [40, 0, 78, 78],
    j: { hip: [80, 142], neck: [80, 58], head: [78, 30], shF: [112, 64], elF: [130, 90], haF: [158, 78], shB: [50, 66], elB: [30, 100], haB: [44, 82], hipF: [104, 148], knF: [130, 210], anF: [156, 254], hipB: [60, 148], knB: [20, 196], anB: [40, 246] },
  },
};
const BONES = [
  // id, desde, hasta, padre, radio de influencia
  ['root', 'hipB', 'hipF', null, 20],
  ['torso', 'hip', 'neck', 'root', 30],
  ['head', 'neck', 'head', 'torso', 24],
  ['ua_f', 'shF', 'elF', 'torso', 11], ['fa_f', 'elF', 'haF', 'ua_f', 11],
  ['ua_b', 'shB', 'elB', 'torso', 11], ['fa_b', 'elB', 'haB', 'ua_b', 11],
  ['th_f', 'hipF', 'knF', 'root', 15], ['sh_f', 'knF', 'anF', 'th_f', 13],
  ['th_b', 'hipB', 'knB', 'root', 15], ['sh_b', 'knB', 'anB', 'th_b', 13],
];

const SpriteRig = (() => {
  let gl = null, cv = null, prog = null, loc = {};
  const rigs = {};
  function initGL() {
    cv = document.createElement('canvas'); cv.width = W * RES; cv.height = H * RES;
    try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    if (!gl) return false;
    const vs = `attribute vec2 p; attribute vec2 uv; uniform vec2 res; varying vec2 v;
      void main(){ v = uv; gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0); }`;
    const fs = `precision mediump float; varying vec2 v; uniform sampler2D tex; uniform float flash; uniform float alt; uniform vec3 glow; uniform float glowA;
      void main(){ vec4 c = texture2D(tex, v);
        vec3 col = c.rgb;
        if (alt > 0.5) col = vec3(col.g * 0.9, col.b * 0.8 + col.r * 0.2, col.r);
        col = mix(col, vec3(c.a), flash);
        col = col + glow * glowA * c.a;
        gl_FragColor = vec4(col, c.a); }`;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    for (const n of ['p', 'uv']) loc[n] = gl.getAttribLocation(prog, n);
    for (const n of ['res', 'tex', 'flash', 'alt', 'glow', 'glowA']) loc[n] = gl.getUniformLocation(prog, n);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
    return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
  }
  // Capas: la base no sigue a los huesos de brazo; cada brazo solo a los suyos
  const LAYERS = [
    { name: '', bones: ['root', 'torso', 'head', 'th_f', 'sh_f', 'th_b', 'sh_b'] },
    { name: '-armF', bones: ['ua_f', 'fa_f'] },
    { name: '-armB', bones: ['ua_b', 'fa_b'] },
  ];
  // orden de dibujo: base, brazo adelantado (lejano), brazo atrasado (cercano a cámara)
  function buildLayer(def, img, allowed) {
    const J = def.j;
    const w = img.width, h = img.height;
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const x2 = c2.getContext('2d'); x2.drawImage(img, 0, 0);
    const alpha = x2.getImageData(0, 0, w, h).data;
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : alpha[(y * w + x) * 4 + 3];
    const step = 5, nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
    const verts = [], uvs = [], wts = [];
    const vid = new Int32Array(nx * ny).fill(-1);
    const allowIdx = BONES.map(([bid], bi) => allowed.includes(bid) ? bi : -1).filter(i => i >= 0);
    const headI = BONES.findIndex(b => b[0] === 'head');
    const getV = (i, jj) => {
      const k = jj * nx + i;
      if (vid[k] >= 0) return vid[k];
      const x = Math.min(w, i * step), y = Math.min(h, jj * step);
      const sc = allowIdx.map(bi => {
        const [bid, a, b, , r] = BONES[bi];
        let B = J[b];
        if (bid[0] === 'f' || bid[0] === 's') { const e = bid[0] === 's' ? 0.6 : 0.5; B = [J[b][0] + (J[b][0] - J[a][0]) * e, J[b][1] + (J[b][1] - J[a][1]) * e]; }
        const rr = bid === 'head' ? r * 0.85 : r;
        return [bi, segDist(x, y, J[a], B) / rr];
      }).sort((p, q) => p[1] - q[1]);
      if (sc.length === 1) { sc.push([sc[0][0], 99]); }
      // pesos casi rígidos: cada píxel sigue a un hueso salvo cerca de la articulación
      const hard = allowed.length <= 2 ? 3.5 : 1.5;
      const w1 = Math.exp(-sc[0][1] * sc[0][1] * hard), w2 = Math.exp(-sc[1][1] * sc[1][1] * hard);
      const p1 = Math.pow(w1, 4) + 1e-9, p2 = Math.pow(w2, 4), s = p1 + p2;
      vid[k] = verts.length / 2;
      verts.push(x, y); uvs.push(x / w, y / h);
      const f = def.face, hr = f[2] * 0.5, hd = Math.hypot(x - (f[0] + f[2] / 2), y - (f[1] + f[3] / 2));
      if (headI >= 0 && allowed.includes('head') && hd < hr * 0.95) wts.push(headI, 1, headI, 0);
      else if (headI >= 0 && allowed.includes('head') && hd < hr * 1.25) { const t = (hd - hr * 0.95) / (hr * 0.3); wts.push(headI, 1 - t, sc[0][0] === headI ? sc[1][0] : sc[0][0], t); }
      else if (allowed.length === 1) wts.push(sc[0][0], 1, sc[0][0], 0); // pieza rígida
      else wts.push(sc[0][0], p1 / s, sc[1][0], p2 / s);
      return vid[k];
    };
    const idx = [];
    for (let jj = 0; jj < ny - 1; jj++) for (let i = 0; i < nx - 1; i++) {
      let any = false;
      for (let y = jj * step; y <= (jj + 1) * step && !any; y += 1) for (let x = i * step; x <= (i + 1) * step; x += 1) if (A(x, y) > 8) { any = true; break; }
      if (!any) continue;
      const a = getV(i, jj), b = getV(i + 1, jj), cc = getV(i + 1, jj + 1), d = getV(i, jj + 1);
      idx.push(a, b, cc, a, cc, d);
    }
    const L = { img, rigidBone: allowed.length === 1 ? BONES.findIndex(b => b[0] === allowed[0]) : undefined, w, h, verts: new Float32Array(verts), wts: new Float32Array(wts), n: verts.length / 2, out: new Float32Array(verts.length), scr: new Float32Array(verts.length) };
    if (gl) {
      L.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      L.vb = gl.createBuffer(); L.ub = gl.createBuffer(); L.ib = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, L.ub); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      L.nIdx = idx.length;
    }
    return L;
  }
  // Divide una capa de brazo en piezas rígidas (una por hueso) clasificando cada píxel
  function splitRigid(def, img, boneIds) {
    const J = def.j, w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const src = x.getImageData(0, 0, w, h);
    const owner = new Int8Array(w * h).fill(-1);
    const segs = boneIds.map(bid => { const b = BONES.find(q => q[0] === bid); return [J[b[1]], J[b[2]]]; });
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx;
      if (src.data[i * 4 + 3] < 8) continue;
      let best = 0, bd = 1e9;
      segs.forEach(([a, b], k) => { const d = segDist(xx, y, a, b); if (d < bd) { bd = d; best = k; } });
      owner[i] = best;
    }
    return boneIds.map((bid, k) => {
      const out = x.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        if (owner[i] < 0) continue;
        // 1 px de solape con la pieza vecina para que no se vea la junta
        let mine = owner[i] === k;
        if (!mine) { const yy = (i / w) | 0, xx = i % w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (yy + dy) * w + xx + dx; if (j >= 0 && j < w * h && owner[j] === k) { mine = true; break; } } }
        if (mine) for (let q = 0; q < 4; q++) out.data[i * 4 + q] = src.data[i * 4 + q];
      }
      const pc = document.createElement('canvas'); pc.width = w; pc.height = h; pc.getContext('2d').putImageData(out, 0, 0);
      return { img: pc, bones: [bid] };
    });
  }
  function build(id, imgs) {
    const def = RIGS[id], J = def.j;
    const parts = [];
    LAYERS.forEach((ly, i) => {
      if (!imgs[i]) return;
      if (imgs.length === 1) parts.push({ img: imgs[i], bones: BONES.map(b => b[0]) });
      else if (i === 0) parts.push({ img: imgs[i], bones: ly.bones });
      else parts.push(...splitRigid(def, imgs[i], ly.bones));
    });
    const layers = parts.map(p => buildLayer(def, p.img, p.bones));
    const r = { id, def, img: imgs[0], w: imgs[0].width, h: imgs[0].height, layers };
    r.rest = BONES.map(([bid, a, b]) => Math.atan2(J[b][1] - J[a][1], J[b][0] - J[a][0]));
    r.guardDelta = BONES.map(([bid], bi) => {
      const g = def.guard && def.guard[bid];
      return g ? Math.atan2(g[1], g[0]) - r.rest[bi] : 0;
    });
    r.ready = true;
    rigs[id] = r;
  }

  // Ángulos de la marioneta → rotaciones de hueso (deltas respecto a la guardia)
  function boneAngles(r, pose, useRest) {
    const g = POSES.guard, p = pose;
    const rot = 0;
    const legK = 0.85, armK = 1.0;
    const d = {
      root: (p.lean - g.lean) * 0.4,
      torso: (p.lean - g.lean),
      head: (p.lean - g.lean) * 1.0 + p.head * 0.8,
      ua_f: rot - (p.b1 - g.b1) * armK, fa_f: rot - ((p.b1 + p.b2) - (g.b1 + g.b2)) * armK,
      ua_b: rot - (p.a1 - g.a1) * armK, fa_b: rot - ((p.a1 + p.a2) - (g.a1 + g.a2)) * armK,
      th_f: rot - (p.m1 - g.m1) * legK, sh_f: rot - ((p.m1 + p.m2) - (g.m1 + g.m2)) * legK,
      th_b: rot - (p.l1 - g.l1) * legK, sh_b: rot - ((p.l1 + p.l2) - (g.l1 + g.l2)) * legK,
    };
    // Brazos: si la pose se aleja de la guardia, se tiende a la dirección absoluta del golpe
    // (el reposo del dibujo no coincide con la guardia de la marioneta)
    const abs = { ua_f: p.b1, fa_f: p.b1 + p.b2, ua_b: p.a1, fa_b: p.a1 + p.a2 };
    const gab = { ua_f: g.b1, fa_f: g.b1 + g.b2, ua_b: g.a1, fa_b: g.a1 + g.a2 };
    // Tumbado / por los aires: el cuerpo gira entero (rígido) en vez de deformarse
    const rg = p.rigid || 0, rw = Math.min(1, Math.abs(rg) / 0.6);
    return BONES.map(([bid], bi) => {
      if (rw > 0) {
        const base = r.guardDelta[bi] + rg + (bid.startsWith('ua') || bid.startsWith('fa') ? Math.sin(bi * 1.7) * 0.4 * rw : 0);
        const norm = d[bid] + r.guardDelta[bi];
        return norm + angDiff(base, norm) * rw;
      }
      let a = d[bid] + (useRest ? 0 : r.guardDelta[bi]);
      if (!useRest && abs[bid] !== undefined) {
        const w = Math.min(1, Math.abs(abs[bid] - gab[bid]) / 0.9);
        if (w > 0) {
          const target = Math.PI / 2 - abs[bid] - r.rest[bi]; // rotación que deja el hueso en la dirección absoluta
          a += angDiff(target, a) * w;
        }
      }
      return a;
    });
  }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function skin(r, pose, useRest) {
    const J = r.def.j, ang = boneAngles(r, pose, useRest);
    const T = new Array(BONES.length);
    BONES.forEach(([bid, a, , parent], bi) => {
      const o = J[a];
      let ox = o[0], oy = o[1];
      if (parent) {
        const pt = T[BONES.findIndex(b => b[0] === parent)];
        const dx = o[0] - pt.ox, dy = o[1] - pt.oy;
        ox = pt.nx + pt.c * dx - pt.s * dy; oy = pt.ny + pt.s * dx + pt.c * dy;
      }
      T[bi] = { ox: o[0], oy: o[1], nx: ox, ny: oy, c: Math.cos(ang[bi]), s: Math.sin(ang[bi]) };
    });
    let maxY = -1e9;
    for (const L of r.layers) {
      const v = L.verts, wt = L.wts, out = L.out;
      for (let i = 0; i < L.n; i++) {
        const x = v[i * 2], y = v[i * 2 + 1];
        let X = 0, Y = 0;
        for (let k = 0; k < 2; k++) {
          const t = T[wt[i * 4 + k * 2]], ww = wt[i * 4 + k * 2 + 1];
          if (!ww) continue;
          const dx = x - t.ox, dy = y - t.oy;
          X += ww * (t.nx + t.c * dx - t.s * dy); Y += ww * (t.ny + t.s * dx + t.c * dy);
        }
        out[i * 2] = X; out[i * 2 + 1] = Y;
        if (L === r.layers[0] && Y > maxY) maxY = Y;
      }
    }
    return maxY;
  }

  // Respaldo sin WebGL: cada capa se dibuja como pieza rígida con transformaciones 2D
  let mode = 'gl';
  function draw2d(ctx, r, x, gy, pose, facing, opts) {
    const ang = boneAngles(r, pose, opts.rest || false);
    const J = r.def.j, k = r.def.k * (opts.scale || 1);
    const T = [];
    BONES.forEach(([bid, a, , parent], bi) => {
      const o = J[a]; let nx = o[0], ny = o[1];
      if (parent) { const pt = T[BONES.findIndex(b => b[0] === parent)]; const dx = o[0] - pt.ox, dy = o[1] - pt.oy; nx = pt.nx + pt.c * dx - pt.s * dy; ny = pt.ny + pt.s * dx + pt.c * dy; }
      T[bi] = { ox: o[0], oy: o[1], nx, ny, c: Math.cos(ang[bi]), s: Math.sin(ang[bi]) };
    });
    const root = T[BONES.findIndex(b => b[0] === 'torso')];
    ctx.save();
    ctx.translate(x, gy); ctx.scale(facing * k, k); ctx.translate(-J.hip[0], -r.h);
    if (opts.flash) ctx.globalAlpha *= 0.85;
    r.layers.forEach((L, li) => {
      const bi = L.rigidBone !== undefined ? L.rigidBone : BONES.findIndex(b => b[0] === 'torso');
      const kk = Math.abs(pose.rigid || 0) > 0.3 ? 1 : 0.5;
      const t = li === 0 ? { ...root, c: Math.cos(ang[bi] * kk), s: Math.sin(ang[bi] * kk) } : T[bi];
      ctx.save();
      ctx.transform(t.c, t.s, -t.s, t.c, t.nx - (t.c * t.ox - t.s * t.oy), t.ny - (t.s * t.ox + t.c * t.oy));
      ctx.drawImage(L.img, 0, 0);
      ctx.restore();
    });
    ctx.restore();
    return true;
  }
  function draw(ctx, id, x, gy, pose, facing, opts = {}) {
    const r = rigs[id];
    if (!r) return false;
    if (!gl || mode === '2d') return draw2d(ctx, r, x, gy, pose, facing, opts);
    const useRest = opts.rest || false;
    const bottom = skin(r, pose, useRest);
    const k = r.def.k * (opts.scale || 1), J = r.def.j;
    const ax = J.hip[0];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const L of r.layers) {
      const out = L.out, scr = L.scr;
      for (let i = 0; i < L.n; i++) {
        const X = x + facing * (out[i * 2] - ax) * k, Y = gy + (out[i * 2 + 1] - bottom) * k;
        scr[i * 2] = X; scr[i * 2 + 1] = Y;
        if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
    }
    minX = Math.floor(minX) - 2; minY = Math.floor(minY) - 2;
    const bw = Math.min(W, Math.ceil(maxX - minX) + 4), bh = Math.min(H, Math.ceil(maxY - minY) + 4);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, cv.height - bh * RES, bw * RES, bh * RES);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform2f(loc.res, cv.width, cv.height);
    gl.uniform1f(loc.flash, opts.flash ? 0.32 : 0);
    gl.uniform1f(loc.alt, opts.alt ? 1 : 0);
    const gc = opts.glow ? hexRGB(opts.glow) : [0, 0, 0];
    gl.uniform3f(loc.glow, gc[0], gc[1], gc[2]); gl.uniform1f(loc.glowA, opts.glow ? 0.18 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(loc.tex, 0);
    for (const L of r.layers) {
      const scr = L.scr;
      for (let i = 0; i < L.n; i++) { scr[i * 2] = (scr[i * 2] - minX) * RES; scr[i * 2 + 1] = (scr[i * 2 + 1] - minY) * RES; }
      gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.vb); gl.bufferData(gl.ARRAY_BUFFER, scr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.ub);
      gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.ib);
      gl.drawElements(gl.TRIANGLES, L.nIdx, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.SCISSOR_TEST);
    ctx.drawImage(cv, 0, 0, bw * RES, bh * RES, minX, minY, bw, bh);
    return true;
  }
  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

  // Retrato: recorte de la cara del PNG
  function face(ctx, id, cx, cy, size, facing) {
    const r = rigs[id];
    if (!r) return false;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(facing, 1);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (r.faceImg) ctx.drawImage(r.faceImg, -size / 2, -size / 2, size, size);
    else { const [fx, fy, fw, fh] = r.def.face; ctx.drawImage(r.img, fx, fy, fw, fh, -size / 2, -size / 2, size, size); }
    ctx.restore();
    return true;
  }

  function load(onDone) {
    const ok = initGL();
    const ids = Object.keys(RIGS);
    let left = ids.length;
    const src = key => (window.SPRITE_DATA && SPRITE_DATA[key]) || `assets/sprites/${key}.png`;
    const loadImg = key => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src(key); });
    for (const id of ids) {
      Promise.all([loadImg(id), loadImg(id + '-armF'), loadImg(id + '-armB'), loadImg(id + '-face')]).then(([b, f, bk, face]) => {
        try {
          if (b) { build(id, f && bk ? [b, f, bk] : [b]); if (face) rigs[id].faceImg = face; if (!gl) mode = '2d'; }
        } catch (e) { console.warn('sprite', id, e); }
        if (--left === 0 && onDone) onDone(ok);
      });
    }
  }
  // Si el render WebGL resulta lento en este dispositivo, se pasa al modo 2D
  let slowN = 0, slowT = 0;
  function sample(ms) { if (mode !== 'gl') return; slowT += ms; if (++slowN === 90) { if (slowT / slowN > 6) mode = '2d'; slowN = 0; slowT = 0; } }
  return { load, draw, face, sample, has: id => !!(rigs[id] && rigs[id].ready), rigs, get gl() { return gl; }, get mode() { return mode; }, set mode(m) { mode = m; } };
})();

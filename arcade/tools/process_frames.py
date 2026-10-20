#!/usr/bin/env python3
"""Convierte las tiras generadas (assets/raw/<id>/<anim>.png) en un atlas de fotogramas para el juego.

- quita el fondo verde croma (con margen y eliminación del halo verde); si la imagen no tiene fondo croma limpio,
  usa BiRefNet (rembg) si está instalado
- separa los fotogramas por columnas vacías (o reparto uniforme si no coinciden con los esperados)
- normaliza la escala de cada animación respecto a la altura de 'idle' y alinea pies / centro del torso
- empaqueta todo en assets/frames/<id>/atlas.png + atlas.json

Uso: python3 process_frames.py [--char luis] [--height 320]
"""
import argparse, json, os, pathlib, sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gen_sprites import ANIMS, ROOT, RAW  # noqa: E402

OUT = pathlib.Path(os.environ.get('FRAMES_OUT', ROOT / 'assets' / 'frames'))
JS_OUT = pathlib.Path(os.environ.get('FRAMES_JS', ROOT / 'js' / 'frame-index.js'))
# altura típica de cada animación respecto a 'idle' (mediana de la tira)
HREL = {'crouch': 0.72, 'cp': 0.72, 'ck': 0.62, 'hit_crouch': 0.72, 'block_crouch': 0.72, 'jump': 0.85, 'jp': 0.8, 'jk': 0.8,
        'launched': 0.8, 'down': 0.45, 'ko': 0.45, 'getup': 0.75, 'dash': 0.9, 'sk': 1.0, 'dp': 1.1}
# fotograma "activo" (el que golpea) de cada ataque
ACTIVE = {'lp': [1], 'sk': [1, 2], 'cp': [1], 'ck': [1, 2], 'jp': [1], 'jk': [1], 'proj': [2], 'dp': [1, 2], 'rush': [1, 2], 'super': [2, 3], 'combo': [1], 'super2': [1, 2, 3], 'ultra': [2, 3, 4]}
# hojas de ChatGPT (chatgpt_sheets.py): en los aéreos de 4 fotogramas el golpe estirado son el 2º y 3º
ACTIVE_SHEET = {('jp', 4): [1, 2], ('jk', 4): [1, 2]}
LOOP = {'idle': 8, 'walk_f': 10, 'walk_b': 10, 'win': 7, 'intro': 7}


def remove_bg(im):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)
    border = np.concatenate([greenness[0], greenness[-1], greenness[:, 0], greenness[:, -1]])
    if np.median(border) > 80:  # fondo croma verde
        alpha = np.clip((140 - greenness) * 255 // 90, 0, 255).astype(np.uint8)
        alpha[greenness < 50] = 255
        rgb = a.copy()
        spill = greenness > 0
        rgb[..., 1] = np.where(spill, np.maximum(r, b), g)  # quitar halo verde
        out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
        return Image.fromarray(out, 'RGBA')
    try:
        from rembg import new_session, remove
        return remove(im, session=new_session('birefnet-general'))
    except Exception:
        sys.exit('Fondo no croma y rembg no disponible: instala "rembg[cpu]"')


def split_blobs(img, n):
    """Recorta cada figura por manchas conectadas: el cuerpo de cada fotograma más sus trozos sueltos (puños, cintas)
    cercanos. Evita que se cuelen piezas del vecino cuando las figuras se solapan en columnas. None si no cuadra."""
    a = ndimage.binary_opening(np.asarray(img)[..., 3] > 40, iterations=1)
    lab, k = ndimage.label(a, structure=np.ones((3, 3)))
    if k < n: return None
    area = ndimage.sum(np.ones_like(lab), lab, range(1, k + 1))
    order = np.argsort(-area)
    main = order[:n]
    if area[main[-1]] < 0.2 * area[main[0]] or (k > n and area[order[n]] > 0.5 * area[main[-1]]): return None
    boxes = ndimage.find_objects(lab)
    main = sorted(main, key=lambda i: boxes[i][1].start + boxes[i][1].stop)
    H = max(boxes[i][0].stop - boxes[i][0].start for i in main)
    owner = {i: j for j, i in enumerate(main)}
    for i in order[n:]:
        if area[i] < 30: continue
        ys, xs = boxes[i]
        def dist(m):
            my, mx = boxes[m]
            dx = max(0, mx.start - xs.stop, xs.start - mx.stop); dy = max(0, my.start - ys.stop, ys.start - my.stop)
            return dx + dy
        m = min(main, key=dist)
        if ys.stop <= boxes[m][0].start + 2: continue  # por encima de la cabeza: es de la fila de arriba
        if dist(m) < 0.12 * H: owner[i] = owner[m]
    src = np.asarray(img)
    frames = []
    for j in range(n):
        keep = np.isin(lab, [i + 1 for i, o in owner.items() if o == j]) & a
        out = src.copy(); out[..., 3] = np.where(keep, src[..., 3], 0)
        fr = Image.fromarray(out, 'RGBA'); frames.append(fr.crop(fr.getbbox()))
    return frames


def seam(cost, lo, hi):
    """Camino vertical de coste mínimo (se desvía ±1 px por fila) entre las columnas lo..hi: corta entre figuras
    que se tocan rodeando los brazos y piernas en vez de atravesarlos."""
    c = cost[:, lo:hi].astype(np.float64)
    acc = c.copy(); back = np.zeros(c.shape, np.int8)
    for y in range(1, len(c)):
        prev = acc[y - 1]
        opts = np.stack([np.r_[np.inf, prev[:-1]], prev, np.r_[prev[1:], np.inf]])
        k = opts.argmin(0); acc[y] += opts[k, np.arange(len(prev))]; back[y] = k - 1
    x = int(acc[-1].argmin()); path = [0] * len(c)
    for y in range(len(c) - 1, -1, -1):
        path[y] = x + lo; x += int(back[y, x])
    return path


def clean(fr):
    """Quita restos del vecino: conserva la figura principal y los trozos sueltos pegados a ella."""
    a = np.asarray(fr)[..., 3] > 40
    lab, k = ndimage.label(a, structure=np.ones((3, 3)))
    if k <= 1: return fr
    area = ndimage.sum(a, lab, range(1, k + 1)); boxes = ndimage.find_objects(lab)
    m = int(area.argmax()); my, mx = boxes[m]; H = my.stop - my.start
    keep = [m + 1]
    for i, (ys, xs) in enumerate(boxes):
        if i == m or area[i] < 30 or ys.stop <= my.start + 2: continue  # por encima de la cabeza: fila de arriba
        gap = max(0, mx.start - xs.stop, xs.start - mx.stop) + max(0, my.start - ys.stop, ys.start - my.stop)
        if gap < 0.06 * H and area[i] > 0.002 * area[m]: keep.append(i + 1)
    out = np.asarray(fr).copy(); out[..., 3] = np.where(np.isin(lab, keep), out[..., 3], 0)
    im = Image.fromarray(out, 'RGBA'); return im.crop(im.getbbox())


def split_seams(img, n):
    a = np.asarray(img)[..., 3] > 40
    xs = np.nonzero(a.sum(0))[0]; x0, x1 = xs[0], xs[-1] + 1; w = (x1 - x0) / n
    cost = a.astype(np.float64) * 50 + 1
    cuts = [[x0] * a.shape[0]]
    for i in range(1, n):
        e = x0 + i * w
        cuts.append(seam(cost, max(cuts[-1][0] + 1, int(e - 0.4 * w)), min(a.shape[1], int(e + 0.4 * w))))
    cuts.append([x1] * a.shape[0])
    src = np.asarray(img); cols = np.arange(a.shape[1])[None, :]
    frames = []
    for l, r in zip(cuts, cuts[1:]):
        m = (cols >= np.array(l)[:, None]) & (cols < np.array(r)[:, None])
        out = src.copy(); out[..., 3] = np.where(m, src[..., 3], 0)
        fr = Image.fromarray(out, 'RGBA'); frames.append(clean(fr.crop(fr.getbbox())))
    return frames


def split(img, n):
    return split_blobs(img, n) or split_seams(img, n)


def anchor(fr):
    a = np.asarray(fr)[..., 3] > 40
    h = a.shape[0]
    band = a[int(h * 0.25):int(h * 0.55)]
    xs = np.nonzero(band)[1]
    cx = float(np.median(xs)) if len(xs) else fr.width / 2
    return cx, float(h)


def pack(frames, maxw=2048):
    x = y = rowh = 0; rects = []
    for f in frames:
        if x + f.width > maxw: x, y, rowh = 0, y + rowh + 2, 0
        rects.append((x, y, f.width, f.height)); x += f.width + 2; rowh = max(rowh, f.height)
    atlas = Image.new('RGBA', (maxw, y + rowh), (0, 0, 0, 0))
    for f, (x0, y0, _, _) in zip(frames, rects): atlas.paste(f, (x0, y0))
    return atlas, rects


def process(cid, H):
    src = RAW / cid
    per = {}
    # hojas de ChatGPT: nº de fotogramas por fila (chatgpt_sheets.py import)
    counts = json.loads((src / 'counts.json').read_text()) if (src / 'counts.json').exists() else {}
    nframes = {}
    for an, (n, _) in ANIMS.items():
        p = src / f'{an}.png'
        nframes[an] = counts.get(an, n)
        if p.exists():
            per[an] = split(remove_bg(Image.open(p)), nframes[an])
    if 'idle' not in per and 'intro' in per:
        per['idle'] = per['intro']  # falta la hoja H01: la intro (pose de guardia) hace de guardia provisional
    if 'idle' not in per and (src / 'sheet.png').exists():
        per['idle'] = split(remove_bg(Image.open(src / 'sheet.png')), 1)  # entrega parcial: la ficha hace de guardia
    if 'idle' not in per:
        print(f'{cid}: faltan raw/{cid}/idle.png y sheet.png, se omite'); return False
    idleH = np.median([f.height for f in per['idle']])
    allf, meta = [], {}
    for an, frs in per.items():
        target = H * HREL.get(an, 1.0)
        s = target / max(1, np.median([f.height for f in frs]))
        if an == 'idle': s = H / idleH
        out = []
        for f in frs:
            f2 = f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS)
            cx, bottom = anchor(f2)
            out.append({'i': len(allf), 'ax': round(cx, 1), 'ay': round(bottom, 1)})
            allf.append(f2)
        act = ACTIVE_SHEET.get((an, len(out))) or ACTIVE.get(an)
        if (an, len(out)) not in ACTIVE_SHEET and act and nframes.get(an, ANIMS[an][0]) != ANIMS[an][0]:  # reescalar el fotograma de impacto
            k = (len(out) - 1) / max(1, ANIMS[an][0] - 1)
            act = sorted({min(len(out) - 1, round(i * k)) for i in act})
        meta[an] = {'frames': out, 'fps': LOOP.get(an), 'active': act}
    atlas, rects = pack(allf)
    d = OUT / cid; d.mkdir(parents=True, exist_ok=True)
    atlas.save(d / 'atlas.png', optimize=True)
    for an in meta:
        for fr in meta[an]['frames']:
            fr['r'] = rects[fr.pop('i')]
    (d / 'atlas.json').write_text(json.dumps({'height': H, 'anims': meta}, separators=(',', ':')))
    print(f'{cid}: {len(allf)} fotogramas en {len(meta)} animaciones → {d / "atlas.png"} ({atlas.size[0]}x{atlas.size[1]})')
    return True


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--char', default='all'); ap.add_argument('--height', type=int, default=320)
    a = ap.parse_args()
    ids = ['luis', 'jc', 'sebas'] if a.char == 'all' else a.char.split(',')
    for cid in ids: process(cid, a.height)
    # índice para el juego
    idx = [cid for cid in ['luis', 'jc', 'sebas'] if (OUT / cid / 'atlas.json').exists()]
    (OUT / 'index.json').write_text(json.dumps(idx))
    js = 'window.FRAME_INDEX = ' + json.dumps({cid: json.loads((OUT / cid / 'atlas.json').read_text()) for cid in idx}) + ';\n'
    JS_OUT.write_text('// Generado por tools/process_frames.py — no editar\n' + js)

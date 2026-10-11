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
ACTIVE = {'lp': [1], 'sk': [1, 2], 'cp': [1], 'ck': [1, 2], 'jp': [1], 'jk': [1], 'proj': [2], 'dp': [1, 2], 'rush': [1, 2], 'super': [2, 3]}
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


def split(img, n):
    a = np.asarray(img)[..., 3] > 40
    a = ndimage.binary_opening(a, iterations=1)
    cols = a.sum(0) > 0
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]: x += 1
            runs.append((s, x))
        x += 1
    # unir trozos cercanos (cintas, pelo) hasta quedarse con n bloques
    gap = lambda i: runs[i + 1][0] - runs[i][1]
    while len(runs) > n:
        i = min(range(len(runs) - 1), key=gap)
        runs[i:i + 2] = [(runs[i][0], runs[i + 1][1])]
    if len(runs) != n:  # no se distinguen: reparto uniforme
        w = img.width / n
        runs = [(int(i * w), int((i + 1) * w)) for i in range(n)]
    frames = []
    for s, e in runs:
        c = img.crop((s, 0, e, img.height))
        bb = c.getbbox()
        if bb: frames.append(c.crop(bb))
    return frames


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
    for an, (n, _) in ANIMS.items():
        p = src / f'{an}.png'
        if p.exists(): per[an] = split(remove_bg(Image.open(p)), n)
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
        meta[an] = {'frames': out, 'fps': LOOP.get(an), 'active': ACTIVE.get(an)}
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

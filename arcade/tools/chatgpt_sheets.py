#!/usr/bin/env python3
"""Hojas de sprites para generar en ChatGPT (o cualquier chat de imágenes): 10 hojas por personaje,
3 filas por hoja, una animación por fila. Total: 162 fotogramas por personaje.

  python3 chatgpt_sheets.py prompts            → JSON con los prompts (lo usa el Taller de Sprites)
  python3 chatgpt_sheets.py import LUIS-H03 hoja.png [JC-H01 otra.png ...]
      → corta cada fila y la deja como tira en assets/raw/<id>/<anim>.png; después: process_frames.py
"""
import json, pathlib, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from gen_sprites import CHARS, SPECIALS, RAW  # noqa: E402

# (animación, fotogramas, qué debe verse)
SHEETS = [
    [('idle', 8, 'fighting stance idle, subtle breathing, seamless loop'), ('walk_f', 8, 'walking forward in guard, legs alternating, seamless loop'), ('walk_b', 8, 'walking backward in guard, cautious, seamless loop')],
    [('crouch', 4, 'going down into a crouch and holding the crouched guard'), ('jump', 6, 'vertical jump: takeoff, rising tucked, apex tucked ball, falling, landing'), ('dash', 4, 'fast forward dash, low lunge')],
    [('lp', 5, 'standing jab punch: wind-up, arm fully extended at head height, recovery'), ('sk', 6, 'standing roundhouse kick: knee up, leg fully extended at chest height, recovery'), ('cp', 5, 'crouching punch: crouched wind-up, arm fully extended low, recovery')],
    [('ck', 6, 'crouching sweep kick: leg fully extended at floor level, follow-through, recovery'), ('jp', 4, 'mid-air diagonal downward punch'), ('jk', 4, 'mid-air flying kick, leg extended diagonally down-forward')],
    [('proj', 6, 'projectile special move: hands back at hip, charge, both hands thrust forward fully extended, recovery'), ('dp', 6, 'rising uppercut special move: crouch, jump up with fist raised, peak with arm straight up, falling'), ('rush', 6, 'charging rush special move: lean, lunge, attack extended, recovery')],
    [('super', 8, 'SUPER move: power-up, dramatic wind-up, massive two-handed forward strike, hold, recovery'), ('super2', 8, 'second SUPER, multi-hit rush: explosive start, flurry of strikes, final pose'), ('combo', 5, 'combo finisher: twisting wind-up, devastating launching blow upward-forward, follow-through')],
    [('ultra', 8, 'ULTIMATE FINISHING MOVE, the most spectacular sequence: dramatic charge, leap in, barrage, spinning strike, massive final blow, victorious end pose'), ('hit', 4, 'getting hit while standing: head snapped back, recoil'), ('hit_crouch', 3, 'getting hit while crouching: flinch, recoil')],
    [('block', 3, 'standing block with arms crossed in front of the face'), ('block_crouch', 3, 'crouching block with arms crossed low'), ('launched', 4, 'knocked into the air: arched back, spinning helplessly')],
    [('down', 4, 'knocked down: falling and lying on the back on the floor'), ('getup', 5, 'getting up from the floor: sitting up, kneeling, standing'), ('ko', 5, 'knocked out: collapsing and lying defeated')],
    [('win', 8, 'victory celebration loop, fist raised, big smile'), ('intro', 8, 'pre-fight intro taunt with signature attitude, loop')],
]
EXTRA = {an: txt for cid in SPECIALS for an, txt in SPECIALS[cid].items()}

STYLE = ("Late-90s arcade fighting game sprite sheet (Neo Geo / CPS-2 quality pixel art), exactly the same character, outfit, face, "
         "colours, outline weight and shading as the attached character sprite. Every frame: full body, side view, facing RIGHT, same scale. "
         "Plain flat pure green #00FF00 background everywhere. Clear empty green space between frames and between rows. "
         "No text, no labels, no numbers, no grid lines, no shadows, no ground, no effects or projectiles.")


def prompts():
    out = {}
    for cid, c in CHARS.items():
        items = []
        for i, rows in enumerate(SHEETS, 1):
            spec = ' '.join(f"Row {r + 1}: {n} frames, left to right, {what}{('; ' + SPECIALS[cid][an]) if an in SPECIALS[cid] else ''}."
                            for r, (an, n, what) in enumerate(rows))
            prompt = (f"Create ONE sprite sheet image of {c['desc']} The sheet has exactly {len(rows)} horizontal rows; each row is one animation "
                      f"with its frames evenly spaced and the feet of all frames of a row on the same baseline. {spec} {STYLE}")
            items.append({'code': f"{cid.upper()}-H{i:02d}", 'rows': [[an, n] for an, n, _ in rows], 'frames': sum(n for _, n, _ in rows), 'prompt': prompt})
        out[cid] = items
    return out


def split_rows(img, nrows):
    """Corta la hoja en filas por las franjas horizontales vacías (o en partes iguales si no se distinguen)."""
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    green = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 80
    filled = ndimage.binary_opening(~green, iterations=2).sum(1) > img.width * 0.004
    runs, y = [], 0
    while y < len(filled):
        if filled[y]:
            s = y
            while y < len(filled) and filled[y]: y += 1
            runs.append([s, y])
        y += 1
    while len(runs) > nrows:  # unir huecos pequeños (cintas, pelo) hasta tener las filas esperadas
        i = min(range(len(runs) - 1), key=lambda k: runs[k + 1][0] - runs[k][1])
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) != nrows:
        h = img.height / nrows
        runs = [[int(r * h), int((r + 1) * h)] for r in range(nrows)]
    pad = 6
    return [img.crop((0, max(0, s - pad), img.width, min(img.height, e + pad))) for s, e in runs]


def do_import(args):
    table = {it['code']: (cid, it['rows']) for cid, items in prompts().items() for it in items}
    if len(args) % 2: sys.exit(__doc__)
    for code, src in zip(args[::2], args[1::2]):
        code = code.upper()
        if code not in table: sys.exit(f'Código desconocido: {code}')
        cid, rows = table[code]
        img = Image.open(src).convert('RGB')
        d = RAW / cid; d.mkdir(parents=True, exist_ok=True)
        counts_f = d / 'counts.json'
        counts = json.loads(counts_f.read_text()) if counts_f.exists() else {}
        for (an, n), strip in zip(rows, split_rows(img, len(rows))):
            strip.save(d / f'{an}.png'); counts[an] = n
            print(f'{code} fila → {cid}/{an}.png ({n} fotogramas)')
        counts_f.write_text(json.dumps(counts))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'prompts': json.dump(prompts(), sys.stdout, ensure_ascii=False)
    elif len(sys.argv) > 1 and sys.argv[1] == 'import': do_import(sys.argv[2:])
    else: sys.exit(__doc__)

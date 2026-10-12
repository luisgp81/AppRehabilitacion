#!/usr/bin/env python3
"""Exporta los prompts para generar los sprites a mano en un chat gratuito (ChatGPT, Gemini, Copilot)."""
import json, sys
from gen_sprites import CHARS, ANIMS, SPECIALS, STYLE

PHASE = {
    1: ['sheet', 'idle', 'walk_f', 'lp', 'sk', 'crouch', 'jump', 'hit', 'block'],
    2: ['proj', 'dp', 'rush', 'super', 'super2', 'ultra', 'combo', 'cp', 'ck', 'down', 'ko', 'win'],
    3: ['walk_b', 'dash', 'jp', 'jk', 'hit_crouch', 'block_crouch', 'launched', 'getup', 'intro'],
}
NAMES = {'sheet': 'Ficha del personaje', 'idle': 'Guardia (respirando)', 'walk_f': 'Andar adelante', 'walk_b': 'Andar atrás', 'crouch': 'Agacharse',
         'jump': 'Salto', 'dash': 'Dash', 'lp': 'Puñetazo', 'sk': 'Patada', 'cp': 'Puñetazo agachado', 'ck': 'Barrido', 'jp': 'Puñetazo aéreo',
         'jk': 'Patada aérea', 'proj': 'Especial: proyectil', 'dp': 'Especial: antiaéreo', 'rush': 'Especial: embestida', 'super': 'Super 1', 'super2': 'Super 2', 'ultra': 'GOLPE FINAL', 'combo': 'Remate de combo',
         'hit': 'Recibe golpe', 'hit_crouch': 'Recibe golpe agachado', 'block': 'Bloqueo', 'block_crouch': 'Bloqueo agachado',
         'launched': 'Sale volando', 'down': 'Derribado', 'getup': 'Levantarse', 'ko': 'K.O.', 'win': 'Victoria', 'intro': 'Presentación'}
CHAT = (" Output one single image. Image size: wide landscape. Do not add any text, labels, numbers or watermark.")
out = {}
for cid, c in CHARS.items():
    items = []
    n_order = 0
    for ph, anims in PHASE.items():
        for an in anims:
            if an == 'sheet':
                prompt = (f"Using the attached image as the character reference, create a single full-body character sprite of {c['desc']} "
                          f"Pose: fighting guard stance ({c['style']}). {STYLE} Output one single image, portrait. No text.")
                n = 1
            else:
                n, what = ANIMS[an]
                prompt = (f"Now, using the character sprite you just made (same character, same outfit, same face, same pixel-art style and scale), "
                          f"create a sprite sheet with exactly {n} animation frames in ONE horizontal row, left to right, evenly spaced with clear empty green space "
                          f"between frames, feet on the same baseline. Animation: {what}. {SPECIALS[cid].get(an, '')} {STYLE}{CHAT}")
            code = f"{cid.upper()}-{n_order:02d}"
            items.append({'code': code, 'anim': an, 'name': NAMES[an], 'frames': n, 'phase': ph, 'prompt': ' '.join(prompt.split())})
            n_order += 1
    out[cid] = items
json.dump(out, sys.stdout, ensure_ascii=False)

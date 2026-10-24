#!/usr/bin/env python3
"""Importa imágenes generadas a mano (ChatGPT, Gemini, Copilot) por su código del Taller de Sprites.
Uso: python3 import_frames.py LUIS-03 imagen.png [JC-00 otra.png ...]   y después process_frames.py
"""
import json, pathlib, shutil, subprocess, sys
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from gen_sprites import RAW  # noqa: E402
pack = json.loads(subprocess.check_output([sys.executable, str(HERE / 'make_prompt_pack.py')]))
codes = {it['code']: (cid, it['anim']) for cid, items in pack.items() for it in items}
args = sys.argv[1:]
if len(args) % 2: sys.exit(__doc__)
for code, src in zip(args[::2], args[1::2]):
    code = code.upper()
    if code not in codes: sys.exit(f'Código desconocido: {code}')
    cid, anim = codes[code]
    dst = RAW / cid / f'{anim}.png'; dst.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert('RGB').save(dst)
    print(f'{code} → {dst.relative_to(RAW.parent.parent)}')

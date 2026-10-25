# Empaqueta los PNG de assets/sprites en js/sprite-data.js (data URIs) para que el juego
# funcione también abriendo index.html con file:// (WebGL no acepta imágenes de file:// cruzado).
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
data = {p.stem: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((root / 'assets/sprites').glob('*.png'))}
(root / 'js/sprite-data.js').write_text('// Generado por tools/build_sprite_data.py — no editar\nwindow.SPRITE_DATA = ' + json.dumps(data) + ';\n')
print('sprites:', ', '.join(data), f'({sum(len(v) for v in data.values()) // 1024} KB)')

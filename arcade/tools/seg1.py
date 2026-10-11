from rembg import new_session, remove
from PIL import Image
import sys
# uso: python3 seg1.py <id> x0 y0 x1 y1 <referencia.png>  → <id>.png sin fondo (BiRefNet vía rembg)
k, b = sys.argv[1], tuple(map(int, sys.argv[2:6]))
src = Image.open(sys.argv[6]).convert('RGB')
out = remove(src.crop(b), session=new_session('birefnet-general'))
out.save(f'{k}.png')
bg = Image.new('RGBA', out.size, (0, 255, 0, 255)); bg.alpha_composite(out); bg.convert('RGB').save(f'{k}-view.png')

from PIL import Image, ImageDraw
import numpy as np, colorsys
from scipy import ndimage

def keep_main(a):
    lab, n = ndimage.label(a[..., 3] > 0)
    if n == 0: return a
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    main = lab == 1 + int(np.argmax(sizes))
    a[~main, 3] = 0
    return a

# JC: cortar vecinos
a = np.array(Image.open('jc-clean.png'))
H, Wd = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:Wd]
cut = ((xx < 64) & (yy > 455)) | ((xx < 72) & (yy > 630)) | ((xx > 372) & (yy > 470) & (yy < 625)) | ((xx > 428) & (yy >= 625))
a[cut, 3] = 0
Image.fromarray(keep_main(a)).save('jc-fix.png')

# Luis: fragmento oscuro junto a la zapatilla derecha + recolor del kimono a azul marino
a = np.array(Image.open('luis-clean.png')).astype(np.int32)
H, Wd = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:Wd]
lum = a[..., :3].mean(-1)
a[(xx > 328) & (xx < 378) & (yy > 550) & (lum < 70), 3] = 0
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
sat = (mx - mn) / np.maximum(mx, 1)
gi = (sat < 0.22) & (mx > 120) & (yy > 95) & ~((yy > 530) & (xx < 140)) & ~((yy > 540) & (xx > 330)) & (a[..., 3] > 0)
gi = ndimage.binary_opening(gi, iterations=1)
v = mx[gi] / 255.0
# rampa azul marino con brillo según la luminancia original
navy_d, navy_l = np.array([18, 26, 58]), np.array([78, 102, 168])
t = np.clip((v - 0.45) / 0.55, 0, 1)[:, None]
a[gi, :3] = (navy_d + (navy_l - navy_d) * t).astype(np.int32)
Image.fromarray(keep_main(a.astype(np.uint8))).save('luis-fix.png')

# Sebas: emblema propio sobre el logo
im = Image.open('sebas-clean.png').convert('RGBA')
d = ImageDraw.Draw(im)
cx, cy, R = 152, 206, 40
d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(22, 52, 140, 255))
d.ellipse([cx - R + 5, cy - R + 5, cx + R - 5, cy + R - 5], fill=(236, 240, 248, 255))
d.ellipse([cx - R + 11, cy - R + 11, cx + R - 11, cy + R - 11], fill=(44, 98, 210, 255))
bolt = [(cx + 6, cy - 27), (cx - 14, cy + 4), (cx - 2, cy + 4), (cx - 9, cy + 28), (cx + 15, cy - 6), (cx + 3, cy - 6), (cx + 11, cy - 27)]
d.polygon([(x + 2, y + 2) for x, y in bolt], fill=(20, 20, 40, 255))
d.polygon(bolt, fill=(250, 200, 30, 255))
im.save('sebas-fix.png')
for k in ['luis', 'jc', 'sebas']:
    im = Image.open(f'{k}-fix.png'); bg = Image.new('RGBA', im.size, (0, 200, 0, 255)); bg.alpha_composite(im); bg.convert('RGB').save(f'{k}-fix-view.png')

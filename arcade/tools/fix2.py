from PIL import Image
import numpy as np
from scipy import ndimage
def keep_main(a):
    lab, n = ndimage.label(a[..., 3] > 0)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    a[lab != 1 + int(np.argmax(sizes)), 3] = 0
    return a
def trim(a):
    ys, xs = np.nonzero(a[..., 3]); return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
# ── JC ──
a = np.array(Image.open('jc-clean.png'))
H, Wd = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:Wd]
cut = ((xx < 62) & (yy > 462)) | ((xx < 110) & (yy > 600)) | ((xx > 372) & (yy > 470) & (yy < 700)) | ((xx > 425) & (yy >= 700))
a[cut, 3] = 0
a = keep_main(a)
PAD = 50
big = np.zeros((H, Wd + PAD, 4), np.uint8); big[:, PAD:] = a
# pierna derecha: espejo de la izquierda (rodillera, espinilla y bota), detrás de lo existente
patch = a[505:742, 268:432][:, ::-1]
ph, pw = patch.shape[:2]
ox, oy = PAD + 70 - (432 - 340), H - ph   # bota en el mismo suelo
dst = big[oy:oy + ph, ox:ox + pw]
pm = patch[..., 3] > 0
m = pm & (dst[..., 3] == 0)
# oscurecer un poco: es la pierna trasera
shade = (patch[..., :3].astype(int) * 0.82).astype(np.uint8)
dst[m, :3] = shade[m]; dst[m, 3] = patch[m, 3]
Image.fromarray(trim(big)).save('jc-fix.png')
# ── Luis: kimono → azul marino ──
a = np.array(Image.open('luis-clean.png')).astype(np.int32)
H, Wd = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:Wd]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
sat = (mx - mn) / np.maximum(mx, 1)
gi = (sat < 0.36) & (mx > 100) & (yy > 100) & (a[..., 3] > 0)
shoes = ((yy > 535) & (xx < 135)) | ((yy > 540) & (xx > 335))
face = (yy < 175) & (xx > 240) & (xx < 400)
gi &= ~shoes & ~face
gi = ndimage.binary_opening(gi, iterations=1)
gi = ndimage.binary_closing(gi, iterations=1) & (a[..., 3] > 0) & ~shoes & ~face
v = mx[gi] / 255.0
navy_d, navy_l = np.array([16, 24, 56]), np.array([84, 108, 176])
t = np.clip((v - 0.4) / 0.6, 0, 1)[:, None] ** 1.2
a[gi, :3] = (navy_d + (navy_l - navy_d) * t).astype(np.int32)
Image.fromarray(trim(a.astype(np.uint8))).save('luis-fix.png')
for k in ['luis', 'jc']:
    im = Image.open(f'{k}-fix.png'); bg = Image.new('RGBA', im.size, (0, 200, 0, 255)); bg.alpha_composite(im); bg.convert('RGB').save(f'{k}-fix-view.png')

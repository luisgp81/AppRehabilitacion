from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
for k in ['luis', 'jc', 'sebas']:
    im = Image.open(f'{k}.png').convert('RGBA'); a = np.array(im)
    al = a[..., 3]
    al[al < 40] = 0
    lab, n = ndimage.label(al > 0)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = 1 + int(np.argmax(sizes))
    # conservar también trozos medianos pegados al cuerpo principal (cintas, dedos): distancia < 6 px
    main = lab == keep
    near = ndimage.binary_dilation(main, iterations=6)
    for i in range(1, n + 1):
        if i != keep and sizes[i - 1] > 30 and (near & (lab == i)).any(): main |= lab == i
    a[~main] = 0
    a[..., 3] = np.where(main, al, 0)
    ys, xs = np.nonzero(a[..., 3])
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(a).save(f'{k}-clean.png')
    print(k, a.shape)

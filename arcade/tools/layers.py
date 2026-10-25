# Separa brazos en capas y rellena (inpaint por vecino más cercano) lo que tapaban
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
POLY = json.load(open('polys.json'))
OUT = sys.argv[1]
for k, polys in POLY.items():
    im = np.array(Image.open(f'{OUT}/{k}.png').convert('RGBA'))
    H, W = im.shape[:2]
    alpha = im[..., 3] > 10
    masks = {}
    for name, pts in polys.items():
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255)
        masks[name] = (np.array(m) > 0) & alpha
    arms0 = masks['armF'] | masks['armB']
    rest0 = alpha & ~arms0
    body = ndimage.binary_fill_holes(ndimage.binary_closing(rest0, iterations=10)) & alpha
    core = ndimage.binary_erosion(body, iterations=3)
    # contorno del brazo que quedó fuera del polígono: se lo lleva el brazo
    for name in masks:
        grow = ndimage.binary_dilation(masks[name], iterations=1) & alpha & ~core
        masks[name] |= grow
    masks['armB'] &= ~masks['armF']
    arms = masks['armF'] | masks['armB']
    base = im.copy(); base[arms, 3] = 0
    rest = alpha & ~arms
    # restos finos de contorno junto a los brazos: apertura morfológica local
    near = ndimage.binary_dilation(arms, iterations=14)
    opened = ndimage.binary_opening(rest, iterations=3)
    thin = rest & ~opened & near & ~ndimage.binary_erosion(body, iterations=6)
    rest &= ~thin; base[thin, 3] = 0
    # quitar restos sueltos
    lab, n = ndimage.label(rest)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i, sz in enumerate(sizes):
            if sz < 300: rest[lab == i + 1] = False; base[lab == i + 1, 3] = 0
    ring = ndimage.binary_dilation(arms, iterations=3) & body & ~arms
    rest &= ~ring
    hole = (arms | ring) & body
    if hole.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~rest, return_indices=True)
        base[hole, :3] = im[iy[hole], ix[hole], :3]
        base[hole, 3] = 255
    for name, m in masks.items():
        lab2, n2 = ndimage.label(m)
        if n2 > 1:
            sz = ndimage.sum(np.ones_like(lab2), lab2, range(1, n2 + 1))
            big = 1 + int(np.argmax(sz))
            dropped = m & (lab2 != big)
            m = m & (lab2 == big)
            # lo descartado vuelve a la base si era cuerpo
            back = dropped & body
            base[back] = im[back]
        layer = np.zeros_like(im); layer[m] = im[m]
        # pequeño borde de solape para que no se vean juntas
        Image.fromarray(layer).save(f'{OUT}/{k}-{name}.png', optimize=True)
    ba = base[..., 3] > 10
    nearA = ndimage.binary_dilation(arms0, iterations=10)
    keep = ndimage.binary_opening(ba, iterations=2)
    junk = ba & ~keep & nearA
    lab3, n3 = ndimage.label(ba & ~junk)
    if n3 > 1:
        sz3 = ndimage.sum(np.ones_like(lab3), lab3, range(1, n3 + 1))
        big3 = 1 + int(np.argmax(sz3))
        junk |= ba & (lab3 != big3) & (lab3 > 0)
    base[junk, 3] = 0
    Image.fromarray(base).save(f'{OUT}/{k}.png', optimize=True)
    print(k, 'hueco rellenado px:', int(hole.sum()))

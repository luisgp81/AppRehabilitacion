import json, sys
from PIL import Image, ImageDraw
# Polígonos de capas de brazo (coordenadas del PNG a media resolución)
POLY = {
  'luis': {
    'armF': [(178, 80), (190, 50), (206, 44), (224, 48), (234, 70), (238, 100), (246, 126), (238, 144), (220, 142), (200, 126), (184, 110)],
    'armB': [(62, 84), (76, 70), (96, 66), (112, 70), (128, 76), (137, 90), (131, 106), (112, 106), (92, 114), (72, 114), (60, 102)],
  },
  'jc': {
    'armF': [(156, 122), (176, 124), (192, 150), (204, 172), (204, 196), (186, 202), (168, 192), (156, 176), (150, 150)],
    'armB': [(44, 102), (40, 60), (52, 28), (72, 6), (100, 0), (124, 6), (124, 26), (100, 36), (82, 50), (88, 80), (96, 104), (82, 122), (58, 122)],
  },
  'sebas': {
    'armF': [(108, 54), (128, 52), (146, 64), (162, 52), (180, 58), (188, 76), (180, 96), (160, 110), (136, 116), (116, 104), (106, 80)],
    'armB': [(24, 74), (34, 58), (52, 56), (60, 70), (56, 92), (46, 104), (30, 110), (18, 100)],
  },
}
if __name__ == '__main__':
    for k, polys in POLY.items():
        im = Image.open(f'{k}-hgrid.png').convert('RGB')
        d = ImageDraw.Draw(im)
        for name, pts in polys.items(): d.polygon(pts, outline=(255, 0, 255) if name == 'armF' else (0, 255, 255))
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f'{k}-poly.png')
    json.dump(POLY, open('polys.json', 'w'))

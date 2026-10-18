"""Figura estilo Mazinger Z para impresion FDM. Unidades: mm. Z arriba, frente = -Y."""
import sys
import numpy as np
import manifold3d as m
import trimesh

M = m.Manifold
SEG = 64
parts = []


def add(x):
    parts.append(x)
    return x


def box(cx, cy, cz, sx, sy, sz):
    return M.cube((sx, sy, sz), True).translate((cx, cy, cz))


def slab(cx, cy, z, sx, sy, t=0.01):
    return M.cube((sx, sy, t), True).translate((cx, cy, z))


def tbox(cx, cy, z0, z1, s0, s1, dy1=0.0):
    """Caja troncopiramidal: seccion s0=(x,y) abajo, s1 arriba."""
    return M.batch_hull([slab(cx, cy, z0, *s0), slab(cx, cy + dy1, z1, *s1)])


def cyl(x, y, z0, h, r0, r1=None, seg=SEG):
    return M.cylinder(h, r0, r0 if r1 is None else r1, seg).translate((x, y, z0))


def sph(x, y, z, r, s=(1, 1, 1), seg=SEG):
    return M.sphere(r, seg).scale(s).translate((x, y, z))


def poly(pts):
    pts = list(pts)
    a = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
    if a > 0:  # asegurar orientacion CCW
        pts = pts[::-1]
    return m.CrossSection([pts])


def prism_xz(pts, y_front, depth):
    """Poligono en plano (x,z) extruido hacia +Y desde y_front."""
    return poly(pts).extrude(depth).rotate((90, 0, 0)).translate((0, y_front + depth, 0))


def prism_yz(pts, x0, width):
    """Poligono en plano (y,z) extruido hacia +X desde x0."""
    return poly(pts).extrude(width).rotate((90, 0, 0)).rotate((0, 0, 90)).translate((x0, 0, 0))


def sym(fn):
    """Crea la pieza en ambos lados (x>0 y espejo)."""
    a = fn(1)
    add(a)
    add(a.mirror((1, 0, 0)))


# ---------------- PEANA ----------------
base = cyl(0, 0, 0, 4, 44, 42)
# letra Z en relieve en la parte frontal de la peana
z_pts = [(-7, 4.5), (7, 4.5), (7, 2.4), (-3.2, -2.4), (7, -2.4), (7, -4.5), (-7, -4.5), (-7, -2.4), (3.2, 2.4), (-7, 2.4)]
zl = poly([(p[0], -p[1]) for p in z_pts]).extrude(1.6).rotate((0, 0, 180)).translate((0, -32, 3.9))
add(base)
add(zl)

# ---------------- PIERNAS ----------------
def leg(s):
    x = 12 * s
    g = []
    # pie con puntera biselada
    g.append(tbox(x, -3, 3.8, 12, (21, 34), (18, 26), dy1=1.5))
    g.append(tbox(x, -17, 3.8, 9, (16, 6), (12, 2)))
    # espinilla tipo bota (mas ancha abajo)
    g.append(tbox(x, 0, 11.5, 50, (23, 24), (18, 19)))
    # nervio frontal de la espinilla
    g.append(tbox(x, -11, 16, 46, (6, 3), (4, 3), dy1=1.8))
    # rodilla y rodillera
    g.append(box(x, 0, 53, 15, 17, 8))
    g.append(tbox(x, -9.2, 47, 58, (11, 4), (9, 4)))
    # muslo
    g.append(tbox(x, 0, 56, 81, (16, 16), (17.5, 17.5)))
    return M.batch_boolean(g, m.OpType.Add)


sym(leg)

# ---------------- CADERA Y CINTURA ----------------
add(tbox(0, 0, 78, 92, (32, 20), (40, 22)))
# faldones laterales (tambien sirven de apoyo a los punos)
sym(lambda s: box(20.5 * s, 0, 85, 5, 15, 12))
# placa de entrepierna
add(prism_xz([(-10, 92), (10, 92), (5.5, 77), (-5.5, 77)], -13.2, 3))
# cintura
add(box(0, 0, 95.5, 27, 17.5, 8))

# ---------------- TORSO ----------------
add(M.batch_hull([slab(0, 0, 99, 31, 20), slab(0, 0, 124, 50, 27), slab(0, 0, 129, 45, 25)]))
# Breast Fire: placa en V en el pecho
add(prism_xz([(-23, 128), (23, 128), (23, 123), (0, 107), (-23, 123)], -15.2, 4.5))
# abdominales
for i, zz in enumerate((101, 104.5)):
    for xx in (-5.5, 5.5):
        add(box(xx, -10.2, zz, 9, 2.4, 2.6))

# ---------------- CABEZA ----------------
add(cyl(0, 0, 128, 8, 6.5))
head = M.batch_hull([
    slab(0, 0.5, 134.5, 15, 16),
    slab(0, 0, 140, 17.5, 19),
    sph(0, 0.5, 146, 9, (1.0, 1.08, 0.8)),
])
# frente/visera en punta
visor = prism_xz([(-8.5, 150.5), (8.5, 150.5), (8.5, 147.5), (0, 145.5), (-8.5, 147.5)], -11.2, 5)
# mascara (boca) con rejilla
mask = tbox(0, -8.8, 135, 143, (11, 4), (12, 4))
for xx in (-3.6, -1.2, 1.2, 3.6):
    mask = mask - box(xx, -11.0, 139, 1.2, 1.6, 6)
# ojos (rebajes rasgados)
eyes = [prism_xz([(1.6, 144.2), (7.2, 145.8), (7.2, 143.6), (1.6, 142.8)], -11.0, 2.2),
        prism_xz([(-1.6, 144.2), (-7.2, 145.8), (-7.2, 143.6), (-1.6, 142.8)], -11.0, 2.2)]
head = M.batch_boolean([head, visor, mask], m.OpType.Add)
head = head - M.batch_boolean(eyes, m.OpType.Add)
add(head)
# Hover Pilder acoplado arriba
add(sph(0, 0.5, 153.3, 6.5, (1.0, 1.55, 0.42)))
add(prism_xz([(-1.4, 151), (1.4, 151), (1.0, 156.5), (-1.0, 156.5)], -6.0, 9))
# orejas circulares y aletas laterales
sym(lambda s: cyl(0, 0, 0, 3.0, 4.5).rotate((0, 90, 0)).translate((7.6, 0.5, 142)))
sym(lambda s: prism_yz([(6, 139), (-3, 139), (-7, 150), (-9.5, 159.5), (-5.5, 158.5), (2, 146.5)], 8.6, 2.4))

# ---------------- BRAZOS ----------------
def arm(s):
    x = 29 * s
    g = []
    # union hombro-torso
    g.append(box(23 * s, 0, 121, 8, 15, 12))
    # hombrera
    g.append(sph(31 * s, 0, 123, 11, (1.0, 1.1, 0.8)))
    g.append(box(31 * s, 0, 124, 15, 18, 6))
    # brazo superior y codo
    g.append(cyl(x, 0, 99, 20, 6.2))
    g.append(sph(x, 0, 99, 7))
    # antebrazo (Rocket Punch)
    g.append(cyl(x, 0, 84, 15, 8.2, 7.0))
    # puno
    g.append(M.batch_hull([box(x - 0.8 * s, -0.5, 81, 13, 14.5, 8),
                           box(x - 0.8 * s, -0.5, 76, 11, 12.5, 4)]))
    return M.batch_boolean(g, m.OpType.Add)


sym(arm)

robot = M.batch_boolean(parts, m.OpType.Add)
print("status", robot.status(), "genus", robot.genus())
mesh = robot.to_mesh()
tm = trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts))
print("watertight", tm.is_watertight, "volume cm3", round(tm.volume / 1000, 1), "bounds", tm.bounds.round(1).tolist())
print("cuerpos", len(tm.split(only_watertight=False)))
tm.export(sys.argv[1] if len(sys.argv) > 1 else "mazinger.stl")

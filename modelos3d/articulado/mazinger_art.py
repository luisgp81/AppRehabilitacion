"""Mazinger Z articulado para FDM (Elegoo Centauri Carbon). Unidades: mm. Z arriba, frente = -Y.

Articulaciones: cuello (giro), hombros y caderas (adelante/atras) con pivotes a presion
partidos integrados en la pieza. Todas las piezas se imprimen de pie, tal cual, sin soportes.
"""
import os
import sys
import numpy as np
import manifold3d as m
import trimesh

M = m.Manifold
SEG = 64

# --- tolerancias del pivote (ajustables) ---
PEG_D = 7.4    # diametro del pivote (partido: hace friccion)
HOLE_D = 7.2   # diametro del agujero
LIP_D = 8.2    # diametro de la pestana de retencion
SLOT_W = 1.8   # ranura que permite que el pivote se cierre al entrar
GAP = 0.3      # holgura entre caras
NECK_D = 10.0  # espiga del cuello
NECK_HOLE = 10.15


def box(cx, cy, cz, sx, sy, sz):
    return M.cube((sx, sy, sz), True).translate((cx, cy, cz))


def boxr(x0, x1, y0, y1, z0, z1):
    return M.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def slab(cx, cy, z, sx, sy, t=0.01):
    return M.cube((sx, sy, t), True).translate((cx, cy, z))


def tbox(cx, cy, z0, z1, s0, s1, dy1=0.0):
    return M.batch_hull([slab(cx, cy, z0, *s0), slab(cx, cy + dy1, z1, *s1)])


def cyl(x, y, z0, h, r0, r1=None, seg=SEG):
    return M.cylinder(h, r0, r0 if r1 is None else r1, seg).translate((x, y, z0))


def sph(x, y, z, r, s=(1, 1, 1), seg=SEG):
    return M.sphere(r, seg).scale(s).translate((x, y, z))


def poly(pts):
    pts = list(pts)
    a = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
    if a > 0:
        pts = pts[::-1]
    return m.CrossSection([pts])


def prism_xz(pts, y_front, depth):
    return poly(pts).extrude(depth).rotate((90, 0, 0)).translate((0, y_front + depth, 0))


def prism_yz(pts, x0, width):
    return poly(pts).extrude(width).rotate((90, 0, 0)).rotate((0, 0, 90)).translate((x0, 0, 0))


def union(parts):
    return M.batch_boolean(parts, m.OpType.Add)


def along_x(part, x0, d, y, z):
    """Pieza construida a lo largo de +Z local -> eje X global, empezando en x0 hacia d=+1/-1."""
    return part.rotate((0, 90 * d, 0)).translate((x0, y, z))


def snap_peg(x0, d, y, z, shaft):
    """Pivote partido con pestana. Nace en x0 y avanza 'shaft' mm en direccion d antes de la pestana."""
    r, rl = PEG_D / 2, LIP_D / 2
    p = union([
        M.cylinder(shaft + 0.01, r, r, SEG),
        M.cylinder(0.4, r, rl, SEG).translate((0, 0, shaft)),
        M.cylinder(0.6, rl, rl, SEG).translate((0, 0, shaft + 0.4)),
        M.cylinder(1.4, rl, 3.1, SEG).translate((0, 0, shaft + 1.0)),
    ])
    p = p - M.cube((PEG_D + 2, SLOT_W, shaft + 3), True).translate((0, 0, (shaft + 3) / 2 + 1.5))
    return along_x(p, x0, d, y, z)


def hole_x(x_outer, x_inner, y, z):
    """Agujero desde la cara exterior x_outer hacia dentro (x_inner)."""
    r = HOLE_D / 2
    L = abs(x_outer - x_inner) + 0.02
    sec = poly([(r * np.cos(t), r * np.sin(t)) for t in np.linspace(np.pi * 0.75, np.pi * 2.25, 40)] + [(0, r * 2 ** 0.5)])
    h = sec.extrude(L)
    h = union([h, M.cylinder(0.5, r + 0.5, r, SEG)])  # chaflan de entrada
    # local: seccion en XY (punta hacia +Y), extruido en +Z  ->  global: eje X, punta hacia +Z
    d = 1 if x_inner > x_outer else -1
    h = h.rotate((0, 0, 90 * d))
    h = h.rotate((0, 90 * d, 0))
    return h.translate((x_outer - 0.01 * d, y, z))


# ======================= TORSO (incluye pelvis) =======================
HIP_Z = 80.0
SH_Z = 121.0


def torso():
    g = []
    # bloque de entrepierna donde se anclan las piernas
    g.append(boxr(-9, 9, -8, 8, 70, 90))
    g.append(prism_xz([(-9, 97), (9, 97), (5, 70), (-5, 70)], -10.6, 3))
    # pelvis en V (cara inferior a ~42 grados: sin soportes, deja girar los muslos)
    g.append(M.batch_hull([slab(0, 0, 88.6, 18, 20), slab(0, 0, 99.6, 38, 21)]))
    g.append(box(0, 0, 97.5, 27, 17.5, 5))
    # pecho
    g.append(M.batch_hull([slab(0, 0, 99, 31, 20), slab(0, 0, 124, 50, 27), slab(0, 0, 129, 45, 25)]))
    # Breast Fire con canto inferior biselado
    vpts = [(-23, 128), (23, 128), (23, 123), (0, 107), (-23, 123)]
    g.append(M.batch_hull([prism_xz(vpts, -15.2, 1.2),
                           prism_xz([(x, z - 4.5) for x, z in vpts], -11.5, 1.0)]))
    for zz in (101, 104.5):
        for xx in (-5.5, 5.5):
            g.append(box(xx, -10.2, zz, 9, 2.4, 2.6))
    # bloques de hombro con chaflan inferior
    for s in (1, -1):
        g.append(M.batch_hull([boxr(*sorted((19 * s, 21 * s)), -7.5, 7.5, 110, 110.01),
                               boxr(*sorted((20 * s, 26 * s)), -7.5, 7.5, 116, 128)]))
    # espiga del cuello
    g.append(cyl(0, 0, 128.5, 8.2, NECK_D / 2))
    g.append(cyl(0, 0, 136.7, 0.8, NECK_D / 2, NECK_D / 2 - 0.8))
    t = union(g)
    # cavidades interiores (techo plano de 10-12 mm: puente sin soporte)
    cav = [boxr(-21, 21, -6, 6, SH_Z - 5.5, SH_Z + 5.5),
           boxr(-5, 5, -5.5, 5.5, HIP_Z - 5, HIP_Z + 5)]
    holes = [hole_x(26, 21, 0, SH_Z), hole_x(-26, -21, 0, SH_Z),
             hole_x(9, 5, 0, HIP_Z), hole_x(-9, -5, 0, HIP_Z)]
    return t - union(cav + holes)


# ======================= CABEZA =======================
def head():
    hd = M.batch_hull([slab(0, 0.5, 134.5, 15, 16), slab(0, 0, 140, 17.5, 19),
                       sph(0, 0.5, 146, 9, (1.0, 1.08, 0.8))])
    visor = prism_xz([(-8.5, 150.5), (8.5, 150.5), (8.5, 147.5), (0, 145.5), (-8.5, 147.5)], -11.2, 5)
    mask = tbox(0, -8.8, 135, 143, (11, 4), (12, 4))
    for xx in (-3.6, -1.2, 1.2, 3.6):
        mask = mask - box(xx, -11.0, 139, 1.2, 1.6, 6)
    eyes = [prism_xz([(1.6, 144.2), (7.2, 145.8), (7.2, 143.6), (1.6, 142.8)], -11.0, 2.2),
            prism_xz([(-1.6, 144.2), (-7.2, 145.8), (-7.2, 143.6), (-1.6, 142.8)], -11.0, 2.2)]
    g = [hd, visor, mask,
         cyl(0, 0, 128.5 + GAP + 0.6, 6.0, 7.2),                       # collarin
         sph(0, 0.5, 153.3, 6.5, (1.0, 1.55, 0.42)),                    # Hover Pilder
         prism_xz([(-1.4, 151), (1.4, 151), (1.0, 156.5), (-1.0, 156.5)], -6.0, 9)]
    for s in (1, -1):
        ear = cyl(0, 0, 0, 3.0, 4.5).rotate((0, 90, 0)).translate((7.6, 0.5, 142))
        fin = prism_yz([(6, 137), (-3, 137), (-7, 150), (-9.5, 159.5), (-5.5, 158.5), (2, 146.5)], 8.6, 2.4)
        if s < 0:
            ear, fin = ear.mirror((1, 0, 0)), fin.mirror((1, 0, 0))
        g += [ear, fin]
    h = union(g) - union(eyes)
    # alojamiento de la espiga del cuello con techo conico (sin soportes)
    z0 = 128.5 + GAP + 0.6
    r = NECK_HOLE / 2
    h = h - union([cyl(0, 0, z0 - 1, 8.0 + 1, r), cyl(0, 0, z0 + 8.0, r, r, 0.3)])
    return h


# ======================= BRAZO (derecho del robot = x>0) =======================
def arm():
    ax = 34.5
    g = [
        along_x(M.cylinder(32 - 26 - GAP, 7, 7, SEG), 26 + GAP, 1, 0, SH_Z),     # disco de giro
        M.batch_hull([sph(34, 0, 123, 1.0, (7.7, 11, 10)), sph(34.5, 0, 108, 3.5)]),  # hombrera
        cyl(ax, 0, 99, 20, 6.0),
        sph(ax, 0, 99, 6.8),
        cyl(ax, 0, 84, 15, 8.2, 7.0),                                              # Rocket Punch
        M.batch_hull([box(ax - 0.8, -0.5, 81, 13, 14.5, 8), box(ax - 0.8, -0.5, 76, 11, 12.5, 4)]),
    ]
    g.append(snap_peg(26 + GAP, -1, 0, SH_Z, 5 + GAP))
    return union(g)


# ======================= PIERNA (x>0) =======================
def leg():
    x = 17.5
    g = [
        tbox(x, -3, 0, 8.2, (21, 34), (18, 26), dy1=1.5),
        tbox(x, -17, 0, 5.2, (16, 6), (12, 2)),
        tbox(x, 0, 7.7, 46.2, (22, 23), (17.5, 18.5)),
        tbox(x, -11, 12.2, 42.2, (6, 3), (4, 3), dy1=1.8),
        box(x, 0, 49.2, 15, 17, 8),
        tbox(x, -9.2, 43.2, 54.2, (11, 4), (9, 4)),
        tbox(x, 0, 52.2, HIP_Z, (15.5, 16), (16, 17)),
        along_x(M.cylinder(25 - 9 - GAP, 8, 8, SEG), 9 + GAP, 1, 0, HIP_Z),     # pivote de cadera
    ]
    g.append(snap_peg(9 + GAP, -1, 0, HIP_Z, 4 + GAP))
    return union(g)


def to_tm(man):
    mesh = man.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(mesh.vert_properties)[:, :3], faces=np.asarray(mesh.tri_verts), process=False)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    os.makedirs(out, exist_ok=True)
    arm_r = arm()
    leg_r = leg()
    pieces = {
        "torso": torso(),
        "cabeza": head(),
        "brazo_der": arm_r,
        "brazo_izq": arm_r.mirror((1, 0, 0)),
        "pierna_der": leg_r,
        "pierna_izq": leg_r.mirror((1, 0, 0)),
    }
    # conjunto montado (para revisar colisiones / previsualizar)
    asm = {k: to_tm(v) for k, v in pieces.items()}
    for k, t in asm.items():
        print(f"{k:11s} estanca={t.is_watertight} cuerpos={len(t.split(only_watertight=False))} "
              f"vol={t.volume/1000:.1f}cm3 tam={np.round(t.extents,1).tolist()}")
    trimesh.util.concatenate(list(asm.values())).export(os.path.join(out, "montado.stl"))
    # piezas sueltas apoyadas en z=0, en su orientacion de impresion (de pie)
    for k, t in asm.items():
        t = t.copy()
        t.apply_translation((-t.bounds[0][0] - t.extents[0] / 2, -t.bounds[0][1] - t.extents[1] / 2, -t.bounds[0][2]))
        t.export(os.path.join(out, f"{k}.stl"))

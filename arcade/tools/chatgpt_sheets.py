#!/usr/bin/env python3
"""Hojas de sprites para generar en ChatGPT (o cualquier chat de imágenes): 10 hojas por personaje,
3 filas por hoja, una animación por fila. Total: 162 fotogramas por personaje.

  python3 chatgpt_sheets.py prompts            → JSON con los prompts (lo usa el Taller de Sprites)
  python3 chatgpt_sheets.py import LUIS-H03 hoja.png [JC-H01 otra.png ...]
      → corta cada fila y la deja como tira en assets/raw/<id>/<anim>.png; después: process_frames.py
      E-MACARRA-A hoja.png → enemigo del modo Calle (assets/raw/e_macarra); F1-P1 panel.png → fondo (assets/stages/f1/p1.webp)
  python3 chatgpt_sheets.py calle-md   → prompts del modo Calle en markdown
      LUIS-H01:3 voltea la fila 3 (si ChatGPT la dibujó mirando a la izquierda); varias: LUIS-H01:2,3
"""
import json, pathlib, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = pathlib.Path(__file__).resolve().parent
SHEETS_DIR = HERE.parent / 'assets' / 'sheets'
STAGES_DIR = HERE.parent / 'assets' / 'stages'    # paneles de fondo del modo Calle
STAGE_JS = HERE.parent / 'js' / 'stage-index.js'  # copia de cada hoja importada (assets/raw no se versiona)
sys.path.insert(0, str(HERE))
from gen_sprites import CHARS, SPECIALS, RAW  # noqa: E402

# (animación, fotogramas, qué debe verse)
SHEETS = [
    [('idle', 8, 'fighting stance idle, subtle breathing, seamless loop'), ('walk_f', 8, 'walking forward in guard, legs alternating, seamless loop'), ('walk_b', 8, 'walking backward in guard, cautious, seamless loop')],
    [('crouch', 4, 'going down into a crouch and holding the crouched guard'), ('jump', 6, 'vertical jump: takeoff, rising tucked, apex tucked ball, falling, landing'), ('dash', 4, 'fast forward dash, low lunge')],
    [('lp', 5, 'standing jab punch: wind-up, arm fully extended at head height, recovery'), ('sk', 6, 'standing roundhouse kick: knee up, leg fully extended at chest height, recovery'), ('cp', 5, 'crouching punch: crouched wind-up, arm fully extended low, recovery')],
    [('ck', 6, 'crouching sweep kick: leg fully extended at floor level, follow-through, recovery'), ('jp', 4, 'mid-air diagonal downward punch'), ('jk', 4, 'mid-air flying kick, leg extended diagonally down-forward')],
    [('proj', 6, 'projectile special move: hands back at hip, charge, both hands thrust forward fully extended, recovery'), ('dp', 6, 'rising uppercut special move: crouch, jump up with fist raised, peak with arm straight up, falling'), ('rush', 6, 'charging rush special move: lean, lunge, attack extended, recovery')],
    [('super', 8, 'SUPER move: power-up, dramatic wind-up, massive two-handed forward strike, hold, recovery'), ('super2', 8, 'second SUPER, multi-hit rush: explosive start, flurry of strikes, final pose'), ('combo', 5, 'combo finisher: twisting wind-up, devastating launching blow upward-forward, follow-through')],
    [('ultra', 8, 'ULTIMATE FINISHING MOVE, the most spectacular sequence: dramatic charge, leap in, barrage, spinning strike, massive final blow, victorious end pose'), ('hit', 4, 'getting hit while standing: head snapped back, recoil'), ('hit_crouch', 3, 'getting hit while crouching: flinch, recoil')],
    [('block', 3, 'standing block with arms crossed in front of the face'), ('block_crouch', 3, 'crouching block with arms crossed low'), ('launched', 4, 'knocked into the air: arched back, spinning helplessly')],
    [('down', 4, 'knocked down: falling and lying on the back on the floor'), ('getup', 5, 'getting up from the floor: sitting up, kneeling, standing'), ('ko', 5, 'knocked out: collapsing and lying defeated')],
    [('win', 8, 'victory celebration loop, fist raised, big smile'), ('intro', 8, 'pre-fight intro taunt with signature attitude, loop')],
    # modo Calle (beat 'em up): agarres. El enemigo NO se dibuja: el personaje agarra a un rival invisible
    [('grab', 3, 'grabbing an INVISIBLE opponent by the collar with both hands at chest height, holding him in place (do not draw the opponent)'),
     ('knee', 4, 'while holding the invisible opponent by the collar, delivering a strong knee strike upward at belly height'),
     ('throw', 6, 'throwing the invisible opponent over his shoulder backwards: lift, turn, hurl, follow-through, recover')],
]
EXTRA = {an: txt for cid in SPECIALS for an, txt in SPECIALS[cid].items()}

# ── Modo Calle: enemigos originales (arquetipos de los 80 y 90, sin parecido con personajes con derechos) ──
# id → (descripción para el prompt, qué hace su habilidad 'skill', y 'skill2' si es jefe)
ENEMIES = {
    'macarra': ("a skinny 1980s punk thug in his 20s: tall green mohawk, pale face, safety-pin earrings, black leather jacket covered in metal badges and studs, "
                "ripped red tartan trousers, white T-shirt, black boots with chains", "a fast flurry of three punches"),
    'patinadora': ("a 1980s roller-skater girl in her 20s: big curly hair with a pink headband, walkman on the belt and orange foam headphones, neon pink leotard over "
                   "a cropped jacket, purple leg warmers, white quad roller skates", "crouching low and charging forward on her roller skates with an extended kick"),
    'socorrista': ("a huge tanned 1980s beach lifeguard in his 30s: bleached blond mullet, thick moustache, mirrored aviator sunglasses, red lifeguard swim shorts, "
                   "whistle on a cord, orange rescue float slung on his back, enormous muscles", "lunging forward and grabbing an invisible opponent by the neck with both hands (do not draw the opponent)"),
    'rey': ("BOSS: a big-bellied beach-bar owner in his 50s, the king of the beach bar: white chef hat, open Hawaiian shirt with palm-tree print, gold chain, "
            "white shorts, flip-flops, carrying a big folded striped beach umbrella as a weapon", "throwing grilled sardine skewers forward like darts",
            "running forward and slamming with his huge belly"),
    'breaker': ("a 1980s breakdancer in his teens: backwards red cap, shiny blue tracksuit with white stripes, white sneakers with fat laces, fingerless gloves, "
                "a chunky boombox at his feet only in the idle row", "spinning on the floor in a breakdance windmill, legs sweeping around"),
    'bmx': ("a cheeky 1990s BMX kid of about 14: baseball cap with propeller, oversized neon T-shirt, cargo shorts, knee pads, braces on his teeth, "
            "holding a wooden slingshot, a small BMX bike parked behind him only in the idle row", "shooting a marble forward with his slingshot (do not draw the marble)"),
    'enmascarado': ("a big fake luchador wrestler in his 30s: an ORIGINAL invented mask (orange with a black lightning pattern, not any real wrestler), "
                    "bare muscular chest, purple wrestling tights, black boots, a cheap golden belt", "jumping high in the air and diving down chest-first (flying body press)"),
    'campeona': ("BOSS: the arcade champion, a 1990s gamer woman in her 20s: asymmetric neon-blue hair, oversized holographic bomber jacket, fingerless gloves, "
                 "a chunky ORIGINAL robotic glove with blinking lights on her right hand, ripped jeans, platform sneakers", "shooting square neon pixel bolts from her robotic glove",
                 "vanishing in a flicker of pixels and reappearing with a spinning kick"),
    'yuppie': ("a 1980s yuppie executive in his 30s: slicked-back hair, huge shoulder-pad suit in beige, pastel pink tie, red braces, Rolex-style watch, "
               "holding a brick-sized mobile phone in one hand and a leather briefcase in the other", "holding the briefcase up in front of his face as a shield (guard)"),
    'heavy': ("a 1980s heavy-metal biker in his 40s: very long black hair, bushy beard, sleeveless denim vest covered in ORIGINAL invented band patches, "
              "black T-shirt, leather trousers, cowboy boots, studded wristbands", "charging forward with a headbutt, head down, hair flying"),
    'gotica': ("a 1990s goth girl who works at a video rental store: pale make-up, black lipstick, black lace dress with fishnet sleeves, purple streaks in her black hair, "
               "big platform boots, a stack of VHS tapes under her arm", "throwing a VHS tape forward in a high arc (do not draw the tape after it leaves her hand)"),
    'vigilante': ("a towering nightclub bouncer in his 40s: shaved head, dark sunglasses at night, black bomber jacket with SECURITY-style shoulder patch without letters, "
                  "black trousers, earpiece, holding a black electric baton", "thrusting the electric baton forward with blue sparks around the tip"),
    'director': ("FINAL BOSS: the regional director, a sharp-dressed bank executive in his 50s: silver slicked hair, thin moustache, white three-piece suit, "
                 "black shirt, red tie, gold cufflinks, a tablet in his hand", "lunging forward with a slicing karate chop",
                 "raising the tablet with both hands and firing a huge horizontal beam of light (draw only a glow on the tablet)"),
}
# hojas por enemigo: A y B para todos; C solo para los jefes
ENEMY_SHEETS = {
    'A': [('idle', 6, 'fighting stance idle, subtle breathing, seamless loop'), ('walk', 8, 'walking forward ready to fight, seamless loop'),
          ('atk', 6, 'basic attack: wind-up, strike fully extended, recovery')],
    'B': [('skill', 8, None), ('hit', 3, 'getting hit: flinch, head snapped back, recoil'),
          ('down', 6, 'knocked down: frames 1-3 falling backwards through the air, frames 4-6 lying flat on the back on the floor')],
    'C': [('skill2', 8, None), ('taunt', 6, 'boss taunt standing in place, arrogant attitude, seamless loop')],
}
ENEMY_STYLE = ("Late-90s arcade beat 'em up sprite sheet (Neo Geo / CPS-2 quality pixel art) in exactly the same art style, outline weight and shading "
               "as the attached reference sprite sheet. Every frame: full body, side view, facing RIGHT, same scale. Plain flat pure green #00FF00 background "
               "everywhere. Clear empty green space between frames and between rows. No text, no labels, no numbers, no logos, no grid lines, no shadows, "
               "no ground, no effects or projectiles.")

# Fondos: 5 paneles por fase, se colocan uno detrás de otro (el último es la zona del jefe)
STAGE_PANELS = {
    'f1': ("a sunny-sunset seaside promenade in Málaga (Spain) in the late 1980s: Mediterranean sea and beach behind a white railing, palm trees, "
           "street lamps, beach bars, the walkable floor is a wide promenade of terracotta and cream tiles",
           ["the start: sea and a lighthouse in the distance, palm trees, benches",
            "a row of beach bars with striped awnings, sardine skewers grilling over a boat full of sand",
            "an ice-cream kiosk, parked mopeds, neon signs starting to light up",
            "a small fishermen's area with boats pulled up on the sand behind the railing, nets, crates",
            "BOSS AREA: the biggest beach bar of the promenade, wooden terrace, tiki torches, a big unlit sign without letters"]),
    'f2': ("the inside of a huge late-1980s amusement arcade at night: rows of glowing arcade cabinets with ORIGINAL invented screens (no real games), "
           "neon tubes on the ceiling, carpet with colourful patterns, the walkable floor is that patterned carpet",
           ["the entrance with a prize counter and change machines",
            "long rows of arcade cabinets with glowing screens",
            "a pinball area and air-hockey tables",
            "a dance-machine stage and a wall of plush-toy crane machines",
            "BOSS AREA: a raised tournament stage with a giant screen showing an ORIGINAL abstract neon pattern"]),
    'f3': ("an industrial estate on the outskirts of Málaga at night in the early 1990s leading to a nightclub: warehouses with roller doors, "
           "graffiti without readable words, puddles reflecting neon, the walkable floor is wet asphalt",
           ["a closed petrol station and warehouses with roller doors",
            "a car-parts warehouse, stacked tyres, a broken street light",
            "a video rental shop with neon and posters without readable text, a parked van",
            "a queue barrier and bouncer area in front of a nightclub facade",
            "BOSS AREA: inside the nightclub, an empty dance floor with lights, a mirror ball and a DJ booth"]),
}
PANEL_STYLE = ("Side-scrolling beat 'em up background, late-90s arcade quality pixel art (like the best Neo Geo / CPS-2 brawlers), richly detailed, "
               "landscape 3:2 image. Side view with a slight top-down angle. The walkable floor must occupy exactly the bottom 30% of the image "
               "(the floor starts at 70% of the image height) and be clear of objects. NO characters, NO people, NO text, NO letters, NO logos. "
               "The left and right edges must be able to continue into the previous and next panel of the same street (same horizon line, same floor, same lighting).")

STYLE = ("Late-90s arcade fighting game sprite sheet (Neo Geo / CPS-2 quality pixel art), exactly the same character, outfit, face, "
         "colours, outline weight and shading as the attached character sprite. Every frame: full body, side view, facing RIGHT, same scale. "
         "Plain flat pure green #00FF00 background everywhere. Clear empty green space between frames and between rows. "
         "No text, no labels, no numbers, no grid lines, no shadows, no ground, no effects or projectiles.")


def prompts():
    out = {}
    for cid, c in CHARS.items():
        items = []
        for i, rows in enumerate(SHEETS, 1):
            spec = ' '.join(f"Row {r + 1}: {n} frames, left to right, {what}{('; ' + SPECIALS[cid][an]) if an in SPECIALS[cid] else ''}."
                            for r, (an, n, what) in enumerate(rows))
            prompt = (f"Create ONE sprite sheet image of {c['desc']} The sheet has exactly {len(rows)} horizontal rows; each row is one animation "
                      f"with its frames evenly spaced and the feet of all frames of a row on the same baseline. {spec} {STYLE}")
            items.append({'code': f"{cid.upper()}-H{i:02d}", 'rows': [[an, n] for an, n, _ in rows], 'frames': sum(n for _, n, _ in rows), 'prompt': prompt})
        out[cid] = items
    return out


def calle_prompts():
    out = {'enemies': [], 'stages': [], 'grabs': []}
    for eid, spec in ENEMIES.items():
        desc, skill = spec[0], spec[1]
        boss = desc.startswith(('BOSS', 'FINAL BOSS'))
        for sh in ['A', 'B'] + (['C'] if boss else []):
            rows = ENEMY_SHEETS[sh]
            parts = []
            for r, (an, n, what) in enumerate(rows):
                what = what or (skill if an == 'skill' else spec[2])
                parts.append(f"Row {r + 1}: {n} frames, left to right, {what}.")
            ref = ("Attach one of the protagonists' finished sprite sheets as the STYLE reference (this is a new character, copy only the art style)."
                   if sh == 'A' else f"Attach the finished sheet E-{eid.upper()}-A as the character reference: exactly the same character, outfit, face and colours.")
            prompt = (f"Create ONE sprite sheet image of {desc}. The sheet has exactly {len(rows)} horizontal rows; each row is one animation with its frames "
                      f"evenly spaced and the feet of all frames of a row on the same baseline. {' '.join(parts)} {ENEMY_STYLE}")
            out['enemies'].append({'code': f"E-{eid.upper()}-{sh}", 'id': eid, 'rows': [[an, n] for an, n, _ in rows], 'ref': ref, 'prompt': prompt})
    for sid, (desc, panels) in STAGE_PANELS.items():
        for i, what in enumerate(panels, 1):
            prompt = (f"Panel {i} of 5 of {desc}. This panel shows {what}. {PANEL_STYLE}")
            ref = 'Panel 1: no reference needed.' if i == 1 else f'Attach panel {sid.upper()}-P{i - 1} so the style, horizon line and floor continue.'
            out['stages'].append({'code': f"{sid.upper()}-P{i}", 'id': sid, 'panel': i, 'ref': ref, 'prompt': prompt})
    for cid, items in prompts().items():
        out['grabs'].append(items[10])
    return out


def calle_md():
    d = calle_prompts()
    L = ["# Modo Calle · hojas y fondos para ChatGPT", "",
         "Una conversación por enemigo. Pega el prompt y adjunta la referencia que se indica. Sube a Claude cada imagen con su código.", ""]
    L += ["## Enemigos", ""]
    for it in d['enemies']:
        L += [f"### {it['code']}", "", f"*Referencia:* {it['ref']}", "", "```", it['prompt'], "```", ""]
    L += ["## Fondos (5 paneles por fase)", ""]
    for it in d['stages']:
        L += [f"### {it['code']}", "", f"*Referencia:* {it['ref']}", "", "```", it['prompt'], "```", ""]
    L += ["## Agarres de los protagonistas", "", "En la conversación de cada protagonista, adjuntando una de sus hojas ya hechas.", ""]
    for it in d['grabs']:
        L += [f"### {it['code']}", "", "```", it['prompt'], "```", ""]
    return "\n".join(L)


def import_panel(code, src):
    """F1-P3 hoja.png → assets/stages/f1/p3.webp (720 px de alto) y regenera js/stage-index.js"""
    sid, pn = code.lower().split('-p')
    d = STAGES_DIR / sid; d.mkdir(parents=True, exist_ok=True)
    img = Image.open(src).convert('RGB')
    img = img.resize((round(img.width * 720 / img.height), 720), Image.LANCZOS)
    img.save(d / f'p{int(pn)}.webp', quality=88, method=6)
    idx = {}
    for sd in sorted(STAGES_DIR.glob('f*')):
        n = 0
        while (sd / f'p{n + 1}.webp').exists(): n += 1
        if n: idx[sd.name] = n
    STAGE_JS.write_text('// Generado por tools/chatgpt_sheets.py — no editar\nwindow.STAGE_INDEX = ' + json.dumps(idx) + ';\n')
    print(f'{code} → {d / f"p{int(pn)}.webp"} ({img.width}x{img.height})')


def split_rows(img, nrows):
    """Corta la hoja en filas por las franjas horizontales vacías (o en partes iguales si no se distinguen)."""
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    green = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 80
    filled = ndimage.binary_opening(~green, iterations=2).sum(1) > img.width * 0.004
    runs, y = [], 0
    while y < len(filled):
        if filled[y]:
            s = y
            while y < len(filled) and filled[y]: y += 1
            runs.append([s, y])
        y += 1
    while len(runs) > nrows:  # unir huecos pequeños (cintas, pelo) hasta tener las filas esperadas
        i = min(range(len(runs) - 1), key=lambda k: runs[k + 1][0] - runs[k][1])
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    if len(runs) != nrows:
        h = img.height / nrows
        runs = [[int(r * h), int((r + 1) * h)] for r in range(nrows)]
    pad = 6
    return [img.crop((0, max(0, s - pad), img.width, min(img.height, e + pad))) for s, e in runs]


def cadiz_scarf(strip):
    """ChatGPT pinta la bufanda del Golpe Final de JC en rojo y blanco: la pasa a amarillo y azul (Cádiz).
    Solo toca la franja alta de los dos últimos fotogramas y respeta la piel y los dientes."""
    a = np.asarray(strip.convert('RGB')).astype(float)
    H, W = a.shape[:2]; x0, y1 = int(W * 0.74), int(H * 0.31)
    reg = a[:y1, x0:]; r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
    yy = np.arange(y1)[:, None] * np.ones((1, reg.shape[1]))
    red = (r > 110) & (g < 95) & (b < 95) & (r - g > 70)
    white = (r > 165) & (g > 155) & (b > 145) & (np.abs(r - b) < 50) & (yy < H * 0.2)
    reg[red] = (np.array([250, 200, 25]) * np.clip(r / 230, 0.45, 1.1)[..., None])[red]
    reg[white] = (np.array([40, 90, 200]) * np.clip((r + g + b) / 660, 0.5, 1.15)[..., None])[white]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


FIX = {('jc', 'ultra'): cadiz_scarf}  # retoques automáticos tras cortar una fila


def do_import(args):
    table = {it['code']: (cid, it['rows']) for cid, items in prompts().items() for it in items}
    table.update({it['code']: ('e_' + it['id'], it['rows']) for it in calle_prompts()['enemies']})
    if len(args) % 2: sys.exit(__doc__)
    for code, src in zip(args[::2], args[1::2]):
        code, _, flip = code.upper().partition(':')
        flip = {int(r) for r in flip.split(',') if r}
        if re.fullmatch(r'F\d-P\d', code): import_panel(code, src); continue
        if code not in table: sys.exit(f'Código desconocido: {code}')
        cid, rows = table[code]
        img = Image.open(src).convert('RGB')
        keep = SHEETS_DIR / cid; keep.mkdir(parents=True, exist_ok=True)
        img.save(keep / f"{code}.webp", quality=92, method=6)  # original, para reimportar
        d = RAW / cid; d.mkdir(parents=True, exist_ok=True)
        counts_f = d / 'counts.json'
        counts = json.loads(counts_f.read_text()) if counts_f.exists() else {}
        for r, ((an, n), strip) in enumerate(zip(rows, split_rows(img, len(rows))), 1):
            if r in flip: strip = strip.transpose(Image.FLIP_LEFT_RIGHT)
            if (cid, an) in FIX: strip = FIX[cid, an](strip)
            strip.save(d / f'{an}.png'); counts[an] = n
            counts.setdefault('_sheet', {})[an] = code
            print(f'{code} fila → {cid}/{an}.png ({n} fotogramas)')
        counts_f.write_text(json.dumps(counts))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'prompts': json.dump(prompts(), sys.stdout, ensure_ascii=False)
    elif len(sys.argv) > 1 and sys.argv[1] == 'import': do_import(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == 'calle-md': print(calle_md())
    elif len(sys.argv) > 1 and sys.argv[1] == 'calle': json.dump(calle_prompts(), sys.stdout, ensure_ascii=False)
    else: sys.exit(__doc__)

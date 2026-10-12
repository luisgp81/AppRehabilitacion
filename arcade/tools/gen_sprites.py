#!/usr/bin/env python3
"""Genera los fotogramas de animación de los luchadores con la API de imágenes de Gemini.

Flujo por personaje:
  1. model sheet  → una ficha del personaje (pose de guardia) a partir de la referencia. Es el "ancla" de estilo.
  2. por animación → una tira horizontal con N fotogramas (todos en la misma imagen para que sean coherentes),
     usando como referencias la imagen original + la ficha aprobada.
  3. postproceso   → fondo croma fuera, separar fotogramas, normalizar escala, alinear pies (process_frames.py).

Uso:
  GEMINI_API_KEY=... python3 gen_sprites.py --char luis --only sheet        # ficha del personaje
  GEMINI_API_KEY=... python3 gen_sprites.py --char luis                     # todas las animaciones
  python3 gen_sprites.py --dry-run                                          # ver peticiones y coste estimado
Opciones: --model (por defecto gemini-3-pro-image-preview), --only idle,lp, --force (regenerar), --out raw/
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / 'assets' / 'reference'          # recortes de la imagen original por personaje (<id>.png)
RAW = pathlib.Path(os.environ.get('SPRITES_RAW', ROOT / 'assets' / 'raw'))   # salida bruta de la API
API = os.environ.get('GEMINI_API_BASE', 'https://generativelanguage.googleapis.com') + '/v1beta/models/{model}:generateContent'
PRICE = {'gemini-3-pro-image-preview': 0.134, 'gemini-3.1-flash-image-preview': 0.067}

STYLE = ("16-bit/32-bit arcade fighting game sprite in the exact pixel-art style, palette, outline weight and shading "
         "of the reference images (late-90s Neo Geo / CPS-2 quality). Full body, side view, facing RIGHT. "
         "Plain flat pure green #00FF00 background everywhere, no ground, no shadow, no text, no frame borders, "
         "no motion blur, no special effects or projectiles, crisp silhouette.")

CHARS = {
    'luis': {
        'desc': "Luis: Spanish man in his 40s, wavy salt-and-pepper grey hair, short grey beard, red headband with long tails, "
                "athletic build. Wears a tailored navy-blue business suit (jacket, trousers), white shirt, red tie, "
                "red fingerless fighting gloves and red high-top sneakers. Keep his face exactly as in the reference.",
        'style': 'balanced karate-like stance, confident banker attitude',
    },
    'jc': {
        'desc': "Juan Carlos: bald Spanish man in his 50s, full white-grey beard, big broad muscular build, big laugh. "
                "Black studded leather vest over a black t-shirt with a red kanji and white skull print, studded black wristbands, "
                "ripped blue jeans, black knee pads, black combat boots. Keep his face exactly as in the reference.",
        'style': 'heavy brawler, wide stance, powerful',
    },
    'sebas': {
        'desc': "Sebas: Spanish man in his 40s, short dark hair with grey, black rectangular glasses, short grey beard. "
                "Blue jumpsuit with black harness straps, a round white emblem with a yellow lightning bolt on the chest "
                "(NOT a number), blue wristbands, black knee pads, blue-and-white high-top sneakers. Keep his face exactly as in the reference.",
        'style': 'fast agile fighter, low stance',
    },
}

# animación: (fotogramas, descripción de cada fotograma)
ANIMS = {
    'idle':        (6, "fighting stance idle loop: subtle breathing, guard up, frames 1-6 form a seamless loop"),
    'walk_f':      (6, "walking forward cycle in guard, legs alternating, seamless loop"),
    'walk_b':      (6, "walking backward cycle in guard, cautious, seamless loop"),
    'crouch':      (2, "crouching down: 1) going down, 2) full crouch with guard up"),
    'jump':        (4, "vertical jump: 1) takeoff, 2) rising with knees tucked, 3) apex tucked ball, 4) falling legs extending"),
    'dash':        (3, "forward dash: low fast lunge, 3 frames"),
    'lp':          (3, "standing jab punch: 1) wind-up, 2) arm fully extended straight forward at head height, 3) recovering"),
    'sk':          (4, "standing roundhouse kick: 1) knee up, 2) leg fully extended forward at chest height, 3) hold, 4) recover"),
    'cp':          (3, "crouching punch: 1) crouched wind-up, 2) arm fully extended forward low, 3) recover"),
    'ck':          (4, "crouching sweep kick: 1) crouch, 2) low spinning leg sweeping at floor level fully extended, 3) follow-through, 4) recover"),
    'jp':          (2, "jumping punch in mid-air: 1) tucked wind-up, 2) diagonal downward punch fully extended"),
    'jk':          (2, "jumping kick in mid-air: 1) tucked, 2) flying kick leg fully extended diagonally down-forward"),
    'proj':        (4, "projectile throw special move: 1) both hands pulled back at hip, 2) charging energy, 3) both palms/fists thrust forward fully extended, 4) recover"),
    'dp':          (4, "rising uppercut special move: 1) crouch, 2) jumping upward with fist raised, 3) peak with arm straight up, 4) falling"),
    'rush':        (4, "charging rush special move: 1) lean forward, 2) lunging attack fully committed, 3) attack extended, 4) recover"),
    'super':       (5, "super move: 1) power-up pose with aura-free tension, 2) dramatic wind-up, 3) massive two-handed forward strike, 4) hold, 5) recover"),
    'combo':       (3, "combo finisher strike: 1) twisting wind-up, 2) devastating launching blow fully extended upward-forward, 3) follow-through"),
    'super2':      (5, "second super move, multi-hit rush: 1) explosive start, 2) first flurry strike, 3) second flurry strike, 4) third flurry strike, 5) final pose"),
    'ultra':       (6, "ULTIMATE finishing move, the most spectacular pose of the character: 1) dramatic charge with clenched fists, 2) leaping in, 3) barrage strike, 4) spinning strike, 5) massive final blow at full stretch, 6) victorious end pose"),
    'hit':         (2, "getting hit while standing: 1) head snapped back in pain, 2) recoiling backwards"),
    'hit_crouch':  (2, "getting hit while crouching: 1) flinch, 2) recoil"),
    'block':       (2, "standing block: 1) arms crossed in front of face, 2) bracing"),
    'block_crouch':(2, "crouching block: 1) arms crossed low, 2) bracing"),
    'launched':    (2, "knocked into the air: 1) body arched back flying, 2) spinning helplessly"),
    'down':        (2, "knocked down: 1) falling to the floor, 2) lying on the back on the floor"),
    'getup':       (3, "getting up from the floor: 1) sitting up, 2) kneeling, 3) almost standing"),
    'ko':          (2, "knocked out: 1) collapsing, 2) lying defeated face up"),
    'win':         (4, "victory pose: 1-4 celebratory loop, fist raised, big smile"),
    'intro':       (4, "pre-fight intro taunt: 1-4 confident gesture, signature attitude"),
}
SPECIALS = {
    'luis': {'combo': "rising elbow strike like closing a deal", 'super2': "rapid punch barrage, hostile takeover attitude", 'ultra': "banker hero pose, tie flying, final punch surrounded by imaginary banknotes (do not draw them)", 'proj': "throwing a glowing euro coin (do NOT draw the coin, only the pose)", 'dp': "rising uppercut", 'rush': "spinning hook kick, DJ attitude", 'super': "pointing both hands forward like casting a data beam (do not draw the beam)"},
    'jc': {'combo': "huge hammer-fist like a comic book panel", 'super2': "rapid brawler combo like a long movie take", 'ultra': "stadium celebration finisher, scarf raised, final giant punch", 'proj': "throwing a comic-book panel (only the pose)", 'dp': "rising uppercut swinging a film clapperboard", 'rush': "shoulder charge like a battering ram", 'super': "huge two-arm wave gesture, football chant attitude"},
    'sebas': {'combo': "spinning cult-movie kick", 'super2': "super-fast flurry like a fast-forwarded tape", 'ultra': "heavy-metal rock-star finisher, final jumping power strike with devil horns", 'proj': "throwing a VHS cassette (only the pose)", 'dp': "rising punch making heavy-metal devil horns with the hand", 'rush': "flying side kick riding a hoverboard (draw the hoverboard)", 'super': "playing an air-guitar power chord"},
}


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def call(model, key, parts, aspect, size, retries=4):
    body = {'contents': [{'parts': parts}],
            'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': aspect, 'imageSize': size}}}
    req = urllib.request.Request(API.format(model=model), data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            for c in data.get('candidates', []):
                for p in c.get('content', {}).get('parts', []):
                    d = p.get('inlineData') or p.get('inline_data')
                    if d: return base64.b64decode(d['data'])
            raise RuntimeError('respuesta sin imagen: ' + json.dumps(data)[:400])
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code in (429, 500, 503) and i < retries - 1:
                time.sleep(10 * 2 ** i); continue
            raise RuntimeError(f'HTTP {e.code}: {msg}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--char', default='all'); ap.add_argument('--only', default='')
    ap.add_argument('--model', default='gemini-3-pro-image-preview'); ap.add_argument('--size', default='2K')
    ap.add_argument('--force', action='store_true'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not key and not a.dry_run: sys.exit('Falta GEMINI_API_KEY en el entorno.')
    chars = list(CHARS) if a.char == 'all' else a.char.split(',')
    only = set(filter(None, a.only.split(',')))
    jobs = []
    for cid in chars:
        c = CHARS[cid]
        out = RAW / cid; out.mkdir(parents=True, exist_ok=True)
        sheet = out / 'sheet.png'
        if (not only or 'sheet' in only) and (a.force or not sheet.exists()):
            jobs.append((cid, 'sheet', sheet, '3:4',
                         f"Create a single character sprite of {c['desc']} Pose: fighting guard stance ({c['style']}). {STYLE}", [REF / f'{cid}.png']))
        for an, (n, what) in ANIMS.items():
            if only and an not in only: continue
            f = out / f'{an}.png'
            if f.exists() and not a.force: continue
            extra = SPECIALS[cid].get(an, '')
            prompt = (f"Sprite sheet of ONE character: {c['desc']} Exactly {n} animation frames in a single horizontal row, "
                      f"left to right, evenly spaced with clear empty green space between frames, every frame the same character "
                      f"at the same scale with feet on the same baseline. Animation: {what}. {extra} "
                      f"Match the character design of the reference sprite sheet image exactly (same outfit, colours, face, proportions). {STYLE}")
            # la ficha se añade al ejecutar: puede generarse en esta misma pasada
            jobs.append((cid, an, f, '21:9' if n >= 4 else '16:9', prompt, [REF / f'{cid}.png', sheet]))
    cost = PRICE.get(a.model, 0.13) * len(jobs)
    print(f'{len(jobs)} peticiones · modelo {a.model} · coste estimado ≈ {cost:.2f} USD')
    for cid, an, f, asp, prompt, refs in jobs:
        print(f'- {cid}/{an} ({asp})' + (f': {prompt[:140]}…' if a.dry_run else ''))
        if a.dry_run: continue
        parts = [{'inline_data': {'mime_type': 'image/png', 'data': b64(r)}} for r in refs if pathlib.Path(r).exists()]
        parts.append({'text': prompt})
        t0 = time.time()
        try:
            img = call(a.model, key, parts, asp, a.size)
            f.write_bytes(img); print(f'  ok {len(img) // 1024} KB en {time.time() - t0:.0f}s')
        except Exception as e:
            print('  ERROR', e)


if __name__ == '__main__':
    main()

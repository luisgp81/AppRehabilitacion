# Pipeline de sprites

Convierte una ilustración (p. ej. la imagen de referencia) en sprites animables por rig.
Requisitos: `pip install "rembg[cpu]" scipy pillow` (BiRefNet se descarga solo, ~1 GB de RAM por recorte).

1. **Recorte sin fondo** (un proceso por personaje):
   `python3 seg1.py luis 0 250 540 960 referencia.png` (y `jc 440 160 900 940`, `sebas 790 310 1230 950`).
2. **Limpieza**: `clean.py` (componente principal), `fix.py` (emblema de Sebas) y `fix2.py` (cortes manuales de vecinos, pierna espejada de JC,
   kimono de Luis a azul marino). El emblema de rayo de Sebas sustituye al logo original.
3. **Capas de brazo**: ajustar polígonos en `polys.py` (coordenadas a media resolución), `python3 polys.py`,
   reducir a media resolución y `python3 layers.py <carpeta>` → `<id>.png`, `<id>-armF.png`, `<id>-armB.png`
   (el hueco del torso se rellena con el píxel vecino más cercano).
4. **Rig**: articulaciones de cada personaje en `js/sprites.js` (`RIGS`), en coordenadas del PNG.
5. **Empaquetar**: copiar los PNG a `assets/sprites/` y ejecutar `python3 build_sprite_data.py`
   (genera `js/sprite-data.js`, necesario para que funcione abriendo el HTML con `file://`).

Los scripts trabajan sobre la carpeta actual; ajusta rutas si cambias de imagen.

## Generar cientos de fotogramas con IA (Gemini «Nano Banana»)

Requisitos: variable de entorno `GEMINI_API_KEY` (Google AI Studio) y `pip install pillow numpy scipy`.

```bash
python3 tools/gen_sprites.py --dry-run                     # lista de peticiones y coste estimado
python3 tools/gen_sprites.py --char luis --only sheet      # 1) ficha del personaje (revisarla y repetir con --force si no convence)
python3 tools/gen_sprites.py --char luis                   # 2) 26 animaciones en tiras horizontales (87 fotogramas)
python3 tools/process_frames.py --char luis                # 3) croma, separar, escalar, alinear → assets/frames/luis/atlas.png
```

- Cada animación se pide como **una sola tira** con todos sus fotogramas: el modelo mantiene mejor la coherencia dentro de la animación
  y cuesta una llamada por animación. Referencias: el recorte original del personaje (cara) + la ficha aprobada (estilo y ropa).
- El juego usa los fotogramas en cuanto existe el atlas (`js/frame-index.js`); si falta una animación, la cubre el rig.
- Repetir una animación concreta: `--only lp,sk --force`. Modelo más barato: `--model gemini-3.1-flash-image-preview`.
- Prueba del pipeline sin gastar API: `node tests/pipeline.test.cjs` (servidor que imita la API).

## Vía gratuita sin API (recomendada): chat + importador

1. Abre `tools/taller-sprites.html` (o la versión publicada): 81 prompts en orden, por personaje y fase.
2. Genera en ChatGPT, Gemini o Copilot (planes gratuitos): una conversación por personaje, primero la ficha con la imagen
   de `assets/reference/<id>.png` adjunta y luego el resto en la misma conversación.
3. Importa por código y procesa:
   `python3 tools/import_frames.py LUIS-00 ficha.png LUIS-03 punetazo.png` → `python3 tools/process_frames.py --char luis`
   Acepta fondos no croma (los quita BiRefNet en local) y entregas parciales (la ficha hace de guardia hasta que llegue «idle»).

## Hojas para ChatGPT (162 fotogramas por personaje)

`chatgpt_sheets.py` define 10 hojas por personaje (3 animaciones por hoja, una por fila).
Prompts en el Taller de Sprites (`tools/taller-sprites.html`). Adjuntar: `assets/reference/luis-traje.png`, `jc.png`, `sebas.png`.

```bash
python3 tools/chatgpt_sheets.py import LUIS-H01 hoja1.png LUIS-H07 hoja7.png   # corta filas → assets/raw/luis/
python3 tools/process_frames.py --char luis                                   # fotogramas → atlas
```

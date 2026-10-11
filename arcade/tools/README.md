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

# Selección Arcade · Estado del proyecto

Punto de partida para retomar el trabajo desde cualquier sesión. Rama: `ccr-e217ca11-w57jdl`. Todo el juego vive en `arcade/`.

## Hecho y probado (20 pruebas del juego + prueba del pipeline, todas en verde)

**Juego jugable en el navegador** (`arcade/index.html`)
- 3 luchadores: Luis, Juan Carlos y Sebas, con sprites recortados de la ilustración de referencia y animados con rig esquelético (WebGL, ~1 ms/frame; modo Canvas 2D de respaldo).
- Golpes: puño, patada, agachados, aéreos, barrido, proyectil, antiaéreo, embestida.
- Combos: cancelaciones, combo arcade (puño, puño, patada → remate que lanza), contraataques, malabares limitados.
- Barra super de 2 niveles: Super 1, Super 2 (embestida de 7 golpes) y **Golpe Final** (cinemática temática de 9 golpes, KO especial).
- Modos: Arcade (con final por personaje), Versus local, CPU contra CPU, Entrenamiento. IA en 3 dificultades.
- Mando, controles táctiles, opciones guardadas, sonido y música sintetizados, locutor.

**Pipeline de arte** (`arcade/tools/`, ver `tools/README.md`)
- `make_prompt_pack.py`: 90 prompts (30 por personaje) en 3 fases. Página: `tools/taller-sprites.html`.
- `import_frames.py`: mete imágenes generadas por su código (`LUIS-00`, …).
- `process_frames.py`: quita fondo, separa fotogramas, alinea y crea el atlas que el juego usa solo.
- `gen_sprites.py`: misma generación por API de Gemini (opcional, necesita clave).

**Arte nuevo de Luis (traje)**: 9 de 10 hojas de ChatGPT importadas (LUIS-H02…H10). Son 26 animaciones y 138 fotogramas, más guardia y andar de Canva.
El recorte separa las figuras por manchas conectadas o, si se tocan, con un corte serpenteante que rodea brazos y piernas.

## Pendiente

1. **LUIS-H01** (guardia, andar adelante, andar atrás). Mientras tanto, guardia y andar adelante salen de Canva y andar atrás usa el rig.
   Importar con `python3 tools/chatgpt_sheets.py import LUIS-H01 hoja.png && python3 tools/process_frames.py --char luis`.
2. **Juan Carlos y Sebas**: sus 10 hojas cada uno (JC-H01…H10, SEBAS-H01…H10) con los prompts del Taller.
3. Retoques menores: algún resto de zapatilla o puño del vecino en el super y en la embestida de Luis.

## Cómo continuar (elige una)

- **A. Manual, sin instalar nada**: genera en ChatGPT (Plus) con los prompts del Taller, una conversación por personaje, y sube las imágenes a Claude con su código.
- **B. Automático en tu ordenador**: sesión local de Claude Code en Claude Desktop con «Uso del ordenador» activado, sobre una copia de este repositorio; pídele que siga `tools/README.md` con la app de ChatGPT.
- **C. ChatGPT en modo agente** con GitHub conectado, siguiendo `tools/README.md`.

## Comprobar que todo sigue bien

```bash
node arcade/tests/game.test.cjs       # juego (20 pruebas)
node arcade/tests/pipeline.test.cjs   # pipeline de fotogramas
npx http-server -p 8080 .             # y abrir http://localhost:8080/arcade/
```

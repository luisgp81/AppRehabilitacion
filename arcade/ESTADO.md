# Selección Arcade · Estado del proyecto

Punto de partida para retomar el trabajo desde cualquier sesión. Rama: `ccr-e217ca11-w57jdl`. Todo el juego vive en `arcade/`.

## Hecho y probado (25 pruebas del juego + prueba del pipeline, todas en verde)

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

**Arte nuevo de Luis (traje), completo**: las 10 hojas de ChatGPT (LUIS-H01…H10), 29 animaciones y 162 fotogramas.
El recorte separa las figuras por manchas conectadas o, si se tocan, con un corte serpenteante que rodea brazos y piernas.
En el combate espejo, el segundo Luis lleva traje gris marengo y conserva la piel y el resto de colores.

**Modo Calle (beat 'em up)** (`js/calle*.js`, menú → MODO CALLE)
- 3 fases: Paseo Marítimo, Salón Recreativo y Polígono y Discoteca. Cada una tiene 5 oleadas y su jefe.
- 13 enemigos originales, cada uno con su forma de pelear (plantilla en `js/calle-roster.js`):
  - Macarra: ráfaga de golpes. Patinadora: carga patinando. Socorrista: agarra y lanza (el jugador se suelta machacando botones).
  - Breakdancer: molinete a los dos lados. Chaval del BMX: tirachinas a distancia. Enmascarado: armadura y plancha voladora.
  - Yuppie: se cubre con el maletín. Heavy: armadura y cabezazo. Gótica: lanza cintas en parábola y esquiva. Vigilante: porra que aturde.
  - Jefes:
    - Rey del Chiringuito: sombrilla, espetos y barrigazo.
    - Campeona de los Recreativos: píxeles, teletransporte y refuerzos.
    - Director de Zona: combo, carga, refuerzos y un rayo a toda la pantalla que se esquiva cambiando de carril.
- Jugador: agarre al chocar con un enemigo (P = rodillazo, atrás + P = lanzar), combo, salto, especiales y super.
- Además: ataque hacia atrás (P + K), objetos rompibles con premio, armas (bate, guitarra y móvil lanzable), tiempo por tramo, vida extra cada 50 000 puntos y bonus del cajero entre fases.
  Las decisiones y su origen de género están en `tools/diseno-calle.md`: solo ideas, ningún recurso ajeno.
- Cooperativo para 2 jugadores: el 2P entra en cualquier momento con su START (Intro del teclado numérico o START del segundo mando) y juega con el siguiente personaje.
  Cada uno tiene su vida, sus vidas extra y su barra de super; la puntuación es de equipo.
  La cámara no deja atrás a ninguno, cada enemigo persigue al jugador más cercano y con dos jugadores atacan hasta tres a la vez.
- Arte provisional: los enemigos usan el atlas de un protagonista con la ropa recoloreada y los fondos están dibujados por código.
  En cuanto se importa el arte propio, el juego lo usa solo (`e_<id>` y `assets/stages/<fase>/`).
- Prompts para ChatGPT en `tools/prompts-calle.md`: 29 hojas de enemigos, 15 paneles de fondo y 3 hojas de agarres.
  Importar:
  - Enemigos: `python3 tools/chatgpt_sheets.py import E-MACARRA-A hoja.png` y después `python3 tools/process_frames.py`.
  - Fondos: `python3 tools/chatgpt_sheets.py import F1-P1 panel.png`.

**Arte completo del modo Calle**: 13 enemigos y 3 jefes con arte propio, y fondos pintados en las 3 fases (la fase 2 tiene 4 paneles, por eso es más corta).
Partidas completas con un jugador automático: Juan Carlos termina las 3 fases y el final, y Sebas llega al jefe final.

**App para móvil** (PWA): `manifest.webmanifest`, `sw.js` e iconos en `assets/icons/`.
- Se instala desde el navegador («Añadir a pantalla de inicio»), funciona sin conexión y se abre a pantalla completa en horizontal.
- Atlas en páginas webp de 2048x2048 (24 MB en vez de 100): iOS no dibuja imágenes de más de unos 16 MP.
- Los enemigos de cada fase se cargan al empezarla.
- Para instalarlo hay que publicarlo en una web con HTTPS: GitHub Pages, Netlify o similar, subiendo la carpeta `arcade/`.
- Privado entre amigos: pide una clave la primera vez (`ACCESS_HASH` en js/game.js) y no se indexa en buscadores (`robots.txt`, `_headers` y meta noindex).
  No es seguridad real: frena a los curiosos.

## Pendiente

1. **Juan Carlos**: completo: H01–H10 (162 fotogramas).
   La bufanda del Golpe Final se recolorea sola a amarillo y azul al importar.
   **Sebas**: importadas H01, H02 y H04–H10 (146 fotogramas). Falta H03 (puño, patada, puño agachado);
   mientras tanto esos golpes usan fotogramas parecidos de sus especiales.
   **Estaturas**: Luis 1,78 m, Juan Carlos 1,75 m y Sebas 1,77 m (`look.height` en js/characters.js) fijan su tamaño en pantalla.
   Antes, sus hojas (JC-H01…H10, SEBAS-H01…H10) con los prompts del Taller.
   Importar: `python3 tools/chatgpt_sheets.py import JC-H01 hoja.png ... && python3 tools/process_frames.py --char jc`.
   Si una fila sale mirando a la izquierda: `JC-H01:3` la voltea (le pasó a LUIS-H01, fila «andar atrás»).
   Las hojas importadas se guardan en `assets/sheets/<id>/` (assets/raw no se versiona). Para reimportar todo:
   `python3 tools/chatgpt_sheets.py import LUIS-H01:3 assets/sheets/luis/LUIS-H01.webp LUIS-H02 assets/sheets/luis/LUIS-H02.webp ...`
   (LUIS-H01 necesita `:3`: su fila de andar atrás mira a la izquierda).
2. Retoques menores: algún resto de zapatilla o puño del vecino en el super y en la embestida de Luis.

## Cómo continuar (elige una)

- **A. Manual, sin instalar nada**: genera en ChatGPT (Plus) con los prompts del Taller, una conversación por personaje, y sube las imágenes a Claude con su código.
- **B. Automático en tu ordenador**: sesión local de Claude Code en Claude Desktop con «Uso del ordenador» activado, sobre una copia de este repositorio; pídele que siga `tools/README.md` con la app de ChatGPT.
- **C. ChatGPT en modo agente** con GitHub conectado, siguiendo `tools/README.md`.

## Comprobar que todo sigue bien

```bash
node arcade/tests/game.test.cjs       # juego (25 pruebas)
node arcade/tests/pipeline.test.cjs   # pipeline de fotogramas
npx http-server -p 8080 .             # y abrir http://localhost:8080/arcade/
```

# Selección Arcade · Combate en Málaga

Juego de lucha 2D para navegador, inspirado en los arcades de lucha clásicos y en la ilustración «Selección Arcade en Comic Con Málaga». No necesita instalación, dependencias ni build: HTML5 Canvas y JavaScript.

## Cómo jugar

**Online (GitHub Pages):** cuando esta rama se fusione en `main`, el workflow existente lo publica en
`https://<usuario>.github.io/<repo>/arcade/`.

**En local:**

```bash
# desde la raíz del repositorio
npx http-server -p 8080 .        # o: python3 -m http.server 8080
# abrir http://localhost:8080/arcade/
```

También funciona abriendo `arcade/index.html` directamente (doble clic), aunque algunos navegadores limitan el audio o `localStorage` en `file://`.

## Personajes

| | Luis · El Director | Juan Carlos · El Submarino | Sebas · El Videoclub |
|---|---|---|---|
| Estilo | Equilibrado | Potencia (más vida y daño, más lento) | Velocidad (salta más, menos vida) |
| Look (sprite de la imagen de referencia) | Pelo canoso, barba, cinta roja, kimono recoloreado a azul marino, zapatillas rojas | Calvo, barba blanca, chaleco de cuero con tachuelas, vaqueros, botas | Gafas, barba, mono azul con emblema de rayo propio |
| Proyectil | Transferencia Inmediata (moneda €) | ¡POW! Viñetazo (viñeta de cómic) | Rebobinado VHS (cinta) |
| Antiaéreo | Subida del Euríbor | Claqueta Final | Cuernos Heavy |
| Embestida | Remix Sónico (patada giratoria, 3 golpes) | Submarino Amarillo (carga, 2 golpes) | Patinete Volador (patada en vuelo) |
| Super 1 | Prompt Definitivo (rayo de red neuronal) | ¡Permanencia! (ola amarilla y azul) | Solo de Guitarra Infinito (rayos) |
| Super 2 | OPA Hostil | Plano Secuencia | Avance Rápido x16 |
| Golpe Final | Rescate Bancario Total (lluvia de euros y datos) | Final en el Carranza (estadio amarillo y azul) | Videoclub Apocalipsis (rayos y cintas VHS) |
| Remate de combo | Cierre de Operación | Puñetazo de Viñeta | Patada de Culto |

## Controles

| Acción | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover / saltar / agacharse | `W A S D` | Flechas |
| Puño | `J` | `Num1` o `,` |
| Patada | `K` | `Num2` o `.` |
| Especial (SP) | `L` | `Num3` o `-` |
| Pausa | `Enter` / `Esc` | `Num Enter` |

- **Mando** (Gamepad API, mando 1 → J1, mando 2 → J2): cruceta o stick, X/A puño, Y/B patada, gatillos/bumpers especial, START pausa.
- **Móvil / tablet:** cruceta y botones táctiles en pantalla, en horizontal (solo Jugador 1). Se activan solos en pantallas táctiles, o con `?touch=1`.
- **Menús:** flechas o WASD, `Enter`/`J` para aceptar, `Esc`/`K` para volver.

### Golpes (todos los personajes)

| Entrada | Golpe |
|---|---|
| `SP` | Proyectil |
| Adelante + `SP` | Embestida |
| Atrás + `SP` | Antiaéreo (invencible al arrancar) |
| Abajo + `SP` con barra SUPER llena | **Super** |
| `236` + Puño (↓↘→) | Proyectil (input clásico) |
| `623` + Puño (→↓↘) | Antiaéreo (input clásico) |
| `214` + Patada (↓↙←) | Embestida (input clásico) |
| `236236` + Puño | Super 1 (input clásico) |
| Patada + `SP` a la vez (o `236236` + Patada) | **Super 2**: embestida de 7 impactos (1 barra) |
| Puño + Patada + `SP` a la vez (o `214214` + Puño) | **GOLPE FINAL**: cinemática de 9 impactos (2 barras); si remata, KO especial |
| Puño, puño, patada | **Combo arcade** con remate que lanza (cancelable en super) |
| Abajo + Patada | Barrido (golpe bajo, derriba) |
| Puño / patada en el aire | Golpe aéreo (hay que bloquearlo de pie) |
| Doble toque adelante / atrás | Dash / backdash |

**Barra super:** 2 niveles. Super 1 y Super 2 gastan 1; el Golpe Final, 2.

**Combos:** los golpes normales que conectan (o se bloquean) se pueden cancelar: puño → puño → patada → especial → super. El daño escala a la baja en combos largos y los malabares aéreos están limitados.

**Defensa:** mantén atrás. De pie para golpes medios y aéreos, agachado para barridos. Los especiales hacen un poco de daño aunque se bloqueen.

## Modos

- **Arcade (1 jugador):** vence a los otros dos personajes (el segundo rival sube de dificultad). Con continuaciones y final propio por personaje.
- **Versus (2 jugadores):** mismo teclado o dos mandos. Si los dos eligen al mismo personaje, el segundo sale con colores alternativos.
- **CPU contra CPU:** modo espectador.
- **Entrenamiento:** sparring quieto, vida que se recupera y barra super infinita.
- **Opciones:** dificultad de la CPU (fácil / normal / difícil), rondas para ganar (1-3), tiempo (60, 99 o sin límite), efectos, música y voz del locutor. Se guardan en el navegador.

## Detalles técnicos

- Lógica a 60 FPS de paso fijo con hitstop, búfer de entrada, cancelaciones, contraataques, chip damage, malabares, empuje en esquina y derribos.
- **Gráficos de los personajes**: sprites recortados de la ilustración de referencia (eliminación de fondo con BiRefNet) y animados con un **rig esquelético**: el cuerpo es una malla deformada por huesos (skinning) y cada brazo se separa en dos piezas rígidas, con el hueco del torso rellenado. Render en WebGL (~1 ms/frame); sin WebGL, o si va lento, pasa a un modo Canvas 2D con piezas rígidas; si no cargan las imágenes, a la marioneta vectorial original. Retratos HD recortados de las caras.
- Escenario original pixelado con tramado ordenado: atardecer en Málaga con castillo, catedral de una torre, noria, palmeras, focos, público y un robot-boquerón gigante.
- Pipeline reproducible de sprites en `tools/` (ver `tools/README.md`).
- Sonido sintetizado con WebAudio (golpes, especiales, música chiptune original). Locutor con la síntesis de voz del navegador si existe (`es-ES`); si no, solo texto en pantalla.
- La IA usa el mismo mando virtual que un humano (no lee tus entradas): tiene tiempo de reacción, probabilidad de bloqueo, antiaéreos y combos según la dificultad.
- Fuente: *Press Start 2P* (Google Fonts, licencia OFL). Sin conexión se usa una monoespaciada del sistema.
- Sin marcas oficiales: los guiños (Cádiz, cine de los 80/90, heavy, cómic) son textuales y paródicos, sin escudos ni logotipos.

```
arcade/
├── index.html          # página, estilos y controles táctiles
├── js/audio.js         # efectos, música y locutor (WebAudio)
├── js/input.js         # teclado, mando, táctil y búfer de inputs
├── js/characters.js    # datos, aspecto, golpes y frases
├── js/fighter.js       # estados, golpes, físicas y cajas de impacto
├── js/render.js        # poses, marioneta de respaldo, escenario, proyectiles y partículas
├── js/sprites.js       # rig esquelético + skinning WebGL de los sprites
├── js/sprite-data.js   # sprites embebidos (generado por tools/build_sprite_data.py)
├── assets/sprites/     # PNG: base, brazos y caras de cada personaje
├── tools/              # pipeline de recorte, capas y empaquetado
├── js/ai.js            # IA rival
├── js/game.js          # pantallas, rondas, HUD y bucle
└── tests/game.test.cjs # pruebas end-to-end con Chromium
```

### Parámetros de URL para depurar

- `?boxes` muestra cajas de impacto (rojo), daño (verde) y proyectiles (amarillo).
- `?touch=1` fuerza los controles táctiles.
- `?test=1&seed=N` congela el bucle (se avanza con `SA.step(n)`) y fija la semilla de la IA; lo usan las pruebas.

## Pruebas

```bash
node arcade/tests/game.test.cjs          # requiere playwright (local o global) y Chromium
SHOTS=/ruta node arcade/tests/game.test.cjs   # además guarda capturas
```

Cubren: sprites HD cargados en WebGL y dibujados (comparación de píxeles), coste de render por frame, apertura por `file://`, carga sin errores, menús y opciones persistentes, golpes que conectan, especial por botón y por input clásico, combos con cancelación, super con cinemática y multi-impacto, bloqueo alto/bajo en versus, pausa, combates completos CPU contra CPU en las tres dificultades, el modo arcade hasta el final, mando simulado y controles táctiles.

## Limitaciones conocidas

- **Animación**: cada personaje sale de *un solo dibujo* animado por rig. Se ve como la imagen, pero no tiene la riqueza de un juego con decenas de fotogramas dibujados a mano por golpe (KOF, Fatal Fury); SF4 además es 3D. Algunas poses deforman ropa o hombros.
- **Luis lleva kimono** (el de la imagen, recoloreado a azul marino), no traje: para el traje hace falta una nueva ilustración de Luis en la misma pose y estilo.

- Sin agarres/llaves ni modo online.
- El mando se ha probado con la Gamepad API simulada, no con un mando físico.
- Los controles táctiles solo manejan al Jugador 1.
- La voz del locutor depende del navegador y de las voces instaladas.

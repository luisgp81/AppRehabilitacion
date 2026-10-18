# Mazinger Z articulado · Elegoo Centauri Carbon

**Para imprimir:** copia `MazingerZ_articulado_CC_PLA.gcode` al pendrive, conéctalo a la impresora y elige el archivo en la pantalla.

| Dato | Valor |
|---|---|
| Impresora | Elegoo Centauri Carbon, boquilla 0,4 mm, cama PEI texturizada |
| Material | PLA, 210 °C boquilla / 60 °C cama |
| Capa | 0,16 mm · 3 paredes · relleno 15 % giroide · borde (brim) 7 mm |
| Soportes | No hacen falta |
| Tiempo estimado | 3 h 38 min (estimación del laminador) |
| Filamento | 74 g · 24,8 m |
| Figura montada | ~148 mm de alto |

## Piezas (6, todas en una bandeja)
Torso con pelvis · cabeza · 2 brazos · 2 piernas. Se imprimen de pie, en la misma posición en que van montadas.

## Montaje
1. Retira el borde (brim) de cada pieza.
2. **Piernas:** mete el pivote de cada pierna en el agujero lateral de la pelvis, empujando recto hasta que haga clic.
3. **Brazos:** igual, en los agujeros laterales de los hombros.
4. **Cabeza:** encájala a presión en la espiga del cuello.

Movimientos: la cabeza gira, los brazos giran 360° (pose de Puño Fuego) y las piernas van ±90°, así que la figura puede caminar y sentarse.

**Si queda duro:** lija un poco la pestaña del pivote. **Si queda flojo:** una capa fina de esmalte de uñas transparente en el pivote, dejar secar.

⚠️ Juguete con piezas pequeñas: no apto para menores de 3 años.

## Ajustar holguras
En `mazinger_art.py`: `PEG_D` (7,4 mm) y `HOLE_D` (7,2 mm). Regenera con `python mazinger_art.py salida/` y vuelve a laminar con `cc_pla.ini` (PrusaSlicer) o con ElegooSlicer.

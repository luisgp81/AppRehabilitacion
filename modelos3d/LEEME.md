# Robot estilo Mazinger Z (figura para impresión FDM)

- `MazingerZ_160mm.stl`: pieza única, malla cerrada (estanca), 88 × 88 × 160 mm, con peana de Ø88 mm.
- `MazingerZ_preview.png`: vistas frontal, 3/4, lateral y trasera.
- `mazinger_z.py`: script paramétrico que genera el STL (manifold3d + trimesh).

## Ajustes recomendados en Elegoo Cura (PLA, boquilla 0,4)
| Parámetro | Valor |
|---|---|
| Altura de capa | 0,16 mm (0,12 para más detalle) |
| Paredes | 3 líneas (1,2 mm) |
| Relleno | 15 % giroide |
| Soportes | Sí · Tipo **Árbol** · Colocación **Tocando la placa** |
| Adherencia | Ninguna o borde (brim) 5 mm; la peana ya da superficie |
| Temperaturas | 205 °C boquilla / 60 °C cama |

Orientativo: ~70–85 g de PLA (volumen macizo 160 cm³). Cura calcula el tiempo y gramos exactos al laminar.

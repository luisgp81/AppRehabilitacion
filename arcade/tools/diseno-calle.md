# Modo Calle · decisiones de diseño

Referencia de género: los beat 'em up arcade de finales de los 80 y principios de los 90.
Solo se toman **ideas de diseño** (mecánicas genéricas del género). No se usa ningún gráfico, sonido, código, nombre, personaje ni escenario de otros juegos.
Todo el arte sale de nuestros prompts y todo el código es propio.

| Idea del género | Nuestra versión |
|---|---|
| Agarre al chocar, rodillazos y lanzamiento | P = rodillazo (al tercero, lanzamiento); atrás + P = lanzar por encima; el lanzado arrolla a otros |
| Especial que cuesta vida y limpia alrededor | SP quieto: antiaéreo a los dos lados (-30 de vida si conecta); SP adelante: embestida; con barra, super a toda la pantalla |
| Ataque hacia atrás | P + K a la vez: patada a la espalda que derriba |
| Objetos rompibles con premio | Cajas de pescado y neveras (playa), máquinas de chicles y papeleras (recreativo), bidones (polígono) |
| Comida que cura | Espeto (60 %) y campero (30 %) |
| Botín de puntos | Billetes (+3000) y vinilos (+1500) |
| Armas con usos limitados | Bate (8 golpes), guitarra eléctrica (5, derriba) y móvil ladrillo (se lanza); se pierden al caer |
| Tiempo por tramo | 99 s que se recargan al limpiar cada oleada; si se acaba, se pierde una vida |
| Vida extra por puntos | Una cada 50 000 |
| Fase de bonus | "El cajero se ha vuelto loco": 30 s para reventar un cajero que escupe billetes |
| Enemigos con papeles distintos | 13 enemigos originales en `js/calle-roster.js` (carga, agarre, distancia, armadura, guardia, aturdimiento…) |
| Cooperativo para 2 jugadores | El 2P se une en cualquier momento con START; vidas y barra de super por jugador, puntuación de equipo |
| Jefe por fase con patrón propio | Rey del Chiringuito, Campeona de los Recreativos y Director de Zona |

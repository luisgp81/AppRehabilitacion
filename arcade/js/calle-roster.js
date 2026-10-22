'use strict';
// Modo Calle: plantilla de enemigos y fases. Todos son arquetipos originales de los 80 y 90 (sin personajes reconocibles).
// Cada enemigo tiene su forma de pelear (ai) y sus golpes. Mientras no llegue su arte propio (atlas 'e_<id>'),
// se dibuja con el atlas de un protagonista (base) y la ropa recoloreada (tint), usando la animación 'ph'.
//
// Golpes: startup/active/recovery en frames; dmg absoluto (vida del jugador ≈ 1000);
// hb = [x, y, ancho, alto] en fracciones de la estatura del enemigo (x hacia delante, y = altura del centro).
// Extras: hits/every (multigolpe), knock (derriba), launch [vx, vy], dash (carga), around (golpea a los dos lados),
// grab (agarra y lanza), proj (lanza objetos), leap (salta encima), stun (aturde), beam (rayo a toda la pantalla), tele (teletransporte).
const ROSTER = {
  // ── Fase 1: paseo marítimo ──
  macarra: {
    name: 'MACARRA DE CRESTA', height: 1.75, base: 'sebas', tint: '#b8282e', hp: 130, speed: 1.7, score: 300, ai: 'melee', skillP: 0.35,
    moves: {
      atk: { anim: 'atk', ph: 'lp', startup: 8, active: 4, recovery: 12, dmg: 22, hb: [0.36, 0.66, 0.32, 0.18] },
      skill: { name: 'RÁFAGA DE CHAPAS', anim: 'skill', ph: 'super2', startup: 10, active: 18, recovery: 18, dmg: 14, hits: 3, every: 6, knock: true, hb: [0.38, 0.6, 0.4, 0.3] },
    },
  },
  patinadora: {
    name: 'PATINADORA DEL WALKMAN', height: 1.68, base: 'sebas', tint: '#e05aa8', hp: 100, speed: 2.3, score: 400, ai: 'charger',
    moves: {
      atk: { anim: 'atk', ph: 'sk', startup: 7, active: 4, recovery: 12, dmg: 20, hb: [0.4, 0.5, 0.36, 0.22] },
      skill: { name: 'PATINAZO', anim: 'skill', ph: 'rush', startup: 18, active: 42, recovery: 16, dmg: 40, dash: 6.5, knock: true, hb: [0.22, 0.5, 0.4, 0.6] },
    },
  },
  socorrista: {
    name: 'SOCORRISTA MUSCULITOS', height: 1.88, base: 'jc', tint: '#d83a2a', hp: 240, speed: 1.2, score: 600, ai: 'grabber', armor: 1, skillP: 0.5,
    moves: {
      atk: { anim: 'atk', ph: 'sk', startup: 12, active: 5, recovery: 16, dmg: 32, hb: [0.38, 0.62, 0.36, 0.24] },
      skill: { name: 'LLAVE DE RESCATE', anim: 'skill', ph: 'lp', startup: 6, active: 6, recovery: 22, dmg: 0, grab: { hold: 70, dmg: 85 }, hb: [0.26, 0.6, 0.26, 0.5] },
    },
  },
  rey: {
    name: 'EL REY DEL CHIRINGUITO', height: 1.84, base: 'jc', tint: '#e8b040', hp: 1100, speed: 1.3, score: 6000, ai: 'boss', armor: 2, boss: true, scale: 1.12,
    moves: {
      atk: { name: 'SOMBRILLAZO', anim: 'atk', ph: 'sk', startup: 14, active: 6, recovery: 18, dmg: 45, knock: true, hb: [0.45, 0.55, 0.7, 0.5] },
      skill: { name: '¡ESPETOS VOLANDO!', anim: 'skill', ph: 'proj', startup: 18, active: 2, recovery: 24, dmg: 0, proj: { kind: 'espeto', n: 3, vx: 4.6, dmg: 34 } },
      skill2: { name: 'BARRIGAZO', anim: 'skill2', ph: 'rush', startup: 20, active: 30, recovery: 20, dmg: 50, dash: 5, knock: true, hb: [0.25, 0.5, 0.5, 0.6] },
    },
  },
  // ── Fase 2: salón recreativo ──
  breaker: {
    name: 'BREAKDANCER', height: 1.72, base: 'sebas', tint: '#3aa0e0', hp: 140, speed: 1.9, score: 450, ai: 'spinner',
    moves: {
      atk: { anim: 'atk', ph: 'sk', startup: 8, active: 4, recovery: 12, dmg: 22, hb: [0.4, 0.45, 0.36, 0.24] },
      skill: { name: 'MOLINETE', anim: 'skill', ph: 'ck', startup: 10, active: 40, recovery: 14, dmg: 12, hits: 5, every: 8, around: true, knock: true, hb: [0, 0.22, 1.1, 0.4] },
    },
  },
  bmx: {
    name: 'CHAVAL DEL BMX', height: 1.55, base: 'luis', tint: '#40b060', hp: 90, speed: 2.1, score: 400, ai: 'ranged', keep: [170, 240],
    moves: {
      atk: { anim: 'atk', ph: 'lp', startup: 6, active: 4, recovery: 10, dmg: 16, hb: [0.36, 0.6, 0.3, 0.2] },
      skill: { name: 'TIRACHINAS', anim: 'skill', ph: 'proj', startup: 16, active: 2, recovery: 20, dmg: 0, proj: { kind: 'canica', n: 1, vx: 6.5, dmg: 22 } },
    },
  },
  enmascarado: {
    name: 'EL ENMASCARADO DE PEGA', height: 1.86, base: 'jc', tint: '#8a3ad0', hp: 270, speed: 1.3, score: 700, ai: 'leaper', armor: 2,
    moves: {
      atk: { anim: 'atk', ph: 'lp', startup: 10, active: 5, recovery: 14, dmg: 30, hb: [0.38, 0.65, 0.34, 0.22] },
      skill: { name: 'PLANCHA VOLADORA', anim: 'skill', ph: 'dp', startup: 12, active: 60, recovery: 18, dmg: 55, leap: true, knock: true, hb: [0, 0.2, 1.0, 0.4] },
    },
  },
  campeona: {
    name: 'LA CAMPEONA DE LOS RECREATIVOS', height: 1.70, base: 'sebas', tint: '#e040e0', hp: 1150, speed: 1.8, score: 7000, ai: 'boss', armor: 1, boss: true, summon: ['bmx', 'bmx'],
    moves: {
      atk: { name: 'COMBO PERFECTO', anim: 'atk', ph: 'super2', startup: 8, active: 16, recovery: 14, dmg: 16, hits: 3, every: 5, knock: true, hb: [0.38, 0.6, 0.4, 0.3] },
      skill: { name: 'DISPARO DE PÍXELES', anim: 'skill', ph: 'proj', startup: 16, active: 2, recovery: 20, dmg: 0, proj: { kind: 'pixel', n: 3, vx: 5.5, dmg: 26 } },
      skill2: { name: 'TELETRANSPORTE', anim: 'skill2', ph: 'sk', startup: 24, active: 5, recovery: 16, dmg: 44, tele: true, knock: true, hb: [0.4, 0.55, 0.4, 0.3] },
    },
  },
  // ── Fase 3: polígono y discoteca ──
  yuppie: {
    name: 'YUPPIE DE HOMBRERAS', height: 1.80, base: 'luis', tint: '#c9a24a', hp: 170, speed: 1.4, score: 500, ai: 'blocker',
    moves: {
      atk: { name: 'MALETINAZO', anim: 'atk', ph: 'sk', startup: 12, active: 5, recovery: 16, dmg: 30, hb: [0.5, 0.6, 0.42, 0.22] },
      skill: { anim: 'skill', ph: 'block' }, // se cubre con el maletín: para los golpes de frente
    },
  },
  heavy: {
    name: 'HEAVY DE GASOLINERA', height: 1.85, base: 'jc', tint: '#4a4a4a', hp: 290, speed: 1.1, score: 700, ai: 'melee', armor: 2, skillP: 0.3, drop: 'campero',
    moves: {
      atk: { anim: 'atk', ph: 'lp', startup: 11, active: 5, recovery: 16, dmg: 34, hb: [0.38, 0.65, 0.34, 0.22] },
      skill: { name: 'CABEZAZO METALERO', anim: 'skill', ph: 'rush', startup: 18, active: 22, recovery: 18, dmg: 46, dash: 5, knock: true, hb: [0.3, 0.75, 0.4, 0.3] },
    },
  },
  gotica: {
    name: 'GÓTICA DEL VIDEOCLUB', height: 1.70, base: 'sebas', tint: '#6a2a8a', hp: 110, speed: 1.8, score: 450, ai: 'ranged', keep: [150, 230], dodge: true,
    moves: {
      atk: { anim: 'atk', ph: 'sk', startup: 7, active: 4, recovery: 12, dmg: 20, hb: [0.4, 0.55, 0.34, 0.22] },
      skill: { name: '¡SIN REBOBINAR!', anim: 'skill', ph: 'proj', startup: 14, active: 2, recovery: 20, dmg: 0, proj: { kind: 'cinta', n: 1, vx: 4, vy: 4.2, dmg: 28 } },
    },
  },
  vigilante: {
    name: 'VIGILANTE DE DISCOTECA', height: 1.92, base: 'luis', tint: '#2a3440', hp: 230, speed: 1.3, score: 650, ai: 'melee', armor: 1, skillP: 0.4,
    moves: {
      atk: { name: 'PORRAZO', anim: 'atk', ph: 'sk', startup: 12, active: 5, recovery: 16, dmg: 30, hb: [0.48, 0.62, 0.42, 0.22] },
      skill: { name: 'PORRA ELÉCTRICA', anim: 'skill', ph: 'lp', startup: 14, active: 5, recovery: 20, dmg: 24, stun: 75, hb: [0.42, 0.6, 0.36, 0.24] },
    },
  },
  director: {
    name: 'EL DIRECTOR DE ZONA', height: 1.80, base: 'luis', tint: '#d8d0c0', hp: 1400, speed: 1.5, score: 10000, ai: 'boss', armor: 1, boss: true, scale: 1.1, summon: ['yuppie', 'yuppie'],
    moves: {
      atk: { name: 'REUNIÓN DE SEGUIMIENTO', anim: 'atk', ph: 'super2', startup: 8, active: 12, recovery: 14, dmg: 20, hits: 2, every: 6, knock: true, hb: [0.4, 0.6, 0.4, 0.3] },
      skill: { name: 'RECORTE DE PLANTILLA', anim: 'skill', ph: 'rush', startup: 14, active: 26, recovery: 18, dmg: 48, dash: 6, knock: true, hb: [0.3, 0.55, 0.45, 0.5] },
      skill2: { name: 'PRESENTACIÓN DE RESULTADOS', anim: 'skill2', ph: 'super', startup: 60, active: 6, recovery: 30, dmg: 130, beam: true, knock: true },
    },
  },
};

// Fases: 'at' = fracción del largo de la fase donde arranca cada oleada.
// Si existen los paneles pintados (assets/stages/<id>/), el largo sale de ellos.
const CALLE_STAGES = [
  {
    id: 'f1', name: 'PASEO MARÍTIMO', len: 3000, theme: 'playa',
    waves: [
      { at: 0.17, foes: ['macarra', 'macarra'] },
      { at: 0.36, foes: ['macarra', 'patinadora'] },
      { at: 0.55, foes: ['socorrista', 'macarra', 'macarra'] },
      { at: 0.74, foes: ['patinadora', 'patinadora', 'socorrista'] },
      { at: 0.93, foes: ['rey', 'macarra'], boss: true },
    ],
    items: [{ at: 0.3, z: 70, kind: 'campero' }, { at: 0.68, z: 30, kind: 'espeto' }, { at: 0.88, z: 80, kind: 'espeto' }],
  },
  {
    id: 'f2', name: 'SALÓN RECREATIVO', len: 3000, theme: 'recreativo',
    waves: [
      { at: 0.17, foes: ['breaker', 'bmx'] },
      { at: 0.36, foes: ['enmascarado', 'breaker'] },
      { at: 0.55, foes: ['bmx', 'bmx', 'breaker', 'macarra'] },
      { at: 0.74, foes: ['enmascarado', 'breaker', 'bmx', 'patinadora'] },
      { at: 0.93, foes: ['campeona'], boss: true },
    ],
    items: [{ at: 0.45, z: 40, kind: 'campero' }, { at: 0.85, z: 70, kind: 'espeto' }],
  },
  {
    id: 'f3', name: 'POLÍGONO Y DISCOTECA', len: 3300, theme: 'noche',
    waves: [
      { at: 0.15, foes: ['yuppie', 'heavy'] },
      { at: 0.33, foes: ['gotica', 'yuppie', 'vigilante'] },
      { at: 0.52, foes: ['heavy', 'gotica', 'macarra', 'patinadora'] },
      { at: 0.72, foes: ['vigilante', 'yuppie', 'enmascarado', 'gotica'] },
      { at: 0.93, foes: ['director', 'yuppie'], boss: true },
    ],
    items: [{ at: 0.4, z: 60, kind: 'campero' }, { at: 0.62, z: 25, kind: 'espeto' }, { at: 0.88, z: 75, kind: 'espeto' }],
  },
];
const CALLE_ITEMS = { espeto: { name: '¡ESPETO!', hp: 0.6, score: 500 }, campero: { name: '¡CAMPERO!', hp: 0.3, score: 300 } };

'use strict';
// Plantel: datos, aspecto, nombres de golpes y frases. Todo es original.
const CHARS = [
  {
    id: 'luis', name: 'LUIS', title: 'EL DIRECTOR', color: '#e8423a',
    bio: 'Directivo comercial. Cierra operaciones y combos con la misma sonrisa. Banca, IA y buena música.',
    style: 'Equilibrado',
    stats: { hp: 1000, walkF: 2.9, walkB: 2.3, jumpV: 11.6, jumpX: 3.4, power: 1.0, projSpeed: 6.2, rushSpeed: 6.6 },
    look: {
      scale: 1.25, bulk: 0, head: 'luis',
      skin: '#e2a883', skinShade: '#b47a59', hair: '#808080', hairHi: '#b4b4b4', beard: '#c4c4c4', brow: '#555',
      top: '#22305f', topShade: '#151e40', shirt: '#f3f3f3', tie: '#d62b2b', band: '#d62b2b',
      sleeve: '#22305f', forearm: '#22305f', cuff: '#f3f3f3',
      pants: '#22305f', pantsShade: '#151e40', shoe: '#cf2a2a', sole: '#f2f2f2', torso: 'suit',
    },
    alt: { top: '#4a4a52', topShade: '#2e2e34', sleeve: '#4a4a52', forearm: '#4a4a52', pants: '#4a4a52', pantsShade: '#2e2e34', tie: '#2ba84a', band: '#2ba84a', shoe: '#2ba84a' },
    moves: {
      proj: { name: 'TRANSFERENCIA INMEDIATA', fx: 'euro', text: '¡BIZUM!' },
      dp: { name: 'SUBIDA DEL EURÍBOR', fx: 'chart', text: '+0,25%' },
      rush: { name: 'REMIX SÓNICO', fx: 'notes', style: 'spin', text: '¡DROP!' },
      super: { name: 'PROMPT DEFINITIVO', kind: 'beam', fx: 'ai', text: 'IA.EXE' },
    },
    quotes: {
      intro: ['Tengo una oferta que no podrás rechazar.', 'Vengo a revisar tus condiciones.', 'He pedido a la IA un plan. Spoiler: pierdes.'],
      win: ['Tu saldo de vida: 0,00 €. ¿Te ofrezco un preconcedido?', 'Esa defensa no pasa el comité de riesgos.', 'Lo consulté con la IA: has perdido. Con un 99,9% de confianza.', 'Objetivo trimestral: cumplido. Y era tu cara.'],
    },
  },
  {
    id: 'jc', name: 'JUAN CARLOS', title: 'EL SUBMARINO', color: '#f4c20d',
    bio: 'Guardián de la viñeta, cinéfilo de sesión doble y sufridor del Cádiz desde la cuna. Calvo por decisión del destino.',
    style: 'Potencia',
    stats: { hp: 1100, walkF: 2.4, walkB: 2.0, jumpV: 11.0, jumpX: 3.0, power: 1.15, projSpeed: 5.2, rushSpeed: 7.2 },
    look: {
      scale: 1.33, bulk: 3, head: 'jc',
      skin: '#e6ab86', skinShade: '#b9805e', hair: '#bdbdbd', hairHi: '#e8e8e8', beard: '#e4e4e4', brow: '#8a8a8a',
      top: '#1c1c1c', topShade: '#0c0c0c', shirt: '#9e1c1c', tie: null, band: null, scarf: ['#f4c20d', '#1f4fb8'],
      sleeve: 'skin', forearm: 'skin', cuff: '#1c1c1c', studs: true,
      pants: '#3a64a8', pantsShade: '#26457a', shoe: '#151515', sole: '#555', boots: true, torso: 'vest',
    },
    alt: { top: '#5a3a1a', topShade: '#3a250f', shirt: '#1f4fb8', pants: '#2c2c2c', pantsShade: '#1a1a1a', cuff: '#5a3a1a' },
    moves: {
      proj: { name: '¡POW! VIÑETAZO', fx: 'comic', text: '¡POW!' },
      dp: { name: 'CLAQUETA FINAL', fx: 'clap', text: '¡CORTEN!' },
      rush: { name: 'SUBMARINO AMARILLO', fx: 'sub', style: 'charge', text: '¡GLUB!' },
      super: { name: '¡PERMANENCIA!', kind: 'wave', fx: 'wave', text: '¡OLÉ!' },
    },
    quotes: {
      intro: ['Esto es más fácil que ver al Cádiz en el descuento.', 'Mi calva refleja tu derrota.', 'He leído este final. Y no te gusta.'],
      win: ['Te he dejado en blanco y negro, como los cómics de antes.', 'Calvo, sí. Derrotado, nunca.', '¡Permanencia asegurada! Tú, a Segunda.', 'Créditos finales. Y no hay escena post-créditos para ti.'],
    },
  },
  {
    id: 'sebas', name: 'SEBAS', title: 'EL VIDEOCLUB', color: '#2f7bf0',
    bio: 'Videoclub humano. Recita el reparto de cualquier peli de 1987 y afina guitarras con la mirada.',
    style: 'Velocidad',
    stats: { hp: 950, walkF: 3.3, walkB: 2.7, jumpV: 12.2, jumpX: 3.8, power: 0.93, projSpeed: 7.0, rushSpeed: 7.8 },
    look: {
      scale: 1.22, bulk: -1, head: 'sebas',
      skin: '#dca07c', skinShade: '#ad7553', hair: '#2b2b2b', hairHi: '#777', beard: '#5a5a5a', brow: '#222', glasses: true,
      top: '#2f6fd8', topShade: '#1d4ea3', shirt: '#151515', tie: null, band: null, bolt: true,
      sleeve: '#2f6fd8', forearm: '#2f6fd8', cuff: '#151515',
      pants: '#2f6fd8', pantsShade: '#1d4ea3', shoe: '#2b5fd1', sole: '#f2f2f2', torso: 'jacket',
    },
    alt: { top: '#7b2fd8', topShade: '#5a1fa3', sleeve: '#7b2fd8', forearm: '#7b2fd8', pants: '#222', pantsShade: '#111', shoe: '#7b2fd8' },
    moves: {
      proj: { name: 'REBOBINADO VHS', fx: 'vhs', text: '¡REW!' },
      dp: { name: 'CUERNOS HEAVY', fx: 'horns', text: '¡\\m/!' },
      rush: { name: 'PATINETE VOLADOR', fx: 'board', style: 'fly', text: '¡88 MPH!' },
      super: { name: 'SOLO DE GUITARRA INFINITO', kind: 'bolt', fx: 'metal', text: '¡RIFF!' },
    },
    quotes: {
      intro: ['Rebobina, que esto va para largo.', 'Tengo más metal que tu cubertería.', 'Esta pelea ya la vi en VHS. Ganaba yo.'],
      win: ['Rebobina y vuelve a intentarlo... si te queda cinta.', 'Esto no lo arregla ni el montaje del director.', 'Devuélvela antes del lunes o te cobro recargo.', 'Más metal que una cuchara en el microondas.'],
    },
  },
];

const KO_WORDS = ['¡ZAS!', '¡PAM!', '¡PUM!', '¡CRAC!', '¡ZOK!', '¡BAM!'];
const HEAVY_WORDS = ['¡CATACROC!', '¡KABOOM!', '¡CHOF!', '¡BRUTAL!'];

'use strict';
// Audio 100% sintetizado con WebAudio: sin ficheros externos ni derechos de terceros.
const Audio8 = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const opts = { sfx: true, music: true, voice: true };
  let track = null, nextNote = 0, step = 0, timer = null;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  const ready = () => ctx && ctx.state === 'running';

  function tone(f, dur, { type = 'square', f2 = null, vol = 0.25, when = 0, bus = null, attack = 0.004 } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.3, freq = 2000, q = 1, type = 'bandpass', when = 0, bus = null, f2 = null } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const sfx = {
    hitLight() { noise(0.07, { vol: 0.5, freq: 2600, q: 0.8 }); tone(220, 0.07, { f2: 70, vol: 0.3 }); },
    hitHeavy() { noise(0.16, { vol: 0.7, freq: 1200, q: 0.6, f2: 300 }); tone(150, 0.18, { type: 'sawtooth', f2: 40, vol: 0.4 }); },
    block() { tone(1400, 0.05, { type: 'triangle', f2: 900, vol: 0.25 }); noise(0.05, { vol: 0.25, freq: 5000, q: 3 }); },
    whoosh() { noise(0.12, { vol: 0.18, freq: 600, q: 1.2, f2: 2400 }); },
    jump() { tone(260, 0.12, { type: 'triangle', f2: 520, vol: 0.12 }); },
    land() { noise(0.05, { vol: 0.15, freq: 400, type: 'lowpass' }); },
    proj(kind) {
      if (kind === 'euro') { tone(1318, 0.08, { type: 'square', vol: 0.15 }); tone(1760, 0.18, { type: 'square', vol: 0.15, when: 0.07 }); }
      else if (kind === 'comic') { tone(300, 0.2, { type: 'sawtooth', f2: 900, vol: 0.2 }); noise(0.15, { vol: 0.25, freq: 1500 }); }
      else { tone(500, 0.25, { type: 'sawtooth', f2: 120, vol: 0.2 }); tone(90, 0.25, { type: 'square', vol: 0.12 }); }
    },
    special() { tone(400, 0.2, { type: 'sawtooth', f2: 1200, vol: 0.18 }); noise(0.2, { vol: 0.2, freq: 900, f2: 3000 }); },
    superStart() {
      tone(110, 0.9, { type: 'sawtooth', f2: 880, vol: 0.25 });
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { vol: 0.15, when: 0.08 * i }));
    },
    superHit() { noise(0.3, { vol: 0.6, freq: 800, f2: 200 }); tone(80, 0.35, { type: 'sawtooth', vol: 0.35, f2: 30 }); },
    ko() {
      noise(0.8, { vol: 0.8, freq: 600, type: 'lowpass', f2: 80 });
      tone(200, 1.0, { type: 'sawtooth', f2: 30, vol: 0.4 });
    },
    select() { tone(880, 0.05, { vol: 0.12 }); },
    confirm() { tone(660, 0.07, { vol: 0.15 }); tone(990, 0.12, { vol: 0.15, when: 0.07 }); },
    back() { tone(500, 0.08, { vol: 0.12, f2: 250 }); },
    bell() { [0, 0.25].forEach(w => tone(1568, 0.5, { type: 'triangle', vol: 0.2, when: w })); },
    coin() { tone(988, 0.06, { vol: 0.15 }); tone(1319, 0.3, { vol: 0.15, when: 0.06 }); },
    counter() { tone(1200, 0.1, { type: 'square', vol: 0.15 }); tone(1800, 0.15, { type: 'square', vol: 0.12, when: 0.05 }); },
  };
  function play(name, arg) { if (opts.sfx && sfx[name]) try { sfx[name](arg); } catch (e) { /* audio no crítico */ } }

  // ── Música chiptune original (secuenciador mínimo) ──
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    menu: { bpm: 112, prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], lead: [69, 0, 72, 0, 76, 74, 72, 0, 71, 0, 72, 74, 76, 0, 79, 0] },
    fight: { bpm: 150, prog: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]], lead: [74, 74, 0, 77, 0, 76, 74, 72, 74, 0, 69, 0, 72, 74, 0, 77] },
    win: { bpm: 130, prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], lead: [72, 76, 79, 84, 0, 79, 84, 0, 83, 79, 76, 0, 84, 0, 0, 0] },
  };
  function schedule() {
    if (!ready() || !track) return;
    const t = TRACKS[track], spb = 60 / t.bpm / 4;
    while (nextNote < ctx.currentTime + 0.12) {
      const when = nextNote - ctx.currentTime;
      const bar = Math.floor(step / 16) % t.prog.length, s = step % 16, chord = t.prog[bar];
      if (s % 2 === 0) tone(N(chord[0] - 12), spb * 1.6, { type: 'triangle', vol: 0.35, when, bus: musicBus });
      if (s % 4 === 2) tone(N(chord[(s >> 2) % 3] + 12), spb * 0.9, { type: 'square', vol: 0.06, when, bus: musicBus });
      const ln = t.lead[s];
      if (ln && bar % 2 === 1) tone(N(ln), spb * 1.8, { type: 'square', vol: 0.08, when, bus: musicBus });
      if (s % 4 === 0) tone(120, 0.1, { type: 'sine', f2: 40, vol: 0.5, when, bus: musicBus });
      if (s % 8 === 4) noise(0.1, { vol: 0.25, freq: 1800, when, bus: musicBus });
      if (s % 2 === 1) noise(0.03, { vol: 0.08, freq: 8000, type: 'highpass', when, bus: musicBus });
      nextNote += spb; step++;
    }
  }
  function music(name) {
    if (track === name) return;
    track = name; step = 0;
    if (ctx) nextNote = ctx.currentTime + 0.05;
    if (!timer) timer = setInterval(() => { if (opts.music) schedule(); else if (ctx) nextNote = ctx.currentTime; }, 40);
  }

  // ── Locutor: síntesis de voz del navegador si existe (opcional) ──
  function say(text) {
    if (!opts.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES'; u.rate = 1.05; u.pitch = 0.7; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz */ }
  }

  return { unlock, play, music, say, opts, get state() { return ctx ? ctx.state : 'none'; } };
})();

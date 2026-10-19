'use strict';
// Procedural Web Audio: every sound effect and the music are synthesized, no files needed.
const Sound = {
  ctx: null, master: null, sfxBus: null, musicBus: null, musicFilter: null, duck: null, noiseBuf: null,
  last: {}, wind: null, paused: false, listenerX: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(c.destination);
    this.master = c.createGain(); this.master.connect(comp);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.duck = c.createGain(); this.duck.connect(this.master);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000;
    this.musicFilter.connect(this.duck);
    this.musicBus = c.createGain(); this.musicBus.connect(this.musicFilter);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.applyVolumes();
    Music.init();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  },
  applyVolumes() {
    if (!this.ctx) return;
    const s = Store.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * 0.6, t, 0.02);
  },
  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.setTargetAtTime(p ? 0.25 : 1, t, 0.1);
    if (this.wind) this.wind.g.gain.setTargetAtTime(p ? 0 : this.wind.vol, t, 0.1);
  },
  setDeadEye(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 450 : 20000, this.ctx.currentTime, on ? 0.08 : 0.25);
  },
  setAmbience(vol, freq) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.wind) {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.value = 500;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start();
      this.wind = { g, f, vol: 0 };
    }
    this.wind.vol = vol;
    this.wind.f.frequency.setTargetAtTime(freq || 500, t, 0.5);
    this.wind.g.gain.setTargetAtTime(this.paused ? 0 : vol, t, 0.6);
  },

  // --- primitives ---
  out(o) {
    const c = this.ctx;
    let vol = o.vol == null ? 1 : o.vol, node = this.sfxBus;
    if (o.x != null && c.createStereoPanner) {
      const dx = o.x - this.listenerX;
      vol *= clamp(1 - Math.abs(dx) / 1100, 0.15, 1);
      const p = c.createStereoPanner(); p.pan.value = clamp(dx / 420, -0.8, 0.8); p.connect(this.sfxBus); node = p;
    }
    const g = c.createGain(); g.gain.value = vol; g.connect(node);
    return g;
  },
  noise(dest, t0, dur, type, f0, f1, vol, q, attack) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0, Math.random() * 1.5, dur + 0.05);
  },
  tone(dest, t0, dur, type, f0, f1, vol, attack, lp) {
    const c = this.ctx, o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  play(name, o) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    o = o || {};
    const fn = SFX[name]; if (!fn) return;
    const now = this.ctx.currentTime, lim = SFX_LIMIT[name] || 0.012;
    if (this.last[name] && now - this.last[name] < lim) return;
    this.last[name] = now;
    fn(this, this.out(o), now, o.pitch || 1);
  },
};

const SFX_LIMIT = { gatlingP: 0.04, spin: 0.1,hit: 0.03, dirt: 0.03, wood: 0.03, ric: 0.04, hitmarker: 0.03, foot_dirt: 0.08, foot_wood: 0.08, glass: 0.05, pickup: 0.04, eshot: 0.03, shell: 0.05 };

const SFX = {
  revolver: (S, d, t, p) => { S.noise(d, t, 0.3, 'lowpass', 4200 * p, 300, 0.9); S.noise(d, t, 0.04, 'highpass', 2200, 0, 0.6); S.tone(d, t, 0.14, 'sine', 150 * p, 45, 0.8); },
  revolver2: (S, d, t, p) => { S.noise(d, t, 0.2, 'lowpass', 5200 * p, 500, 0.75); S.noise(d, t, 0.03, 'highpass', 2600, 0, 0.5); S.tone(d, t, 0.1, 'sine', 180 * p, 60, 0.6); },
  rifle: (S, d, t) => {
    S.noise(d, t, 0.5, 'lowpass', 3200, 180, 1); S.noise(d, t, 0.05, 'highpass', 2400, 0, 0.8); S.tone(d, t, 0.22, 'sine', 115, 35, 0.9);
    S.noise(d, t + 0.26, 0.03, 'bandpass', 2600, 0, 0.35, 4); S.noise(d, t + 0.38, 0.04, 'bandpass', 1700, 0, 0.4, 4);
  },
  shotgun: (S, d, t) => { S.noise(d, t, 0.6, 'lowpass', 2600, 140, 1.15); S.tone(d, t, 0.3, 'sine', 95, 30, 1); S.noise(d, t, 0.1, 'bandpass', 900, 0, 0.6); },
  sniper: (S, d, t) => {
    S.noise(d, t, 0.75, 'lowpass', 6000, 140, 1.15); S.noise(d, t, 0.06, 'highpass', 3000, 0, 0.9); S.tone(d, t, 0.36, 'sine', 85, 25, 1);
    S.noise(d, t + 0.18, 0.7, 'lowpass', 900, 200, 0.3, 1, 0.05);
  },
  devil: (S, d, t) => { SFX.revolver(S, d, t, 0.9); S.tone(d, t, 0.25, 'sawtooth', 320, 70, 0.18, 0.005, 1400); },
  eshot: (S, d, t, p) => { S.noise(d, t, 0.22, 'lowpass', 3000 * p, 300, 0.55); S.tone(d, t, 0.1, 'sine', 130 * p, 50, 0.45); },
  eshotgun: (S, d, t) => { S.noise(d, t, 0.45, 'lowpass', 2000, 150, 0.8); S.tone(d, t, 0.2, 'sine', 85, 30, 0.7); },
  erifle: (S, d, t) => { S.noise(d, t, 0.5, 'lowpass', 3600, 150, 0.85); S.noise(d, t, 0.05, 'highpass', 3000, 0, 0.6); S.tone(d, t, 0.25, 'sine', 100, 30, 0.7); },
  gatling: (S, d, t) => { S.noise(d, t, 0.14, 'lowpass', 2600, 400, 0.6); S.tone(d, t, 0.06, 'square', 120, 60, 0.2); },
  empty: (S, d, t) => { S.noise(d, t, 0.025, 'bandpass', 3200, 0, 0.5, 6); },
  reload: (S, d, t) => { S.noise(d, t, 0.05, 'bandpass', 2000, 0, 0.4, 5); S.noise(d, t + 0.07, 0.04, 'bandpass', 1300, 0, 0.35, 5); },
  reloadEnd: (S, d, t) => { S.noise(d, t, 0.03, 'bandpass', 2900, 0, 0.5, 6); S.noise(d, t + 0.04, 0.12, 'highpass', 4500, 0, 0.12); },
  shell: (S, d, t) => { S.tone(d, t, 0.07, 'triangle', 3400, 2900, 0.07); S.tone(d, t + 0.09, 0.05, 'triangle', 3800, 0, 0.04); },
  pump: (S, d, t) => { S.noise(d, t, 0.06, 'bandpass', 1100, 0, 0.5, 3); S.noise(d, t + 0.12, 0.06, 'bandpass', 1500, 0, 0.5, 3); },
  swap: (S, d, t) => { S.noise(d, t, 0.04, 'bandpass', 1500, 0, 0.35, 3); S.noise(d, t + 0.05, 0.03, 'bandpass', 2600, 0, 0.3, 4); },
  hit: (S, d, t) => { S.noise(d, t, 0.09, 'lowpass', 900, 200, 0.55); S.tone(d, t, 0.05, 'sine', 210, 110, 0.3); },
  hitmarker: (S, d, t) => { S.tone(d, t, 0.035, 'square', 1900, 0, 0.07); },
  headshot: (S, d, t) => { S.tone(d, t, 0.06, 'square', 2500, 0, 0.08); S.tone(d, t + 0.04, 0.12, 'sine', 3300, 0, 0.18); },
  crit: (S, d, t) => { S.tone(d, t, 0.32, 'sine', 1500, 2700, 0.25); S.tone(d, t, 0.25, 'triangle', 3000, 0, 0.08); },
  ric: (S, d, t) => { S.tone(d, t, 0.14, 'sine', rand(2200, 3200), rand(900, 1400), 0.12); S.noise(d, t, 0.05, 'highpass', 3000, 0, 0.25); },
  wood: (S, d, t) => { S.noise(d, t, 0.07, 'bandpass', 700, 0, 0.55, 2); },
  dirt: (S, d, t) => { S.noise(d, t, 0.12, 'lowpass', 520, 0, 0.35); },
  glass: (S, d, t) => { S.noise(d, t, 0.2, 'highpass', 5000, 0, 0.35); for (let i = 0; i < 4; i++) S.tone(d, t + i * 0.025, 0.08, 'sine', rand(3000, 5200), 0, 0.06); },
  explosion: (S, d, t) => { S.noise(d, t, 1.3, 'lowpass', 1400, 50, 1.5, 0.7, 0.01); S.tone(d, t, 0.8, 'sine', 70, 20, 1.2); S.noise(d, t + 0.05, 0.5, 'highpass', 1800, 0, 0.2); },
  foot_dirt: (S, d, t) => { S.noise(d, t, 0.06, 'lowpass', 380, 0, 0.16); },
  foot_wood: (S, d, t) => { S.noise(d, t, 0.05, 'bandpass', 1000, 0, 0.18, 2); S.tone(d, t, 0.04, 'sine', 190, 0, 0.08); },
  jump: (S, d, t) => { S.noise(d, t, 0.08, 'lowpass', 650, 0, 0.18); },
  land: (S, d, t) => { S.noise(d, t, 0.1, 'lowpass', 320, 0, 0.32); },
  dodge: (S, d, t) => { S.noise(d, t, 0.32, 'bandpass', 700, 180, 0.4, 1.2, 0.05); },
  hurt: (S, d, t) => { S.tone(d, t, 0.2, 'sawtooth', 190, 105, 0.26, 0.01, 900); S.noise(d, t, 0.08, 'lowpass', 600, 0, 0.3); },
  enemyHurt: (S, d, t) => { S.tone(d, t, 0.14, 'sawtooth', rand(140, 170), 95, 0.17, 0.01, 800); },
  enemyDie: (S, d, t) => { S.tone(d, t, 0.45, 'sawtooth', rand(190, 220), 65, 0.22, 0.01, 700); S.noise(d, t + 0.25, 0.2, 'lowpass', 300, 0, 0.35); },
  bossHurt: (S, d, t) => { S.tone(d, t, 0.22, 'sawtooth', 110, 70, 0.25, 0.01, 600); },
  alert: (S, d, t) => { S.tone(d, t, 0.06, 'square', 520, 0, 0.06); S.tone(d, t + 0.07, 0.08, 'square', 780, 0, 0.06); },
  pickup: (S, d, t) => { S.tone(d, t, 0.05, 'square', 1320, 0, 0.07); S.tone(d, t + 0.05, 0.1, 'square', 1760, 0, 0.07); },
  ammo: (S, d, t) => { S.noise(d, t, 0.05, 'bandpass', 1500, 0, 0.4, 3); S.noise(d, t + 0.07, 0.05, 'bandpass', 1900, 0, 0.4, 3); S.tone(d, t + 0.1, 0.08, 'square', 660, 0, 0.05); },
  heal: (S, d, t) => { S.tone(d, t, 0.15, 'sine', 523, 0, 0.18); S.tone(d, t + 0.1, 0.25, 'sine', 784, 0, 0.18); },
  gold: (S, d, t) => { [784, 988, 1175, 1568].forEach((f, i) => S.tone(d, t + i * 0.07, 0.18, 'square', f, 0, 0.07)); },
  checkpoint: (S, d, t) => { [523, 659, 784].forEach((f, i) => S.tone(d, t + i * 0.09, 0.3, 'triangle', f, 0, 0.2)); },
  deOn: (S, d, t) => { S.tone(d, t, 0.6, 'sine', 900, 110, 0.3); S.noise(d, t, 0.6, 'lowpass', 2500, 180, 0.35, 1, 0.02); },
  deOff: (S, d, t) => { S.tone(d, t, 0.4, 'sine', 120, 700, 0.22); },
  heartbeat: (S, d, t) => { S.tone(d, t, 0.12, 'sine', 62, 38, 0.55); S.tone(d, t + 0.17, 0.12, 'sine', 58, 36, 0.4); },
  menuMove: (S, d, t) => { S.tone(d, t, 0.035, 'square', 660, 0, 0.05); },
  menuSelect: (S, d, t) => { S.tone(d, t, 0.05, 'square', 880, 0, 0.06); S.tone(d, t + 0.05, 0.07, 'square', 1320, 0, 0.06); },
  menuBack: (S, d, t) => { S.tone(d, t, 0.06, 'square', 520, 330, 0.06); },
  buy: (S, d, t) => { for (let i = 0; i < 6; i++) S.tone(d, t + i * 0.045, 0.1, 'square', rand(1400, 2600), 0, 0.05); },
  deny: (S, d, t) => { S.tone(d, t, 0.16, 'square', 160, 120, 0.1); },
  complete: (S, d, t) => {
    [[57, 0], [61, 0.14], [64, 0.28], [69, 0.42]].forEach(([n, o]) => S.tone(d, t + o, 0.5, 'sawtooth', mtof(n), 0, 0.12, 0.02, 2200));
    [69, 73, 76].forEach(n => S.tone(d, t + 0.6, 1.4, 'sawtooth', mtof(n), 0, 0.1, 0.05, 1800));
  },
  failed: (S, d, t) => { [64, 63, 62, 61].forEach((n, i) => S.tone(d, t + i * 0.3, 0.5, 'sawtooth', mtof(n - 12), 0, 0.14, 0.02, 1000)); },
  bossIntro: (S, d, t) => {
    [45, 48, 52].forEach(n => S.tone(d, t, 2.2, 'sawtooth', mtof(n), 0, 0.12, 0.15, 900));
    S.noise(d, t, 2.5, 'lowpass', 400, 60, 0.7, 1, 0.02); S.tone(d, t, 2, 'sine', 55, 40, 0.8);
  },
  gate: (S, d, t) => { S.tone(d, t, 0.6, 'sawtooth', 85, 140, 0.15, 0.05, 500); S.noise(d, t + 0.5, 0.3, 'lowpass', 250, 0, 0.6); },
  fuse: (S, d, t) => { S.noise(d, t, 0.18, 'highpass', 4200, 0, 0.12); },
  steam: (S, d, t) => { S.noise(d, t, 0.9, 'highpass', 1800, 900, 0.32, 1, 0.08); },
  rumble: (S, d, t) => { S.noise(d, t, 1.0, 'lowpass', 160, 0, 0.6, 1, 0.2); },
  rock: (S, d, t) => { S.noise(d, t, 0.3, 'lowpass', 340, 0, 0.55); },
  laugh: (S, d, t) => { [330, 300, 268].forEach((f, i) => S.tone(d, t + i * 0.11, 0.1, 'triangle', f, f * 0.9, 0.13)); },
  roar: (S, d, t) => { S.tone(d, t, 0.8, 'sawtooth', 95, 65, 0.35, 0.05, 500); S.noise(d, t, 0.7, 'lowpass', 500, 0, 0.3); },
  bell: (S, d, t) => { S.tone(d, t, 1.6, 'sine', 880, 0, 0.3); S.tone(d, t, 1.2, 'sine', 1320, 0, 0.14); S.tone(d, t, 0.8, 'sine', 2210, 0, 0.05); },
  whistle: (S, d, t) => { S.tone(d, t, 1.0, 'sine', 520, 0, 0.12, 0.05); S.tone(d, t, 1.0, 'sine', 622, 0, 0.12, 0.05); },
  crate: (S, d, t) => { S.noise(d, t, 0.25, 'bandpass', 500, 0, 0.55, 1.5); S.noise(d, t + 0.03, 0.15, 'bandpass', 900, 0, 0.35, 2); },
  throw: (S, d, t) => { S.noise(d, t, 0.18, 'bandpass', 900, 400, 0.25, 1.5, 0.03); },
  lock: (S, d, t) => { S.tone(d, t, 0.07, 'sine', 1250, 0, 0.16); },
  clack: (S, d, t) => { S.noise(d, t, 0.05, 'bandpass', 420, 0, 0.35, 3); S.noise(d, t + 0.09, 0.05, 'bandpass', 380, 0, 0.3, 3); },
  bow: (S, d, t) => { S.tone(d, t, 0.18, 'triangle', 240, 150, 0.35); S.noise(d, t, 0.1, 'bandpass', 1400, 600, 0.3, 2); S.noise(d, t + 0.02, 0.25, 'highpass', 3000, 0, 0.08); },
  draw: (S, d, t) => { S.noise(d, t, 0.35, 'bandpass', 500, 1200, 0.18, 6, 0.1); },
  boomLaunch: (S, d, t) => { S.noise(d, t, 0.25, 'lowpass', 900, 120, 0.9); S.tone(d, t, 0.2, 'sine', 140, 55, 0.8); S.noise(d, t + 0.02, 0.4, 'highpass', 2500, 0, 0.1); },
  gatlingP: (S, d, t) => { S.noise(d, t, 0.12, 'lowpass', 3400, 500, 0.55); S.tone(d, t, 0.05, 'square', 140, 70, 0.12); },
  spin: (S, d, t) => { S.noise(d, t, 0.03, 'bandpass', 2200, 0, 0.18, 8); S.noise(d, t + 0.06, 0.03, 'bandpass', 1900, 0, 0.14, 8); },
  splash: (S, d, t) => { S.noise(d, t, 0.6, 'lowpass', 2400, 300, 0.7, 0.8, 0.02); S.noise(d, t + 0.1, 0.4, 'highpass', 3000, 0, 0.15); },
  rise: (S, d, t) => { S.tone(d, t, 1.1, 'sawtooth', 70, 50, 0.22, 0.2, 400); S.noise(d, t, 0.8, 'lowpass', 300, 80, 0.5, 1, 0.1); },
  swing: (S, d, t) => { S.noise(d, t, 0.22, 'bandpass', 900, 300, 0.45, 1.2, 0.02); },
  stomp: (S, d, t) => { S.tone(d, t, 0.2, 'sine', 80, 40, 0.6); S.noise(d, t, 0.15, 'lowpass', 300, 0, 0.4); },
};

const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

// Spaghetti-western sequencer with layers that fade by intensity.
const Music = {
  mode: 'silent', layers: {}, step: 0, nextT: 0, song: 'A', clack: false,
  MODES: {
    silent:  { bass: 0, guitar: 0, mel: 0, drums: 0, brass: 0 },
    menu:    { bass: 0.5, guitar: 0.55, mel: 0.5, drums: 0, brass: 0 },
    explore: { bass: 0.45, guitar: 0.5, mel: 0.3, drums: 0.18, brass: 0 },
    combat:  { bass: 0.6, guitar: 0.6, mel: 0.18, drums: 0.65, brass: 0.28 },
    boss:    { bass: 0.7, guitar: 0.45, mel: 0, drums: 0.8, brass: 0.6 },
  },
  SONGS: {
    A: { bpm: 90, prog: [[45, 57, 60, 64], [43, 55, 59, 62], [41, 53, 57, 60], [40, 52, 56, 59]],
      mel: [[0, 0, 76, 6], [0, 6, 81, 2], [0, 8, 76, 4], [0, 12, 74, 2], [0, 14, 72, 2], [1, 0, 74, 6], [1, 6, 67, 2], [1, 8, 71, 4], [1, 12, 74, 4],
        [2, 0, 72, 4], [2, 4, 69, 4], [2, 8, 65, 4], [2, 12, 69, 4], [3, 0, 71, 6], [3, 6, 68, 2], [3, 8, 64, 8]] },
    B: { bpm: 112, prog: [[45, 57, 60, 64], [45, 57, 60, 64], [41, 53, 57, 60], [40, 52, 56, 59]],
      mel: [[0, 0, 69, 3], [0, 3, 69, 1], [0, 4, 72, 4], [0, 8, 76, 6], [0, 14, 74, 2], [1, 0, 72, 4], [1, 4, 71, 4], [1, 8, 69, 8],
        [2, 0, 65, 3], [2, 3, 65, 1], [2, 4, 69, 4], [2, 8, 72, 6], [2, 14, 71, 2], [3, 0, 68, 4], [3, 4, 71, 4], [3, 8, 76, 8]] },
  },
  init() {
    const c = Sound.ctx;
    for (const k of ['bass', 'guitar', 'mel', 'drums', 'brass']) { const g = c.createGain(); g.gain.value = 0; g.connect(Sound.musicBus); this.layers[k] = g; }
    this.nextT = c.currentTime + 0.1;
    this.setMode(this.mode, true);
  },
  setMode(m, force) {
    if (!this.MODES[m]) return;
    if (m === this.mode && !force) return;
    this.mode = m;
    const song = m === 'boss' ? 'B' : 'A';
    if (song !== this.song) { this.song = song; this.step = 0; }
    if (!Sound.ctx || !this.layers.bass) return;
    const t = Sound.ctx.currentTime, tgt = this.MODES[m];
    for (const k in tgt) this.layers[k].gain.setTargetAtTime(tgt[k], t, 0.8);
  },
  update() {
    const c = Sound.ctx;
    if (!c || c.state !== 'running' || !this.layers.bass) return;
    if (this.nextT < c.currentTime - 0.3) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.2) {
      this.schedule(this.step, this.nextT);
      this.nextT += 60 / this.SONGS[this.song].bpm / 4;
      this.step++;
    }
  },
  schedule(step, t) {
    const S = Sound, song = this.SONGS[this.song], bar = Math.floor(step / 16) % 4, s = step % 16, loop = Math.floor(step / 64);
    const ch = song.prog[bar], L = this.layers, beat = 60 / song.bpm / 4;
    if (this.clack && s % 8 === 0) SFX.clack(S, S.sfxBus, t);
    if (this.mode === 'silent') return;
    // bass: boom on 1, fifth on 3
    if (s === 0) this.bass(L.bass, t, ch[0], beat * 6);
    if (s === 8) this.bass(L.bass, t, ch[0] + 7, beat * 5);
    if (this.song === 'B' && (s === 6 || s === 14)) this.bass(L.bass, t, ch[0], beat * 2);
    // guitar strum on the off-beats
    if (s === 4 || s === 12) this.strum(L.guitar, t, ch, 0.09);
    if ((s === 6 || s === 14) && this.mode !== 'explore' && this.mode !== 'menu') this.strum(L.guitar, t, ch, 0.05);
    // drums
    if (s % 2 === 0) S.noise(L.drums, t, 0.04, 'highpass', 6500, 0, s % 4 === 0 ? 0.08 : 0.05);
    if (s === 0 || s === 8 || (this.song === 'B' && s === 10)) S.tone(L.drums, t, 0.16, 'sine', 120, 40, 0.7);
    if (s === 4 || s === 12) S.noise(L.drums, t, 0.12, 'bandpass', 1800, 0, 0.35, 1);
    if (this.song === 'B' && bar === 3 && s >= 12) S.tone(L.drums, t, 0.12, 'sine', 180 - (s - 12) * 20, 60, 0.4);
    // brass pad
    if (s === 0 && this.song === 'A') for (const n of ch.slice(1)) S.tone(L.brass, t, beat * 15, 'sawtooth', mtof(n), 0, 0.05, beat * 4, 1100);
    // melody: whistle for A (every other loop when exploring), brass lead for B
    if (this.song === 'A' && (this.mode === 'menu' || loop % 2 === 0)) {
      for (const [b, st, n, len] of song.mel) if (b === bar && st === s) this.whistle(L.mel, t, n, len * beat);
    }
    if (this.song === 'B') for (const [b, st, n, len] of song.mel) if (b === bar && st === s) S.tone(L.brass, t, len * beat, 'sawtooth', mtof(n), 0, 0.1, 0.03, 1500);
  },
  bass(dest, t, n, dur) { Sound.tone(dest, t, dur, 'triangle', mtof(n), 0, 0.5, 0.01); Sound.tone(dest, t, dur * 0.6, 'sine', mtof(n - 12), 0, 0.35, 0.01); },
  strum(dest, t, ch, vol) {
    const notes = ch.slice(1).concat([ch[1] + 12]);
    notes.forEach((n, i) => Sound.tone(dest, t + i * 0.014, 0.4, 'sawtooth', mtof(n), 0, vol, 0.004, 2400 - i * 300));
  },
  whistle(dest, t, n, dur) {
    const c = Sound.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = mtof(n);
    lfo.frequency.value = 5.5; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.detune);
    o.detune.setValueAtTime(-60, t); o.detune.linearRampToValueAtTime(0, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + Math.max(0.06, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(g); g.connect(dest);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.15); lfo.stop(t + dur + 0.15);
  },
};

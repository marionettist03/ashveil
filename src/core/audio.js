// Synthesised sound effects + ambient music (no audio files needed).
export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.master = null;
    this.musicGain = null;
    this.noiseBuf = null;
    this.mood = 'none';
    this._musicTimer = null;
    this._last = {};
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.mood !== 'none') { const m = this.mood; this.mood = 'none'; this.music(m); }
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.2);
  }

  // ---- low-level voices
  _tone(type, f0, f1, dur, vol, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol, filter = 'bandpass', f0 = 1200, f1 = 400, q = 1, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** Play a named effect. Rate-limited per name so swarms don't clip. */
  play(name, opt = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const now = this.ctx.currentTime;
    const gap = opt.gap ?? 0.03;
    if (this._last[name] && now - this._last[name] < gap) return;
    this._last[name] = now;
    const v = opt.vol ?? 1;
    switch (name) {
      case 'swing': this._noise(0.12, 0.25 * v, 'bandpass', 2400, 600, 1.4); break;
      case 'heavy': this._noise(0.22, 0.32 * v, 'bandpass', 900, 200, 1.2); this._tone('sine', 90, 50, 0.2, 0.25 * v); break;
      case 'hit': this._tone('square', 180, 60, 0.08, 0.16 * v); this._noise(0.06, 0.25 * v, 'lowpass', 2500, 500); break;
      case 'crit': this._tone('square', 420, 120, 0.12, 0.16 * v); this._tone('triangle', 1400, 1200, 0.18, 0.12 * v); this._noise(0.08, 0.3 * v, 'lowpass', 3000, 600); break;
      case 'hurt': this._tone('sawtooth', 220, 90, 0.18, 0.18 * v); this._noise(0.1, 0.2 * v, 'lowpass', 1500, 300); break;
      case 'die': this._noise(0.35, 0.3 * v, 'lowpass', 1600, 120); this._tone('sine', 140, 40, 0.3, 0.2 * v); break;
      case 'shoot': this._noise(0.08, 0.2 * v, 'highpass', 3000, 1500, 0.7); this._tone('triangle', 900, 500, 0.07, 0.07 * v); break;
      case 'fire': this._noise(0.3, 0.28 * v, 'bandpass', 600, 1800, 0.8); break;
      case 'boom': this._noise(0.6, 0.45 * v, 'lowpass', 1200, 60); this._tone('sine', 80, 30, 0.5, 0.35 * v); break;
      case 'dash': this._noise(0.16, 0.22 * v, 'bandpass', 700, 2600, 1.2); break;
      case 'coin': this._tone('square', 1320, 1320, 0.05, 0.06 * v); this._tone('square', 1760, 1760, 0.08, 0.06 * v, 0.05); break;
      case 'loot': [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.18, 0.1 * v, i * 0.06)); break;
      case 'legend': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.12 * v, i * 0.07)); break;
      case 'level': [392, 494, 587, 784].forEach((f, i) => this._tone('square', f, f, 0.16, 0.07 * v, i * 0.08)); break;
      case 'ui': this._tone('square', 660, 660, 0.04, 0.05 * v); break;
      case 'uiBack': this._tone('square', 440, 440, 0.04, 0.05 * v); break;
      case 'deny': this._tone('square', 160, 140, 0.12, 0.08 * v); break;
      case 'potion': this._tone('sine', 400, 900, 0.25, 0.15 * v); this._noise(0.2, 0.08 * v, 'bandpass', 2000, 4000, 2); break;
      case 'spawn': this._noise(0.4, 0.12 * v, 'bandpass', 300, 1200, 2); break;
      case 'gate': this._noise(0.5, 0.2 * v, 'lowpass', 400, 100); this._tone('sine', 70, 55, 0.5, 0.2 * v); break;
      case 'smith': this._tone('square', 1200, 1100, 0.06, 0.08 * v); this._tone('triangle', 2400, 2200, 0.25, 0.06 * v, 0.02); break;
      case 'ult': this._noise(0.5, 0.3 * v, 'bandpass', 300, 3000, 1); [262, 330, 392, 523].forEach((f, i) => this._tone('sawtooth', f, f, 0.25, 0.05 * v, i * 0.04)); break;
      case 'roar': this._noise(0.9, 0.35 * v, 'bandpass', 300, 120, 0.8); this._tone('sawtooth', 110, 60, 0.9, 0.15 * v); break;
      case 'bell': this.bell(v); break;
      case 'step': this._noise(0.05, 0.05 * v, 'lowpass', 600, 200); break;
      case 'break': this._noise(0.2, 0.25 * v, 'bandpass', 1400, 300, 1); this._tone('square', 300, 120, 0.1, 0.06 * v); break;
    }
  }

  /** Big inharmonic church-bell toll. */
  bell(v = 1, dest) {
    if (!this.ctx) return;
    const partials = [[0.5, 0.5], [1, 1], [1.19, 0.6], [1.5, 0.45], [2, 0.35], [2.52, 0.2], [3.01, 0.12]];
    const base = 98;
    for (const [m, a] of partials) this._tone('sine', base * m, base * m * 0.998, 3.2 * (1.2 - m / 4), 0.16 * a * v, 0, dest);
    this._noise(0.08, 0.15 * v, 'bandpass', 3000, 2000, 2, 0, dest);
  }

  /** Ambient generative music: 'calm' (camp), 'stage', 'boss', or 'none'. */
  music(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this._drone) { try { this._drone.forEach((n) => n.stop()); } catch (e) { /* already stopped */ } this._drone = null; }
    if (!this.ctx || mood === 'none') return;
    const c = this.ctx;
    // drone
    const root = mood === 'boss' ? 55 : mood === 'calm' ? 65.4 : 61.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mood === 'boss' ? 700 : 420;
    const dg = c.createGain(); dg.gain.value = 0.0001;
    dg.gain.setTargetAtTime(0.22, c.currentTime, 1.5);
    lp.connect(dg); dg.connect(this.musicGain);
    const oscs = [root, root * 1.005, root * 1.5].map((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(); return o;
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this._drone = [...oscs, lfo];
    // melody: minor pentatonic notes on a slow clock
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const step = mood === 'boss' ? 0.32 : mood === 'calm' ? 0.9 : 0.7;
    let n = 0;
    const tick = () => {
      if (!this.ctx || this.mood !== mood) return;
      n++;
      if (mood === 'boss') {
        const f = root * 2 * (n % 8 < 4 ? 1 : 1.189);
        this._tone('square', f, f, 0.12, 0.05, 0, this.musicGain);
        if (n % 16 === 0) this.bell(0.5, this.musicGain);
      } else {
        if (Math.random() < (mood === 'calm' ? 0.5 : 0.4)) {
          const semi = scale[Math.floor(Math.random() * scale.length)] + 12 * (Math.random() < 0.3 ? 1 : 0);
          const f = root * 4 * Math.pow(2, semi / 12);
          this._tone('triangle', f, f, 1.6, 0.05, 0, this.musicGain);
          this._tone('sine', f * 2, f * 2, 0.9, 0.012, 0.18, this.musicGain);
        }
        if (mood === 'stage' && n % 24 === 0) this.bell(0.25, this.musicGain);
      }
    };
    this._musicTimer = setInterval(tick, step * 1000);
  }
}

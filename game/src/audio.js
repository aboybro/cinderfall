// All sound is synthesized with WebAudio: no audio files, nothing to download.
// A tiny sequencer plays a low, smouldering loop; effects are short oscillator/noise bursts.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone(720, 0.09, 'square', 0.05, 240); }
  hit() { this.noise(0.06, 0.08, 2400); }
  kill() { this.tone(320, 0.16, 'sawtooth', 0.07, 90); this.noise(0.1, 0.06, 1200); }
  pickup() { this.tone(880, 0.07, 'sine', 0.06, 1320); }
  levelUp() {
    this.tone(523, 0.12, 'triangle', 0.1);
    this.tone(659, 0.12, 'triangle', 0.1, null, 0.09);
    this.tone(784, 0.2, 'triangle', 0.1, null, 0.18);
  }
  hurt() { this.tone(160, 0.18, 'sawtooth', 0.12, 70); }
  dash() { this.noise(0.14, 0.1, 3200); }
  boss() { this.tone(98, 0.7, 'sawtooth', 0.14, 49); this.tone(147, 0.7, 'sawtooth', 0.08, 73, 0.05); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, null, i * 0.13));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, null, i * 0.16));
  }

  // A slow minor-key loop: root drone plus a wandering ember melody.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const bass = [110, 87.31, 98, 110];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const bar = Math.floor(this.step / 8) % 4;
      if (this.step % 8 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bass[bar];
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.5, this.ctx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.2);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 2.3);
      }
      if (this.step % 2 === 0 && Math.random() < 0.55) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.22, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.9);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1);
      }
      this.step += 1;
    }, 280);
  }
}

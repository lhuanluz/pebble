import type { PegKind } from './content';

export class PeideAudio {
  private ctx: AudioContext | null = null;

  unlock() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.72), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  fart(kind: PegKind, combo = 0) {
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    const duration = kind === 'villain' ? 0.28 : kind === 'story' ? 0.18 : kind === 'spark' ? 0.11 : 0.14;
    const base = kind === 'villain' ? 54 : kind === 'story' ? 72 : kind === 'spark' ? 115 : 88;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    mod.type = 'sine';
    osc.frequency.setValueAtTime(base + Math.min(combo, 8) * 3, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(32, base * 0.48), start + duration);
    mod.frequency.setValueAtTime(18 + combo, start);
    modGain.gain.setValueAtTime(kind === 'spark' ? 18 : 32, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(kind === 'spark' ? 560 : 340, start);
    filter.Q.setValueAtTime(8, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(kind === 'villain' ? 0.15 : kind === 'story' ? 0.11 : 0.075, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    mod.start(start);
    osc.stop(start + duration + 0.03);
    mod.stop(start + duration + 0.03);
  }

  win() {
    [392, 523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, 0.12, 'triangle', 0.06, i * 0.08));
  }
}

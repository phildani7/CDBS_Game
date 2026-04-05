// ─────────────────────────────────────────────────────────────
//  Scripture Breaker – Web Audio Synthesis
//  All sounds are synthesized - no audio files needed
// ─────────────────────────────────────────────────────────────

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.initialized = false;
    this.currentPattern = null;
    this.musicTimer = null;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.6;
    }
    return this.muted;
  }

  _tone(freq, duration, type = 'square', gain = 0.3, dest = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  _sweep(startFreq, endFreq, duration, type = 'sawtooth', gain = 0.2) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  playLaunch() {
    this._sweep(220, 880, 0.15, 'sawtooth', 0.15);
    this._tone(660, 0.08, 'sine', 0.1);
  }

  playPaddleHit() {
    this._tone(520, 0.06, 'square', 0.15);
    this._tone(780, 0.04, 'sine', 0.1);
  }

  playBrickBreak(category = 'other') {
    const freqMap = {
      god: [880, 1100, 1320],
      good: [660, 880, 1050],
      connector: [440, 550, 660],
      other: [500, 630, 750],
      bad: [220, 165, 130]
    };
    const freqs = freqMap[category] || freqMap.other;
    const t = this.ctx ? this.ctx.currentTime : 0;
    freqs.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.1, 'square', 0.12), i * 30);
    });

    if (category === 'god') {
      setTimeout(() => this._tone(1760, 0.2, 'sine', 0.08), 60);
    } else if (category === 'bad') {
      this._sweep(300, 100, 0.3, 'sawtooth', 0.1);
    }
  }

  playPowerUp(kind) {
    const patterns = {
      expand: () => { this._tone(440, 0.1, 'sine', 0.15); this._tone(660, 0.1, 'sine', 0.12); },
      slow: () => { this._sweep(880, 330, 0.2, 'triangle', 0.12); },
      multi: () => {
        [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this._tone(f, 0.08, 'sine', 0.1), i * 40));
      },
      guard: () => {
        [330, 440, 550].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.12), i * 50));
      },
      life: () => {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, 'sine', 0.1), i * 60));
      },
      reveal: () => {
        this._tone(880, 0.15, 'sine', 0.1);
        setTimeout(() => this._tone(1320, 0.2, 'sine', 0.08), 80);
      }
    };
    (patterns[kind] || patterns.expand)();
  }

  playWaveClear() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.25, 'sine', 0.15), i * 100);
    });
    setTimeout(() => this._tone(1568, 0.5, 'triangle', 0.08), 400);
  }

  playGuardSave() {
    [392, 494, 587].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.1, 'triangle', 0.12), i * 50);
    });
  }

  playLoseLife() {
    this._sweep(440, 110, 0.4, 'sawtooth', 0.15);
    setTimeout(() => this._tone(110, 0.3, 'triangle', 0.1), 200);
  }

  playGameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.4, 'triangle', 0.15), i * 200);
    });
  }

  playMenuSelect() {
    this._tone(880, 0.05, 'sine', 0.1);
    setTimeout(() => this._tone(1100, 0.08, 'sine', 0.08), 40);
  }

  // ── Ambient music patterns ──────────────────────────────

  startMusic(scene = 'serve') {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    this.currentPattern = scene;
    this._scheduleMusic(scene);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentPattern = null;
  }

  _scheduleMusic(scene) {
    const patterns = {
      serve: { bpm: 72, notes: [262, 0, 330, 0, 392, 0, 330, 0], type: 'sine' },
      playing: { bpm: 100, notes: [330, 392, 440, 494, 523, 494, 440, 392, 330, 262, 294, 330, 392, 440, 523, 494], type: 'triangle' },
      gameover: { bpm: 60, notes: [330, 294, 262, 247, 220, 196, 175, 165], type: 'sine' }
    };
    const p = patterns[scene] || patterns.serve;
    const interval = (60 / p.bpm) * 1000;
    let step = 0;

    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const note = p.notes[step % p.notes.length];
      if (note > 0) {
        this._tone(note, interval / 1000 * 0.8, p.type, 0.06, this.musicGain);
      }
      step++;
    }, interval);
  }
}

// Synthesised sound effects: every blip is an oscillator with an envelope,
// so the game ships no audio files. The context is created lazily on the
// first user gesture (browsers refuse audio before one) and M mutes.

const MASTER_GAIN = 0.16;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
    return true;
  }

  /** One enveloped tone. `slide` bends the pitch to `to` over the duration. */
  function tone(freq, to, duration, type, volume, delay = 0) {
    if (!ensure()) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(880, 320, 0.08, 'square', 0.25);
    },
    hit() {
      tone(220, 90, 0.07, 'sawtooth', 0.3);
    },
    explode(big) {
      tone(big ? 160 : 240, 40, big ? 0.4 : 0.22, 'sawtooth', 0.5);
      tone(90, 30, big ? 0.5 : 0.3, 'sine', 0.6, 0.02);
    },
    hurt() {
      tone(300, 60, 0.3, 'sawtooth', 0.6);
    },
    pickup() {
      tone(1180, 1560, 0.06, 'sine', 0.22);
    },
    levelup() {
      tone(523, 523, 0.1, 'triangle', 0.4);
      tone(659, 659, 0.1, 'triangle', 0.4, 0.09);
      tone(784, 784, 0.16, 'triangle', 0.45, 0.18);
    },
    dash() {
      tone(300, 900, 0.12, 'sine', 0.3);
    },
    wave() {
      tone(392, 392, 0.12, 'triangle', 0.35);
      tone(587, 587, 0.2, 'triangle', 0.35, 0.1);
    },
    gameover() {
      tone(440, 440, 0.25, 'triangle', 0.4);
      tone(349, 349, 0.25, 'triangle', 0.4, 0.22);
      tone(262, 130, 0.6, 'triangle', 0.45, 0.44);
    },
    choose() {
      tone(740, 990, 0.09, 'sine', 0.35);
    },
  };
}

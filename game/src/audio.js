// Every sound in Emberkeeper is synthesised with WebAudio: short oscillator tones
// and filtered noise, no audio files. The context is created on the first user
// gesture (browsers refuse sound before one), and M toggles mute, remembered in
// localStorage.
import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let master = null;
  let muted = readMuted();

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ frequency, slideTo = null, seconds = 0.12, type = 'sine', volume = 0.2, delay = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function noise({ seconds = 0.3, frequency = 1200, volume = 0.25, delay = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be off: the mute then lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() {
      tone({ frequency: 660, seconds: 0.06, type: 'triangle', volume: 0.15 });
    },
    collect(combo) {
      const base = 520 + Math.min(combo, 8) * 45;
      tone({ frequency: base, slideTo: base * 1.5, seconds: 0.1, type: 'sine', volume: 0.18 });
      tone({ frequency: base * 2, seconds: 0.07, type: 'sine', volume: 0.08, delay: 0.02 });
    },
    star() {
      tone({ frequency: 784, seconds: 0.1, type: 'triangle', volume: 0.18 });
      tone({ frequency: 1046, seconds: 0.14, type: 'triangle', volume: 0.18, delay: 0.07 });
      tone({ frequency: 1318, seconds: 0.2, type: 'sine', volume: 0.15, delay: 0.14 });
    },
    flare() {
      noise({ seconds: 0.35, frequency: 2400, volume: 0.3 });
      tone({ frequency: 180, slideTo: 720, seconds: 0.3, type: 'sawtooth', volume: 0.1 });
    },
    hit() {
      tone({ frequency: 160, slideTo: 55, seconds: 0.35, type: 'sawtooth', volume: 0.3 });
      noise({ seconds: 0.2, frequency: 500, volume: 0.25 });
    },
    wave() {
      tone({ frequency: 523, seconds: 0.12, type: 'triangle', volume: 0.16 });
      tone({ frequency: 659, seconds: 0.12, type: 'triangle', volume: 0.16, delay: 0.09 });
      tone({ frequency: 784, seconds: 0.2, type: 'triangle', volume: 0.16, delay: 0.18 });
    },
    heart() {
      tone({ frequency: 880, seconds: 0.12, type: 'sine', volume: 0.16 });
      tone({ frequency: 1174, seconds: 0.18, type: 'sine', volume: 0.14, delay: 0.08 });
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((frequency, index) => {
        tone({ frequency, seconds: 0.28, type: 'triangle', volume: 0.16, delay: index * 0.11 });
      });
    },
    lose() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        tone({ frequency, seconds: 0.3, type: 'sine', volume: 0.16, delay: index * 0.14 });
      });
    },
  };
}

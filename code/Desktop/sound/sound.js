
window.WebOSSound = (function () {

  let ctx = null;
  let master = null;
  let volume = 0.5;

  const stored = parseFloat(localStorage.getItem('volume'));
  if (!isNaN(stored)) volume = Math.max(0, Math.min(1, stored));

  function ready() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(opts) {
    if (volume <= 0 || !ready()) return;

    const now = ctx.currentTime;
    const start = now + (opts.delay || 0);
    const dur = opts.dur || 0.12;

    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.from, start);
    if (opts.to && opts.to !== opts.from) {
      osc.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    }

    const gain = ctx.createGain();
    const peak = opts.gain === undefined ? 0.22 : opts.gain;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  // the recorded sounds are the real thing, the synth stays as a fallback
  // for browsers that cannot play aac
  const FILES = {
    open: '../sounds/Poppig.m4a',
    close: '../sounds/Closing.m4a',
    minimize: '../sounds/Mini.m4a',
  };

  const clips = {};
  let filesOk = true;

  try {
    Object.keys(FILES).forEach(key => {
      const a = new Audio(FILES[key]);
      a.preload = 'auto';
      a.addEventListener('error', () => { clips[key] = null; });
      clips[key] = a;
    });
  } catch (e) {
    filesOk = false;
  }

  function playClip(key) {
    if (volume <= 0) return false;
    const base = clips[key];
    if (!base || !filesOk) return false;

    try {
      const a = base.cloneNode();
      a.volume = volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    open() {
      if (playClip('open')) return;
      tone({ from: 420, to: 760, dur: 0.13, type: 'triangle' });
      tone({ from: 640, to: 1180, dur: 0.1, type: 'sine', gain: 0.1, delay: 0.04 });
    },

    close() {
      if (playClip('close')) return;
      tone({ from: 700, to: 260, dur: 0.15, type: 'triangle' });
      tone({ from: 350, to: 150, dur: 0.12, type: 'sine', gain: 0.09, delay: 0.03 });
    },

    minimize() {
      if (playClip('minimize')) return;
      tone({ from: 620, to: 200, dur: 0.18, type: 'sine' });
    },

    fullscreen() {
      tone({ from: 520, to: 520, dur: 0.07, type: 'triangle', gain: 0.14 });
      tone({ from: 780, to: 780, dur: 0.09, type: 'triangle', gain: 0.14, delay: 0.07 });
    },

    blip() {
      tone({ from: 900, to: 900, dur: 0.05, type: 'sine', gain: 0.12 });
    },

    getVolume() {
      return volume;
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      localStorage.setItem('volume', String(volume));
      if (master) master.gain.value = volume;
    },
  };

})();
let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
};

export const playTone = (freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.04) => {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g).connect(c.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.stop(c.currentTime + dur);
};

export const sfx = {
  tick: () => playTone(880, 0.04, "sine", 0.02),
  click: () => playTone(520, 0.06, "triangle", 0.04),
  success: () => { playTone(660, 0.1); setTimeout(() => playTone(990, 0.14), 90); },
  end: () => { playTone(440, 0.1); setTimeout(() => playTone(660, 0.1), 100); setTimeout(() => playTone(880, 0.2), 200); },
};

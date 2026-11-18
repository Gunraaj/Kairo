/**
 * End-of-session alarms, synthesized with Web Audio (no files, works offline, no licensing).
 * One shared catalog; the user picks one sound for "focus ends" and one for "break ends".
 */

export type AlertSoundId = 'bell' | 'chime' | 'bowl' | 'gong' | 'alarm' | 'marimba' | 'doorbell' | 'woodblock' | 'none';

export const ALERT_SOUNDS: { id: AlertSoundId; name: string; hint: string }[] = [
  { id: 'bell', name: 'Classic bell', hint: 'Clear and bright, cuts through music' },
  { id: 'chime', name: 'Rising chime', hint: 'Three friendly ascending notes' },
  { id: 'bowl', name: 'Singing bowl', hint: 'Calm, long and warm' },
  { id: 'gong', name: 'Deep gong', hint: 'Low and rich, hard to miss' },
  { id: 'alarm', name: 'Digital alarm', hint: 'Loudest: sharp beeps' },
  { id: 'marimba', name: 'Marimba', hint: 'Soft wooden notes' },
  { id: 'doorbell', name: 'Doorbell', hint: 'Ding-dong' },
  { id: 'woodblock', name: 'Wood block', hint: 'Gentle knocks' },
  { id: 'none', name: 'No sound', hint: 'Notification only' },
];

export const isAlertSoundId = (value: unknown): value is AlertSoundId =>
  typeof value === 'string' && ALERT_SOUNDS.some(s => s.id === value);

type Voice = { freq: number; at: number; peak: number; decay: number; type?: OscillatorType; attack?: number };

const partials = (freq: number, at: number, peak: number, decay: number, ratios: number[], weights: number[]): Voice[] =>
  ratios.map((r, i) => ({ freq: freq * r, at, peak: peak * weights[i], decay: decay * (1 - i * 0.12) }));

/** Each sound as a list of voices plus its length in seconds (used to space repeats). */
const PATTERNS: Record<Exclude<AlertSoundId, 'none'>, { voices: Voice[]; length: number; noise?: { at: number; decay: number; cutoff: number; peak: number } }> = {
  bell: { voices: partials(784, 0, 0.5, 3.2, [1, 2, 2.76, 5.4, 8.93], [1, 0.5, 0.35, 0.18, 0.08]), length: 2.2 },
  chime: {
    voices: [1047, 1319, 1568].flatMap((f, i) => partials(f, i * 0.2, 0.42, 1.8, [1, 3.01, 5.2], [1, 0.25, 0.08])),
    length: 1.9,
  },
  bowl: { voices: partials(396, 0, 0.55, 5, [1, 1.52, 2.76, 4.2], [1, 0.5, 0.25, 0.1]), length: 3.4 },
  gong: {
    voices: partials(98, 0, 0.75, 5.5, [1, 1.48, 2.1, 2.9, 3.6, 4.8], [1, 0.7, 0.5, 0.35, 0.22, 0.12]),
    length: 3.6,
    noise: { at: 0, decay: 1.2, cutoff: 900, peak: 0.25 },
  },
  alarm: {
    voices: [0, 0.2, 0.4, 0.6].map(at => ({ freq: 1046, at, peak: 0.32, decay: 0.13, type: 'square' as OscillatorType, attack: 0.004 })),
    length: 1.1,
  },
  marimba: {
    voices: [523, 659, 784].flatMap((f, i) => partials(f, i * 0.16, 0.55, 0.9, [1, 4, 9.2], [1, 0.18, 0.05])),
    length: 1.3,
  },
  doorbell: {
    voices: [...partials(659, 0, 0.5, 1.6, [1, 2.4, 3], [1, 0.2, 0.08]), ...partials(523, 0.55, 0.5, 2, [1, 2.4, 3], [1, 0.2, 0.08])],
    length: 2.2,
  },
  woodblock: {
    voices: [0, 0.22, 0.44].map(at => ({ freq: 880, at, peak: 0.6, decay: 0.09, type: 'triangle' as OscillatorType, attack: 0.002 })),
    length: 0.9,
  },
};

let sharedContext: AudioContext | null = null;
const getContext = () => {
  if (!sharedContext) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  return sharedContext;
};

/**
 * Browsers only allow sound after a click or key press. Unlock the alarm's audio on the first
 * interaction so it can still ring when a session ends minutes later with no click.
 */
export const primeAlertAudio = () => {
  if (typeof document === 'undefined') return;
  const unlock = () => {
    const context = getContext();
    void context?.resume().catch(() => undefined);
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
};

export type AlertOptions = { volume?: number; repeats?: number };

/** Plays an alarm. Returns its total length in seconds (0 for "none"). */
export const playAlertSound = (id: AlertSoundId, { volume = 0.8, repeats = 1 }: AlertOptions = {}): number => {
  if (id === 'none') return 0;
  const pattern = PATTERNS[id];
  const context = getContext();
  if (!pattern || !context) return 0;
  void context.resume().catch(() => undefined);

  const master = context.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume));
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(context.destination);

  const count = Math.min(3, Math.max(1, Math.round(repeats)));
  const start = context.currentTime + 0.02;
  let end = start;
  for (let r = 0; r < count; r++) {
    const offset = start + r * (pattern.length + 0.35);
    for (const v of pattern.voices) {
      const t = offset + v.at;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = v.type ?? 'sine';
      osc.frequency.setValueAtTime(v.freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(v.peak, t + (v.attack ?? 0.008));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + v.decay + 0.05);
      end = Math.max(end, t + v.decay);
    }
    if (pattern.noise) {
      const n = pattern.noise;
      const length = Math.ceil(context.sampleRate * n.decay);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = n.cutoff;
      const gain = context.createGain();
      const t = offset + n.at;
      gain.gain.setValueAtTime(n.peak, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.decay);
      src.connect(filter).connect(gain).connect(master);
      src.start(t);
    }
  }
  window.setTimeout(() => { master.disconnect(); limiter.disconnect(); }, (end - context.currentTime + 0.5) * 1000);
  return end - start;
};

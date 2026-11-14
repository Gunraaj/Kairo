import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { AudioSettings } from '../../types';
import moodistSounds from '../../moodist_sounds_utf8.json';
import { isTrustedAmbientUrl } from '../../utils/embed';
import { TbCloudRain, TbCloudStorm, TbDroplet, TbWaveSine, TbBeach, TbRipple, TbWind, TbLeaf, TbTrees, TbFlame, TbCoffee, TbBooks, TbUsers, TbBuildingStore, TbKeyboard, TbWriting, TbTrain, TbCar, TbPlaneInflight, TbCat, TbDog, TbFeather, TbButterfly, TbFish, TbVinyl, TbDeviceSpeaker, TbSnowflake, TbMoon, TbBell, TbHeartbeat, TbBubble, TbHammer, TbClock, TbFileMusic } from 'react-icons/tb';

export type Sound = {
  name: string;
  url: string;
};

export type BeatPreset = {
  name: string;
  description: string;
  mode: AudioSettings['mode'];
  noiseType: AudioSettings['noiseType'];
  beatFrequency: number;
  tone: number;
  noise: number;
  baseFrequency?: number;
};

export interface CustomBeatPreset extends BeatPreset {
  id: string;
  isCustom?: boolean;
}

export const beats: BeatPreset[] = [
  { name: 'Deep focus', description: '14 Hz beta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 14, tone: 0.08, noise: 0.06, baseFrequency: 216 },
  { name: 'Creative flow', description: '10 Hz alpha + brown noise', mode: 'binaural', noiseType: 'brown', beatFrequency: 10, tone: 0.07, noise: 0.05, baseFrequency: 216 },
  { name: 'Calm focus', description: '6 Hz theta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 6, tone: 0.06, noise: 0.07, baseFrequency: 140 },
  { name: 'Gamma sprint', description: '40 Hz isochronic pulse', mode: 'isochronic', noiseType: 'pink', beatFrequency: 40, tone: 0.055, noise: 0.035, baseFrequency: 216 },
  { name: 'White noise', description: 'Bright, even masking texture', mode: 'noise', noiseType: 'white', beatFrequency: 12, tone: 0, noise: 0.18, baseFrequency: 100 },
  { name: 'Pink noise', description: 'Balanced masking texture', mode: 'noise', noiseType: 'pink', beatFrequency: 10, tone: 0, noise: 0.2, baseFrequency: 100 },
  { name: 'Brown noise', description: 'Deep, low masking texture', mode: 'noise', noiseType: 'brown', beatFrequency: 8, tone: 0, noise: 0.22, baseFrequency: 100 },
];

export const carrierPresets = [
  { label: 'Deep', description: 'Low & soft', value: 140 },
  { label: 'Warm', description: 'Harmonic center', value: 216 },
  { label: 'Clear', description: 'Light & bright', value: 280 },
  { label: '432 Hz', description: 'Miracle Tone', value: 432 },
  { label: '528 Hz', description: 'Solfeggio Bell', value: 528 },
];

export const brainwaveBandFor = (frequency: number) => {
  if (frequency < 8) return { name: 'Theta', use: 'calm & meditative flow' };
  if (frequency < 13) return { name: 'Alpha', use: 'relaxed alert focus' };
  if (frequency < 31) return { name: 'Beta', use: 'active problem solving' };
  return { name: 'Gamma', use: 'peak cognition & intensity' };
};

export const carrierCharacterFor = (frequency: number) => {
  if (frequency < 175) return 'deep';
  if (frequency < 245) return 'warm';
  return 'bright';
};

export const categoryFor = (sound: Sound) => {
  const match = sound.url.match(/\/sounds\/([^/]+)\//);
  if (!match) return 'Other';
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
};

export const labelFor = (name: string) => name
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

export type IconCmp = React.ComponentType<{ size?: number; strokeWidth?: number }>;

export const SOUND_ICON_MAP: Record<string, IconCmp> = {
  'light-rain': TbCloudRain,
  'heavy-rain': TbCloudStorm,
  'rain-on-leaves': TbLeaf,
  'rain-on-roof': TbCloudRain,
  'rain-on-window': TbCloudRain,
  'rain-on-tent': TbCloudRain,
  'rain-on-umbrella': TbCloudRain,
  'thunder': TbCloudStorm,
  'wind': TbWind,
  'wind-in-trees': TbTrees,
  'leaves': TbLeaf,
  'walk-in-snow': TbSnowflake,
  'walk-on-gravel': TbHammer,
  'walk-on-leaves': TbLeaf,
  'campfire': TbFlame,
  'river': TbRipple,
  'droplets': TbDroplet,
  'jungle': TbTrees,
  'howling-wind': TbWind,
  'waterfall': TbBeach,
  'beehive': TbBubble,
  'birds': TbFeather,
  'cat-purring': TbCat,
  'chickens': TbFeather,
  'cows': TbDog,
  'crickets': TbButterfly,
  'crows': TbFeather,
  'dog-barking': TbDog,
  'frog': TbFish,
  'horse-galopp': TbDog,
  'owl': TbMoon,
  'seagulls': TbFeather,
  'sheep': TbDog,
  'whale': TbFish,
  'wolf': TbDog,
  'woodpecker': TbFeather,
  'boiling-water': TbDroplet,
  'bubbles': TbBubble,
  'clock': TbClock,
  'dryer': TbWind,
  'keyboard': TbKeyboard,
  'morse-code': TbBell,
  'muffled-airplane': TbPlaneInflight,
  'paper': TbFileMusic,
  'singing-bowl': TbBell,
  'slide-projector': TbFileMusic,
  'tuning-radio': TbDeviceSpeaker,
  'typewriter': TbWriting,
  'vinyl-effect': TbVinyl,
  'washing-machine': TbWind,
  'wind-chimes': TbBell,
  'writing': TbWriting,
  'cafe': TbCoffee,
  'construction-site': TbHammer,
  'inside-a-car': TbCar,
  'inside-a-plane': TbPlaneInflight,
  'inside-a-train': TbTrain,
  'kids-playground': TbUsers,
  'laboratory': TbFileMusic,
  'library': TbBooks,
  'night-village': TbMoon,
  'office': TbBuildingStore,
  'party-crowd': TbUsers,
  'restaurant': TbCoffee,
  'subway-station': TbTrain,
  'supermarket': TbBuildingStore,
  'temple': TbBell,
  'underwater': TbFish,
  'ambulance-siren': TbHeartbeat,
  'busy-street': TbCar,
  'church-bells': TbBell,
  'crowd': TbUsers,
  'fireworks': TbFlame,
  'highway': TbCar,
  'road': TbCar,
  'airplane': TbPlaneInflight,
  'inside-a-bus': TbCar,
  'sailboat': TbBeach,
  'submarine': TbFish,
  'train': TbTrain,
  'rowing-boat': TbBeach,
};

export const familyIcon = (name: string): IconCmp => {
  if (/storm|thunder/.test(name)) return TbCloudStorm;
  if (/rain/.test(name)) return TbCloudRain;
  if (/wave|ocean|beach|sea/.test(name)) return TbBeach;
  if (/water|drip|river|stream/.test(name)) return TbRipple;
  if (/wind|breeze/.test(name)) return TbWind;
  if (/tree|forest|jungle|leaves/.test(name)) return TbTrees;
  if (/fire|camp|flame/.test(name)) return TbFlame;
  if (/cafe|restaurant|coffee/.test(name)) return TbCoffee;
  if (/library|book/.test(name)) return TbBooks;
  if (/keyboard|typewriter|writing/.test(name)) return TbKeyboard;
  if (/train|subway/.test(name)) return TbTrain;
  if (/car|traffic|highway|road|bus/.test(name)) return TbCar;
  if (/plane|airplane|flight/.test(name)) return TbPlaneInflight;
  if (/cat|purr/.test(name)) return TbCat;
  if (/dog|wolf|sheep|cow|horse/.test(name)) return TbDog;
  if (/bird|crow|owl|feather|chicken|seagull|woodpecker/.test(name)) return TbFeather;
  if (/frog|whale|fish|underwater|submarine/.test(name)) return TbFish;
  if (/bee|butterfly|cricket/.test(name)) return TbButterfly;
  if (/vinyl|tape|radio/.test(name)) return TbVinyl;
  if (/snow|winter/.test(name)) return TbSnowflake;
  if (/night|moon|village/.test(name)) return TbMoon;
  if (/bell|chime|siren/.test(name)) return TbBell;
  if (/crowd|people|party|kids/.test(name)) return TbUsers;
  if (/office|market|store|shop/.test(name)) return TbBuildingStore;
  if (/bubble|boiling|washing|dryer/.test(name)) return TbBubble;
  return TbWaveSine;
};

export const SoundIcon: React.FC<{ name: string }> = ({ name }) => {
  const Comp = SOUND_ICON_MAP[name] ?? familyIcon(name);
  return <Comp size={18} strokeWidth={1.7} />;
};

export const SOUNDS = (moodistSounds as Sound[])
  .filter(sound => sound.name !== 'alarm' && isTrustedAmbientUrl(sound.url));

export const FEATURED_NAMES = new Set([
  'heavy-rain', 'rain-on-window', 'waves', 'campfire', 'river', 'wind-in-trees',
  'cafe', 'library', 'inside-a-train', 'keyboard', 'vinyl-effect', 'cat-purring',
]);

export const MOODIST_ORDER = ['Rain', 'Nature', 'Animals', 'Things', 'Places', 'Urban', 'Transport'];
export const _present = new Set(SOUNDS.map(categoryFor));
export const CATEGORIES = ['All', 'Featured', ...MOODIST_ORDER.filter(c => _present.has(c))];

export interface AtmospherePreset {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  sounds: Array<{ name: string; vol: number }>;
  isCustom?: boolean;
}

export const ATMOSPHERE_EMOJIS = [
  '✨', '🌧️', '⚡', '🌊', '🌲', '🍃', '🌸', '🏔️',
  '☕', '🔥', '📚', '🕯️', '⛩️', '🌙', '🪐', '🚂',
];

export const DEFAULT_ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  {
    id: 'rainy-cafe',
    name: 'Rainy Cafe',
    icon: '☕',
    subtitle: 'Window rain & warm cafe murmur',
    sounds: [
      { name: 'rain-on-window', vol: 0.35 },
      { name: 'cafe', vol: 0.4 },
      { name: 'light-rain', vol: 0.2 },
    ],
  },
  {
    id: 'kyoto-temple',
    name: 'Kyoto Temple',
    icon: '⛩️',
    subtitle: 'Temple bells, wind chimes & breeze',
    sounds: [
      { name: 'temple', vol: 0.3 },
      { name: 'wind-chimes', vol: 0.25 },
      { name: 'wind-in-trees', vol: 0.2 },
      { name: 'birds', vol: 0.15 },
    ],
  },
  {
    id: 'forest-river',
    name: 'Forest River',
    icon: '🌲',
    subtitle: 'Mountain stream & pine wind',
    sounds: [
      { name: 'river', vol: 0.35 },
      { name: 'wind-in-trees', vol: 0.3 },
      { name: 'birds', vol: 0.2 },
    ],
  },
  {
    id: 'midnight-fire',
    name: 'Midnight Fire',
    icon: '🔥',
    subtitle: 'Campfire crackle & night village crickets',
    sounds: [
      { name: 'campfire', vol: 0.4 },
      { name: 'crickets', vol: 0.25 },
      { name: 'night-village', vol: 0.2 },
    ],
  },
  {
    id: 'ocean-solitude',
    name: 'Ocean Solitude',
    icon: '🌊',
    subtitle: 'Rhythmic breakers & coastal rain',
    sounds: [
      { name: 'waves', vol: 0.4 },
      { name: 'heavy-rain', vol: 0.2 },
      { name: 'seagulls', vol: 0.15 },
    ],
  },
  {
    id: 'tokyo-train',
    name: 'Tokyo Train',
    icon: '🚄',
    subtitle: 'Commuter carriage rhythm & rain',
    sounds: [
      { name: 'inside-a-train', vol: 0.4 },
      { name: 'rain-on-window', vol: 0.25 },
    ],
  },
  {
    id: 'quiet-library',
    name: 'Quiet Library',
    icon: '📚',
    subtitle: 'Study quietude, typewriter & distant rain',
    sounds: [
      { name: 'library', vol: 0.35 },
      { name: 'typewriter', vol: 0.25 },
      { name: 'rain-on-window', vol: 0.2 },
    ],
  },
  {
    id: 'deep-submarine',
    name: 'Deep Submarine',
    icon: '🫧',
    subtitle: 'Abyssal currents & gentle bubbles',
    sounds: [
      { name: 'submarine', vol: 0.35 },
      { name: 'underwater', vol: 0.3 },
      { name: 'bubbles', vol: 0.2 },
    ],
  },
];

export interface LofiStation {
  id: string;
  name: string;
  subtitle: string;
  genre: string;
  youtubeId: string;
  badge: string;
}

export const CURATED_LOFI_STATIONS: LofiStation[] = [
  {
    id: 'lofigirl',
    name: 'Lofi Girl',
    subtitle: 'beats to relax/study to',
    genre: 'Chilled Lofi',
    youtubeId: 'jfKfPfyJRdk',
    badge: 'LIVE 24/7',
  },
  {
    id: 'synthwave',
    name: 'Synthwave Radio',
    subtitle: 'chill synth / retro focus',
    genre: 'Synthwave',
    youtubeId: '4xDzrJKXOOY',
    badge: 'CHILL BEATS',
  },
  {
    id: 'zen-garden',
    name: 'Zen Garden',
    subtitle: 'Shakuhachi & Koto',
    genre: 'Japanese Ambient',
    youtubeId: '1ZYbU82GVz4',
    badge: 'MEDITATION',
  },
  {
    id: 'coffee-jazz',
    name: 'Coffee Shop Jazz',
    subtitle: 'Smooth Bossa & Rainy Jazz',
    genre: 'Acoustic Jazz',
    youtubeId: 'Dx5qFachd3A',
    badge: 'WARM CAFE',
  },
  {
    id: 'theta-432',
    name: '432 Hz Deep Theta',
    subtitle: 'Miracle Tone & Entrainment',
    genre: 'Solfeggio Tone',
    youtubeId: 'WPni755-Krg',
    badge: '432 HZ',
  },
  {
    id: 'chillhop',
    name: 'Chillhop Radio',
    subtitle: 'jazzy beats & study beats',
    genre: 'Chillhop',
    youtubeId: '5yx6BWlEVcY',
    badge: 'LOFI HIP HOP',
  },
];

export const AmbientChannelStrip: React.FC<{
  sound: { name: string; url: string };
  volume: number;
  isMuted: boolean;
  label: string;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onRemove: () => void;
}> = ({ sound, volume, isMuted, label, onVolumeChange, onToggleMute, onRemove }) => {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rowRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rowRef.current,
        { opacity: 0, y: -6, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' },
      );
    }, rowRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rowRef} className={`k-channel-strip ${isMuted ? 'is-muted' : ''}`}>
      <div className="k-channel-info">
        <span className="k-channel-thumb" aria-hidden="true">
          <SoundIcon name={sound.name} />
        </span>
        <span className="k-channel-name" title={label}>
          {label}
        </span>
      </div>

      <div className="k-channel-fader-wrap">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={event => onVolumeChange(Number(event.target.value))}
          aria-label={`${label} volume`}
          disabled={isMuted}
        />
        <span className="k-channel-vol-readout">
          {isMuted ? 'MUTE' : `${Math.round(volume * 100)}%`}
        </span>
      </div>

      <div className="k-channel-actions">
        <button
          type="button"
          className={`k-channel-mute-btn ${isMuted ? 'active-mute' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? `Unmute ${label}` : `Mute ${label}`}
          aria-label={isMuted ? `Unmute ${label}` : `Mute ${label}`}
        >
          {isMuted ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3.5L3.8 6H1.5v4h2.3L7 12.5V3.5z" />
              <line x1="10.5" y1="6.5" x2="14.5" y2="10.5" />
              <line x1="14.5" y1="6.5" x2="10.5" y2="10.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3.5L3.8 6H1.5v4h2.3L7 12.5V3.5z" />
              <path d="M10.5 5.5a3.5 3.5 0 010 5" />
              <path d="M13 3.5a6.5 6.5 0 010 9" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="k-channel-remove-btn"
          onClick={onRemove}
          title={`Stop & remove ${label}`}
          aria-label={`Remove ${label}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

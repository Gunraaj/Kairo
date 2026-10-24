import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioSettings, SavedFocusStream } from '../types';
import { Icon } from './Icon';
import moodistSounds from '../moodist_sounds_utf8.json';
import { isTrustedAmbientUrl, parseMediaEmbed } from '../utils/embed';
import { getCachedAudioUrl } from '../utils/audioCache';
import {
  TbCloudRain, TbCloudStorm, TbDroplet, TbWaveSine, TbBeach, TbRipple,
  TbWind, TbLeaf, TbTrees, TbFlame, TbCoffee, TbBooks, TbUsers, TbBuildingStore,
  TbKeyboard, TbWriting, TbTrain, TbCar, TbPlaneInflight, TbCat, TbDog,
  TbFeather, TbButterfly, TbFish, TbVinyl, TbDeviceSpeaker, TbSnowflake,
  TbMoon, TbBell, TbHeartbeat, TbBubble, TbHammer, TbClock, TbFileMusic,
  TbBookmark, TbBookmarkFilled, TbTrash, TbPlus, TbBrandYoutube, TbBrandSpotify, TbStar,
} from 'react-icons/tb';

export interface ControlPanelProps {
  audioSettings: AudioSettings;
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  resumeAudio: () => Promise<void>;
  audioError: string | null;
  onClose?: () => void;
}

type Sound = {
  name: string;
  url: string;
};

type BeatPreset = {
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

const beats: BeatPreset[] = [
  { name: 'Deep focus', description: '14 Hz beta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 14, tone: 0.08, noise: 0.06, baseFrequency: 216 },
  { name: 'Creative flow', description: '10 Hz alpha + brown noise', mode: 'binaural', noiseType: 'brown', beatFrequency: 10, tone: 0.07, noise: 0.05, baseFrequency: 216 },
  { name: 'Calm focus', description: '6 Hz theta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 6, tone: 0.06, noise: 0.07, baseFrequency: 140 },
  { name: 'Gamma sprint', description: '40 Hz isochronic pulse', mode: 'isochronic', noiseType: 'pink', beatFrequency: 40, tone: 0.055, noise: 0.035, baseFrequency: 216 },
  { name: 'White noise', description: 'Bright, even masking texture', mode: 'noise', noiseType: 'white', beatFrequency: 12, tone: 0, noise: 0.18, baseFrequency: 100 },
  { name: 'Pink noise', description: 'Balanced masking texture', mode: 'noise', noiseType: 'pink', beatFrequency: 10, tone: 0, noise: 0.2, baseFrequency: 100 },
  { name: 'Brown noise', description: 'Deep, low masking texture', mode: 'noise', noiseType: 'brown', beatFrequency: 8, tone: 0, noise: 0.22, baseFrequency: 100 },
];

const carrierPresets = [
  { label: 'Deep', description: 'Low & soft', value: 140 },
  { label: 'Warm', description: 'Harmonic center', value: 216 },
  { label: 'Clear', description: 'Light & bright', value: 280 },
  { label: '432 Hz', description: 'Miracle Tone', value: 432 },
  { label: '528 Hz', description: 'Solfeggio Bell', value: 528 },
];

const brainwaveBandFor = (frequency: number) => {
  if (frequency < 8) return { name: 'Theta', use: 'calm & meditative flow' };
  if (frequency < 13) return { name: 'Alpha', use: 'relaxed alert focus' };
  if (frequency < 31) return { name: 'Beta', use: 'active problem solving' };
  return { name: 'Gamma', use: 'peak cognition & intensity' };
};

const carrierCharacterFor = (frequency: number) => {
  if (frequency < 175) return 'deep';
  if (frequency < 245) return 'warm';
  return 'bright';
};

const categoryFor = (sound: Sound) => {
  const match = sound.url.match(/\/sounds\/([^/]+)\//);
  if (!match) return 'Other';
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
};

const labelFor = (name: string) => name
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

type IconCmp = React.ComponentType<{ size?: number; strokeWidth?: number }>;

const SOUND_ICON_MAP: Record<string, IconCmp> = {
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

const familyIcon = (name: string): IconCmp => {
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

const SoundIcon: React.FC<{ name: string }> = ({ name }) => {
  const Comp = SOUND_ICON_MAP[name] ?? familyIcon(name);
  return <Comp size={18} strokeWidth={1.7} />;
};

const SOUNDS = (moodistSounds as Sound[])
  .filter(sound => sound.name !== 'alarm' && isTrustedAmbientUrl(sound.url));

const FEATURED_NAMES = new Set([
  'heavy-rain', 'rain-on-window', 'waves', 'campfire', 'river', 'wind-in-trees',
  'cafe', 'library', 'inside-a-train', 'keyboard', 'vinyl-effect', 'cat-purring',
]);

const MOODIST_ORDER = ['Rain', 'Nature', 'Animals', 'Things', 'Places', 'Urban', 'Transport'];
const _present = new Set(SOUNDS.map(categoryFor));
const CATEGORIES = ['All', 'Featured', ...MOODIST_ORDER.filter(c => _present.has(c))];

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

const DEFAULT_ATMOSPHERE_PRESETS: AtmospherePreset[] = [
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

const CURATED_LOFI_STATIONS: LofiStation[] = [
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
    youtubeId: '-5KAN9_CzSA',
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

export const ControlPanel: React.FC<ControlPanelProps> = ({
  audioSettings,
  setAudioSettings,
  resumeAudio,
  audioError,
  onClose,
}) => {
  const [tab, setTab] = useState<'sounds' | 'beats' | 'lofi'>('sounds');
  const [category, setCategory] = useState('Featured');
  const [query, setQuery] = useState('');
  const [activeSounds, setActiveSounds] = useState<Record<string, number>>({});
  const [mutedSoundUrls, setMutedSoundUrls] = useState<Set<string>>(() => new Set());
  const [isMixerExpanded, setIsMixerExpanded] = useState(true);
  const [allPaused, setAllPaused] = useState(false);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [ambientError, setAmbientError] = useState('');
  const [customAtmospheres, setCustomAtmospheres] = useState<AtmospherePreset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('kairo_custom_atmospheres');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isSavingMix, setIsSavingMix] = useState(false);
  const [newMixName, setNewMixName] = useState('');
  const [newMixEmoji, setNewMixEmoji] = useState('✨');
  const [editingEmojiForId, setEditingEmojiForId] = useState<string | null>(null);

  const saveCustomMix = () => {
    const trimmed = newMixName.trim();
    if (!trimmed) return;
    const activeEntries = Object.entries(activeSounds);
    if (activeEntries.length === 0) return;

    const sounds = activeEntries
      .map(([url, vol]) => {
        const sound = SOUNDS.find(s => s.url === url);
        return sound ? { name: sound.name, vol } : null;
      })
      .filter((item): item is { name: string; vol: number } => item !== null);

    if (sounds.length === 0) return;

    const newPreset: AtmospherePreset = {
      id: 'custom-' + Date.now(),
      name: trimmed.slice(0, 32),
      icon: newMixEmoji || '✨',
      subtitle: `${sounds.length} layers mixed by you`,
      sounds,
      isCustom: true,
    };

    const next = [newPreset, ...customAtmospheres.slice(0, 15)];
    setCustomAtmospheres(next);
    try {
      localStorage.setItem('kairo_custom_atmospheres', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
    setNewMixName('');
    setNewMixEmoji('✨');
    setIsSavingMix(false);
    setEditingEmojiForId(null);
  };

  const updateCustomMixEmoji = (presetId: string, emoji: string) => {
    const next = customAtmospheres.map(p =>
      p.id === presetId ? { ...p, icon: emoji } : p,
    );
    setCustomAtmospheres(next);
    try {
      localStorage.setItem('kairo_custom_atmospheres', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
    setEditingEmojiForId(null);
  };

  const deleteCustomMix = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customAtmospheres.filter(p => p.id !== id);
    setCustomAtmospheres(next);
    try {
      localStorage.setItem('kairo_custom_atmospheres', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
  };

  const [customBeats, setCustomBeats] = useState<CustomBeatPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('kairo_custom_beats');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isSavingBeat, setIsSavingBeat] = useState(false);
  const [newBeatName, setNewBeatName] = useState('');

  const saveCustomBeat = () => {
    const trimmed = newBeatName.trim();
    if (!trimmed) return;
    const newPreset: CustomBeatPreset = {
      id: 'beat-' + Date.now(),
      name: trimmed.slice(0, 32),
      description: `${audioSettings.mode.toUpperCase()} · ${audioSettings.baseFrequency} Hz pitch · ${audioSettings.beatFrequency} Hz rhythm`,
      mode: audioSettings.mode,
      noiseType: audioSettings.noiseType,
      beatFrequency: audioSettings.beatFrequency,
      tone: audioSettings.binauralVolume,
      noise: audioSettings.noiseVolume,
      baseFrequency: audioSettings.baseFrequency,
      isCustom: true,
    };
    const next = [newPreset, ...customBeats.slice(0, 15)];
    setCustomBeats(next);
    try {
      localStorage.setItem('kairo_custom_beats', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
    setNewBeatName('');
    setIsSavingBeat(false);
  };

  const deleteCustomBeat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customBeats.filter(b => b.id !== id);
    setCustomBeats(next);
    try {
      localStorage.setItem('kairo_custom_beats', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
  };

  // Saved Custom Focus Streams
  const [savedStreams, setSavedStreams] = useState<SavedFocusStream[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('kairo_saved_streams');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isSavingStream, setIsSavingStream] = useState(false);
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamUrl, setNewStreamUrl] = useState('');
  const [newStreamBadge, setNewStreamBadge] = useState('LOFI');
  const [newStreamEmoji, setNewStreamEmoji] = useState('🎧');
  const [streamSaveError, setStreamSaveError] = useState('');

  const saveCustomStream = (
    nameInput?: string,
    urlInput?: string,
    badgeInput?: string,
    emojiInput?: string,
  ) => {
    const rawUrl = (urlInput ?? newStreamUrl).trim();
    const rawName = (nameInput ?? newStreamName).trim();
    const rawBadge = (badgeInput ?? newStreamBadge).trim() || 'STREAM';
    const rawEmoji = emojiInput ?? newStreamEmoji;

    if (!rawUrl) {
      setStreamSaveError('Please enter a YouTube or Spotify URL.');
      return;
    }

    const embed = parseMediaEmbed(rawUrl);
    if (!embed) {
      setStreamSaveError('Please enter a valid HTTPS YouTube or Spotify link.');
      return;
    }

    const streamName = rawName || (embed.provider === 'spotify' ? 'Custom Spotify Stream' : 'Custom YouTube Stream');
    const subtitle = embed.provider === 'spotify' ? 'Spotify playlist' : 'YouTube focus stream';

    const newStream: SavedFocusStream = {
      id: 'stream-' + Date.now(),
      name: streamName.slice(0, 48),
      subtitle,
      provider: embed.provider,
      originalUrl: rawUrl,
      embedUrl: embed.url,
      badge: rawBadge.slice(0, 12).toUpperCase(),
      emoji: rawEmoji,
      createdAt: Date.now(),
    };

    const next = [newStream, ...savedStreams.filter(s => s.originalUrl !== rawUrl && s.embedUrl !== embed.url).slice(0, 30)];
    setSavedStreams(next);
    try {
      localStorage.setItem('kairo_saved_streams', JSON.stringify(next));
    } catch {
      // Ignore quota
    }

    // Auto-play the newly saved stream
    const autoplayUrl = embed.provider === 'youtube' && !embed.url.includes('autoplay')
      ? `${embed.url}?autoplay=1`
      : embed.url;
    setEmbedUrl(autoplayUrl);
    setMediaError('');
    setStreamSaveError('');
    setIsSavingStream(false);
    setNewStreamName('');
    setNewStreamUrl('');
  };

  const deleteSavedStream = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const stream = savedStreams.find(s => s.id === id);
    const next = savedStreams.filter(s => s.id !== id);
    setSavedStreams(next);
    try {
      localStorage.setItem('kairo_saved_streams', JSON.stringify(next));
    } catch {
      // Ignore quota
    }
    if (stream && (embedUrl.includes(stream.embedUrl) || (stream.originalUrl && embedUrl.includes(stream.originalUrl)))) {
      setEmbedUrl('');
    }
  };

  const openStreamCreatorWithUrl = (urlToPrefill: string) => {
    const trimmed = urlToPrefill.trim();
    setNewStreamUrl(trimmed);
    const embed = trimmed ? parseMediaEmbed(trimmed) : null;
    if (embed?.provider === 'spotify') {
      setNewStreamBadge('SPOTIFY');
      setNewStreamName(newStreamName || 'Spotify Focus Playlist');
    } else if (trimmed) {
      setNewStreamBadge('LOFI');
      setNewStreamName(newStreamName || 'Focus Radio Stream');
    }
    setStreamSaveError('');
    setIsSavingStream(true);
  };

  const players = useRef(new Map<string, HTMLAudioElement>());
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const masterVolume = audioSettings.masterVolume;
  const masterRef = useRef(masterVolume);
  const activeSoundsRef = useRef(activeSounds);
  activeSoundsRef.current = activeSounds;

  useEffect(() => {
    masterRef.current = masterVolume;
    players.current.forEach(player => {
      const url = player.src;
      if (mutedSoundUrls.has(url)) {
        player.volume = 0;
      } else {
        const layer = activeSoundsRef.current[url] ?? 0.5;
        player.volume = Math.min(1, Math.max(0, layer * masterVolume));
      }
    });
  }, [masterVolume, mutedSoundUrls]);

  const soundTabs: Array<{ key: typeof tab; label: string; badge?: string }> = [
    { key: 'sounds', label: 'Ambient' },
    { key: 'beats', label: 'Brainwaves' },
    { key: 'lofi', label: 'Lofi' },
  ];

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? soundTabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + soundTabs.length) % soundTabs.length;
    const nextTab = soundTabs[nextIndex];
    setTab(nextTab.key);
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
  };

  const filteredSounds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SOUNDS.filter(sound => {
      const categoryMatch = normalizedQuery
        ? true
        : category === 'All'
        ? true
        : category === 'Featured'
        ? FEATURED_NAMES.has(sound.name)
        : categoryFor(sound) === category;
      return categoryMatch && (!normalizedQuery || labelFor(sound.name).toLowerCase().includes(normalizedQuery));
    });
  }, [category, query]);

  useEffect(() => () => {
    players.current.forEach(player => {
      player.pause();
      player.onerror = null;
      player.src = '';
    });
    players.current.clear();
  }, []);

  const toggleAmbient = async (sound: Sound) => {
    const existing = players.current.get(sound.url);
    if (existing) {
      existing.pause();
      existing.onerror = null;
      existing.src = '';
      players.current.delete(sound.url);
      setActiveSounds(previous => {
        const next = { ...previous };
        delete next[sound.url];
        return next;
      });
      setMutedSoundUrls(prev => {
        const next = new Set(prev);
        next.delete(sound.url);
        return next;
      });
      return;
    }

    const playUrl = await getCachedAudioUrl(sound.url);
    const player = new Audio(playUrl);
    player.loop = true;
    player.volume = Math.min(1, Math.max(0, 0.3 * masterRef.current));
    players.current.set(sound.url, player);
    setAmbientError('');
    player.onerror = () => {
      players.current.delete(sound.url);
      setActiveSounds(previous => {
        const next = { ...previous };
        delete next[sound.url];
        return next;
      });
      setMutedSoundUrls(prev => {
        const next = new Set(prev);
        next.delete(sound.url);
        return next;
      });
      setAmbientError(`${labelFor(sound.name)} could not be loaded.`);
    };
    setAmbientPaused(false);
    setActiveSounds(previous => ({ ...previous, [sound.url]: 0.3 }));
    setIsMixerExpanded(true);

    try {
      await player.play();
    } catch {
      players.current.delete(sound.url);
      player.onerror = null;
      setActiveSounds(previous => {
        const next = { ...previous };
        delete next[sound.url];
        return next;
      });
      setMutedSoundUrls(prev => {
        const next = new Set(prev);
        next.delete(sound.url);
        return next;
      });
      setAmbientError('Audio playback was blocked. Click again to retry.');
    }
  };

  const setLayerVolume = (url: string, volume: number) => {
    const player = players.current.get(url);
    if (player && !mutedSoundUrls.has(url)) {
      player.volume = Math.min(1, Math.max(0, volume * masterRef.current));
    }
    setActiveSounds(previous => ({ ...previous, [url]: volume }));
  };

  const toggleSoundMute = (url: string) => {
    const isCurrentlyMuted = mutedSoundUrls.has(url);
    const nextMuted = new Set(mutedSoundUrls);
    const player = players.current.get(url);
    if (isCurrentlyMuted) {
      nextMuted.delete(url);
      if (player) {
        const origVol = activeSounds[url] ?? 0.5;
        player.volume = Math.min(1, Math.max(0, origVol * masterRef.current));
      }
    } else {
      nextMuted.add(url);
      if (player) {
        player.volume = 0;
      }
    }
    setMutedSoundUrls(nextMuted);
  };

  const toggleAmbientPlayback = async () => {
    const activePlayers = Array.from(players.current.values()) as HTMLAudioElement[];
    if (activePlayers.length === 0) return;
    if (ambientPaused) {
      await Promise.allSettled(activePlayers.map(player => player.play()));
      setAmbientPaused(false);
    } else {
      activePlayers.forEach(player => player.pause());
      setAmbientPaused(true);
    }
  };

  const toggleAllPlayback = async () => {
    const activePlayers = Array.from(players.current.values()) as HTMLAudioElement[];
    if (allPaused) {
      await Promise.allSettled(activePlayers.map(player => player.play()));
      setAmbientPaused(false);
      setAllPaused(false);
    } else {
      activePlayers.forEach(player => player.pause());
      setAmbientPaused(true);
      setAllPaused(true);
    }
  };

  const clearAmbient = () => {
    players.current.forEach(player => {
      player.pause();
      player.onerror = null;
      player.src = '';
    });
    players.current.clear();
    setActiveSounds({});
    setMutedSoundUrls(new Set());
    setAmbientPaused(false);
  };

  const clearAllAudioSources = () => {
    clearAmbient();
    if (audioSettings.isPlaying) {
      setAudioSettings(previous => ({ ...previous, isPlaying: false }));
    }
    if (embedUrl) {
      setEmbedUrl('');
    }
    setAllPaused(false);
  };

  const loadAtmosphere = async (presetSounds: Array<{ name: string; vol: number }>) => {
    clearAmbient();
    for (const item of presetSounds) {
      const sound = SOUNDS.find(s => s.name === item.name);
      if (sound) {
        const playUrl = await getCachedAudioUrl(sound.url);
        const player = new Audio(playUrl);
        player.loop = true;
        player.volume = Math.min(1, Math.max(0, item.vol * masterRef.current));
        players.current.set(sound.url, player);
        setActiveSounds(prev => ({ ...prev, [sound.url]: item.vol }));
        try {
          await player.play();
        } catch {
          // Playback blocked or offline
        }
      }
    }
    setAmbientPaused(false);
  };

  const lastVolumeRef = useRef(masterVolume > 0 ? masterVolume : 0.7);
  const toggleMute = () => {
    if (masterVolume > 0) {
      lastVolumeRef.current = masterVolume;
      update('masterVolume', 0);
    } else {
      update('masterVolume', lastVolumeRef.current || 0.7);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [masterVolume]);

  const applyBeat = (preset: BeatPreset) => {
    setAudioSettings(previous => ({
      ...previous,
      engineEnabled: true,
      ambientPreset: 'none',
      mode: preset.mode,
      noiseType: preset.noiseType,
      beatFrequency: preset.beatFrequency,
      binauralVolume: preset.tone,
      noiseVolume: preset.noise,
      baseFrequency: preset.baseFrequency ?? previous.baseFrequency,
      isPlaying: true,
    }));
    void resumeAudio().catch(() => {
      setAudioSettings(previous => ({ ...previous, isPlaying: false }));
    });
  };

  const selectBeatMode = (mode: AudioSettings['mode']) => {
    setAudioSettings(previous => ({
      ...previous,
      engineEnabled: true,
      ambientPreset: 'none',
      mode,
      binauralVolume: mode === 'noise' ? 0 : Math.max(previous.binauralVolume, 0.07),
      noiseVolume: mode === 'noise' ? Math.max(previous.noiseVolume, 0.18) : previous.noiseVolume,
    }));
  };

  const update = <Key extends keyof AudioSettings>(key: Key, value: AudioSettings[Key]) => {
    setAudioSettings(previous => ({ ...previous, [key]: value }));
  };

  const toggleGeneratedAudio = () => {
    if (audioSettings.isPlaying) {
      update('isPlaying', false);
      return;
    }
    void resumeAudio()
      .then(() => update('isPlaying', true))
      .catch(() => update('isPlaying', false));
  };

  const startLofi = () => {
    const embed = parseMediaEmbed(mediaUrl);
    setEmbedUrl(embed?.url ?? '');
    setMediaError(embed ? '' : 'Use a valid HTTPS YouTube video, live stream, playlist, or Spotify link.');
  };

  const activeEntries = Object.entries(activeSounds);
  const ambientCount = activeEntries.length;
  const isPlayingAny = audioSettings.isPlaying || (ambientCount > 0 && !ambientPaused) || Boolean(embedUrl);

  const brainwaveBand = brainwaveBandFor(audioSettings.beatFrequency);
  const carrierCharacter = carrierCharacterFor(audioSettings.baseFrequency);

  const activeAmbientItems = useMemo(() => {
    return Object.entries(activeSounds).map(([url, volume]) => {
      const sound = SOUNDS.find(s => s.url === url) || {
        name: url.split('/').pop()?.replace('.mp3', '') || 'Sound',
        url,
      };
      const isMuted = mutedSoundUrls.has(url);
      return { sound, volume, isMuted };
    });
  }, [activeSounds, mutedSoundUrls]);

  const activeLofiStation = useMemo(() => {
    if (!embedUrl) return null;
    const curated = CURATED_LOFI_STATIONS.find(s => embedUrl.includes(s.youtubeId));
    if (curated) return { name: curated.name, badge: curated.badge, subtitle: curated.subtitle, isCustom: false };
    const saved = savedStreams.find(s => embedUrl.includes(s.embedUrl) || s.embedUrl.includes(embedUrl) || (s.originalUrl && embedUrl.includes(s.originalUrl)));
    if (saved) return { name: saved.name, badge: saved.badge, subtitle: saved.subtitle, isCustom: true };
    return null;
  }, [embedUrl, savedStreams]);

  const activeLofiName = activeLofiStation ? activeLofiStation.name : 'Custom Focus Stream';

  const isCurrentEmbedSaved = useMemo(() => {
    if (!embedUrl) return false;
    return savedStreams.some(s => embedUrl.includes(s.embedUrl) || s.embedUrl.includes(embedUrl) || (s.originalUrl && embedUrl.includes(s.originalUrl)));
  }, [embedUrl, savedStreams]);

  const isCurrentEmbedCurated = useMemo(() => {
    if (!embedUrl) return false;
    return CURATED_LOFI_STATIONS.some(s => embedUrl.includes(s.youtubeId));
  }, [embedUrl]);

  const totalActiveChannels =
    activeAmbientItems.length +
    (audioSettings.isPlaying ? 1 : 0) +
    (embedUrl ? 1 : 0);

  const synthVolume = audioSettings.mode === 'noise'
    ? Math.min(1, Math.max(0, audioSettings.noiseVolume / 0.35))
    : Math.min(1, Math.max(0, audioSettings.binauralVolume / 0.30));

  const setSynthVolumeNormalized = (normalized: number) => {
    if (audioSettings.mode === 'noise') {
      update('noiseVolume', Math.max(0, Math.min(0.35, normalized * 0.35)));
    } else {
      update('binauralVolume', Math.max(0, Math.min(0.30, normalized * 0.30)));
    }
  };

  // Status subtitle
  const activeStatusText = useMemo(() => {
    if (audioSettings.isPlaying) {
      if (audioSettings.mode === 'binaural') return `Binaural ${audioSettings.beatFrequency} Hz · ${brainwaveBand.name}`;
      if (audioSettings.mode === 'isochronic') return `Isochronic ${audioSettings.beatFrequency} Hz`;
      return `${audioSettings.noiseType.toUpperCase()} Noise`;
    }
    if (ambientCount > 0) {
      return `${ambientCount} Ambient Sound${ambientCount > 1 ? 's' : ''}`;
    }
    if (embedUrl) return 'Lofi Stream Active';
    return 'Idle';
  }, [audioSettings.isPlaying, audioSettings.mode, audioSettings.beatFrequency, audioSettings.noiseType, brainwaveBand.name, ambientCount, embedUrl]);

  return (
    <section className="k-sl-inner" data-audio-mode={audioSettings.mode}>
      {/* 1. Unified Header */}
      <header className="k-sl-head">
        <div className="k-sl-header-top">
          <div className="k-sl-title-group">
            <h2>Sound Studio</h2>
            <span className={`k-sl-status-pill ${isPlayingAny ? 'is-active' : ''}`} title={`Audio status: ${activeStatusText}`}>
              <span className="k-sl-status-dot" aria-hidden="true" />
              <span>{activeStatusText}</span>
            </span>
          </div>
          {onClose && (
            <button className="k-sl-close-btn" onClick={onClose} aria-label="Close sound library" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        {/* 2. Master Controller & Live Mixer Rack */}
        <div className={`k-mixer-console ${totalActiveChannels > 0 ? 'has-active' : 'is-standby'}`}>
          <div className="k-mixer-master-bar">
            <button
              type="button"
              onClick={toggleMute}
              className={`k-mixer-icon-btn ${masterVolume === 0 ? 'is-muted' : ''}`}
              aria-label={masterVolume === 0 ? 'Unmute (M)' : 'Mute (M)'}
              title={masterVolume === 0 ? 'Unmute (M)' : 'Mute (M)'}
            >
              <Icon name={masterVolume === 0 ? 'volumeOff' : 'volumeUp'} className="h-3.5 w-3.5" />
            </button>

            <div className="k-mixer-master-slider" title={`Master volume ${Math.round(masterVolume * 100)}%`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={event => update('masterVolume', Number(event.target.value))}
                aria-label={`Master volume ${Math.round(masterVolume * 100)} percent`}
              />
            </div>
            <span className="k-mixer-vol-val">{Math.round(masterVolume * 100)}%</span>

            <div className="k-mixer-master-actions">
              {totalActiveChannels > 0 && (
                <>
                  <button
                    type="button"
                    className={`k-mixer-btn-action ${allPaused ? 'is-paused' : ''}`}
                    onClick={toggleAllPlayback}
                    title={allPaused ? 'Resume all active audio' : 'Pause all active audio'}
                    aria-label={allPaused ? 'Resume all' : 'Pause all'}
                  >
                    <Icon name={allPaused ? 'play' : 'pause'} className="h-3 w-3" />
                    <span>{allPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    className="k-mixer-btn-action is-danger"
                    onClick={clearAllAudioSources}
                    title="Stop & clear all active sound layers"
                    aria-label="Clear all sounds"
                  >
                    Clear
                  </button>
                </>
              )}

              {totalActiveChannels > 0 ? (
                <button
                  type="button"
                  className={`k-mixer-collapse-toggle ${isMixerExpanded ? 'expanded' : ''}`}
                  onClick={() => setIsMixerExpanded(v => !v)}
                  title={isMixerExpanded ? 'Collapse channel rack' : 'Expand channel rack'}
                  aria-label={isMixerExpanded ? 'Collapse mixer rack' : 'Expand mixer rack'}
                >
                  <span className="k-mixer-channel-count-badge">
                    {totalActiveChannels} active
                  </span>
                  <span className="k-mixer-toggle-arrow" aria-hidden="true">{isMixerExpanded ? '▴' : '▾'}</span>
                </button>
              ) : (
                <span className="k-mixer-standby-pill" title="No active audio layers">
                  Idle
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Active Channel Strips (Expands when channels active) */}
          {isMixerExpanded && totalActiveChannels > 0 && (
            <div className="k-mixer-rack custom-scrollbar">
              <div className="k-mixer-channels-list">
                {/* Active Ambient Layers */}
                  {activeAmbientItems.map(({ sound, volume, isMuted }) => (
                    <div key={sound.url} className={`k-channel-strip ${isMuted ? 'is-muted' : ''}`}>
                      <div className="k-channel-info">
                        <span className="k-channel-thumb" aria-hidden="true">
                          <SoundIcon name={sound.name} />
                        </span>
                        <span className="k-channel-name" title={labelFor(sound.name)}>
                          {labelFor(sound.name)}
                        </span>
                        <span className="k-channel-type-tag">Ambient</span>
                      </div>

                      <div className="k-channel-fader-wrap">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={event => setLayerVolume(sound.url, Number(event.target.value))}
                          aria-label={`${labelFor(sound.name)} volume`}
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
                          onClick={() => toggleSoundMute(sound.url)}
                          title={isMuted ? `Unmute ${labelFor(sound.name)}` : `Mute ${labelFor(sound.name)}`}
                          aria-label={`Mute ${labelFor(sound.name)}`}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          className="k-channel-remove-btn"
                          onClick={() => toggleAmbient(sound)}
                          title={`Stop & remove ${labelFor(sound.name)}`}
                          aria-label={`Remove ${labelFor(sound.name)}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Active Brainwaves Synthesizer Layer */}
                  {audioSettings.isPlaying && (
                    <div className="k-channel-strip is-synth">
                      <div className="k-channel-info">
                        <span className="k-channel-thumb synth-icon" aria-hidden="true">🧠</span>
                        <span className="k-channel-name">
                          {audioSettings.mode === 'noise'
                            ? `${audioSettings.noiseType.toUpperCase()} Noise`
                            : `${audioSettings.mode === 'binaural' ? 'Binaural' : 'Isochronic'} ${audioSettings.beatFrequency}Hz`}
                        </span>
                        <span className="k-channel-type-tag synth">
                          {audioSettings.mode === 'noise' ? 'Noise' : brainwaveBand.name}
                        </span>
                      </div>

                      <div className="k-channel-fader-wrap">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={synthVolume}
                          onChange={event => setSynthVolumeNormalized(Number(event.target.value))}
                          aria-label="Synthesizer tone volume"
                        />
                        <span className="k-channel-vol-readout">{Math.round(synthVolume * 100)}%</span>
                      </div>

                      <div className="k-channel-actions">
                        <button
                          type="button"
                          className="k-channel-remove-btn"
                          onClick={() => setAudioSettings(previous => ({ ...previous, isPlaying: false }))}
                          title="Stop brainwave generator"
                          aria-label="Stop brainwave generator"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Lofi Stream Layer */}
                  {embedUrl && (
                    <div className="k-channel-strip is-lofi">
                      <div className="k-channel-info">
                        <span className="k-channel-thumb lofi-icon" aria-hidden="true">📻</span>
                        <span className="k-channel-name" title={activeLofiName}>
                          {activeLofiName}
                        </span>
                        <span className="k-channel-type-tag lofi">Lofi Stream</span>
                      </div>

                      <div className="k-channel-wave-indicator" aria-hidden="true" title="Playing stream">
                        <span /><span /><span />
                      </div>

                      <div className="k-channel-actions">
                        <button
                          type="button"
                          className="k-channel-remove-btn"
                          onClick={() => setEmbedUrl('')}
                          title="Stop Lofi stream"
                          aria-label="Stop Lofi stream"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Save Atmosphere Action inside Mixer */}
                  {ambientCount > 0 && !isSavingMix && (
                    <button
                      type="button"
                      className="k-mixer-save-mix-trigger"
                      onClick={() => setIsSavingMix(true)}
                      title="Save this mix into your custom atmospheres"
                    >
                      <span>✨ Save current layers as custom Atmosphere</span>
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Tactile Tab Selector (Sound Chooser Library Tabs) */}
        <div className="k-sl-tabs" role="tablist" aria-label="Sound modes">
          {soundTabs.map((item, index) => (
            <button
              key={item.key}
              ref={element => { tabRefs.current[index] = element; }}
              id={`tab-${item.key}`}
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`panel-${item.key}`}
              tabIndex={tab === item.key ? 0 : -1}
              onKeyDown={event => handleTabKeyDown(event, index)}
              onClick={() => setTab(item.key)}
              className="k-sl-tab"
            >
              <span>{item.label}</span>
              {item.key === 'sounds' && ambientCount > 0 && (
                <span className="k-tab-count">{ambientCount}</span>
              )}
              {item.key === 'beats' && audioSettings.isPlaying && (
                <span className="k-tab-dot" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* 2. Scrollable Body Content */}
      <div className="k-sl-body custom-scrollbar">
        {/* TAB 1: AMBIENT SOUNDS */}
        {tab === 'sounds' && (
          <div id="panel-sounds" className="k-sl-tab-panel" role="tabpanel" aria-labelledby="tab-sounds" tabIndex={0}>
            {/* Search Bar - Sized appropriately with crisp vector icon */}
            <div className="k-search">
              <svg className="k-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search rain, cafe, fire, birds..."
                aria-label="Search sounds"
              />
              {query && (
                <button
                  type="button"
                  className="k-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {ambientError && (
              <div className="k-inline-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3.5M8 11h.01" />
                </svg>
                <span>{ambientError}</span>
                <button type="button" onClick={() => setAmbientError('')} aria-label="Dismiss error">✕</button>
              </div>
            )}

            {/* Quick Atmosphere Presets & Custom Mixes */}
            <div className="k-atmosphere-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="k-section-eyebrow">Atmosphere Mixes</span>
                {ambientCount > 0 && !isSavingMix && (
                  <button
                    type="button"
                    className="k-btn-secondary k-btn-xs"
                    onClick={() => setIsSavingMix(true)}
                    title="Save current active sound layers as a custom atmosphere preset"
                  >
                    + Save Current Mix
                  </button>
                )}
              </div>

              {isSavingMix && (
                <div className="k-save-mix-dialog">
                  <div className="k-emoji-trigger-wrap">
                    <button
                      type="button"
                      className="k-emoji-trigger-btn"
                      onClick={() => setEditingEmojiForId(editingEmojiForId === 'new' ? null : 'new')}
                      title="Click to choose mix emoji"
                      aria-label="Choose mix emoji"
                    >
                      <span>{newMixEmoji}</span>
                      <span className="k-emoji-caret">▾</span>
                    </button>

                    {editingEmojiForId === 'new' && (
                      <div className="k-emoji-popover">
                        <div className="k-emoji-grid">
                          {ATMOSPHERE_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              className={`k-emoji-cell ${newMixEmoji === emoji ? 'is-selected' : ''}`}
                              onClick={() => {
                                setNewMixEmoji(emoji);
                                setEditingEmojiForId(null);
                              }}
                              title={`Select ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Name your mix (e.g. Kyoto Night Rain)..."
                    value={newMixName}
                    onChange={e => setNewMixName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCustomMix();
                      if (e.key === 'Escape') {
                        setIsSavingMix(false);
                        setEditingEmojiForId(null);
                      }
                    }}
                    maxLength={32}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="k-btn-hero k-btn-xs"
                    onClick={saveCustomMix}
                    disabled={!newMixName.trim()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="k-btn-secondary k-btn-xs"
                    onClick={() => {
                      setIsSavingMix(false);
                      setEditingEmojiForId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="k-atmosphere-chips">
                {[...DEFAULT_ATMOSPHERE_PRESETS, ...customAtmospheres].map(preset => (
                  <div key={preset.id} className="k-atmo-chip-wrap">
                    <button
                      type="button"
                      className="k-atmosphere-chip"
                      onClick={() => void loadAtmosphere(preset.sounds)}
                      title={`${preset.name}: ${preset.subtitle}`}
                    >
                      {preset.isCustom ? (
                        <span
                          className="k-atmo-icon is-clickable"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingEmojiForId(editingEmojiForId === preset.id ? null : preset.id);
                          }}
                          title="Click to change emoji"
                          aria-label={`Change emoji for ${preset.name}`}
                        >
                          {preset.icon}
                          <span className="k-emoji-edit-badge" aria-hidden="true">✎</span>
                        </span>
                      ) : (
                        <span className="k-atmo-icon">{preset.icon}</span>
                      )}
                      <span>{preset.name}</span>
                      {preset.isCustom && (
                        <span
                          className="k-atm-del-btn"
                          onClick={e => deleteCustomMix(preset.id, e)}
                          title="Delete custom mix"
                          aria-label={`Delete ${preset.name}`}
                        >
                          ✕
                        </span>
                      )}
                    </button>

                    {/* Popover for changing existing custom mix emoji */}
                    {editingEmojiForId === preset.id && (
                      <div className="k-emoji-popover k-emoji-popover-chip">
                        <div className="k-emoji-grid">
                          {ATMOSPHERE_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              className={`k-emoji-cell ${preset.icon === emoji ? 'is-selected' : ''}`}
                              onClick={e => {
                                e.stopPropagation();
                                updateCustomMixEmoji(preset.id, emoji);
                              }}
                              title={`Select ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="k-sl-cats custom-scrollbar" role="group" aria-label="Filter sounds by category">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  className={`k-sl-cat ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sound Cards Grid */}
            <div className="k-sound-grid">
              {filteredSounds.map(sound => {
                const active = sound.url in activeSounds;
                const volume = activeSounds[sound.url] ?? 0.5;
                return (
                  <div key={sound.url} className={`k-sound-card ${active ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="k-sound-card-header"
                      onClick={() => toggleAmbient(sound)}
                      aria-pressed={active}
                      aria-label={`${active ? 'Stop' : 'Play'} ${labelFor(sound.name)}`}
                    >
                      <div className="k-sound-thumb" aria-hidden="true">
                        <SoundIcon name={sound.name} />
                      </div>
                      <span className="k-sound-title">{labelFor(sound.name)}</span>
                      <span className={`k-sound-toggle-badge ${active ? 'is-playing' : ''}`}>
                        {active ? (
                          <span className="k-sound-wave-bars">
                            <span /><span /><span />
                          </span>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 3v10l8-5-8-5z" />
                          </svg>
                        )}
                      </span>
                    </button>
                    {active && (
                      <div className="k-sound-vol-row">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={event => setLayerVolume(sound.url, Number(event.target.value))}
                          aria-label={`${labelFor(sound.name)} volume`}
                        />
                        <span className="k-vol-num">{Math.round(volume * 100)}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="k-sl-credit">
              {SOUNDS.length} sounds curated from <a href="https://github.com/remvze/moodist" target="_blank" rel="noreferrer">Moodist</a>.
            </p>
          </div>
        )}

        {/* TAB 2: BRAINWAVES & BINAURAL BEATS */}
        {tab === 'beats' && (
          <div id="panel-beats" className="beats-panel" role="tabpanel" aria-labelledby="tab-beats" tabIndex={0}>
            {audioError && <p className="audio-status-error" role="alert">{audioError}</p>}

            {/* Mode Selector */}
            <div className="beat-mode-selector" role="group" aria-label="Brainwave generation mode">
              <button
                type="button"
                onClick={() => selectBeatMode('binaural')}
                className={audioSettings.mode === 'binaural' ? 'beat-mode-active' : ''}
              >
                <span className="beat-mode-icon">🎧</span>
                <span className="beat-mode-title">Binaural</span>
                <small>Stereo headphones</small>
              </button>
              <button
                type="button"
                onClick={() => selectBeatMode('isochronic')}
                className={audioSettings.mode === 'isochronic' ? 'beat-mode-active' : ''}
              >
                <span className="beat-mode-icon">🔊</span>
                <span className="beat-mode-title">Isochronic</span>
                <small>Rhythmic pulses</small>
              </button>
              <button
                type="button"
                onClick={() => selectBeatMode('noise')}
                className={audioSettings.mode === 'noise' ? 'beat-mode-active' : ''}
              >
                <span className="beat-mode-icon">🌊</span>
                <span className="beat-mode-title">Colored noise</span>
                <small>Masking texture</small>
              </button>
            </div>

            {/* Live Audio Telemetry Card */}
            <div className={`beat-signal-readout ${audioSettings.isPlaying ? 'is-live' : ''}`}>
              <div className="signal-header">
                <span className="signal-dot" />
                <span className="signal-badge">
                  {audioSettings.mode === 'binaural' ? 'BINAURAL FREQUENCY DIFFERENCE' : audioSettings.mode === 'isochronic' ? 'ACOUSTIC PULSE TRAIN' : 'UNIFORM MASKING TEXTURE'}
                </span>
                {audioSettings.isPlaying && <span className="signal-live-pill">LIVE</span>}
              </div>

              {audioSettings.mode === 'binaural' && (
                <div className="signal-channels">
                  <div className="channel-box">
                    <span className="channel-label">LEFT EAR</span>
                    <b className="channel-val">{audioSettings.baseFrequency} <small>Hz</small></b>
                  </div>
                  <div className="channel-op">+</div>
                  <div className="channel-box">
                    <span className="channel-label">RIGHT EAR</span>
                    <b className="channel-val">{audioSettings.baseFrequency + audioSettings.beatFrequency} <small>Hz</small></b>
                  </div>
                  <div className="channel-op">=</div>
                  <div className="channel-box is-result">
                    <span className="channel-label">{brainwaveBand.name.toUpperCase()} RHYTHM</span>
                    <b className="channel-val accent">{audioSettings.beatFrequency} <small>Hz</small></b>
                  </div>
                </div>
              )}

              {audioSettings.mode === 'isochronic' && (
                <div className="signal-channels">
                  <div className="channel-box">
                    <span className="channel-label">CARRIER PITCH</span>
                    <b className="channel-val">{audioSettings.baseFrequency} <small>Hz</small></b>
                  </div>
                  <div className="channel-op">×</div>
                  <div className="channel-box is-result">
                    <span className="channel-label">PULSE RATE</span>
                    <b className="channel-val accent">{audioSettings.beatFrequency} <small>Hz ({brainwaveBand.name})</small></b>
                  </div>
                </div>
              )}

              {audioSettings.mode === 'noise' && (
                <div className="signal-channels single-line">
                  <div className="channel-box is-result" style={{ flex: 1 }}>
                    <span className="channel-label">ACTIVE TEXTURE</span>
                    <b className="channel-val accent">{audioSettings.noiseType.toUpperCase()} NOISE SPECTRUM</b>
                  </div>
                </div>
              )}

              <p className="signal-desc">
                {audioSettings.mode !== 'noise'
                  ? `Carrier tone at ${audioSettings.baseFrequency} Hz creates a ${carrierCharacter} audible tone. Brain entrains to the ${audioSettings.beatFrequency} Hz ${brainwaveBand.name} rhythm for ${brainwaveBand.use}.`
                  : `${audioSettings.noiseType.toUpperCase()} noise softens background distractions with even acoustic energy distribution.`}
              </p>
            </div>

            {/* Generator Hero Play/Pause Toggle */}
            <button
              type="button"
              onClick={toggleGeneratedAudio}
              className={`sound-main-control ${audioSettings.isPlaying ? 'is-active' : ''}`}
            >
              <Icon name={audioSettings.isPlaying ? 'pause' : 'play'} className="h-4 w-4" />
              <span>{audioSettings.isPlaying ? 'Pause Generator' : 'Start Generator'}</span>
            </button>

            {/* Curated Presets Grid */}
            <div className="beat-presets-section">
              <div className="k-presets-header-row">
                <span className="k-section-eyebrow">Focus Presets</span>
                {!isSavingBeat ? (
                  <button
                    type="button"
                    className="k-save-mix-btn"
                    onClick={() => setIsSavingBeat(true)}
                    title="Save current carrier, rhythm and noise tuning as a custom preset"
                  >
                    <span>+</span> Save Tuning
                  </button>
                ) : (
                  <button
                    type="button"
                    className="k-save-mix-btn is-cancel"
                    onClick={() => setIsSavingBeat(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {isSavingBeat && (
                <div className="k-custom-mix-creator">
                  <input
                    type="text"
                    placeholder="Name your tuning (e.g. 432Hz Deep Alpha)..."
                    value={newBeatName}
                    onChange={e => setNewBeatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCustomBeat();
                      if (e.key === 'Escape') setIsSavingBeat(false);
                    }}
                    maxLength={32}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="k-btn-hero k-btn-xs"
                    onClick={saveCustomBeat}
                    disabled={!newBeatName.trim()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="k-btn-secondary k-btn-xs"
                    onClick={() => setIsSavingBeat(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="beat-grid">
                {[...customBeats, ...beats].map(preset => {
                  const isCustom = 'isCustom' in preset && Boolean(preset.isCustom);
                  const presetId = ('id' in preset && typeof preset.id === 'string') ? preset.id : preset.name;
                  const isActive =
                    audioSettings.isPlaying &&
                    audioSettings.mode === preset.mode &&
                    (preset.mode === 'noise'
                      ? audioSettings.noiseType === preset.noiseType
                      : audioSettings.beatFrequency === preset.beatFrequency &&
                        (preset.baseFrequency === undefined || Math.abs(audioSettings.baseFrequency - preset.baseFrequency) < 15));
                  return (
                    <div
                      key={presetId}
                      className={`beat-card-wrapper ${isActive ? 'is-active' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => applyBeat(preset)}
                        className={`beat-card ${isActive ? 'beat-card-active' : ''}`}
                      >
                        <div className="beat-badge-col">
                          <span className="beat-freq-num">{preset.beatFrequency}</span>
                          <span className="beat-freq-unit">Hz</span>
                        </div>
                        <div className="beat-info">
                          <div className="beat-header-row">
                            <span className="beat-title-group" style={{ display: 'flex', alignItems: 'center' }}>
                              <b>{preset.name}</b>
                              {isCustom && <span className="k-custom-tag">CUSTOM</span>}
                            </span>
                            {isActive && <span className="beat-live-dot" />}
                          </div>
                          <small>{preset.description}</small>
                        </div>
                      </button>
                      {isCustom && 'id' in preset && typeof preset.id === 'string' && (
                        <button
                          type="button"
                          className="k-beat-del-btn"
                          onClick={e => deleteCustomBeat((preset as CustomBeatPreset).id, e)}
                          title="Delete custom preset"
                          aria-label={`Delete ${preset.name}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fine Tuning Controls */}
            <div className="beat-controls">
              <span className="k-section-eyebrow">Acoustic Tuning</span>

              {/* Tone Level */}
              <label className="range-control">
                <span className="range-control-row">
                  <span className="range-control-label">Generator Tone Level</span>
                  <b className="range-control-val">{Math.round((audioSettings.binauralVolume * 100) / 0.3)}%</b>
                </span>
                <input
                  type="range"
                  min="0"
                  max="0.3"
                  step="0.01"
                  value={audioSettings.binauralVolume}
                  aria-label="Generator tone level"
                  onChange={event => update('binauralVolume', Number(event.target.value))}
                />
              </label>

              {/* Carrier Pitch (Only for Binaural & Isochronic) */}
              {audioSettings.mode !== 'noise' && (
                <div className="carrier-control">
                  <div className="control-heading">
                    <span>Carrier Tone (Pitch)</span>
                    <b>{audioSettings.baseFrequency} Hz · {carrierCharacter}</b>
                  </div>
                  <div className="carrier-presets" role="group" aria-label="Carrier tone presets">
                    {carrierPresets.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => update('baseFrequency', preset.value)}
                        className={Math.abs(audioSettings.baseFrequency - preset.value) < 20 ? 'carrier-preset-active' : ''}
                        title={`${preset.label} (${preset.value} Hz) · ${preset.description}`}
                      >
                        <span className="carrier-label">{preset.label}</span>
                        <small className="carrier-hz">{preset.value} Hz</small>
                      </button>
                    ))}
                  </div>
                  <label className="range-control carrier-range">
                    <span className="range-control-row">
                      <span className="range-control-label">Fine Pitch Tuning</span>
                      <b className="range-control-val">{audioSettings.baseFrequency} Hz</b>
                    </span>
                    <input
                      type="range"
                      min="100"
                      max="550"
                      step="1"
                      value={audioSettings.baseFrequency}
                      aria-label="Carrier base frequency"
                      onChange={event => update('baseFrequency', Number(event.target.value))}
                    />
                  </label>
                </div>
              )}

              {/* Focus Rhythm (Brainwave Hz) */}
              {audioSettings.mode !== 'noise' && (
                <div className="rhythm-control">
                  <div className="control-heading">
                    <span>Focus Rhythm (Brainwave Target)</span>
                    <b>{audioSettings.beatFrequency} Hz · {brainwaveBand.name}</b>
                  </div>
                  <div className="brainwave-scale" role="group" aria-label="Brainwave bands">
                    {[
                      { name: 'Theta', range: '4-7 Hz', target: 6 },
                      { name: 'Alpha', range: '8-12 Hz', target: 10 },
                      { name: 'Beta', range: '13-30 Hz', target: 18 },
                      { name: 'Gamma', range: '31+ Hz', target: 40 },
                    ].map(band => {
                      const isBandActive =
                        (band.name === 'Theta' && audioSettings.beatFrequency < 8) ||
                        (band.name === 'Alpha' && audioSettings.beatFrequency >= 8 && audioSettings.beatFrequency < 13) ||
                        (band.name === 'Beta' && audioSettings.beatFrequency >= 13 && audioSettings.beatFrequency < 31) ||
                        (band.name === 'Gamma' && audioSettings.beatFrequency >= 31);
                      return (
                        <button
                          key={band.name}
                          type="button"
                          className={`brainwave-band-btn ${isBandActive ? 'active-band' : ''}`}
                          onClick={() => update('beatFrequency', band.target)}
                          title={`Snap to ${band.name} (${band.range})`}
                        >
                          <span className="band-name">{band.name}</span>
                          <small className="band-range">{band.range}</small>
                        </button>
                      );
                    })}
                  </div>
                  <label className="range-control">
                    <input
                      type="range"
                      min="4"
                      max="40"
                      step="1"
                      value={audioSettings.beatFrequency}
                      aria-label={`Focus rhythm ${audioSettings.beatFrequency} Hz, ${brainwaveBand.name}`}
                      onChange={event => update('beatFrequency', Number(event.target.value))}
                    />
                  </label>
                </div>
              )}

              {/* Background Noise Layer */}
              <div className="noise-blend-control">
                <div className="control-heading">
                  <span>Background Masking Noise</span>
                  <b>{Math.round((audioSettings.noiseVolume * 100) / 0.35)}%</b>
                </div>
                <div className="noise-type-chips" role="group" aria-label="Masking noise type">
                  {(['pink', 'brown', 'white'] as const).map(nType => (
                    <button
                      key={nType}
                      type="button"
                      className={`noise-type-chip ${audioSettings.noiseType === nType ? 'active' : ''}`}
                      onClick={() => update('noiseType', nType)}
                      title={`${nType.toUpperCase()} noise: ${
                        nType === 'pink' ? 'Balanced rain-like falloff' : nType === 'brown' ? 'Deep waterfall ADHD calm' : 'Full-spectrum voice masking'
                      }`}
                    >
                      <span className="noise-chip-name">{nType.toUpperCase()}</span>
                      <small className="noise-chip-desc">
                        {nType === 'pink' ? 'Natural Rain' : nType === 'brown' ? 'Deep Waterfall' : 'Voice Masking'}
                      </small>
                    </button>
                  ))}
                </div>
                <label className="range-control">
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step="0.01"
                    value={audioSettings.noiseVolume}
                    aria-label="Background noise volume"
                    onChange={event => update('noiseVolume', Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            {/* Interactive Human Physiology Guide */}
            <details className="k-physio-guide">
              <summary className="k-physio-summary">
                <span className="k-physio-summary-icon">🧠</span>
                <span className="k-physio-summary-text">The Physiology of Brainwave Entrainment</span>
                <span className="k-physio-arrow">▾</span>
              </summary>
              <div className="k-physio-content">
                <div className="k-physio-grid">
                  <div className="k-physio-item">
                    <span className="k-physio-badge theta">THETA · 4-7 HZ</span>
                    <h4>Deep Insight & Daydreaming</h4>
                    <p>Bridges conscious and subconscious mind. Optimal for creative ideation, visualization, and non-linear breakthroughs.</p>
                  </div>
                  <div className="k-physio-item">
                    <span className="k-physio-badge alpha">ALPHA · 8-12 HZ</span>
                    <h4>Effortless Flow & Relaxed Alertness</h4>
                    <p>Reduces sensory chatter while maintaining sharp alertness. The gold standard for deep reading, writing, and long coding sessions without burnout.</p>
                  </div>
                  <div className="k-physio-item">
                    <span className="k-physio-badge beta">BETA · 13-30 HZ</span>
                    <h4>Active Cognition & Logic</h4>
                    <p>Drives fast analytical thinking, mental arithmetic, and active problem solving. Best during challenging debugging or sprint work.</p>
                  </div>
                  <div className="k-physio-item">
                    <span className="k-physio-badge gamma">GAMMA · 31-40+ HZ</span>
                    <h4>Peak Binding & Synthesis</h4>
                    <p>Associated with high-level cognitive integration across brain hemispheres, simultaneous memory recall, and peak alertness.</p>
                  </div>
                </div>
                <div className="k-physio-notes">
                  <div className="k-physio-note">
                    <b>🎧 Binaural Beats:</b> Plays two slightly offset frequencies into left & right ears (e.g. 216 Hz & 226 Hz). Your brainstem integrates them into an internal 10 Hz Alpha beat. <em>Requires stereo headphones.</em>
                  </div>
                  <div className="k-physio-note">
                    <b>🔊 Isochronic Pulses:</b> Even acoustic pulses of a single tone turned on and off rapidly. Highly effective on regular speakers without headphones.
                  </div>
                  <div className="k-physio-note">
                    <b>🌿 Carrier Tones:</b> 140 Hz provides a grounding bass rumble; 432 Hz and 528 Hz provide harmonic warmth and acoustic clarity.
                  </div>
                </div>
              </div>
            </details>

            <p className="sound-note">
              🎧 Binaural beats require stereo headphones for phase separation. Isochronic tones work on all speakers.
            </p>
          </div>
        )}

        {/* TAB 3: LOFI & CURATED FOCUS STREAMS */}
        {tab === 'lofi' && (
          <div id="panel-lofi" className="lofi-panel" role="tabpanel" aria-labelledby="tab-lofi" tabIndex={0}>
            {/* Header with Save Stream CTA */}
            <div className="k-lofi-section-header">
              <span className="k-lofi-section-label">1-Click Curated Focus Streams</span>
              <button
                type="button"
                className={`k-save-mix-btn ${isSavingStream ? 'is-cancel' : ''}`}
                onClick={() => {
                  if (isSavingStream) {
                    setIsSavingStream(false);
                    setStreamSaveError('');
                  } else {
                    openStreamCreatorWithUrl(mediaUrl || '');
                  }
                }}
                title={isSavingStream ? 'Cancel' : 'Save a custom YouTube or Spotify link as a 1-click stream'}
              >
                {isSavingStream ? '✕ Cancel' : '+ Save Custom Stream'}
              </button>
            </div>

            {/* Inlined Stream Creator (when user clicks + Save Custom Stream) */}
            {isSavingStream && (
              <div className="k-saved-stream-creator">
                <div className="k-saved-stream-creator-header">
                  <span className="k-creator-title">Save 1-Click Focus Stream</span>
                  <span className="k-creator-sub">Bookmark your favorite YouTube or Spotify links for instant access</span>
                </div>

                <div className="k-creator-field">
                  <label htmlFor="k-stream-name-input">Stream Name</label>
                  <input
                    id="k-stream-name-input"
                    type="text"
                    placeholder="e.g. Kyoto Night Rain, Synthwave Coding, Chopin Nocturnes..."
                    value={newStreamName}
                    onChange={e => setNewStreamName(e.target.value)}
                    maxLength={48}
                  />
                </div>

                <div className="k-creator-field">
                  <label htmlFor="k-stream-url-input">Stream Link (YouTube or Spotify)</label>
                  <div className="k-creator-url-row">
                    <input
                      id="k-stream-url-input"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... or Spotify playlist"
                      value={newStreamUrl}
                      onChange={e => {
                        setNewStreamUrl(e.target.value);
                        setStreamSaveError('');
                      }}
                    />
                    {parseMediaEmbed(newStreamUrl) && (
                      <span className="k-url-valid-badge" title="Valid stream link">
                        {parseMediaEmbed(newStreamUrl)?.provider === 'spotify' ? '🟢 Spotify' : '🟢 YouTube'}
                      </span>
                    )}
                  </div>
                  {streamSaveError && <p className="lofi-error">{streamSaveError}</p>}
                </div>

                <div className="k-creator-field">
                  <label>Category Badge</label>
                  <div className="k-badge-tags-row">
                    {['LOFI', 'SPOTIFY', 'LIVE', 'SYNTH', 'AMBIENT', 'STUDY', 'CLASSICAL', 'JAZZ'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`k-badge-tag-btn ${newStreamBadge === tag ? 'is-selected' : ''}`}
                        onClick={() => setNewStreamBadge(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="k-creator-field">
                  <label>Stream Icon</label>
                  <div className="k-emoji-row">
                    {['🎧', '☕', '⚡', '🎹', '🌧️', '📻', '🌿', '🌙', '🌌', '🧘'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`k-emoji-cell ${newStreamEmoji === emoji ? 'is-selected' : ''}`}
                        onClick={() => setNewStreamEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="k-custom-mix-actions">
                  <button
                    type="button"
                    className="k-btn-hero k-btn-xs"
                    onClick={() => saveCustomStream()}
                    disabled={!newStreamUrl.trim()}
                  >
                    Save & Play
                  </button>
                  <button
                    type="button"
                    className="k-btn-secondary k-btn-xs"
                    onClick={() => {
                      setIsSavingStream(false);
                      setStreamSaveError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* My Saved Streams Section (if any saved) */}
            {savedStreams.length > 0 && (
              <div className="k-saved-streams-section">
                <span className="k-lofi-section-label">My Saved Streams ({savedStreams.length})</span>
                <div className="k-curated-stations-grid">
                  {savedStreams.map(stream => {
                    const isActive = embedUrl.includes(stream.embedUrl) || (stream.originalUrl && embedUrl.includes(stream.originalUrl));
                    return (
                      <div
                        key={stream.id}
                        className={`k-station-card is-custom-stream ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          if (isActive) {
                            setEmbedUrl('');
                          } else {
                            const targetUrl = stream.provider === 'youtube' && !stream.embedUrl.includes('autoplay')
                              ? `${stream.embedUrl}?autoplay=1`
                              : stream.embedUrl;
                            setEmbedUrl(targetUrl);
                            setMediaError('');
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isActive) setEmbedUrl('');
                            else setEmbedUrl(stream.embedUrl);
                          }
                        }}
                        title={`${isActive ? 'Stop' : 'Play'} ${stream.name}`}
                      >
                        <div className="k-station-card-head">
                          <div className="k-station-badge-group">
                            {stream.emoji && <span className="k-station-emoji">{stream.emoji}</span>}
                            <span className="k-station-badge">{stream.badge}</span>
                          </div>
                          <div className="k-station-card-actions">
                            {isActive && (
                              <div className="k-station-wave" aria-label="Playing">
                                <span /><span /><span />
                              </div>
                            )}
                            <button
                              type="button"
                              className="k-station-del-btn"
                              onClick={e => deleteSavedStream(stream.id, e)}
                              title={`Delete ${stream.name}`}
                              aria-label={`Delete saved stream ${stream.name}`}
                            >
                              <TbTrash size={13} />
                            </button>
                          </div>
                        </div>
                        <b className="k-station-title">{stream.name}</b>
                        <span className="k-station-subtitle">
                          {stream.subtitle || (stream.provider === 'spotify' ? 'Spotify playlist' : 'YouTube focus stream')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Curated Stations Grid */}
            <div className="k-curated-stations-grid">
              {CURATED_LOFI_STATIONS.map(station => {
                const isActive = embedUrl.includes(station.youtubeId);
                return (
                  <button
                    key={station.id}
                    type="button"
                    className={`k-station-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      if (isActive) {
                        setEmbedUrl('');
                      } else {
                        setEmbedUrl(`https://www.youtube-nocookie.com/embed/${station.youtubeId}?autoplay=1`);
                        setMediaError('');
                      }
                    }}
                    title={`${isActive ? 'Stop' : 'Play'} ${station.name}`}
                  >
                    <div className="k-station-card-head">
                      <span className="k-station-badge">{station.badge}</span>
                      {isActive && (
                        <div className="k-station-wave" aria-label="Playing">
                          <span /><span /><span />
                        </div>
                      )}
                    </div>
                    <b className="k-station-title">{station.name}</b>
                    <span className="k-station-subtitle">{station.subtitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Embed Player */}
            {embedUrl ? (
              <div className="lofi-player">
                {!isCurrentEmbedCurated && !isCurrentEmbedSaved && (
                  <div className="k-stream-quick-save-bar">
                    <span className="k-quick-save-prompt">Like this stream? Save it to My Streams!</span>
                    <button
                      type="button"
                      className="k-quick-save-btn"
                      onClick={() => openStreamCreatorWithUrl(mediaUrl || embedUrl)}
                    >
                      <TbBookmark size={13} />
                      <span>Save as 1-Click Stream</span>
                    </button>
                  </div>
                )}
                {isCurrentEmbedSaved && (
                  <div className="k-stream-saved-badge-bar">
                    <span className="k-saved-pill">
                      <TbBookmarkFilled size={12} />
                      <span>Saved in My Streams</span>
                    </span>
                  </div>
                )}
                <iframe
                  src={embedUrl}
                  title="Lofi player"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  sandbox="allow-scripts allow-popups"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  allowFullScreen
                />
                <button onClick={() => setEmbedUrl('')} aria-label="Close lofi player">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="lofi-empty">
                <p>Click any 1-click station above or paste your custom playlist below.</p>
              </div>
            )}

            {/* Custom URL Input */}
            <div style={{ marginTop: 6 }}>
              <span className="k-lofi-section-label">Custom YouTube or Spotify Link</span>
              <div className="lofi-input">
                <input
                  value={mediaUrl}
                  onChange={event => { setMediaUrl(event.target.value); setMediaError(''); }}
                  onKeyDown={event => event.key === 'Enter' && startLofi()}
                  placeholder="Paste YouTube or Spotify link..."
                  aria-label="Lofi media link"
                  aria-invalid={Boolean(mediaUrl.trim() && !parseMediaEmbed(mediaUrl))}
                  aria-describedby="lofi-link-help"
                />
                <button onClick={startLofi} disabled={!parseMediaEmbed(mediaUrl)}>Load</button>
                <button
                  type="button"
                  className="k-btn-save-inline"
                  onClick={() => openStreamCreatorWithUrl(mediaUrl)}
                  disabled={!parseMediaEmbed(mediaUrl)}
                  title="Save this link to your 1-click focus streams"
                >
                  <TbPlus size={13} style={{ marginRight: 3, verticalAlign: -1 }} />
                  Save
                </button>
              </div>
              <p id="lofi-link-help" className={mediaError ? 'lofi-error' : 'lofi-hint'} role={mediaError ? 'alert' : undefined}>
                {mediaError || (mediaUrl.trim() ? (parseMediaEmbed(mediaUrl) ? 'Valid link detected. Click Load to play or Save to keep it!' : 'Paste a valid HTTPS YouTube or Spotify link.') : 'Supports YouTube videos, playlists and Spotify playlists.')}
              </p>
            </div>
          </div>
        )}
      </div>

    </section>
  );
};

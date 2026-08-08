import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioSettings } from '../types';
import { Icon } from './Icon';
import moodistSounds from '../moodist_sounds_utf8.json';
import { isTrustedAmbientUrl, parseMediaEmbed } from '../utils/embed';

interface ControlPanelProps {
  audioSettings: AudioSettings;
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  resumeAudio: () => Promise<void>;
  audioError: string | null;
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
};

const beats: BeatPreset[] = [
  { name: 'Deep focus', description: '14 Hz beta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 14, tone: 0.08, noise: 0.06 },
  { name: 'Creative flow', description: '10 Hz alpha + brown noise', mode: 'binaural', noiseType: 'brown', beatFrequency: 10, tone: 0.07, noise: 0.05 },
  { name: 'Calm focus', description: '6 Hz theta + pink noise', mode: 'binaural', noiseType: 'pink', beatFrequency: 6, tone: 0.06, noise: 0.07 },
  { name: 'Gamma sprint', description: '40 Hz isochronic pulse', mode: 'isochronic', noiseType: 'pink', beatFrequency: 40, tone: 0.055, noise: 0.035 },
  { name: 'White noise', description: 'Bright, even masking texture', mode: 'noise', noiseType: 'white', beatFrequency: 12, tone: 0, noise: 0.18 },
  { name: 'Pink noise', description: 'Balanced masking texture', mode: 'noise', noiseType: 'pink', beatFrequency: 10, tone: 0, noise: 0.2 },
  { name: 'Brown noise', description: 'Deep, low masking texture', mode: 'noise', noiseType: 'brown', beatFrequency: 8, tone: 0, noise: 0.22 },
];

const carrierPresets = [
  { label: 'Deep', description: 'Low and soft', value: 140 },
  { label: 'Warm', description: 'Balanced', value: 200 },
  { label: 'Clear', description: 'Light and bright', value: 280 },
];

const brainwaveBandFor = (frequency: number) => {
  if (frequency < 8) return { name: 'Theta', use: 'calm and inward' };
  if (frequency < 13) return { name: 'Alpha', use: 'relaxed attention' };
  if (frequency < 31) return { name: 'Beta', use: 'active focus' };
  return { name: 'Gamma', use: 'intense processing' };
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

/* Sound category iconography -- one drawn glyph per family, matched to
   whichever sound name is passed. All strokes ride on currentColor so the
   active/inactive tint from the parent card carries through. */
const SoundIcon: React.FC<{ name: string }> = ({ name }) => {
  const shared = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const family = /rain/.test(name) ? 'rain'
    : /storm|thunder/.test(name) ? 'storm'
    : /wave|ocean|water|river|stream|drip|underwater/.test(name) ? 'water'
    : /wind|leaves|trees|forest|jungle|nature/.test(name) ? 'wind'
    : /fire|camp|fireplace/.test(name) ? 'fire'
    : /cafe|restaurant|crowd|library|office/.test(name) ? 'cafe'
    : /keyboard|typewriter|typing|writing/.test(name) ? 'keyboard'
    : /train|traffic|car|highway|road|city/.test(name) ? 'transit'
    : /cat|dog|bird|animal|purr/.test(name) ? 'animal'
    : /vinyl|tape|radio|static|noise/.test(name) ? 'vinyl'
    : /snow|winter/.test(name) ? 'snow'
    : /night|crickets|owl/.test(name) ? 'night'
    : 'wave';

  switch (family) {
    case 'rain':     return <svg {...shared}><path d="M6 11a4 4 0 018-1 3 3 0 011 5.8" /><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" /></svg>;
    case 'storm':    return <svg {...shared}><path d="M6 11a4 4 0 018-1 3 3 0 011 5.8" /><path d="M11 15l-2 4h3l-2 3" /></svg>;
    case 'water':    return <svg {...shared}><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>;
    case 'wind':     return <svg {...shared}><path d="M4 9h11a3 3 0 100-6" /><path d="M3 14h14a3 3 0 110 6" /><path d="M4 19h4" /></svg>;
    case 'fire':     return <svg {...shared}><path d="M12 3c-3 4 1 6 1 9a3 3 0 11-6 0c0-1 .3-2 1-3-1 4 4 4 4 0 0-3-1-3 0-6z" /></svg>;
    case 'cafe':     return <svg {...shared}><path d="M4 8h13v6a4 4 0 01-4 4H8a4 4 0 01-4-4z" /><path d="M17 10h2a2 2 0 010 4h-2" /><path d="M8 4c-1 1-1 2 0 3M12 4c-1 1-1 2 0 3" /></svg>;
    case 'keyboard': return <svg {...shared}><rect x="2" y="7" width="20" height="12" rx="2" /><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M6 15h12" /></svg>;
    case 'transit':  return <svg {...shared}><rect x="5" y="3" width="14" height="15" rx="2" /><path d="M5 12h14M9 6h6" /><circle cx="9" cy="15" r=".8" fill="currentColor" /><circle cx="15" cy="15" r=".8" fill="currentColor" /><path d="M7 20l-1 2M17 20l1 2" /></svg>;
    case 'animal':   return <svg {...shared}><path d="M5 12c0-3 2-6 5-6s5 3 5 6-2 5-5 5-5-2-5-5z" /><path d="M6 6l1 2M12 6l1 2M18 6l1 2" /><circle cx="9" cy="12" r=".8" fill="currentColor" /><circle cx="13" cy="12" r=".8" fill="currentColor" /></svg>;
    case 'vinyl':    return <svg {...shared}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></svg>;
    case 'snow':     return <svg {...shared}><path d="M12 3v18M4 8l16 8M4 16l16-8" /><path d="M12 6l-1.5-1.5M12 6l1.5-1.5M12 18l-1.5 1.5M12 18l1.5 1.5" /></svg>;
    case 'night':    return <svg {...shared}><path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z" /></svg>;
    default:         return <svg {...shared}><path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" /></svg>;
  }
};

const SOUNDS = (moodistSounds as Sound[])
  .filter(sound => sound.name !== 'alarm' && isTrustedAmbientUrl(sound.url));

const FEATURED_NAMES = new Set([
  'heavy-rain', 'rain-on-window', 'waves', 'campfire', 'river', 'wind-in-trees',
  'cafe', 'library', 'inside-a-train', 'keyboard', 'vinyl-effect', 'cat-purring',
]);

const CATEGORIES = ['Featured', ...Array.from(new Set(SOUNDS.map(categoryFor))).sort()];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  audioSettings,
  setAudioSettings,
  resumeAudio,
  audioError,
}) => {
  const [tab, setTab] = useState<'sounds' | 'beats' | 'lofi'>('sounds');
  const [category, setCategory] = useState('Featured');
  const [query, setQuery] = useState('');
  const [activeSounds, setActiveSounds] = useState<Record<string, number>>({});
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [ambientError, setAmbientError] = useState('');
  const players = useRef(new Map<string, HTMLAudioElement>());
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* Master is a true master: every source is scaled by it, so moving one
     slider changes loudness predictably no matter which tab you are on.
     Per-source sliders stay relative to the master, never above it. */
  const masterVolume = audioSettings.masterVolume;
  const masterRef = useRef(masterVolume);
  const activeSoundsRef = useRef(activeSounds);
  activeSoundsRef.current = activeSounds;

  useEffect(() => {
    masterRef.current = masterVolume;
    players.current.forEach((player, url) => {
      const layer = activeSoundsRef.current[url] ?? 0.5;
      player.volume = Math.min(1, Math.max(0, layer * masterVolume));
    });
  }, [masterVolume]);

  const soundTabs: Array<{ key: typeof tab; label: string }> = [
    { key: 'sounds', label: 'Sounds' },
    { key: 'beats', label: 'Beats' },
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
      return;
    }

    const player = new Audio(sound.url);
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
      setAmbientError(`${labelFor(sound.name)} could not be loaded. Check your connection and try again.`);
    };
    setAmbientPaused(false);
    setActiveSounds(previous => ({ ...previous, [sound.url]: 0.3 }));

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
      setAmbientError('Your browser blocked audio playback. Press the sound again to retry.');
    }
  };

  const setLayerVolume = (url: string, volume: number) => {
    const player = players.current.get(url);
    if (player) player.volume = Math.min(1, Math.max(0, volume * masterRef.current));
    setActiveSounds(previous => ({ ...previous, [url]: volume }));
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

  const clearAmbient = () => {
    players.current.forEach(player => {
      player.pause();
      player.onerror = null;
      player.src = '';
    });
    players.current.clear();
    setActiveSounds({});
    setAmbientPaused(false);
  };

  const applyBeat = (preset: BeatPreset) => {
    setAudioSettings(previous => ({
      ...previous,
      isPlaying: false,
      engineEnabled: true,
      ambientPreset: 'none',
      mode: preset.mode,
      noiseType: preset.noiseType,
      beatFrequency: preset.beatFrequency,
      binauralVolume: preset.tone,
      noiseVolume: preset.noise,
    }));
    void resumeAudio()
      .then(() => setAudioSettings(previous => ({ ...previous, isPlaying: true })))
      .catch(() => setAudioSettings(previous => ({ ...previous, isPlaying: false })));
  };

  const selectBeatMode = (mode: AudioSettings['mode']) => {
    setAudioSettings(previous => ({
      ...previous,
      engineEnabled: true,
      ambientPreset: 'none',
      mode,
      binauralVolume: mode === 'noise' ? 0 : Math.max(previous.binauralVolume, 0.06),
      noiseVolume: mode === 'noise' ? Math.max(previous.noiseVolume, 0.18) : previous.noiseVolume,
    }));
  };

  const update = <Key extends keyof AudioSettings>(key: Key, value: AudioSettings[Key]) => {
    setAudioSettings(previous => ({ ...previous, [key]: value }));
  };

  const startLofi = () => {
    const embed = parseMediaEmbed(mediaUrl);
    setEmbedUrl(embed?.url ?? '');
    setMediaError(embed ? '' : 'Use a valid HTTPS YouTube video, live stream, playlist, or Spotify link.');
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

  const activeEntries = Object.entries(activeSounds);
  const brainwaveBand = brainwaveBandFor(audioSettings.beatFrequency);
  const carrierCharacter = carrierCharacterFor(audioSettings.baseFrequency);

  return (
    <section className="k-sl-inner" data-audio-mode={audioSettings.mode}>
      <header className="k-sl-head">
        <h2>Sound Library</h2>
        <div className="k-search" style={{ marginTop: 12 }}>
          <Icon name="search" className="h-4 w-4" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search sounds"
            aria-label="Search sounds"
          />
        </div>
        <div className="k-sl-tabs" role="tablist" aria-label="Sound modes" style={{ marginTop: 12 }}>
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
            >{item.label}</button>
          ))}
        </div>

      </header>

      {tab === 'sounds' && (
        <div id="panel-sounds" className="k-sl-list custom-scrollbar" role="tabpanel" aria-labelledby="tab-sounds" tabIndex={0} data-testid="sounds-list">
          {ambientError && (
            <div className="k-inline-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 5v3.5M8 11h.01" />
              </svg>
              <span>{ambientError}</span>
              <button type="button" onClick={() => setAmbientError('')} aria-label="Dismiss error">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </div>
          )}

          <div className="k-sl-cats" role="group" aria-label="Filter sounds by category">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                className={`k-sl-cat ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >{cat}</button>
            ))}
          </div>


          {activeEntries.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <button className="k-btn" style={{ minHeight: 32, fontSize: 12, padding: '0 10px' }} onClick={toggleAmbientPlayback}>
                <Icon name={ambientPaused ? 'play' : 'pause'} className="h-3 w-3" />
                {ambientPaused ? 'Resume all' : 'Pause all'}
              </button>
              <button className="k-btn" style={{ minHeight: 32, fontSize: 12, padding: '0 10px' }} onClick={clearAmbient}>
                Clear
              </button>
            </div>
          )}

          {filteredSounds.map(sound => {
            const active = sound.url in activeSounds;
            const volume = activeSounds[sound.url] ?? 0.5;
            return (
              <div key={sound.url} className={`k-sound-card ${active ? 'active' : ''}`}>
                <button
                  className="k-sound-thumb"
                  onClick={() => toggleAmbient(sound)}
                  aria-label={active ? `Pause ${labelFor(sound.name)}` : `Play ${labelFor(sound.name)}`}
                >
                  <SoundIcon name={sound.name} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <div className="k-sound-title">{labelFor(sound.name)}</div>
                  {active && (
                    <input
                      type="range"
                      min="0" max="1" step="0.01"
                      value={volume}
                      onChange={event => setLayerVolume(sound.url, Number(event.target.value))}
                      aria-label={`${labelFor(sound.name)} volume`}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  )}
                </div>
                <div className="k-sound-controls">
                  <button
                    className={`k-icon-btn ${active ? 'playing' : ''}`}
                    onClick={() => toggleAmbient(sound)}
                    aria-label={active ? 'Remove from mix' : 'Add to mix'}
                  >
                    <Icon name={active ? 'pause' : 'play'} className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          <p style={{ marginTop: 12, color: 'var(--sumi-3)', fontSize: 11, lineHeight: 1.5 }}>
            {SOUNDS.length} sources adapted from <a href="https://github.com/remvze/moodist" target="_blank" rel="noreferrer" style={{ color: 'var(--sumi-2)', textDecoration: 'underline' }}>Moodist</a>.
          </p>

          <div className="k-master">
            <Icon name={masterVolume === 0 ? 'volumeOff' : 'volumeUp'} className="h-4 w-4" />
            <span>Master volume</span>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={masterVolume}
              onChange={event => update('masterVolume', Number(event.target.value))}
              aria-label={`Master volume ${Math.round(masterVolume * 100)} percent`}
            />
            <b>{Math.round(masterVolume * 100)}%</b>
          </div>
        </div>
      )}

      {tab === 'beats' && (
        <div id="panel-beats" className="beats-panel" role="tabpanel" aria-labelledby="tab-beats" tabIndex={0}>
          {audioError && <p className="audio-status-error" role="alert">{audioError}</p>}
          <div className="beat-mode-selector" role="group" aria-label="Generated audio mode">
            <button onClick={() => selectBeatMode('binaural')} className={audioSettings.mode === 'binaural' ? 'beat-mode-active' : ''}>
              <span>Binaural</span>
              <small>Stereo headphones</small>
            </button>
            <button onClick={() => selectBeatMode('isochronic')} className={audioSettings.mode === 'isochronic' ? 'beat-mode-active' : ''}>
              <span>Isochronic</span>
              <small>Rhythmic pulses</small>
            </button>
            <button onClick={() => selectBeatMode('noise')} className={audioSettings.mode === 'noise' ? 'beat-mode-active' : ''}>
              <span>Colored noise</span>
              <small>No beat tone</small>
            </button>
          </div>

          <div className="beat-signal-readout">
            <span className="signal-dot" />
            {audioSettings.mode === 'binaural' && (
              <p>
                Left <b>{audioSettings.baseFrequency} Hz</b>
                <span>+</span>
                Right <b>{audioSettings.baseFrequency + audioSettings.beatFrequency} Hz</b>
                <span>=</span>
                Perceived beat <b>{audioSettings.beatFrequency} Hz</b>
              </p>
            )}
            {audioSettings.mode === 'isochronic' && (
              <p>
                Carrier <b>{audioSettings.baseFrequency} Hz</b>
                <span>pulsed</span>
                <b>{audioSettings.beatFrequency} times/second</b>
              </p>
            )}
            {audioSettings.mode === 'noise' && (
              <p>
                Continuous <b>{audioSettings.noiseType} noise</b>
                <span>with no carrier tone</span>
              </p>
            )}
          </div>

          {audioSettings.mode !== 'noise' && (
            <div className="audio-explainer">
              <div>
                <span>What you hear</span>
                <b>{audioSettings.baseFrequency} Hz {carrierCharacter} carrier</b>
              </div>
              <div>
                <span>Focus rhythm</span>
                <b>{audioSettings.beatFrequency} Hz · {brainwaveBand.name}</b>
              </div>
              <p>
                The carrier is the audible pitch. The {brainwaveBand.name.toLowerCase()} rhythm is the slower pattern used for {brainwaveBand.use}.
              </p>
            </div>
          )}

          <div className="beat-grid">
            {beats.map(preset => (
              <button key={preset.name} onClick={() => applyBeat(preset)} className={`beat-card ${audioSettings.isPlaying && audioSettings.mode === preset.mode && audioSettings.beatFrequency === preset.beatFrequency ? 'beat-card-active' : ''}`}>
                <span className="beat-frequency">{preset.beatFrequency}<small>Hz</small></span>
                <span className="text-left"><b>{preset.name}</b><small>{preset.description}</small></span>
              </button>
            ))}
          </div>
          <div className="beat-controls">
            <button onClick={toggleGeneratedAudio} className="sound-main-control">
              <Icon name={audioSettings.isPlaying ? 'pause' : 'play'} className="h-4 w-4" />
              {audioSettings.isPlaying ? 'Pause generator' : 'Play generator'}
            </button>
            <label className="range-control">
              <span>Generator level <b>{Math.round(audioSettings.binauralVolume * 100 / 0.3)}%</b></span>
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.01"
                value={audioSettings.binauralVolume}
                aria-label="Generated audio level"
                onChange={event => update('binauralVolume', Number(event.target.value))}
              />
            </label>

            {audioSettings.mode !== 'noise' && (
              <div className="carrier-control">
                <div className="control-heading">
                  <span>Carrier tone</span>
                  <b>{audioSettings.baseFrequency} Hz · {carrierCharacter}</b>
                </div>
                <p>Choose the pitch you prefer. It changes the sound character, not the focus rhythm.</p>
                <div className="carrier-presets" role="group" aria-label="Carrier tone presets">
                  {carrierPresets.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => update('baseFrequency', preset.value)}
                      className={Math.abs(audioSettings.baseFrequency - preset.value) < 20 ? 'carrier-preset-active' : ''}
                    >
                      <span>{preset.label}</span>
                      <small>{preset.value} Hz · {preset.description}</small>
                    </button>
                  ))}
                </div>
                <label className="range-control carrier-range">
                  <span>Fine tune <b>{audioSettings.baseFrequency} Hz</b></span>
                  <input type="range" min="100" max="440" step="5" value={audioSettings.baseFrequency} onChange={event => update('baseFrequency', Number(event.target.value))} />
                </label>
              </div>
            )}

            <div className="rhythm-control">
              <div className="control-heading">
                <span>Focus rhythm</span>
                <b>{audioSettings.beatFrequency} Hz · {brainwaveBand.name}</b>
              </div>
              <div className="brainwave-scale" aria-hidden="true">
                <span>Theta</span>
                <span>Alpha</span>
                <span>Beta</span>
                <span>Gamma</span>
              </div>
              <label className="range-control">
                <span className="sr-only">Beat frequency</span>
                <input type="range" min="4" max="40" step="1" value={audioSettings.beatFrequency} aria-label={`Focus rhythm ${audioSettings.beatFrequency} Hz, ${brainwaveBand.name}`} onChange={event => update('beatFrequency', Number(event.target.value))} />
              </label>
              <p>{brainwaveBand.name} is commonly associated with {brainwaveBand.use}. Treat this as a sound preference, not a medical effect.</p>
            </div>
          </div>
          <p className="sound-note">Binaural beats need stereo headphones. Isochronic tones work with speakers or headphones. Keep the volume comfortable.</p>
        </div>
      )}

      {tab === 'lofi' && (
        <div id="panel-lofi" className="lofi-panel" role="tabpanel" aria-labelledby="tab-lofi" tabIndex={0}>
          <div className="lofi-intro">
            <span className="lofi-mark"><Icon name="play" className="h-5 w-5" /></span>
            <div>
              <h3>Play your lofi stream here</h3>
              <p>Paste a YouTube video, YouTube live stream, or Spotify playlist. It stays beside your timer.</p>
            </div>
          </div>
          <div className="lofi-input">
            <input
              value={mediaUrl}
              onChange={event => { setMediaUrl(event.target.value); setMediaError(''); }}
              onKeyDown={event => event.key === 'Enter' && startLofi()}
              placeholder="Paste YouTube or Spotify link"
              aria-label="Lofi media link"
              aria-invalid={Boolean(mediaUrl.trim() && !parseMediaEmbed(mediaUrl))}
              aria-describedby="lofi-link-help"
            />
            <button onClick={startLofi} disabled={!parseMediaEmbed(mediaUrl)}>Load player</button>
          </div>
          <p id="lofi-link-help" className={mediaError ? 'lofi-error' : 'lofi-hint'} role={mediaError ? 'alert' : undefined}>
            {mediaError || (mediaUrl.trim() ? (parseMediaEmbed(mediaUrl) ? 'Link ready — YouTube or Spotify detected.' : 'Paste a valid HTTPS YouTube or Spotify link.') : 'Supports YouTube videos, live streams, playlists and Spotify playlists.')}
          </p>
          {embedUrl ? (
            <div className="lofi-player">
              <iframe
                src={embedUrl}
                title="Lofi player"
                allow="autoplay; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-popups"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
                allowFullScreen
              />
              <button onClick={() => setEmbedUrl('')} aria-label="Close lofi player"><Icon name="close" className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="lofi-empty">
              <p>No stream loaded</p>
              <a href="https://www.youtube.com/@LofiGirl" target="_blank" rel="noreferrer">Browse the official Lofi Girl channel</a>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

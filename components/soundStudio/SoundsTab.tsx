import React from 'react';
import { CATEGORIES, SOUNDS, SoundIcon, labelFor, type Sound } from './soundCatalog';

type Props = {
  query: string;
  onQuery: (value: string) => void;
  error: string;
  onDismissError: () => void;
  category: string;
  onCategory: (value: string) => void;
  sounds: Sound[];
  activeSounds: Record<string, number>;
  onToggle: (sound: Sound) => void;
};

/** Sound Studio > Sounds: search, category filter and the tap-to-toggle tile grid. */
export const SoundsTab: React.FC<Props> = ({ query, onQuery: setQuery, error: ambientError, onDismissError, category, onCategory: setCategory, sounds: filteredSounds, activeSounds, onToggle: toggleAmbient }) => (
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
                <button type="button" onClick={onDismissError} aria-label="Dismiss error">✕</button>
              </div>
            )}

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

            {/* Sound tiles: tap to add or remove. Volume lives in "Now playing" above, in one place. */}
            <div className="k-sound-tiles" role="list">
              {filteredSounds.map(sound => {
                const active = sound.url in activeSounds;
                return (
                  <button
                    key={sound.url}
                    type="button"
                    role="listitem"
                    className={`k-sound-tile ${active ? 'is-on' : ''}`}
                    onClick={() => toggleAmbient(sound)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Remove' : 'Add'} ${labelFor(sound.name)}`}
                    title={active ? 'Playing. Tap to remove; set its volume in Now playing.' : 'Tap to add to your mix'}
                  >
                    <span className="k-sound-tile-icon" aria-hidden="true"><SoundIcon name={sound.name} /></span>
                    <span className="k-sound-tile-name">{labelFor(sound.name)}</span>
                    {active && <span className="k-sound-wave-bars k-sound-tile-bars" aria-hidden="true"><span /><span /><span /></span>}
                  </button>
                );
              })}
            </div>
            {filteredSounds.length === 0 && <p className="k-sl-empty">No sounds match “{query}”.</p>}

            <p className="k-sl-credit">
              {SOUNDS.length} sounds curated from <a href="https://github.com/remvze/moodist" target="_blank" rel="noreferrer">Moodist</a>.
            </p>
          </div>
);

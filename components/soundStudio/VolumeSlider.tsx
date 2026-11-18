import React, { useCallback, useEffect, useRef } from 'react';

/**
 * A volume control built for fine adjustment.
 * Hearing is roughly logarithmic, so a straight gain slider crams the useful range into the
 * bottom quarter. The slider position is perceived loudness (0-100%), mapped to gain as p^2,
 * which spreads quiet levels across the track. Arrow keys, the wheel and the -/+ buttons move
 * 2% (1% with Shift) for precise changes.
 */
export const toPosition = (gain: number) => Math.sqrt(Math.min(1, Math.max(0, gain)));
export const toGain = (position: number) => {
  const p = Math.min(1, Math.max(0, position));
  return Math.round(p * p * 10000) / 10000;
};

type Props = {
  gain: number;
  onChange: (gain: number) => void;
  label: string;
  disabled?: boolean;
  size?: 'master' | 'channel';
};

export const VolumeSlider: React.FC<Props> = ({ gain, onChange, label, disabled, size = 'channel' }) => {
  const position = toPosition(gain);
  const percent = Math.round(position * 100);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  const nudge = useCallback((delta: number) => {
    const next = Math.round((positionRef.current + delta) * 100) / 100;
    onChange(toGain(next));
  }, [onChange]);

  // A non-passive wheel listener so scrolling over the slider adjusts it instead of the page.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      nudge((event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 0.01 : 0.02));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [nudge, disabled]);

  return (
    <div className={`k-vol k-vol-${size} ${disabled ? 'is-disabled' : ''}`}>
      <button
        type="button"
        className="k-vol-step"
        onClick={e => nudge(e.shiftKey ? -0.01 : -0.02)}
        disabled={disabled || percent <= 0}
        aria-label={`${label}: quieter`}
        title="Quieter (Shift for 1%)"
      >
        −
      </button>
      <input
        ref={inputRef}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        onChange={e => onChange(toGain(Number(e.target.value) / 100))}
        onKeyDown={e => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
            nudge((up ? 1 : -1) * (e.shiftKey ? 0.01 : 0.02));
          }
        }}
        aria-label={label}
        aria-valuetext={`${percent} percent`}
        style={{ '--fill': `${percent}%` } as React.CSSProperties}
      />
      <button
        type="button"
        className="k-vol-step"
        onClick={e => nudge(e.shiftKey ? 0.01 : 0.02)}
        disabled={disabled || percent >= 100}
        aria-label={`${label}: louder`}
        title="Louder (Shift for 1%)"
      >
        +
      </button>
      <output className="k-vol-value" aria-hidden="true">{disabled ? 'Muted' : `${percent}%`}</output>
    </div>
  );
};

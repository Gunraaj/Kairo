import React, { useEffect, useRef, useState } from 'react';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
  width?: number;
}

/**
 * A typed number box that sits next to chips and steppers. It accepts digits only,
 * commits on Enter or when you leave the box, clamps to [min, max], and Escape reverts.
 */
export const NumberField: React.FC<NumberFieldProps> = ({ value, min, max, onCommit, ariaLabel, unit, disabled, className = '', width }) => {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <span className={`k-numfield ${disabled ? 'is-disabled' : ''} ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        disabled={disabled}
        aria-label={`${ariaLabel} (${min} to ${max}${unit ? ` ${unit}` : ''})`}
        style={width ? { width } : undefined}
        onFocus={e => { focused.current = true; e.currentTarget.select(); }}
        onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
          e.stopPropagation();
        }}
      />
      {unit && <span className="k-numfield-unit" aria-hidden="true">{unit}</span>}
    </span>
  );
};

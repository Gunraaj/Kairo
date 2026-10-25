import React from 'react';

export type LogoVariant = 'interval' | 'enso' | 'kairos' | 'circuit' | 'mon' | 'ripple' | 'wedge';

export interface BrandLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  color?: string;
  accentColor?: string;
}

const INTERVAL_MARK_COLORS = {
  ink: '#20201E',
  paper: '#F7F7F3',
  vermilion: '#C9382A',
} as const;

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'interval',
  size = 16,
  className = '',
  color = 'currentColor',
  accentColor = 'var(--brand-vermilion, var(--shu, #C9382A))',
}) => {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    className: `k-brand-logo ${className}`,
    xmlns: 'http://www.w3.org/2000/svg',
  };

  switch (variant) {
    /**
     * Kairo Interval Mark
     * The approved A2 direction: a bulky task anchor, two interval arms,
     * a tactile notch, and one rounded vermilion active-state latch.
     */
    case 'interval':
      return (
        <svg {...shared}>
          <g
            fill="none"
            stroke={color}
            strokeWidth="6.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M 8 5.5 V 26.5" />
            <path d="M 15.5 14.2 L 25 6.7" />
            <path d="M 15.5 17.8 L 25 25.3" />
          </g>
          {/* tactile notch cut into the lower arm */}
          <circle cx="15.5" cy="17.8" r="2.05" fill="var(--washi-2, #F7F7F3)" />
          {/* rounded active interval latch, never a play triangle */}
          <rect
            x="17.4"
            y="14.9"
            width="8"
            height="3.45"
            rx="1.72"
            fill={accentColor}
            transform="rotate(-10 21.4 16.625)"
          />
        </svg>
      );

    /**
     * Variant 1: The Wabi-Sabi Ensō (円相)
     * An authentic calligraphic brush circle with an intentional 45° breathing gap
     * and a central cinnabar focal dot (the bindu / single task).
     */
    case 'enso':
      return (
        <svg {...shared}>
          {/* Tapered calligraphic brush circle */}
          <path
            d="M 23 9 C 27 13, 27 21, 22 25 C 16 30, 8 28, 5 22 C 2 15, 5 8, 12 5 C 17 3, 21 5, 23 7"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Centered Cinnabar Bindu */}
          <circle cx="15.5" cy="15.5" r="2.8" fill={accentColor} />
        </svg>
      );

    /**
     * Variant 2: The Kairos Chronometer (καιρός)
     * Qualitative time: precision dial with an angled 45° sunbeam gnomon cut
     * marking the conscious moment of presence.
     */
    case 'kairos':
      return (
        <svg {...shared}>
          {/* Outer precision circular track */}
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="60 14"
            transform="rotate(-30 16 16)"
            strokeLinecap="round"
          />
          {/* 45° Angled Sundial Beam pointing to center */}
          <line
            x1="24.5"
            y1="7.5"
            x2="17"
            y2="15"
            stroke={accentColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Center Precision Pivot */}
          <circle cx="16" cy="16" r="3" fill={color} />
          <circle cx="16" cy="16" r="1.2" fill={accentColor} />
        </svg>
      );

    /**
     * Variant 3: The Infinite Circuit (回路 Kairo)
     * Direct visual embodiment of the Japanese name "Kairo" (circuit / loop):
     * Continuous flowing topological Möbius ribbons representing focus & rest cycles.
     */
    case 'circuit':
      return (
        <svg {...shared}>
          {/* Dual intersecting loop ribbons forming abstract K / infinity */}
          <path
            d="M 9 7 C 9 7, 16 12, 16 16 C 16 20, 23 25, 23 25"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 9 25 C 9 25, 16 20, 16 16 C 16 12, 23 7, 23 7"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Vertical Anchor Spine */}
          <line x1="9" y1="6" x2="9" y2="26" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          {/* Active Flow Node */}
          <circle cx="23" cy="7" r="2.8" fill={accentColor} />
        </svg>
      );

    /**
     * Variant 4: The Architectural Kamon & Hanko (家紋 / 判子)
     * Japanese crest aesthetic in a soft squircle shield with vertical pillar
     * and semi-circular moon creating an architectural monogram 'K'.
     */
    case 'mon':
      return (
        <svg {...shared}>
          {/* Rounded Squircle Seal Border */}
          <rect
            x="4"
            y="4"
            width="24"
            height="24"
            rx="7"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Still Vertical Pillar */}
          <line x1="11" y1="10" x2="11" y2="22" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
          {/* Upper Diagonal Beam */}
          <line x1="13" y1="16" x2="20" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          {/* Lower Arc with Cinnabar Terminal */}
          <path
            d="M 13 16 C 16 18, 18 20, 21 22"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="20" cy="10" r="1.8" fill={accentColor} />
        </svg>
      );

    /**
     * Variant 5: The Karesansui Ripples (枯山水)
     * Raked sand ripples in a Zen rock garden; harmonic acoustic concentric waves
     * emanating from a single droplet of deep concentration.
     */
    case 'ripple':
      return (
        <svg {...shared}>
          {/* Outer Ripple Arc */}
          <path
            d="M 6 16 A 10 10 0 1 1 26 16"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Middle Ripple Arc */}
          <path
            d="M 10 16 A 6 6 0 1 1 22 16"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Inner Grounded Base Line */}
          <line x1="6" y1="16" x2="26" y2="16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          {/* Singular Drop of Focus */}
          <circle cx="16" cy="11" r="2.8" fill={accentColor} />
        </svg>
      );

    /**
     * Variant 6: The 25-Minute Precision Wedge (Pomodoro Gauge)
     * Precision camera/watchmaker dial with an engraved 150° sector representing
     * exactly one 25-minute Pomodoro sprint.
     */
    case 'wedge':
      return (
        <svg {...shared}>
          {/* 60-Minute Background Hairline Dial */}
          <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1.5" opacity="0.3" />
          {/* 25-Minute Active Sector Arc (150 degrees from 12 o'clock) */}
          <path
            d="M 16 4 A 12 12 0 0 1 26.4 22 L 16 16 Z"
            fill={color}
            opacity="0.15"
          />
          <path
            d="M 16 4 A 12 12 0 0 1 26.4 22"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* 5-Minute Break Sector in Cinnabar */}
          <path
            d="M 26.4 22 A 12 12 0 0 1 23.1 25.4"
            stroke={accentColor}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Center Precision Bearing */}
          <circle cx="16" cy="16" r="2.5" fill={accentColor} />
        </svg>
      );
  }
};

/**
 * Returns a self-contained SVG Data URI for favicon and external embeds.
 */
export const getLogoSvgDataUri = (variant: LogoVariant = 'interval'): string => {
  const svgs: Record<LogoVariant, string> = {
    interval: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="${INTERVAL_MARK_COLORS.ink}"/><g fill="none" stroke="${INTERVAL_MARK_COLORS.paper}" stroke-width="6.25" stroke-linecap="round" stroke-linejoin="round"><path d="M 8 5.5 V 26.5"/><path d="M 15.5 14.2 L 25 6.7"/><path d="M 15.5 17.8 L 25 25.3"/></g><circle cx="15.5" cy="17.8" r="2.05" fill="${INTERVAL_MARK_COLORS.ink}"/><rect x="17.4" y="14.9" width="8" height="3.45" rx="1.72" fill="${INTERVAL_MARK_COLORS.vermilion}" transform="rotate(-10 21.4 16.625)"/></svg>`,
    enso: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M 23 9 C 27 13, 27 21, 22 25 C 16 30, 8 28, 5 22 C 2 15, 5 8, 12 5 C 17 3, 21 5, 23 7" stroke="#FAF7F2" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15.5" cy="15.5" r="2.8" fill="#BC3B2C"/></svg>`,
    kairos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="#FAF7F2" stroke-width="2" stroke-dasharray="60 14" transform="rotate(-30 16 16)" stroke-linecap="round"/><line x1="24.5" y1="7.5" x2="17" y2="15" stroke="#BC3B2C" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="#FAF7F2"/><circle cx="16" cy="16" r="1.2" fill="#BC3B2C"/></svg>`,
    circuit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><line x1="9" y1="6" x2="9" y2="26" stroke="#FAF7F2" stroke-width="2.4" stroke-linecap="round"/><path d="M 9 7 C 9 7, 16 12, 16 16 C 16 20, 23 25, 23 25" stroke="#FAF7F2" stroke-width="2.4" stroke-linecap="round"/><path d="M 9 25 C 9 25, 16 20, 16 16 C 16 12, 23 7, 23 7" stroke="#FAF7F2" stroke-width="2.4" stroke-linecap="round"/><circle cx="23" cy="7" r="2.8" fill="#BC3B2C"/></svg>`,
    mon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="7" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="10" x2="11" y2="22" stroke="#FAF7F2" stroke-width="2.6" stroke-linecap="round"/><line x1="13" y1="16" x2="20" y2="10" stroke="#FAF7F2" stroke-width="2.4" stroke-linecap="round"/><path d="M 13 16 C 16 18, 18 20, 21 22" stroke="#FAF7F2" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="10" r="1.8" fill="#BC3B2C"/></svg>`,
    ripple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M 6 16 A 10 10 0 1 1 26 16" stroke="#FAF7F2" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/><path d="M 10 16 A 6 6 0 1 1 22 16" stroke="#FAF7F2" stroke-width="2" stroke-linecap="round" opacity="0.8"/><line x1="6" y1="16" x2="26" y2="16" stroke="#FAF7F2" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="11" r="2.8" fill="#BC3B2C"/></svg>`,
    wedge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="#FAF7F2" stroke-width="1.5" opacity="0.3"/><path d="M 16 4 A 12 12 0 0 1 26.4 22 L 16 16 Z" fill="#FAF7F2" opacity="0.15"/><path d="M 16 4 A 12 12 0 0 1 26.4 22" stroke="#FAF7F2" stroke-width="2.5" stroke-linecap="round"/><path d="M 26.4 22 A 12 12 0 0 1 23.1 25.4" stroke="#BC3B2C" stroke-width="2.8" stroke-linecap="round"/><circle cx="16" cy="16" r="2.5" fill="#BC3B2C"/></svg>`,
  };

  const raw = svgs[variant] || svgs.interval;
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
};

export const LOGO_VARIANTS: Array<{
  id: LogoVariant;
  name: string;
  japanese: string;
  concept: string;
  philosophy: string;
}> = [
  {
    id: 'interval',
    name: 'Kairo Interval Mark',
    japanese: 'A2',
    concept: 'Bulky task anchor with a tactile active interval',
    philosophy:
      'The vertical anchor is the chosen task. The two angled arms create the interval opening, the notch adds physical dial character, and the rounded vermilion latch marks the active focus state without becoming a play or power icon.',
  },
];

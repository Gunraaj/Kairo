import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

/* Analog dial with double-bezel concentric ring design, tactile dragging,
   mechanical haptic detents, and clean Swiss typography */
type DialProps = {
  totalTime: number;
  timeLeft: number;
  formatted: string;
  isActive: boolean;
  disabled: boolean;
  completionTimestamp?: number;
  onSet: (minutes: number) => void;
  onTick?: (isMajor?: boolean) => void;
  label?: string;
};

export const AnalogDial: React.FC<DialProps> = ({
  totalTime,
  timeLeft,
  formatted,
  isActive,
  disabled,
  completionTimestamp,
  onSet,
  onTick,
  label,
}) => {
  const R = 130;
  const CENTER = 160;
  const CIRC = 2 * Math.PI * R;
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dialRootRef = useRef<HTMLDivElement | null>(null);
  const handleGroupRef = useRef<SVGGElement | null>(null);

  const minutesRemaining = timeLeft / 60;
  const currentMinutes = Math.max(1, Math.round(timeLeft / 60));
  const prevMinutesRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevMinutesRef.current !== null && prevMinutesRef.current !== currentMinutes) {
      const isMajor = currentMinutes % 5 === 0;
      onTick?.(isMajor);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(isMajor ? [6, 16, 6] : 3);
        } catch {
          // Ignored
        }
      }
    }
    prevMinutesRef.current = currentMinutes;
  }, [currentMinutes, onTick]);

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current && dialRootRef.current) {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        gsap.fromTo(
          dialRootRef.current,
          { scale: 1 },
          { scale: 1.025, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 },
        );
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Celebratory breath animation on session completion
  useEffect(() => {
    if (!completionTimestamp || !dialRootRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(dialRootRef.current, {
        scale: 1.035,
        duration: 0.35,
        ease: 'back.out(1.4)',
      }).to(dialRootRef.current, {
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
      });
    }, dialRootRef);

    return () => ctx.revert();
  }, [completionTimestamp]);

  // Tactile handle expansion on drag interaction
  useEffect(() => {
    if (!handleGroupRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      if (dragging) {
        gsap.to('.k-dial-handle-outer', { scale: 1.22, duration: 0.18, ease: 'back.out(2)', transformOrigin: '50% 50%' });
        gsap.to('.k-dial-handle-inner', { scale: 1.35, duration: 0.18, ease: 'power2.out', transformOrigin: '50% 50%' });
      } else {
        gsap.to('.k-dial-handle-outer', { scale: 1, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 50%' });
        gsap.to('.k-dial-handle-inner', { scale: 1, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 50%' });
      }
    }, handleGroupRef);

    return () => ctx.revert();
  }, [dragging]);

  const dialFrac = Math.max(0, Math.min(1, minutesRemaining / 60));
  const arcLen = CIRC * dialFrac;
  const arcGap = CIRC - arcLen;
  const angleRad = -Math.PI / 2 + dialFrac * 2 * Math.PI;
  const handleX = CENTER + R * Math.cos(angleRad);
  const handleY = CENTER + R * Math.sin(angleRad);

  const setFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 320 - CENTER;
      const y = ((clientY - rect.top) / rect.height) * 320 - CENTER;
      let angle = Math.atan2(y, x) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      const minutes = Math.max(1, Math.round((angle / (2 * Math.PI)) * 60));
      onSet(minutes);
    },
    [onSet],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, setFromPointer]);

  const beginDrag = (e: React.PointerEvent<Element>) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setFromPointer(e.clientX, e.clientY);
  };

  const ticks = Array.from({ length: 60 }, (_, i) => i);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 5,
      ArrowLeft: -1,
      ArrowDown: -5,
    };
    if (e.key in map) {
      e.preventDefault();
      onSet(Math.max(1, Math.min(60, currentMinutes + map[e.key])));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSet(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSet(60);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onSet(Math.min(60, currentMinutes + 10));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onSet(Math.max(1, currentMinutes - 10));
    }
  };

  return (
    <div
      ref={dialRootRef}
      className={`k-dial-zen ${isActive ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? 'Focus duration'}
      aria-valuemin={1}
      aria-valuemax={60}
      aria-valuenow={currentMinutes}
      aria-valuetext={`${currentMinutes} minutes`}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
    >
      <svg ref={svgRef} viewBox="0 0 320 320" style={{ touchAction: 'none' }}>
        <defs>
          <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--shu)" />
            <stop offset="100%" stopColor="var(--shu-hover)" />
          </linearGradient>
          <radialGradient id="dialInnerShade" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="var(--washi-card)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--stone-1)" stopOpacity="0.8" />
          </radialGradient>
          <filter id="dialGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="var(--shu)" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Knurled Bezel Enclosure */}
        <circle cx={CENTER} cy={CENTER} r={R + 20} className="k-dial-outer-bezel" />
        <circle cx={CENTER} cy={CENTER} r={R + 19} className="k-dial-outer-rim" strokeDasharray="1.5, 4.5" />
        <circle cx={CENTER} cy={CENTER} r={R - 16} className="k-dial-inner-groove" />

        {/* Hitbox */}
        <circle
          className="k-dial-hitbox"
          cx={CENTER}
          cy={CENTER}
          r={R + 24}
          onPointerDown={beginDrag}
          style={{ pointerEvents: disabled ? 'none' : 'auto' }}
        />

        {/* Ticks with Illuminated Active Passage */}
        {ticks.map(i => {
          const isMajor = i % 15 === 0;
          const isMinor = i % 5 === 0;
          const a = -Math.PI / 2 + (i / 60) * 2 * Math.PI;
          const outer = R + 9;
          const inner = isMajor ? R - 4 : isMinor ? R + 1 : R + 4;
          const isPassed = (i / 60) <= dialFrac + 0.001;
          return (
            <line
              key={i}
              className={`k-dial-tick ${isMajor ? 'major' : isMinor ? 'minor' : 'subtle'} ${isPassed ? 'passed' : ''}`}
              x1={CENTER + Math.cos(a) * outer}
              y1={CENTER + Math.sin(a) * outer}
              x2={CENTER + Math.cos(a) * inner}
              y2={CENTER + Math.sin(a) * inner}
              strokeWidth={isMajor ? 1.8 : isMinor ? 1.3 : 0.8}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          );
        })}

        {/* Quadrant labels */}
        {[
          { text: '0', x: CENTER, y: CENTER - R - 18, passed: true },
          { text: '15', x: CENTER + R + 22, y: CENTER + 4, passed: dialFrac >= 0.25 },
          { text: '30', x: CENTER, y: CENTER + R + 24, passed: dialFrac >= 0.5 },
          { text: '45', x: CENTER - R - 22, y: CENTER + 4, passed: dialFrac >= 0.75 },
        ].map(l => (
          <text
            key={l.text}
            className={`k-dial-tick-label ${l.passed ? 'passed' : ''}`}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {l.text}
          </text>
        ))}

        {/* Track Ring */}
        <circle
          className="k-dial-track"
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={4.5}
          style={{ pointerEvents: 'none' }}
        />

        {/* Active Progress Arc */}
        <circle
          className="k-dial-arc"
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="url(#dialGradient)"
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcGap}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          filter="url(#dialGlow)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Center Digital Display */}
        <text
          className="k-dial-time"
          x={CENTER}
          y={CENTER + 16}
          textAnchor="middle"
          role="timer"
          aria-label={`${formatted} remaining`}
          style={{ pointerEvents: 'none' }}
        >
          {formatted}
        </text>

        {/* Complication Sub-label */}
        <text
          className="k-dial-sub-label"
          x={CENTER}
          y={CENTER + 36}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {isActive ? 'FOCUSING' : dragging ? 'DRAG TO SET' : 'POMODORO'}
        </text>

        {/* Interactive Tactile Handle */}
        <g
          ref={handleGroupRef}
          className={`k-dial-handle-group ${dragging ? 'is-dragging' : ''}`}
          style={{
            transform: `translate(${handleX}px, ${handleY}px)`,
            cursor: disabled ? 'default' : dragging ? 'grabbing' : 'grab',
            pointerEvents: disabled ? 'none' : 'auto',
          }}
          onPointerDown={beginDrag}
        >
          {/* Outer Halo */}
          <circle r={14} className="k-dial-handle-halo" />
          {/* Main Grip Circle */}
          <circle r={9.5} className="k-dial-handle-outer" />
          {/* Knurled Thumb Dimple Pip */}
          <circle r={3.2} className="k-dial-handle-inner" />

          {/* Floating minute HUD badge while dragging */}
          {dragging && (
            <g className="k-dial-hud-bubble" transform="translate(0, -22)">
              <rect x="-18" y="-12" width="36" height="18" rx="9" className="k-dial-hud-bg" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" className="k-dial-hud-text">
                {currentMinutes}m
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

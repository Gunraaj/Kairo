import React, { useState, useRef, useEffect } from 'react';

interface InfoTipProps {
  title: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const InfoTip: React.FC<InfoTipProps> = ({
  title,
  children,
  position = 'bottom',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`k-infotip-wrap ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className={`k-infotip-btn ${isOpen ? 'is-active' : ''}`}
        onClick={e => {
          e.stopPropagation();
          setIsOpen(v => !v);
        }}
        aria-label={`Help: ${title}`}
        aria-expanded={isOpen}
      >
        ⓘ
      </button>

      {isOpen && (
        <div className={`k-infotip-card pos-${position}`} onClick={e => e.stopPropagation()}>
          <div className="k-infotip-head">
            <span className="k-infotip-icon">💡</span>
            <b>{title}</b>
            <button
              type="button"
              className="k-infotip-close"
              onClick={() => setIsOpen(false)}
              aria-label="Dismiss help"
            >
              ✕
            </button>
          </div>
          <div className="k-infotip-body">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

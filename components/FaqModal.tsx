import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { SECTIONS } from './faqContent';

interface FaqModalProps {
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const FaqModal: React.FC<FaqModalProps> = ({ onClose, onOpenSettings }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>('all');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SECTIONS
      .filter(section => needle || active === 'all' || section.id === active)
      .map(section => ({
        ...section,
        items: needle ? section.items.filter(entry => entry.text.toLowerCase().includes(needle)) : section.items,
      }))
      .filter(section => section.items.length > 0);
  }, [query, active]);

  return (
    <Modal titleId="faq-title" onClose={onClose} className="faq-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="faq-title">Help &amp; FAQ</h2>
          <p className="k-modal-sub">Quick answers. <a href="/help">Open the full help page</a></p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close help">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body k-faq">
        <input
          type="search"
          className="k-faq-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search, e.g. gemini, ollama, supabase, youtube"
          aria-label="Search help"
        />
        <div className="k-faq-tabs" role="tablist" aria-label="Help sections">
          {[{ id: 'all', title: 'All' }, ...SECTIONS].map(section => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active === section.id}
              className={`k-faq-tab ${active === section.id ? 'is-active' : ''}`}
              onClick={() => setActive(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="k-faq-empty">No answers match "{query}". Try a shorter word.</p>
        )}

        {visible.map(section => (
          <section key={section.id} className="k-faq-section" aria-labelledby={`faq-${section.id}`}>
            <h3 id={`faq-${section.id}`} className="k-faq-heading">{section.title}</h3>
            {section.items.map(entry => (
              <details key={entry.q} className="k-faq-item" open={Boolean(query.trim())}>
                <summary>{entry.q}</summary>
                <div className="k-faq-answer">{entry.a}</div>
              </details>
            ))}
          </section>
        ))}

        {onOpenSettings && (
          <div className="k-faq-footer">
            <button type="button" className="k-btn" onClick={onOpenSettings}>Open Settings</button>
          </div>
        )}
      </div>
    </Modal>
  );
};

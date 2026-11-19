import React, { useEffect, useMemo, useState } from 'react';
import { SECTIONS } from './faqContent';

export const isHelpPage = () => typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/help';

/** The full help page (/help): contents on the left, search on top, every answer open to read. */
export const HelpPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState(SECTIONS[0]?.id ?? '');

  useEffect(() => {
    document.title = 'Help · Kairo';
    try {
      const theme = JSON.parse(localStorage.getItem('kairo_theme') ?? '"dark"');
      const value = theme && typeof theme === 'object' && 'data' in theme ? theme.data : theme;
      document.documentElement.setAttribute('data-theme', value === 'light' ? 'light' : 'dark');
      const palette = JSON.parse(localStorage.getItem('kairo_palette') ?? 'null');
      const p = palette && typeof palette === 'object' && 'data' in palette ? palette.data : palette;
      if (typeof p === 'string' && /^[a-z-]{1,24}$/.test(p)) document.documentElement.setAttribute('data-palette', p);
    } catch { /* default theme */ }
  }, []);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => SECTIONS
      .map(section => ({ ...section, items: needle ? section.items.filter(entry => entry.text.toLowerCase().includes(needle)) : section.items }))
      .filter(section => section.items.length > 0),
    [needle],
  );

  // Highlight the section being read in the contents.
  useEffect(() => {
    if (needle || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id.replace('help-', ''));
      },
      { rootMargin: '-10% 0px -75% 0px' },
    );
    document.querySelectorAll('.k-help-section').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [needle, visible.length]);

  return (
    <div className="k-help">
      <header className="k-help-top">
        <a className="k-help-back" href="/">← Back to Kairo</a>
        <h1>Help</h1>
        <input
          type="search"
          className="k-faq-search k-help-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help: casting, alarm, half session, Google sign-in…"
          aria-label="Search help"
        />
      </header>

      <div className="k-help-layout">
        <nav className="k-help-toc" aria-label="Help contents">
          <ul>
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a href={`#help-${section.id}`} className={current === section.id && !needle ? 'is-current' : ''} onClick={() => setQuery('')}>{section.title}</a>
              </li>
            ))}
          </ul>
          <p className="k-help-toc-foot"><a href="/privacy.html">Privacy</a></p>
        </nav>

        <main className="k-help-main">
          {visible.length === 0 && <p className="k-faq-empty">No answers match “{query}”. Try a shorter word.</p>}
          {visible.map(section => (
            <section key={section.id} id={`help-${section.id}`} className="k-help-section" aria-labelledby={`help-h-${section.id}`}>
              <h2 id={`help-h-${section.id}`}>{section.title}</h2>
              {section.items.map(entry => (
                <details key={entry.q} className="k-faq-item" open={Boolean(needle) || undefined}>
                  <summary>{entry.q}</summary>
                  <div className="k-faq-answer">{entry.a}</div>
                </details>
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};

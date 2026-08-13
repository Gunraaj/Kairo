# Kairo — open tasks

Ranked by impact-to-effort. Everything above the line is **shipping**; everything below is **open**.

---

## ✅ Shipped

- Washi + Sumi + Vermilion visual system, single stylesheet
- Sidebar with folder-tree projects, inline add/complete/delete, per-task minutes chip
- Analog draggable dial timer (1–60 min, keyboard-accessible slider)
- Sonos-style Sound Library with real category icons, category chips, master volume
- Ambient default volume dropped to 30% + dismissable inline error banner
- Beats + Lofi tabs restyled to match
- Progress modal: 4-stat header + GitHub-style year contribution heatmap + weekly bars + top tasks
- Settings modal rewrite (timer lengths + round structure + toggles + Your data)
- **JSON snapshot export / import** — cross-device carry without any backend
- **Confirmation toast** — Settings save, snapshot export, import success
- **Empty-state hero** on the timer stage for new users with zero projects
- First-run welcome modal, remembers via `kairo_seen_welcome`
- Dark / Light / System theme with token-level flip + WCAG AA contrast fix
- Full keyboard shortcuts: `Space` / `S` / `R` / `E`
- Accessibility pass 1: dial ARIA slider, welcome focus trap, heatmap keyboard, category chip semantics
- CI green, GitHub repo live, Netlify auto-deploys on push to `main`
- Motion (Framer) welcome step stagger
- GSAP dial settle-pulse on session start
- **Session intentions** (Gollwitzer 1999 evidence base): quiet "I will…" field under the task title, captured at session start, saved on the session record, surfaced in Progress as a "Recent intentions" list.
- **Project canvas removed**: the decorative bottom ribbon deleted after research pushback. Screen real estate returned to the timer stage; the intention field replaces it functionally.
- **Real Tabler icons** in the Sound Library (same family Moodist uses), swapped in for the hand-drawn glyphs.
- **App shell viewport-capped** so you can't scroll past the hero into empty white space.
- **Theme cycle button** moved into the sidebar header alongside the collapse chevron.
- **Welcome-modal grid fix**: numbered list items no longer wrap word-per-line.
- **Project canvas removed** — decoration masquerading as content. Screen real estate reclaimed. Replaced with the evidence-backed session-intention field (Gollwitzer 1999 implementation intentions).
- **Session intention field** ("I will…") on the timer stage. Captured before session start, frozen once running, saved on the session record.
- **Recent intentions section** in Progress modal — see what you told yourself you were going to do across your last six sessions.
- **Sound Library category order** follows Moodist's canonical curation (Rain, Nature, Animals, Things, Places, Urban, Transport) instead of alphabetical. New "All" chip surfaces the full 82-sound catalogue.
- **Theme cycle button** moved to the sidebar header as a compact icon, out of the primary nav footer.
- **Viewport cap** on `.app-shell` — no more scrolling into blank space past the hero.

## 🩹 Polish

- [ ] **Sound-card double click target** — thumb button and card body overlap; disambiguate with distinct `aria-label`s.
- [ ] **Ambient sound-card play button + card body** click zones — split cleanly.
- [ ] **Analytics modal density** — 4 sections at equal weight. Add hierarchy (big summary, focused chart, small ancillary).

## 🔬 Research needed before doing

- [ ] **Focus streak backfire risk** — literature is clear that streak counters can cut against calm-focus tools. Current streak stat is present in Progress; consider soft-streaks (weekly consistency) instead of daily.

## ❌ Explicitly not doing

- **Clerk auth** — needs a backend, adds a monthly SaaS, breaks the local-first architecture. Wrong call for an MVP.
- **`/deep-research` on dark mode or sound UI** — patterns are well-established; research would burn budget for no new signal.
- **A big landing page** — the app is the pitch. Direct-to-work with the welcome modal is the right shape.

## 🐛 Known bugs

_(none currently open)_

---

*Kept short by intent. Anything not in this file isn't planned.*

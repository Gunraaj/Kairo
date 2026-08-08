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

## 🎯 Next up (highest impact)

- [ ] **Ribbon that means something** — currently decorative. Each completed session should add a real inflection point along its length so it grows with actual work.

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

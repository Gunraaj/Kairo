# Kairo — open tasks

Ranked by impact-to-effort. Everything above the line is **shipping**; everything below is **open**.

---

## ✅ Shipped

- Washi + Sumi + Vermilion visual system, single stylesheet
- Sidebar with folder-tree projects, inline add/complete/delete
- Analog draggable dial timer (1–60 min, keyboard-accessible slider)
- Sonos-style Sound Library with real category icons, category chips, master volume
- Beats + Lofi tabs restyled to match
- Progress modal: 4-stat header + GitHub-style year contribution heatmap + weekly bars + top tasks
- Settings modal rewrite (timer lengths + round structure + toggles)
- First-run welcome modal, remembers via `kairo_seen_welcome`
- Dark / Light / System theme with token-level flip
- Full keyboard shortcuts: `Space` / `S` / `R` / `E`
- Accessibility pass 1: dial ARIA slider, welcome focus trap, heatmap keyboard, category chip semantics
- CI green, GitHub repo live, Netlify auto-deploys on push to `main`
- Motion (Framer) welcome step stagger
- GSAP dial settle-pulse on session start

## 🎯 Next up (highest impact)

- [ ] **Empty-state hero** — new users with zero projects land on a blank timer target. Needs a first-project prompt on the stage itself, not just in the sidebar.
- [ ] **Ribbon that means something** — currently decorative. Each completed session should add a real inflection point along its length so it grows with actual work.
- [ ] **Sound preview vs. autoplay** — clicking a sound plays at 50% immediately, which is jarring in a quiet library. Options: hover-preview at 20%, or lower default volume.
- [ ] **Save toast** — Settings save silently. A small "Saved" toast confirms the action landed.

## 🩹 Polish

- [ ] **Dark-mode contrast fix** — `--stone` (`#55534C`) on canvas fails WCAG AA for text. Currently only used on borders/hints, but should be reserved to non-text only.
- [ ] **Sound-card double click target** — thumb button and card body overlap; disambiguate with distinct `aria-label`s.
- [ ] **Ambient sound-card play button + card body** click zones — split cleanly.
- [ ] **Ambient error state** looks like a plain paragraph; needs an icon and dismiss.
- [ ] **Analytics modal density** — 4 sections at equal weight. Add hierarchy (big summary, focused chart, small ancillary).
- [ ] **Task time-invested** — shown per task in code but not surfaced in the sidebar tree. Add a small "Xm" beside each task.

## 🔬 Research needed before doing

- [ ] **Cross-device sync** — currently localStorage only. Options: (a) JSON export/import (5 min, no backend), (b) Netlify Blobs + Netlify Identity (2 hrs), (c) Supabase/Firebase (half day). **Skip Clerk for MVP** — needs a backend, breaks local-first, wrong architecture for a personal focus tool.
- [ ] **Focus streak backfire risk** — literature is clear that streak counters can cut against calm-focus tools. Current streak stat is present in Progress; consider soft-streaks (weekly consistency) instead of daily.

## ❌ Explicitly not doing

- **Clerk auth** — needs a backend, adds a monthly SaaS, breaks the local-first architecture. Wrong call for an MVP.
- **`/deep-research` on dark mode or sound UI** — patterns are well-established; research would burn budget for no new signal.
- **A big landing page** — the app is the pitch. Direct-to-work with the welcome modal is the right shape.

## 🐛 Known bugs

_(none currently open)_

---

*Kept short by intent. Anything not in this file isn't planned.*

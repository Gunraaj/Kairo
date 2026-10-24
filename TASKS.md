# Kairo — open tasks

Ranked by impact-to-effort. Everything above the line is **shipping**; everything below is **open**.

---

## ✅ Shipped

- **Top Utility Bar & Sound Studio Responsive Fix**: Re-nested floating utility bar into stage flex flow, eliminated coordinate clipping on right drawer toggle, added `white-space: nowrap !important; flex-shrink: 0;`, dynamic icon-only pill collapse (`~171px`), and seamless modal drawer overlay isolation for tablets and mobile ($\le 1024\text{px}$).
- **Brand Identity & 6 Logo Archetypes**: 6 mathematically precise SVG archetypes (Ensō, Kairos Chronometer, Infinite Circuit, Architectural Mon, Karesansui Ripples, 25m Caliper) in [`components/BrandLogo.tsx`](file:///d:/Coding/PROJECTS/kairo/components/BrandLogo.tsx), with 1-click sidebar cycling, Settings brand mark picker, and dynamic browser SVG favicon.
- **Document-Grounded Task Breakdown**: Ingest syllabi, lecture notes, or markdown outlines into structured tasks, subtasks, and estimated Pomodoro rounds via offline AST parser or Gemini AI (`components/DocumentBreakdownModal.tsx`).
- **Study / Learning / Work Presets**: 4 curated focus archetypes (Academic Deep Study, Active Learning & Mastery, Sprint Deep Work, Creative Craft) with 1-click project and subtask population (`utils/slicePresets.ts`).
- **1-Click Saved Focus Streams**: Save and restore custom YouTube/Spotify focus streams bundled with layered ambient soundscapes (`kairo_saved_focus_streams`).
- **Timer Snapshot & Interrupted Session Recovery**: Local-first timer checkpointing in `localStorage` (`kairo_active_timer`), automatic deadline/elapsed tracking on page refresh, and interrupted session recovery banner to prevent lost focus minutes.
- **Flexible Break Stepper & Science of Focus Guide**: Dynamic break duration steppers directly on timer stage (`[-] / [+]`) and comprehensive 5-chapter evidence-based research modal citing Cirillo, Gollwitzer, Kaplan, and Kleitman (`components/PomodoroScienceModal.tsx`).
- **Supabase Cloud Sync Architecture**: Offline-first hybrid synchronization module with connection test, schema generator, and automatic offline queue fallback (`utils/supabaseSync.ts`).
- **10-Agent Persona Automated Audit Suite**: End-to-end multi-agent test suite covering novice, minimalist, project manager, sound architect, chaos monkey, time capsule, data scientist, theming purist, break customizer, and cloud-hybrid profiles (`tests/multiAgentProfiles.test.ts`).
- **Time Capsule & Future Treat System**: Seal bite-sized encouragement and self-rewards (e.g. pour-over coffee, 20m park walk) to future-you; triggers automatically when focus rounds are completed, tomorrow morning, or at a set time, with celebration ceremony and persistent journal.
- **Sound Studio Engine & UI Revamp**: Discrete Web Audio `ChannelMergerNode(2)` for genuine 100% Left/Right binaural beat isolation, 60ms exponential soft-attack ramps to prevent pops, and genuine zero-floor isochronic pulsing.
- **Full 82-Sound Moodist Library & Instant Streaming Audio Cache**: Added all 82 ambient sounds across Rain, Nature, Animals, Things, Places, Urban, and Transport with non-blocking stream-first playback and background `CacheStorage`.
- **1-Click Curated Lofi Radio & Solfeggio Presets**: Instant focus radio stations (Lofi Girl, Synthwave, Zen Shakuhachi, Coffee Jazz, 432 Hz Theta) and Solfeggio carriers (432 Hz Miracle Tone, 528 Hz Transformation).
- **Chrome Gemini Nano AI & Cloud Goal Sharpening**: Local-first intention sharpening via Chrome Built-in AI (`window.ai.languageModel`) or free Gemini API key with zero tracking and strict CSP compliance.
- **Zen Fullscreen Mode**: Distraction-free full-viewport focus state toggled via <kbd>F</kbd> key or Zen pill button; smoothly hides sidebars and sound controls to center attention solely on the dial and intention.
- **Harmonic Singing Bowl Completion Cue**: Synthesized Japanese temple rin bell (528 Hz Solfeggio fundamental with resonant overtones and gentle 2.6s exponential decay).
- **Tactile Mechanical Bezel Detent Tick**: Ultra-fast synthetic click (8ms) and micro-haptic feedback as the dial is turned past minute thresholds or nudged with arrow keys.
- **Interactive Heatmap Day Inspector**: Click any cell in the 371-day contribution heatmap to inspect individual sessions and intentions completed on that date.
- **Inline Task & Project Renaming**: Double-click any task or project title in the sidebar to rename inline with instant save on Enter or blur.
- **Pomodoro Target Cycling**: Direct click on task round pips (`●●○○`) to cycle target rounds (2, 4, 6, 8) with instant persistence.
- **Zen Studio UI/UX Overhaul**: Completely eliminated the empty-state wall that hid the timer from new users. The dial is always interactive, with "Quick Focus" as the instant default.
- **Unified Center Stage & Control Dock**: Centered dial with double-bezel concentric curves, hero vermilion CTA pill, secondary actions (Reset, Skip, +5m), and subtle break controls.
- **Collapsible Sound Studio Drawer**: Floating sound indicator pill with animated waves; panel can be collapsed with a click to give the focus stage 100% viewport breathing room.
- **Zero-Teardown Audio Engine**: Swapped full graph destruction for persistent `AudioNodes` with real-time `AudioParam.linearRampToValueAtTime()` modulation, completely eliminating audio crackles, pops, and GC stutters.
- **Sound Studio Atmosphere Presets**: One-click curated atmospheres (Rainy Cafe, Forest River, Night Fire, Ocean Waves) + Master Mute shortcut (<kbd>M</kbd>).
- **Background Dedicated Worker Timer**: Inline Web Worker clock (`utils/workerTimer.ts`) immune to browser tab background throttling, with dynamic document title countdown `(24:15) Focus | Kairo`.
- **Task Round Estimation**: Tasks support target Pomodoro estimation with visual round pips (`●●○○`) and sidebar task search filter.
- **Portable Calendar Export (.ics)**: RFC 5545 standard `.ics` export in Progress modal to sync completed focus sessions with Apple Calendar, Google Calendar, or Outlook.
- **Codebase Debt Purge & Chunking**: Purged 150KB+ of dead CSS and unimported components, consolidated Google Fonts in `index.html`, and added Rollup manual chunking.


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

- [x] **Sound-card single click target** — disambiguated card controls; thumb is visual indicator, dedicated play button with clean `aria-label`s and no redundant tab stops.
- [x] **Analytics modal density & styling** — restored CSS rules for 7-day weekly bar chart, recent intentions, and top tasks leaderboard with clear visual hierarchy.
- [x] **Interactive Keyboard Shortcuts Modal** — accessible via `?` key or sidebar button, documenting all shortcuts in one place.

## 🔬 Research needed before doing

- [ ] **Focus streak backfire risk** — literature is clear that streak counters can cut against calm-focus tools. Current streak stat is present in Progress; consider soft-streaks (weekly consistency) instead of daily.

## 🔮 Future Explorations / Backlog (Discussed for later)

- [ ] **Standalone Public Science & Research Blog Route**: Export the 5-chapter evidence-based focus article from the in-app modal into a dedicated static reading route (`/science` or `/blog`).
- [ ] **PWA (Progressive Web App) Manifest & Offline Desktop Icon**: Add `manifest.json` with multi-res SVG icons so users can 1-click "Install Kairo" as a native standalone window.
- [ ] **Optional Multi-Device Supabase Sync Activation**: The offline-first sync engine is built and tested; users can optionally link a live Supabase project by pasting their URL + Anon Key in Settings.

## ❌ Explicitly not doing

- **Clerk auth** — needs a backend, adds a monthly SaaS, breaks the local-first architecture. Wrong call for an MVP.
- **`/deep-research` on dark mode or sound UI** — patterns are well-established; research would burn budget for no new signal.
- **A big landing page** — the app is the pitch. Direct-to-work with the welcome modal is the right shape.

## 🐛 Known bugs

_(none currently open)_

---

*Kept short by intent. Anything not in this file isn't planned.*

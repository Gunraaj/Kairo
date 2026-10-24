# Kairo

A calm focus workspace: one project, one task, one moment at a time.

Kairo is a local-first single-page app that combines a Pomodoro timer, a folder-tree task board, an ambient sound mixer, and a year-at-a-glance focus record — in a single Washi + Sumi + Vermilion visual world inspired by traditional Japanese materials.

> _"Make space for one thing."_

---

## Features

**Focus**
- Analog **draggable dial** — click and drag the ring to set any duration from 1 to 60 minutes
- Vermilion arc fills from 12 o'clock clockwise so 30 min = half circle
- **Skip breaks** toggle, and one-key shortcuts: <kbd>Space</kbd> start/pause, <kbd>S</kbd> skip, <kbd>R</kbd> reset, <kbd>E</kbd> extend +5 min
- Deep-focus mode pauses the timer if the tab becomes hidden
- Ambient session cue, browser notification, and haptic pulse when a session ends

**Tasks & Workflow**
- Folder-tree sidebar with **interactive drag-resizing** (220px–500px, double-click reset)
- **Nested subtasks checklist** on every task with real-time completion progress bar
- Direct Stage integration: see and check off active task subtasks without breaking flow
- Every completed focus session banks its minutes to the selected task
- Data is versioned, normalized, and clamped on every load

**Master Audio Studio & Sound Library**
- **Pinned Master Controller & Live Mixer Console**: master volume fader, instant channel mute (`M`), gain staging, and active channel strips for ambient, synthesizer, and lofi
- **Full 82 Moodist ambient soundscapes** across 8 categories (Rain, Nature, Places, Urban, Transport, Things, Noise, Ambient)
- **1-Click Curated Lofi Radio**: instant streaming presets (Lofi Girl, Synthwave Boy, Chillhop Cafe, Tokyo Night Lofi, Deep Focus Ambient) plus custom YouTube/Spotify link embedding
- **Atmospheric Presets & Custom Mixes**: save layered ambient mixes with custom names and interactive **16-emoji picker**
- **Web Audio Brainwaves Synthesizer**: pop-free Binaural beats, Isochronic pulses, and Pink/Brown/White colored noise generators
- **CacheStorage Audio Caching**: sounds are cached in browser storage for instant, zero-latency playback even offline

**Time Capsule (Message to Future Self)**
- Seal a motivational message or self-reward to unlock upon finishing milestone focus rounds or tomorrow morning
- Interactive celebration modal with golden seal upon unlocking
- Pinned capsule status chip directly beside session intention

**Local AI Intention Refinement**
- Private, 100% optional focus intention sharpener
- Uses Chrome Built-in AI (`window.ai`) if available, or free Gemini API key stored strictly in browser `localStorage`
- Zero telemetry, never sends your tasks to an unconfigured third-party server

**Progress & Analytics**
- **GitHub-style contribution heatmap** — the past 371 days at a glance, tinted by focus intensity
- Current streak, best streak, active days, total focus time
- Weekly bars with today highlighted
- All-time top tasks ranked by minutes invested
- **Portable RFC 5545 `.ics` Calendar Export** for Google Calendar, Apple Calendar, and Outlook

**Design**
- Single-stylesheet **Washi** design system: Sumi ink (`#20201E`) on Washi paper (`#F7F7F3`), Vermilion (`#C9382A`) reserved for the currently-active element
- Canonical **Kairo Interval Mark**: a K-shaped focus loop with one active vermilion node, shared by the sidebar brand and `public/favicon.svg`
- Collapsible sidebar; fully responsive down to mobile
- Real drawn SVG icons, no icon fonts
- Respects `prefers-reduced-motion`, meets WCAG contrast, keyboard-navigable

---

## Run locally

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

The app opens at `http://localhost:3000`.

## Build

```bash
npm run build
```

Output goes to `dist/`, ready to drop onto any static host.

## Deployment (Launch)

Kairo is pre-configured with secure CSP and routing headers for immediate static deployment:

### Vercel
```bash
npx vercel deploy --prod
```
Configured via `vercel.json` with strict Content Security Policy, zero-referrer headers, and SPA rewrites.

### Netlify
```bash
npx netlify deploy --prod --dir=dist
```
Configured via `netlify.toml` with single-page redirects, CSP headers, and asset caching.

### Cloudflare Pages / GitHub Pages
Simply configure the build settings in your provider dashboard:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node Version:** `20+` or `22+`

## Quality gate

```bash
npm run check
```

Runs strict TypeScript, the 24-test unit test suite, and a production build.

---

## Architecture

Kairo is one Vite + React + TypeScript SPA with zero backend.

- `App.tsx` — shell, theme context, sound studio drawer, state orchestrator
- `components/Stage.tsx` — Zen stage, hero analog dial, keyboard shortcuts, intention prompt, subtask bar, time capsule trigger
- `components/SidebarNav.tsx` — resizable folder-tree navigation, quick focus entry, task subtasks checklist, search filter
- `components/ControlPanel.tsx` — Master Mixer console, 82 ambient sounds, 1-click lofi stations, custom mix emoji picker
- `components/AnalyticsModal.tsx` — Progress modal with year heatmap, stats, and .ics calendar export
- `components/SettingsModal.tsx` — timer + round + focus-mode settings, AI provider config, JSON snapshot backup/restore
- `components/TimeCapsuleModal.tsx` — message to future self creation and golden seal celebration modal
- `components/ErrorBoundary.tsx` — resilient error catching and local state recovery
- `hooks/useAudioEngine.ts` — Web Audio graph with persistent nodes and pop-free parameter modulation
- `utils/workerTimer.ts` — Dedicated Web Worker clock immune to background tab throttling
- `utils/audioCache.ts` — CacheStorage manager for offline audio persistence
- `utils/calendarExport.ts` — Portable RFC 5545 .ics calendar exporter
- `utils/geminiAi.ts` — Private client-side intention sharpening (Chrome built-in AI / free Gemini API)
- `utils/timeCapsule.ts` — Unlock trigger evaluation and state management
- `styles/washi.css` — Washi + Sumi + Vermilion visual system stylesheet

---

## Data and privacy

Kairo has no account, no telemetry, and no backend of its own. Projects, tasks, settings, live timer state, and focus history all live in your browser's `localStorage`. Nothing leaves your machine except:

- ambient audio files, which stream from the Moodist repo on `raw.githubusercontent.com`
- YouTube / Spotify iframes when you paste one of their links in the lofi tab

Because state lives only in this browser, it doesn't sync across devices without manual export. You can export complete JSON data backups in Settings, and download standard RFC 5545 `.ics` focus calendar files in Progress to sync your sessions with Google Calendar, Apple Calendar, or Outlook.

## Audio note

Binaural mode sends slightly different frequencies to left and right channels and needs stereo headphones. Isochronic mode works through speakers or headphones. These tools are provided for personal focus and relaxation; they are not medical treatment.

Ambient sources come from the open-source [Moodist](https://github.com/remvze/moodist) project. See [ATTRIBUTION.md](ATTRIBUTION.md) for source details and audio licences.

---

## Stack

React 19 · TypeScript 5 · Vite 6 · Web Audio API · CSS custom properties (OKLCH) · Google Fonts (Fraunces, Noto Sans JP, Inter) · browser `localStorage` for persistence.

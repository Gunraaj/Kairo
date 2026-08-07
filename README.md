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

**Tasks**
- Folder-tree sidebar: expand a project to see its tasks, add tasks inline, one click to mark complete
- Every completed focus session banks its minutes to the selected task
- Data is versioned, normalized, and clamped on every load

**Sound Library**
- 60+ ambient sources from the Moodist catalogue, each with a drawn category icon
- **Sonos-style Master volume** — one control that governs every source below it
- Layered mixing: play any number simultaneously, each with independent volume
- Binaural, isochronic, and colored-noise generators via the Web Audio API
- Lofi player embeds YouTube (video / live / playlist) and Spotify links

**Progress**
- **GitHub-style contribution heatmap** — the past 371 days at a glance, tinted by focus intensity
- Current streak, best streak, active days, total focus time
- Weekly bars with today highlighted
- All-time top tasks ranked by minutes invested

**Design**
- Single-stylesheet **Washi** design system: Sumi ink (`#20201E`) on Washi paper (`#F7F7F3`), Vermilion (`#C5382F`) reserved for the currently-active element
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

## Quality gate

```bash
npm run check
```

Runs strict TypeScript, the boundary + timer-restoration test suite, and a production build.

---

## Architecture

Kairo is one Vite + React + TypeScript SPA with no backend.

- `App.tsx` — shell, project state, sidebar folder tree, ribbon canvas
- `components/Stage.tsx` — timer state machine, analog dial, keyboard shortcuts
- `components/ControlPanel.tsx` — Sound Library with the three modes
- `components/AnalyticsModal.tsx` — Progress modal with year heatmap
- `components/SettingsModal.tsx` — timer + round + focus-mode settings
- `hooks/useAudioEngine.ts` — Web Audio graph for beats and noise
- `hooks/useLocalStorage.ts` — versioned + normalized persistence
- `data/validation.ts` — every persisted shape is normalized on load
- `styles/washi.css` — the entire visual system, one file

---

## Data and privacy

Kairo has no account, no telemetry, and no backend of its own. Projects, tasks, settings, live timer state, and focus history all live in your browser's `localStorage`. Nothing leaves your machine except:

- ambient audio files, which stream from the Moodist repo on `raw.githubusercontent.com`
- YouTube / Spotify iframes when you paste one of their links in the lofi tab

Because state lives only in this browser, it doesn't sync across devices. Clearing browsing data resets it. Export/import is on the roadmap.

## Audio note

Binaural mode sends slightly different frequencies to left and right channels and needs stereo headphones. Isochronic mode works through speakers or headphones. These tools are provided for personal focus and relaxation; they are not medical treatment.

Ambient sources come from the open-source [Moodist](https://github.com/remvze/moodist) project. See [ATTRIBUTION.md](ATTRIBUTION.md) for source details and audio licences.

---

## Stack

React 19 · TypeScript 5 · Vite 6 · Web Audio API · CSS custom properties (OKLCH) · Google Fonts (Fraunces, Noto Sans JP, Inter) · browser `localStorage` for persistence.

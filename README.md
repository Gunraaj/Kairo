# Kairo

Kairo is a calm, local-first focus workspace that keeps projects, tasks, a Pomodoro timer, and generative focus audio in one place.

Live app: https://kairo-focus.netlify.app

## What it does

- Organizes tasks inside simple, flat projects
- Saves normalized, versioned projects, tasks, settings, and completed focus sessions in the browser
- Runs focus, short-break, and long-break Pomodoro sessions
- Restores an active timer after a reload or browser restart
- Tracks focused minutes against the selected task
- Builds a neon block structure: every completed Pomodoro places one block and every four blocks complete a floor
- Generates binaural beats, isochronic pulses, and colored noise with the Web Audio API
- Mixes the full Moodist ambient catalogue with independent volume controls
- Embeds YouTube, YouTube Live, YouTube playlists, and Spotify for lofi playback

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

The app opens at `http://127.0.0.1:3000`.

## Build

```bash
npm run build
```

## Quality gate

```bash
npm run check
```

This runs strict TypeScript checks, security-boundary and timer-restoration tests, and the production build. The same command runs in GitHub Actions.

The visual system is split into `styles/foundation.css`, `styles/product.css`, `styles/utilities.css`, and generated finite progress classes. This keeps the deployment CSP free of inline-style exceptions.

## Data and privacy

Kairo has no account or application backend. Projects, tasks, settings, timer state, and focus history stay in this browser's local storage. Ambient playback requests audio files from the Moodist GitHub repository. YouTube and Spotify receive a request only after you load one of their links in the lofi player.

## Audio note

Binaural mode sends slightly different frequencies to the left and right channels and therefore requires stereo headphones. Isochronic mode works through speakers or headphones. These sound tools are provided for personal focus and relaxation; they are not medical treatment.

The ambient catalogue references the open-source Moodist project. See
[ATTRIBUTION.md](ATTRIBUTION.md) for source and audio-license details.

## Stack

React 19, TypeScript, Vite, Web Audio API, and browser local storage.

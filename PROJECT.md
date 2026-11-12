# Project: Kairo Production Readiness & Multi-Provider AI Architecture

## Architecture
Kairo is a client-side deep-work and study companion application with an authentic Washi/Sumi aesthetic (Japanese paper textures, Sumi ink contrast, tactile spring physics). It operates with zero telemetry, zero mandatory servers, and local-first data storage.

### Core Modules
- **Timer & Stage Engine** (`components/Stage.tsx`, `components/Timer.tsx`, `types.ts`): Pomodoro cycle state machine (focus, short break, long break), dial physics, task-specific duration adaptation.
- **Task & Project Management** (`components/SidebarNav.tsx`, `utils/subtaskTime.ts`): Hierarchy of projects, tasks, and subtasks; status toggling; finish time estimation.
- **Focus Instruments & Ambient Audio** (`components/ControlPanel.tsx`, `hooks/useAudioEngine.ts`, `utils/audioCache.ts`, `utils/timeCapsule.ts`): Web Audio synthesizer for brown/white/pink noise with movement modulation, ambient audio loops, and time capsules.
- **Multi-Provider AI Architecture** (`utils/ai/`, `utils/geminiAi.ts`, `utils/documentBreakdown.ts`, `components/DocumentBreakdownModal.tsx`): Extensible provider adapter layer supporting Local Ollama, Google Gemini, Anthropic Claude, OpenAI / ChatGPT & Custom OpenAI endpoints, OpenRouter, and a zero-config deterministic offline heuristic engine.
- **Washi/Sumi Design System** (`styles/washi.css`, `components/Modal.tsx`, `components/Icon.tsx`): Strict Japanese minimalist design tokens, high WCAG AA contrast, SVG line iconography, zero text clipping.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Documented Shortcuts Listener | Wire global keydown listeners for `1`, `2`, `3` (switch mode) and `M`/`m` (master mute) in Stage/App | M1 | Survey 1 |
| 2 | Subtask Uncheck Status Reversion | Unchecking any subtask must revert parent task completion and set status back to `todo` | M1 | Survey 1 |
| 3 | Time Capsule Tomorrow Rollover | If `targetTime` (HH:MM) is earlier than creation time, schedule for next calendar day instead of immediately unlocking | M1 | Survey 1 |
| 4 | Finish Estimate Parameter Alignment | Factor `sessionsPerRound` and individual task `pomodoroLength` into finish time calculations | M1 | Survey 1 |
| 5 | Timer Reset Duration Preservation | Preserve active task custom duration upon timer reset instead of reverting to global default | M1 | Survey 1 |
| 6 | Audio Noise Oscillator Gain Derivation | Derive `movementDepth` from `noiseTarget` rather than instantaneous `gain.value` for ocean/fire presets | M1 | Survey 1 |
| 7 | Palette Normalization Alignment | Update `data/validation.ts` to recognize `obsidian`, `zen`, `indigo`, `washi` | M1 | Survey 1 |
| 8 | Ambient Audio URL Revocation | Call `URL.revokeObjectURL` before replacing or removing audio element sources to prevent memory leaks | M1 | Survey 1 |
| 9 | Text Audit Embedded Server | Update `scripts/audit_text_placement.cjs` to launch internal HTTP server on dynamic port (like `full_pass_verification.cjs`) | M1 | Survey 1, 3 |
| 10 | Multi-Provider AI Architecture Core | Modular `utils/ai/` layer with unified config, storage, and provider types | M2 | Survey 1, 2 |
| 11 | Anthropic Claude Provider Adapter | Support Anthropic Messages API with required `anthropic-dangerous-direct-browser-access: true` header | M2 | Survey 1, 2 |
| 12 | Dedicated OpenAI & Custom Adapters | Separate native OpenAI (`api.openai.com`) from generic custom endpoints with model presets | M2 | Survey 1, 2 |
| 13 | Local Ollama & OpenRouter Adapters | Ollama localhost:11434 support with CORS guidance; OpenRouter free open-weight catalog | M2 | Survey 1, 2 |
| 14 | Client-Side Document Text Extraction | Extract text streams from uploaded PDFs/text files for non-Gemini providers so no syllabus content is lost | M2 | Survey 1, 2 |
| 15 | Deterministic Offline Heuristic Engine | Industrial-strength AST parser for syllabi, units, modules, bullets, with cognitive Pomodoro budgeting | M2 | Survey 2 |
| 16 | Backward Compatibility Facade | Preserve existing function signatures in `utils/geminiAi.ts` and `utils/documentBreakdown.ts` | M2 | Survey 2 |
| 17 | CSS Variable Declarations in washi.css | Declare the 13 missing CSS variables (`--stone-1`, `--shu-ring`, `--sumi-1`, `--sumi-4`, `--serif`, etc.) | M3 | Survey 3 |
| 18 | Document Breakdown Modal 860px Fix | Fix CSS selector `.modal-card.k-doc-breakdown-modal` so breakdown modal expands to full 860px width | M3 | Survey 3 |
| 19 | WCAG AA Contrast Elevation | Shift text uses of `--stone` (2.81:1 / 2.58:1) to `--sumi-3` (5.16:1 / 5.23:1) for full compliance | M3 | Survey 3 |
| 20 | In-Modal Provider Switcher & FAQ Drawer | Tactile engine selector pill in DocumentBreakdownModal with key setup FAQ links and copyable CORS commands | M3 | Survey 1, 2, 3 |
| 21 | Emoji Removal & SVG Icon Integration | Replace 14 raw emoji glyphs in DocumentBreakdownModal with clean Washi/Sumi SVG icons | M3 | Survey 3 |
| 22 | AI Slicing Triggers in Sidebar | Connect `breakdownProjectTasks` and `breakdownSubtasks` to 1-click triggers in SidebarNav | M3 | Survey 1 |
| 23 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box test suite covering feature, boundary, cross-feature, and application scenarios | M4 | Survey 1, 2, 3 |
| 24 | Adversarial Hardening (Tier 5) | White-box adversarial testing, edge case stress-testing, and zero regression verification | M4 | Project Pattern |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Production-Grade Codebase Audit & High-Value TODOs | Features 1–9: Shortcuts (M, 1/2/3), subtask uncheck revert, time capsule tomorrow rollover, finish estimate parameters, timer reset duration, audio modulation gain, palette normalization, URL object revocation, text audit embedded server | none | COMPLETED |
| 2 | Multi-Provider AI Architecture & Offline Heuristics | Features 10–16: Modular `utils/ai/` architecture, Claude adapter, OpenAI & Custom, Ollama & OpenRouter, client-side PDF text extraction, deterministic offline AST parser, backward compatibility | M1 | COMPLETED |
| 3 | Washi/Sumi UI/UX Polish, Accessibility & Modal Overhaul | Features 17–22: CSS variable fixes in washi.css, modal 860px width fix, WCAG AA contrast elevation, in-modal provider switcher & FAQ drawer, SVG icon cleanup, sidebar AI triggers | M2 | COMPLETED |
| 4 | Final E2E Test Suite & Adversarial Hardening | Features 23–24: Execute 100% E2E tests, Playwright verifications, audit text placement, npm run check verification, adversarial coverage hardening | M3 | COMPLETED |

---

## Interface Contracts

### AI Provider Architecture (`utils/ai/types.ts`)
```typescript
export type AiProviderType =
  | 'gemini'
  | 'anthropic'
  | 'openai'
  | 'openai_custom'
  | 'openrouter'
  | 'local'
  | 'offline';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
}

export interface AiTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  model?: string;
}

export interface DocumentAnalysisInput {
  text?: string;
  fileName?: string;
  fileBase64?: string;
  mimeType?: string;
  archetype?: 'study' | 'learning' | 'working' | 'writing';
  targetDeadline?: string;
}

export interface BreakdownPlan {
  projectName: string;
  modules: ProposedModule[];
  pacing?: {
    daysRemaining: number;
    roundsPerDay: number;
    recommendedPacing: string;
  };
}
```

### Shortcuts & Audio State Contract
- Key `1`: Switches session type to `focus`.
- Key `2`: Switches session type to `shortBreak`.
- Key `3`: Switches session type to `longBreak`.
- Key `M` / `m`: Toggles master audio mute state across ambient loops and noise synthesizers.

### Time Capsule Trigger Contract
- Trigger `time` with `targetTime: "HH:MM"`: If scheduled time has already passed on the day of creation (`now >= targetDate`), target date rolls over to tomorrow (`targetDate.setDate(targetDate.getDate() + 1)`).

---

## Code Layout
- `components/`: UI components (`Stage.tsx`, `SidebarNav.tsx`, `DocumentBreakdownModal.tsx`, `SettingsModal.tsx`, `ShortcutsModal.tsx`, `ControlPanel.tsx`, `Modal.tsx`, `Icon.tsx`).
- `utils/ai/`: New modular AI provider layer (`types.ts`, `storage.ts`, `heuristics.ts`, `adapters/`, `client.ts`, `index.ts`).
- `utils/`: Legacy facades and utilities (`geminiAi.ts`, `documentBreakdown.ts`, `timeCapsule.ts`, `subtaskTime.ts`, `audioCache.ts`).
- `hooks/`: Audio and state hooks (`useAudioEngine.ts`, `useTaskOperations.ts`).
- `styles/`: Stylesheets (`washi.css`, `index.css`).
- `tests/`: Automated unit & integration tests (`tests/*.test.ts`).
- `scripts/`: Verification scripts (`audit_text_placement.cjs`, `verify_capsule_alignment.cjs`, `full_pass_verification.cjs`).

# Kairo Roadmap & Cloud Progression Architecture

This document tracks current milestones, mobile responsive execution, GDPR/EU-compliant privacy telemetry, community sound mixing, and future task queue/bundling architecture. The companion spreadsheet [`ROADMAP.xlsx`](./ROADMAP.xlsx) contains formatted tabular views.

---

## 1. Feature Milestones & Delivery Status

| ID | Capability / Feature | Domain | Status | Key Deliverable & Verification |
|---|---|---|---|---|
| **MS-01** | Collapsed Sidebar Overlap & Scrollbar Fix | UI Shell | **Completed** | Vertical flex layout, centered 36x36 action icons, hidden overflow, no horizontal scroll track (`◀ ━ ▶`). |
| **MS-02** | Tactile Audio-Haptic Timer Dial | Interaction | **Completed** | Snapping detents, Web Audio synth tick generator, pointer drag physics, keyboard shortcuts (<kbd>Space</kbd>, <kbd>S</kbd>, <kbd>R</kbd>, <kbd>E</kbd>). |
| **MS-03** | Focus To-Do Style Whole-Number Targets | Core Focus | **Completed** | Integer target rounds (●●●○), exact target hours (`3h 45m`), eliminating confusing fractional Pomodoros. |
| **MS-04** | Active Task Dial Countdown Sync | Timer Engine | **Completed** | Running dial counts down dynamically, synchronized with active task badge and title readout. |
| **MS-05** | Pure Dark / Light Dual Mode (No System) | Theming | **Completed** | Binary toggle in header and Settings modal; Washi paper & Sumi ink palettes. |
| **MS-06** | Generic AI Slice Elimination | Data Engine | **Completed** | Removed generic AI syllabus injection; offline-first outline parser with strict input sufficiency checks. |
| **MS-07** | Windows-Style Sound Studio Mute Icon | Audio Studio | **Completed** | Native-feeling speaker icon with diagonal cross slash when muted, sound waves when unmuted. |
| **MS-08** | YouTube Focus Streams Permission Fix | Audio Studio | **Completed** | Standardized sandbox (`allow-scripts allow-same-origin allow-presentation allow-popups allow-forms`) and feature permissions (`accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share`) with direct link fallback. |
| **MS-09** | Pomofocus-Style Finish Time & Overall Bar | Planning | **Completed** | Sticky summary bar compiling all tasks: `Pomos: 0/9 • Finish At: 21:59 (4.7h)` accounting for focus duration, short breaks, and long breaks. |
| **MS-10** | Contextual `ⓘ` Info Tips & Guidance | UX Guidance | **Completed** | Accessible, non-intrusive `InfoTip` popovers on timer modes, summary bar, target badges, and duration chips. |
| **MS-11** | Mobile Responsive Drawer (Phase 1) | Mobile UX | **Completed** | Sliding left off-canvas drawer (< 768px), hamburger toggle (☰ / ✕), touch backdrop dismissal, and responsive dial scaling. |
| **MS-12** | GDPR / EU-Compliant Telemetry Framework | Privacy & Cloud | **Spec Ready** | Explicit opt-in only, zero ad networks, hashed media identifiers, aggregated ambient mix presets. |
| **MS-13** | Community Sound Mixes & Curation | Cloud Audio | **Planned** | Aggregating popular focus mixes by study/work archetypes (Deep Code, Late Night, Writing). |
| **MS-14** | Task Queues & Project Bundling | Task Mgmt | **Brainstorming** | Sequential auto-advancing task queues with compound sprint estimation. |

---

## 2. Mobile Responsive Roadmap (Step-by-Step)

### Phase 1: Core Shell Adaptability (Completed)
1. **Off-Canvas Navigation Drawer**: On viewports `< 768px`, the desktop sidebar transitions to an off-canvas drawer (`min(85vw, 320px)`) that slides in smoothly from the left.
2. **Contextual Header Collapse Toggle**: Replaces the desktop chevron with a responsive hamburger (`☰`) / close (`✕`) button.
3. **Touch Backdrop**: Dimmed backdrop overlay (`rgba(0,0,0,0.5)` with blur) dismisses the drawer on tap.
4. **Auto-Dismiss on Action**: Selecting any task or triggering any modal automatically closes the mobile drawer.
5. **Responsive Dial Scaling**: On mobile screens (`< 480px`), the dial scales to `min(80vw, 270px)` with 46px time readout.

### Phase 2: Ergonomic Touch Controls (Planned)
1. **Thumb-Zone Bottom Navigation Bar**: Quick mobile controls at the bottom edge for Play/Pause, Skip, Mode Switch, and Sound Studio toggle.
2. **Mobile Sound Studio Bottom Sheet**: Convert the desktop right aside panel into a draggable sliding bottom sheet for phone screens.

### Phase 3: Progressive Web App & Offline Sync (Planned)
1. Web App Manifest and Service Worker caching for complete offline flight mode.
2. Background timer notifications using Web Notification API.

---

## 3. GDPR & Privacy-First Telemetry Architecture

### Core Ethical Guardrails
- **100% Ad-Free**: Zero Google AdSense, Meta Pixel, or third-party marketing SDKs. Kairo never sells data or displays ads.
- **Explicit Opt-In Only**: Telemetry is disabled by default (`kairo_telemetry_consent = false`). Users must explicitly toggle it on.
- **Zero Personal Identifiable Information (PII)**: No IP logging, no cookies, no user accounts required, no fingerprinting.
- **Hashed URL / Stream Tokens**: YouTube video IDs are verified and hashed; query parameters and personal watch tokens are stripped.

### Telemetry Payload Schema
```json
{
  "schema_version": 1,
  "archetype": "developer", 
  "ambient_mix": {
    "binaural": 0.12,
    "rain": 0.35,
    "campfire": 0.0
  },
  "stream_id": "jfKfPfyJRdk",
  "client_timestamp": 1729864200
}
```

### Community Value Return
1. Data submitted by opted-in users is aggregated daily into top 5 popular sound mixes per archetype.
2. These curated community mixes are published back into the app for **all users** (including those who opt out).

---

## 4. Task Queuing & Project Bundling Brainstorming

### 1. Sequential Focus Queue
- **Problem**: When working through 4-5 related subtasks, manually picking the next task breaks focus.
- **Proposed Solution**: Users can mark tasks with an "In Queue" badge (drag-and-drop order in sidebar).
- **Auto-Advance**: When a task's target Pomodoros are met and the break finishes, Kairo automatically prompts or auto-advances to the next queued item with a gentle audio chime.

### 2. Project Bundling & Sprint Modes
- **Compound Finish Estimation**: Calculate cumulative target rounds across bundled tasks:
  $$\text{Total Duration} = \sum (\text{Task Rounds} \times \text{Focus Len}) + \text{Short Breaks} + \text{Long Breaks}$$
- **Time Block Scheduling**: Allow grouping tasks into a "2-Hour Sprint" or "4-Hour Deep Work Block" with guaranteed long breaks scheduled between project transitions.

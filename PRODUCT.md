# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a person who wants a private, low-distraction workspace for choosing one task and completing a timed focus session.

## Product Purpose

Kairo is a local-first single-page focus workspace combining a Pomodoro timer, folder-tree task organization, ambient sound controls, and focus-history analytics. Success means helping the user make space for one task at a time without requiring an account or sending personal task data to a service.

## Positioning

Kairo keeps the timer, task context, sound environment, and personal focus record together in the browser, with local persistence and optional user-controlled AI assistance rather than a mandatory cloud workflow.

## Operating Context

Users move between project/task selection, a draggable timer dial, ambient audio controls, optional intention refinement, and progress review. The app must remain useful offline and responsive from desktop to mobile.

## Capabilities and Constraints

- React/TypeScript/Vite single-page app with localStorage persistence and no Kairo backend.
- Core workflows include focus sessions, nested task checklists, ambient audio, time capsules, analytics, and portable exports.
- Existing behavior, saved local data keys, and responsive/keyboard-accessible interaction must be preserved during brand work.
- Current source describes Kairo as complete; the requested work is a visual identity refresh, not a product-feature rewrite.

## Brand Commitments

- Product name: Kairo.
- Existing voice: calm, direct, and focused; current line: “Make space for one thing.”
- Existing visual world: Washi paper, Sumi ink, and Vermilion active-state accent, inspired by Japanese material references.
- The user asked for a better logo, favicon, and surrounding brand assets. The current implementation decision is Kairo Interval Mark A2: a bulky task anchor with tactile interval arms, a notch, and one rounded vermilion active-state latch.

## Evidence on Hand

- Current implementation: `components/BrandLogo.tsx`, `index.html`, and `styles/washi.css`.
- Product description and feature inventory: `README.md`.
- No public deployment, customer claims, or measured adoption should be invented.

## Product Principles

- One task should remain easy to see and act on.
- Private-by-default behavior should be understandable.
- Calm should come from clarity and restraint, not decoration.
- Visual identity must survive small sizes and everyday use.

## Accessibility & Inclusion

Preserve keyboard navigation, visible focus, WCAG contrast, responsive layouts, and `prefers-reduced-motion` behavior already expected by the app.

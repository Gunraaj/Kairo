# Kairo visual identity

<!-- impeccable:design-schema 1 -->

## THESIS

Kairo makes one active moment visible inside a calm workspace. The identity refuses the generic tomato, stopwatch, or decorative zen-circle logo and instead uses a bulky Kairo interval mark.

## OWN-WORLD

Washi paper, Sumi ink, and one Vermilion active latch remain the material language. The mark uses a bulky task anchor, two tactile interval arms, a small notch, and a rounded active-state insert. Geometry stays crisp enough for a favicon and quiet enough for the operating UI.

## STORY

The user sees Kairo as a private focus workspace: one task, one timer, one deliberate interval. The wordmark stays plain and readable; the mark carries the memory.

## FIRST VIEWPORT

The left sidebar opens with a 28px Sumi tile containing the interval mark and the lowercase `kairo` wordmark. The focus dial remains the dominant stage element. The favicon uses the same bulky geometry on a Sumi tile with the Vermilion latch preserved.

## FORM

Kairo Interval Mark A2 — bulky task anchor with tactile interval arms and one rounded Vermilion latch.

## FINISH

unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md

## Tokens and rules

- Primary mark: `components/BrandLogo.tsx`, variant `interval`.
- Static favicon: `public/favicon.svg`; runtime tab icon uses the same SVG geometry through `getLogoSvgDataUri`.
- Active color: existing `var(--shu)` / Vermilion. Do not introduce a second accent for brand surfaces.
- Existing `kairo_logo_variant` values normalize to `interval`; this is a brand migration only and must not touch other local data.
- The mark must remain recognizable at 16px, 24px, 28px, 32px, and monochrome fallback sizes.

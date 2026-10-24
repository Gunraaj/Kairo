# Kairo visual identity

<!-- impeccable:design-schema 1 -->

## THESIS

Kairo makes one active moment visible inside a calm workspace. The identity refuses the generic tomato, stopwatch, or decorative zen-circle logo and instead uses a compact K-shaped interval mark.

## OWN-WORLD

Washi paper, Sumi ink, and one Vermilion active node remain the material language. The mark is drawn as two disciplined strokes: a K-shaped path held by a returning loop, with the node marking the currently held interval. Geometry stays crisp enough for a favicon and quiet enough for the operating UI.

## STORY

The user sees Kairo as a private focus workspace: one task, one timer, one deliberate interval. The wordmark stays plain and readable; the mark carries the memory.

## FIRST VIEWPORT

The left sidebar opens with a 28px Sumi tile containing the interval mark and the Kairo wordmark. The focus dial remains the dominant stage element. The favicon uses the same geometry on a Sumi tile with the Vermilion node preserved.

## FORM

Kairo Interval Mark — grounded direction candidate 7, seed key `cc5d7cac`. The roll ran degraded with no catalog challengers; the implementation follows the assigned grounded direction and the confirmed incumbent Washi/Sumi/Vermilion world.

## FINISH

unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md

## Tokens and rules

- Primary mark: `components/BrandLogo.tsx`, variant `interval`.
- Static favicon: `public/favicon.svg`; runtime tab icon uses the same SVG geometry through `getLogoSvgDataUri`.
- Active color: existing `var(--shu)` / Vermilion. Do not introduce a second accent for brand surfaces.
- Existing `kairo_logo_variant` values normalize to `interval`; this is a brand migration only and must not touch other local data.
- The mark must remain recognizable at 16px, 24px, 28px, 32px, and monochrome fallback sizes.

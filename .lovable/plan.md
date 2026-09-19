# Warmer, smaller posted entity pills

## Decision

Restore a soft Common Groundz orange/peach emphasis while making the posted entity pill one step more compact. The screenshot confirms the current neutral treatment blends into the feed too much; this is a posted-pill-only visual refinement, not another redesign.

## Visual adjustment

- Change the posted pill from 36px to 34px tall.
- Change its circular thumbnail from 28px to 24px.
- Keep the label at 14px and medium weight for readability.
- Tighten the image-to-label gap and trailing padding slightly, without crowding the text or focus ring.
- Replace the neutral background and border with a restrained semantic primary tint:
  - a very light orange/peach background;
  - a light orange border;
  - normal foreground text rather than dark orange/brown text.
- Keep the image/fallback perfectly circular and vertically centered.
- Use existing semantic theme tokens and verify the tint remains restrained in dark mode.

## Preserve exactly

- Keep the composer pill unchanged.
- Keep the posted pill’s fluid width, measured truncation, overflow-only tooltip, and stable width on hover/focus.
- Keep navigation, accessible naming, keyboard focus, parent-card event isolation, shared image resolution, missing/broken-image fallback, and category-row removal unchanged.
- Keep multiple-pill wrapping and all other post-card content and behavior unchanged.
- Do not add animation, shadows, stronger text color, category text, or a fixed label-width limit.

## Verification

1. Update only `PostedEntityPill` presentation classes.
2. Confirm existing interaction and image-contract tests still pass; add no new behavior unless a regression requires coverage.
3. Run the full test suite, type validation, focused lint, and inspect the preview build signal.
4. Visually check the real feed at desktop and mobile widths in light and dark themes, including:
   - three pills in one post;
   - the long perfume entity name and its tooltip;
   - real images and local fallback icons;
   - stable wrapping and no hover/focus layout shift.
5. Update only the existing post–Phase 5 follow-up verification record and roadmap entry, then stop for visual approval.

## Completion rule

Complete only when the pill reads as recognizable entity context without competing with the post title or action row, long names remain understandable, and no behavior or surrounding layout changes.

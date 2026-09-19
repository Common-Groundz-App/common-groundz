# Quieter posted entity pills and complete-name disclosure

## Audit verdict

Steps 1–4 are functionally implemented correctly.

| Requirement | Status | Confirmed result |
|---|---|---|
| Shared real-image and fallback contract | PASS | `EntityImage` uses `getOptimalEntityImageUrl`, then one local fallback for missing or failed sources. |
| Canonical fallback handling | PASS | All 15 canonical types are mapped; malformed input uses a neutral fallback rather than product/place. |
| Composer integration | PASS | The selected composer pill now uses the shared image contract without changing composer controls. |
| Read-only posted pill | PASS | A real button preserves `navigate(getEntityUrl(entity))`, accessible naming, focus styling, and event isolation. |
| Shared posted-card replacement | PASS | `PostFeedItem` uses the new pill; home/feed, hashtag, Entity V4, detail, and related cards inherit it. |
| Category-row removal | PASS | Removed only from shared posted cards; category presentation elsewhere remains intact. |
| Frozen card behavior | PASS | Media order, header, rating, post content, location tags, actions, counts, comments, save, and share remain unchanged. |
| Tests/type/build | PASS | 5 focused image tests, 659 full tests, type validation, and the recorded preview build passed. |
| Pill interaction tests | LEFTOVER | Navigation/event isolation and composer integration are source/manual-covered but lack focused component tests. |
| Durable visual evidence | LEFTOVER | The verification record references session-local screenshots that are no longer available. |

The current cube in the attached card is the intentional Product fallback. Brand already has a separate building-style icon, so the mapping should not be changed based on this screenshot alone.

## Selected refinement

Use the chosen restrained, fluid posted-pill direction. Keep the composer pill unchanged.

### Posted-only visual treatment

- Reduce height from 40px to 36px.
- Keep a 28px circular thumbnail so real images and local fallbacks remain legible.
- Replace the peach/primary emphasis with a quieter semantic neutral border and background.
- Keep the existing readable 14px label. Use medium weight, with the quieter container—not smaller text—creating the secondary emphasis.
- Preserve circular shape, image crop, surrounding spacing, multiple-pill wrapping, button semantics, focus visibility, and navigation.
- Do not add category/type text back into the pill.

### Long-name behavior

- Remove the fixed 180px label bottleneck from the posted version.
- Let the pill use the available row width naturally, bounded by the feed card, before truncating.
- Keep the pill width stable on hover and keyboard focus. Do not animate or expand it, reflow neighboring pills, or shift the pointer/focus target.
- When the stable label still overflows, show the existing accessible tooltip with the full entity name on hover/focus.
- Show the tooltip only when truncation is real, determined from the rendered label rather than name length.
- On touch layouts, use the available card width immediately; tapping still opens the entity page. Do not add a separate disclosure control.
- Keep tooltip timing restrained and use the existing tooltip behavior rather than adding custom animation.
- Ensure the stable responsive width never overlaps another pill, the card edge, post text, or actions.

## Implementation scope

1. Update only `PostedEntityPill` presentation and overflow detection; do not change `EntityHeroPill`.
2. Reuse the existing tooltip components and semantic color tokens.
3. Add focused tests for:
   - correct entity destination;
   - parent click isolation for pointer and keyboard activation;
   - visible/full-name tooltip only for measured overflow;
   - no tooltip for names that fit;
   - composer and posted pills continuing to use the shared image contract.
4. Re-run the 5 image-contract tests, full test suite, type validation, focused lint, and preview build.
5. Re-capture current desktop/mobile and light/dark evidence for:
   - the two-entity Review card;
   - the long perfume/media card;
   - missing and broken image fallbacks;
   - multiple pills with stable wrapping before, during, and after hover/focus;
   - keyboard focus and reduced motion.
6. Update only the post–Phase 5 verification record and its follow-up roadmap entry, then stop for visual approval.

## Frozen boundaries

- No changes to composer-pill size or styling.
- No changes to image resolution, canonical fallback mapping, queries, schema, generated types, routes, or write paths.
- No changes to post media/order, header, rating, title/body, location tags, actions, counts, comments, save, or share.
- No app-wide fallback inventory or migration in this work.
- No redesign of the post card and no persistent test data.

## Completion rule

Complete only when the refinement passes automated checks and the refreshed visual evidence shows a quieter pill, understandable long names, no hover/focus layout shift, stable wrapping, and no regressions. Any visual or interaction defect stops the work for review rather than triggering broader changes.

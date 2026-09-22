# Group 2A — consistent fallback images for search and selection rows

Groups 0A/0B/1 are closed. Group 2A applies the same shared fallback rule to the small square thumbnails in search and selection lists. Only the *source* of the picture changes when a real picture is missing or fails to load. Every size, shape, corner rounding, crop, spacing, label and click behaviour stays exactly as it is today.

## The initials boundary (explicit)

Two different fallback concepts exist side by side and are treated differently:

- **Entities**: the first-letter placeholders seen on image-less entity rows (e.g. "M" on the Centella products) are replaced by the canonical entity-type icon. Entity initials are not informative — the type is.
- **People**: user avatar initials (e.g. "RS" on `rishab.devp`) are identity and are completely untouched. `ProfileAvatar`, `ProfileDisplay`, `UserResultItem`, the People section in `UnifiedEntitySelector`, and every other username-initial rendering stay exactly as they are.

In `UnifiedEntitySelector` only the entity-result thumbnail branches are migrated; the People branch and its avatar/initials fallback are not modified. A focused non-regression test on the mixed search-results view proves an image-less entity shows its canonical type icon while an image-less person still shows their existing initials.

## Surfaces in scope (four files, five thumbnail slots)

| Surface | Slot today | Stays exactly |
|---|---|---|
| Search result row (`EntityResultItem`) | 48×48, rounded square | frame, link behaviour, text layout |
| Product search page row (`ProductSearch`) | 48×48, rounded square, plain image tag | frame, row layout, click behaviour |
| Review flow "choose a subject" row (`SubjectSelectStep`) | 48×48, rounded square, lazy loading | frame, lazy loading, selection behaviour |
| Entity picker dropdown — modal list (`UnifiedEntitySelector`) | 44×44, rounded square | frame, list layout |
| Entity picker dropdown — inline list (`UnifiedEntitySelector`) | 32×32, rounded square | frame, list layout |

The already-migrated selected chip in the same file is not touched again.

## What changes

For each slot:

- A real picture resolves exactly as today and renders unchanged, keeping its existing object-cover crop behaviour.
- If there is no picture, or the picture fails to load, the slot shows the one canonical local icon for that item's type — the same icon in both cases, centred inside the same wrapper at the established proportional icon size. The icon must not change the wrapper's dimensions, radius, spacing or layout.
- An unknown or malformed type shows the neutral icon. Nothing is ever guessed as a product or a place.
- One attempt at the real picture, then straight to the local icon. No second network request, no stock photos, no `/placeholder.svg`, no initials (entities only).
- Switching the row to a different item resets the failure state, so a previous failure never leaks into the next item.

## Explicitly out of scope

Group 2B (entity children card, entity sidebar parent and related rows, recommendation entity card) — separate gate, and the children-card parent-image rule must be documented and approved first. Also untouched: every user/profile avatar and initials fallback, entity tab child cards, the commented-out related card, related entities section, Saved and My Stuff cards, review/chat/recommendation cards, carousels, explore grids, entity headers, admin and version-gated pages, `ImageWithFallback`, the global image resolver, shared legacy helpers, database rows, schema, generated types, and existing keyboard markup.

## Technical approach

- Reuse `useEntityImageFallback` and `getEntityFallbackIcon` from the Group 0A contract *inside each existing wrapper element*; do not swap in `EntityImage` (it is circular by contract) and do not introduce a shared thumbnail component in this step.
- Keep each wrapper's existing classes verbatim. Real images keep their current `object-cover` behaviour; the fallback icon is centred within the same box (an SVG icon is not put through image crop behaviour).
- `ProductSearch` keeps its plain image element structure — it gains the fallback only, not the proxy/retry behaviour of `ImageWithFallback`.
- `getOptimalEntityImageUrl` stays globally unchanged; legacy placeholder recognition continues to flow only through the shared contract.
- Remove now-unused legacy fallback imports from these four files only. No shared helper is deleted while other callers remain.

## Verification

- Focused renderer tests per surface: valid image, missing image, broken image, registered legacy placeholder, unknown type, and entity switch reset.
- The mixed search-view non-regression test for the initials boundary (entity → icon, person → initials).
- Full Vitest suite, `bunx tsgo --noEmit`, focused ESLint (pre-existing issues reported separately), preview build.
- Desktop and mobile checks of each list; confirm real images render identically and computed box size, rounding and crop are unchanged from before.
- Update the fallback inventory doc and roadmap.

Stop after Group 2A for visual approval. Do not begin Group 2B or the card/grid group.

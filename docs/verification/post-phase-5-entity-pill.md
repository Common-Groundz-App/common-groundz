# Post–Phase 5 entity-pill follow-up

## Implemented

- Added one shared entity-image presentation contract for the composer and posted pills.
- Preserved `getOptimalEntityImageUrl` as the real-image resolver.
- Added deterministic local icon fallbacks for all 15 canonical entity types and a neutral fallback for malformed input.
- Missing and broken sources now use the same fallback without a second image request.
- Added the read-only `PostedEntityPill`, preserving the existing entity destination through a real button.
- Replaced only the shared post card's entity tags and removed only its category row.

## Preserved boundaries

- Media remains before entity pills.
- Header, Review rating, title/body, location tags, actions, counts, comments, save, and share are unchanged.
- No query, schema, generated type, route, or write-path changes.
- Profile cards and all other entity-image surfaces remain unchanged pending a separately approved inventory.

## Verification

- Focused entity-image tests: PASS (5 tests).
- Full Vitest suite: PASS (41 files, 659 tests).
- TypeScript validation: PASS.
- Preview build: PASS.
- Two-entity Review card: PASS at desktop/mobile and light/dark; both pills wrap naturally.
- Long perfume entity with media: PASS; media remains above the pill and the former category row is absent.
- Missing and deliberately broken sources: PASS; both render the same local fallback.
- Entity navigation: PASS; pill opens `/entity/:slug` without firing the surrounding post destination.
- Keyboard focus: PASS; the posted pill retains a visible focus ring.
- Runtime page errors introduced by this follow-up: none.

## Session-local screenshots

`/tmp/browser/entity-pill/screenshots/`

## Status

Implementation complete. Stopped for visual approval; the app-wide fallback inventory and migration have not started.
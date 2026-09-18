# Entity-pill polish and consistent image fallback

## Decision

Adopt the composer’s selected-entity pill as the exact visual reference for posted entity tags, while creating a separate read-only component for posted cards. Remove the redundant category row.

Phase 5 is already closed, so record this honestly as a post–Phase 5 follow-up rather than retroactively calling it 5.0D or rewriting completed evidence.

The tagged-entity payloads used by home/feed, hashtag, Entity V4, post detail, and related-post cards already fetch complete entity rows. They include both `image_url` and `metadata.stored_photo_urls`, so the posted-pill work requires no query changes.

## Current deliverable

Only Steps 1–4 are approved implementation work. The app-wide migration is a separate future follow-up that requires its own inventory, plan, and approval.

## Delivery sequence

### Step 1 — Define one entity-image contract

- Keep `getOptimalEntityImageUrl` as the sole resolver for a real entity image, preserving stored-photo priority and avoiding unnecessary proxy calls.
- Confirmed: `getOptimalEntityImageUrl` returns the best available real entity URL or `null`; it does not substitute a visible fallback image.
- Add one shared entity-image presentation component that owns:
  - optimal source selection;
  - missing-source handling;
  - invalid or broken-request handling;
  - a deterministic local type fallback with no second network request;
  - accessible alternative text and decorative-image behavior;
  - stable sizing and crop behavior supplied by each surface.
- Build one exhaustive fallback mapping against the existing `CanonicalEntityType` from `src/services/entityType.ts`; do not define another entity-type list.
- Give all 15 canonical types a deterministic local type icon on a semantic, theme-compatible circular background. Treat canonical `others` deliberately; malformed or unknown input uses a neutral generic entity fallback. Neither may silently become `product` or `place`.
- Use the same fallback visual and decision path for both a missing URL and a URL that fails to load.
- Do not use remote stock photographs as the final fallback. They can fail independently, create inconsistent imagery, and add unnecessary requests.
- Reset failure state whenever the entity or resolved real-image URL changes. Key or otherwise isolate the rendered image by its resolved source so a late failure from an old request cannot force a newer source into fallback.
- Reserve width, height, and circular shape from the first render so loading or fallback transitions cannot shift the pill.
- Keep fallback selection independent from surface dimensions and crop classes, allowing later consumers to share the decision contract without adopting pill sizing.

### Step 2 — Use the same image behavior in composer and posted pills

- Replace the composer pill’s separate missing-image branch with the shared entity-image component so missing and broken images behave identically.
- Add a focused read-only `PostedEntityPill`; do not reuse `EntityHeroPill`, because that component owns remove and “Add more” controls.
- Match `EntityHeroPill`’s selected state literally:
  - 40px pill height and restrained semantic background/border;
  - 28px circular thumbnail;
  - semibold 14px text with a 180px maximum label width;
  - the same natural wrapping for multiple entities.
- The posted version omits all editing controls and adjusts only the trailing padding needed after removing the close control.
- Use the app’s established semantic navigation primitive: prefer a link when it is valid in the current card structure; otherwise retain the accessible `type="button"` plus `navigate(getEntityUrl(entity))` pattern. Do not introduce a new navigation architecture.
- Preserve a visible keyboard focus indicator. The interaction’s accessible name identifies the entity; the adjacent thumbnail uses `alt=""` so assistive technology does not announce the same name twice.
- Preserve the existing `navigate(getEntityUrl(entity))` destination and stop the surrounding post-card click from firing.
- Isolate pointer and keyboard activation from the enclosing card so using the pill never triggers both destinations.

### Step 3 — Replace shared posted-card tags and remove category rows

- Update only `PostFeedItem`’s tagged-entity renderer to use `PostedEntityPill`.
- Remove `EntityCategoryBadge` beneath posted entities and remove only imports made unused by that deletion.
- Keep category records and category presentation on search results, entity pages, and every unrelated surface.
- Apply automatically to the existing shared-card surfaces: home/feed, hashtag, Entity V4, post detail, and related-post cards.
- Leave the separate profile-card renderer unchanged in this visual step; it is not the shared card shown in the supplied examples.

### Step 4 — Stop for visual approval

- Verify one long-name entity, multiple entities, a missing image, a deliberately broken image, and an entity with a category.
- Check desktop/mobile and light/dark presentation for wrapping, truncation, clipping, and overlap.
- Capture the real two-entity Review card, the perfume/media card with its long entity name, and a controlled missing/broken-image case for visual approval.
- Confirm media remains above the entity pills and the category row is gone.
- Confirm entity navigation, the header, Review rating, title/body, location tags, action row, counts, comments, save, and share behavior are unchanged.
- Run focused component tests, type validation, and inspect the latest preview build signal.
- Stop for visual approval before broadening image work elsewhere.

## Future follow-up — app-wide fallback consistency

### Inventory gate — no migration yet

- After the posted pills receive visual approval, audit active entity-image surfaces only.
- Produce a surface-by-surface matrix covering search, entity pages, post-detail sidebar, saved items, recommendation cards, chat, composer, and any other active matches.
- For each surface, record its current resolver, missing-image behavior, broken-image behavior, dimensions/aspect ratio, accessibility role, and the exact proposed change under the shared contract.
- Classify duplicate fallback helpers and direct `image_url` reads as active visual, intentional non-visual, or legacy/dead.
- Stop and request separate approval before migrating any additional surface or deleting any existing fallback helper.

### Later migration — separate approval required

- Migrate approved surfaces in small, reviewable groups while preserving each surface’s own dimensions, crop, layout, navigation, and content.
- Remove a duplicate fallback helper only after proving it has no remaining active caller; do not alter persistence, ingestion, SEO data, or non-visual processing merely because they read `image_url`.
- Reuse the shared state machine and canonical fallback mapping rather than duplicating switches.
- Verify each group before continuing to the next.

## Frozen boundaries

- No database, generated-type, write-path, routing, or entity-query changes.
- No changes to post media, media-before-entity order, header, type badge, Review rating, title/body, location tags, action row, counts, comments, save, or share behavior.
- No category deletion or category-display changes outside shared posted cards.
- No cap on the number of posted entity pills; retain the current wrapping behavior.
- No remote fallback-image proliferation and no silent fallback to an incorrect canonical entity type.
- No app-wide image migration or fallback-helper deletion under the current approval.

## Tracking and completion

- After approval, add this as a separate post–Phase 5 follow-up in the roadmap before source changes.
- Do not rewrite the completed Phase 5 evidence. Add a focused follow-up verification record instead.
- A failure in the shared-card visual checks stops the work before the app-wide migration. A pre-existing unrelated warning is documented but does not block completion.
- Focused tests cover real-image source priority, all 15 canonical fallback mappings, canonical `others`, malformed/unknown types, missing URLs, broken URLs, source/entity changes after failure, stale failure events, and decorative versus informative accessibility modes.
# Entity-pill polish and consistent image fallback

## Decision

Adopt the composer’s selected-entity pill as the exact visual reference for posted entity tags, while creating a separate read-only component for posted cards. Remove the redundant category row.

Phase 5 is already closed, so record this honestly as a post–Phase 5 follow-up rather than retroactively calling it 5.0D or rewriting completed evidence.

The tagged-entity payloads used by home/feed, hashtag, Entity V4, post detail, and related-post cards already fetch complete entity rows. They include both `image_url` and `metadata.stored_photo_urls`, so the posted-pill work requires no query changes.

## Delivery sequence

### Step 1 — Define one entity-image contract

- Keep `getOptimalEntityImageUrl` as the sole resolver for a real entity image, preserving stored-photo priority and avoiding unnecessary proxy calls.
- Add one shared entity-image presentation component that owns:
  - optimal source selection;
  - missing-source handling;
  - invalid or broken-request handling;
  - a deterministic local type fallback with no second network request;
  - accessible alternative text and decorative-image behavior;
  - stable sizing and crop behavior supplied by each surface.
- Use the 15 canonical entity types when selecting the fallback. Unknown values use one neutral generic entity fallback; they must not be treated as `product` or `place`.
- Use the same fallback visual and decision path for both a missing URL and a URL that fails to load.
- Do not use remote stock photographs as the final fallback. They can fail independently, create inconsistent imagery, and add unnecessary requests.

### Step 2 — Use the same image behavior in composer and posted pills

- Replace the composer pill’s separate missing-image branch with the shared entity-image component so missing and broken images behave identically.
- Add a focused read-only `PostedEntityPill`; do not reuse `EntityHeroPill`, because that component owns remove and “Add more” controls.
- Match the composer pill literally:
  - the same compact height and restrained semantic background/border;
  - the same small circular thumbnail proportions;
  - the same text weight and truncation width;
  - the same natural wrapping for multiple entities.
- The posted version omits all editing controls and uses a real accessible button for navigation.
- Preserve the existing `navigate(getEntityUrl(entity))` destination and stop the surrounding post-card click from firing.

### Step 3 — Replace shared posted-card tags and remove category rows

- Update only `PostFeedItem`’s tagged-entity renderer to use `PostedEntityPill`.
- Remove `EntityCategoryBadge` beneath posted entities and remove only imports made unused by that deletion.
- Keep category records and category presentation on search results, entity pages, and every unrelated surface.
- Apply automatically to the existing shared-card surfaces: home/feed, hashtag, Entity V4, post detail, and related-post cards.
- Leave the separate profile-card renderer unchanged in this visual step; it is not the shared card shown in the supplied examples.

### Step 4 — Stop for visual approval

- Verify one long-name entity, multiple entities, a missing image, a deliberately broken image, and an entity with a category.
- Check desktop/mobile and light/dark presentation for wrapping, truncation, clipping, and overlap.
- Confirm media remains above the entity pills and the category row is gone.
- Confirm entity navigation, the header, Review rating, title/body, location tags, action row, counts, comments, save, and share behavior are unchanged.
- Run focused component tests, type validation, and inspect the latest preview build signal.
- Stop for visual approval before broadening image work elsewhere.

### Step 5 — App-wide fallback consolidation after approval

- Inventory active entity-image surfaces and classify each current helper or direct `image_url` access before changing it.
- Migrate active visual surfaces to the shared entity-image component without changing their dimensions, layout, navigation, or surrounding content.
- Consolidate the four currently competing type-fallback implementations into one canonical 15-type definition.
- Remove a duplicate fallback helper only after proving it has no remaining active caller; do not alter persistence, ingestion, SEO data, or non-visual processing merely because they read `image_url`.
- Give every migrated surface the same missing/broken-image result while preserving each surface’s intended image size and aspect ratio.
- Add focused tests covering source priority, all canonical type fallbacks, unknown types, missing URLs, broken URLs, and source changes after an error.
- Verify representative search, entity, post-detail sidebar, saved-item, recommendation, chat, and composer surfaces. Record any legacy-only match instead of changing it without evidence.

## Frozen boundaries

- No database, generated-type, write-path, routing, or entity-query changes.
- No changes to post media, media-before-entity order, header, type badge, Review rating, title/body, location tags, action row, counts, comments, save, or share behavior.
- No category deletion or category-display changes outside shared posted cards.
- No cap on the number of posted entity pills; retain the current wrapping behavior.
- No remote fallback-image proliferation and no silent fallback to an incorrect canonical entity type.

## Tracking and completion

- After approval, add this as a separate post–Phase 5 follow-up in the roadmap before source changes.
- Do not rewrite the completed Phase 5 evidence. Add a focused follow-up verification record instead.
- A failure in the shared-card visual checks stops the work before the app-wide migration. A pre-existing unrelated warning is documented but does not block completion.
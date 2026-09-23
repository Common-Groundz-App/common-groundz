# Group 4 (revised) — Explore grids and entity collections

Both reviews are right, and I checked every disputed claim in the code before rewriting. Two corrections were needed; one point I want to add myself.

## Audit answers

**1. The related-by-creator card is not live.** `EntityRelatedCard` renders a centred "Coming Soon" card only. Its 40×40 thumbnail row exists solely inside a commented-out block (lines 113–135, "Example structure for when we implement this"). It is mounted from `EntitySidebar` and both legacy entity pages, but no related-entity list renders. My earlier plan was wrong to call the thumbnail live — the original inventory classification was correct. It is removed from Group 4 and left untouched.

**2. The deferred search rows are genuinely different files.** Group 2A migrated `EntityResultItem`, `ProductSearch`, `SubjectSelectStep`, and the `UnifiedEntitySelector` dropdown rows. Still unmigrated and still showing stock photography, going to Group 6: `src/components/search/SearchResultHandler.tsx` (search dialog and header search input, 48×48, shows the words "No Image"), `src/components/search/ProductResultItem.tsx` (48×48, always falls back to a generic product photo), and `src/components/recommendations/EntitySearch.tsx` (40×40 rows with a hard-coded stock photo per type — and it also copies that stock address into the item it creates when you pick an external result, which is a write-path fix). Distinct surfaces, no double count, no gap in 2A.

**3. Real-image precedence — the strongest point raised.** Verified: the shared hook resolves through `getOptimalEntityImageUrl`, which prefers `metadata.stored_photo_urls[0]` over `image_url`. Featured entities and Category highlights already call that resolver, so nothing changes for them. The sibling strip and the related-items grid read `image_url` directly today, so handing them the whole entity could swap a currently displayed real photo for a different one — outside a fallback-only change. Those two will pass only their current source (`{ id, image_url }`, no metadata) into the hook, so the displayed real picture is unchanged and only the missing/broken/placeholder path becomes shared.

**4. Hover zoom — preserve, never add.** Confirmed neither Explore file has any hover-scale classes. The sibling strip and related grid keep `group-hover:scale-105 transition-transform`; Explore gets nothing added.

**5. The loading skeleton is intentionally excluded, not deferred.** It represents loading, can render before any entity exists, and conflating it with a missing picture would remove loading feedback. I will record it in the inventory as a permanent exclusion so it stops resurfacing as pending work.

## Addition of my own

One more safeguard worth having: Category highlights has three separate picture blocks in one file and Explore also renders it four more times with a type filter. The focused tests will cover all three branches individually, not just the first — an easy place for one branch to be missed silently. I will also assert that no surface in this group renders `/placeholder.svg` or any `images.unsplash.com` address after the change, as a single catch-all guard.

## Corrected scope — four files

- `src/components/explore/FeaturedEntities.tsx` — the 192px-tall picture area; keeps its existing optimal-source resolution; `fallbackSrc="/placeholder.svg"` and the stock `entityType` path removed.
- `src/components/explore/CategoryHighlights.tsx` — all three 128px-tall picture areas; same.
- `src/components/entity/SiblingCarousel.tsx` — the 128px-tall picture in each 256px-wide card; current raw `image_url` precedence preserved; `getEntityTypeFallbackImage` import dropped; hover zoom kept.
- `src/components/entity/RelatedEntitiesSection.tsx` — the square picture area; current raw `image_url` precedence preserved; hover zoom kept.

Behaviour on all four: real picture unchanged; no picture, broken picture, or a known old stock address → the canonical icon for that item's type on the existing neutral tile with an accessible missing-picture label; unrecognised type → neutral icon. Missing and broken identical, one real attempt, no second request. Frames, heights, aspect ratios, radius, crop, spacing, badges, links, navigation and layout preserved verbatim.

## Explicitly excluded

The commented-out related-card example, the loading skeleton (permanent exclusion), optional picture regions that would change layout, the entity header and large hero placeholders (Group 5), admin and version-gated legacy pages (Group 6), the three search/recommendation-picker files named above (Group 6), the shared retry image component, the legacy stock helpers, the global resolver, database rows, schema, generated types, My Stuff cards, and every user avatar or initials fallback. Group 4 does not close the wider programme.

## Tests and verification

Focused file `src/components/explore/group4GridCarouselImages.test.tsx`, registered in `vitest.config.ts`, per surface: real image renders with the exact preserved wrapper, height/aspect and crop classes; an entity with both a raw `image_url` and a different stored metadata photo keeps today's selection on each surface (stored photo on Explore, raw `image_url` on the sibling strip and related grid); missing → canonical icon with accessible label; broken (error event) → identical icon and no second request; registered legacy placeholder → icon; unknown type → neutral icon; all three Category highlights branches covered; no `/placeholder.svg` or `images.unsplash.com` in any rendered output; hover-zoom classes present only where they exist today.

Then: full suite, `bunx tsgo --noEmit`, focused lint (pre-existing findings reported separately), preview build, controlled desktop and mobile fixtures of the grid and carousel empty states for your visual approval (adjusting only icon size or background tone if sparse, never the frame), and inventory + roadmap updates recording this group, the related-card and skeleton exclusions, the named Group 6 files, and the still-open Group 5/6 plus cleanup items. Then stop — no Group 5.

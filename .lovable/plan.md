# Group 5 — Entity page header image (large entity placeholder)

Group 4 is confirmed complete: the four Explore/collection files contain no old fallback code, no stale imports, and all of them render through the shared contract. Nothing left over.

Group 5 changes the one remaining large entity placeholder: the picture at the top of an entity page.

## What the user sees today

At the top of an entity page the picture is 96×96 beside the title on desktop, and a full-width band about 192px tall above the title on mobile. When the entity has no usable picture — or the picture is broken or expired — the page shows a random stock photograph, because a stock address is substituted before the picture is even rendered.

## What it becomes

Same frame, same size, same position, same rounding, same crop. Only the empty state changes: a soft neutral panel with the centred canonical icon for the entity's type, identical in language to the cards and grids already approved. Unrecognised types get the neutral icon. Nothing is added — no text label, no initials, no second attempt at another address.

The refresh button keeps a strict, three-way distinction:

- the entity never had a picture → icon, no refresh button;
- the picture is one of the old stock placeholders (so it counts as no picture) → icon, no refresh button;
- a real picture was attempted and genuinely failed to load → icon, and for a signed-in person the refresh button appears over it exactly as today.

Moving between entities never carries a failure over: opening an entity whose picture is fine must never show a refresh button left behind by the previous one.

## Scope

In scope (the live entity page only):

- `src/components/entity-v4/EntityHeader.tsx` — the header picture area (lines 166–209).
- `src/components/entity-v4/EntityV4.tsx` (line 472) — stop substituting a stock address into the value handed to the header.

Deliberately out of scope:

- `src/pages/EntityDetail.tsx` (v1) and `src/pages/EntityDetailV2.tsx` (v2) — their 4:3 header blocks are reachable only for internal users via `?version=1` / `?version=2`. They stay for Group 6 with the other legacy/admin surfaces.
- `src/components/entity/EntityProductsCard.tsx` — its 48×48 product thumbnail is only rendered when an image exists; adding a fallback would change row layout. Recorded as an intentional exception alongside `MyStuffItemCard`.
- `EntityDetailSkeleton` (loading state, permanently excluded), `EntityMetadataCard` (no image), the sidebar rows (already migrated in Group 2B), `ImageWithFallback`, `getOptimalEntityImageUrl`, the legacy stock helpers, database rows, schema, generated types.

## Technical details

- `EntityV4.tsx:472` currently computes `entity?.image_url || getEntityTypeFallbackImage(...)`. That stock substitution is removed, so the header receives only the entity's own image value; the `getEntityTypeFallbackImage` import is dropped if it becomes unused.
- `EntityHeader.tsx` resolves the picture through `useEntityImageFallback({ id: entity.id, image_url: <entity image> })`. Passing only the current source preserves today's raw `image_url` precedence — a stored metadata photo must not displace the picture the header shows now.
- `ImageWithFallback` is replaced by a plain `<img>` plus the shared fallback branch. Classes are kept verbatim: wrapper `w-full h-48 mb-4 rounded-lg overflow-hidden` (mobile) / `flex-shrink-0 h-24 w-24 min-w-[96px] rounded-lg overflow-hidden` (desktop), plus `relative group` and the existing `bg-muted` for brand entities; image `h-full w-full` with `object-contain` for brands and `object-cover` otherwise.
- `EntityHeaderProps.entityImage` becomes `string | null`, and `null` — never `''` — is passed when there is no real source. `entityData.image` (the same value) becomes nullable with it; it is confirmed unused inside `EntityHeader`, and `SEOHead` already reads `entity.image_url` separately, so social metadata is unaffected.
- `onError` keeps calling `setIsImageExpired(true)` (so the refresh overlay still appears) and additionally marks the source failed in the hook, so a broken picture converges on the same icon as a missing one, with no second network request.
- The expired flag is set **only** by a real `onError` from a rendered `<img>`. A missing source and a registered legacy placeholder never reach the `<img>`, so they can never set it — "no usable image" stays distinct from "an image expired".
- The existing reset effect currently depends on `entityImage` alone (`EntityHeader.tsx:89-93`). It gains `entity.id`, so `setIsImageExpired(false)` also runs when navigating between entities that share the same image value or both have none — no stale overlay can survive a change of entity. The overlay render condition additionally requires a resolved real source, so it cannot appear over a never-present picture.
- Fallback element: fills the frame, centred icon (`h-10 w-10` desktop 96px frame, `h-12 w-12` mobile 192px band), `role="img"` and an `aria-label` naming the entity so the missing-image state keeps accessible meaning. The refresh overlay remains absolutely positioned above it, unchanged.
- Registered legacy placeholder addresses continue to be treated as missing; a legitimate, unregistered Unsplash photo that is the entity's real picture still renders normally.

## Tests

New `src/components/entity-v4/group5HeaderImage.test.tsx`, registered in `vitest.config.ts`:

- valid picture renders in the preserved frame with the exact wrapper/image classes, desktop and mobile variants;
- raw `image_url` precedence preserved (a different stored metadata photo does not replace it);
- missing → canonical type icon with accessible label; broken (`error` event) → identical icon, no further `<img>`; registered legacy placeholder → icon;
- a legitimate unregistered Unsplash photo still renders as the real picture;
- unknown type → neutral icon; no `/placeholder.svg` and no stock address introduced as a fallback;
- brand entities keep `object-contain` and the `bg-muted` wrapper;
- refresh overlay rules: appears after a genuine load failure for a signed-in person; never appears for a missing source; never appears for a registered legacy placeholder; never appears for a signed-out visitor;
- entity-switch resets: a failed source followed by a valid source restores the real picture and removes the overlay; switching to a different entity id with the same image value (or with no image on either side) clears the overlay too.

## Verification and close-out

Focused tests, full suite, `bunx tsgo --noEmit`, focused lint (pre-existing issues reported separately, not fixed), build log check, and controlled desktop (1280px) and mobile (390px) fixtures of both header variants — authenticated runtime capture is unavailable for this project, so fixtures stand in, as in earlier groups. If the large mobile band reads sparse, only icon size or background tone may be adjusted — never the frame. Then close-out evidence in `docs/verification/entity-image-fallback-inventory.md` and a roadmap line.

Stop after Group 5 for visual approval. Group 6 (admin, the three search/picker files, legacy version-gated entity pages) and the cleanup items stay open; the wider fallback programme is not finished by this group.

# Group 6 — finish the live pickers, retire the old entity pages and the dead rows, migrate admin by image role

Both reviews are right, and I agree with your two decisions. Group 6 should not be one batch: it mixes live user-facing screens, admin screens where a missing picture means something different, and code that is simply no longer used. I already ran the liveness checks they asked for, so this plan states what is true today rather than guessing.

## What the checks found

- The old entity pages are reachable only for internal accounts (`@lovable.dev`) through `?v=1`, `?v=2`, `?v=3`; everyone else always gets V4. There are three of them, not two: v1 lives inside `src/pages/EntityDetail.tsx` itself, v2 is `src/pages/EntityDetailV2.tsx`, and v3 is `src/components/entity-v3/`. You want them retired — agreed, and it removes their old picture behaviour instead of maintaining it.
- `src/components/search/ProductResultItem.tsx` has no importer anywhere in the project. Same for `src/components/recommendations/RecommendationForm.tsx`. Nothing renders either one — so they get retired, not migrated.
- The "add to My Stuff" picker is genuinely live (through the My Stuff filters bar), and the header/search/product-search rows are live in three places. Those two are the real user-facing work.
- The admin area has a dozen picture areas, and they do not all mean the same thing: some show an entity's own picture, others show candidate pictures under review, upload previews and duplicate records. Replacing a broken candidate with a tidy icon would hide exactly the evidence an admin needs, so only the entity's-own-picture slots migrate.

Group 6 therefore runs as four gates, each finished and checked before the next.

## Gate 6A — the two live pickers

- `src/components/search/SearchResultHandler.tsx` — the 48×48 row used by the header search, the search page and the product search page. The "No Image" words and the stock-photo path are both replaced by the same neutral panel with the canonical type icon the rest of the app uses; unknown types get the neutral icon. Frame, rounding, crop, the processing overlay, the text lines, badges and navigation are untouched. Replacing visible text with an icon is recorded as the one deliberate content change, carrying an accessible missing-picture label.
- `src/components/recommendations/EntitySearch.tsx` — the 40×40 rows for both previously-recommended entities and outside search results. The six hard-coded stock addresses go; real sources (a stored picture, and the Google Places photo proxy for places and food) are preserved exactly. Both frames stay 40×40.
- Write path in the same file: when an outside result is picked, the item it builds stores a genuine picture or nothing at all — `image_url: null` exactly, never an empty value, never a stock address. A real picture is preserved; a registered legacy placeholder counts as none; an existing valid picture is never overwritten by a failed lookup.

## Gate 6B — retire the old entity pages (destructive, separately approved)

Only V4 remains. This gate deletes, it does not migrate:

- `src/pages/EntityDetailV2.tsx` and `src/components/entity-v3/` (`EntityV3.tsx`, `EntityV3Header.tsx`) are removed.
- `src/pages/EntityDetail.tsx` keeps only its role as the route for `/entity/...`: the v1 page defined inside it (lines 56–999) is removed along with the version branching, so the file simply renders V4 with its existing loading wrapper. Everything V4 needs stays; imports that only the old page used are removed.
- `src/utils/entityVersionUtils.ts` and its callers go with the branching; the `?v=` and `?preview=true` overrides stop existing, so any such link just shows the normal entity page.
- Before deleting, I confirm no other file imports anything from the removed code, and that the entity route, its child-slug route, and the slug-redirect behaviour still work.

Because this permanently removes code, I will show the exact file list and wait for your go-ahead at this gate rather than deleting as part of a larger step.

## Gate 6C — dead rows retired

`src/components/search/ProductResultItem.tsx` and `src/components/recommendations/RecommendationForm.tsx` are removed after a final proof of zero importers (including tests and lazy imports). If anything unexpected turns up referencing them, they stay and are recorded instead.

## Gate 6D — admin, classified by image role

Each admin picture slot is labelled first, then only the entity's-own-picture ones move to the shared contract:

- Migrating: `AdminEntitiesPanel`, `AdminEntityManagementPanel`, `ParentEntitySelector` (both slots), `ClaimReviewModal`, `AdminClaimsPanel`, `SuggestionReviewModal`, `AdminSuggestionsPanel`, `entity-create/ExactUrlDuplicateDialog`, `entity-create/DuplicateConfirmDialog`.
- Not migrating, recorded with the reason: `entity-create/ImageCandidateGrid` and `AutoFillPreviewModal` (candidate pictures and upload previews under review — a broken candidate must keep looking broken), plus any image-health or diagnostic display found during the classification.

## Deliberately outside Group 6

- `EntityTabsContent` child cards — they omit the picture area entirely when there is no picture, and a present-but-broken picture can still fall through to a stock photo. Correct policy: missing stays omitted, broken uses the icon inside the already-rendered area. That is a behaviour nuance in optional regions and gets its own small plan after Group 6, not a bolt-on here.
- Accepted layout exceptions: `MyStuffItemCard`, `EntityProductsCard`.
- Permanently excluded: `EntityDetailSkeleton` (loading is not missing), location-search photography, profile covers, avatars and initials.
- Post-Group-6 cleanup, unchanged: `ImageWithFallback` disposition (it still serves non-entity images, so it is reshaped or split, not deleted), legacy stock-helper deletion once zero callers are proven, the optional historical database cleanup, the `getOptimalEntityImageUrl` resolver decision, and the final inventory audit.

## Technical details

- Every migrated slot renders through the existing shared pieces — `useEntityImageFallback` + `getEntityFallbackIcon` — reusing `EntityCollectionImage` where a caller-controlled renderer fits; no new fallback component.
- Source precedence preserved per surface as in Group 4: slots already calling `getOptimalEntityImageUrl` keep passing the whole entity; slots reading `image_url` directly pass only `{ id, image_url }`, so a stored metadata photo can never displace the picture shown today.
- `ImageWithFallback` with its `entityType` / `fallbackSrc` stock retry is dropped from migrated slots only; unused imports (`getEntityTypeFallbackImage`, `EntityType`) are removed where they become dead.
- In `EntitySearch.tsx` the `getImageUrl` helper keeps the stored picture and the Places proxy and loses only the type-keyed stock `switch`, returning `null`; the `fallbackSrc={getImageUrl({})}` arguments disappear with it.
- Every fallback element carries `role="img"` and an `aria-label` naming the entity. Registered legacy placeholder addresses still count as missing; a legitimate, unregistered Unsplash photo that is a surface's real picture still renders normally. One real request, no stock request.

## Tests

- New `src/components/search/group6LivePickers.test.tsx` (6A) and `src/components/admin/group6AdminThumbnails.test.tsx` (6D), both registered in `vitest.config.ts`: frames and image classes preserved verbatim; precedence preserved per surface using an entity with both a raw picture and a different stored metadata photo; missing → canonical icon with accessible label; broken → identical icon and no second request; registered placeholder → icon, its address absent from output; unknown type → neutral icon; a legitimate unregistered Unsplash photo still renders; the "No Image" text is gone.
- Write-path coverage extending `src/hooks/useEntitySearchWritePaths.test.tsx`: outside result with a real picture → preserved; with none → `image_url: null` exactly; with a registered placeholder → `null`; an existing valid picture never overwritten.
- 6B: the entity route and child-slug route still render V4, and a `?v=1|2|3` link renders the normal page rather than failing.
- 6C: no import of the retired files remains.

## Verification and close-out

Per gate: focused tests, full suite, `bunx tsgo --noEmit`, focused lint (pre-existing issues reported, not fixed), build log check, and controlled desktop (1280px) and mobile (390px) fixtures of the migrated row frames — authenticated and admin runtime capture is unavailable for this project, so fixtures stand in as in earlier groups. Then close-out evidence in `docs/verification/entity-image-fallback-inventory.md` and roadmap lines, including the retirement records and the admin role classification table.

Stop for approval after 6A, again before the deletions in 6B, and at the end of 6D. The wider programme is not finished by Group 6 — the optional-region nuance and all the cleanup items above remain open.

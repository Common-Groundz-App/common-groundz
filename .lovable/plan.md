# Post-Group-6 cleanup (gated, one step at a time)

## 6E audit result
6E is in place: the child tab cards use the shared rules, the old helper and stock lookup are gone from that file, and the tests are registered.

One leftover was found next to it. **EntityProductsCard** (recorded as a "no picture area" exception) still uses the old helper, so a broken product picture would swap in a stock photo. It turns out nothing in the app shows this card any more, so it is dead code rather than a live exception. It moves to step 1 for removal. The exception record is corrected in the notes. Earlier evidence is not rewritten.

## Step 1: remove dead picture code (this approval)
- Delete `EntityProductsCard` after a zero-caller check covering imports, lazy loading and tests.
- `EntityRelatedCard` stays, because the sidebar shows its "Coming Soon" card. Only its unused picture-helper import, which serves commented-out example code, is removed. Nothing visible changes.
- **Stop.**

## Step 2: old picture helper (`ImageWithFallback`)
After step 1 it is only used where the picture is not an entity's own: profile cover, review upload previews, location search photos, and three admin "judge the picture" screens.
- Remove its built-in stock photo and type-to-stock lookup, and remove its second-attempt retry.
- Each caller keeps what it passes today. A caller that passes nothing on failure keeps its frame and shows nothing inside it.
- Before coding, I show you a per-screen table of what each one shows on failure today and after the change. Profile covers and location photos stay exactly as they look now if they pass their own fallback.
- **Stop.**

## Step 3: old stock-photo lists
Delete `getEntityTypeFallbackImage` (in both copies), `getCategoryFallbackImage`, `getRecommendationFallbackImage`, and the Unsplash maps, **one at a time**, only after each one has zero callers. The legacy-placeholder registry stays, because it is how we recognise old saved stock links. Any helper still used by a write path is replaced with `null` there, per the write rules.
- **Stop.**

## Step 4: optional database tidy-up (needs your separate yes)
- Read-only count of entities whose `image_url` exactly matches a registered stock link, with a sample list shown to you.
- Only if you approve: back up the ids and links, then set exactly those to `null`. A recount confirms that nothing else changed.
- Nothing changes on screen, because the app already treats these as missing.

## Step 5: central rule decision, then final inventory
- Decide whether `getOptimalEntityImageUrl` should also skip registered placeholders. Default recommendation: leave it unchanged, because every screen already goes through the shared contract.
- Final inventory: every picture area is marked as migrated, a deliberate exception (loading skeleton, avatars and initials, location photos, profile covers, judge-the-picture admin screens, MyStuffItemCard) or retired.

## Technical details
- Step 1 proof: `rg` for the symbol across src (imports, `lazy(`, tests, vitest config), then delete, then tsgo, full suite, build log.
- Step 2 file: `src/components/common/ImageWithFallback.tsx`. Callers: ProfileCoverImage, ImageUploader, LocationSearchInput, AutoFillPreviewModal, ImageCandidateGrid, SearchEntryPanel. Tests cover no fallback → no stock request, a caller-provided fallback is used once, and no retry.
- Step 3 files: `utils/urlUtils.ts`, `services/entityTypeHelpers.ts`, `utils/fallbackImageUtils.ts`, `utils/imageUtils.ts`, `utils/entityImageUtils.ts`. Also check the imports in `use-entity-search`, `entityOperations`, `enhancedEntityService`, `imageMigrationService` and `use-entity-refresh`, plus the comment in `reviewDisplayType.ts`.
- Each step records its notes in `docs/verification/`, the inventory and the roadmap.

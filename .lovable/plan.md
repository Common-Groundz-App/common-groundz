# Entity fallback migration — prerequisites and one proof surface

## Clarified current behavior

### My Stuff screenshot

The screenshot is **My Stuff → Saved**, rendered by `SavedEntityCard`, not `MyStuffItemCard`.

- `SavedEntityCard` always keeps its existing 64×64 rounded image frame.
- Madagascar Centella Travel Kit has `image_url = null` and canonical type `product`.
- The visible bag is the card’s current local Product fallback.
- Missing and broken images are still inconsistent there: missing shows the bag, while a broken URL goes through `ImageWithFallback` and can become an Unsplash image.

`MyStuffItemCard` is a different surface under **My Items** and profile Stuff. It removes its entire 16:9 image region when no image exists. That separate surface will remain unchanged for now.

### Entity page screenshot

There is no separate large desktop banner. The image beside the title is the **responsive header image** rendered by `EntityHeader`.

- Desktop: 96×96 rounded square beside the title.
- Mobile: the same slot intentionally becomes full-width and 192px tall above the title. This is the approved mobile design and will not be changed.
- Madagascar Centella Travel Kit has no stored image, so `EntityV4` currently substitutes the Product Unsplash fallback before rendering. The shoes image visible in the screenshot is that fallback, not a real entity image.
- Because this image slot is prominent on mobile and its error path also controls the refresh-image action, only the fallback content choice remains separately gated. “Responsive header image” replaces the misleading “hero” label.

## Approved policy

- Stop saving stock/Unsplash fallback URLs as entity images. If no real image exists, persist `null`.
- At display time, treat only exact known hard-coded legacy fallback URL identities as missing. Do not classify all Unsplash URLs as placeholders.
- During this proof phase, do **not** change `getOptimalEntityImageUrl` globally. Legacy-placeholder recognition is introduced behind the new shared fallback contract and consumed only by `EntityImage` and the Group 1 proof surface until each broader caller group is migrated.
- Do not clean existing entity rows in this phase.
- Preserve `SavedEntityCard`’s fixed 64×64 frame; migrate it in a later card group so missing and broken both use the canonical Product icon.
- Leave `MyStuffItemCard` unchanged for now because adding an image region would alter its layout.
- Keep the responsive entity header image separately gated for later visual review.
- Keep suspected unused helpers until zero active callers and re-exports are proven after migration.

## Scope approved now

### Group 0A — shared fallback contract

- Extract the existing 15-type canonical local icon mapping from `EntityImage` into a shared resolver.
- Unknown or malformed types resolve to the neutral generic icon, never Product or Place.
- Add shared source/failure state keyed by entity and resolved source so missing and broken images have the same outcome and state resets when the source changes.
- Preserve `EntityImage`’s current circular appearance and behavior.
- Do not touch `ImageWithFallback` in this proof phase; its broad retry/fallback behavior remains for later approved surface groups.

### Group 0B — source hygiene

- Trace and verify every active entity-creation write path before editing, including the quick-create path and any database function it invokes.
- Replace known write-time stock fallbacks with `null`; preserve genuine external or stored images.
- Add a centralized exact legacy-placeholder registry using normalized URL identity so query parameters do not defeat recognition.
- Treat only directly identifiable known placeholders as missing. A copied stock image stored under a new Supabase Storage URL cannot safely be identified from its URL alone and will not be guessed or removed.
- Do not wire that legacy-placeholder recognition into all current `getOptimalEntityImageUrl` callers during this phase; broad display-time behavior changes happen only in their approved migration groups.
- Record every entity-creation/write path changed, and verify one representative path for each changed category where a safe test fixture exists.
- No database row cleanup, schema change, or generated-type edit.

### Group 1 — one low-risk proof surface

Migrate only the selected entity chip in `UnifiedEntitySelector`:

- keep its existing 20px circular frame, pill dimensions, spacing, typography, remove control, navigation, and accessibility;
- keep valid real images visually unchanged;
- attempt the resolved real source once, then switch directly to the local fallback on failure;
- make missing and broken images show the shared canonical local icon;
- verify unknown types use the neutral icon and source changes clear stale failure state.

## Verification and stop gate

- Focused tests for all 15 canonical mappings, unknown types, exact legacy URL recognition, legitimate Unsplash preservation, missing/broken parity, and source reset.
- Verify changed write paths persist `null` only when no real image exists.
- Report any additional server-side writer discovered during tracing instead of silently expanding implementation scope.
- Verify the legacy-placeholder registry does not change unapproved surfaces that already call `getOptimalEntityImageUrl`.
- Verify the selected chip at desktop and mobile sizes with no layout shift.
- Run the full test suite, typecheck, focused lint, and preview build.
- Stop for approval before any list thumbnail, Saved card, grid, carousel, responsive header, admin, helper deletion, or data-cleanup work.

## Explicitly unchanged

Every existing image frame’s dimensions, aspect ratio, shape, border radius, object-fit, spacing, position, surrounding layout, navigation, and accessible labeling, including the responsive entity header’s mobile full-width 192px design. `ImageWithFallback`, `MyStuffItemCard`, `SavedEntityCard`, the responsive entity header image, all broad surface migrations, database contents, and suspected dead helpers are not changed in this phase.

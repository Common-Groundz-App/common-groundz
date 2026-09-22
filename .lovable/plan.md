# Group 2B — relationship and recommendation thumbnails

## Scope

Migrate only these four entity-image slots to the existing shared fallback contract:

1. `EntityChildrenCard` child rows
2. `EntitySidebar` parent row
3. `EntitySidebar` related rows
4. `RecommendationEntityCard` entity thumbnail

No card/grid/header/admin migration begins in this group.

## Required decision: `EntityChildrenCard` parent-image substitution

### Current source precedence

For each child row, the current code resolves images in this exact order:

```text
1. Child real image through getOptimalEntityImageUrl(child)
2. Parent real image through getOptimalEntityImageUrl(parentEntity)
3. Remote stock image selected from the child's type
4. ImageWithFallback may perform its existing retry/fallback behavior after a load error
```

`getOptimalEntityImageUrl` itself prefers a stored photo from metadata, then `image_url` (including legitimate external or proxy URLs).

### Evidence and classification

The only explanation in the component calls this “fallback image using parent if needed.” No product copy, relationship registry, caller, or test documents the parent photo as intentional child identity or relationship context. Both live callers pass the current entity as the parent solely to render its child list. The same component separately inherits the parent description when the child description is absent, but that does not establish a product requirement for image inheritance.

**Proposed decision:** classify parent-image substitution as a fallback shortcut, not intentional product behavior. Group 2B will therefore change child rows to:

```text
child real image → canonical icon for child type
                 → neutral icon for unknown/malformed child type
```

The parent image will no longer appear as the child's image. Approving this plan explicitly approves that source-rule change. If this decision is not approved, Group 2B must pause and the child-row rule must be revised before implementation.

## Implementation

### 1. Entity child rows

- Use the child entity with `useEntityImageFallback` and `getEntityFallbackIcon`.
- Attempt the resolved child image once; missing, registered legacy-placeholder, or broken images converge on the same local child-type icon.
- Remove parent-image substitution only under the approved decision above.
- Preserve the existing 48×48 frame, `rounded-md`, `object-cover`, row spacing, text, ratings, badges, click behavior, arrow control, and accessible labels exactly.

### 2. Entity sidebar parent row

- Resolve the parent through the shared contract instead of reading `parentEntity.image_url` directly.
- Preserve the 48×48 `rounded-lg` frame, existing inner padding, and `object-contain` behavior for real images.
- Missing/broken/registered-placeholder sources use the canonical parent-type icon; unknown types use the neutral icon.
- Preserve the row click destination, text, arrow, spacing, and current accessibility behavior.

### 3. Entity sidebar related rows

- Resolve each related entity through the shared contract instead of raw `image_url || '/placeholder.svg'`.
- Preserve the 32×32 `rounded` frame and `object-cover` behavior for real images.
- Missing/broken/registered-placeholder sources use the canonical related-entity type icon; unknown types use the neutral icon.
- Preserve row navigation, ratings, labels, spacing, and current accessibility behavior.

### 4. Recommendation entity thumbnail

- Resolve the recommended entity through the shared contract.
- Preserve the 64×64 `rounded-md` frame and `object-cover` behavior for real images.
- Replace only the entity first-letter fallback with the canonical entity-type icon; unknown types use the neutral icon.
- Do not alter the separate recommender `ProfileAvatar` elements or any user initials.
- Preserve card navigation, analytics, attribution, ratings, text, spacing, and current accessibility behavior.

## Technical boundaries

- Reuse `useEntityImageFallback` and `getEntityFallbackIcon`; do not add another type map or shared visual wrapper.
- Add small file-local thumbnail components where needed so hook state is isolated per row and resets when entity/source changes.
- Keep each existing outer frame and real-image classes unchanged. Center the local icon inside that same frame at a proportional size without changing dimensions, radius, crop, spacing, or layout.
- One real-source attempt, then a local icon. No remote stock fallback, `/placeholder.svg`, entity initials, parent-photo substitution, or second request.
- Remove only imports made obsolete in the two migrated files; do not delete shared legacy helpers while other callers remain.
- Leave `getOptimalEntityImageUrl`, `ImageWithFallback`, the canonical registry, database rows, write paths, schema, and generated types unchanged.

## Verification

Add focused rendered-output tests covering:

- every slot keeps its exact frame dimensions, radius, and real-image crop mode;
- valid child, parent, related, and recommendation images render unchanged;
- missing and broken sources produce the same canonical icon;
- exact registered legacy placeholders produce the canonical icon;
- unknown/malformed types produce the neutral icon;
- switching from entity A with a failed image to entity B with a valid image resets failure state;
- a child with no image does not render the parent's valid image;
- recommendation user avatars/initials remain unchanged;
- existing click destinations and analytics wiring remain unchanged.

Run the focused tests, full Vitest suite, type check, focused lint, and preview build. Verify representative desktop and mobile views when accessible; if authentication blocks live capture, use controlled rendered fixtures and report that limitation plainly. Record the source-rule decision and Group 2B evidence in the existing inventory and roadmap.

## Explicit exclusions

Do not change:

- `EntityTabsContent` child cards or `EntityRelatedCard` commented image code
- `RelatedEntitiesSection`
- Saved or My Stuff cards
- review, chat, or broader recommendation cards
- carousels, explore grids, entity headers, admin, or version-gated legacy pages
- user/profile avatars or initials
- dimensions, shapes, crop modes, spacing, navigation, keyboard markup, or accessibility behavior
- shared/global image resolution, `ImageWithFallback`, database content, or legacy-helper cleanup

Stop after Group 2B verification and present the affected views for visual approval. Do not begin any later migration group.

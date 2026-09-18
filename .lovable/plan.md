# Phase 5.0C — Review-post rating only

## Decision

Skip Phase 5.0B. The reviewed cards already have balanced, compact spacing after 5.0A.

Implement Phase 5.0C only, then stop for visual approval. This is not approval for 5.1–5.4.

## Verified starting point

- The shared `PostFeedItem` now owns the post-type badge on feed and detail surfaces.
- The shared card does not currently receive or render `structured_fields` on home, entity, hashtag, or related-post reads.
- Post detail already reads `structured_fields` and renders `StructuredFieldsDisplay` below the shared card.
- `StructuredFieldsDisplay` currently includes the rating, so adding the rating to the shared card without reconciliation would duplicate it on Review detail pages.
- The existing `ConnectedRingsRating` supports the required read-only compact presentation.
- A Review post's rating is stored locally in `posts.structured_fields.rating`; this is separate from review endorsements and entity-level ratings.

## First implementation action

Update `roadmap.md` to mark 5.0B as explicitly skipped after visual review and 5.0C as the approved active step. Preserve the three-concept boundary between editorial post type, post-local rating, and endorsement truth.

## Implementation

### 1. Carry the existing post-local data to every shared-card source

Add `structured_fields` to the post reads that feed `PostFeedItem`:

- home and following feeds;
- entity posts, including related posts on detail pages;
- hashtag relationship and fallback searches.

Extend the shared `PostFeedItem` type with nullable structured fields and preserve the value through the existing processor. Do not add a migration, RPC, write path, review query, or entity-rating query.

### 2. Render one compact rating row in the shared card

In `PostFeedItem`, derive a valid display rating only when all conditions are true:

- `post_type === 'review'`;
- `structured_fields` is an object;
- `structured_fields.rating` is a finite number;
- the value is between 1 and 5 inclusive.

Render the existing `ConnectedRingsRating` with explicit read-only compact props:

- `size="xs"`;
- `isInteractive={false}`;
- `minimal={true}`;
- `showValue={true}`.

Place it in the existing content flow as:

```text
Header
Title
Rating (valid Review posts only)
Body
Media
Entity chips
Location tags
Actions
```

The rating row must collapse completely when ineligible. Do not create empty spacing for missing or invalid ratings.

### 3. Reconcile post detail deliberately

Keep the shared card as the single owner of the Review rating.

Add a narrow `showRating` option to `StructuredFieldsDisplay`, defaulting to its current behavior elsewhere. On the post detail page, pass `showRating={false}` so the remaining structured Review fields continue rendering while the rating appears exactly once in the shared card.

Also restrict `StructuredFieldsDisplay`'s own rating rendering to Review posts, preventing a stray `rating` key on another editorial type from displaying elsewhere.

## Frozen areas

Do not change:

- the 5.0A header, badge, avatar, identity, timestamp, visibility, or owner menu;
- title or body typography;
- general card spacing beyond the minimum rating-row separation;
- media presentation or the media-before-entity order;
- entity/category/location chips;
- action-row markup, spacing, icons, counts, handlers, authentication gates, or destinations;
- card, profile, or entity navigation;
- composer controls or post writes;
- detail comments or related-post organization;
- review endorsement logic, `reviews.is_recommended`, review timelines, entity aggregates, Circle counts, or recommender counts;
- any database schema, policies, functions, or generated database types.

Recommendation, experience, comparison, question, and tip posts must never show this rating row, even if their stored JSON contains a `rating` key.

## Focused coverage

Add tests for:

- Review with ratings 1, fractional valid values, and 5;
- Review with no rating;
- non-numeric, `NaN`/non-finite, below-1, and above-5 values;
- every non-Review post type with a stray rating key;
- title + rating + body ordering;
- feed/detail exactly-once rating behavior;
- `StructuredFieldsDisplay` retaining all non-rating fields when detail suppresses its rating;
- all feed-producing reads selecting and preserving `structured_fields`.

## Visual and technical verification

Inspect real or controlled Review cards:

- with title and body;
- without a title;
- with and without media;
- with and without entity chips;
- mobile and desktop;
- light and dark mode;
- feed and post detail, confirming one rating only.

Confirm Recommendation cards remain visually identical to the supplied 5.0A screenshots.

Run focused tests, the full Vitest suite, `tsgo --noEmit`, the production build, and the latest preview-log check. Record exact results and screenshots in `docs/verification/phase-5-feed-card.md`.

## Stop gate

Stop after 5.0C verification and present the real Review-card result for visual approval. Do not begin 5.1, extraction, type-specific enhancements, or further spacing work.

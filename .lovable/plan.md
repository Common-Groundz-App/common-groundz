# Phase 5 — Feed card hierarchy and type-aware content

## Goal

Redesign the existing post card into a clearer, more scannable card while preserving every post interaction and the Phase 4 boundary between:

- editorial post types (`experience`, `review`, `recommendation`, `comparison`, `question`, `tip`);
- review endorsement truth (`reviews.is_recommended`);
- entity/Circle recommendation counts.

Implementation proceeds one sub-phase at a time. Each sub-phase is reviewed and closed before the next begins.

## Verified starting point

- `src/components/feed/PostFeedItem.tsx` currently owns the header, title/body, media, entity/location tags, actions, edit/delete dialogs, and both feed/detail behavior in one component.
- The same card renders in the home feed, hashtag pages, Entity V4 posts, the post detail page, and related-post lists.
- The badge currently shares the timestamp line, the main sections have tight spacing, and the feed card has no post-local rating row.
- `posts.structured_fields.rating` is the approved source for review-post rings. However, the main feed query, entity-post query, hashtag-post query, processor type, and `PostFeedItem` interface currently omit `structured_fields`; only the standalone post-detail query reads it.
- Comparison posts already carry their linked subjects through `tagged_entities`. Question framing already exists in `structured_fields` (`options_considered`, `what_matters`, `budget`).
- The detail page currently renders its own post-type badge and `StructuredFieldsDisplay` below `PostFeedItem`; this must be reconciled deliberately to avoid duplicate badges or ratings.
- There are no focused `PostFeedItem` component tests today, so Phase 5 adds them before extraction.

---

## 5.0 — Prototype the hierarchy on the existing card

### Scope

Work directly in `PostFeedItem`; do not create `FeedCardShell` yet.

### Data prerequisite

Add `structured_fields` as a read-only post field everywhere that supplies `PostFeedItem`:

- `src/hooks/feed/api/posts/fetch-posts.ts`
- `src/services/entityPostsService.ts`
- `src/services/hashtagService.ts`
- `src/hooks/feed/types.ts`
- the existing post processor/type path

No query may read `reviews`, review timelines, entity aggregates, or endorsement RPCs for this card.

### Prototype anatomy

1. **Header grid**
   - Keep avatar and identity on the left.
   - Give the right side a stable trailing region containing the post-type badge and owner overflow menu.
   - Allow long display names/handles to wrap or truncate within the identity region without colliding with the trailing controls.
   - Put timestamp, optional `edited`, and non-public visibility on a dedicated second metadata line.
   - Keep `experience` badge behavior consistent with the existing rule: no badge unless the product review explicitly changes that rule.

2. **Content rhythm**
   - Establish conditional spacing between header, title, post-local rating, prose, entity/location context, media, and actions.
   - Render no empty wrappers or fixed-height gaps when a section is absent.
   - Preserve the current three-line feed preview and untruncated detail behavior.
   - Keep text-only cards compact.

3. **Review rating prototype**
   - For `post_type === 'review'`, render `ConnectedRingsRating` only when that post has a valid numeric `structured_fields.rating` in the accepted 1–5 range.
   - Show the numeric value with the non-interactive rings.
   - Render nothing when the field is absent or invalid.
   - Do not infer a rating and do not consult `reviews`, `review_updates`, entities, timelines, aggregates, or recommendation intent.

4. **Entity and media order**
   - Use one explicit order for title/rating/prose/entity context/media/actions, matching the approved anatomy.
   - Keep entity navigation, category hiding, lightbox/video behavior, and media aspect handling unchanged.
   - Remove accidental double media margin by assigning vertical spacing at one ownership boundary only.

5. **Actions**
   - Visually separate the action row without changing like, comment, save, share, authentication gating, counts, or routes.
   - Retain proper icon buttons and accessible names.

6. **Detail-page compatibility**
   - Decide explicitly in code whether the new header/rating anatomy is shared with detail mode or feed-only.
   - If shared, remove the duplicate detail badge and suppress the duplicate rating inside `StructuredFieldsDisplay` while retaining its other structured fields.
   - If feed-only, leave the current detail-only badge and structured field presentation unchanged.
   - Do not alter inline comments or related experiences.

### Tests and evidence

Add focused tests for:

- badge and overflow separation;
- edited/visibility metadata;
- valid review rating;
- absent/invalid review rating;
- no rings for recommendation, experience, tip, comparison, or question posts;
- text-only, media-only, and entity-tagged cards;
- feed truncation versus detail expansion;
- unchanged like/comment/save/share destinations.

Capture representative light/dark and mobile/desktop screenshots in `docs/verification/assets/phase-5/`, and record implementation evidence in `docs/verification/phase-5-feed-card.md`.

### 5.0 gate

Run focused tests, full Vitest, `tsgo --noEmit`, and the production build. Stop for review after the real-card prototype is visible.

---

## 5.1 — Review and approve the card anatomy

### Required visual matrix

Review the real card, not a detached mock, across:

| Dimension | Required cases |
| --- | --- |
| Post type | experience, review with rating, review without rating, recommendation, comparison, question, tip |
| Content | text-only, title-only, media-only, media-heavy, title + long prose |
| Identity | long display name, long username, missing avatar |
| Context | no entity, one entity, multiple entities, long entity names, category shown/hidden, location tags |
| State | edited, public, Circle-only, private, owner menu, liked, saved, non-zero comments |
| Surface | home feed, hashtag feed, Entity V4 posts, post detail, related posts |
| View | narrow mobile, desktop, light mode, dark mode, reduced motion |

### Acceptance criteria

- No overlap between identity, badge, visibility, or overflow controls.
- No clipped badge or action row on narrow screens.
- Text-only cards do not gain unnecessary height.
- Media cards have consistent spacing without duplicated top margin.
- Review rings are immediately scannable but do not dominate the title/body.
- Entity type remains out of the header; category/context stays with its entity chip.
- Keyboard focus, card navigation, nested controls, tooltips, and screen-reader labels remain coherent.
- The existing post-detail content, comments, and related-post sections do not regress.

### Decision record

At this gate, record one of two outcomes in the evidence document:

1. **Shared anatomy approved** — proceed to 5.2 extraction.
2. **Type/surface divergence required** — document which layouts remain separate and why; do not force them into one shell.

Any visual corrections discovered here are made to the prototype before extraction. Stop for explicit anatomy approval.

---

## 5.2 — Extract a shared shell only if earned

### Preconditions

Begin only after 5.1 approves the anatomy and identifies genuinely shared regions.

### Extraction

Create a fresh, presentational `FeedCardShell` from the approved anatomy. It may own only the stable layout zones:

- header identity;
- trailing badge/menu region;
- metadata line;
- title;
- optional type-specific slot;
- prose/body;
- entity/location context;
- media;
- actions.

Keep behavior and data ownership in `PostFeedItem`:

- like/save/comment/share handlers;
- authentication and verification gates;
- edit/delete state and dialogs;
- navigation;
- comment-count loading;
- media/lightbox behavior.

Use typed optional slots/props rather than branching on post type inside the shell. Do not copy or refactor from any retired recommendation card.

### Conditional outcome

If 5.1 proves comparison, question, detail, or another surface genuinely needs a different anatomy, retain a separate renderer or layout variant with an explicit reason. Shared extraction is not a completion requirement by itself; avoiding a false abstraction is acceptable.

### Regression checks

Run the 5.0 component tests against both the prototype behavior and extracted result. Capture before/after screenshots proving visual parity. Run full Vitest, typecheck, and build, then stop for review.

---

## 5.3 — Add explicit per-type slots

### Shared rule

Per-type presentation consumes only fields already on the post and its existing `tagged_entities`. It does not read or write endorsement truth, entity scores, review aggregates, or recommendation counts.

### Type contracts

1. **Review**
   - Slot: non-interactive `ConnectedRingsRating` plus numeric value.
   - Source: only `post.structured_fields.rating`.
   - Valid 1–5 value: render.
   - Missing/invalid value: render no rating slot.
   - Keep all other review structured fields in their existing detail presentation unless separately approved.

2. **Comparison**
   - Slot: compared entities from the post's existing ordered `tagged_entities`.
   - Preserve canonical entity navigation and category rules.
   - Do not synthesize entities from prose or `winner` text.
   - If fewer than two entities exist, fall back to ordinary prose/entity-chip presentation rather than fabricating a comparison.

3. **Question**
   - Slot: concise question framing from existing question fields (`options_considered`, `what_matters`, `budget`) when present.
   - Avoid duplicating identical text already shown in the title/body.
   - Missing structured fields fall back to ordinary prose.

4. **Recommendation, tip, experience**
   - No rating row.
   - Preserve prose, tagged entities, media, and actions.
   - A recommendation post remains a normal post and never contributes to `reviews.is_recommended` or entity/Circle endorsement counts.

### Data and safety assertions

- All feed-producing queries return the same post-local structured data needed by the slots.
- No new state, table, RPC, Edge Function, enum value, composer option, or write path is introduced.
- Existing canonical post types and provider/offering entity vocabulary remain unchanged.
- Add unit/component tests for each type, malformed structured data, sparse content, and no cross-type leakage.

### 5.3 gate

Review all six types again on mobile/desktop and light/dark. Run focused tests, full Vitest, typecheck, and build. Stop for approval.

---

## 5.4 — Final verification and close-out

### Runtime verification

Verify on every live card surface:

- home feed;
- hashtag results;
- Entity V4 posts tab;
- standalone post detail;
- related-experience lists.

Exercise:

- card navigation and keyboard activation;
- profile/entity links without triggering card navigation;
- owner overflow actions;
- like, comment, save, and share;
- image/video opening and return behavior;
- edited and visibility metadata;
- review rating presence/absence;
- all six post types.

### Accessibility and responsive checks

- semantic heading order remains valid on feed and detail pages;
- icon controls have names and visible focus states;
- nested interactive controls do not trigger the card link;
- text and controls do not overlap at narrow widths;
- contrast works in light/dark modes;
- reduced-motion behavior remains respected.

### Technical verification

- Full Vitest suite.
- `tsgo --noEmit`.
- Production build and newest preview build log.
- Browser console/runtime/network check on the exercised surfaces.
- Repository sweep proving no generic star rating was introduced and no Phase 4 legacy route/table dependency returned.
- Confirm no card code reads `reviews.is_recommended`, review timelines, entity aggregate ratings, or endorsement-count RPCs.

### Close-out

Complete `docs/verification/phase-5-feed-card.md` with:

- exact files and behavior changed per sub-phase;
- screenshot matrix;
- test/typecheck/build results;
- any intentionally separate layouts from the 5.1 decision;
- preservation checks for recommendation posts, endorsements, Entity V4 counts, and Circle surfaces.

Only then mark 5.0–5.4 and the Phase 5 parent complete in `roadmap.md`.

---

## Non-negotiable boundaries

- Do not change `reviews.is_recommended` or its resolver/trigger path.
- Do not connect review posts to the reviews system.
- Do not derive ratings from entities, reviews, timelines, recommendations, or inference.
- Do not add or widen a Postgres enum.
- Do not change composer type choices or post write behavior.
- Do not change Entity V4 recommending/from-Circle counts or the “Recommended by Your Circle” card.
- Do not reintroduce any retired standalone-recommendation table, routine, route, or notification path.
- Do not use generic stars; use the existing connected-rings component.
- Do not begin a later sub-phase before the current gate is approved.

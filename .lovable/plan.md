# Phase 5 — Incremental feed-card polish

## Direction

The current card anatomy is already good. Phase 5 will polish the real `PostFeedItem` in small, separately approved steps—not prototype or reconstruct the card.

The only planned visual changes are:

1. clearer header hierarchy;
2. subtle spacing improvements;
3. the post author’s own rating on review posts.

Like, comment, save, share, media behavior, navigation, entity behavior, composer behavior, and Phase 4 recommendation semantics remain unchanged.

## Verified starting point

- `PostFeedItem` is shared by the home feed, hashtag results, Entity V4 posts, related-post lists, and post detail.
- The post-type badge currently sits on the timestamp line.
- The current body order is **title → prose → media → entity chips → location tags → actions**.
- The detail page renders a second post-type badge and `StructuredFieldsDisplay`, whose rating would duplicate a rating added to the shared card.
- Feed, entity, and hashtag post reads currently omit `structured_fields`; the detail read already includes it.
- There are no focused automated tests for `PostFeedItem` today.

## First implementation action

Update `roadmap.md` to record Phase 5.0A–5.4 and the boundary that editorial post types, review-post ratings, and review endorsements are three separate concepts. Keep Phase 2.5B deferred.

Then implement **5.0A only** and stop.

---

## 5.0A — Header hierarchy only

Implement directly on the real shared card.

### Changes

- Move the post-type badge into a protected trailing region beside the overflow menu.
- Keep the avatar, display name, and username in the leading region.
- Put timestamp, optional `edited`, and non-public visibility on their own second metadata line.
- Ensure long display names and usernames cannot overlap or displace the badge/menu.
- Share this new header anatomy with detail mode.
- Remove the separate duplicate post-type badge from the detail page.
- Preserve the existing rule that `experience` has no badge.

### Frozen areas

Do not change:

- title, prose, media, entity chips, location tags, or their order;
- action-row layout, icons, counts, handlers, authentication gates, or destinations;
- card navigation, profile/entity links, owner-menu behavior, or detail comments;
- any query or stored data.

### Verification and stop gate

- Add focused header tests covering badge placement semantics, owner/non-owner menu state, edited/visibility metadata, and long identity text.
- Inspect the two supplied card cases, a long-name mobile case, desktop, dark mode, and post detail.
- Run focused tests, full Vitest, `tsgo --noEmit`, and the production build.
- Record screenshots and results in `docs/verification/phase-5-feed-card.md`.
- Stop for visual approval before 5.0B.

---

## 5.0B — Spacing polish only

Begin only after 5.0A is approved.

### Changes

Tune only the vertical rhythm between sections that actually exist:

- header → title/body;
- title → body;
- body/media → entity context;
- final content section → actions.

Use conditional gaps so absent sections create no empty space. Keep text-only cards compact.

### Explicit ordering rule

Preserve the current order exactly:

```text
Header
Title
Body
Media
Entity chips
Location tags
Actions
```

The review rating added later in 5.0C may sit between title and body, but **media must remain before entity chips**. Phase 5.1 will not reconsider this order.

### Frozen areas

- Do not alter the action row itself; only the separation before it may change outside the row.
- Do not alter media sizing, aspect handling, lightbox/video behavior, borders, or placement.
- Do not alter entity-chip styling, category rules, or navigation.
- Do not alter typography beyond what is strictly necessary to prevent overlap from 5.0A.

### Verification and stop gate

Compare text-only, title-only, media-heavy, entity-tagged, and sparse cards on mobile/desktop and light/dark. Run focused tests, full Vitest, `tsgo --noEmit`, and the production build; update the evidence document and stop for approval.

---

## 5.0C — Review-post rating only

Begin only after 5.0B is approved.

### Read-only data plumbing

Add `structured_fields` to every post read that supplies the shared card:

- main feed query;
- entity-post query;
- hashtag-post queries;
- `PostFeedItem` type and existing processor path.

This is read-only frontend data propagation. It adds no migration, RPC, write path, state, or review lookup.

### Rating contract

Render the existing non-interactive `ConnectedRingsRating` with its numeric value only when:

- `post_type === 'review'`; and
- `structured_fields.rating` is a finite number from 1 through 5.

Placement is **title → rating → body**. Missing, non-numeric, below-1, or above-5 values render nothing.

Never render this row for experience, recommendation, comparison, question, or tip posts.

### Detail-page reconciliation

The shared card header and rating anatomy also apply in detail mode.

- The separate detail badge is removed in 5.0A.
- The shared card owns the review rating.
- `StructuredFieldsDisplay` keeps every other detailed field but must support suppressing its rating so detail pages show exactly one rating.
- Related-post cards use the same shared rules.

### Semantic boundary

The card may read only that post’s `structured_fields.rating`. It must not read or infer from:

- `reviews` or `reviews.is_recommended`;
- review timelines or updates;
- entity ratings or aggregate statistics;
- Circle/recommender counts;
- recommendation intent or recommendation-post type.

### Verification and stop gate

Test valid and invalid ratings, review without rating, every non-review type, feed/detail non-duplication, and all feed-producing query paths. Review mobile/desktop and light/dark screenshots. Run focused tests, full Vitest, `tsgo --noEmit`, and the production build; update evidence and stop for approval.

---

## 5.1 — Cross-card visual acceptance

Review the finished small changes on the real application.

### Required cases

- the supplied CeraVe text review;
- the supplied perfume recommendation with media;
- review with and without rating;
- text-only and title-only cards;
- media-heavy card;
- one and multiple entity chips;
- long display name and username;
- edited, public, Circle-only, and private metadata;
- owner and non-owner cards;
- home, hashtag, Entity V4, related posts, and post detail;
- narrow mobile, desktop, light mode, dark mode, and reduced motion.

### Acceptance criteria

- Identity, badge, and menu never overlap.
- Timestamp/edited/visibility read as metadata, not as part of the badge.
- Text-only cards remain compact.
- Media remains before entity chips.
- The existing action row looks and behaves exactly as before.
- Review ratings are visible only when valid and never duplicate on detail pages.
- No regressions in media, entity/profile links, card navigation, comments, or owner actions.

### Decision gate

If the card now solves the visual problem, stop visual development and proceed directly to 5.4.

Do not create architecture or type-specific presentation merely because it appeared in an earlier roadmap.

---

## 5.2 — Optional extraction, only if justified

This phase is skipped unless 5.1 identifies concrete duplication or maintainability risk caused by the approved changes.

If justified, create a small presentational extraction only for proven shared header/rating layout. It must produce no visual or behavioral change. Keep interaction state and handlers in `PostFeedItem`.

Do not create a broad `FeedCardShell` unless the 5.1 evidence demonstrates a real need and the extraction materially clarifies multiple shared regions.

Run focused tests, full Vitest, `tsgo --noEmit`, and the production build; prove screenshot parity and stop for approval.

---

## 5.3 — Deferred type-specific enhancements

Question- and comparison-specific sections are not part of the current visual problem and are deferred by default.

Only plan or implement them later if a separate review identifies a concrete user-facing deficiency and approves the desired presentation first. Recommendation, tip, and experience remain ordinary prose posts; no type receives a rating except review.

Skipping 5.3 is an acceptable Phase 5 outcome and is not incomplete work.

---

## 5.4 — Final verification and close-out

### Runtime checks

On home, hashtag, Entity V4, related-post, and post-detail surfaces, verify:

- card, profile, and entity navigation;
- owner overflow menu;
- like, comment, save, and share unchanged;
- image/video behavior unchanged;
- edited and visibility metadata;
- review rating presence/absence and no detail duplication;
- all six post types.

### Accessibility and responsive checks

- keyboard and screen-reader behavior remains coherent;
- icon controls retain accessible names and visible focus;
- nested controls do not trigger card navigation;
- long text and controls do not overlap at narrow widths;
- light/dark contrast and reduced motion remain valid.

### Technical close-out

- Run the full Vitest suite, `tsgo --noEmit`, production build, and latest preview-log check.
- Check browser console, runtime, and network signals on exercised surfaces.
- Sweep the repository to prove no generic star rating or Phase 4 legacy dependency was introduced.
- Confirm no card code reads endorsement truth, review timelines, entity aggregate ratings, or recommender-count RPCs.
- Complete `docs/verification/phase-5-feed-card.md` with exact changes, screenshots, results, and any intentionally skipped optional phases.
- Mark only completed/explicitly skipped Phase 5 tasks in `roadmap.md`.

## Non-negotiable boundaries

- Preserve the current media-before-entity-chips order.
- Preserve the action row’s layout and behavior exactly.
- Preserve media presentation and behavior.
- Preserve entity/category presentation and navigation.
- Preserve composer options and post writes.
- Do not change or connect to `reviews.is_recommended`.
- Do not change Entity V4 recommending/from-Circle counts or the “Recommended by Your Circle” card.
- Do not add/widen database enums or reintroduce retired recommendation objects.
- Use connected rings, never generic stars.
- Implement one approved sub-phase at a time and stop at every gate.

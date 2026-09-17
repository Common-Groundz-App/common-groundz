# Phase 5 — Incremental feed-card polish

## Direction

The current post card is structurally good. Phase 5 is a controlled polish pass, not a redesign.

The next approved work should be only the smallest visible change: moving the post-type badge out of the timestamp line and into the top-right header area. After that, we inspect the real app before deciding whether any spacing or rating work is still needed. Spacing polish and review ratings are independently optional future decisions; neither is automatically approved by 5.0A, and skipping spacing does not block a later rating decision.

## Verified starting point

- `PostFeedItem` is shared by the home feed, hashtag results, Entity V4 posts, related-post lists, and post detail.
- The post-type badge currently sits on the timestamp line.
- The current body order is **title → prose → media → entity chips → location tags → actions**.
- The detail page separately renders another post-type badge, so the shared header change must avoid duplicate badges there.
- Feed, entity, and hashtag post reads currently omit `structured_fields`; this matters only for a later review-rating step, not for 5.0A.

## First implementation action after approval

Update `roadmap.md` to record Phase 5.0A–5.4 and the boundary that editorial post types, review-post ratings, and review endorsements are three separate concepts. Keep Phase 2.5B deferred.

Then implement **5.0A only** and stop.

---

## 5.0A — Badge placement only

Implement directly on the real shared `PostFeedItem`.

### The only intended visual change

Move the post-type badge from the timestamp line to the right side of the header, beside the overflow menu:

```text
Before
Name @handle                         ⋮
Date · edited  [Review]

After
Name @handle                [Review] ⋮
Date · edited
```

### Required header contract

- When a badge or owner menu exists, place those controls in a right-side trailing region.
- If a card has neither a badge nor an owner menu, do not reserve an empty trailing region.
- Avatar stays fixed and must not shrink.
- Preserve the current `UsernameLink` rendering and existing display-name/username wrapping or truncation behavior.
- Constrain only the available identity layout region as minimally as needed to prevent collision with the badge/menu.
- Do not introduce new one-line truncation or wrapping behavior unless the first implementation proves it is required to protect the trailing controls.
- The trailing badge/menu region must not be pushed off-screen or overlapped by long names.
- Preserve current avatar size, identity typography, timestamp typography, and overall header density unless the smallest possible adjustment is required to prevent collision.
- The purpose is hierarchy and placement, not a header restyle.
- Preserve the existing rule that `experience` has no badge.

### Detail-page badge reconciliation

The new shared header applies in detail mode too.

- Remove the separate duplicate detail-page post-type badge once the shared header shows the badge.
- Do not change detail structured fields, comments, related posts, or rating behavior in 5.0A.

### Frozen areas

Do not change:

- title;
- body/prose;
- media;
- entity chips;
- location tags;
- body ordering;
- action-row layout, spacing, icons, counts, handlers, auth gates, or destinations;
- card navigation;
- profile/entity links;
- owner-menu behavior;
- queries or stored data;
- review ratings.

### Verification and stop gate

- Add only focused header coverage needed for badge placement, edited/visibility metadata, owner/non-owner menu state, and long identity text.
- Inspect the two supplied card cases, one long-name mobile case, desktop, dark mode, and post detail.
- Run focused tests, full Vitest, `tsgo --noEmit`, and the production build.
- Record screenshots and results in `docs/verification/phase-5-feed-card.md`.
- Stop for visual approval before any spacing or rating work.

---

## 5.0B — Optional spacing polish, independently approved after 5.0A

This phase starts only if the 5.0A screenshots show that spacing still needs polish and the change is explicitly approved. Skipping 5.0B does not block a later 5.0C rating decision.

### Allowed changes

Tune only external vertical spacing between existing sections that actually render:

- header → title/body;
- title → body;
- body/media → entity context;
- final content section → actions.

Use conditional gaps so absent sections create no empty space. Keep text-only cards compact.

### Ordering rule

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

Media must remain before entity chips. Phase 5.1 will not reconsider this order.

### Action-row freeze

The action row’s markup, internal classes, button spacing, icon sizing, handlers, and behavior are frozen. 5.0B may change only the external top separation applied by the surrounding card layout, if needed.

### Verification and stop gate

Compare text-only, title-only, media-heavy, entity-tagged, and sparse cards on mobile/desktop and light/dark. Run focused tests, full Vitest, `tsgo --noEmit`, and the production build; update evidence and stop for approval.

---

## 5.0C — Optional review-post rating, independently approved after 5.0A

This phase starts only if review ratings are explicitly approved after seeing the real 5.0A result. It may happen whether 5.0B was completed or skipped.

### Read-only data plumbing

Add `structured_fields` to every post read that supplies the shared card:

- main feed query;
- entity-post query;
- hashtag-post queries;
- `PostFeedItem` type and existing processor path.

This adds no migration, RPC, write path, state, or review lookup.

### Rating contract

Render the existing `ConnectedRingsRating` only when:

- `post_type === 'review'`; and
- `structured_fields.rating` is a finite number from 1 through 5.

Use explicit display props:

- `isInteractive={false}`;
- `minimal={true}`;
- `showValue={true}`;
- the approved compact size.

Do not add a separate numeric value if `ConnectedRingsRating` already renders it correctly.

Placement is **title → rating → body**. Missing, non-numeric, below-1, or above-5 values render nothing.

Never render this row for experience, recommendation, comparison, question, or tip posts.

### Detail-page rating reconciliation

The shared card owns the review rating if 5.0C is implemented.

- `StructuredFieldsDisplay` should get an explicit prop such as `showRating={false}` on the detail page.
- Rating suppression must be narrow and opt-in; do not strip rating globally.
- `StructuredFieldsDisplay` should also be review-only when it renders its own rating elsewhere.
- Detail pages must show exactly one rating.

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

Review the real application after the approved small steps.

### Required cases

- the supplied CeraVe text review;
- the supplied perfume recommendation with media;
- text-only and title-only cards;
- media-heavy card;
- one and multiple entity chips;
- long display name and username;
- edited, public, Circle-only, and private metadata;
- owner and non-owner cards;
- home, hashtag, Entity V4, related posts, and post detail;
- narrow mobile, desktop, light mode, dark mode, and reduced motion.

If 5.0C was implemented, also review review posts with and without rating.

### Acceptance criteria

- Identity, badge, and menu never overlap.
- Timestamp/edited/visibility read as metadata, not as part of the badge.
- Text-only cards remain compact.
- Media remains before entity chips.
- The existing action row looks and behaves exactly as before.
- No regressions in media, entity/profile links, card navigation, comments, or owner actions.
- If review ratings were added, they appear only when valid and never duplicate on detail pages.

### Decision gate

If the card now solves the visual problem, stop visual development and proceed directly to 5.4.

Do not create architecture or type-specific presentation merely because it appeared in an earlier roadmap.

---

## 5.2 — Optional extraction, only if justified

Skip this phase unless 5.1 identifies concrete duplication or maintainability risk caused by the approved changes.

If justified, create a small presentational extraction only for proven shared header/rating layout. It must produce no visual or behavioral change. Keep interaction state and handlers in `PostFeedItem`.

Do not create a broad `FeedCardShell` unless evidence demonstrates a real need.

Run focused tests, full Vitest, `tsgo --noEmit`, and the production build; prove screenshot parity and stop for approval.

---

## 5.3 — Deferred type-specific enhancements

Question- and comparison-specific sections are deferred by default.

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
- post-type badge placement;
- all six post types.

If 5.0C was implemented, also verify review rating presence/absence and no detail duplication.

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
- If 5.0C was implemented, confirm no card code reads endorsement truth, review timelines, entity aggregate ratings, or recommender-count RPCs.
- Complete `docs/verification/phase-5-feed-card.md` with exact changes, screenshots, results, and any intentionally skipped optional phases.
- Mark only completed/explicitly skipped Phase 5 tasks in `roadmap.md`.

## Non-negotiable boundaries

- 5.0A changes badge placement only.
- Preserve current avatar sizing, identity typography, timestamp typography, header density, and identity wrapping/truncation behavior unless minimally necessary to prevent collision.
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

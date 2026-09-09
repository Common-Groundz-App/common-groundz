# Phase 4 — retire the old standalone recommendation feature; Phase 5 — the feed card

## Decisions, up front

**1. Retire the old standalone recommendation feature. Yes.**
Since Phase 3, recommending is an answer inside a review (explicit answer → later timeline answer → rating as fallback → stored flag on the review). The old separate recommendation record duplicates that with weaker evidence, splits counts and rankings, and is dormant: 9 rows, all from one account, newest 2025-05-20, five not even linked to an entity. Keeping it means maintaining two answers to "who recommends this?".

**2. The "recommendation" post type stays. Untouched.**
Your reasoning is the correct product call, and both reviewers agree. A post type is an editorial label for what a piece of writing *is*. "I recommend pairing this with X" or "only in colder weather" is a real kind of writing; it is not a structured claim about an entity and must never touch the recommend flag, counts, trust or ranking. Three separate things, written down as a rule:

```text
OLD "Recommend this place"  → legacy form + old table   → REMOVE
NEW "Recommendation" post   → ordinary post, label only → KEEP, untouched
Review recommend answer     → the only endorsement truth → KEEP, untouched
```

Same for `review` posts: prose labelled "Review", not an entry in the reviews system. Connecting those two is a possible future phase, deliberately not this one.

**3. Not every old signal becomes the review flag.** (Correction accepted.)
Only *endorsement* maths moves to the review flag: "N people recommend this", circle recommendation counts, entity recommendation ranking. Routines that were using recommendation likes/comments as *engagement* — reputation, similarity, who-to-follow, feed ranking — need their own decision each: replace with post engagement, replace with review data, or simply drop the input. Mechanical substitution would silently change what those numbers mean.

**4. Verified: review posts do have their own rating.** (Correction accepted, and answered.)
`structured_fields.rating` exists on posts, is review-specific, and is populated: of 4 review posts, 3 carry a rating. So rings on a review post can render *that post's own number* — no review lookup, no inference, no duplicate state. Where a review post has no rating, the row simply doesn't render.

**5. No rings on recommendation posts.** Confirmed — recommendation, tip and experience are prose; no rating row at all.

**6. Card redesign is Phase 5, and starts as a prototype, not a component.** (Correction accepted.)
Establish the visual grammar on the real card first, check it across every type and edge case, and only then extract a shared shell if the abstraction has earned itself. The old card is a design reference; it is welded to the legacy schema and its own delete behaviour, so it is never the new base.

**7. Would moving the badge to the top-right fix the spacing? It helps most, but no.**
Comparing your screenshots, the old card breathes because every idea owns a zone with real space between zones. The post card stacks title, body and chips with almost none, so the badge move alone still leaves it tight. Also worth separating two things that look alike: the orange "Place" is an *entity* type, the green "Review" is a *post* type. Only the post type belongs in the corner — it tells you what you're reading.

All data being dummy means no permanent legacy viewer for 9 fake rows. Staging still matters, but for the dependency graph, not for preservation.

---

## Phase 4 — retire the standalone recommendation feature

### What exists today (verified read-only)

Data: 9 rows, one author, newest 2025-05-20, 4 linked to an entity; 20 likes, 17 comments, 3 saves, 16 notifications referencing them; 6 of 78 reviews carry a historical link plus a "converted" flag. Category is a database enum with five values; the TypeScript enum invents seven more that can never be stored — dead vocabulary.

Creation: both entity detail pages and the feed compose button.
Readers: entity pages, profile recommendations tab, the recommendation detail view, search results, notification targets, the legacy branch in the feed item renderer.
Server: ~12 routines mention recommendations (trending, reputation, similarity, who-to-follow, personalized entities, circle discovery, like/comment notification triggers), some touching both sources.
Already correct: the entity page's "who recommends this" reads only reviews with the flag set.

### 4.0 — Audit and capture (read-only; deliver, then stop)

- Read every one of the ~12 routine bodies. For each, record whether it truly reads the old table or merely has "recommendation" in its name, and classify its **semantic replacement**: endorsement → review flag; engagement → post engagement; obsolete → drop. Flag any that mix both sources.
- Inventory every screen reading the old records; decide per screen: switch to reviews, or delete.
- Classify the third concept explicitly: confirm `posts.post_type='recommendation'` feeds no endorsement logic anywhere (composer, badge, feed, counts) and record the boundary rule above.
- Trace every creation entry point to its actual destination. Anything that does not write to the old table is out of scope, whatever its label says.
- Design capture: screenshot the old card; document its spacing rhythm, zones, badge treatment, rating placement, media handling — plus its faults (excessive height, badge disconnected from entity context, title duplicated by the entity chip, thin action row, text-only cards inheriting too much empty space).
- Confirm the rating finding above still holds at implementation time.
- Output: `docs/verification/phase-4-recommendations-audit.md` with per-item classification (NEW SYSTEM / LEGACY BUT REQUIRED / LEGACY DEAD / SEPARATE FEATURE), per-routine replacement decisions, and the design notes.
- **Gate: deliver 4.0 and stop. Nothing is removed until the audit is reviewed.**

### 4.1 — Stop legacy creation only

- Remove only entry points whose destination is the legacy form / old table.
- Acceptance: the unified composer still offers the Recommendation post type, still creates it, and a test proves creating one changes no review flag, count or ranking. Identify targets by destination, never by visible label.
- The old form and write service stay in the tree, unreferenced, for one step so reverting is trivial.

### 4.2 — Endorsement truth becomes single-source

- Apply 4.0's per-consumer decisions: endorsement maths reads only the review flag; engagement inputs get their own replacement or removal.
- Recommendation posts appear in normal post feeds like any other post, and count toward nothing endorsement-related.
- Record before/after numbers per affected surface so nothing shifts silently beyond the known 9 rows. Routine changes go through migrations, grouped logically.

### 4.3 — Remove the legacy layer and its dummy data together

Merged deliberately: removing the detail route while notifications still point at it would ship a broken link. (Correction accepted.)

- Delete the legacy form, its create/update/delete service, the legacy feed branch, the detail route and viewer, the profile tab, the search result type, and the dead category enum and its hand-written maps — per the audit's LEGACY DEAD list.
- In the same step, delete the 9 rows and their dependent likes, comments, saves and notification rows in foreign-key-safe order.
- Clear the historical link column **and** the matching "converted" flag on the 6 affected reviews together, so no review claims a conversion it can no longer name.
- No permanent read-only history renderer is built.

### 4.4 — Verify zero dependencies

Search for any remaining reference in code, routines, policies, triggers and indexes. Full test suite, typecheck, build, evidence appended to the audit doc.

### 4.5 — Schema removal (separately approved)

A separate reviewed migration drops the recommendation tables, the category enum, the historical link and converted columns, and the obsolete routines, triggers, policies and indexes. Never bundled into 4.3.

---

## Phase 5 — the feed card (after Phase 4)

### 5.0 — Prototype the hierarchy, no new architecture yet

Apply spacing and header hierarchy to the existing post card directly:

1. post-type badge to the top-right beside the overflow menu, in a defined trailing region so long names can't collide;
2. timestamp (and "edited") on its own second header line;
3. real space between header and content;
4. a rating row for review posts that have their own rating;
5. space before the entity chips;
6. space before the action row;
7. consistent media spacing.

```text
┌──────────────────────────────────────────────┐
│ [av] Rishabh Sr @rishab.devp    REVIEW    ⋮  │
│      Sep 7, 2026 · edited                    │
│                                              │
│ cerave moisturizer                           │
│                                              │
│ ◎◎◎◎○  4.0                                   │
│                                              │
│ This is a test review for this moisturizer   │
│                                              │
│ [ Aestura Atobarrier365 Cream ] [ CeraVe ]   │
│                                              │
│              optional media                  │
│                                              │
│ ♡ 1     comment     save            share    │
└──────────────────────────────────────────────┘
```

Entity type stays out of the header; if useful at all it sits beside the entity chip.

### 5.1 — Review the prototype across every case

Text-only, media-heavy, review, recommendation, question, comparison, tip, long username, long title, many chips, narrow mobile, dark mode. Text-only cards must not become needlessly tall. Screenshots side by side with the preserved reference. **Gate: agree the card anatomy here.**

### 5.2 — Extract the shared shell only if the prototype earned it

`FeedCardShell` owning header / title / type slot / body / entity context / media / actions, spacing defined once. Built fresh from the design notes, never refactored out of the legacy component. If 5.1 shows comparison or question genuinely need different layouts, keep them separate and say so.

### 5.3 — Per-type slots

- `review` → connected rings + rating, sourced **only** from that post's own structured rating; render nothing when absent. No review lookup, no entity aggregate, no inference, no timeline query, no new rating state.
- `comparison` → the compared entities. `question` → question framing.
- `recommendation`, `tip`, `experience` → no rating row; prose.
- Rule enforced here: nothing in this layer reads or writes endorsement truth.

### 5.4 — Verification

Responsive, accessibility, dark mode, and the full check suite.

---

## Technical notes

- The old category enum is never widened; Postgres enum additions can't be cleanly reversed.
- Post types are untouched in Phase 4 — no composer, badge or type-list changes.
- Canonical entity types and the provider/offering registry remain the single vocabulary source.
- Ratings use the existing connected-rings component; never generic stars.
- Each step ends with the full Vitest suite, `tsgo --noEmit`, a production build, and evidence in the audit doc.
- On approval, first action: rewrite `roadmap.md` — replace "Phase 4 recommendations taxonomy alignment" with 4.0–4.5, add Phase 5.0–5.4, and record the three-concept boundary rule. Phase 2.5B stays deferred. Then implement 4.0 only and stop.

## Out of scope

- The review recommend model (Phases 3C/3D) — untouched.
- Connecting `review` post types to the reviews system — a possible future phase, not now.
- Dropping any schema object outside the separately approved 4.5.

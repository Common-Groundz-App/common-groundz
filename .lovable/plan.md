# Phase 4 — retire the old standalone recommendation feature; Phase 5 — unify the feed cards

## Answers to your questions, up front

**1. Should the old standalone recommendation system be retired? Yes.**
Since Phase 3, recommending is an answer inside a review (explicit answer → later timeline answer → rating as fallback → stored flag on the review). The old separate recommendation record duplicates that with weaker evidence, splits counts and rankings, and is dormant: 9 rows, all from one account, newest 2025-05-20, five of them not even linked to an entity. Keeping it means maintaining two answers to "who recommends this?".

**2. Is the "recommendation" post type the same thing? No — and I agree with you, it stays.**
Codex is right that `posts.post_type` still includes `recommendation`, and right that this needed to be named. But your reasoning is the correct product call: a post type is an editorial label for what a piece of writing *is*. "I recommend pairing this with X" or "I recommend this only in colder weather" is a genuine kind of writing; it is not a structured claim about an entity and must never feed `is_recommended`, counts, trust or discovery. So:

- Post types (`experience`, `review`, `recommendation`, `comparison`, `question`, `tip`) — keep all of them, untouched, as labels only.
- The review recommend logic — untouched, and remains the only source of recommendation truth.
- The old standalone recommendation record — retired.

The one thing worth doing is writing that boundary down as a rule, so nobody later wires a "recommendation" post into recommendation counts. Same for `review` posts: they are prose labelled "Review", not entries in the reviews system. You're right that a future phase may connect those two; that is not this plan.

**3. Where does the card redesign go? A separate Phase 5, after Phase 4.**
I agree with both reviewers here. Phase 4 changes *which content models exist*; the card work should target the final set, not adapters that are about to be deleted. Mixing a database retirement with a visual redesign also makes regressions much harder to isolate.

But one piece of the card work belongs *inside* Phase 4: before the old card component is deleted, capture its design (screenshots, spacing, hierarchy notes). Preserve the ideas, not the component — that component is welded to the old data shape, its own delete behaviour and fallback images.

**4. Would moving the post type badge to the right fix the spacing? It helps, but no.**
Your instinct about the header is right and it is the single biggest win. But comparing your three screenshots, the reason the old card breathes is that every idea has its own zone with real space between zones: author / type, title, rating, body, entity, media, actions. The post card currently stacks title, body and chips with almost no separation, so the badge move alone leaves it tight. Also worth separating two things that look alike: the orange "Place" on the old card is an *entity* type, while the green "Review" on the post card is a *post* type. Only one of them belongs in the top-right corner — the post type, since that is what tells you what you're reading.

**5. Connected rings on review posts in the feed? Yes — in Phase 5.**
A review that doesn't show its rating in the feed is hiding its most scannable fact. One caution: show the rating, and only add "Recommends" wording where the answer is genuinely a yes and already loaded with the card. Never fetch per-card timeline history to work out provenance — that is the N+1 rule we already hold.

All data being dummy simplifies things: no permanent legacy viewer is needed for 9 fake rows, 20 fake likes and 17 fake comments. Retirement still happens in verifiable stages, but the end state can be genuinely clean rather than a museum.

---

## Phase 4 — retire the standalone recommendation feature

### What exists today (verified read-only)

Data: 9 rows, one author, newest 2025-05-20, 4 linked to an entity; 20 likes, 17 comments, 3 saves, 16 notifications referencing them; 6 of 78 reviews carry a historical link. Category is a database enum with only five values; the TypeScript enum invents seven more (Drink, Activity, Music, Art, TV, Travel, Brand) that can never be stored — dead vocabulary.

Creation entry points: both entity detail pages and the feed compose button.
Readers: entity pages, profile recommendations tab, the recommendation detail view, search results, notification targets, and the legacy branch inside the feed item renderer.
Server side: ~12 database routines mention recommendations (trending, reputation, similarity, who-to-follow, personalized entities, network/circle discovery, like/comment notification triggers), some touching both the old table and the review flag — the double-counting risk.
Already correct: the entity page's "who recommends this" list reads only reviews with the recommend flag set.

### 4.0 — Audit and capture (read-only)

- Read every one of the ~12 routine bodies; record whether it truly reads the old table or merely has "recommendation" in its name. Flag any that mix both sources.
- Inventory every screen that reads the old records; decide per screen: switch to reviews, or delete.
- Include the third concept explicitly: confirm `posts.post_type = 'recommendation'` is label-only and feeds no recommendation logic anywhere (composer, badge, feed, counts). Write that boundary down as a rule.
- Design preservation: screenshot the old recommendation card, and document its spacing rhythm, zone hierarchy, badge treatment, rating placement, media handling — plus its weaknesses (excess vertical space, badge disconnected from the entity, title duplicated by the entity chip, thinner action row). This is Phase 5's reference.
- Output: `docs/verification/phase-4-recommendations-audit.md` with a per-item classification (NEW SYSTEM / LEGACY BUT REQUIRED / LEGACY DEAD / SEPARATE FEATURE) and the design notes.
- Gate: nothing is removed before this document exists.

### 4.1 — Stop new creation

- Remove the three creation entry points; where "Recommend" used to appear, point to the review flow on the same subject.
- The old form and write service stay in the tree, unreferenced, for one step so reverting is trivial.

### 4.2 — Single-source discovery

- Every routine or query that counts or ranks recommendations reads only the review flag.
- Record before/after counts for each affected surface so nothing changes silently beyond the known 9 rows. Routine changes go through migrations, grouped logically.

### 4.3 — Remove the legacy application layer

- Delete the recommendation form, its create/update/delete service, the legacy feed branch, the recommendation detail route and its viewer, the profile recommendations tab, the search result type, and the `RecommendationCategory` enum plus its hand-written maps — per the audit's LEGACY DEAD list.
- Since the content is dummy, no permanent read-only history renderer is built.
- Notification rows pointing at recommendations are handled in 4.4, not left dangling.

### 4.4 — Remove the dummy data

- Delete the 9 rows and their dependent likes, comments, saves and notification rows, in foreign-key-safe order. Dummy data makes deletion acceptable; it does not make dangling references acceptable.
- Clear the historical link column on the 6 affected reviews.

### 4.5 — Schema removal (separately approved)

- Only once zero consumers remain: a separate reviewed migration drops the recommendation tables, the category enum and the historical link column. Not bundled into 4.4.

---

## Phase 5 — unified feed card (after Phase 4)

### 5.0 — Prototype the hierarchy

Work from the 4.0 design notes. Start with the smallest set of changes and evaluate before rewriting anything:

1. post-type badge moves to the top-right, beside the overflow menu, with a defined trailing region so long names can't collide with it;
2. timestamp (and "edited") drops to its own second header line;
3. real space between header and content;
4. a rating row for review posts;
5. space before the entity chips;
6. space before the action row;
7. consistent media spacing, full-width where appropriate.

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

Entity type is not shown in the header; if it is useful at all it sits next to the entity chip.

### 5.1 — Shared shell

A new `FeedCardShell` owning header / title / type-specific slot / body / entity context / media / actions, with the spacing rhythm defined once. Built fresh from the design notes, not refactored out of the old component.

### 5.2 — Per-type slots

- `review` → connected rings + rating, using the existing rings component (never generic stars).
- `comparison` → the compared entities.
- `question` → question framing.
- `recommendation`, `tip`, `experience` → no special slot; they are prose labels.
- Rule enforced here: nothing in this layer reads or writes recommendation truth, and no card issues its own timeline query.

### 5.3 — Verification

Responsive checks (long names, many chips, narrow screens), text-only posts not becoming needlessly tall, dark mode, accessibility, and side-by-side screenshots against the preserved reference.

---

## Technical notes

- The old category enum is never widened; Postgres enum additions can't be cleanly reversed.
- Post types stay exactly as they are in Phase 4 — no composer, badge or type-list changes.
- Canonical entity types and the provider/offering registry remain the single vocabulary source; no card or service restates category lists.
- Each step ends with the full Vitest suite, `tsgo --noEmit`, a production build, and evidence appended to the audit doc.
- On approval, first action: rewrite `roadmap.md` — replace "Phase 4 recommendations taxonomy alignment" with 4.0–4.5 above, add Phase 5.0–5.3, and record the post-type boundary rule. Phase 2.5B stays deferred.

## Out of scope

- The review recommend model (Phases 3C/3D) — untouched.
- Connecting `review` post types to the reviews system — a possible future phase, deliberately not now.
- Dropping any schema object outside the separately approved 4.5.

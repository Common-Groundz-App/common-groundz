# Phase 4.2A verification, then Phase 4.2B

## 4.2A verification result — complete, no leftovers in its scope

Checked directly in the database, not from notes:

- Every routine 4.2A promised to migrate now contains **no** read of the old recommendations
  table: fallback recommendations, the active Circle discovery routine, Circle rating,
  Circle counts (single + batch), the Circle activity gate, and both global count routines.
- The new recommender routine exists with the agreed shape (caller-privileges, so normal
  access rules apply) and is owned by the database owner, like every other touched routine.
- Recorded evidence matches: 78 reviews / 58 recommended / same checksum, fixture proof
  3 raw rows → 2 people → average 3.0, 633 tests, clean typecheck and build.

Nothing from 4.2A is outstanding. What still reads the old data belongs to 4.2B, 4.3 and 4.5,
exactly as the roadmap says — and the audit below found one item that was previously listed
under "counts" but is actually a **visible entity number**, so it moves to the front of 4.2B.

## What still reads the old recommendations data (audited this turn)

Live and user-visible:

1. Entity stats used by the entity page tabs and the post detail sidebar — the
   "recommendations" number literally counts old rows, and the average rating mixes old
   ratings in with review ratings.
2. The Explore user directory — each person's recommendation count is a raw count of old rows.
3. Feed "new content" polling — asks whether new old-style records appeared.

Live but scoring/discovery (the declared 4.2B core):

4. Trending score calculation and its candidate selection.
5. User similarity, social influence, user reputation, "who to follow", personalised entities.
6. The client discovery pipelines: collaborative filtering, social intelligence, advanced
   personalisation, and the enhanced discovery service that fans out to them.

Dead (no reachable caller — leave for 4.5 with the other retirements):

7. Two network routines still on the old table but called only by unused service functions,
   plus the old view-increment routine used solely by the legacy service layer.

## Phase 4.2B — plan

Same discipline as 4.2A: freeze the meaning first, migrate per surface, record the number
before and after, no mechanical find-and-replace.

### 4.2B.0 — visible numbers first (items 1–3)

- Entity recommendation count: drop the old-table count entirely and use the already-migrated
  people-based count. Average rating: reviews only, one current review per person, effective
  rating (latest timeline rating when present) — matching the frozen 4.2A selection rule.
- Explore directory count: count people's published public reviews that currently recommend,
  one per person/item, via a batch routine rather than per-row client counting.
- Feed polling: poll experiences (posts) only; the old-record branch is removed.
- Evidence: before/after number for a handful of real entities and users, written down.

### 4.2B.1 — freeze the scoring contract (docs only, no code)

Write `docs/verification/phase-4-2b-scoring-contract.md` stating, per input:
its replacement source, the exact weights/thresholds, sparse-data behaviour, and privacy rule
(no per-person data leaves an aggregate). Inputs: trending, similarity, influence, reputation,
who-to-follow, personalised entities. Gate: agree this before any scoring code changes.

Frozen defaults proposed:
- Endorsement signal everywhere = canonical current review recommends (public + published,
  newest row per person/item).
- Rating signal = effective rating of that same canonical row.
- Volume signals count people, never rows.
- Sparse data returns neutral, never a fabricated boost.
- **Consensus calibration for influence stays out of 4.2B** — it changes ranking meaning and
  deserves its own experiment with the safeguards we discussed (leave-one-out consensus,
  minimum independent raters, symmetric treatment of positive and negative agreement,
  low-variance penalty, modest capped effect). 4.2B only makes influence read review truth.

### 4.2B.2 — migrate the scoring routines

For each routine: replace the body only, keep the signature and returned columns, keep owner
and access rules, then re-measure. Trending needs both its per-entity calculation **and** its
candidate selection updated in the same step, otherwise entities that only have reviews are
never considered.

### 4.2B.3 — migrate the client discovery pipelines completely

Collaborative filtering, social intelligence, advanced personalisation and enhanced discovery
each read the old table directly in several places. Each service is migrated as a whole unit
(all its queries), not partially, so a single pipeline never mixes two sources.

### 4.2B.4 — prove it

- Run every migrated surface with the old table effectively empty as the decisive test: any
  surface that goes blank was still depending on old data.
- Before/after table per surface in the verification doc.
- Full test suite, typecheck and build green; roadmap updated; stop before 4.3.

## Out of scope for 4.2B

Removing the legacy pages, services, route and rows (4.3), the dead routines (4.5), and the
feed card redesign (Phase 5). Review endorsement truth itself is untouched.

# Phase 3 — Config-driven review questionnaire (final plan, revised)

## My verdict on the three inputs

Both critiques are right on the points where they disagree with me, and I accept
all of them. Specifically:

- **Common controls must stay outside the registry** (both raised it). My draft
  listed `rating | media | date | visibility` as field kinds while also saying
  those controls stay in Steps 1/3/4 — two owners for one control. Dropped.
- **`kind: 'tags'` must not mean "FoodTagSelector"** (ChatGPT). The registry
  names a vocabulary (`tagSet: 'food'`); the renderer maps that to the existing
  component. And Codex is factually right that my "renders with the field's
  options" line was impossible: `FoodTagSelector` takes only
  `selectedTags/onAddTag/onRemoveTag` and owns its 13 curated chips. It stays
  exactly as-is, untouched.
- **No generic fallback for a linked-but-unparseable subject type** (Codex).
  That is an invariant failure after Phase 2.4, not a presentation case. Generic
  mode exists only for legacy *unlinked* reviews.
- **Title/venue derivation must follow `subjectOrigin`** (Codex). My draft said
  "title comes from the subject" flatly, which would silently rewrite historical
  linked reviews on a plain re-save — exactly what Phase 2.1 protects against.
- **Versioned answer contract before any new question ships** (both). Correct;
  otherwise the first new question lands in a home we then move.

Where I keep my own position: 3A is *not* pure behaviour parity. Asking "What
did you eat?" after the user picked "Classic Burger at Truffles", and asking for
a restaurant/brand/author the hierarchy already knows, are the bugs Phase 2
created. 3A removes those questions — under the `subjectOrigin` guard above.

One thing neither raised, and I verified it today: `ReviewForm` builds
`metadata = category === 'food' ? { food_tags: foodTags } : undefined` and passes
it straight to `updateReview`, which does a plain column update. So a food edit
**overwrites the whole `metadata` JSONB**, dropping provenance and any other
keys. 3A fixes that by merging.

## Phase 3.0 — Audit (done, recorded)

| Field | Step | Common / type-specific | Persisted | Verdict |
|---|---|---|---|---|
| Rating | 1 | common | `reviews.rating` | stays in the shell |
| Subject | 2 | common | `entity_id` + `category` | stays (Phase 2.4 rules) |
| `foodName` / `contentName` | 3 | 5-bucket branch | `reviews.title` | retired as a question; derived per `subjectOrigin` |
| `venue` (Restaurant/Director/Author/Address/Brand) | 3 | 5-bucket branch | `reviews.venue` | retired as a question; provider context displayed from hierarchy |
| Media | 3 | common | review media | stays in the shell |
| Location permission prompt | 3 | `place`/`food` | none | registry flag `showLocationPrompt` |
| Headline | 4 | common | `reviews.subtitle` | stays in the shell |
| Your thoughts | 4 | common | `reviews.description` | stays in the shell |
| Experience date | 4 | common | `experience_date` | stays in the shell |
| Food tags | 4 | type-specific | `metadata.food_tags` | registry-declared, existing component, merged save |
| Visibility | 4 | common | `visibility` | stays in the shell |

Legacy branching to remove from new-review paths: `ReviewForm` lines ~506, 576–590,
630, 659, 780, 871; the `foodName`/`contentName` pair; `StepThree`'s
`getMainFieldLabel` / `getSecondaryFieldLabel` and its emoji ladders;
`StepFour`'s `category === 'food'` gate.

Naming note to document in code: `reviews.title` = subject identity,
`reviews.subtitle` = the user's headline.

## Phase 3A — Registry + renderer + safe identity cleanup (implement now)

1. **Registry** `src/components/profile/reviews/questionnaire/registry.ts` —
   declarative data, no React. Explicit entry for **all 15** canonical types.
   No `default → product`, no `→ others`. Shape:
   `{ type, subjectLabel, showLocationPrompt, sections: [{ id, title, description?, fields: [{ id, kind, label, placeholder?, helperText?, required, options?, tagSet? }] }] }`
   with `kind` limited to type-specific inputs: `text | textarea | select | multi-select | tags`.
   Common controls are **not** in the registry.
2. **Resolution modes**, explicit and separate:
   - linked + parseable canonical type → that type's config;
   - **legacy unlinked** review → a named `legacyUnlinked` config (no invented
     type-specific questions);
   - linked + unparseable type → **invariant failure**: type-specific sections
     are suppressed and a controlled inline error is shown; never a generic or
     product config.
3. **Renderer** — a `QuestionnaireSection` component mapping `kind` → control,
   with no knowledge of entity types. `tags` + `tagSet: 'food'` routes to the
   existing `FoodTagSelector` (unchanged file, unchanged vocabulary, unchanged
   `metadata.food_tags` contract). No other `tagSet` exists yet.
   **Scope discipline:** the `kind` union is declared broadly, but 3A implements
   only the controls current behaviour actually exercises (the food tag path, plus
   `text`/`textarea` primitives). `select` / `multi-select` land in 3C when the
   approved matrix needs them — no unused form engine built ahead of 3B.
4. **Identity cleanup under `subjectOrigin`**:
   | Context | title / venue |
   |---|---|
   | new linked review | derive title from subject; venue per the snapshot policy below |
   | existing review, subject untouched (`loaded`) | preserve stored values |
   | existing review, subject deliberately replaced (`user-selected`) | derive from the new subject |
   | legacy unlinked | preserve, remain editable |
   Provider/parent context comes from `entityRelationshipRegistry` +
   `getParentEntity`, not a `food` conditional, so product-under-brand works too.
5. **Canonical `reviews.venue` snapshot policy** (explicit, and separate from the
   questionnaire — `reviews.venue` is still read outside the form, e.g.
   `entitySidebarLogic.ts` uses `entity.venue`, and `subjectSelection.ts` already
   derives it per subject shape):
   | Subject context | value written on a new / relinked review |
   |---|---|
   | offering with a resolved provider | provider name |
   | `place` with a useful location/address | subject venue/address |
   | any other standalone canonical type | left empty |
   | untouched existing review | preserve stored venue |
   | legacy unlinked review | preserve, stays editable |
   Author, director, brand and manufacturer are **no longer written to
   `reviews.venue`** — those are entity facts and stay on the entity. The policy
   lives in one helper next to the registry, with a per-type test row.
6. **Metadata safety** — food tags save via a merge, guarded by a plain-object
   check (`existing && typeof existing === 'object' && !Array.isArray(existing)`)
   so arrays/strings/numbers/null never get spread, and provenance plus unrelated
   keys survive an edit. No `metadata.questionnaire` yet.
7. **Validation** driven by the registry's `required` flags, returning structured
   errors and focusing the first invalid field, replacing the
   `foodName`/`contentName` checks. Step 1 rating and Step 2 subject rules stay
   exactly as Phase 2.4 left them.
8. **Invalid linked subject blocks the wizard** — an unparseable type on a linked
   subject is an *unusable subject*, not an empty questionnaire. That resolution
   mode participates in step navigation and submit validation: Next and Submit are
   blocked with the inline error, and the user is pointed back to Step 2 to pick a
   valid subject. It must never be a questionnaire with zero required fields that
   silently saves.
9. **Compatibility-state boundary (3A vs 3D)** — in 3A, canonical linked flows no
   longer render or validate name/venue inputs, and `reviews.title` is written
   through the single identity-persistence helper. The old `foodName` /
   `contentName` / `venue` state may survive internally **only** on the
   legacy-unlinked edit path, and `questionnaireKind` may still load old behaviour
   but must not select a questionnaire for a canonical type. 3D renames that state
   to an explicitly named legacy-unlinked adapter and deletes the rest. No
   ambiguous `foodName`/`contentName` variable drives a canonical save in the
   interim.
10. **Unchanged in 3A**: four steps, step order, wizard layout, no new questions,
   `reviews.category` semantics, legacy unlinked editing.
11. **Tests**: 15 explicit configs; no fallback to product/others/generic for a
   linked subject; legacy-unlinked mode selected only when `entity_id` is null;
   food config yields the existing tag UI with its current chips; title derivation
   table above, one case each; venue snapshot policy per type; invalid linked
   subject blocks navigation and submit; metadata merge preserves foreign keys and
   refuses to spread non-objects; registry validation blocks/allows correctly.


**Then stop for your manual verification across all 15 types.**

## Phase 3B — Content matrix + answer schema approval (no UI code)

Full 15-type matrix in the decision-useful style you preferred — "Would you
order/buy/watch it again?", "Would you recommend it?", "What stood out?", "Best
for whom?" — not platform/format metadata. Every new question optional in v1;
rating and subject remain the only required inputs. Nothing that duplicates
entity facts (director, author, brand, address, organizer). Delivered together
with the frozen answer schema:

```json
{ "questionnaire": { "version": 1, "type": "course",
  "answers": { "would_recommend": "yes", "worth_the_time": "yes" } } }
```

`metadata.food_tags` and provenance keys stay at the root — not migrated just
because Phase 3 exists.

## Phase 3C — Implement questions against versioned persistence (one slice)

Render, persist, load, and validate the approved fields in the same phase, with:
unknown future answer keys preserved untouched; unrelated metadata merged;
reviews without `questionnaire.version` opening in legacy compatibility and never
silently converted; deliberate subject replacement switching to the current
questionnaire for the new type.

## Phase 3D — Legacy cleanup

Remove `questionnaireKind` and the five-bucket branches from new-review paths,
drop obsolete `foodName`/`contentName` state, keep only the narrow
legacy-unlinked adapter, and confirm backend consumers of `reviews.category` are
unaffected. `reviews.category` itself stays.

## After Phase 3 — layout refinement (and revisit 2.5B)

Only once real section and field counts exist: 3-vs-4 steps, section merging,
progressive disclosure, mobile polish.

## Out of scope throughout

Phase 2.5B remediation; any DB migration, new column, or backfill; deleting,
genericising, or restyling `FoodTagSelector`; new provider/offering
relationships added just to feed a form field; storing React components in the
registry.

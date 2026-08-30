# Phase 3 — Config-driven review questionnaire (final plan)

## My read on the two reviews

Both agree on the same architecture, and it matches what I proposed: canonical
`entity.type` → questionnaire registry → sections/fields, with no `if (category
=== 'food')` left in the wizard. The differences worth keeping:

- **Codex is right on sequencing and safety**: build the registry + renderer at
  behaviour parity first (3A), verify all 15 types, and only then add new
  questions. Its two hardest rules are things my plan under-specified:
  namespaced/versioned answers (`metadata.questionnaire.{version,type,answers}`)
  and **not asking for entity facts** — no "What did you eat?", "Product name",
  "Director", "Brand", "Address" once a subject is selected.
- **ChatGPT is right on content**: its per-type questions ("Would you order it
  again?", "Rewatch?", "Worth the time?") are decision-useful and on-brand
  (transitions, reuse intent) in a way Codex's context-only matrix is not. So we
  use Codex's structure with ChatGPT's question set as the 3B input.

Where I differ from both: 3A must not be a pure refactor. Two current fields are
actively wrong once a subject is mandatory (`foodName` / `contentName` asking for
the subject's own name, and `venue` asking for the parent that the hierarchy
already knows), so 3A removes those questions rather than faithfully porting
them.

**Food tags stay.** `FoodTagSelector` (curated chips + custom tag input) is good
UI and keeps its hardcoded food vocabulary. In 3A it becomes the renderer for the
`tags` field kind, wired only into the `food` questionnaire — same component,
same options, same `metadata.food_tags` storage. No other type gets tags in 3A.

## Phase 3.0 — Audit (already done, recorded here)

Current Step 3 / Step 4 fields and where they live:

| Field | Step | Common or type-specific | Persisted to | Phase 3 verdict |
|---|---|---|---|---|
| Rating | 1 | common | `reviews.rating` | keep as-is |
| Subject (entity) | 2 | common | `reviews.entity_id` + `category` | keep as-is |
| `foodName` / `contentName` ("What did you eat?", "Movie title"…) | 3 | five-bucket branch | `reviews.title` | **retire as a question**; title derives from the subject |
| `venue` ("Restaurant name", "Director/Studio", "Author", "Address", "Brand") | 3 | five-bucket branch | `reviews.venue` | **retire as a question**; show parent/provider context read-only, keep column written from subject context |
| Media | 3 | common | review media | keep |
| Location prompt (`place`/`food` only) | 3 | type-specific | none (permission) | registry flag `showLocationPrompt` |
| Review headline | 4 | common | `reviews.subtitle` | keep |
| Your thoughts | 4 | common | `reviews.description` | keep |
| Experience date | 4 | common | `reviews.experience_date` | keep |
| Food tags | 4 | type-specific (`food`) | `metadata.food_tags` | keep component + storage, driven by registry |
| Visibility | 4 | common | `reviews.visibility` | keep |

Legacy branching to remove: `ReviewForm.tsx` lines ~506, 576–590, 630, 659, 780,
871 (`category === 'food'`), the `foodName`/`contentName` pair, `StepThree`'s
five emoji/label/placeholder ladders and `getMainFieldLabel` /
`getSecondaryFieldLabel`, and `StepFour`'s `category === 'food'` gate.

Edit-mode behaviour that must not regress: `subjectOrigin` ('none' | 'loaded' |
'entity-page' | 'user-selected') still decides whether `reviews.category` is
rewritten on save, and legacy unlinked reviews still open and save.

## Phase 3A — Registry + renderer at behaviour parity (implement now, then stop)

1. **Registry** — `src/components/profile/reviews/questionnaire/registry.ts`:
   declarative data only, no React. Explicit entry for **all 15** canonical
   types; no `default: product`, no fallback to `others`. Shape:
   `{ type, subjectLabel, showLocationPrompt, sections: [{ id, title, fields: [{ id, kind, label, placeholder, helperText, required, options }] }] }`
   with `kind` in `text | textarea | select | multi-select | tags | date | rating | visibility | media`.
   An unresolvable subject type gets a named `generic` config (common fields
   only), flagged as generic — never a product config.
2. **Renderer** — a `QuestionnaireSection` component that maps `kind` → control
   and knows nothing about entity types. `tags` renders `FoodTagSelector`
   (unchanged) with the field's options.
3. **Wire Step 3 / Step 4** to the registry; delete the label ladders and the
   food conditionals. Step 3 keeps the read-only subject preview and adds the
   parent/provider context line already computed by `getParentEntity`.
4. **Subject-derived values**: `reviews.title` comes from the selected subject's
   name; `reviews.venue` from the resolved parent/provider (unchanged for legacy
   unlinked reviews, which keep their stored values).
5. **Validation** from the registry (`required` fields, structured errors,
   focus the first invalid field) replacing the `foodName` vs `contentName`
   checks. Rating (Step 1) and subject (Step 2) rules stay exactly as Phase 2.4
   left them.
6. **Tests**: registry completeness across all 15 types; no config resolves to
   product/others by fallback; food config still yields the tag selector with
   the current vocabulary; validation blocks/allows per config; edit-mode
   `subjectOrigin` persistence unchanged.

**Stop here for your manual verification of all 15 types before 3B.**

## Phase 3B — Content matrix (after 3A verification)

Encode ChatGPT's per-type questions, all **optional** in v1 (rating + subject
remain the only required inputs). No question that duplicates entity metadata
(director, author, brand, manufacturer, address, organizer). Food keeps its tag
system and gains the offering-aware framing ("Classic Burger at Truffles").
The exact matrix comes back to you for approval before coding.

## Phase 3C — Versioned answers, legacy compatibility, cleanup

- Answers stored namespaced: `metadata.questionnaire = { version: 1, type, answers }`.
  Existing `metadata.food_tags` and provenance keys are preserved at the root.
- A review without `metadata.questionnaire.version` opens in legacy
  compatibility mode — read, never silently rewritten. Deliberate subject
  replacement switches it to the current questionnaire for the new type.
- Remove `questionnaireKind` / the five legacy buckets from new-review paths.
  `reviews.category` stays (backend consumers depend on it).

## Out of scope

- Phase 2.5B legacy remediation — deferred, as you asked.
- Any wizard layout redesign or 3-vs-4-step decision (that comes after 3C, once
  real section and field counts are known).
- Any DB migration or per-answer column; no data backfill.
- Deleting or genericising `FoodTagSelector`.

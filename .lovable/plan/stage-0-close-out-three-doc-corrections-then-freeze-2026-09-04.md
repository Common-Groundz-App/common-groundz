# Stage 0 close-out: three doc corrections, then freeze

I agree with all three points. They are cheap now and expensive after ids ship. Two notes on the review itself, verified against the repo:

- The "Freeze tag ids only after this file is corrected and the lint test passes" sentence is **not** in the current corrected document — that wording belonged to the pre-Stage-0 revision. So there is nothing to remove; what's missing is an explicit statement of when validation happens. Option B is right, and no docs validator exists today.
- `roadmap.md` already lists the Stage 0 contracts (all six ticked) and Stage 0 has touched docs only — no migration, no registry edit, no runtime code.

## Changes to `docs/phase-3b-tag-vocabularies.md` (docs only)

1. **Sentiment reclassification** — move three tags from `neutral` to `negative`:
   - `place.hard_to_find`
   - `brand.limited_range`
   - `professional.hard_to_book`

   Rationale to add to the sentiment rule: `neutral` means the trait is a genuine plus for some people (crowded, slow burn, challenging, fast-paced, premium pricing, subscription required); friction that nobody prefers is `negative` even when mild. Everything else keeps its current sentiment.

2. **Precise food wording** — replace "food asks `would_recommend` + `repeat_intent` + Food Tags + `portion` and nothing else" with: food has **no additional type-specific questionnaire fields** beyond `would_recommend`, `repeat_intent`, the existing Food Tags and `portion`; the common review-shell fields (rating, headline, thoughts, media, experience date, visibility) still apply, as they do for every type.

3. **Validation contract** — add a short "Freeze and validation" section stating: Stage 0 freezes this specification manually; no docs validator exists and none will be built; Stage 2 adds a registry lint test that asserts the shipped registry matches **this** frozen document exactly (every id, sentiment and per-type count), and any divergence is a Stage 2 bug, not a spec change.

## Not changing

Labels, emojis, tag counts, the overlap-removal decisions, `best_for` scope, and composite `(type, field id, tag id)` identity all stay exactly as they are.

## After the edit

Update `roadmap.md` only if needed to reflect that Stage 0 is frozen, then stop. Stage 1 remains strictly database/security/resolver work — no questionnaire UI.

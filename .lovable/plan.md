## Status of Phase 1.8c.2

The plan as approved was implemented fully and correctly:

- All 16 approved fields are present on `AmazonGuardExtendedDiagnostics` (anchor metadata, token counts, bucketed overlap, anchor-source enum, JSON-LD presence booleans, grounding counts, canonical-DP flag).
- Salted hash samples (`anchor_token_hash_sample`, `model_name_token_hash_sample`, `overlap_hash_sample`) are gated on `ENTITY_DIAG_HASH_SALT` ≥ 16 chars; omitted otherwise; capped at 5; sha256(SALT+":"+token).slice(0,12).
- Amazon-only emission, non-Amazon traces unchanged, no behavior/guard/parser/model/Zod/merge/V1/frontend/DB changes.
- 12 tests in `phase_1_8c2_test.ts`, full suite (450 tests) green.

**Nothing from the approved 1.8c.2 spec is missing or incorrect.**

## One small gap both reviewers flagged

Both ChatGPT and Codex independently asked for one additional safe diagnostic that is **not** in the implementation:

- `jsonld_brand_matches_model_name: boolean | null`

The decision table for 1.8c.3 references brand-token-only overlap (to decide whether a narrow Path B relaxation is justified), but the current telemetry only tells us whether JSON-LD brand is *present* — not whether it overlaps the model name. Without this field, the "brand overlap present → consider Path B relaxation" branch can't be evaluated from logs.

## Proposed addendum: Phase 1.8c.2a

Strictly additive, still diagnostic-only, still privacy-safe.

**Add one field** to `AmazonGuardExtendedDiagnostics` in `finalization_telemetry.ts`:

```
jsonld_brand_matches_model_name: boolean | null
```

Semantics:
- `null` when `jsonld_brand_present === false` (nothing to compare).
- `true` when at least one distinctive token from `pageSignals.jsonld_brand` (tokenized with the same distinctive-token logic already used for anchor/name in the guard) appears in the model's name tokens.
- `false` otherwise.

**Implementation** in `amazon_asin_guard.ts` `buildExtendedDiagnostics`:
- Reuse the existing distinctive-token tokenizer already applied to anchor and model name — no new tokenizer, no new normalization rules.
- Compare token sets in-memory only.
- Do **NOT** log the raw brand, raw tokens, or hashes for this comparison — only the boolean.

No changes to:
- guard accept/reject behavior
- anchor selection
- Path A / Path B rules
- token budget, responseMimeType, parser, merge, Zod, model, tools, Firecrawl
- V1, frontend, DB, non-Amazon paths, Phase 1.7 semantics

### Tests (extend `phase_1_8c2_test.ts`)

1. `jsonld_brand_present=false` → field is `null`.
2. Brand present, brand token appears in model name → `true`.
3. Brand present, no brand token in model name → `false`.
4. Field never leaks raw brand text or raw tokens (assert no brand substring in serialized diagnostics).
5. Non-Amazon path → entire diagnostics block still omitted (regression check).

### Files touched
- `supabase/functions/analyze-entity-url-v2/finalization_telemetry.ts` — add one field to the interface.
- `supabase/functions/analyze-entity-url-v2/amazon_asin_guard.ts` — populate it in `buildExtendedDiagnostics`.
- `supabase/functions/analyze-entity-url-v2/phase_1_8c2_test.ts` — 5 new test cases.
- `.lovable/plan.md` — note 1.8c.2a addendum.

### Out of scope (explicitly deferred, per both reviewers)
- Guard rule changes, Path A widening, Path B relaxation
- Parser envelope unwrap, maxOutputTokens bump, responseMimeType change
- Readable-token debug flag
- Any V1/frontend/DB/Phase 2 work

After this lands, retest the two Amazon URLs with `ENTITY_DIAG_HASH_SALT` set; the new boolean plus the existing buckets/hashes will be sufficient evidence for the 1.8c.3 decision.
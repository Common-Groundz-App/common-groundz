
## Where we are

Phase 1.8c.1 telemetry proved there is **no post-merge wiring bug**. Both Amazon runs ended with:

```
merge_returned_predictions: true
merge_path: recovery
amazon_guard.evaluated: true
amazon_guard.passed: false
amazon_guard.raw_reason_code: AMAZON_NAME_PAGE_TITLE_MISMATCH
response_builder.chosen_source_reason: discarded_by_amazon_guard
final.prediction_source: none → NO_PREDICTIONS
```

The prediction reached the response builder and was **intentionally** rejected by the Phase 1.7 dual-path Amazon identity guard. `NO_PREDICTIONS` is the correct output given current guard rules. What we don't yet know is whether the guard is correctly conservative or rejecting on a bad anchor / overly strict token comparison. Phase 1.8c.2 adds the diagnostics needed to choose between those possibilities, **without changing any behavior**.

## Reviewer-driven revision (incorporated)

Both reviewers correctly flagged that the original plan's `anchor_token_sample` / `model_name_token_sample` would log raw, human-readable tokens derived from page titles and model output (e.g. `folliwise`, `botanie`). That violates the existing "no prediction values / no raw page title / no raw model output in structured logs" policy. Revised approach uses counts, salted hashes, buckets, and safe decision booleans — no raw tokens.

## Scope

**Amazon-only. Diagnostic-only. Single file of new telemetry + pass-through wiring.**

Untouched: V1, frontend, DB, Zod schema, model name, tools list, `responseMimeType`, `thinkingBudget`, `maxOutputTokens`, Phase 1.7 guard semantics, `passesRecoveryGate` rules, merge rules, Firecrawl, non-Amazon paths, parser, response builder, Phase 2.

## New telemetry — appended to existing `finalization.amazon_guard` block

Emitted **only** when `amazon_guard.evaluated === true` AND `is_amazon === true`. Omitted entirely for non-Amazon requests.

### Safe counts and booleans
- `anchor_present: boolean` — re-expose `page_title_anchor_present`
- `anchor_source: "og_title" | "twitter_title" | "html_title" | "jsonld_product_name" | "none"` — which signal produced the anchor (read from existing `pickPageTitleAnchor` output)
- `anchor_token_count: number`
- `model_name_token_count: number`
- `token_overlap_count: number`
- `overlap_ratio_bucket: "none" | "low" | "medium" | "high"` — bucketed against `min(anchor_token_count, model_name_token_count)`. Buckets: `none` = 0, `low` = (0, 0.34), `medium` = [0.34, 0.66], `high` = (0.66, 1]. Bucketed so the raw ratio can't be reverse-engineered into token identities.
- `page_title_anchor_reject_reason: string | null` — pass through verbatim from guard diag (e.g. `BOT_WALL`, `CANONICAL_ASIN_MISMATCH`)
- `grounding_contains_canonical_dp_url: boolean` — pass through from guard diag
- `grounding_chunk_count: number`
- `grounding_amazon_chunk_count: number` — count of chunk URIs whose host matches the **shared strict Amazon predicate from Phase 1.8** (no new regex, no string includes)

### Decision-helping JSON-LD / source booleans (from Codex)
- `jsonld_brand_present: boolean`
- `jsonld_product_name_present: boolean`
- `anchor_has_og_title: boolean`
- `anchor_has_html_title: boolean`
- `anchor_has_jsonld_product_name: boolean`

These are existence booleans on already-extracted `pageSignals` fields — no new extraction work.

### Salted hash samples (gated on salt presence)
- `anchor_token_hash_sample: string[]` — up to 5 entries, format `sha256(SALT + ":" + token).slice(0, 12)`
- `model_name_token_hash_sample: string[]` — same format, up to 5
- `overlap_hash_sample: string[]` — up to 5 hashes that appear in both sides

**Salt rules:**
- Read `ENTITY_DIAG_HASH_SALT` from Deno env at module init.
- If unset OR empty OR shorter than 16 chars → all three `*_hash_sample` fields are **omitted entirely** (not `[]`, not `null` — absent keys). Counts/booleans/bucket still emit. We never log unsalted or weakly-salted hashes, because a bare `sha256(token).slice(0,8)` over a known brand/product vocabulary is trivially rainbow-tableable.
- Salt is server-side only, never logged, never returned in HTTP responses.

### Strict log-content rules (carried forward)
- No raw HTML, no raw model text, no raw page titles, no raw URLs with query strings, no prices, no PII.
- No raw token strings.
- No human-readable debug flag in this phase. If counts + hashes + buckets + booleans prove insufficient, a temporary debug flag is a **separate** follow-up phase — not bundled here.

## Files to change

- `supabase/functions/analyze-entity-url-v2/amazon_asin_guard.ts`
  - Extend `DualPathDiagnostics` with the read-only counters/booleans listed above.
  - Populate them in `runDualPathVerification` from values it already computes (`anchorTokens`, `nameTokens`, `anchorPick`, `args.pageSignals`, `args.groundingEvidence`).
  - **No control-flow changes**, no new accept/reject branches.
- `supabase/functions/analyze-entity-url-v2/finalization_telemetry.ts`
  - Extend `GuardTracker` / `AmazonGuard` types and `buildFinalization` to pass new fields through.
  - Implement salted-hash helper (lazy-read salt once at module init; export a `hashToken(t)` that returns `string | null`; callers omit the field when `null`).
  - Implement `bucketRatio(overlap, denom)` returning the enum above.
  - Reuse the **shared strict Amazon host predicate from Phase 1.8** for `grounding_amazon_chunk_count`. Do not add a new regex or use `includes`.
- `supabase/functions/analyze-entity-url-v2/index.ts`
  - Thread extended diagnostics into both `mainGuardTracker` and `recGuardTracker`. No new branches.
- `supabase/functions/analyze-entity-url-v2/phase_1_8c2_test.ts` *(new)*

## Tests

1. **Shape — Amazon evaluated:** all new counts/booleans/bucket fields present. Hash sample fields present iff salt is set (test both setups by stubbing env).
2. **Shape — non-Amazon:** entire new block absent.
3. **Shape — guard not evaluated:** new fields absent, existing `evaluated: false` preserved.
4. **Counts correctness:** synthetic anchor with 4 distinctive tokens and model name with 3 distinctive tokens, 1 overlap → `anchor_token_count: 4`, `model_name_token_count: 3`, `token_overlap_count: 1`, `overlap_ratio_bucket: "low"`.
5. **Bucket boundaries:** parametrized for 0 / 0.33 / 0.34 / 0.5 / 0.66 / 0.67 / 1.0 → `none / low / medium / medium / medium / high / high`.
6. **Hash cap:** anchor with 12 distinctive tokens emits exactly 5 hashes (with salt set).
7. **Hash determinism + cross-side match:** same token on anchor side and model side produces the same hash → that hash appears in `overlap_hash_sample`.
8. **Hash gating — unsalted:** with `ENTITY_DIAG_HASH_SALT` unset, all three `*_hash_sample` keys are absent from the emitted block; counts/booleans/bucket still present.
9. **Hash gating — weak salt:** with salt of length < 16, hash samples omitted.
10. **No raw token strings anywhere:** assert no field in the emitted block matches any of the input anchor or model-name raw tokens (case-insensitive substring scan).
11. **No raw page title / URL / model output anywhere:** assert against an allow-list of `finalization.*` field names.
12. **Amazon host predicate reuse:** `grounding_amazon_chunk_count` counts amazon.in, amazon.com, amazon.co.uk, amazon.de hosts; does NOT count `notamazon.com`, `amazon.evil.com`, `amazonaws.com`. Imports the shared Phase 1.8 predicate (no local regex).
13. **JSON-LD booleans pass-through:** `jsonld_brand_present` / `jsonld_product_name_present` reflect `pageSignals` content unchanged.
14. **Anchor source pass-through:** `anchor_source` matches whichever extractor `pickPageTitleAnchor` selected; `"none"` when no anchor.

## Acceptance

- All existing tests still green; new file's 14 tests green.
- Re-run the same two `amazon.in` URLs. The trace must include the new diagnostic fields. Both runs may still end in `NO_PREDICTIONS` — this phase changes no behavior.
- Success criterion: the new fields are sufficient to choose 1.8c.3's direction from the decision table below without re-running with additional logging.

## Decision table for 1.8c.3 (not implemented in this phase)

| Evidence in trace | Next phase |
|---|---|
| `anchor_present: false` OR `page_title_anchor_reject_reason` set OR `anchor_source: "none"` | Tighten `pickPageTitleAnchor` — anchor is unusable or wrong source |
| `anchor_present: true`, `anchor_token_count > 0`, `model_name_token_count > 0`, `overlap_ratio_bucket: "none"`, `jsonld_brand_matches` would help (use booleans) | Relax Path B to also accept brand-token-only overlap |
| `grounding_contains_canonical_dp_url: true` AND Path A still failed | Widen Path A to accept canonical `dp/<ASIN>` URLs in any retrieved URL |
| `overlap_ratio_bucket: "low"` or `"medium"` with low denominators (≤2 tokens each side) | Improve evidence packet upstream (more title context) rather than touching guard |
| None of the above clear | Keep current behavior; this URL family is genuinely unverifiable by Amazon identity rules. Stop iterating on the guard. |

## Explicitly deferred (do NOT ship in 1.8c.2)

- `passesRecoveryGate` loosening, Phase 1.7 guard semantics changes, Path A widening, Path B relaxation, `pickPageTitleAnchor` changes
- `responseMimeType` removal, `maxOutputTokens` bump, `url_context` envelope parser
- Human-readable token-sample debug flag (separate follow-up if ever needed)
- V1, frontend, DB, Zod, model, tools, Firecrawl, non-Amazon paths, Phase 2

## Operational note

After merge, set `ENTITY_DIAG_HASH_SALT` (≥16 random chars) as a Supabase Edge Function secret before retesting. Without it, hash samples are silently omitted and we rely on counts + buckets + booleans — which is still enough for most decision-table branches.

## Risk

Very low. Pure additive telemetry. No control flow, no guard rules, no parser, no model config, no schema. One-line revert per file.

## Phase 1.8c.1 — Trace & fix post-merge discard of valid Gemini fallback predictions

**Single highest-priority bug:** Request `f1927a2f` showed `merge.path: "recovery"` with all 8 `field_winners: "gemini"`, yet final response was `prediction_source: "none"` / `error_code: "NO_PREDICTIONS"`. A valid prediction is being discarded between `mergePredictions` returning and the HTTP response being built.

Ship only this fix. **Defer** parser envelope unwrap, `maxOutputTokens` bump, `responseMimeType` removal, and any loosening of `passesRecoveryGate` / Phase 1.7 guard. If 1.8c.1 alone unblocks Amazon URLs, none of the others are needed.

### Clarifications folded in from review
1. **Use existing production source labels** — `gemini_search_fallback`, `firecrawl_recovery`, `gemini_recovery`, `gemini`, `extractor` (already defined in `index.ts` ~lines 930/932/1381 and `schema.ts`). Do **not** introduce a new `search_fallback` label.
2. **Do not infer gate status from `field_winners`** — log actual execution.
3. **Preserve the real guard reason code** — surface the existing enum (e.g. `AMAZON_NAME_PAGE_TITLE_MISMATCH`, `AMAZON_ASIN_GROUNDING_MISMATCH`, `AMAZON_ASIN_GROUNDING_UNAVAILABLE`, `AMAZON_CANONICAL_ASIN_MISMATCH`) as `amazon_guard.raw_reason_code`, alongside a simplified `rejection_reason`.
4. **Prove which variable the response builder used** — add `response_builder.predictions_value_source` so we don't have to infer from a truthy boolean.
5. **Acceptance is correctness, not "force a modal"** — a legitimate guard rejection with a documented reason is a correct outcome.

---

### Scope
**Untouched:** V1, frontend, DB, Zod schema, model name, tools list, fetch cap, minimal Amazon packet, Firecrawl, non-Amazon paths, `responseMimeType`, `thinkingBudget`, `maxOutputTokens`, Phase 1.7 guard semantics, `passesRecoveryGate` rules, merge rules, Phase 2.

---

### Suspect sites between `mergePredictions` returning and the HTTP response
1. Phase 1.7 Amazon identity guard evaluating stale `extract` instead of `mergeOut.predictions`.
2. Redundant `passesRecoveryGate` re-check applying stricter rules than `merge.ts`.
3. Response builder reading the wrong variable (`extract` instead of `merged`).
4. `prediction_source` ternary lacking a branch for `merge.path === "recovery"` + fallback OK → falls through to `"none"`.
5. Final null-check guarding on `extract == null` instead of merge output.

---

### Implementation — diagnostic pass (commit 1, pure telemetry)

In `supabase/functions/analyze-entity-url-v2/index.ts`, between `mergePredictions` and the HTTP response (covering both the recovery branch ~line 930 and the main branch ~line 1379), add this block to the existing `trace` log. **Booleans, counts, enum strings, and reason codes only — no prediction values, no raw model text, no page titles, no URLs with query strings.**

```
finalization: {
  merge_returned_predictions: boolean,         // !!mergeOut.predictions
  merge_path: "success" | "recovery" | "none",
  merge_field_winners_gemini_count: number,

  recovery_gate: {
    ran_inside_merge: boolean,
    ran_again_after_merge: boolean,            // true ONLY if a redundant second check exists
    second_check_passed: boolean | null,
  },

  amazon_guard: {
    evaluated: boolean,
    passed: boolean,
    rejection_reason:                          // simplified enum
      | "asin_mismatch"
      | "name_unanchored"
      | "brand_mismatch"
      | "page_signals_missing"
      | "grounding_unavailable"
      | "guard_not_run"
      | "n/a",
    raw_reason_code: string | null,            // actual existing guard code, e.g.
                                               // AMAZON_NAME_PAGE_TITLE_MISMATCH,
                                               // AMAZON_ASIN_GROUNDING_MISMATCH,
                                               // AMAZON_ASIN_GROUNDING_UNAVAILABLE,
                                               // AMAZON_CANONICAL_ASIN_MISMATCH
    input_source:
      | "merge_output"
      | "extract_only"
      | "gemini_only"
      | "firecrawl_only"
      | "none",
  },

  response_builder: {
    predictions_var_truthy: boolean,
    predictions_value_source:                  // which variable was actually read
      | "merge_output"
      | "extract_only"
      | "gemini_only"
      | "firecrawl_only"
      | "none",
    chosen_source:                             // existing production labels — do NOT rename
      | "extractor"
      | "gemini"
      | "gemini_recovery"
      | "gemini_search_fallback"
      | "firecrawl_recovery"
      | "none",
    chosen_source_reason:
      | "extract_present"
      | "merge_success"
      | "merge_recovery_with_fallback"
      | "merge_recovery_with_firecrawl"
      | "all_null"
      | "discarded_by_amazon_guard"
      | "discarded_by_second_recovery_gate"
      | "discarded_unknown",
  },
}
```

Implementation notes:
- `raw_reason_code`: look up the actual constant the guard already returns and pass it through verbatim. If the guard doesn't currently emit a code in the rejection branch, add a typed return (no semantic change) so this telemetry can capture it.
- `predictions_value_source`: set at the literal assignment site of the variable the response builder serializes — not inferred elsewhere.
- All `_source` / `_reason` / `rejection_reason` values are constrained enums; never raw strings derived from model output.

### Implementation — fix pass (commit 2, same PR)

After running the failing URLs through commit 1's telemetry, apply **one** targeted fix matching what the logs reveal:

- Guard input is `extract` → switch to `mergeOut.predictions`.
- Response builder reads `extract` → switch to merge output.
- `prediction_source` ternary lacks a `merge.path === "recovery"` + fallback OK branch → add mapping to `gemini_search_fallback` or `firecrawl_recovery`.
- Redundant `passesRecoveryGate` call after merge with stricter inputs → remove (single source of truth lives in `merge.ts`).
- Final null-check uses wrong variable → switch to merge output.

**Do not** loosen `passesRecoveryGate`. **Do not** weaken Phase 1.7 guard rules — only correct its inputs if wrong.

---

### Tests (`phase_1_8c1_test.ts`)
1. Telemetry shape: every `finalization.*` field present; all enum values match the contract above; source labels match production (`gemini_search_fallback`, `firecrawl_recovery`); `raw_reason_code` is either `null` or a known guard constant.
2. Happy recovery: extract `null`, gemini fallback valid, Amazon guard passes → `chosen_source: "gemini_search_fallback"`, `predictions_value_source: "merge_output"`, `predictions_var_truthy: true`, final response uses merged prediction.
3. Legitimate guard rejection: gemini name fails page-title anchor → `amazon_guard.passed: false`, `rejection_reason: "name_unanchored"`, `raw_reason_code: "AMAZON_NAME_PAGE_TITLE_MISMATCH"`, `chosen_source: "none"`, `chosen_source_reason: "discarded_by_amazon_guard"`.
4. Extract-wins regression: deterministic extract present → `chosen_source: "extractor"`, `predictions_value_source: "merge_output"` (or `"extract_only"` if that's what the code actually does — telemetry must match reality), no behavior change.
5. No prediction values in any log line — assert log keys against an allow-list of `finalization.*` fields.

Run via existing Deno test harness.

---

### Acceptance
Retest the same two Amazon ASIN URLs. Per request, report:
- `request_id`, `merge.path`, gemini `field_winners` count
- All `finalization.*` fields above (including `raw_reason_code` and `predictions_value_source`)
- `final.prediction_source`, `final.error_code`
- Whether the modal opened

**Correctness criteria:**
- If merge output is valid AND Amazon guard passes → final response **must** use the merged prediction; `prediction_source ∈ {gemini_search_fallback, firecrawl_recovery, gemini_recovery, gemini, extractor}`.
- If guard rejects → `NO_PREDICTIONS` is correct, but `raw_reason_code` must be a specific guard constant (not `null` and not `"guard_not_run"`).
- **No** request may end with `merge_returned_predictions: true` AND `chosen_source: "none"` AND `chosen_source_reason: "discarded_unknown"`. That combination = unresolved bug.

---

### Explicitly deferred
- ❌ `url_context {url, content, title}` envelope parser — only revisit if, after 1.8c.1, primary URL-context calls still produce that envelope AND fallback also fails for the same request.
- ❌ Amazon fallback `maxOutputTokens` 2048 → 3072 — only revisit if request `6cb7e376` still shows `finish_reason: "MAX_TOKENS"` + `json_parse_ok: false` as the sole remaining blocker.
- ❌ Removing `responseMimeType: "application/json"` — not in this phase.

---

### Files expected to change
- `supabase/functions/analyze-entity-url-v2/index.ts` (telemetry block + one targeted wiring fix)
- `supabase/functions/analyze-entity-url-v2/amazon_asin_guard.ts` (only if `raw_reason_code` needs a typed return added)
- `supabase/functions/analyze-entity-url-v2/phase_1_8c1_test.ts` (new)

### Risk
Low. Commit 1 is pure telemetry. Commit 2 is one targeted wiring correction with a one-line revert. No schema, parser, model config, merge-rule, or guard-rule changes.

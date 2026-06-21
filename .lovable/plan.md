## Verdict on reviewer feedback

Both ChatGPT and Codex independently approve **shipping 1.8c.3a + 1.8c.3b together**, and both push back on one thing: the original plan's envelope-unwrap was too loose. I agree with every refinement. Folding them in below, plus one tiny additive I'd add on top.

## Phase 1.8c.3 — final scope (ship as one unit)

### 1.8c.3a — Strict envelope unwrap in the Gemini JSON parser

**Trigger conditions (all must hold):**
- Top-level parsed JSON is an object.
- It is missing one or more of the required schema fields (`type`, `name`, `confidence`).
- It has exactly one of these wrapper keys present: `content`, `data`, `result`, `output`, `response`.

**Unwrap rules (intentionally narrow):**
- Single level only. No recursion.
- If the child value is an **object** → validate it with the same existing Zod schema.
- If the child value is a **string** → only `JSON.parse` it when, after `trim()`, it starts with `{` or `[`, OR it is a fenced ```` ```json ... ``` ```` block (reuse the existing code-fence stripper already in the parser). Then validate via Zod.
- Any other shape (number, boolean, null, prose string not starting with `{`/`[`) → do **not** attempt unwrap; fall through to the existing `GEMINI_INVALID_SHAPE` path.
- No change to the Zod schema itself.
- No raw `content` / child string ever written to logs.

**Telemetry (additive only, on the existing `gemini` log line):**
- `envelope_unwrap_attempted: boolean`
- `envelope_unwrap_succeeded: boolean`
- `envelope_unwrap_key: "content" | "data" | "result" | "output" | "response" | null`
- `envelope_child_kind: "object" | "json_string" | "fenced_json" | "non_json_string" | "other" | null` (purely for diagnosis; no raw values)

### 1.8c.3b — Trigger search-only fallback on `GEMINI_INVALID_SHAPE`

**Scope:** Keep this phase **Amazon-only** (matches Codex's "minimum blast radius" — the fallback's minimal-packet logic and ASIN handling are Amazon-aware today; don't generalize without separate evidence).

**Rule:** When the primary URL-context Gemini call returns `GEMINI_INVALID_SHAPE` AND no valid prediction exists yet AND budget allows AND the request is Amazon → run the existing search-only fallback. All other skip-reason precedence in `search_fallback.ts` stays as-is.

**Telemetry:** Replace today's effective boolean with an explicit `trigger_reason` enum on the `gemini_search_fallback` log line:
- `transport_error` — primary call failed before producing parseable JSON
- `invalid_shape` — primary parsed but failed Zod (new branch)
- `recovery_gate` — merge produced nothing usable (existing branch)
- `none` — fallback did not run; pair with existing `skip_reason`

### Tiny additive I want on top: retroactive envelope frequency

Even when unwrap is **not** attempted (e.g., on a future success), emit one extra boolean inside the existing `gemini_failure_diagnostics` (and a parallel field on success traces):

- `envelope_wrapper_key_present: boolean` — true if any of the 5 known wrapper keys appears at the top level of the parsed JSON

Why: lets us measure on every Amazon trace how often Gemini is wrapping responses, even on calls that didn't fail. ~3 lines of code, zero behavior impact, no raw values.

### Explicitly **not** changing this phase

Guard rules (Path A / Path B / anchor selection / brand overlap), recovery-gate semantics, merge, Zod schema, model name, tool list, `responseMimeType`, `thinkingBudget`, `maxOutputTokens`, Firecrawl behavior, V1, frontend, DB, non-Amazon paths, Phase 2, readable-token debug flag.

### Tests (new `phase_1_8c3_test.ts`)

Parser unwrap:
1. Object child unwraps + passes Zod.
2. JSON-string child starting with `{` unwraps + passes Zod.
3. Fenced ```` ```json ... ``` ```` child unwraps + passes Zod.
4. Prose string child (no `{`/`[` prefix) → no unwrap, `GEMINI_INVALID_SHAPE` preserved.
5. Number/boolean/null child → no unwrap.
6. Unknown wrapper key (e.g., `wrapper`) → no unwrap.
7. Two wrapper keys present → no unwrap (avoids ambiguous parse).
8. Unwrap is single-level (nested envelope does **not** recurse).
9. Unwrapped child still failing Zod → `GEMINI_INVALID_SHAPE` preserved.
10. Leak guard: serialized log line never contains the raw child string.

Fallback trigger:
11. Primary `GEMINI_INVALID_SHAPE` on Amazon → fallback runs with `trigger_reason: "invalid_shape"`.
12. Primary transport error on Amazon → fallback runs with `trigger_reason: "transport_error"`.
13. Primary success on Amazon → fallback does **not** run.
14. Primary `GEMINI_INVALID_SHAPE` on **non-Amazon** → fallback does **not** run (scope guard).
15. Budget exhausted on Amazon `invalid_shape` → fallback skipped with existing `budget_exhausted` reason.

### Files touched

- `supabase/functions/analyze-entity-url-v2/gemini.ts` (parser unwrap + new diagnostic fields)
- `supabase/functions/analyze-entity-url-v2/search_fallback.ts` (add `invalid_shape` trigger reason in the type; new precedence branch lives in caller — see next)
- `supabase/functions/analyze-entity-url-v2/index.ts` (call fallback on Amazon `GEMINI_INVALID_SHAPE`; thread `trigger_reason` into the log line)
- `supabase/functions/analyze-entity-url-v2/phase_1_8c3_test.ts` (new file, 15 tests)
- `.lovable/plan.md` (record 1.8c.3 outcome + close 1.8c.2a)

### Acceptance

Retest both Amazon URLs (especially `B0B2WX5QPB`). Expected outcomes:

- If `{ url, content, title }` envelope contains schema-shaped JSON → unwrap succeeds, request proceeds, guard evaluates.
- If envelope contains prose / no valid JSON → parser still fails `GEMINI_INVALID_SHAPE`, but search-only fallback **runs** (because Amazon + invalid_shape).
- If fallback returns a prediction → guard evaluates; final outcome is either `OK` or a guard-attributed `NO_PREDICTIONS`.
- No request should die with `NO_PREDICTIONS` + `guard_not_run` due to primary invalid shape alone.

### Sequencing answer for the previous open question

Ship **3a + 3b together** (matches both reviewers). Splitting them would re-create the exact inconsistency we just observed — 3a alone helps when the envelope contains JSON, but Trace B's envelope might not, and without 3b that request still dies before the guard.

## Ready to implement?

Approve and I'll proceed.

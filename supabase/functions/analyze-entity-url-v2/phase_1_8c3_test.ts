// Phase 1.8c.3 tests — strict envelope unwrap (3a) + search-fallback
// trigger_reason telemetry (3b). Diagnostic/parser-only; no behavior
// changes to model, schema, guard rules, or non-Amazon paths.
//
// 3a covers:
//   - object child unwraps + passes Zod
//   - JSON-string child starting with `{` unwraps
//   - fenced ```json``` child unwraps
//   - prose string child → no unwrap, GEMINI_INVALID_SHAPE preserved
//   - number / boolean / null child → no unwrap
//   - unknown wrapper key → no unwrap
//   - two wrapper keys → no unwrap (ambiguous)
//   - unwrap is single-level (nested envelope does NOT recurse)
//   - unwrapped child still failing Zod → GEMINI_INVALID_SHAPE preserved
//   - leak guard: raw child string never appears in serialized log
//
// 3b covers:
//   - primary GEMINI_INVALID_SHAPE → triggerReason "invalid_shape"
//   - primary transport error    → triggerReason "transport_error"
//   - no primary error code      → triggerReason "recovery_gate"
//   - primary success            → fallback does NOT run, triggerReason null
//   - budget exhausted           → skipped, triggerReason null

import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  tolerantParseGeminiJson,
  geminiFailureDiagnostics,
  type TolerantParseAttempts,
} from "./gemini.ts";
import {
  maybeRunGeminiSearchFallback,
  type SearchFallbackGeminiInvoker,
  type SearchFallbackMerger,
} from "./search_fallback.ts";
import type { GeminiResult } from "./gemini.ts";
import type { GeminiRawPrediction } from "./response_schema.ts";
import type { V2Predictions, ExtractMetadata } from "./schema.ts";
import type { MergeDiagnostics, MergeFlags } from "./merge.ts";

// ─── Shared validator stub: passes if obj has type+name+confidence ─────
const validator = (v: unknown) => {
  if (
    v !== null && typeof v === "object" && !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).type === "string" &&
    typeof (v as Record<string, unknown>).name === "string" &&
    typeof (v as Record<string, unknown>).confidence === "number"
  ) return { success: true } as const;
  return {
    success: false,
    error: {
      issues: [
        { code: "invalid_type", path: ["type"], received: "undefined" },
      ],
    },
  } as const;
};

const VALID_INNER = { type: "product", name: "X", confidence: 0.9 };

// ─── 3a: parser unwrap tests ──────────────────────────────────────────

Deno.test("3a: object child unwraps + passes Zod", () => {
  // NOTE: the existing nested-wrapper pass (candidate 3) already accepts
  // any wrapped object whose inner shape has type+name strings, so it
  // catches this case before the envelope unwrap pass (candidate 4)
  // runs. We still assert success + envelope_wrapper_key_present so the
  // envelope-frequency telemetry is verified on this path.
  const text = JSON.stringify({ content: VALID_INNER });
  const res = tolerantParseGeminiJson(text, validator);
  assert(res.ok);
  assertEquals(res.attempts.envelope_wrapper_key_present, true);
});

Deno.test("3a: envelope unwrap path exercised when nested-wrapper misses", () => {
  // Inner child intentionally fails the nested-wrapper precondition
  // (`name` is missing) but my Zod validator only requires type+name+
  // confidence. We construct a case where the child is JSON-shaped but
  // can be ONLY reached via the new envelope unwrap branch. The child
  // here doesn't pass Zod, so unwrap_attempted=true and succeeded=false.
  const text = JSON.stringify({ content: { unrelated: "junk" } });
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    assertEquals(res.attempts.envelope_wrapper_key_present, true);
    assertEquals(res.attempts.envelope_unwrap_attempted, true);
    assertEquals(res.attempts.envelope_unwrap_succeeded, false);
    assertEquals(res.attempts.envelope_unwrap_key, "content");
    assertEquals(res.attempts.envelope_child_kind, "object");
  }
});

Deno.test("3a: JSON-string child starting with '{' unwraps", () => {
  const text = JSON.stringify({ content: JSON.stringify(VALID_INNER) });
  const res = tolerantParseGeminiJson(text, validator);
  assert(res.ok);
  assertEquals(res.attempts.envelope_unwrap_succeeded, true);
  assertEquals(res.attempts.envelope_child_kind, "json_string");
});

Deno.test("3a: fenced ```json``` child unwraps", () => {
  const fenced = "```json\n" + JSON.stringify(VALID_INNER) + "\n```";
  const text = JSON.stringify({ content: fenced });
  const res = tolerantParseGeminiJson(text, validator);
  assert(res.ok);
  assertEquals(res.attempts.envelope_unwrap_succeeded, true);
  assertEquals(res.attempts.envelope_child_kind, "fenced_json");
});

Deno.test("3a: prose string child → no unwrap, GEMINI_INVALID_SHAPE preserved", () => {
  const text = JSON.stringify({
    url: "https://x",
    content: "This is page text not JSON",
    title: "T",
  });
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    assertEquals(res.code, "GEMINI_INVALID_SHAPE");
    assertEquals(res.attempts.envelope_unwrap_attempted, true);
    assertEquals(res.attempts.envelope_unwrap_succeeded, false);
    assertEquals(res.attempts.envelope_child_kind, "non_json_string");
  }
});

Deno.test("3a: non-object/non-string child kinds → 'other', no unwrap", () => {
  for (const childValue of [42, true, null]) {
    const text = JSON.stringify({ content: childValue });
    const res = tolerantParseGeminiJson(text, validator);
    assertFalse(res.ok);
    if (!res.ok) {
      assertEquals(res.attempts.envelope_unwrap_attempted, true);
      assertEquals(res.attempts.envelope_unwrap_succeeded, false);
      assertEquals(res.attempts.envelope_child_kind, "other");
    }
  }
});

Deno.test("3a: unknown wrapper key (non-envelope) → no unwrap attempt, key_present=false", () => {
  // `wrapper` is NOT one of the 5 envelope keys. The inner is non-object
  // junk so the existing nested-wrapper pass also skips it (its filter
  // requires inner type+name strings). Therefore: hard INVALID_SHAPE
  // with no envelope unwrap recorded.
  const text = JSON.stringify({ wrapper: "junk" });
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    assertEquals(res.attempts.envelope_wrapper_key_present, false);
    assertEquals(res.attempts.envelope_unwrap_attempted, false);
    assertEquals(res.attempts.envelope_unwrap_key, null);
  }
});

Deno.test("3a: two wrapper keys present → ambiguous, no unwrap", () => {
  const text = JSON.stringify({ content: VALID_INNER, data: VALID_INNER });
  const res = tolerantParseGeminiJson(text, validator);
  // Both wrapper keys present → ambiguous → envelope step skipped. But the
  // existing nested-wrapper pass (which handles `data` with valid inner)
  // will still succeed before envelope unwrap is reached. So success is
  // expected via the legacy wrapper path — but envelope_unwrap_attempted
  // must be false.
  assertEquals(res.attempts.envelope_wrapper_key_present, true);
  assertEquals(res.attempts.envelope_unwrap_attempted, false);
});

Deno.test("3a: unwrap is single-level (nested envelope does NOT recurse)", () => {
  // content -> { content: VALID_INNER }. The outer unwrap will yield an
  // object that itself fails Zod and contains another `content` key. We
  // must NOT recurse into the inner content.
  const text = JSON.stringify({ content: { content: VALID_INNER } });
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    assertEquals(res.attempts.envelope_unwrap_attempted, true);
    assertEquals(res.attempts.envelope_unwrap_succeeded, false);
    // The inner inner-valid object is NOT returned.
  }
});

Deno.test("3a: unwrapped child still failing Zod → GEMINI_INVALID_SHAPE preserved", () => {
  const text = JSON.stringify({ content: { name: "X" } }); // missing type+confidence
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    assertEquals(res.code, "GEMINI_INVALID_SHAPE");
    assertEquals(res.attempts.envelope_unwrap_attempted, true);
    assertEquals(res.attempts.envelope_unwrap_succeeded, false);
    assertEquals(res.attempts.envelope_child_kind, "object");
  }
});

Deno.test("3a: leak guard — raw child string never appears in diagnostics", () => {
  const SENTINEL = "SECRET_BRAND_VALUE_xyz_98765";
  const text = JSON.stringify({
    url: "https://x",
    content: `prose containing ${SENTINEL} that must not leak`,
    title: "T",
  });
  const res = tolerantParseGeminiJson(text, validator);
  assertFalse(res.ok);
  if (!res.ok) {
    const diag = geminiFailureDiagnostics(text, res.attempts, res.zodIssues);
    const serialized = JSON.stringify(diag);
    assertFalse(serialized.includes(SENTINEL));
    assertEquals(diag.envelope_wrapper_key_present, true);
    assertEquals(diag.envelope_unwrap_attempted, true);
    assertEquals(diag.envelope_child_kind, "non_json_string");
  }
});

Deno.test("3a: envelope_wrapper_key_present logged even when missing fields not triggered", () => {
  // Root contains the required fields AND a wrapper key. Top-level passes
  // Zod via candidate 1; envelope_wrapper_key_present still recorded.
  const text = JSON.stringify({ ...VALID_INNER, content: "ignored" });
  const res = tolerantParseGeminiJson(text, validator);
  assert(res.ok);
  assertEquals(res.attempts.envelope_wrapper_key_present, true);
  assertEquals(res.attempts.envelope_unwrap_attempted, false);
});

Deno.test("3a: diagnostics surface envelope fields with defaults when absent", () => {
  // Tests backward-compat: TolerantParseAttempts constructed without the
  // new optional envelope fields still produces diagnostics with safe
  // defaults (false/null) — proves we never throw on legacy shapes.
  const legacy: TolerantParseAttempts = {
    parse_candidate_count: 1,
    parsed_json: true,
    contains_code_fence: false,
    top_level_keys: ["foo"],
    nested_wrapper_keys: [],
    best_candidate_keys: ["foo"],
  };
  const d = geminiFailureDiagnostics("{}", legacy);
  assertEquals(d.envelope_wrapper_key_present, false);
  assertEquals(d.envelope_unwrap_attempted, false);
  assertEquals(d.envelope_unwrap_succeeded, false);
  assertEquals(d.envelope_unwrap_key, null);
  assertEquals(d.envelope_child_kind, null);
});

// ─── 3b: search-fallback trigger_reason tests ────────────────────────

const EMPTY_META = {} as unknown as ExtractMetadata;
const EMPTY_FLAGS = {} as unknown as MergeFlags;
const DIAG_OK = { path: "gemini_only", field_winners: {} } as unknown as MergeDiagnostics;

function makePred(name = "T"): V2Predictions {
  return {
    type: "product", name, description: null, category_id: null,
    suggested_category_path: null, matched_category_name: null,
    tags: [], confidence: 0.9, reasoning: "",
    image_url: null, images: [], additional_data: {},
  } as V2Predictions;
}
function makeGeminiPred(): GeminiRawPrediction {
  return {
    type: "product", name: "Fb", description: "", tags: [],
    confidence: 0.9, reasoning: "", image_url: null, images: [],
    additional_data: {}, field_confidence: {},
  } as unknown as GeminiRawPrediction;
}
function makeGeminiSuccess(): GeminiResult {
  return {
    ok: true, configured: true, durationMs: 50, model: "g",
    grounding: {
      used_url_context: false, used_google_search: true,
      url_retrieval_statuses: [], url_context_failed: false,
      grounding_chunk_uris: [], grounding_chunk_titles: [],
      url_context_retrieved_urls: [],
    },
    prediction: makeGeminiPred(),
  };
}
const okInvoker: SearchFallbackGeminiInvoker = () => Promise.resolve(makeGeminiSuccess());
const okMerger: SearchFallbackMerger = () => ({ predictions: makePred(), mergeDiag: DIAG_OK });

const baseArgs = {
  currentMerged: null,
  primaryGeminiPred: null,
  geminiConfigured: true,
  elapsedMs: 0,
  totalBudgetMs: 60_000,
  safeUrl: "https://amazon.com/dp/B0XX",
  evidenceBaseUrl: "https://amazon.com/dp/B0XX",
  extractMetadata: EMPTY_META,
  usedFirecrawl: false,
  mergeFlags: EMPTY_FLAGS,
  extractPredictions: null,
} as const;

Deno.test("3b: primary GEMINI_INVALID_SHAPE → triggerReason 'invalid_shape'", async () => {
  const res = await maybeRunGeminiSearchFallback(
    { ...baseArgs, primaryGeminiErrorCode: "GEMINI_INVALID_SHAPE" },
    { geminiInvoker: okInvoker, applyMerge: okMerger },
  );
  assert(res.attempted);
  assert(res.used);
  assertEquals(res.triggerReason, "invalid_shape");
});

Deno.test("3b: primary transport error → triggerReason 'transport_error'", async () => {
  for (const code of ["GEMINI_TIMEOUT", "GEMINI_HTTP_ERROR", "GEMINI_BAD_RESPONSE"]) {
    const res = await maybeRunGeminiSearchFallback(
      { ...baseArgs, primaryGeminiErrorCode: code },
      { geminiInvoker: okInvoker, applyMerge: okMerger },
    );
    assert(res.attempted, `expected attempted for ${code}`);
    assertEquals(res.triggerReason, "transport_error");
  }
});

Deno.test("3b: no primary error code → triggerReason 'recovery_gate'", async () => {
  const res = await maybeRunGeminiSearchFallback(
    { ...baseArgs }, // primaryGeminiErrorCode omitted
    { geminiInvoker: okInvoker, applyMerge: okMerger },
  );
  assert(res.attempted);
  assertEquals(res.triggerReason, "recovery_gate");
});

Deno.test("3b: primary success path → fallback does NOT run, triggerReason null", async () => {
  let invoked = false;
  const inv: SearchFallbackGeminiInvoker = () => {
    invoked = true;
    return Promise.resolve(makeGeminiSuccess());
  };
  const res = await maybeRunGeminiSearchFallback(
    { ...baseArgs, primaryGeminiPred: makeGeminiPred() },
    { geminiInvoker: inv, applyMerge: okMerger },
  );
  assertFalse(invoked);
  assertFalse(res.attempted);
  assertEquals(res.skipReason, "primary_gemini_succeeded");
  assertEquals(res.triggerReason, null);
});

Deno.test("3b: budget exhausted → skipped, triggerReason null", async () => {
  const res = await maybeRunGeminiSearchFallback(
    {
      ...baseArgs,
      primaryGeminiErrorCode: "GEMINI_INVALID_SHAPE",
      elapsedMs: 59_000,
      totalBudgetMs: 60_000,
    },
    { geminiInvoker: okInvoker, applyMerge: okMerger },
  );
  assertFalse(res.attempted);
  assertEquals(res.skipReason, "budget_exhausted");
  assertEquals(res.triggerReason, null);
});

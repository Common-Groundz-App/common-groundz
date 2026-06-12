// Phase 7: Gemini client tests. No network — fetch is injected.

import { assert, assertEquals, assertExists, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { runGeminiJsonMode, chooseEvidenceBaseUrl, GEMINI_MODEL } from "./gemini.ts";
import { buildGeminiRawPredictionSchema, normalizeImageUrl } from "./response_schema.ts";

const BASE = "https://www.nykaa.com/x/p/123";

function makeFetch(handler: (req: Request) => Promise<Response> | Response) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return await handler(new Request(url, init));
  };
}

function geminiJson(text: string, extra: Record<string, unknown> = {}): Response {
  const body = {
    candidates: [{
      content: { parts: [{ text }] },
      ...extra,
    }],
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const VALID = JSON.stringify({
  type: "product",
  name: "Dior Sauvage",
  description: "A fragrance.",
  tags: ["fragrance"],
  confidence: 0.9,
  reasoning: "JSON-LD says so.",
  image_url: "https://img.example.com/x.jpg",
  images: [],
  additional_data: { brand: "Dior" },
  field_confidence: { name: 0.95 },
});

Deno.test("missing API key → sentinel, no fetch", async () => {
  let called = false;
  const res = await runGeminiJsonMode({
    systemPrompt: "s",
    userPrompt: "u",
    evidenceBaseUrl: BASE,
    apiKey: "",
    fetchImpl: makeFetch(() => { called = true; return new Response("nope"); }),
  });
  assertFalse(called);
  assertEquals(res, { ok: false, configured: false });
});

Deno.test("body shape: snake_case tools, no responseMimeType/Schema/timeout, systemInstruction split from user prompt", async () => {
  let captured: any = null;
  const res = await runGeminiJsonMode({
    systemPrompt: "s",
    userPrompt: "u",
    evidenceBaseUrl: BASE,
    apiKey: "k",
    fetchImpl: makeFetch(async (req) => {
      captured = await req.json();
      return geminiJson(VALID);
    }),
  });
  assert(res.ok);
  assertEquals(captured.generationConfig.responseMimeType, undefined);
  assertEquals(captured.generationConfig.responseSchema, undefined);
  assertEquals(captured.timeout, undefined);
  assertEquals(captured.systemInstruction.parts[0].text, "s");
  assertEquals(captured.contents[0].parts[0].text, "u");
  const tools = captured.tools as Array<Record<string, unknown>>;
  assert(tools.some((t) => "url_context" in t));
  assert(tools.some((t) => "google_search" in t));
  assertFalse(tools.some((t) => "urlContext" in t));
  assertFalse(tools.some((t) => "googleSearch" in t));
});

Deno.test("429 → GEMINI_RATE_LIMITED; 402 → GEMINI_PAYMENT_REQUIRED; 500 → GEMINI_HTTP_ERROR; 400 → GEMINI_HTTP_ERROR (no schema fallback)", async () => {
  for (const [status, code] of [[429, "GEMINI_RATE_LIMITED"], [402, "GEMINI_PAYMENT_REQUIRED"], [500, "GEMINI_HTTP_ERROR"], [400, "GEMINI_HTTP_ERROR"]] as const) {
    const res = await runGeminiJsonMode({
      systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
      fetchImpl: makeFetch(() => new Response("x", { status })),
    });
    assert(!res.ok && res.configured);
    assertEquals(res.code, code);
    assertEquals(res.status, status);
  }
});

// --- Sanitized 400 diagnostic logging ---

function captureLogs(fn: () => Promise<void>): Promise<Array<unknown[]>> {
  const original = console.log;
  const calls: Array<unknown[]> = [];
  console.log = (...args: unknown[]) => { calls.push(args); };
  return fn().then(() => { console.log = original; return calls; }, (e) => { console.log = original; throw e; });
}

Deno.test("400 with JSON error body → logs sanitized error_status/code/message", async () => {
  const errBody = JSON.stringify({ error: { status: "INVALID_ARGUMENT", code: 400, message: "Request contains an invalid argument." } });
  const calls = await captureLogs(async () => {
    await runGeminiJsonMode({
      systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
      fetchImpl: makeFetch(() => new Response(errBody, { status: 400 })),
    });
  });
  const payload = calls.find((c) => c[0] === "[analyze-entity-url-v2] gemini")?.[1] as Record<string, unknown> | undefined;
  assertExists(payload);
  assertEquals(payload.error_status, "INVALID_ARGUMENT");
  assertEquals(payload.error_code, 400);
  assertEquals(payload.error_message_truncated, "Request contains an invalid argument.");
  assertFalse("prompt" in payload);
  assertFalse("body" in payload);
  assertFalse("headers" in payload);
});

Deno.test("400 with non-JSON text body → error_message_truncated is collapsed text", async () => {
  const calls = await captureLogs(async () => {
    await runGeminiJsonMode({
      systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
      fetchImpl: makeFetch(() => new Response("Bad   Request\n\nfoo", { status: 400 })),
    });
  });
  const payload = calls.find((c) => c[0] === "[analyze-entity-url-v2] gemini")?.[1] as Record<string, unknown> | undefined;
  assertExists(payload);
  assertEquals(payload.error_message_truncated, "Bad Request foo");
});

Deno.test("400 with >400 char body → error_message_truncated <= 400 chars", async () => {
  const big = "x".repeat(2000);
  const calls = await captureLogs(async () => {
    await runGeminiJsonMode({
      systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
      fetchImpl: makeFetch(() => new Response(big, { status: 400 })),
    });
  });
  const payload = calls.find((c) => c[0] === "[analyze-entity-url-v2] gemini")?.[1] as Record<string, unknown> | undefined;
  assertExists(payload);
  const msg = payload.error_message_truncated as string;
  assert(typeof msg === "string");
  assert(msg.length <= 400);
});

Deno.test("AbortController → GEMINI_TIMEOUT", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    timeoutMs: 5,
    fetchImpl: (_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = (init as RequestInit | undefined)?.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as { name: string }).name = "AbortError";
          reject(err);
        });
      }
    }),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_TIMEOUT");
});

Deno.test("promptFeedback.blockReason → GEMINI_BLOCKED_BY_SAFETY", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_BLOCKED_BY_SAFETY");
});

Deno.test("candidate finishReason SAFETY → GEMINI_BLOCKED_BY_SAFETY", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), { status: 200 })),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_BLOCKED_BY_SAFETY");
});

Deno.test("no candidates → GEMINI_BAD_RESPONSE", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => new Response(JSON.stringify({}), { status: 200 })),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_BAD_RESPONSE");
});

Deno.test("malformed JSON in text → GEMINI_INVALID_JSON", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson("not json{{")),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_JSON");
});

Deno.test("```json fenced response → parsed", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson("```json\n" + VALID + "\n```")),
  });
  assert(res.ok);
});

Deno.test("``` fenced response → parsed", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson("```\n" + VALID + "\n```")),
  });
  assert(res.ok);
});

Deno.test("invalid type → GEMINI_INVALID_SHAPE", async () => {
  const bad = JSON.stringify({ ...JSON.parse(VALID), type: "other" });
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(bad)),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_SHAPE");
});

Deno.test("missing name → GEMINI_INVALID_SHAPE", async () => {
  const bad = JSON.stringify({ ...JSON.parse(VALID), name: "" });
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(bad)),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_SHAPE");
});

Deno.test("grounding: candidate-level urlContextMetadata.urlMetadata SUCCESS", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID, {
      urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }] },
    })),
  });
  assert(res.ok);
  assertEquals(res.grounding.used_url_context, true);
  assertEquals(res.grounding.url_context_failed, false);
});

Deno.test("grounding: snake_case ERROR variant", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID, {
      url_context_metadata: { url_metadata: [{ url_retrieval_status: "URL_RETRIEVAL_STATUS_ERROR" }] },
    })),
  });
  assert(res.ok);
  assertEquals(res.grounding.used_url_context, true);
  assertEquals(res.grounding.url_context_failed, true);
});

Deno.test("grounding: nested under groundingMetadata", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID, {
      groundingMetadata: { urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS" }] } },
    })),
  });
  assert(res.ok);
  assertEquals(res.grounding.used_url_context, true);
});

Deno.test("grounding: groundingChunks → used_google_search", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID, {
      groundingMetadata: { groundingChunks: [{ web: { uri: "https://x" } }] },
    })),
  });
  assert(res.ok);
  assertEquals(res.grounding.used_google_search, true);
});

Deno.test("grounding: webSearchQueries → used_google_search", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID, {
      groundingMetadata: { webSearchQueries: ["x"] },
    })),
  });
  assert(res.ok);
  assertEquals(res.grounding.used_google_search, true);
});

// --- Image normalization ---

Deno.test("normalizeImageUrl rejects javascript:", () => {
  assertEquals(normalizeImageUrl("javascript:alert(1)", BASE), null);
});
Deno.test("normalizeImageUrl resolves root-relative /img/x.jpg", () => {
  assertEquals(normalizeImageUrl("/img/p.jpg", BASE), "https://www.nykaa.com/img/p.jpg");
});
Deno.test("normalizeImageUrl resolves protocol-relative //cdn", () => {
  assertEquals(normalizeImageUrl("//cdn.example.com/x.jpg", BASE), "https://cdn.example.com/x.jpg");
});
Deno.test("normalizeImageUrl resolves bare filename relative to base", () => {
  assertEquals(normalizeImageUrl("thumb.jpg", BASE), "https://www.nykaa.com/x/p/thumb.jpg");
});
Deno.test("normalizeImageUrl uses firecrawl finalUrl base", () => {
  assertEquals(normalizeImageUrl("img/x.jpg", "https://www.nykaa.com/product/abc"), "https://www.nykaa.com/product/img/x.jpg");
});

Deno.test("validator: images[] mixed valid/invalid → invalid dropped", () => {
  const schema = buildGeminiRawPredictionSchema(BASE);
  const v = schema.parse({
    type: "product", name: "x", confidence: 0.5,
    images: [{ url: "javascript:1" }, { url: "/a.jpg" }, { url: "data:foo" }, "https://ok.example.com/b.jpg"],
  });
  assertEquals(v.images.length, 2);
});

Deno.test("validator: all images invalid + null image_url → still ok", () => {
  const schema = buildGeminiRawPredictionSchema(BASE);
  const v = schema.parse({
    type: "product", name: "x", confidence: 0.5,
    image_url: "javascript:1", images: [{ url: "data:..." }],
  });
  assertEquals(v.image_url, null);
  assertEquals(v.images.length, 0);
});

Deno.test("chooseEvidenceBaseUrl prefers firecrawl > fetch > safe", () => {
  assertEquals(chooseEvidenceBaseUrl({ firecrawlFinalUrl: "https://fc.example/x", fetchFinalUrl: "https://fe.example/x", safeUrl: "https://safe.example/x" }), "https://fc.example/x");
  assertEquals(chooseEvidenceBaseUrl({ firecrawlFinalUrl: null, fetchFinalUrl: "https://fe.example/x", safeUrl: "https://safe.example/x" }), "https://fe.example/x");
  assertEquals(chooseEvidenceBaseUrl({ firecrawlFinalUrl: null, fetchFinalUrl: null, safeUrl: "https://safe.example/x" }), "https://safe.example/x");
});

Deno.test("GEMINI_MODEL is gemini-2.5-flash", () => {
  assertEquals(GEMINI_MODEL, "gemini-2.5-flash");
  assertExists(GEMINI_MODEL);
});

// --- Tolerant Gemini JSON parsing ---

import { tolerantParseGeminiJson } from "./gemini.ts";

Deno.test("tolerantParse: leading prose + JSON succeeds", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson("Here is the result:\n" + VALID)),
  });
  assert(res.ok);
});

Deno.test("tolerantParse: trailing prose after JSON succeeds", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(VALID + "\n\n(That was the result.)")),
  });
  assert(res.ok);
});

Deno.test("tolerantParse: { prediction: {...} } as entire response succeeds", async () => {
  const wrapped = JSON.stringify({ prediction: JSON.parse(VALID) });
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(wrapped)),
  });
  assert(res.ok);
});

Deno.test("tolerantParse: { result: {...} } wrapper succeeds", async () => {
  const wrapped = JSON.stringify({ result: JSON.parse(VALID) });
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(wrapped)),
  });
  assert(res.ok);
});

Deno.test("tolerantParse: prose + { prediction: {...} } succeeds via balanced-block + nested", async () => {
  const wrapped = "Sure! " + JSON.stringify({ prediction: JSON.parse(VALID) }) + " done.";
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(wrapped)),
  });
  assert(res.ok);
});

Deno.test("tolerantParse: nested object with only confidence/reasoning rejected → INVALID_SHAPE", async () => {
  const bad = JSON.stringify({ meta: { confidence: 0.5, reasoning: "x" } });
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(bad)),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_SHAPE");
});

Deno.test("tolerantParse: array-of-objects rejected", async () => {
  const bad = JSON.stringify([JSON.parse(VALID)]);
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson(bad)),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_SHAPE");
});

Deno.test("tolerantParse: malformed JSON still fails with INVALID_JSON", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    fetchImpl: makeFetch(() => geminiJson("not json at all {{{")),
  });
  assert(!res.ok && res.configured);
  assertEquals(res.code, "GEMINI_INVALID_JSON");
});

Deno.test("tolerantParse: pure-function — fenced JSON parses; nested wrappers respected", () => {
  const validator = buildGeminiRawPredictionSchema(BASE);
  const ok1 = tolerantParseGeminiJson("```json\n" + VALID + "\n```", (v) => validator.safeParse(v));
  assert(ok1.ok);
  const ok2 = tolerantParseGeminiJson(JSON.stringify({ data: JSON.parse(VALID) }), (v) => validator.safeParse(v));
  assert(ok2.ok);
  const bad = tolerantParseGeminiJson(JSON.stringify({ unrelated: { foo: 1 } }), (v) => validator.safeParse(v));
  assertFalse(bad.ok);
});

Deno.test("gemini success log includes raw_text_length and raw_text_sha8", async () => {
  const original = console.log;
  const calls: Array<unknown[]> = [];
  console.log = (...args: unknown[]) => { calls.push(args); };
  try {
    await runGeminiJsonMode({
      systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
      fetchImpl: makeFetch(() => geminiJson(VALID)),
    });
  } finally {
    console.log = original;
  }
  const payload = calls.find((c) => c[0] === "[analyze-entity-url-v2] gemini")?.[1] as Record<string, unknown> | undefined;
  assertExists(payload);
  assert(typeof payload.raw_text_length === "number");
  assert(typeof payload.raw_text_sha8 === "string");
  assert((payload.raw_text_sha8 as string).length === 8 || (payload.raw_text_sha8 as string).length === 0);
});

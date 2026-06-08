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

Deno.test("body never contains responseSchema or top-level timeout; always JSON mode + both tools", async () => {
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
  assertEquals(captured.generationConfig.responseMimeType, "application/json");
  assertEquals(captured.generationConfig.responseSchema, undefined);
  assertEquals(captured.timeout, undefined);
  const tools = captured.tools as Array<Record<string, unknown>>;
  assert(tools.some((t) => "urlContext" in t));
  assert(tools.some((t) => "googleSearch" in t));
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

Deno.test("AbortController → GEMINI_TIMEOUT", async () => {
  const res = await runGeminiJsonMode({
    systemPrompt: "s", userPrompt: "u", evidenceBaseUrl: BASE, apiKey: "k",
    timeoutMs: 5,
    fetchImpl: makeFetch((_req) => new Promise<Response>(() => {
      // never resolves — abort will reject
    })),
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
    images: [{ url: "javascript:1" }, { url: "/a.jpg" }, "bad", "https://ok.example.com/b.jpg"],
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

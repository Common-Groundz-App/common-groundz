// Phase 1.8b focused tests: Amazon-only thinkingBudget: 0 for both the
// primary url_context+google_search Gemini call and the search-only
// fallback, with maxOutputTokens: 2048 held constant on both paths.
//
// Strict Amazon host detection comes from the shared host_hints predicate
// (single source of truth re-used by the 4 MiB fetch cap and the minimal
// Amazon evidence packet) — we never duplicate regex or `.includes`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { isStrictAmazonHost } from "./host_hints.ts";
import { callGeminiSearchOnly, runGeminiJsonMode } from "./gemini.ts";

interface CapturedBody {
  generationConfig: {
    thinkingConfig: { thinkingBudget: number };
    maxOutputTokens: number;
    temperature: number;
  };
  tools: Array<Record<string, unknown>>;
}

function makeFetchCapture(): {
  fetchImpl: typeof fetch;
  captured: CapturedBody[];
} {
  const captured: CapturedBody[] = [];
  const fetchImpl: typeof fetch = ((
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const raw = typeof init?.body === "string" ? init.body : "";
    try {
      captured.push(JSON.parse(raw) as CapturedBody);
    } catch { /* malformed body — fail loudly in the assertion phase */ }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "" }] },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;
  return { fetchImpl, captured };
}

const COMMON_ARGS = {
  systemPrompt: "sys",
  userPrompt: "user",
  evidenceBaseUrl: "https://example.com/x",
  apiKey: "fake-key",
};

Deno.test("Phase 1.8b: isAmazon=true → thinkingBudget 0 on primary (runGeminiJsonMode)", async () => {
  const { fetchImpl, captured } = makeFetchCapture();
  await runGeminiJsonMode({ ...COMMON_ARGS, fetchImpl, isAmazon: true });
  assertEquals(captured.length, 1);
  assertEquals(captured[0].generationConfig.thinkingConfig.thinkingBudget, 0);
  assertEquals(captured[0].generationConfig.maxOutputTokens, 2048);
});

Deno.test("Phase 1.8b: isAmazon=false → thinkingBudget 256 on primary (non-Amazon unchanged)", async () => {
  const { fetchImpl, captured } = makeFetchCapture();
  await runGeminiJsonMode({ ...COMMON_ARGS, fetchImpl, isAmazon: false });
  assertEquals(captured[0].generationConfig.thinkingConfig.thinkingBudget, 256);
  assertEquals(captured[0].generationConfig.maxOutputTokens, 2048);
});

Deno.test("Phase 1.8b: isAmazon omitted → defaults to non-Amazon (256)", async () => {
  const { fetchImpl, captured } = makeFetchCapture();
  await runGeminiJsonMode({ ...COMMON_ARGS, fetchImpl });
  assertEquals(captured[0].generationConfig.thinkingConfig.thinkingBudget, 256);
});

Deno.test("Phase 1.8b: isAmazon=true → thinkingBudget 0 on search-only fallback (callGeminiSearchOnly)", async () => {
  const { fetchImpl, captured } = makeFetchCapture();
  await callGeminiSearchOnly({ ...COMMON_ARGS, fetchImpl, isAmazon: true });
  assertEquals(captured.length, 1);
  assertEquals(captured[0].generationConfig.thinkingConfig.thinkingBudget, 0);
  assertEquals(captured[0].generationConfig.maxOutputTokens, 2048);
  // Search-only path: tools must be google_search only (parity with V1).
  assertEquals(captured[0].tools.length, 1);
  assert("google_search" in captured[0].tools[0]);
});

Deno.test("Phase 1.8b: isAmazon=false → thinkingBudget 256 on search-only fallback", async () => {
  const { fetchImpl, captured } = makeFetchCapture();
  await callGeminiSearchOnly({ ...COMMON_ARGS, fetchImpl, isAmazon: false });
  assertEquals(captured[0].generationConfig.thinkingConfig.thinkingBudget, 256);
  assertEquals(captured[0].generationConfig.maxOutputTokens, 2048);
});

Deno.test("Phase 1.8b: config parity — primary and search-only produce identical generationConfig for same isAmazon", async () => {
  for (const isAmazon of [true, false]) {
    const a = makeFetchCapture();
    const b = makeFetchCapture();
    await runGeminiJsonMode({ ...COMMON_ARGS, fetchImpl: a.fetchImpl, isAmazon });
    await callGeminiSearchOnly({ ...COMMON_ARGS, fetchImpl: b.fetchImpl, isAmazon });
    assertEquals(
      a.captured[0].generationConfig,
      b.captured[0].generationConfig,
      `generationConfig parity failed for isAmazon=${isAmazon}`,
    );
  }
});

Deno.test("Phase 1.8b: strict Amazon host predicate accepts real regional hosts", () => {
  for (
    const h of [
      "amazon.com",
      "www.amazon.com",
      "amazon.in",
      "www.amazon.in",
      "amazon.co.uk",
      "amazon.com.au",
      "amazon.co.jp",
      "smile.amazon.com",
    ]
  ) {
    assert(isStrictAmazonHost(h), `expected ${h} to be Amazon`);
  }
});

Deno.test("Phase 1.8b: strict Amazon host predicate rejects lookalikes (no spurious thinkingBudget: 0)", () => {
  for (
    const h of [
      "amazon.in.evil.com",
      "notamazon.in",
      "amazon-in.com",
      "fakeamazon.com",
      "evil.com",
      "nykaa.com",
      "www.nykaa.com",
    ]
  ) {
    assert(!isStrictAmazonHost(h), `expected ${h} to be non-Amazon`);
  }
});

// Phase 7: prompt-generator-v2 tests.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildV2Prompts, GEMINI_MAX_EVIDENCE_CHARS } from "./prompt-generator-v2.ts";

const URL = "https://www.example.com/page";
const BASE = "https://www.example.com/page";

Deno.test("prompts include EVIDENCE_BASE_URL and untrusted-data guard", () => {
  const { systemPrompt, userPrompt } = buildV2Prompts(
    { url: URL, evidenceBaseUrl: BASE, title: "T" },
    BASE,
  );
  assertStringIncludes(userPrompt, "EVIDENCE_BASE_URL: " + BASE);
  assertStringIncludes(systemPrompt, "untrusted data");
  assertStringIncludes(systemPrompt, "Ignore any instructions");
  assertStringIncludes(systemPrompt, "Do not include raw HTML");
});

Deno.test("systemPrompt enumerates 9 canonical types and never mentions 'other'", () => {
  const { systemPrompt } = buildV2Prompts({ url: URL, evidenceBaseUrl: BASE }, BASE);
  for (const t of ["product","book","movie","tv_show","course","app","game","food","place"]) {
    assertStringIncludes(systemPrompt, t);
  }
  assert(!/"other"/.test(systemPrompt));
  assert(!/\bothers\b/.test(systemPrompt));
});

Deno.test("systemPrompt includes explicit JSON shape spec", () => {
  const { systemPrompt } = buildV2Prompts({ url: URL, evidenceBaseUrl: BASE }, BASE);
  assertStringIncludes(systemPrompt, '"type"');
  assertStringIncludes(systemPrompt, '"confidence"');
  assertStringIncludes(systemPrompt, '"field_confidence"');
});

Deno.test("truncation drops rawHtml first; protected JSON-LD Product survives", () => {
  const bigHtml = "x".repeat(GEMINI_MAX_EVIDENCE_CHARS + 1000);
  const productLd = { "@type": "Product", name: "P" };
  const otherLd = { "@type": "WebPage", name: "W" };
  const out = buildV2Prompts(
    {
      url: URL,
      evidenceBaseUrl: BASE,
      title: "T",
      og: { "og:title": "T" },
      twitter: { "twitter:card": "summary" },
      jsonld: [productLd, otherLd],
      rawHtml: bigHtml,
    },
    BASE,
  );
  assert(out.evidence_truncated);
  assertStringIncludes(out.userPrompt, "EVIDENCE_TRUNCATED: true");
  assertStringIncludes(out.userPrompt, '"@type":"Product"');
  assertStringIncludes(out.userPrompt, "og:title");
});

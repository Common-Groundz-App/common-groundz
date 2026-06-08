# Firecrawl Oversize-HTML Tolerance Fix

Small follow-up to the Firecrawl Deterministic Recovery Patch. Closes the one real gap flagged by ChatGPT's review.

## Why

`firecrawl.ts` now exposes `markdown` and `metadata`, and `extractFromFirecrawl()` can recover from them alone. But the HTML size check still bails out of the entire scrape on oversize HTML:

```ts
if (rawHtml.length > MAX_HTML_BYTES) {
  return { ok: false, code: "FIRECRAWL_RESPONSE_TOO_LARGE", ... };
}
```

This contradicts the new "usable if ANY of html / markdown / metadata is present" contract — a 3 MB Nykaa-style HTML payload would still fail even though Firecrawl's `metadata` + `markdown` carry the product data we need.

Markdown is already handled correctly (oversize → `null`, scrape continues).

## Change

In `supabase/functions/analyze-entity-url-v2/firecrawl.ts`, in `runFirecrawlScrape()`:

- **Oversize HTML no longer fails the scrape.** If `rawHtml.length > MAX_HTML_BYTES`, set the local `rawHtml` variable to `""` (drop it) and continue.
- Keep the existing markdown rule unchanged (oversize markdown → `null`).
- Keep the existing "all three missing/empty → `FIRECRAWL_BAD_RESPONSE`" rule unchanged. After the oversize drop, if `rawHtml === ""` **and** `markdown === null` **and** `metadata === null`, return `FIRECRAWL_RESPONSE_TOO_LARGE` (preserves the existing error code when oversize was the actual cause; falls back to `FIRECRAWL_BAD_RESPONSE` only when none of those were the cause).
- Remove the `FirecrawlErrorCode` value `FIRECRAWL_RESPONSE_TOO_LARGE`? **No** — keep it; it's still emitted in the "oversize HTML and nothing else usable" case.

No changes to `index.ts`, `firecrawl_recovery.ts`, V2 response contract, V1, Gemini, Phase 8, frontend, or DB.

## Tests (`firecrawl_test.ts`)

Update / add:

- **Update** existing `"oversize html → FIRECRAWL_RESPONSE_TOO_LARGE"` test: oversize HTML with no metadata/markdown still returns `FIRECRAWL_RESPONSE_TOO_LARGE`. (Same outcome, semantics clarified.)
- **New:** oversize HTML + valid `metadata` → `ok: true`, `html === ""`, `metadata` populated.
- **New:** oversize HTML + valid `markdown` → `ok: true`, `html === ""`, `markdown` populated.
- Keep existing oversize-markdown test (markdown → `null`, scrape ok) unchanged.

## Validation

1. `supabase--test_edge_functions analyze-entity-url-v2` — all green.
2. Deploy.
3. No re-analysis needed for Nykaa (the original URLs didn't trip the HTML cap), but the fix removes a latent failure mode for larger product pages.

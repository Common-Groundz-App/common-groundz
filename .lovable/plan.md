## Summary
Bump recovery-path Firecrawl timeout constants only. HIGH_PRIORITY_* values stay unchanged.

## Changes

### 1. `supabase/functions/analyze-entity-url-v2/firecrawl.ts`
- Update file header comment from "12s budget" to "25 s budget".
- `NORMAL_FIRECRAWL_API_TIMEOUT_MS`: `12_000` → `25_000`
- `NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS`: `12_000` → `27_000`
- `HIGH_PRIORITY_*` constants untouched.

### 2. `supabase/functions/analyze-entity-url-v2/firecrawl_test.ts`
- Update test name and assertion for the default timeout:
  - Rename test from `"default request body includes timeout: 12000"` to `"default request body includes timeout: 25000"`
  - Change `assertEquals((captured as { timeout: number }).timeout, 12000)` to `25000`
- High-priority test asserting `30000` stays unchanged.

## Out of scope
No changes to Gemini keys, pricing, UI, DB, V1, or response/error codes. No queue or worker architecture.
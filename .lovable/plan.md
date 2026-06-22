## What I found in the logs

### ✅ Working as intended
1. **Maccaron (Isntree toner, product)** — `path=non_brand_page_first`, `pageOwnedImageWon=true`, page image beat Google. 1.8c.6-B behaving correctly.
2. **Tira (SKIN1004, product)** — `path=non_brand_page_first`, bounded HTML fetch failed silently (`pageOwnedImageFound=false`, `pageOwnedImageWon=false`), correctly fell back to 5 Google images. The silent-fail path is exactly what 1.8c.6-B specifies.
3. **Brand selection / creation flow** — `create-brand-entity` ran with the authenticated user, created the Isntree brand entity (`384df3f9-…`) from the Maccaron source URL. Caller-provided `entityType=product` correctly threaded into `fetch-url-metadata-lite` (`entityTypeSource: caller`). Brand-vs-product routing is correct.

### 🐛 One real bug — `enrich-brand-data` website detection is broken

Logs show 5 stack traces for Isntree, all identical:

```
⚠️ Error scoring website result: https://isntree-global.com/ TypeError: list.some is not a function
    at matchesExclusion (index.ts:78)
    at scoreWebsiteResult (index.ts:271)
```

**Root cause** — `matchesExclusion(url, categories: string[][])` expects an array-of-arrays. At lines 272–278 of `supabase/functions/enrich-brand-data/index.ts` it's called with a **flat `string[]`** (the hosting-platform list `['lovable.me', 'vercel.app', …]`). Inside the function, `list.some(...)` then runs on a string, which throws.

The try/catch in `scoreWebsiteResult` swallows the error and returns `-100`, so **every candidate** in `findOfficialWebsite` is disqualified, the log prints `❌ No website met quality threshold (best: -100)`, and the brand ends up with `website: null`. Logo search still succeeds via the broad fallback (Isntree got `logoSource=google_broad`), but the official-website field is silently always empty for every brand created through this path.

The other two `matchesExclusion` call sites (lines 281–284 and 392–395) correctly pass `string[][]`, so they're fine — only the hosting-platform check is broken.

### Proposed fix (1 line, no behavior change beyond removing the throw)

In `supabase/functions/enrich-brand-data/index.ts`, wrap the flat list at line 272 in an outer array:

```ts
if (matchesExclusion(link, [[
  'lovable.me', 'vercel.app', 'netlify.app', 'github.io',
  'herokuapp.com', 'replit.dev', 'glitch.me', 'cloudflare.pages.dev',
  'surge.sh', 'render.com', 'railway.app'
]])) {
  score -= 20;
}
```

That's the whole change. After deploying, re-run an Isntree (or any brand) enrichment and confirm:
- No more `TypeError: list.some is not a function` warnings.
- `findOfficialWebsite` log line shows real positive scores instead of `best: -100`.
- The brand entity persists a non-null `website_url`.

### Out of scope
- No changes to 1.8c.6-B image-priority logic (working as designed).
- No changes to `fetch-url-metadata-lite`, `create-brand-entity`, or `analyze-entity-url-v2`.
- Not touching the two correct `matchesExclusion` call sites.

## What's happening

I checked the logs for `resolve-brand-logo` — **there are zero logs, ever**. Then I hit the function directly and got:

```
404 NOT_FOUND — "Requested function was not found"
```

Meanwhile:
- The `entity_extraction.search_brand_logo_lookup_enabled` flag **is ON** in `app_config`.
- The frontend (`SearchEntryPanel.tsx` → `resolveBrandLogos`) **is** calling `supabase.functions.invoke('resolve-brand-logo', …)` after each search.
- The function source (`supabase/functions/resolve-brand-logo/index.ts` + `logo_filters.ts`) exists in the repo.

So the code is wired up correctly — the edge function was simply **never deployed** to Supabase. Every client call is failing with 404 at the network layer, caught by the `catch` block in `resolveBrandLogos`, and the brand key gets added to `resolvedBrandsRef` so we don't retry. That's why the chips stay empty and you see nothing in the logs.

## Fix

Deploy `resolve-brand-logo`. Nothing else needs to change.

### Steps
1. Deploy `supabase/functions/resolve-brand-logo` (includes `index.ts` and `logo_filters.ts`).
2. Smoke test via a direct POST with `{ "brand": "Cetaphil" }` and confirm a 200 response with either a `logoUrl` or a benign `skipReason`.
3. Confirm new `resolve_brand_logo` log lines appear.
4. In the app, run a fresh search (e.g. "babe laboratorios", "chemist at play") and confirm the Review Draft brand chip shows a logo.

### Not changing
- No frontend edits — `SearchEntryPanel.tsx` already handles the response shape correctly.
- No changes to `analyze-entity-url-v2` or its brand logo lookup files.
- No flag / DB changes — flag is already ON.
- No change to `logo_filters.ts` parity copy.

## How to verify on your end
- Open Admin → Feature Flags: confirm "Brand logo lookup (Search rows)" is ON.
- Run a search for a brand that has no existing logo (e.g. "babe laboratorios healthy aging serum").
- Open Review Draft → brand chip should show a logo within ~1–2s.
- If a specific brand comes back empty, that's expected fallback behavior (no Google CSE hit + no favicon) — check the function logs for `source: "none"` to distinguish "not found" from "not called".

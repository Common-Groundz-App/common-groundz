# Post-6 Step 3f — Server-side stock-photo cleanup (plan only)

Remove the last stock-photo producers, which live in three Supabase edge functions. Verified by repo-wide search: these are the only remaining server-side sources of stock image URLs.

## Verified current state

1. `supabase/functions/unified-search-v2/index.ts`
   - Local `getEntityTypeFallbackImage(entityType)` (lines 125–133) maps book/movie/place/default to four hardcoded `images.unsplash.com` URLs.
   - Called from `processImageUrl` when the original URL is empty (line 63) or hits a blocked domain (line 112), and directly for place results with no photo (line 372).
2. `supabase/functions/search-places/index.ts` (line 126)
   - Place results with no Google photo get a hardcoded Unsplash URL.
3. `supabase/functions/search-google-books/index.ts` (line 41)
   - Book results with no cover get a hardcoded Unsplash URL.
4. `supabase/functions/proxy-external-image/index.ts` (line 53)
   - `unsplash.com` appears only in the proxy allowlist — it permits proxying a real Unsplash URL, it does not invent one. Legitimate; keep untouched.

## Change

In all three functions, replace the stock-URL fallback with **no image**:

- Delete `getEntityTypeFallbackImage` from unified-search-v2 and its four Unsplash URLs.
- `processImageUrl` (unified-search-v2) and `processImageUrl` (search-google-books): return `null` (or empty, matching each function's existing response shape) instead of a stock URL when there is no usable real image. Proxying of real Google Places / Google Books / movie images stays exactly as-is.
- search-places and unified-search-v2 place mapping: `imageUrl` starts as `null` and is only set when a real Google photo reference exists.
- Response field stays present (e.g. `image_url: null` / `imageUrl: null`) so client parsing is unchanged — only the value changes from stock URL to null.

## Why this is safe

- Group 6A already migrated the client consumers (EntitySearch rows, My Stuff picker, external search rows) to the shared contract: a null/missing image renders the canonical type icon in the unchanged frame. Null is already a handled, tested state on every consuming surface.
- Write contract is preserved: search rows with no real image now save `image_url: null` exactly, instead of persisting a stock URL. Existing saved rows are untouched (that is Step 4, separately approved).
- No client code changes in this step. No schema changes. No redirects.

## Out of scope (unchanged)

- `proxy-external-image` allowlist (keep).
- All client-side files, including `ImageWithFallback`, `getOptimalEntityImageUrl`, and the legacy-placeholder registry in `entityImageFallback.ts` (still needed to recognize stock URLs already saved in existing records).
- Step 4 (DB tidy-up of already-saved stock URLs) and Step 5 (getOptimalEntityImageUrl decision + final inventory) — separate approvals.

## Verification

1. Repo-wide `rg` after edits: zero Unsplash/stock URLs remain in `supabase/functions/` except the proxy allowlist entry.
2. `bunx tsgo --noEmit` clean; full Vitest suite passes (currently 862); build log clean.
3. Deploy the three edited functions; smoke-test each with a query known to return imageless results and confirm the response carries `image_url: null` (not a stock URL) and results with real photos are unchanged.
4. Update `docs/verification/entity-image-fallback-inventory.md` and `roadmap.md`; stop before Step 4.

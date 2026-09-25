# Post-6 Step 3f — Server-side stock-photo cleanup (revised after review)

Remove the last stock-photo producers, which live in three Supabase edge functions. Verified by repo-wide search: these are the only remaining server-side sources of stock image URLs.

## Verified current state

1. `supabase/functions/unified-search-v2/index.ts`
   - Local `getEntityTypeFallbackImage(entityType)` (lines 125–133) maps book/movie/place/default to four hardcoded `images.unsplash.com` URLs.
   - Called from `processImageUrl` when the original URL is empty (line 63) or hits a blocked domain (line 112), and directly for place results with no photo (line 372).
2. `supabase/functions/search-places/index.ts` (line 126) — place results with no Google photo get a hardcoded Unsplash URL.
3. `supabase/functions/search-google-books/index.ts` (line 41) — book results with no cover get a hardcoded Unsplash URL.
4. `supabase/functions/proxy-external-image/index.ts` (line 53) — `unsplash.com` appears only in the proxy allowlist. It permits proxying a real Unsplash URL, it does not invent one. Legitimate; keep untouched.
5. Client contract (confirmed): `ProductSearchResult.image_url` is declared `string` at `src/hooks/use-unified-search.ts:9` and `src/hooks/use-enhanced-search.ts:9`. `EntitySearchResult.image_url` is already `string | null` in both (line 26).
6. `deno` is available in this environment, so the edge functions can be typechecked directly before deployment.

## Change — server

Replace every stock-URL fallback with **no image**, using `null` consistently. The response field stays present; only its value changes.

- **unified-search-v2**: delete `getEntityTypeFallbackImage` and its four Unsplash URLs. `processImageUrl` becomes `(originalUrl: string, entityType: string): string | null` and returns `null` for an empty original URL and for blocked/unusable domains. Place mapping uses `let imageUrl: string | null = null`, assigned only when a real photo reference exists. Real Google Places, Google Books and Amazon/OMDb images keep their existing proxy handling; other usable URLs keep HTTPS normalization.
- **search-places**: `let imageUrl: string | null = null`, populated only from a real Google photo reference.
- **search-google-books**: `processImageUrl` becomes `(originalUrl: string): string | null`, returning `null` when there is no original URL; real-cover processing and proxying are unchanged.
- **proxy-external-image**: untouched.

## Change — client type contract

This is a type-accuracy correction only, no runtime or visual change:

- `src/hooks/use-unified-search.ts` and `src/hooks/use-enhanced-search.ts`: widen `ProductSearchResult.image_url` to `string | null`.
- Typecheck will surface any consumer that assumed a non-null string. Each is resolved by passing the value straight through to the already-migrated fallback contract — never by re-introducing a placeholder string, `/placeholder.svg`, or a default URL.

## Why this is safe

- Group 6A already migrated the consuming surfaces (external search rows, EntitySearch, My Stuff picker): a null image renders the canonical type icon in the unchanged frame. Null is an existing, tested state.
- Write contract preserved: a search result with no real image now saves `image_url: null` exactly, instead of persisting a stock URL. Existing saved rows are untouched.
- No schema changes, no redirects, no presentation changes.

## Out of scope (unchanged)

- `proxy-external-image` allowlist; legitimate Unsplash images anywhere.
- Deliberate non-entity photos (profile default cover, location search photo, reviews-section founder photo, review avatar default).
- `ImageWithFallback`, `getOptimalEntityImageUrl`, and the legacy-placeholder registry in `entityImageFallback.ts` — still required to recognize stock URLs already saved in historical records.
- Step 4 (DB tidy-up of already-saved stock URLs) and Step 5 (getOptimalEntityImageUrl decision + final inventory) — separate approvals.

## Verification

1. **Direct edge-function check before deployment**: `deno check` each of the three edited functions, so the new `string | null` return types are proven to compile in the Deno runtime rather than assumed.
2. App-side: `bunx tsgo --noEmit` clean after the interface widening; full Vitest suite passes (currently 862); build log clean.
3. Repo-wide `rg` after edits: the only remaining Unsplash references are the `proxy-external-image` allowlist, the deliberate client exceptions listed above, and historical documentation. No server search function creates a stock URL.
4. Deploy the three functions and smoke-test each pair: book with a real cover → real/proxied cover kept; book without → `null`. Place with a photo reference → Google proxy kept; place without → `null`. Movie with a poster → proxied poster kept; movie without → `null`. Blocked/unusable URL → `null`. Then, in the UI, an external row with a null image shows the canonical icon, and selecting it persists `image_url: null`.
5. Update `docs/verification/entity-image-fallback-inventory.md` and `roadmap.md`; stop before Step 4.

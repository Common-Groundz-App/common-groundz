# Post-6 Step 3f — server-side stock-photo producers removed (2026-09-25)

## What changed

Three Supabase edge functions were manufacturing stock photos for results that had no real provider image. All three now return `image_url: null`. The field is still present in every response; only the value changed.

| Function | Before | After |
| --- | --- | --- |
| `unified-search-v2` | local `getEntityTypeFallbackImage` mapping book/movie/place/default to four `images.unsplash.com` URLs; used for empty URLs, blocked domains, and photoless places | helper deleted; `processImageUrl(originalUrl, entityType): string \| null` returns `null` for empty URL and blocked domains; place mapping starts at `let imageUrl: string \| null = null` |
| `search-places` | hardcoded Unsplash place photo as the initial `imageUrl` | `let imageUrl: string \| null = null`, set only from a real Google photo reference |
| `search-google-books` | hardcoded Unsplash book cover when a volume had no cover | `processImageUrl(originalUrl): string \| null` returns `null` when there is no original URL |

Real provider imagery is untouched: Google Places photo references, Google Books covers and Amazon/OMDb posters keep their existing proxy handling, and other usable URLs keep HTTPS normalization.

`proxy-external-image` is unchanged. Its `unsplash.com` / `images.unsplash.com` entries are an allowlist for proxying legitimate images the user actually supplied — it never invents a URL.

## Client type contract

`ProductSearchResult.image_url` was declared `string` in `src/hooks/use-unified-search.ts` and `src/hooks/use-enhanced-search.ts` while the server now intentionally returns `null`. Both were widened to `string | null`. `EntitySearchResult.image_url` was already nullable. This is a type-accuracy correction only: `bunx tsgo --noEmit` passed with no consumer errors, confirming no rendering path assumed a non-null string. No component, frame or behaviour changed.

## Verification

1. **Direct Deno typecheck before deployment** — `deno check` on each of the three functions. `search-places` is fully clean. The six errors in `unified-search-v2` and one in `search-google-books` are pre-existing and unrelated (`TS18046 'error' is of type 'unknown'` in catch clauses, and `TS2322 any[] not assignable to never[]` from untyped array initializers). No nullability error appeared, which was the purpose of this check.
2. **App side** — `bunx tsgo --noEmit` clean; 862/862 Vitest tests pass; build clean.
3. **Repo-wide sweep** — the only `images.unsplash.com` occurrences left under `supabase/` are the `proxy-external-image` allowlist. Client occurrences are the legacy-placeholder registry, its tests, and the documented deliberate exceptions (profile default cover, location search photo, review avatar default, `ImageWithFallback`'s relay-domain list).
4. **Live smoke tests after deployment:**
   - Books: 10/10 results for "atomic habits" kept their real proxied Google Books covers. No stock URL.
   - Places: 101 results sampled across six queries. 90 kept their real Google photo proxy URLs; **11 returned `image_url: null`** (bank ATMs and similar photoless listings) where they previously received a stock cafe photo. No stock URL in any response.
   - `unified-search-v2`: quick-mode search returned entities, products and reviews with no stock URL anywhere in the payload.

## Not observed live

No coverless Google Books volume appeared in the sampled queries — Google returned a thumbnail for every result, and the Books API rate-limited the attempt to hunt one down directly. That branch is a two-line `if (!originalUrl) return null`, proven by typecheck and static reading but not exercised against the live API. The equivalent place branch **was** exercised live (the 11 nulls above), which covers the same pattern.

The UI leg (an external row with a null image showing the canonical icon, and selecting it persisting `image_url: null`) is covered by the existing Group 6A tests in `src/components/search/group6LivePickers.test.tsx` and `src/hooks/useEntitySearchWritePaths.test.tsx`, not by an authenticated session — auth is `external_unmanaged`, so no admin runtime capture is available.

## Out of scope / still open

- Step 4 — optional database tidy-up of already-saved stock URLs (needs its own approval).
- Step 5 — the `getOptimalEntityImageUrl` decision and the final inventory audit.



## Verdict: Ship the plan as-is. Skip Codex's "exact host from config" addition.

ChatGPT signs off with no additions. Codex suggests matching `isOurProxyUrl` against an allow-list of exact proxy hosts pulled from config. **I'm declining this one** — here's why:

1. **We already have one source of truth for the host** — `SUPABASE_URL` in `src/integrations/supabase/client.ts` (`https://uyjtgybbktgapspodajy.supabase.co`). Pulling it through a new "config" indirection adds a layer for zero practical benefit — there's exactly one Supabase project for this app.
2. **The check `hostname.endsWith('supabase.co') && pathname.startsWith('/functions/v1/proxy-')` is already strict enough.** The only false-positive scenario would require an attacker to control a `*.supabase.co` subdomain AND host a path starting with `/functions/v1/proxy-`. That's not a realistic threat for a client-side image-URL guard whose only job is "don't double-wrap our own proxy."
3. **YAGNI.** Adding config indirection now, for a hypothetical multi-project future, is the kind of premature abstraction we should resist. If we ever go multi-project, we add it then in one place.

If you want extra strictness without the config layer, I can tighten the hostname check to `hostname === new URL(SUPABASE_URL).hostname` — exact match against the one project we have. **I'll include that as the strict form** since it's a one-line change and removes any subdomain ambiguity. Best of both worlds, no new config surface.

---

## Final plan (4 files, all small)

### 1. `src/utils/imageUtils.ts`

Import the Supabase URL once at module top, derive the canonical hostname, then use it in a small helper:
```ts
import { SUPABASE_URL } from '@/integrations/supabase/client'; 
// (or hardcode-derive — see note below)

const SUPABASE_HOSTNAME = new URL(SUPABASE_URL).hostname;

const isOurProxyUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.hostname === SUPABASE_HOSTNAME 
      && u.pathname.startsWith('/functions/v1/proxy-');
  } catch {
    return false;
  }
};
```
Note: if `SUPABASE_URL` isn't currently exported from `client.ts`, I'll either export it (one-line addition, no behavior change) or compute the hostname from the existing constant inline. No new env var, no new config file.

Use `isOurProxyUrl` as the first check in:
- `getProxyUrlForImage()` → if true, return `originalUrl` untouched
- `isCorsProblematic()` → if true, return `false`

### 2. `src/components/common/ImageWithFallback.tsx`
- Add module-level: `const DEBUG_IMAGES = import.meta.env.DEV && import.meta.env.VITE_DEBUG_IMAGES === 'true';`
- Wrap all 4 `console.log` calls with `if (DEBUG_IMAGES && !suppressConsoleErrors)`
- Default-off in dev, opt-in via `.env`, always-off in production
- Per-call `suppressConsoleErrors` prop still acts as a hard override

### 3. `src/components/feed/UnifiedEntitySelector.tsx`
- Pass `suppressConsoleErrors` to `<ImageWithFallback />` in result rows (belt-and-braces with the env flag)

### 4. `src/hooks/use-enhanced-realtime-search.ts`
- Wire `signal: controller.signal` into both `supabase.functions.invoke()` calls (with `@ts-expect-error` cast since SDK types may not expose it)
- Add post-await `if (controller.signal.aborted) return;` guard before `setResults(...)` in both `performLocalSearch` and `performExternalSearch` (works even if SDK ignores signal)
- Split single `abortControllerRef` into `localAbortRef` and `externalAbortRef`
- Bump debounces: `LOCAL_DEBOUNCE_MS` 300 → 450, `EXTERNAL_DEBOUNCE_MS` 800 → 1100
- Keep `MIN_EXTERNAL_QUERY_LENGTH = 4` (already enforced before invoke at the top of `performExternalSearch`)
- Add `lastLocalQueryRef` for local query dedupe (mirror of existing `lastExternalQueryRef`)
- Catch blocks: skip log when `err.name === 'AbortError'` or message includes `'Failed to fetch'` / `'aborted'`

---

## Explicitly NOT touching

- ❌ No edge function changes (`unified-search-v2`, `proxy-*` all correct given correct inputs)
- ❌ No whitelist additions to `proxy-external-image`
- ❌ No new config/env file for proxy hosts (Codex's suggestion declined — YAGNI)
- ❌ No changes to `UnifiedEntitySelector.handleExternalSelect` logic (entity-selection fix intact)
- ❌ No changes to `structured_fields.location` flow
- ❌ No changes to `EnhancedSearchInput.tsx`
- ❌ No global behavior change to `ImageWithFallback` — only logging is gated; URL processing, fallback chain, CORS mode all unchanged
- ❌ No 406 fix this pass (deferred — separate trace later if needed)
- ❌ No new caching/batching/priority-queue layer (out of scope; ChatGPT's "smart caching + ranking layer" tease is a future enhancement)
- ❌ No changes to `MIN_EXTERNAL_QUERY_LENGTH` (stays 4)
- ❌ No changes to mentions, hashtags, sound, post submission, comments, structured_fields schema

## Verification

1. `/create` → type "malika biryani" slowly → console clean (no 403s, no "Processing image URL" spam)
2. `/create` → burst-type "inception" → at most 1–2 `unified-search-v2` requests in Network tab; no `OPTIONS 502`, no `net::ERR_FAILED`, no CORS errors
3. Edit query mid-search → previous request silently cancelled or its response discarded; no error log
4. Network tab: zero requests to `proxy-external-image?url=https%3A%2F%2F...supabase.co...` (no double-wrapping)
5. Same clean behavior on `/explore` search (proves shared fix works in both surfaces — Explore uses same hook + same image component)
6. Movie/book thumbnails load via correct first-level proxy or fall back silently
7. Entity selection still works (Mallika Biryani still tags) — last turn's fix intact
8. Location pin still writes `structured_fields.location` — last turn's fix intact
9. Set `VITE_DEBUG_IMAGES=true` in `.env` and reload → image logs reappear (proves the flag works)
10. Submit post → entity in `post_entities`, location in `structured_fields.location`
11. Edge case: a URL with `supabase.co/functions/v1/proxy-` as a query-param value (not as the actual hostname/path) is still proxied normally — proves URL-parsing is robust vs substring-matching
12. Edge case: a URL on `*.supabase.co` that isn't our project (hypothetical) is no longer treated as our proxy — exact hostname match prevents subdomain false-positives


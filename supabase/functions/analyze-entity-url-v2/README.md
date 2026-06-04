# analyze-entity-url-v2

**Status:** Phase 2 — scaffold only. Admin-only. NOT wired to the UI.

## What this is

A brand-new, isolated edge function that will eventually replace
`analyze-entity-url` (V1). In Phase 2 it does **not** perform any extraction.
It returns a locked stub envelope so the V2 response contract is stable from
the start.

## What this is NOT (Phase 2)

- Not called from the frontend. `CreateEntityDialog` continues to invoke V1.
- Not running Gemini, Firecrawl, or any fetch against the user-supplied URL.
- Not doing SSRF/private-IP protection, category matching, brand creation,
  or image extraction.
- Not reading or writing any database tables.
- Does not import anything from `supabase/functions/analyze-entity-url/`.

## Auth model (matches V1)

`supabase/config.toml` sets `verify_jwt = false` for this function so we can
return our own CORS-safe error envelope. Auth is enforced manually inside
the function:

| Scenario | Status | Code |
|---|---|---|
| Admin + valid http(s) URL | 200 | success envelope |
| Non-admin authenticated user | 403 | `NOT_ADMIN` |
| Missing `Authorization` header | 401 | `MISSING_AUTH` |
| Invalid / expired bearer token | 401 | `INVALID_TOKEN` |
| Non-POST request | 405 | `METHOD_NOT_ALLOWED` |
| Body is not JSON | 400 | `INVALID_JSON` |
| Body fails Zod validation | 400 | `INVALID_URL` (with `details`) |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

## Locked response envelope (final V2 contract)

```ts
{
  success: true,
  predictions: null,
  metadata: {
    analyzed_url: string,
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: string,                // 'stub' in Phase 2
    timestamp: string,             // ISO
    used_url_context: boolean,     // false in Phase 2
    used_google_search: boolean,   // false in Phase 2
    used_firecrawl: boolean,       // false in Phase 2
    phase?: number,                // DIAGNOSTIC-ONLY, do not branch on this
    stage?: string                 // DIAGNOSTIC-ONLY, do not branch on this
  },
  warnings?: string[]
}
```

Error envelope:

```ts
{ success: false, error: string, code: V2ErrorCode, details?: unknown }
```

`error` is **always** a string. Structured info goes in `details`.

## Phase roadmap

- **Phase 1 ✅** — `entity_extraction.version` admin flag.
- **Phase 2 ✅ (this)** — scaffold + locked envelope.
- **Phase 3** — wire `CreateEntityDialog` to route via `useAnalyzeUrlEngine()`. Still no extraction here.
- **Phase 4+** — SSRF protection, exact-page extraction, Firecrawl, Gemini URL Context, category matching, preview UX.

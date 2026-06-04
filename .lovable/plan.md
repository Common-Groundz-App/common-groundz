# Phase 2 — Scaffold `analyze-entity-url-v2` edge function (final)

Incorporates all ChatGPT + Codex feedback across both review rounds.

## V1 parity confirmation
`supabase/config.toml` already contains:
```toml
[functions.analyze-entity-url]
verify_jwt = false
```
So adding the matching block for V2 is parity-only, not a behavior change for V1.

## Goal
Stand up a brand-new, **isolated** V2 edge function that admins can invoke directly (curl / Supabase SDK) to validate scaffolding, auth gating, request validation, and the final V2 response contract — **without** touching V1 and **without** wiring the frontend.

Phase 2 ships **scaffold only**. No extraction logic. Phase 3 = routing only.

## Non-goals (explicit)
- No changes to `supabase/functions/analyze-entity-url/` (V1 byte-identical).
- No imports from V1 helpers (`prompt-generator.ts`, etc.).
- No frontend routing. `CreateEntityDialog` keeps calling V1 unconditionally.
- No DB migrations.
- No new secrets.
- No Gemini / Firecrawl / SSRF fetch / brand creation / category matching / image extraction.

## Scope of changes

### New files

**1. `supabase/functions/analyze-entity-url-v2/schema.ts`**
- Pinned Deno-compatible Zod import: `import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";`
- Zod schema for the request body:
  - `url`: string, 1–2048 chars, must parse as URL, scheme must be `http:` or `https:`.
- Exported TypeScript types: `V2SuccessResponse`, `V2ErrorResponse`, `V2ErrorCode`.
- Exported constants: `EXTRACTION_VERSION = 'v2'`, `EDGE_FUNCTION_NAME = 'analyze-entity-url-v2'`.
- Doc comment: `phase` and `stage` in metadata are **diagnostic-only**, not part of the stable contract. Phase 3+ MUST NOT branch on them.

**2. `supabase/functions/analyze-entity-url-v2/index.ts`**
- CORS preflight (`OPTIONS` → 200), header set identical to V1: `authorization, x-client-info, apikey, content-type`.
- **Method gate**: anything other than `POST` (after `OPTIONS`) → `405 { success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }`.
- Auth gate (mirrors V1 exactly):
  - Missing `Authorization: Bearer …` → `401 MISSING_AUTH`.
  - `auth.getClaims` invalid → `401 INVALID_TOKEN`.
  - Service-role `has_role(uid, 'admin')` false/error → `403 NOT_ADMIN`.
- **Body parse**: wrap `req.json()` in try/catch. Failure → `400 { success: false, error: 'Invalid JSON body', code: 'INVALID_JSON' }`.
- **Zod validation**: failure → `400 { success: false, error: 'Invalid request', code: 'INVALID_URL', details: <z.flatten()> }`.
- Success → 200 with the **locked Phase 2 stub response** (below).
- Unknown error → `500 { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' }` (details only via `console.error`, never in response body).

**3. `supabase/functions/analyze-entity-url-v2/README.md`**
- Admin-only, NOT wired to UI, Phase 2 = scaffold only, V1 untouched.
- States the response envelope is the **final** V2 contract.
- States `phase` / `stage` are diagnostic-only.

### Files modified

**`supabase/config.toml`** — append one block (parity with V1):
```toml
[functions.analyze-entity-url-v2]
verify_jwt = false
```

### Files NOT touched
- Anything under `supabase/functions/analyze-entity-url/`.
- All frontend files. `useAnalyzeUrlEngine` continues to have zero callers.
- Database / RPCs / secrets.

## Locked Phase 2 stub response (admin + valid URL → 200)
```ts
{
  success: true,
  predictions: null,
  metadata: {
    analyzed_url: url,
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: 'stub',
    timestamp: new Date().toISOString(),
    used_url_context: false,
    used_google_search: false,
    used_firecrawl: false,
    phase: 2,        // diagnostic-only
    stage: 'scaffold' // diagnostic-only
  },
  warnings: ['stub: extraction not yet implemented']
}
```

## Locked error envelope (used everywhere)
```ts
{
  success: false,
  error: string,           // ALWAYS a string
  code: V2ErrorCode,
  details?: unknown        // optional, only for Zod field errors
}
```
Codes used in Phase 2: `MISSING_AUTH`, `INVALID_TOKEN`, `NOT_ADMIN`, `METHOD_NOT_ALLOWED`, `INVALID_JSON`, `INVALID_URL`, `INTERNAL_ERROR`.

## Expected behavior after Phase 2
| Scenario | Status | Code |
|---|---|---|
| Admin + valid http(s) URL | 200 | success envelope above |
| Non-admin authenticated user | 403 | `NOT_ADMIN` |
| No `Authorization` header | 401 | `MISSING_AUTH` |
| Garbage / expired bearer | 401 | `INVALID_TOKEN` |
| `GET` / `PUT` / `DELETE` | 405 | `METHOD_NOT_ALLOWED` |
| Body is not JSON | 400 | `INVALID_JSON` |
| `{}` (missing `url`) | 400 | `INVALID_URL` |
| `{ url: "not a url" }` | 400 | `INVALID_URL` |
| `{ url: "mailto:a@b" }` | 400 | `INVALID_URL` |
| `{ url: "file:///etc/passwd" }` | 400 | `INVALID_URL` |
| `{ url: "javascript:alert(1)" }` | 400 | `INVALID_URL` |
| `url` length > 2048 | 400 | `INVALID_URL` |

V1 behavior **completely unchanged**. Admin flag flip `v1` ↔ `v2` still has zero UI effect (no routing yet).

## Testing checklist (manual, via Supabase dashboard + curl)
- [ ] Admin invoke `{ "url": "https://example.com" }` → 200, exact locked envelope.
- [ ] Admin invoke `{}` → 400 `INVALID_URL`, `details` present.
- [ ] Admin invoke with body `not-json` → 400 `INVALID_JSON`.
- [ ] Admin `curl -X GET` → 405 `METHOD_NOT_ALLOWED`.
- [ ] `{ "url": "mailto:a@b.com" }` → 400 `INVALID_URL`.
- [ ] `{ "url": "file:///etc/passwd" }` → 400 `INVALID_URL`.
- [ ] curl no `Authorization` → 401 `MISSING_AUTH` (proves `verify_jwt = false` honored).
- [ ] curl bogus bearer → 401 `INVALID_TOKEN`.
- [ ] Non-admin logged-in → 403 `NOT_ADMIN`.
- [ ] V1 still works: Create Entity → Analyze URL → identical output.
- [ ] Flip admin flag v1↔v2 → no UI change anywhere.
- [ ] Edge function logs show structured `console.error` only on 500s; no tokens / PII leaked.

## Risks / rollback
- Minimal. New isolated route, no callers.
- The `config.toml` edit is additive; does not affect any other function.
- Rollback: delete `supabase/functions/analyze-entity-url-v2/` + remove the new `config.toml` block.

## Phase boundaries (reaffirmed)
- **Phase 1 ✅** — `entity_extraction.version` flag + admin selector UI.
- **Phase 2 (this plan)** — V2 edge function scaffold.
- **Phase 3** — Centralized routing in `CreateEntityDialog` via `useAnalyzeUrlEngine()`. Still no extraction logic in V2.
- **Phase 4+** — SSRF protections, exact-page extraction, Firecrawl, Gemini URL Context, category matching, preview UX.

## Deliverables when Phase 2 is complete
- Files changed list
- Final stub response shape (paste actual JSON from a real admin call)
- Auth test results (admin / non-admin / missing token / invalid token)
- Method + JSON + URL validation results
- Confirmation V1 is untouched
- Confirmation `CreateEntityDialog` still calls V1 only
- Confirmation admin engine flag flip has no UI effect
- Any issues surfaced before Phase 3

Awaiting approval to implement.
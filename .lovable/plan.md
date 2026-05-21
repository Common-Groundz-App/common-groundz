# Root cause

ChatGPT's diagnosis is correct. I verified it directly by hitting the deployed edge function with a real CORS preflight:

```
OPTIONS /functions/v1/mux-create-upload
Origin: https://commongroundz.co
→ access-control-allow-origin: https://commongroundz.co/   ← trailing slash

OPTIONS /functions/v1/mux-create-upload
Origin: https://preview--common-groundz.lovable.app
→ access-control-allow-origin: https://commongroundz.co/   ← wrong origin entirely
```

Two bugs combine to break every upload:

1. **`MUX_ALLOWED_ORIGINS` secret has trailing slashes.** The first entry is `https://commongroundz.co/`. The browser's `Origin` header never has a trailing slash, so the exact-match check in `buildCors` fails for *every* origin.

2. **`buildCors` silently falls back to `allowed[0]`** when no match is found, returning a wrong-but-real origin. The browser then rejects the preflight (`Access-Control-Allow-Origin` doesn't match the request `Origin`), so the `fetch` never actually reaches the function. That's exactly the symptom we see:
   - `mux_upload_failure` with `stage: 'create_upload'`, error `"Failed to send a request to the Edge Function"`
   - No corresponding invocation logged on the function side (logs only show shutdowns, no boot for the failed call)

The `"Error ensuring bucket policies for post_media"` line above it is unrelated noise — `ensureBucketPolicies` returns `false` and does not throw, so it doesn't affect the Mux flow. The "Preparing video…" → "Upload failed" UX you saw is the poster step succeeding, then `create_upload` blowing up on CORS.

So both the secret AND the function code are wrong, and either alone would still leave a footgun. We fix both.

# Plan

### 1. Update the `MUX_ALLOWED_ORIGINS` secret

Set it to the four real origins, no trailing slashes, no spaces:

```
https://commongroundz.co,https://preview--common-groundz.lovable.app,https://common-groundz.lovable.app,https://id-preview--1ce0faa5-5842-4fa5-acb5-1f9e3bdad6b9.lovable.app
```

(Includes the sandbox preview origin so in-app testing also works.)

### 2. Harden `buildCors` in `supabase/functions/mux-create-upload/index.ts`

- Normalize allowlist entries: trim whitespace and strip any trailing `/` defensively, so a future bad secret value can't break CORS again.
- If the request `Origin` is present and matches an allowlisted origin → echo that exact origin in `Access-Control-Allow-Origin`.
- If the `Origin` is present but does NOT match → do not set `Access-Control-Allow-Origin` at all (browser will block, which is correct), and let the existing `origin_not_allowed` 403 path handle non-OPTIONS requests. Critically: **never fall back to `allowed[0]`** for a browser request — that's the bug that masked the real problem.
- If `Origin` header is absent (server-to-server / native) → no ACAO header needed.
- Apply the same matching logic to the OPTIONS preflight response (already shared via `buildCors`, just need to make sure it goes through the same path).

### 3. Verify after redeploy

- Re-run the same `curl -X OPTIONS` from step 0 with `Origin: https://commongroundz.co` and `Origin: https://preview--common-groundz.lovable.app`. Expect each to echo back its own exact origin.
- In the browser at `/create` on both `commongroundz.co` and the preview URL: upload a small video. Expect:
  - `mux_upload_attempt` → `mux_upload_success` analytics events
  - Composer preview shows poster + "Processing video…" badge (not "Preparing" then "Upload failed")
  - A row in `mux_uploads` with `status='waiting'`
- Then run the full Gate 2 JSONB round-trip (submit post, refresh, inspect saved media JSON).

### Scope guardrails

- Only `supabase/functions/mux-create-upload/index.ts` and the `MUX_ALLOWED_ORIGINS` secret change.
- No client changes. No analytics changes. No playback / FeedVideo / Lightbox / mediaService changes.
- `VITE_MUX_UPLOAD_ENABLED` stays `true` only for this verification window, then back to `false` at Gate 4 as previously agreed.

# What to tell Lovable

> CORS is broken on `mux-create-upload`. The `MUX_ALLOWED_ORIGINS` secret has trailing slashes, and `buildCors` falls back to `allowed[0]` when the Origin doesn't match — so every browser request gets a wrong `Access-Control-Allow-Origin` and the preflight fails before the function is ever invoked. Fix the secret (no trailing slashes, include all four origins) AND harden `buildCors` to (a) normalize allowlist entries by stripping trailing `/`, (b) echo the request Origin only when it exactly matches the allowlist, and (c) never fall back to `allowed[0]` for browser requests. Then redeploy and rerun Gate 2.

# Mux Phase 1 — Final plan (all reviewer guardrails included)

Backend-only. Zero `src/` changes. Approve and I'll start with the migration.

---

## 1. Secrets (added via prompts, not committed)
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SIGNING_SECRET` — added after webhook deploys and you register the URL in Mux
- `MUX_TEST_MODE` — `"true"` to start, `"false"` for real users
- `MUX_ALLOWED_ORIGINS` — comma-separated, e.g. `https://common-groundz.lovable.app,https://id-preview--1ce0faa5-5842-4fa5-acb5-1f9e3bdad6b9.lovable.app`

---

## 2. Database migration

Two tables, one enum, one trigger.

```text
type mux_upload_status =
  'waiting' | 'asset_created' | 'ready' | 'errored' | 'cancelled'

mux_uploads
  id              uuid pk
  user_id         uuid not null
  upload_id       text unique not null
  asset_id        text unique
  playback_id     text
  status          mux_upload_status not null default 'waiting'
  duration        numeric
  aspect_ratio    text
  max_resolution  text
  error           text
  is_test         boolean not null default false
  expires_at      timestamptz not null
  last_event_at   timestamptz
  created_at      timestamptz default now()
  updated_at      timestamptz default now()

mux_webhook_events           -- durable, global idempotency log
  event_id     text primary key      -- Mux-Webhook-Id header
  event_type   text not null
  upload_id    text
  asset_id     text
  received_at  timestamptz default now()
```

**Indexes:** unique on `upload_id` and `asset_id`; composite on `(user_id, status, created_at desc)` for rate-limit query; `(user_id, created_at desc)`.

**RLS:**
- `mux_uploads`: owner can select; only service role can write.
- `mux_webhook_events`: service role only for everything.

**Monotonic-status trigger** on `mux_uploads`: blocks backwards transitions (`ready → asset_created`, etc.). Out-of-order webhooks become silent no-ops.

---

## 3. `mux-create-upload` edge function

- JWT validated in code via `getClaims()`.
- **Origin policy (explicit):**
  - If `Origin` header present → must be in `MUX_ALLOWED_ORIGINS`, else 403.
  - If `Origin` absent (mobile/native/server-to-server) → allowed when JWT is valid. Documented in a top-of-file comment so it's not mistaken for an oversight.
  - `cors_origin` sent to Mux = first entry of `MUX_ALLOWED_ORIGINS` (Mux only accepts one).
- **Two-layer rate limit per user** (both must pass):
  - In-flight cap: ≤10 rows where `status in ('waiting','asset_created')` AND `expires_at > now()`.
  - Burst cap: ≤20 `created_at` in the last 10 minutes.
  - Either → 429 with `Retry-After`.
- POSTs to Mux `/video/v1/uploads`:
  ```json
  {
    "cors_origin": "<from env>",
    "timeout": 3600,
    "test": <MUX_TEST_MODE>,
    "new_asset_settings": {
      "playback_policy": ["public"],
      "video_quality": "basic"
    }
  }
  ```
  Field names are locked to a single `MUX_FIELDS` constant — verified against current Mux Direct Upload API docs before coding.
- **`expires_at` precedence:** use Mux response's `data.timeout` (or expiry, if returned) to compute `expires_at = response.created_at + timeout`. Fallback: `now() + 1 hour`.
- Inserts `mux_uploads` row with `status='waiting'`, `is_test=<env>`, `expires_at` per above.
- Returns `{ uploadUrl, uploadId, expiresAt }`.

---

## 4. `mux-webhook` edge function

- `verify_jwt = false` in `supabase/config.toml`.
- **Raw-body-first ordering — structurally enforced:**
  ```ts
  const raw = await req.text();          // 1. raw body, never re-read
  verifySignature(raw, headers);          // 2. HMAC over `${ts}.${raw}`
  checkReplay(headers);                   // 3. reject if |now-ts| > 300s
  const event = JSON.parse(raw);          // 4. only now
  ```
  No `req.json()` anywhere in the file.
- Constant-time HMAC compare. Signature fail → 401 (so Mux's retry log surfaces drift).
- **Durable idempotency:** `insert into mux_webhook_events(event_id,…) on conflict do nothing returning event_id`. No row returned → duplicate, return 200, skip downstream work.
- **Explicit event correlation:**
  - `video.upload.asset_created` → match by `upload_id`, set `asset_id`, `status='asset_created'`.
  - `video.asset.ready` → match by `asset_id`; if 0 rows, fall back to `upload_id` from payload. Set `playback_id` (first public policy), `duration`, `aspect_ratio`, `max_resolution`, `status='ready'`.
  - `video.asset.errored` → set `error`, `status='errored'`. Same fallback chain.
  - Any other event type → still logged to `mux_webhook_events`, 200 returned.
- Monotonic-status trigger handles out-of-order at the DB layer.

---

## 5. `supabase/config.toml`
Append:
```toml
[functions.mux-webhook]
verify_jwt = false
```
`mux-create-upload` uses the default (JWT validated in code).

---

## 6. Your steps after deploy
1. Mux dashboard → Settings → Webhooks → add `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/mux-webhook`.
2. Copy the signing secret → paste into the `MUX_WEBHOOK_SIGNING_SECRET` prompt I'll trigger.

---

## Documented tradeoffs
- `playback_policy: ['public']` — fine for open feed; Phase 6 can swap to signed.
- `video_quality: 'basic'` — 720p cap, phone-first; easy upgrade for new uploads later.
- `MUX_TEST_MODE=true` initially — test assets auto-deleted by Mux in 24h, zero billed minutes.
- Single Mux token across envs for now (Phase 6 splits).
- No `mux_uploads ↔ post_id` link yet — Phase 5 wires Mux fields into the post's `media` JSON.
- Abandoned uploads age out via `expires_at`; rate-limit math ignores them. Sweep job is Phase 6.
- Missing `Origin` is **allowed** with valid JWT (mobile/native).

---

## Acceptance test
1. Call `mux-create-upload` from browser → 200 with `uploadUrl`/`uploadId`/`expiresAt`. Row exists, `is_test=true`, `expires_at` matches Mux response.
2. PUT small MP4 to `uploadUrl` → within ~30s row reaches `status='ready'` with `asset_id`, `playback_id`, `duration`, `aspect_ratio`, `max_resolution`.
3. Replay webhook delivery → 200, no DB writes (idempotency).
4. Tamper body → 401.
5. Stale signature timestamp → 401.
6. 11th rapid create-upload → 429.
7. 21st create-upload in 10 min → 429.
8. Browser request with disallowed Origin → 403.
9. Request without Origin + valid JWT → 200 (documents mobile path).
10. Simulated out-of-order: replay `ready` before `asset_created` → ready handler succeeds via upload_id fallback; later `asset_created` no-ops via monotonic trigger.
11. `git diff src/` → empty.

---

## Files
**Created**
- `supabase/migrations/<ts>_mux_phase1.sql`
- `supabase/functions/mux-create-upload/index.ts`
- `supabase/functions/mux-webhook/index.ts`

**Modified**
- `supabase/config.toml` (one block appended)

**Untouched**
Everything in `src/`, every existing edge function, image upload, entity media, FeedVideo/FeedCollage/PostMediaDisplay/LightboxPreview, scrubber, iOS autoplay fix, VideoHandoff.

---

## Rollback
Drop both tables + enum, delete both functions, remove the config block, delete the five secrets. App unaffected — no `src/` code references any of it yet.

---

Approve and I'll start with the migration (its own approval step), deploy both functions, then trigger the secret prompts in order: Mux credentials + test mode + allowed origins first, then `MUX_WEBHOOK_SIGNING_SECRET` after you register the webhook URL.
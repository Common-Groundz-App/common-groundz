# Private Video Views + Composer Compatibility Badge

Quietly collect reliable private video view data and improve upload confidence. No public view counts. No transcoding.

## What we're building

1. **`media_views` table** — private, future-proof schema for video view events.
2. **`track-media-view` edge function** — only entry point for inserts; enforces the "real view" rule.
3. **`useVideoViewTracker` hook** — fires once per visible+playing video after ≥ 2500ms.
4. **`FeedVideo` wiring** — opt-in via `sourceId` (only `source = 'post'` for now).
5. **Composer compatibility badge** — soft, persistent inline status on the upload row.

No UI surface shows view counts anywhere.

---

## 1. `media_views` table (migration)

Columns:
- `id` uuid pk
- `source` text — `'post' | 'review' | 'entity'`, default `'post'`
- `source_id` uuid not null
- `media_path` text not null — storage path, no protocol/host, no query string, **original casing preserved**
- `user_id` uuid nullable (logged-in viewer)
- `anon_session_id` text nullable (guest viewer, from localStorage)
- `was_autoplay` bool
- `watch_ms` int (>= 0 in DB; function enforces >= 2500)
- `ip_hash` text nullable (SHA-256 with `VIEW_IP_SALT`)
- `tracker_version` text default `'v1'`
- `viewed_at` timestamptz default `now()`

Indexes:
- Unique partial: `(user_id, source, source_id, media_path) WHERE user_id IS NOT NULL`
- Unique partial: `(anon_session_id, source, source_id, media_path) WHERE user_id IS NULL AND anon_session_id IS NOT NULL`
- `(source, source_id)` for future aggregation
- `(viewed_at)` for time-window reads

RLS:
- Enabled.
- **No public INSERT, no public SELECT.**
- `service_role`: full access (function writes; admins read via future tooling).

Constraint: `watch_ms >= 0`, `source IN ('post','review','entity')`.

## 2. Edge function `track-media-view`

`supabase/functions/track-media-view/index.ts`, `verify_jwt = false` in `config.toml`.

- CORS preflight handled.
- Zod body: `{ source: 'post'|'review'|'entity', sourceId: uuid, mediaPath: string, wasAutoplay: bool, watchMs: int, anonSessionId?: string, trackerVersion?: string }`.
- Reject if `watchMs < 2500` → `{ ok: false, reason: 'too_short' }` 200.
- Resolve `user_id` from JWT if present (anon key call still gives us the bearer).
- If `VIEW_IP_SALT` set: hash first IP from `x-forwarded-for` (SHA-256). Otherwise skip.
- Optional in-memory per-IP throttle (60/min). Skip silently if salt missing.
- Normalize `mediaPath` server-side too (defense in depth): strip protocol/host + query, **keep casing**.
- Insert via service-role client. Swallow unique violation as `{ ok: true, deduped: true }`.
- Errors return generic `{ ok: false }` 200 (never throws to client).

Secret needed: `VIEW_IP_SALT` (best-effort, function works without it).

## 3. `useVideoViewTracker` hook

`src/hooks/useVideoViewTracker.ts`

- Args: `{ videoRef, source?: 'post'|'review'|'entity', sourceId?: string, mediaPath: string, autoplayRef }`.
- **No-op silently** if `sourceId` missing.
- IntersectionObserver (≥ 50% visible) + `playing` state → start a timer; accumulates `watch_ms` while visible+playing+tab-visible.
- When `watch_ms >= 2500` and not yet sent for this mount → POST once, mark sent.
- `anon_session_id`: read/create in `localStorage` (`cg_anon_session_id`), uuid v4.
- Silent on failure.

## 4. `FeedVideo` wiring

- Add optional props `source?: 'post'|'review'|'entity'` (default `'post'`) and `sourceId?: string`.
- Compute `mediaPath` via new helper `extractMediaPath(item.url)` in `src/utils/mediaPath.ts`:
  - Parse URL, drop protocol+host, drop search/hash.
  - **Preserve original casing** (Supabase Storage is case-sensitive).
  - Fall back to raw input if URL parse fails.
- Call `useVideoViewTracker` with `videoRef`, `autoplayRef`, `source`, `sourceId`, `mediaPath`.
- Existing `analytics.trackVideoPlayed/Progress/Completed` console events untouched.
- Pass `sourceId` from post feed/post detail call sites (post id).

## 5. Composer compatibility badge

`src/components/media/MediaCompatibilityBadge.tsx` — three states using semantic tokens (no hardcoded colors):
- `checking` — `bg-muted text-muted-foreground` "Checking compatibility…"
- `compatible` — success-tinted "Compatible video"
- `risky` — warning-tinted "May not play on all devices"

Wiring in `MediaUploader.tsx`:
- Extend `MediaUploadState` with `compatibility?: 'checking' | 'compatible' | 'risky'` and optional `compatibilityNote`.
- For video files, set `checking` immediately, run `detectHEVCRisk` in background, then set `compatible` or `risky`.
- Replace the one-shot HEIC/MOV toast with the inline badge in `renderUploadRow`. Suppress repeat toasts via `sessionStorage` key.
- Compatibility lives **only on `MediaUploadState`** — never persisted to `MediaItem`.

If success-tinted/warning-tinted tokens don't already exist, add them to `index.css` (HSL, both themes).

## 6. Files

New:
- `supabase/migrations/<ts>_media_views.sql`
- `supabase/functions/track-media-view/index.ts`
- `src/hooks/useVideoViewTracker.ts`
- `src/utils/mediaPath.ts`
- `src/components/media/MediaCompatibilityBadge.tsx`

Edited:
- `src/components/media/FeedVideo.tsx` (props + tracker wiring)
- `src/components/media/MediaUploader.tsx` (badge + state)
- `src/types/media.ts` (`MediaUploadState.compatibility` only)
- `src/index.css` (success/warning surface tokens if missing)
- `supabase/config.toml` (`[functions.track-media-view] verify_jwt = false`)
- Post feed + post detail call sites of `FeedVideo` (pass `sourceId={post.id}`)

Secret:
- `VIEW_IP_SALT` (optional but recommended)

## 7. Build order

1. Migration (table + RLS + indexes).
2. Edge function + `config.toml`.
3. `mediaPath.ts` helper.
4. `useVideoViewTracker` hook.
5. `FeedVideo` wiring + call-site `sourceId`.
6. `MediaCompatibilityBadge` + `MediaUploader` integration + `MediaUploadState` type.

## 8. Verification

- SQL: confirm table, RLS denies anon SELECT/INSERT, indexes exist.
- `supabase--curl_edge_functions`: short watch (1000ms) → `too_short`; valid call → ok; repeat call → `deduped: true`.
- Browser: play a feed video for 3s → one row in `media_views`; replay same session → no new row.
- Composer: attach iPhone MOV → badge shows `checking` then `risky`; attach MP4 → `compatible`.

## 9. Known limitation

`watch_ms` is client-reported. Acceptable for MVP; can be tightened later with server beacons.

## Out of scope

- Public view count UI.
- Admin analytics view.
- Backend transcoding.
- Wiring `source = 'review' | 'entity'` (schema ready, not used yet).

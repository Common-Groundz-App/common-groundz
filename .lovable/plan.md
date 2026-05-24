## What's broken

### 1. Mux→Supabase fallback never triggers (root cause)
`mux-create-upload` correctly returns `503 { error: 'MUX_DISABLED', code: 'MUX_DISABLED' }` when the admin kill-switch is off. But `supabase.functions.invoke()` wraps any non-2xx response in a `FunctionsHttpError` whose body lives on `err.context` as an **unread `Response` object** — not as `err.code` / `err.body.code`.

The current check in `mediaService.ts` → `uploadMedia` video branch:
```ts
const code = err?.code ?? err?.error ?? err?.body?.error ?? err?.body?.code ?? err?.context?.code;
if (code === 'MUX_DISABLED') { ...fallback... }
```
…never matches. The error bubbles up as **"Couldn't start video upload. Try again."** — no Supabase fallback, no progress bar. Matches the screenshot exactly.

### 2. Supabase upload UI (progress / poster / duration)
Already intact in `MediaUploader.tsx` / `UploadRow`. Once fallback actually runs (fix #1), execution falls through into the existing Supabase Storage branch and the same staged progress UI, local poster, and duration chip light up automatically. **No UI work needed for #2.**

### 3. No way to dismiss a failed upload card
In `UploadRow` (lines 189–208), the cancel `X` only renders for `status === 'uploading' | 'idle'`. On `status === 'error'` we render a non-interactive `✗` glyph — so the user is stuck with the failed card.

---

## The fix

### A. Properly parse `FunctionsHttpError` body in `src/services/mediaService.ts`
Scope: only the existing `try/catch` around `supabase.functions.invoke('mux-create-upload', …)` inside `uploadVideoViaMux`. No global error interception.

Inside that catch, add a small async helper that returns the error code:
1. If `err.context instanceof Response`, `await err.context.clone().json()` inside try/catch and read `code` / `error` from the parsed body.
2. Fall back to flat fields (`err.code`, `err.error`, `err.body?.code`, `err.body?.error`) for non-HTTP errors.
3. **Fallback only when the resolved code is exactly `'MUX_DISABLED'`** — per reviewer feedback, do NOT treat a bare HTTP 503 (or any other status) as a fallback signal. A transient Mux outage should surface as a real upload error, not silently reroute.

On `MUX_DISABLED` hit: call `__resetMuxConfigCache()`, fire `analytics.track('mux_fallback_to_supabase', { reason: 'server_disabled' })`, and let execution continue into the existing Supabase Storage path below the Mux branch. User sees normal Supabase progress UI, no error toast.

Any other error (e.g. `too_many_inflight_uploads`, `mux_create_failed`, generic 5xx) keeps the current behavior: row goes to error state with the existing message.

### B. Add a remove (`X`) button to failed upload rows in `src/components/media/MediaUploader.tsx`
In `UploadRow`, when `status === 'error'`:
- Keep the destructive `✗` visual indicator (and the "Upload failed" label below the file name) so the failed state is still obvious.
- Render the same ghost-icon `X` button that's used during upload, wired to `onCancel(upload)`, with `aria-label="Remove failed upload"`.

Reuses the existing `cancelUpload` flow (revokes the local poster URL and drops the row from state) — no new state plumbing.

### Explicitly out of scope
- `mux-create-upload` edge function
- Admin Feature Flags panel
- Image upload path
- Mux-enabled upload path
- Playback components (`FeedVideo`, lightbox, `MuxUploadChip`)
- Phase 3C edit flow
- The pre-existing 403 on `ensure-bucket-policies` (non-fatal; storage upload still works)

---

## Files touched

- `src/services/mediaService.ts` — parse `FunctionsHttpError.context` body; strict `MUX_DISABLED`-only fallback scoped to the `mux-create-upload` call.
- `src/components/media/MediaUploader.tsx` — add removable `X` on failed `UploadRow`.

## Verification

1. Admin → Feature Flags → Mux uploads OFF.
2. Login as Hana, upload a `.mov` → row shows "Preparing → Uploading → Finalizing" via the **Supabase** path, lands as a normal video preview. No error toast. Console shows `mux_fallback_to_supabase`.
3. Admin → Mux ON → video upload goes through Mux as before.
4. Force a real failure → failed row now has a working `X` to dismiss.
5. Image upload remains unchanged in both flag states.

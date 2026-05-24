# Phase 3C.2-lite — "Edit post" CTA for failed Mux videos (final, approved)

## Goal

When an owner sees the failed-Mux banner on `PostView` and is still inside the 1-hour edit window (or is admin), give them a one-click path into the existing edit composer. They remove the failed video using the composer's existing X button and re-upload — Phase 3C.1's sync RPC handles the `removed` → `pending` → `ready` mapping transitions automatically.

**No `replaceMediaIndex`. No slot targeting. No changes to the composer's upload paths. No changes to image or legacy Supabase video flows. No DB / RPC / edge / webhook changes.**

## Scope

### 1. `src/components/media/MuxOwnerHint.tsx`

- Extend `Props.post` shape to include `created_at?: string | null` and `last_edited_at?: string | null` (needed by `canEditPost`).
- Add imports: `Button` (shadcn), `Dialog`/`DialogContent` (shadcn), `useIsAdmin` from `@/hooks/useIsAdmin`, `canEditPost` from `@/utils/postEditPolicy`, `EnhancedCreatePostForm`.
- In the `bannerStatus === 'failed'` branch:
  - Compute `canEdit = canEditPost(post, user?.id, isAdmin)`.
  - If `canEdit`: render an **"Edit post"** button next to the existing copy. Keep the "Video failed to process." headline; replace fallback subcopy with "Edit your post to remove and re-upload the video."
  - If `!canEdit` (window expired, non-admin): keep current fallback copy "Please create a new post." unchanged.
- Local `isEditOpen` state controls a `<Dialog>` mounting `EnhancedCreatePostForm` with `postToEdit={post}`. `onSuccess` → close dialog + call existing `onReady`. `onCancel` → close.

### 2. Analytics (inline, with dedup + post-id reset)

Use `analytics.track()` directly inline (matches the file's existing pattern for `mux_owner_hint_shown` / `mux_owner_hint_failed_shown`). **No new helper methods on `analytics.ts`.**

Three events, all with `{ post_id: post?.id ?? null }`:
- `mux_failed_edit_cta_shown` — fired once per `post_id` per mount via `shownCtaRef`.
- `mux_failed_edit_cta_clicked` — on button click; no dedup.
- `mux_failed_edit_cta_completed` — fired once per `post_id` per mount via `completedCtaRef` latch, inside dialog `onSuccess`.

**Codex's note (folded in):** Add a small `useEffect` keyed on `post?.id` that resets both `shownCtaRef.current = null` and `completedCtaRef.current = null` when the post id changes — so navigating across failed posts in the same `MuxOwnerHint` mount fires `shown` correctly per post.

### 3. `src/pages/PostView.tsx`

- Pass `created_at` and `last_edited_at` to `MuxOwnerHint` through the `ownerPost` projection. Currently it passes only `id`, `user_id`, `media` — add the two timestamp fields from `postMeta`.
- Requires `PostMeta` interface to carry `created_at` and `last_edited_at`, and `PostContentViewer`'s `onPostLoaded` callback to surface them. **Verify first via read**; if not already surfaced, thread them through (minimal additive change).

### 4. Mandatory test: `src/components/media/MuxOwnerHint.test.tsx`

Three cases, mocking `useAuth`, `useIsAdmin`, `useMuxStatus`:
- Owner + failed + within window → "Edit post" CTA renders.
- Owner + failed + expired window (non-admin) → CTA hidden, fallback copy "Please create a new post." shown.
- Non-owner → component returns `null` (regression guard).

## Verification checklist (ChatGPT's note folded in)

Before declaring 3C.2 done, manually confirm:
1. Opening the edit dialog alone does **NOT** trigger `mux-sync-post-mappings`. The sync call lives inside `EnhancedCreatePostForm`'s save handler from Phase 3C.1 — verify by checking network requests on dialog-open vs save.
2. `mux-sync-post-mappings` fires only after the user actually saves the edit.
3. Image and legacy Supabase-video edit paths remain untouched (no new code in their flows).
4. Non-owner sees no banner/CTA.
5. Owner after edit window (and not admin) sees the failed-video copy but no "Edit post" button.
6. Admin viewing any failed post sees the "Edit post" button regardless of window.
7. After successful edit-and-save: dialog closes, `onReady` fires, the post refetches, and the failed Mux item transitions correctly (verified by 3C.1's existing reconcile logic).

## Out of scope (explicit)

- `replaceMediaIndex` prop or any per-slot targeting.
- Feed-card banners (`MuxOwnerHint` is not mounted there).
- Background Mux asset deletion (Phase 5).
- Any change to `analytics.ts` itself.

## Is this the final fix for Phase 3C?

**Yes.** After this lands and passes the verification checklist above:
- 3C.1 backend mapping sync — done.
- 3C.2-lite owner CTA — done.

Failed-Mux recovery becomes one click for owners inside the edit window; the composer's existing remove + re-upload UX handles the rest; the sync RPC reconciles the mapping. Phase 3C closes. Slot-targeted replacement stays parked as a hypothetical 3C.3 only if real usage shows the 2-click remove+add flow is friction.

## Files touched

1. `src/components/media/MuxOwnerHint.tsx` — CTA, dialog, inline analytics with dedup + post-id reset effect.
2. `src/pages/PostView.tsx` — pass `created_at` / `last_edited_at` into `ownerPost`.
3. `src/components/content/PostContentViewer.tsx` (+ `PostMeta` shape) — surface the two timestamps if not already; verify first.
4. `src/components/media/MuxOwnerHint.test.tsx` — new, three cases.

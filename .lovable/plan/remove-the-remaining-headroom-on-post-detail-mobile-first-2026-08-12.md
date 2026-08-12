# Remove the remaining headroom on post detail (mobile-first)

Both reviews are right on the two contested points, so the plan changes: the sidebar offset is dropped entirely from this pass, and the desktop claim is corrected. Codex also caught a real extra bug — the loading skeleton uses different padding than the loaded view — which is now included.

## What's actually stacking (verified in code)

Mobile, above the post's author row:

- `PostView.tsx` app-shell clearance `pt-16` — required, the mobile header is fixed. Not touched.
- Grid container `py-6` → 24px (avoidable)
- `PostContentViewer` detail wrapper `pt-1` → 4px
- Header row: 40px back button + `mb-1` → 4px
- `PostFeedItem` `CardContent` `pt-2` → 8px

## Honest reclaim numbers

Because the changes are mobile-first with `sm:` restoring today's values:

- Mobile: ~32px (16 grid + 4 wrapper + 4 header margin + 8 card)
- Desktop: ~12px only (4 header margin + 8 card) — `sm:py-6` and `sm:pt-2` keep desktop grid/wrapper padding as-is

This pass is deliberately mobile-first. If desktop still feels loose after it lands, that becomes a separate, measured decision (an explicit `xl:` top-padding value), not a side effect of this change.

## Changes

1. `src/pages/PostView.tsx`
   - Logged-in grid (line 224): `py-6` → `pt-2 pb-6 sm:py-6`
   - Guest container (line 163): `py-6` → `pt-2 pb-6 sm:py-6`

2. `src/components/content/PostContentViewer.tsx` (detail branch only)
   - Wrapper: `pt-1 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6` → `pt-0 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6`
   - Header row: `mb-1` → `mb-0`
   - Back button keeps `h-10 w-10` (40px tap target) and `-ml-2` optical alignment
   - Non-detail (modal/embedded) wrapper `py-4 px-0 sm:p-6` unchanged

3. `src/components/content/PostContentViewer.tsx` — loading state alignment (new)
   The skeleton wrapper is `p-4 sm:p-6` regardless of view, so on mobile the skeleton is inset 16px while the loaded post is edge-to-edge (`px-0`), and its top padding differs too. Make it mirror the loaded wrapper:
   - detail: `pt-0 pb-4 px-0 sm:pt-2 sm:pb-6 sm:px-6`
   - non-detail: keep `p-4 sm:p-6`
   Result: no horizontal or vertical jump when the post resolves.

4. `src/components/feed/PostFeedItem.tsx`
   ```tsx
   <CardContent className={cn('px-3 sm:px-4 pb-1 sm:pb-2', isDetailView ? 'pt-0' : 'pt-2')}>
   ```
   Feed rendering stays byte-identical.

## Explicitly not changing

`PostDetailSidebar` stays at `sticky top-20` in both the skeleton (line 389) and loaded (line 435) states. Desktop grid padding is unchanged by this pass, so the post still starts near ~72px and `top-20` remains the closest fit. If a desktop screenshot after these edits shows the author card visibly off the post's start, the offset is adjusted then — same value applied to both states — as a follow-up, not a guess baked in now.

Also untouched: post fetch logic, comments, routing, feed layout/width, mobile edge-to-edge behavior, modal viewer spacing.

## Verification

- Mobile ~390px: tight gap between the app header and `Post`; author row sits directly under the compact header; back button still ~40px.
- Mobile: skeleton → loaded transition has no left-edge or top-edge shift.
- Desktop: modestly reduced headroom; screenshot-compare the author/entity card's top edge with the post start (both loading and loaded) and report whether an offset change is needed.
- Feed page pixel-identical; modal/non-detail viewer unchanged.

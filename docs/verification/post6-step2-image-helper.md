# Post-6 Step 2: ImageWithFallback

- Removed the built-in Unsplash default, the type-to-stock lookup and the `entityType` prop.
- Kept one relay-to-direct retry, used only when the relay transformed a remote http/https link.
- Added `failedContent` and `onFailure('load'|'invalid')`. `onError` fires only for the terminal primary browser failure.
- A local `isRenderableImageSrc` accepts http, https, `data:image`, `blob:` and root-relative `/` paths. It rejects everything else.
- Lifecycle: the outer component renders a keyed `ImageAttempt` (key = JSON of the normalised src and fallback). A change remounts it, and an unmounted guard ignores stale events.
- `ImageFailedState` was extracted from `EvidenceImage` with no visual change.
- Callers:
  - SearchEntryPanel (2 rows) and AutoFillPreviewModal (grid and primary) use the failed panel.
  - ImageCandidateGrid's `markBroken` moved to `onFailure`.
  - ProfileCoverImage and LocationSearchInput are unchanged. The location food photo is a documented location exception.
- Deleted `profile/reviews/ImageUploader.tsx`. A case-insensitive search found zero references.
- Tests: `imageWithFallbackStep2.test.tsx` (16 tests). They check the "marked broken once" behaviour at helper level (`onFailure` fires once for both 'load' and 'invalid'). There is no separate grid render test.
- Authenticated admin runtime capture is unavailable.

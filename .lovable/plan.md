

## Assessment

ChatGPT's suggestion to rename `add_media` to `upload_media` is reasonable. However, looking at the actual code, the action is already `upload` in both files (line 595 in MediaPreviewSection, line 765 in PhotosSection) — but it's placed inside the `onSave` callback of `SimpleMediaUploadModal`, not on the button click. That means the modal still opens for guests.

The fix is straightforward: move the `requireAuth` guard from `onSave` to the button `onClick`, before `setShowUploadModal(true)`.

Regarding the action name: I'll use `upload_media` as ChatGPT suggested — it's more descriptive than the current bare `upload` and consistent with other action names like `create_post`, `create_entity`.

No other changes needed.

## Plan

### 1. `src/components/entity-v4/MediaPreviewSection.tsx` (line ~276)
- Replace `onClick={() => setShowUploadModal(true)}` with a handler that calls `requireAuth({ action: 'upload_media', surface: 'entity_media_gallery', entityId: entity.id, entityName: entity.name })` first
- Keep the existing guard inside `onSave` as a safety net

### 2. `src/components/entity-v4/PhotosSection.tsx` (line ~404)
- Same pattern: guard the button click with `requireAuth({ action: 'upload_media', surface: 'entity_photos_tab', entityId: entity.id, entityName: entity.name })` before opening the modal

Two lines changed per file. Minimal, surgical fix.




## Fix: Create-post dialog not opening from PostView

### Root cause
`SmartComposerButton.tsx` line 76-81: when `detail` exists but `detail.contentType` is falsy, the handler never calls `setIsDialogOpen(true)`. The "Share your experience" button dispatches `{ entityId, entityName }` with no `contentType`, so the modal silently fails to open.

### Changes (2 files)

**1. `src/components/feed/SmartComposerButton.tsx` — lines 73-91**

Replace the handler so modal **always opens**, with stale entity reset:

```tsx
const handleOpenDialog = (event: Event) => {
  const detail = (event as CustomEvent)?.detail ?? {};

  const contentType = detail.contentType ?? 'post';
  setSelectedContentType(contentType as ContentType);
  setIsPopoverOpen(false);
  setIsDialogOpen(true);

  // Support both payload shapes + reset stale data
  if (detail.entity) {
    setEntityData(detail.entity);
  } else if (detail.entityId) {
    setEntityData({
      entity_id: detail.entityId,
      name: detail.entityName ?? null,
    });
  } else {
    setEntityData(null);
  }
};
```

**2. `src/components/content/PostContentViewer.tsx` — lines 355-360**

Add `contentType: 'post'` and normalize entity id:

```tsx
new CustomEvent('open-create-post-dialog', {
  detail: {
    contentType: 'post',
    entityId: entity?.entity_id ?? entity?.id ?? null,
    entityName: relatedEntityName ?? null,
  },
})
```

**No other files changed.** `PostView.tsx` already mounts the hidden `SmartComposerButton`.




## Auto-tag entity + refresh "Real experiences" — Implementation Plan

### 3 files, 4 changes

---

**1. `src/components/feed/SmartComposerButton.tsx` — two changes**

**A) Lines 82-91** — entity normalization already exists but needs `id` normalization for canonical shape:
```tsx
if (detail.entity) {
  const normalizedId = detail.entity.id ?? detail.entity.entity_id;
  setEntityData({
    ...detail.entity,
    id: normalizedId,
    name: detail.entity.name ?? '',
    type: detail.entity.type ?? 'product',
  });
} else if (detail.entityId) {
  setEntityData({
    id: detail.entityId,
    name: detail.entityName ?? '',
    type: detail.entityType ?? 'product',
  });
} else {
  setEntityData(null);
}
```

**B) ~Line 239** — pass entity to `EnhancedCreatePostForm`:
```tsx
<EnhancedCreatePostForm 
  profileData={profileData}
  onSuccess={handleContentCreated}
  onCancel={() => setIsDialogOpen(false)}
  initialEntity={entityData}
/>
```

---

**2. `src/components/feed/EnhancedCreatePostForm.tsx` — three changes**

**A) Line 27-31** — add `initialEntity` to props interface:
```tsx
interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  profileData?: any;
  initialEntity?: Entity;
}
```

**B) Line 45** — accept in destructuring:
```tsx
export function EnhancedCreatePostForm({ onSuccess, onCancel, profileData, initialEntity }: EnhancedCreatePostFormProps) {
```

**C) After line 69** — add closure-safe prefill effect:
```tsx
useEffect(() => {
  if (initialEntity?.id) {
    setEntities(prev =>
      prev.some(e => e.id === initialEntity.id) ? prev : [...prev, initialEntity]
    );
  }
}, [initialEntity]);
```

**D) Line 314** — replace bare `refresh-posts` dispatch with guarded, entity-specific version:
```tsx
const refreshEntityId = entities[0]?.id;
if (refreshEntityId) {
  window.dispatchEvent(new CustomEvent('refresh-posts', {
    detail: { entityId: refreshEntityId }
  }));
}
```

---

**3. `src/components/content/PostContentViewer.tsx` — one addition**

After line 189 (after the existing related-posts fetch effect), add entity-filtered refresh listener:

```tsx
React.useEffect(() => {
  const handleRefresh = (e: Event) => {
    const refreshedEntityId = (e as CustomEvent)?.detail?.entityId;
    const entity = post?.tagged_entities?.[0];
    const currentEntityId = entity?.entity_id ?? entity?.id;
    if (!currentEntityId || refreshedEntityId !== currentEntityId) return;

    fetchEntityPosts(currentEntityId, user?.id || null, 0, 6).then(posts => {
      const filtered = posts.filter((p: any) => p.id !== postId);
      setRelatedPosts(filtered.slice(0, 5));
    });
  };
  window.addEventListener('refresh-posts', handleRefresh);
  return () => window.removeEventListener('refresh-posts', handleRefresh);
}, [post?.tagged_entities, user?.id, postId]);
```

---

### What stays unchanged
Everything else — PostView.tsx, PostContentViewer dispatcher, DB schema, submit logic (lines 290-303 already persist to `post_entities`).


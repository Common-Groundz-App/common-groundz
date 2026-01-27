
# Fix Silent Photo Enrichment - Complete Solution

## Problem Summary
After entity creation, the photo gallery shows jarring skeleton placeholders ~20 seconds later because:

1. **`MediaPreviewSection.tsx` was NOT fixed** - It still sets `loading = true` on every photo load
2. **Unstable `photoRefreshKey`** - Depends on entire `entity.metadata` object instead of only photo-specific fields
3. **Unnecessary re-fetching** - Photos re-load even when they haven't changed

## Technical Fix

### File 1: `src/components/entity-v4/MediaPreviewSection.tsx`

**Change 1A: Add initial load tracking ref (after line 47)**
```typescript
// Track if this is the initial load vs a background refresh
const isInitialLoadRef = useRef(true);
```

**Change 1B: Modify `loadPhotos()` to only show skeleton on initial load (lines 49-98)**
```typescript
const loadPhotos = async (isInitialLoad: boolean = false) => {
  // Only show loading skeleton on initial load, not background refreshes
  // This prevents jarring image flash when photos silently upgrade
  if (isInitialLoad) {
    setLoading(true);
  }
  
  try {
    // ... existing fetch logic stays the same ...
  } catch (error) {
    console.error('Error loading photos:', error);
  } finally {
    setLoading(false);
  }
};
```

**Change 1C: Stabilize `photoRefreshKey` to only depend on photo-specific fields (lines 100-109)**
```typescript
// Only trigger refresh when photo-specific data changes, not all metadata
const photoRefreshKey = useMemo(() => {
  const metadata = entity.metadata as any;
  return JSON.stringify({
    id: entity.id,
    imageUrl: entity.image_url,
    photoReference: metadata?.photo_reference,
    photoReferences: metadata?.photo_references,
    storedPhotoUrls: metadata?.stored_photo_urls  // Track when stored URLs appear
  });
}, [entity.id, entity.image_url, 
    (entity.metadata as any)?.photo_reference,
    (entity.metadata as any)?.photo_references,
    (entity.metadata as any)?.stored_photo_urls]);  // Specific fields only!
```

**Change 1D: Update useEffect to pass isInitialLoad flag (lines 111-113)**
```typescript
useEffect(() => {
  loadPhotos(isInitialLoadRef.current);
  isInitialLoadRef.current = false;
}, [photoRefreshKey]);
```

---

### File 2: `src/components/entity-v4/PhotosSection.tsx`

**Change 2: Stabilize `photoRefreshKey` to only depend on photo-specific fields (lines 226-234)**
```typescript
// Only trigger refresh when photo-specific data changes, not all metadata
const photoRefreshKey = useMemo(() => {
  const metadata = entity.metadata as any;
  return JSON.stringify({
    id: entity.id,
    imageUrl: entity.image_url,
    photoReference: metadata?.photo_reference,
    photoReferences: metadata?.photo_references,
    storedPhotoUrls: metadata?.stored_photo_urls
  });
}, [entity.id, entity.image_url,
    (entity.metadata as any)?.photo_reference,
    (entity.metadata as any)?.photo_references,
    (entity.metadata as any)?.stored_photo_urls]);
```

---

## Summary of Changes

| Issue | File | Fix |
|-------|------|-----|
| Skeleton flash in hero gallery | MediaPreviewSection.tsx | Add `isInitialLoadRef` + only show skeleton on initial load |
| Unstable refresh key | MediaPreviewSection.tsx | Change dependency from `entity.metadata` to specific photo fields |
| Unstable refresh key | PhotosSection.tsx | Change dependency from `entity.metadata` to specific photo fields |

---

## Expected Behavior After Fix

```text
Entity Created (0s)
     ↓ (3s)
Background enrichment runs
     ↓ (5-15s)  
Photos stored to Supabase
     ↓ (8s)
First poll runs
     ↓
stored_photo_urls field changes in metadata
     ↓
photoRefreshKey changes (stable, only photo fields)
     ↓
loadPhotos(false) called ← isInitialLoad = false
     ↓
setLoading(true) is SKIPPED ← no skeleton!
     ↓
New photo URLs silently populate in state
     ↓
React re-renders with new images seamlessly

User experience: Photos just "get better" without any visible placeholder flash
```

---

## Technical Notes

- The key insight is that `entity.metadata` contains ~20+ fields that change during enrichment (like `last_refreshed_at`, `vicinity`, `rating`, etc.)
- By specifying only photo-specific fields in the dependency array, we prevent unnecessary re-renders when non-photo metadata changes
- The `isInitialLoadRef` pattern distinguishes "user just opened the page" from "background enrichment completed"
- Both `MediaPreviewSection` (hero gallery) and `PhotosSection` (full gallery tab) need the same fix applied

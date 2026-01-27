

# Silent Background Photo Enrichment: Complete UX Fix

## Problem Summary

When a new entity is created, users experience three disruptive behaviors:

1. **"Refreshing..." badge** appears ~45 seconds after creation
2. **Jarring image flash** - gallery shows empty gray placeholder boxes while images reload
3. **"Photos optimized" toast** appears ~80 seconds after creation

These occur because the background polling triggers `queryClient.refetchQueries()`, which:
- Sets `isRefetching = true` → shows the badge
- Changes `entity.metadata` → triggers `photoRefreshKey` change in `PhotosSection`
- `photoRefreshKey` change → triggers `loadPhotos()` with `setLoading(true)` → shows skeleton placeholders

---

## Root Cause Flow

```text
Entity Created
     ↓ (3s)
Background enrichment runs (stores photos to Supabase)
     ↓ (5-10s)
Photos stored successfully
     ↓ (15s)
Polling starts in EntityV4.tsx
     ↓
queryClient.refetchQueries() called
     ↓
┌──────────────────────────────────────────────────────┐
│ isRefetching = true  →  "Refreshing..." badge shown  │
│ entity.metadata changes  →  photoRefreshKey changes  │
│ PhotosSection: setLoading(true)  →  SKELETON FLASH   │
└──────────────────────────────────────────────────────┘
     ↓ (few seconds)
Data loaded, stored_photo_urls detected
     ↓
"Photos optimized" toast shown
```

---

## Solution: True Silent Upgrade

### Goal
Background photo enrichment should be **completely invisible** to users. The gallery should progressively enhance without any visual disruption.

### Changes Required

---

### File 1: `src/components/entity-v4/EntityV4.tsx`

#### Change 1A: Remove "Photos optimized" toast
**Lines 97-102** - Delete the toast notification entirely

#### Change 1B: Remove "Refreshing..." badge for background polling
**Lines 500-508** - Remove or conditionalize the badge

The badge is currently tied to `isRefetching` from React Query, which fires during ANY refetch. We should remove this badge entirely since:
- User-initiated refreshes have their own feedback (button spinner)
- Background refreshes should be silent

#### Change 1C: Faster polling timing
**Lines 74, 110, 113** - Reduce delays to match actual enrichment speed:
- Initial delay: 15s → 8s (enrichment usually completes in 5-15s)
- Poll interval: 30s → 12s (check more frequently)
- Max polls: 2 → 3 (catch slower enrichments)

---

### File 2: `src/components/entity-v4/PhotosSection.tsx`

#### Change 2: Prevent skeleton flash on background updates

The key fix - **don't show loading skeleton when photos already exist**.

**Lines 60-77** - Modify `loadPhotos()` to only set `loading = true` on initial load:

```typescript
const loadPhotos = async (isInitialLoad: boolean = false) => {
  // Only show loading skeleton on initial load, not background refreshes
  if (isInitialLoad) {
    setLoading(true);
  }
  
  try {
    const [googlePhotos, reviewPhotos, userPhotos] = await Promise.all([
      fetchGooglePlacesPhotos(entity),
      fetchEntityReviewMedia(entity.id),
      fetchEntityPhotos(entity.id)
    ]);
    
    const allPhotos = [...googlePhotos, ...reviewPhotos];
    setPhotos(allPhotos);
    setEntityPhotos(userPhotos);
  } catch (error) {
    console.error('Error loading photos:', error);
  } finally {
    setLoading(false);
  }
};
```

**Lines 228-230** - Track if this is initial load vs background refresh:

```typescript
const isInitialLoadRef = useRef(true);

useEffect(() => {
  loadPhotos(isInitialLoadRef.current);
  isInitialLoadRef.current = false; // Subsequent loads are background refreshes
}, [photoRefreshKey]);
```

This ensures:
- First load: Shows skeleton placeholders (expected behavior)
- Background refresh: Silently updates photos in place without flashing

---

## Summary of Changes

| Issue | File | Fix |
|-------|------|-----|
| "Refreshing..." badge | EntityV4.tsx | Remove the badge entirely (lines 500-508) |
| "Photos optimized" toast | EntityV4.tsx | Delete toast call (lines 97-102) |
| Jarring image flash | PhotosSection.tsx | Only show skeleton on initial load, not refreshes |
| Slow polling | EntityV4.tsx | Reduce timing: 8s initial, 12s interval, 3 max polls |

---

## Expected Behavior After Fix

```text
Entity Created
     ↓ (3s)
Background enrichment runs
     ↓ (5-15s)  
Photos stored to Supabase (silent)
     ↓ (8s)
First poll runs (silent)
     ↓
If stored_photo_urls found:
  → Photos seamlessly upgrade in gallery (no flash, no badge, no toast)
  → User sees higher quality images without disruption

If not found yet:
  → Poll again in 12s (silent)
  → Repeat up to 3 times

User experience: Photos just "get better" without any visible process
```

---

## Technical Notes

- The `isRefetching` state from React Query is useful for debugging but should not drive visible UI for background operations
- The `photoRefreshKey` pattern is correct for detecting metadata changes, but the loading state needs to distinguish initial load vs refresh
- Timing of 8s initial + 12s interval means photos upgrade within ~20s worst case (vs ~75s currently)




## Fix Plan: 3 Changes, 3 Files

### 1. Comments empty state — single icon
**File:** `src/components/comments/InlineCommentThread.tsx` (lines 596–606)

Replace the three overlapping `MessageCircle` circles with one clean icon in a muted circle:
```tsx
<div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
  <MessageCircle className="h-7 w-7 text-muted-foreground" />
</div>
```
Keep "Start the conversation" text and subtext unchanged.

### 2. "Share your experience" button — orange outline + CustomEvent
**File:** `src/components/content/PostContentViewer.tsx` (lines 347–355)

**Styling:** Add branded orange outline classes:
```
className="gap-1.5 mb-2 border-brand-orange text-brand-orange hover:bg-brand-orange/10"
```

**Behavior:** Replace `navigate('/')` with CustomEvent passing entity context:
```tsx
onClick={() => {
  const entity = post.tagged_entities?.[0];
  window.dispatchEvent(
    new CustomEvent('open-create-post-dialog', {
      detail: {
        entityId: entity?.entity_id ?? null,
        entityName: relatedEntityName ?? null,
      },
    })
  );
}}
```

### 3. Mount hidden SmartComposerButton on PostView
**File:** `src/pages/PostView.tsx` (after line 178, before closing `</div>`)

Import `SmartComposerButton` and render it hidden inside the logged-in layout, guarded by `user`:
```tsx
{user && (
  <div className="hidden">
    <SmartComposerButton />
  </div>
)}
```

Without this, the `open-create-post-dialog` event has no listener on PostView and the button does nothing.

### What stays unchanged
- "Comments" heading in InlineCommentThread — unchanged
- PostFeedItem internals — unchanged
- All other pages/components — unchanged


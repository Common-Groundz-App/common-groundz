

# Remove Orange Accent Bar from AuthPromptModal

The 2px `bg-brand-orange/80` top accent bar needs to be removed from `src/components/auth/AuthPromptModal.tsx` (around line 97).

## Change

**File**: `src/components/auth/AuthPromptModal.tsx`

Delete this line:
```tsx
<div className="h-[2px] bg-brand-orange/80 w-full" />
```

One line removal.


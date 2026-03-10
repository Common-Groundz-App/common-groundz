

## Analysis

ChatGPT's suggestion is better here. The current text is too long for mobile and creates visual clutter. The short `🔒 From your circle` pattern is clean, compact, and stays on one line — matching the polish of the logged-in version.

However, I'd recommend a slight variation: use the `Lock` icon (already imported in the file) instead of the 🔒 emoji for visual consistency with the rest of the guest teasers (e.g., the Trust Summary card uses `<Lock>` from lucide-react).

Also, making "From your circle" a clickable link to signup keeps the conversion path without needing the verbose "→ Sign up" suffix — the lock icon already implies gated content.

## Proposed Change

**`src/components/entity-v4/EntityHeader.tsx` (lines 559-566)**

Replace the `·` separator and long CTA link with:

```jsx
<Link
  to={`/auth?tab=signup&returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
  className="flex items-center gap-1 text-xs text-brand-orange hover:text-brand-orange/80 font-medium hover:underline transition-colors"
  onClick={() => trackGuestEvent('guest_clicked_signup_from_entity', { entityId: entity?.id, surface: 'circle_reco_teaser' })}
>
  <Lock className="w-3 h-3" />
  From your circle
</Link>
```

Remove the `·` separator — the lock icon provides enough visual separation.

### Result on mobile

```
👍 2 Recommending 🔒 From your circle
```

One line, compact, consistent with the Lock icon pattern used in the Trust Summary card above.

One file, lines 559-566 replaced. Nothing else changes.


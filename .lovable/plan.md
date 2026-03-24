

# Inline display name + @username in Who to Follow cards

Currently the card renders display name and @username on separate lines using manual markup. The `UsernameLink` component already supports the Twitter/X inline pattern (`displayName` + `@handle` on one line) — it's just not being used here.

## Change

**`src/components/feed/UserRecommendationCard.tsx`, lines 94–105:**

Replace the current `UsernameLink` (with children) + separate `@username` div with a single `UsernameLink` using the `displayName` prop:

```tsx
<UsernameLink 
  username={user.username} 
  userId={user.id}
  displayName={user.displayName}
  showHandle={true}
/>
```

This removes the manual `@{user.username}` div entirely. `UsernameLink` with `displayName` renders the inline "**Name** @handle" layout automatically, matching feed post cards.


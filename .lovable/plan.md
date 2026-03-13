

# Guest Avatar Fix — Final Plan

ChatGPT's suggestion to use `bg-muted text-muted-foreground` instead of `bg-gray-100` is correct — it's better for theme consistency. However, your app doesn't currently use dark mode, so in practice both work. Still, using design tokens is the cleaner habit, so yes, adopt it.

Nothing else to add. The plan is complete as-is.

## Change — `src/components/comments/CommentDialog.tsx`

1. Add `User` to the lucide-react import
2. Replace the guest avatar block (lines ~513-516) with:

```tsx
<Avatar className="h-8 w-8 mt-1">
  {user ? (
    <>
      <AvatarImage src={userProfile?.avatar_url} />
      <AvatarFallback>{getInitials(userProfile?.username)}</AvatarFallback>
    </>
  ) : (
    <AvatarFallback className="bg-muted text-muted-foreground">
      <User className="h-4 w-4" />
    </AvatarFallback>
  )}
</Avatar>
```

One file, one small conditional change.


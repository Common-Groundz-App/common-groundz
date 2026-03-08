

# Final Plan — Clean Default Tab URL

ChatGPT's point about creating a new `URLSearchParams` instance is valid for safety. Adopt it.

## Change (1 file)

### `src/components/profile/ProfileContent.tsx`

Update `handleTabChange`:

```ts
const handleTabChange = (value: string) => {
  setSearchParams(prev => {
    const params = new URLSearchParams(prev);
    if (value === 'posts') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    return params;
  });
};
```

That's it. Nothing else to add — the fix is complete and future-proof.


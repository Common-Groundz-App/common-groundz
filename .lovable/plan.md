

# Add Brand Logo to Guest NavBar

## Assessment of ChatGPT/Codex Suggestions

Both are largely correct. Here's what matters:

- **No extra `<Link>` wrapper** — Codex is right. The `Logo` component already contains a `<Link to="/">` internally, so we just use `<Logo size="md" />` directly. No nested anchor issues.
- **Matching spacing** — Valid point. The logged-in navbar has `py-4` and uses `max-w-7xl`. The guest navbar currently uses `h-14` which is slightly different. We should align them.
- **Theme check** — Logo is already theme-aware via `useTheme()`, so this works automatically. No action needed.

One thing neither mentioned: the guest navbar uses a solid `border-b` style while the logged-in navbar uses a transparent-to-blurred style. That's fine to keep — they serve different contexts (full page vs. profile page overlay). No need to unify those.

## Plan

### Update `src/components/profile/GuestNavBar.tsx`

1. Import `Logo` component
2. Replace the `<Link>` text with `<Logo size="md" />` (no wrapper — Logo handles its own link)
3. Adjust container height/padding to match logged-in navbar (`py-4` instead of `h-14`)

Result:
```
[LOGO]                           Log In   Sign Up
```

Nothing else changes.


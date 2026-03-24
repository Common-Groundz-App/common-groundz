

# Refined Mutual Proof UI (Final)

## Changes — 1 file: `src/components/feed/UserRecommendationCard.tsx`

### MutualProofLine component updates:

1. **Avatars → clickable Links** with `e.stopPropagation()` to prevent bubbling to parent card/follow actions. Wrap each `ProfileAvatar` in `<Link to={profilePath}>` with `onClick={e => e.stopPropagation()}`.

2. **Names → plain text** — replace `UsernameLink` with `<span className="font-medium">` for consistent, non-interactive text styling.

3. **Accessibility** — add `aria-label` to the avatar container describing the mutual connection (e.g., "Mutual followers: Hana, Anitha"), so screen readers convey meaning even though the text itself isn't interactive.

That's it — small, focused change.


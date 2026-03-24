

# Add Keyboard Focus Ring to Mutual Avatars

## 1 file: `src/components/feed/UserRecommendationCard.tsx`

Update the `<Link>` wrapping each mutual `ProfileAvatar` in `MutualProofLine`:

Add: `focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 ring-offset-background rounded-full outline-none`

The `ring-offset-background` ensures visibility across light/dark themes. `ring-offset-2` gives slightly more breathing room than `1`. Everything else stays as-is.


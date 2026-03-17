

# Footer Cleanup: Remove from Product Pages

ChatGPT's analysis is correct. The footer belongs on public/marketing pages, not inside the logged-in product experience. Your app already has navbar + bottom nav for product pages — adding a footer creates redundant navigation.

## Current State

**Already correct (keep footer):**
- `Index.tsx` — landing page
- `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `CookiePolicy.tsx` — legal
- `AccountDeleted.tsx` — terminal page
- `PostView.tsx`, `RecommendationView.tsx` — public content (guest view)
- `UserProfile.tsx` — public profile (guest view)

**Need footer removed:**
- `Profile.tsx` — logged-in profile, already has BottomNavigation
- `EntityDetail.tsx` — product page
- `EntityDetailV2.tsx` — product page
- `EntityV4.tsx` — product page

## Conditional Logic for Shared Pages

`PostView.tsx`, `RecommendationView.tsx`, and `UserProfile.tsx` serve both guests and logged-in users. For these, the footer should only render when the user is **not** authenticated (guest view). When logged in, these pages should behave like product pages without a footer.

## Changes

| File | Action |
|------|--------|
| `Profile.tsx` | Remove Footer import and usage |
| `EntityDetail.tsx` | Remove Footer import and usage |
| `EntityDetailV2.tsx` | Remove Footer import and usage |
| `EntityV4.tsx` | Remove Footer import and usage |
| `PostView.tsx` | Conditionally render Footer only when `!user` |
| `RecommendationView.tsx` | Conditionally render Footer only when `!user` |
| `UserProfile.tsx` | Conditionally render Footer only when `!user` |

Simple, clean changes — no new components needed.


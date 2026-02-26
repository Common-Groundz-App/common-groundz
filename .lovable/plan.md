

# Phase 1: Public Profile Pages — Implementation Plan

## Overview

**Problem:** Logged-out users visiting `/u/hana_li` get redirected to `/` instead of seeing the profile.

**Solution:** Render a public profile page for guests with SEO tags for social sharing and discoverability.

## New Files (5)

### 1. `src/components/seo/SEOHead.tsx`
Shared Helmet wrapper for all public pages.
- Props: title, description, image, url, canonical, noindex (default `false`)
- Always renders immediately with fallback values (never gated behind data loading)
- Renders: og:title, og:description, og:image, og:url, og:site_name ("Common Groundz"), twitter:card ("summary"), twitter:site ("@commongroundz")
- When `noindex={true}`: renders `<meta name="robots" content="noindex,nofollow" />`
- Renders canonical `<link>` when provided

### 2. `src/hooks/use-public-profile.ts`
- Calls existing `resolveUsername()` to map username to user ID
- Queries `profiles` table with explicit safe columns (id, username, avatar_url, first_name, last_name, bio, location, cover_url, is_verified, created_at)
- Calls existing `get_follower_count_by_user_id` and `get_following_count_by_user_id` RPCs
- Returns: profile, followerCount, followingCount, isLoading, error, wasRedirected, currentUsername

### 3. `src/components/profile/GuestNavBar.tsx`
- Minimal top bar: Common Groundz logo (links to `/`), "Log In" button, "Sign Up" button
- Reusable across all future public guest surfaces

### 4. `src/components/profile/PublicProfileView.tsx`
- Cover image, avatar, display name, @username
- Bio, location, "Joined [month year]"
- Follower/following counts (read-only)
- CTA card: "Join Common Groundz to see [Name]'s recommendations" with Sign Up and Log In buttons

### 5. `src/utils/guestConversionTracker.ts`
- `trackGuestEvent(eventName, metadata?)` utility
- Console.log implementation, extensible to analytics provider later

## Modified Files (2)

### 6. `src/pages/UserProfile.tsx`
- Replace redirect-only logic with full page rendering
- After resolving username:
  - Authenticated users: `NavBarComponent` + `ProfileContent` (same as `/profile/:id`)
  - Guests: `GuestNavBar` + `PublicProfileView`
- `SEOHead` with profile data, canonical = self (`/u/:username`), noindex = false
- **Not-found state**: When username resolution fails, show error page with `noindex={true}` (prevents indexing error pages)
- **Idempotent guest tracking**: Fire `guest_viewed_profile` once per pageview using `useRef` guard, only when `!user && profile && !hasTracked.current`

### 7. `src/pages/Profile.tsx`
- Add `SEOHead` with `noindex={true}` and canonical pointing to `/u/:username`
- Client-side redirect to `/u/:username` when username resolves
- **Loop prevention**: Only redirect if username is successfully resolved; if null, stay on `/profile/:id`

## What Is NOT Changed
- App.tsx routing (the `/u/:username` route already exists without AppProtectedRoute)
- No other pages or components
- No database changes
- No entity/post/recommendation pages (that is Phase 2)

## Technical Notes
- HelmetProvider already wraps the app in main.tsx
- All profile queries use explicit column lists (column-level security restriction)
- resolveUsername works for anonymous users
- Follower/following RPCs are SECURITY DEFINER (accessible to anon)
- useAuth() returns `{ user: null }` for guests safely


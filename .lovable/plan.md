

# Phase 2: Public Entity, Post, and Recommendation Pages

## Overview

Remove `AppProtectedRoute` from entity, post, and recommendation routes so logged-out users can view public content. Add guest-aware navigation, SEO tags, proper 404 handling, and idempotent tracking.

## New File

### `src/components/content/PublicContentNotFound.tsx`
Reusable component rendering:
- `SEOHead` with `noindex={true}`, NO canonical tag
- Centered "Content Not Available" UI with customizable title and description
- Used by EntityDetail, PostView, and RecommendationView

---

## Modified Files

### 1. `src/App.tsx`
Remove `AppProtectedRoute` wrapper from 4 routes:
- `/entity/:slug`
- `/entity/:parentSlug/:childSlug`
- `/post/:postId`
- `/recommendations/:recommendationId`

### 2. `src/components/seo/SEOHead.tsx`
- Add optional `type` prop (default `"website"`) to control `og:type`
- Currently hardcoded to `"profile"` -- make dynamic

### 3. `src/pages/PostView.tsx`
- Auth-aware nav: `GuestNavBar` for guests, `NavBarComponent` for authenticated
- Add `postMeta` state + `loadComplete` boolean
- Pass `onPostLoaded` callback to `PostContentViewer` -- sets both `postMeta` and `loadComplete = true` on success; sets only `loadComplete = true` on error/not-found (meta stays null, triggering Hard 404)
- **Loading SEO**: `noindex={true}` while `!loadComplete`
- Once loaded with `visibility === 'public'`: `noindex={false}` + canonical
- **Hard 404**: `if (loadComplete && (!postMeta || postMeta.visibility !== 'public'))` for guests -- render `PublicContentNotFound` (no canonical)
- **Route-param reset**: `useEffect` keyed on `postId` resets `postMeta`, `loadComplete`, and `hasTracked.current`
- Idempotent `guest_viewed_post` tracking with `useRef` guard
- `og:type = "article"`

### 4. `src/pages/RecommendationView.tsx`
Same pattern as PostView:
- Auth-aware nav, `recommendationMeta` state + `loadComplete` boolean
- `onRecommendationLoaded` callback (fires on success AND error)
- Conservative `noindex={true}` during loading
- Hard 404 via `PublicContentNotFound` (no canonical)
- Route-param reset on `recommendationId` change
- Idempotent `guest_viewed_recommendation` tracking
- `og:type = "article"`

### 5. `src/components/content/PostContentViewer.tsx`
- Add optional `onPostLoaded?: (meta: { title: string; content: string; visibility: string } | null) => void` prop
- Call with metadata object on fetch success (after `setPost`)
- Call with `null` on fetch error/not-found (in catch block and empty-data check)
- No other changes

### 6. `src/components/content/RecommendationContentViewer.tsx`
- Add optional `onRecommendationLoaded?: (meta: { title: string; content: string; visibility: string; entityName?: string } | null) => void` prop
- Call with metadata on success, `null` on error
- No other changes

### 7. `src/components/entity-v4/EntityV4.tsx`
- Auth-aware nav (GuestNavBar for guests)
- Replace existing Helmet with `SEOHead` (title=entity name, description=truncated description, image=entity image_url, canonical=entity URL, type="website", noindex=false)
- Not-found: render `PublicContentNotFound` (no canonical)
- Idempotent `guest_viewed_entity` tracking

### 8. `src/pages/EntityDetail.tsx`
- In `EntityDetailOriginal` (legacy V1 layout): auth-aware nav, replace Helmet block with `SEOHead`, not-found uses `PublicContentNotFound`, idempotent guest tracking
- The `EntityDetail` wrapper component needs no changes

---

## Loading-State SEO Strategy

```text
Page Type       | During Loading  | After Public       | After Private/Missing/Error
Entity          | noindex=false   | noindex=false      | noindex=true, no canonical
Post            | noindex=true    | noindex=false      | noindex=true, no canonical
Recommendation  | noindex=true    | noindex=false      | noindex=true, no canonical
```

## og:type Mapping
- Profile pages: `"profile"`
- Entity pages: `"website"`
- Posts and recommendations: `"article"`

## What Is NOT Changed
- No database or RLS changes
- No changes to `/home`, `/explore`, `/settings`, `/my-stuff`
- No changes to `AppProtectedRoute` component itself
- No changes to authenticated user experience
- EntityV2 and EntityV3 (internal-only) -- no changes


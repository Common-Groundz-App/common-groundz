

# Plan: Guest Entity Page Conversion Teasers

## Overview
Replace hidden Circle Intelligence sections with locked teasers that build curiosity and drive signups. 5 files changed.

## Changes

### 1. `src/components/entity-v4/EntityHeader.tsx`

**Circle Rating teaser (lines 345-472):** Replace `{user && (` gate. When `!user`, render a compact locked teaser instead of hiding entirely:
- Lock icon + "Circle Rating" label + "See what people in your circle think" subtext
- `<Link to="/auth?tab=signup&returnTo=...">Sign up to see</Link>`
- Keep existing `user` branch unchanged

**Circle recommendation count (lines 495-504):** When `!user` and `stats.recommendationCount > 0`, replace the hidden circle count with a "Sign up for circle insights" link.

**Imports:** Add `Lock` from lucide, `Link` from react-router-dom, `useRef` for tracking, `useLocation` for returnTo, `trackGuestEvent`.

**Tracking:** `useEffect` + `useRef(false)` guard for impression; `onClick` for click. Payload: `{ entityId: entity.id, surface: 'circle_rating_teaser' }`.

### 2. `src/components/entity-v4/ReviewsSection.tsx`

**Network Recommendations teaser (lines 538-546):** Replace `{isAuthenticated && (` gate. When `!isAuthenticated`, render:
- Card with Lock icon + "Recommended by Your Network" title
- "Sign up to discover what people in your circle recommend" text
- 2 Skeleton placeholder rows
- Primary orange "Sign Up to Unlock" button → `/auth?tab=signup&returnTo=...`

When `isAuthenticated`, keep existing `NetworkRecommendations` unchanged.

**Imports:** Add `Lock` from lucide, `Link` from react-router-dom, `Skeleton`, `useRef`, `useEffect`, `useLocation`, `trackGuestEvent`.

### 3. `src/components/entity-v4/TrustSummaryCard.tsx`

**Circle Certified guest display (line 83):** Change from `{ value: "Sign In", color: "text-muted-foreground" }` to rendering a lock icon + "Sign up to unlock circle trust" link. Update the JSX at lines 119-131 to render the link when `!userId` instead of plain text.

**Imports:** Add `Lock` from lucide, `Link` from react-router-dom, `useRef`, `useEffect`, `useLocation`, `trackGuestEvent`.

### 4. `src/hooks/use-entity-save.ts`

**Guest save attempt (lines 82-89):** Add `trackGuestEvent('guest_attempted_save', { entityId })` before the toast. Update toast description to "Sign up to save entities and build your collection".

**Import:** Add `trackGuestEvent`.

### 5. `src/components/entity/EntityFollowButton.tsx`

**Guest follow attempt (lines 28-35):** Add `trackGuestEvent('guest_attempted_follow', { entityId })` before the toast. Update toast description to "Sign up to follow entities and get updates".

**Import:** Add `trackGuestEvent`.

## Cross-cutting patterns
- All auth links: `/auth?tab=signup&returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`
- All impressions: `useEffect` + `useRef(false)` guard, fire once per mount, only when `!user`
- All clicks: `trackGuestEvent('guest_clicked_signup_from_entity', { entityId, surface })` on link `onClick`
- "Sign Up" = primary orange styling; accessible `<Link>` elements throughout


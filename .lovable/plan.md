

# Post Detail Page — Reddit-Style Redesign (Final)

This plan has been reviewed and refined through multiple rounds. It is ready to implement.

## What we're building

Transform the post detail page into a proper app-shell layout matching all other pages (Feed, Explore, MyStuff) — with left navigation, refined post card, and a contextual right sidebar.

## Changes

### 1. App-shell layout — `PostView.tsx`

Adopt the same structure as `Feed.tsx`:
- **Desktop (xl+):** `VerticalTubelightNavbar` fixed left + `xl:ml-64` + grid (`xl:grid-cols-7`: spacer 1, content 4, sidebar 2)
- **Mobile:** top header + `BottomNavigation`
- **Guest users:** `GuestNavBar` only (no left nav, no bottom nav)
- Main content column uses `max-w-3xl` (slightly wider than current `max-w-2xl` for a fuller feel)

### 2. Detail card refinement — `PostFeedItem.tsx`

Add `isDetailView?: boolean` prop. When true:
- Keep `Card` with border, **remove shadow and hover effects**
- Remove `cursor-pointer`, click handler, `role="link"`, `tabIndex`
- Remove `line-clamp-3` (show full content)
- All interactive elements (like, save, share, menu) unchanged

### 3. New sidebar — `PostDetailSidebar.tsx`

Sticky sidebar (`sticky top-20`) with subtle hover on cards:

**Entity Card** (if tagged entity exists):
- Image + name (linked to entity page)
- Description (2-line clamp)
- Stats: recommendations, reviews, avg rating
- "View all experiences" button

**Author Card:**
- Avatar + display name + @username
- Bio (2-line clamp)
- "View Profile" button

Fallback: no entity → only Author Card. Loading: skeleton placeholders.

### 4. Content updates — `PostContentViewer.tsx`

- Pass `isDetailView={true}` to PostFeedItem
- **Back button** above post: `← Back` using `navigate(-1)` with fallback to `/home`
- Visual `border-t` dividers + spacing between post, comments, and "More experiences"
- Expose entity + author data for sidebar rendering in the PostView grid

## Files

| File | Action |
|------|--------|
| `src/pages/PostView.tsx` | Major — app-shell layout with left nav, grid, bottom nav |
| `src/components/feed/PostFeedItem.tsx` | Minor — add `isDetailView` prop |
| `src/components/content/PostContentViewer.tsx` | Medium — back button, dividers, data exposure |
| `src/components/content/PostDetailSidebar.tsx` | **New** — entity + author sidebar |

## Technical details

- Sticky offset `top-20` (80px) accounts for header height on desktop
- `max-w-3xl` on main content for fuller appearance
- Both `onClick` and `onPointerDown` stopPropagation on sidebar interactive elements (Radix compatibility)
- Skeleton loading states for both sidebar cards


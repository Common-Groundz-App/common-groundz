# Notification tabs: underline style like the entity page

## Phase 3 status

Checked the Phase 3.0 / 3.3A / 3.3B surfaces and the follow-sync work:

- Date sections (`notificationSections.ts`) with sticky headers and midnight rollover — in place.
- Target thumbnails (`notificationThumbnail.ts`, `useNotificationTargets.ts`) — in place, decorative and non-interactive.
- Follow back (`notificationFollowBack.ts`, `useFollowBackState.ts`) with the overlay-button row refactor — in place.
- Live follow sync via the single typed `followEvents.ts` helper, idempotent writers on both surfaces — in place.
- No TODO/FIXME/deprecated leftovers in the notification components, hooks, or follow utilities.

Nothing outstanding, so the tab restyle can go ahead.

## What changes

Replace the pill/segmented `TabsList` in the notification drawer with the same underline tab bar used on the entity page (Overview / Photos & Videos / …):

- Transparent tab bar with a bottom border spanning the drawer width, no grey filled container.
- Active tab: brand-orange bottom border, transparent background, no shadow, medium weight text.
- Inactive tab: muted text, brand-orange/50 border on hover.
- Unread count moves from the inline `Unread (29)` text into a small secondary `Badge` next to the label, matching how the entity page shows the Posts/Products counts. Badge is only rendered when the count is known and greater than zero.
- Two tabs only, so they keep equal width (`flex-1`) instead of the entity page's horizontal scroll.

## Technical notes

- Only file touched: `src/components/notifications/NotificationDrawer.tsx` (the `TabsList`/`TabsTrigger` block around lines 191-200), plus a `Badge` import.
- Tab bar keeps `shrink-0` and stays outside the scroll region, so the sticky date headers inside the list continue to use `top-0` unchanged.
- Border color, spacing, and hover states use existing semantic tokens (`border-border`, `brand-orange`) — no new CSS or tokens.

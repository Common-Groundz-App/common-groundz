# Consistent notification badge across the app

## The problem

The unread badge is hand-written in 6 different places, each with its own rule and shape:

| Surface | File | Shows | Style |
| --- | --- | --- | --- |
| Desktop sidebar | `src/components/ui/vertical-tubelight-navbar.tsx` | exact count (29) | red pill, `h-5 min-w-5`, `px-1.5` |
| Top nav bell | `src/components/notifications/NotificationBell.tsx` | `9+` | `h-4 w-4` circle, red-500 |
| Feed header | `src/pages/Feed.tsx` | `9+` | `w-4 h-4` circle, red-500 |
| My Stuff header | `src/pages/MyStuffPage.tsx` | `9+` | `w-4 h-4`, destructive |
| Post view header | `src/pages/PostView.tsx` | `9+` | `w-4 h-4`, destructive |
| Mobile bottom nav | `src/components/navigation/BottomNavigation.tsx` | `9+` | `w-4 h-4`, red-500 |

So the same 29 unread reads as "29" in one place and "9+" in another, and the colors (`red-500` vs `destructive`) differ too.

The `9+` circle also looks lopsided because it is a fixed `w-4 h-4` (16px) box with no horizontal padding — two glyphs get squeezed, so the `9` touches the left edge while the `+` keeps a little air on the right.

## The rule (approved)

Every compact notification entry point uses the same cap, so the same unread state never reads as two different numbers:

- `unreadCount === null` (not yet resolved) → render nothing (never falls back to 0)
- `0` → render nothing
- `1–9` → exact number
- `10+` → `9+`

Applies to: desktop sidebar Notifications item, top nav bell, Feed header bell, My Stuff header bell, Post View header bell, mobile bottom nav badge, and any future compact entry point.

Inside the drawer the Unread tab keeps the exact count (e.g. `Unread 30`) — the user is already on the notification surface and there is room for the precise number.

Rationale: the badge is an attention indicator, not an analytics counter. A small round badge over an icon also must keep a fixed footprint so it never shifts the icon or nav layout. `variant` stays a *styling* switch (size/positioning), never a count-semantics switch.

## The plan

1. **New `src/components/notifications/NotificationBadge.tsx`** — the single renderer:
   - Props: `count: number | null | undefined`, `variant: 'overlay' | 'inline'`, optional `className`.
   - Renders nothing when count is null/undefined or `<= 0`.
   - Formats via the shared helper (single cap of 9 for both variants).
   - `overlay`: absolutely-positioned pill, `h-4 min-w-4 px-1`, `rounded-full`, `text-[10px] leading-none font-medium`, flex-centered — a single digit stays a perfect circle and `9+` grows symmetrically instead of cramping. Uses `bg-destructive text-destructive-foreground`.
   - `inline`: `h-5 min-w-5 px-1.5`, same tokens, same centering, same cap.
   - Accessibility: `aria-hidden` on the visual text; the surrounding button keeps the descriptive `aria-label` (as `NotificationBell` already does) so the count is announced once, not twice.

2. **New `src/utils/notificationBadge.ts`** — `formatUnreadBadge(count, cap = ENTRY_BADGE_CAP)` returning `string | null`, plus `ENTRY_BADGE_CAP = 9`. `cap` stays a parameter for testability, but every call site uses the default.

3. **Replace all six hand-written implementations** with `<NotificationBadge />`:
   - `NotificationBell.tsx`, `Feed.tsx`, `MyStuffPage.tsx`, `PostView.tsx`, `BottomNavigation.tsx` → `variant="overlay"`.
   - `vertical-tubelight-navbar.tsx` → `variant="inline"`, keeping its existing responsive absolute→relative positioning wrapper.
   - `BottomNavigation` also gets its truthiness bug fixed: `item.badge && item.badge > 0` is replaced by the component's own null/zero handling.

4. **Tests** in `src/utils/notificationBadge.test.ts`: null/undefined → null, 0 → null, negative → null, 1 and 9 → exact, 10 and 29 and 150 → `9+`, non-integer/NaN guarded.

## Notes

- No changes to how the count is fetched or to `useNotifications` / `NotificationsContext` — this is presentation only.
- The drawer's own tab count badge (`NotificationDrawer.tsx`) is a different element (tab affordance, not an unread dot) and is left as-is.

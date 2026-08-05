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

## What the big guys do, and what we should do

- **Instagram / iOS app icons:** small round overlay badges cap early and keep a fixed footprint, because the badge is decoration on top of an icon — it must never grow and shift the icon or push nav items around.
- **X (Twitter) / Slack sidebars:** an inline label next to a nav row has real horizontal space, so it shows a higher cap (`20+`, `99+`) since the exact-ish number is actually useful there.

The shared principle: the cap follows the amount of space, and the badge never changes the layout around it. Beyond a small number, the precise value stops driving behaviour — "you have a lot to read" is the whole message.

**Recommendation:** one shared component with two sizes and one cap rule.

- Overlay badges on a bell/tab icon (top nav, feed/my-stuff/post headers, bottom nav): cap at **9+**.
- Inline sidebar row (where the label sits in a wide row): cap at **99+**, so 29 still reads as 29.

This is consistent in the way that matters — same component, same colors, same typography, same rounding rule — while respecting that a 16px circle over an icon cannot hold three digits. If you'd rather have literally the same string everywhere, we set the sidebar to `9+` too; say the word and I'll use a single cap of 9.

## The plan

1. **New `src/components/notifications/NotificationBadge.tsx`** — the single renderer:
   - Props: `count: number | null`, `variant: 'overlay' | 'inline'`.
   - Renders nothing when count is null or 0.
   - Formats via a small pure helper: `formatUnreadBadge(count, cap)` → `"29"` / `"9+"` / `"99+"`.
   - `overlay`: absolutely-positioned pill, `h-4 min-w-4 px-1` with `rounded-full`, `text-[10px] leading-none font-medium`, centered via flex — so a single digit stays a perfect circle and `9+` grows symmetrically instead of cramping. Uses `bg-destructive text-destructive-foreground` (semantic tokens, no `bg-red-500`).
   - `inline`: `h-5 min-w-5 px-1.5`, same tokens, same centering.
   - Includes an accessible label (`aria-label="N unread notifications"`, `aria-hidden` on the visual text) so the count is announced once, not twice.

2. **New `src/utils/notificationBadge.ts`** — `formatUnreadBadge` + the two cap constants, unit-testable.

3. **Replace all six inline implementations** with `<NotificationBadge />`:
   - `NotificationBell.tsx`, `Feed.tsx`, `MyStuffPage.tsx`, `PostView.tsx`, `BottomNavigation.tsx` → `variant="overlay"`.
   - `vertical-tubelight-navbar.tsx` → `variant="inline"` (keeps its existing responsive absolute→relative positioning wrapper).

4. **Tests** in `src/utils/notificationBadge.test.ts`: 0/null hidden, 1–9 exact, 10 → `9+` at cap 9, 29 exact at cap 99, 150 → `99+`.

## Notes

- No changes to how the count is fetched or to `useNotifications` / `NotificationsContext` — this is presentation only.
- The drawer's own tab count badge (`NotificationDrawer.tsx`) is a different element (tab affordance, not an unread dot) and is left as-is.

## Verified before planning

- `NotificationList.tsx:53-57` passes `imageUrl`/`username`, no `userId`.
- `src/components/ui/user-avatar.tsx` ignores both props and only forwards `userId` to `ProfileAvatar`, which renders hardcoded `"AU"` when `userId` is missing (`common/ProfileAvatar.tsx:35-43`). That's the bug.
- `UserAvatar` has exactly one importer (the notification list).
- `fetchNotifications` uses `select('*')` and `Notification` already declares `sender_id?: string` — **no type, service, or DB change needed.**
- All existing notification rows have a sender (follow/like/comment only); `system` / `journey_*` types exist in the type union but have no rows yet.

## Changes adopted from the reviews

- Use `sender_id` as the source of truth; never `notification.title` as a username.
- Use `ProfileAvatar` directly instead of adding a second image/initials path — one avatar source of truth.
- Delete the now-unused wrapper.
- Handle senderless notifications explicitly rather than letting them fall into "AU".
- **Corrected:** my earlier prefetch note was wrong. `useProfiles` caches under `['profiles', sortedIds]`, while `ProfileAvatar` reads `['profile', id]` — a batch fetch would *not* warm those entries. Batching is out of scope; if it's ever needed it must either seed individual keys via `setQueryData` or the rows must read from the batch hook.

## Implementation

1. **`src/components/notifications/NotificationList.tsx`**
   - Replace the `UserAvatar` import with `ProfileAvatar` from `@/components/common/ProfileAvatar` (`Bell` is already imported).
   - Render conditionally:

```tsx
{notification.sender_id ? (
  <ProfileAvatar
    userId={notification.sender_id}
    size="sm"
    className="h-9 w-9 shrink-0"
  />
) : (
  <div
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
    aria-hidden="true"
  >
    <Bell className="h-4 w-4" />
  </div>
)}
```

   - `shrink-0` added so the avatar can't compress in narrow rows.

2. **Delete `src/components/ui/user-avatar.tsx`** after re-confirming zero remaining imports at edit time.

No changes to `notificationService.ts`, `useNotifications.ts`, the `Notification` type, or the database.

## Two small additions of my own

- **Alt text correctness comes free:** `ProfileAvatar` sets `alt={profile?.displayName}`, so notification avatars gain proper accessible names instead of today's silent image. The Bell marker is `aria-hidden` since the row text already conveys the meaning.
- **Loading behaves per the project skeleton standard:** `ProfileAvatar` shows a rounded skeleton while the profile resolves, so rows will no longer flash "AU" during fetch. Worth eyeballing on drawer open.

## Manual check

Open the notification drawer:
- Like / comment / follow rows show the sender's real photo, or initials derived from **that sender's profile** (not the missing-user branch).
- Repeated notifications from the same sender resolve from one shared query (React Query dedupes identical keys).
- No row renders the generic missing-user placeholder.

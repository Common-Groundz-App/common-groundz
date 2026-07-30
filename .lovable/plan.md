## Verdict

Yes, both of Codex's additions are correct and small. I'm folding them in.

- **Validate `sender_id` before aggregating.** Confirmed in `src/utils/notificationGrouping.ts`: `isGroupableNotification` validates `type`, `entity_type`, `entity_id` and the absence of `comment_id`, but never checks `sender_id`. `finalize()` then builds `actorIds` by filtering on `row.sender_id`, so two senderless like rows on the same target would aggregate into a group with an empty `actorIds` array — no names, no avatars, and a nonsense sentence. Guard it at eligibility.
- **Derive "others" from distinct actors minus names actually rendered.** Not from the two name slots and definitely not from `eventIds.length` (that's the event count, which is exactly what makes the current `15` / `25` chips misleading).

## The fix

**1. Event-aware primary line.**
I verified in `supabase/migrations/20260730064207_*.sql` that mentions insert `title = '<user> mentioned you'` with `message = LEFT(comment_text, 200)`, and replies insert `title = '<user> replied to your comment'` with `message = LEFT(reply_text, 200)`. So `message` cannot blindly become the primary line. A pure formatter picks per event:

| Event | Primary line | Second line |
|---|---|---|
| Like on post/recommendation | `linda_williamss liked your post` (`message`) | — |
| Comment on post/recommendation | `dhanuu commented on your post` (`message`) | — |
| Mention (`metadata.event === 'mention'`) | `linda_williamss mentioned you` (`title`) | comment text preview, 2-line clamp |
| Reply (`metadata.event === 'reply'`) | `linda_williamss replied to your comment` (`title`) | reply text preview, 2-line clamp |
| Comment like | `linda_williamss liked your comment` (`title`) | — |
| Follow / system / other | first non-empty of `message`, then `title` | — |

"New like" / "New comment" never render as visible text again. Both fields empty → neutral "New notification" rather than a blank row.

**2. Named grouped copy, from the already-warm cache.**
`ProfileAvatar` subscribes to `['profile', userId]` via `useProfile`. The extracted `NotificationRow` subscribes to the *same* key for the first two actor ids, so React Query dedupes — no new request, no second cache path. Fixed hook count (two `useProfile` calls, undefined-safe), never in a loop, so hook order stays stable.

Remainder = `actorIds.length − (names actually rendered)`:

| Distinct actors | Names resolved | Sentence |
|---|---|---|
| 2 | 2 | `linda_williamss and hana.li liked your post` |
| 5 | 2 | `linda_williamss, hana.li and 3 others liked your post` |
| 5 | 1 | `linda_williamss and 4 others liked your post` |
| 5 | 0 | `5 people liked your post` |

The trailing phrase derives from `entity_type` (`your post` / `your recommendation`); anything unrecognised falls back to the representative's `message`. Names come from `profile.username` (falling back to `displayName`) to match what the triggers already stored — a deliberate, notification-scoped exception to the app-wide displayName rule, commented so it isn't "corrected" later.

While profiles load, the row shows the neutral `5 people liked your post` and swaps to names on resolve. The avatars beside it are already skeleton-loading in that same instant, so the transition reads as the row settling rather than as a copy glitch.

**3. Sender guard.**
`isGroupableNotification` gains a `typeof n.sender_id === 'string' && UUID_RE.test(n.sender_id)` check. Senderless or malformed-sender likes render as singletons — the safe, existing behaviour. This is the one membership change in the plan, and it only ever *reduces* aggregation.

**4. Count chip removed.**
The `{group.eventIds.length}` span beside the timestamp goes away entirely. The count now lives in the sentence; the stacked avatars carry the visual signal.

**5. Accessibility.**
`aria-label` is composed from the same visible sentence plus the preview line when present. It never reads "New like".

## Technical notes

- `src/utils/notificationGrouping.ts` — stays pure, no fetching. Add the `sender_id` guard to `isGroupableNotification`. Replace `formatGroupSummary` with `formatGroupCopy(group, resolvedNames: string[])` returning `{ primary, preview }`, plus an event-aware singleton formatter. `groupAriaLabel` consumes the same output.
- `src/utils/notificationGrouping.test.ts` — extend for: every event row in the table; 2/1/0 resolved names against 2 and 5 distinct actors; senderless likes staying singletons; unknown `entity_type`; empty `title` and `message`.
- `src/components/notifications/NotificationList.tsx` — extract the row body into a `NotificationRow` component so it can call `useProfile` for the first two actors; render primary line + optional preview + timestamp; delete the count-chip span.

## Out of scope

Strictly presentational. No changes to triggers, DB columns, notification lanes, unread counts, pagination, or click destinations. The only grouping-membership change is the sender-validity guard above.
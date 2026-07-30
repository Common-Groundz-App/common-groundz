## Verdict

Accept. I verified the claim in `supabase/migrations/20260401105731_*.sql` and it's correct — my proposed predicate would have mis-rendered every comment-like.

`toggle_comment_like` inserts:
```sql
'comment',                                              -- type
liker_username || ' liked your comment',                -- title
'',                                                     -- message (empty)
jsonb_build_object('event','like','comment_id', ...)    -- metadata
```

So the emitted shape is `type='comment'` + `metadata.event='like'`, **not** `type='like'`. My branch `type === 'like' && metadata.comment_id` would never match it, and the next branch (`type === 'comment'`) would render "Linda Williams commented on your post" for a comment like. Also confirmed `notificationDestination.test.ts:94` uses the legacy `metadata.event === 'comment_like'` shape, so both must be recognized.

The wording note is also fair — I'll say the row is not cleared or skeletoned during resolution, not that its height is literally fixed.

## The one correction

**Comment-like predicate** — a shape-tolerant helper, evaluated before the plain-comment branch:

```ts
const isCommentLike = (n) =>
  !!n.metadata?.comment_id && (
    (n.type === 'comment' && n.metadata.event === 'like') ||   // current DB shape
    n.metadata.event === 'comment_like' ||                     // legacy/fixture
    (n.type === 'like' && !!n.metadata.comment_id)             // defensive
  );
```

Final precedence, first match wins:
```
1. metadata.event === 'mention'   → {name} mentioned you
2. metadata.event === 'reply'     → {name} replied to your comment
3. isCommentLike(n)               → {name} liked your comment
4. type === 'comment'             → {name} commented on your post|recommendation
5. type === 'like'                → {name} liked your post|recommendation
6. type === 'follow'              → {name} followed you
7. otherwise                      → message || title || 'New notification'
```
Mention and reply claim their rows before step 3, so a mention carrying `comment_id` can never become a comment-like.

Note the comment-like row stores its sentence in `title` with an empty `message`, so the unresolved-profile fallback must prefer the first non-empty of `message` then `title` — the existing `formatSingleLine` already does this correctly.

## Everything else, as previously approved

- **Sender guard:** `isGroupableNotification` additionally requires a UUID-valid `sender_id`. Senderless likes render as singletons.
- **Name resolution:** `displayName`, then `username`, only when `profile.id === actorId` and the value isn't a fallback sentinel (`Anonymous User`). Otherwise `null` → stored DB sentence.
- **Grouped likes:** 2 / 3+ / 1 / 0 resolved-name shapes; remainder computed from distinct actors minus names actually rendered.
- **Structure:** `notificationGrouping.ts` stays pure. `NotificationRow` makes two fixed `useProfile` calls on the existing `['profile', id]` key — same hook, no new fetch path; React Query dedupes against `ProfileAvatar`'s concurrent subscription rather than guaranteeing a pure cache hit.
- **Loading:** no skeleton, no row clearing — the stored sentence renders and the resolved-name sentence swaps in place. Natural re-wrapping is acceptable.
- **`aria-label`** derives from the same final sentence plus preview; never reads "New like".
- **Count chip** beside the timestamp stays removed.

## Tests (`notificationGrouping.test.ts`)

Verified displayName; verified username fallback; sentinel rejected; mismatched `profile.id` rejected; each event-type line; **the real DB comment-like shape** (`type:'comment'`, `event:'like'`) → "liked your comment"; legacy `comment_like` shape → same; mention carrying `comment_id` → "mentioned you"; senderless like not grouped; grouped likes at 2 / 1 / 0 resolved names; empty title+message → `New notification`.

## Out of scope

DB triggers and stored messages, lanes, unread counts, pagination, destinations, avatars, preview-line rules.



# Updated Plan: Explore Cards — Mutual Avatars + Names

Incorporates ChatGPT's feedback. Here's what I agree with and what I'd adjust:

**Agree with:**
- Max 2 avatars — already planned, now a hard rule
- Short text — use first names only, truncate if needed
- Mobile awareness — single-column cards on mobile have enough space, but we'll use `truncate` on text to prevent overflow

**Don't need:**
- Fallback to count-only on mobile — cards are full-width on mobile (1 column), plenty of room
- Performance concerns are already handled — preview limit is 2, batch RPC, single query

## Changes to the plan

### 1. New RPC: `get_batch_mutual_previews`

Same as before. Returns up to 2 preview rows per target user with `target_user_id`, `mutual_user_id`, `username`, `first_name`, `avatar_url`, `total_count`. `SECURITY DEFINER`.

### 2. Update `UserDirectoryList.tsx`

Replace `get_batch_mutual_counts` call with `get_batch_mutual_previews`. Store preview data as a Map keyed by target user ID.

**Display rules (strict):**
- Max 2 tiny overlapping avatars (size `xs`, 24px)
- Copy uses `first_name` (falls back to `username`), single line, truncated
- 1 mutual: `[av] Followed by Hana`
- 2 mutuals: `[av][av] Followed by Hana and Ali`
- 3+: `[av][av] Followed by Hana and 3 others`
- 0: hidden
- Whole line wrapped in `truncate` to prevent overflow

### 3. Types update

Add `get_batch_mutual_previews` RPC signature.

## Files

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | New `get_batch_mutual_previews` RPC |
| `src/components/explore/UserDirectoryList.tsx` | Avatars + named copy |
| `src/integrations/supabase/types.ts` | New RPC type |


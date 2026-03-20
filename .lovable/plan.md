

# Explore Cards: Mutual Avatars + Names (Final)

## Migration: `get_batch_mutual_previews` RPC

`SECURITY DEFINER`, `SET search_path = ''`. Uses a lateral join limited to 2 preview rows per target user. Returns `target_user_id`, `mutual_user_id`, `username`, `first_name`, `avatar_url`, `total_count`.

## `UserDirectoryList.tsx`

- Replace `get_batch_mutual_counts` call with `get_batch_mutual_previews`
- Group results into a `Map<string, { previews: [...], total_count: number }>`
- Render: max 2 overlapping `xs` avatars (24px, `-ml-1` overlap on second) + truncated text
- Copy: `Followed by {Name}` / `Followed by {Name} and {Name}` / `Followed by {Name} and {N} others`
- Names use `first_name || username`, displayed in a `truncate max-w-[80px] inline-block` span to handle long names
- 0 mutuals: row hidden entirely

## Types

Add `get_batch_mutual_previews` to `src/integrations/supabase/types.ts`.

## Files

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | New RPC |
| `src/components/explore/UserDirectoryList.tsx` | Avatars + named copy |
| `src/integrations/supabase/types.ts` | New RPC type |


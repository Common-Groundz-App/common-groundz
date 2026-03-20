

# Fix: SECURITY INVOKER → SECURITY DEFINER + Explore batch RPC

## Root cause (confirmed)

The `follows` table RLS only allows users to see rows where they are the `follower_id` or `following_id`. So when the profile mutual RPC tries to read `hana → linda`, the logged-in user (rishab) can't see that row. Same issue in Explore's client-side mutual counting.

## Changes

### 1. New migration: Fix profile RPC + add batch mutual counts RPC

**Profile RPC** — change `SECURITY INVOKER` to `SECURITY DEFINER`, use `SET search_path = ''`, and explicitly schema-qualify all tables (`public.follows`, `public.profiles`). Same logic, same safe columns, same CTE pattern.

**New batch RPC** `get_batch_mutual_counts(viewer_id uuid, target_user_ids uuid[])` — `SECURITY DEFINER`, returns `(user_id uuid, mutual_count bigint)`. Replaces the client-side follows joins in Explore.

### 2. Update `UserDirectoryList.tsx`

Replace the client-side mutual counting block (lines 126-153) with a single call to `get_batch_mutual_counts`. Remove the two direct `follows` table queries that can't see third-party edges.

### 3. Update `src/integrations/supabase/types.ts`

Add the new `get_batch_mutual_counts` RPC type and update `get_profile_mutual_connections` if needed.

### Files

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | Fix profile RPC security + new batch RPC |
| `src/components/explore/UserDirectoryList.tsx` | Use batch RPC instead of client-side follows |
| `src/integrations/supabase/types.ts` | Add new RPC type |

### Not changing

- Entity copy ("you follow" suffix) — already implemented, data source is `useEntityFollowerNames` which uses a `SECURITY DEFINER` RPC, so it's correct
- `MutualConnectionsProof.tsx` — no changes needed, just needs the RPC fix
- No anti-flicker delays


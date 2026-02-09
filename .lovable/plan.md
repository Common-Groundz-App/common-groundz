

# Fix: Account Deletion RLS Policy Violation

## Problem

The `deactivate-account` edge function fails with a 500 error because the `deleted_at` update on the `profiles` table violates Row Level Security. The function uses the user's JWT client (which respects RLS) for the update, but RLS doesn't permit users to modify `deleted_at`.

## Fix

### File: `supabase/functions/deactivate-account/index.ts`

Move the admin client creation (currently at line 84) to **before** the soft-delete update (line 67). Then use `adminClient` instead of `supabaseClient` for the `deleted_at` update.

**What changes:**
- Create `adminClient` right after the double-delete guard check (around line 65)
- Use `adminClient.from('profiles').update(...)` instead of `supabaseClient.from('profiles').update(...)`
- Remove the duplicate `adminClient` creation that currently exists at line 84-87
- Reuse the same `adminClient` for the subsequent global sign-out

**What stays the same:**
- User's JWT client still used for authentication and profile read (security preserved)
- Double-delete guard (already exists, returns 400)
- Clean success payload (already exists, returns 200 with success message)
- No RLS policy changes
- No frontend changes
- No database changes

## Note on ChatGPT suggestions

Both refinements suggested are already present in the existing code -- no additions needed.


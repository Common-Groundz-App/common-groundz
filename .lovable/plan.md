

# Phase 1: Account Deleted Page -- Polish + Functional Fix

## What we're fixing

The `/account-deleted` page has several issues:
- Wrong support email (`support@commongroundz.com` instead of `support@commongroundz.co`)
- "Create a new account" button creates a Google OAuth loop (same email = same soft-deleted profile = redirected back here)
- Page looks bare and unprofessional
- No clear timeline or next-step guidance

## Changes

### 1. Fix support email in `src/config/authConfig.ts`

Update `ACCOUNT_RECOVERY_POLICY.supportEmail` from `support@commongroundz.com` to `support@commongroundz.co` to match the canonical `legalConfig.ts`.

### 2. Redesign `src/pages/AccountDeleted.tsx`

Complete visual and functional overhaul:

- Replace generic card with a polished layout using a `UserX` icon from Lucide
- Add a clear **30-day recovery window** section with visual emphasis (calendar icon, remaining days note)
- **Fix "Contact Support" button**: Use a proper `mailto:` link with pre-filled subject ("Account Recovery Request") and body text
- **Fix "Create new account" button**: Replace with clear messaging -- warn that using the same email (especially Google OAuth) won't create a new account, it will detect the deleted profile. Suggest using a different email or contacting support to recover
- Add a **"Back to Home"** link for users who land here accidentally
- Improve visual hierarchy: calmer tone, better spacing, muted background accents
- Import email from the corrected `ACCOUNT_RECOVERY_POLICY`

### What we are NOT doing (deferred to Phase 2)

- Admin user management panel
- `admin-manage-account` edge function
- Admin sidebar/portal changes

These are well-designed but not urgent. Manual recovery via the Supabase dashboard is acceptable for now.

---

## Technical Details

### Files to modify

| File | Change |
|---|---|
| `src/config/authConfig.ts` | Fix `supportEmail` to `support@commongroundz.co` (line 82) |
| `src/pages/AccountDeleted.tsx` | Full redesign -- new layout, functional mailto, OAuth loop warning, back-to-home link |

### No new files, no backend changes, no database changes.


## Phase 3.3B — Finishing pass (UI mount + cleanup)

Backend/security for 3.3B is complete and verified. Only three small items remain to close out the phase. No DB, RPC, RLS, or edge-function behavior changes.

### 1. Mount `EntityModerationBanner` on the entity detail page

Render inside the existing entity detail page, above the main entity header, only when there is something the viewer is entitled to see.

Visibility matrix (strict — public viewers must not learn an entity is pending):

| Viewer            | approved | pending             | rejected                |
|-------------------|----------|---------------------|-------------------------|
| Public / anon     | no banner| **no banner**       | cannot see entity (RLS) |
| Creator (own)     | no banner| "Awaiting review — visible to everyone" | "Hidden from public" + reason |
| Admin             | no banner| pending banner with moderation context | rejected banner + reason |
| Other signed-in   | no banner| **no banner**       | cannot see entity (RLS) |

Implementation notes:
- Use existing `useIsAdmin()` hook.
- `isCreator = !!user?.id && entity.created_by === user.id`.
- Pass `viewerCanSee={isCreator || isAdmin}` — the component already early-returns otherwise, so public viewers see nothing even if state leaks.
- Pull `approval_status` and `rejection_reason` from the entity payload already loaded by the detail page; no extra fetch.

### 2. Mount `EntityApprovalChip` in admin-only entity lists

Add the chip next to the entity name in:
- `src/components/admin/AdminEntityManagementPanel.tsx` rows
- `src/components/admin/AdminEntitiesPanel.tsx` rows (next to the existing type badge)

Rules:
- Admin surfaces only. Do not import the chip anywhere under public entity cards, search results, feed cards, or profile lists.
- Read-only badge; no click handler, no moderation actions (the Moderation tab is the action surface).
- `approval_status` is already on the entity rows these panels load — no schema or query changes needed.

### 3. Remove dead `approval_status: 'approved'` literal from `create-brand-entity`

In `supabase/functions/create-brand-entity/index.ts`, drop the `approval_status: 'approved'` field from the insert payload at the "Step 3: Create brand entity" block. The `entities_enforce_creation` BEFORE INSERT trigger already recomputes status from the creator's role (admin → approved, else pending), so the literal is dead and misleading.

- Keep `created_by: userId` (still required; trigger raises if NULL for service-role inserts).
- Keep `user_created: true` and the metadata payload as-is.
- No other lines change.

### What is NOT in scope

- No DB migrations.
- No RLS changes.
- No moderation logic changes.
- No public non-admin creation rollout (feature flag stays off).
- No quota UI, duplicate-merge, or Phase 3.4 work.
- No changes to public entity cards, search results, or feed.

### Validation checklist (run after the pass)

1. As the creator, open own pending entity → pending banner shown ("Awaiting review — visible to everyone").
2. As a logged-out / unrelated user, open the same pending entity → entity renders normally, **no banner**.
3. Reject that entity via the Moderation tab → as the creator, banner shows "Hidden from public" with the rejection reason.
4. As a logged-out / unrelated user, the rejected entity is **not visible** (RLS hides it).
5. As admin, open any pending or rejected entity → banner shows with moderation context.
6. Admin panels (`AdminEntityManagementPanel`, `AdminEntitiesPanel`) show pending/rejected chips on the correct rows; approved rows show no chip (or a subtle "approved" — match existing list density).
7. Public entity cards, search, and feed show no approval chip anywhere.
8. Admin creates a new brand via `create-brand-entity` after the literal removal → resulting row has `approval_status = 'approved'`, `approved_by = admin uuid`, `approved_at` set (trigger path).
9. Non-admin path is still blocked by the gated INSERT RLS policy (flag off) — no regression.

After these pass, Phase 3.3B is closed and we can move to the next phase.

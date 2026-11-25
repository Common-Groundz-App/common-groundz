# Phase 10.1 — Database & endorsements

Implemented and verified on 2026-11-25. No subsequent subphase begun.

## Exact changes

- `supabase/migrations/20261125104020_a5e35004-fd2e-477b-ae93-c0f82a425832.sql`: converts **only** approved dummy review `b03b4226-b59f-43c4-a8ec-56d64a858a41` from `circle_only` to `public`; replaces `public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer)` with public-only eligibility.
- `supabase/tests/phase10_1_visibility.sql`: repeatable, fixture-free database-role regression checks.
- `supabase/migrations/20261125104412_9660d52d-2962-436a-9cb4-feca5310877d.sql`: executes that test file unchanged. A verification-only migration: no permanent database objects or content changes.
- `AGENTS.md`: records canonical viewer endorsement public-only eligibility and caller-owned Circle/extended/community author scope.
- `roadmap.md`: records stabilization numbering 10.1–10.5, followed by original 11–13.
- Project memory reconciles the final Public + Private product contract.

**No frontend source, Entity V4 queries/cards, composers, media pipelines, Timeline authoring, working Circle-rating functions, visibility constraints, defaults or policies were changed.**

## Dummy review conversion

The user explicitly approved this exact record as disposable test content. Conversion was guarded by ID, author, entity, published status, original visibility and a before/after full-row fingerprint excluding only `visibility` and the trigger-maintained `updated_at`.

Author: Rishabh Sr (`c8508bd3-35a9-4cce-a7c8-0b5fc2bca965`). Entity: Nandi Hills (`ddd6416d-aade-48fe-a3b8-2370e4ef9843`). Rating remains **4**, status remains **published**. Identity, narrative, questionnaire metadata, recommendation truth and all other saved fields are identical; fingerprint remains `7bf920d0cb75ffce4b719892e35e7620`.

Before conversion: 88 public published reviews, one Circle Only published review, two private published reviews. After: **89 public, zero Circle Only, two private**, all published. Posts unchanged: 101 live public, 73 deleted public, one live private and one deleted private; zero Circle Only posts.

Referenced records checked: zero Timeline Updates, likes, saves, photo reports, journey references, Mux mappings or review-ID notifications for this record; saved media is `[]`. No record was deleted, no media removed and no reference was rewritten. Existing update/lifecycle/Mux triggers remained enabled and the guarded conversion succeeded through them.

**Stored label correction:** the actual database enum is `public | private | circle_only`; both existing private reviews and private Experiences use `private`, not `only_me`. Preserve `private` in Phase 10.3 rather than rename it based on earlier assumptions.

## Policies preserved

All nine review/post policy definitions remain unchanged, including owner-only create/edit/delete permissions and the verified-email post-creation condition.

- Reviews: public rows OR author access.
- Posts: public AND not soft-deleted, OR author access.
- The existing owner policy intentionally allows the owner to read their soft-deleted posts; outsiders/guests cannot read deleted public posts.
- Both tables retain enabled RLS.

No demonstrated authorization defect required replacing these policies. The later strict visibility check is **not activated**; current clients can still offer/write Circle Only until Phase 10.3.

## Endorsement RPC

Removed both the obsolete Circle Only branch **and the own-private eligibility branch**, so private history never seeds endorsements even for its author. Published public reviews alone are canonicalized before applying recommendation truth and limits.

Preserved signature, result fields, defaults, latest-rating fallback, deterministic ordering, canonical deduplication, author/entity/time filters, limit clamping, `STABLE`, `SECURITY DEFINER`, postgres ownership, `search_path=public`, caller identity verification and execute ACL (authenticated/service_role only; no anon/PUBLIC).

The function also serves extended/community social discovery, so adding a universal followed-authors restriction would break unrelated behavior. Existing Circle callers supply outgoing followed-author IDs; these remain respected. No follow-back requirement or new access-control policy was introduced.

## Verified results

**Database-role authorization: 39 scenario checks passed.** These use actual `anon`/`authenticated` roles with transaction-local identity claims, not administrative reads masquerading as RLS tests and not real Supabase login sessions.

- Guest, Rishabh, Hana, unrelated user and second private owner: full accessible review/post ID sets equal the expected policy result.
- Both private-review owners can read their own rows; other identities cannot. Live private post is owner-only.
- Public reviews/live public posts remain readable; deleted public posts remain unavailable to outsiders/guests.
- Personalized RPC execution denied to guests; spoofed viewer IDs rejected.
- Every tested authenticated identity receives only the expected canonical public endorsements, including private-review owners.
- Outgoing-follow author filters match exactly; a real non-mutual-follow cohort returns eligible public endorsements without follow-back.
- Nandi Hills endorsement returned exactly once; Hana's followed-author set includes Rishabh. Unrelated viewer's followed-author set excludes him.
- Empty author sets, existing limit clamp/time filters, grants and security settings preserved.
- Policy fingerprint unchanged during verification. Write policy/trigger preservation inspected; **no live create/edit/delete flows were exercised**.

**Real anonymous Data API: six direct-ID checks passed.** Public Nandi Hills review and live public post returned; both private reviews, live private post and deleted public post returned no rows.

**Real guest browser:** Nandi Hills shows Rishabh's public review, two reviews total and one recommending. View Details opens its saved narrative; owner Add Timeline Update is absent. No page errors on entity/profile inspection. Rishabh's profile remains the existing guest sign-up gate: its reviews cannot be visually verified while signed out, and that gate was deliberately not changed.

**Application regressions:** full Vitest suite passed — **115 files, 1,327 passed, three skipped**. Latest preview build log reports **build OK**. No separate manual typecheck/production-build command was run; no frontend/TypeScript code changed.

## Explicit limitations and next phase

- Real signed-in Rishabh/Hana/unrelated browser sessions are **unverified**: external user-managed Supabase refuses sandbox session minting. Database-role checks do not prove login-session/browser/cache behavior. Owner profile, Hana Circle presentation and private-reader UI need owner verification; no credentials were requested.
- Timeline/media privacy, notifications, feeds and all public aggregates are **not signed off by Phase 10.1**. This review has no saved media/updates, so no inferred media acceptance.
- Supabase reported **446 pre-existing linter findings**, none introduced by these migrations; resolve separately if authorized, including disabled leaked-password protection.
- **Phase 10.2 next, not begun:** harden review/Experience queries, Timeline/media access, public counts and privacy leakage paths. Owner-private placement belongs to 10.4. Authoring controls plus strict database visibility enforcement belong to 10.3. Resume original 11–13 only after 10.5.

Phase 10.1 implementation and targeted database verification are complete; real authenticated cross-surface acceptance remains explicitly pending.
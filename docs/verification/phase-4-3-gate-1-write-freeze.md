# Phase 4.3 Gate 1 — Legacy Write Freeze Evidence

Applied as a single atomic migration (2026-09-15). Three review rounds were folded in before
execution: no new GRANTs (reads pre-existed and stay untouched), `service_role` narrowed to
exactly the cleanup DML on the legacy tables, `increment_comment_count` explicitly rejects
non-posts input, REFERENCES/TRIGGER revoked from application roles, UPDATE revoked from
`service_role` (Gate 4 never UPDATEs the legacy tables — review markers live on `reviews`),
and the six legacy-only RPCs lost EXECUTE from PUBLIC/anon/authenticated **and** service_role
(verified live that service_role held an explicit grant; Gate 4 uses direct audited DML).

## Final table ACLs (pg_class.relacl, verified post-migration)

All four legacy tables (`recommendations`, `recommendation_likes`, `recommendation_saves`,
`recommendation_comments`):

| Role | Privileges |
|---|---|
| postgres | arwdDxtm (owner, unchanged) |
| anon | r (SELECT only) |
| authenticated | r (SELECT only) |
| service_role | rd (SELECT + DELETE only) |

Nothing was granted to anyone; SELECT privileges and SELECT policies were left untouched.

## Policies (pg_policies, verified post-migration)

Only SELECT policies remain: recommendations (3 view policies), recommendation_likes
("Anyone can view likes"), recommendation_saves ("Users can view their own saves"),
recommendation_comments ("Anyone can view recommendation comments"). All nine write
policies were dropped.

## Function EXECUTE grants (pg_proc.proacl, verified post-migration)

- Six legacy-only routines (`toggle_recommendation_like`, `increment_recommendation_view`,
  `get_recommendation_likes_by_ids`, `get_user_recommendation_likes`,
  `create_recommendation_comment_notification`, `create_recommendation_like_notification`):
  `postgres=X/postgres` only.
- Seven shared routines (`add_comment`, `update_comment`, `delete_comment`,
  `toggle_comment_like`, `increment_comment_count`, both `get_comments_with_profiles`
  overloads): grants byte-identical to pre-migration (e.g. `add_comment` retains its PUBLIC
  grant; `delete_comment`/`toggle_comment_like` retain authenticated + service_role).
  All owned by postgres; all SECURITY DEFINER with pinned `search_path = 'public'`;
  signatures and return shapes unchanged; only the legacy branch was removed.

## Functional proof (live API, anonymous key)

| # | Call | Expected | Observed |
|---|---|---|---|
| 1 | `add_comment` with `p_item_type = 'recommendation'` | reject | P0001 `Invalid item type: recommendation` |
| 2 | `increment_comment_count('recommendations', …)` | reject | P0001 `Invalid table name: recommendations` |
| 3 | direct INSERT into `recommendations` | denied | 42501 `permission denied for table recommendations` |
| 4 | `toggle_recommendation_like` RPC | not executable | 42501 `permission denied for function toggle_recommendation_like` |
| 5 | `get_comments_with_profiles('recommendation_comments', …)` 3-arg via REST | reject | PGRST203 overload ambiguity (pre-existing REST quirk; 4-arg form is the client path — see 9) |
| 6 | SELECT `recommendations` | works | rows returned |
| 7 | `add_comment` with `p_item_type = 'post'`, unauthenticated | passes type guard, auth-gated | P0001 `Unauthorized` |
| 8 | `increment_comment_count('posts', …)` | success | void, no error |
| 9 | `get_comments_with_profiles('post_comments','post_id',…,null)` 4-arg | success | `[]` |

No data was deleted and no schema was dropped in this gate. The linter count dropped from
448 to 436 issues; every remaining finding is a pre-existing category, none introduced here.

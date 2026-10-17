# Video program — Phase 6 verification and close-out

Date: 2026-10-17 UTC. **Status: OPEN — automated regression and read-only contract audit completed; owner device QA, isolated database tests and current standalone client typecheck/production build evidence remain pending. Not program complete.**

## Scope and environments

- Verification-first across Posts, root Reviews and Timeline Updates. No redesign, new viewer, dashboard, historical backfill, asset deletion or rollout.
- Client tests: sandbox, configured Vitest node/jsdom projects. These are not real-device or authenticated end-to-end tests.
- Edge checks: Deno 2.6.10, separate from client compilation; six function entry points, isolated Deno npm resolution (`--node-modules-dir=none`).
- Database: read-only SELECT/catalog audits of external Supabase `uyjtgybbktgapspodajy`. No lifecycle fixture suites executed on production; no disabled triggers or bypasses.
- Production Review video flag was unexpectedly ON at the initial audit. Restored OFF by the recorded migration and reread as `{"enabled":false}`. `reviews.composer_page_enabled` and `mux.uploads_enabled` remain ON. No other flag changes.
- Browser authentication is `external_unmanaged`; managed authenticated end-to-end checks are unavailable here. Owner QA must use an isolated test environment for new Review/Timeline video picks. Do not turn production Review videos ON for this checklist.

## Exact automated results

| Check | Result | Evidence / limitation |
|---|---|---|
| Full configured Vitest | **PASS: 90 files, 1,156 passed, 3 skipped, 0 failed; 11.59 s** | `bun run test`; final run started 11:28:18 UTC. Previous initial run was 88 files / 1,143 passed / 3 skipped. |
| Edge helper tests | **PASS: 6 passed, 0 failed** | `track-media-view/reviewMedia_test.ts`, Supabase Deno test tool, with typechecking. Not endpoint integration tests. |
| Edge typecheck: mux-create-upload | PASS | `deno check --no-lock --node-modules-dir=none supabase/functions/mux-create-upload/index.ts` |
| Edge typecheck: mux-webhook | PASS after minimal typing correction | Same command for webhook; generic ReturnType inferred an unusable schema. `SupabaseClient` annotation fixes compilation, not runtime behavior. |
| Edge typecheck: mux-reconcile-upload | PASS | Separate entry-point check. |
| Edge typecheck: mux-register-mappings | PASS | Separate entry-point check. |
| Edge typecheck: mux-sync-post-mappings | PASS | Separate entry-point check. |
| Edge typecheck: track-media-view | PASS | App node_modules resolved old SDK lacking `/cors`; isolated Deno dependencies resolve it. No CORS behavior rewrite. |
| Latest local preview compilation | PASS | `/tmp/observability/build-errors.log`: build OK, 11:28:09 UTC, after code corrections. Not a standalone production build/typecheck. |
| Independent current client TypeScript | **BLOCKED / not rerun** | Harness prohibits manual app typechecks. Required external close-out command: `bunx tsgo -p tsconfig.app.json --noEmit` (and `-p tsconfig.node.json --noEmit` for Vite config). No claim that Deno or Vitest establishes this. |
| Current production build | **BLOCKED / not rerun** | Harness prohibits manual app builds. Required external command: `bun run build`. Hosted status shows prior successful run `br_06d4c00f-683e-48b8-ba2b-c803be68c24b`, commit `0d0dd77283c118f108d6fdb87f2371c288a95259`, finished 06:52:10 UTC; not proof of a post-correction production build. |

Three skips are pre-existing legacy ReviewForm subject-switch tests: one existing-review switch and two questionnaire reset cases. They remain skips, not passes. `LightboxPreview.handoff.test.tsx` is explicitly documentation-only and contains no executable assertions; it is not counted as a passing suite.

### Genuine defects found and narrowly corrected

1. **Review analytics identity mismatch:** `visibleReviewMedia` deliberately replaces saved IDs with namespaced display keys. Card and lightbox had submitted those display keys as persisted `mediaId`; the server rightly rejected them. The display projection now retains the original saved ID in UI-only `viewMediaId`; both players submit it. ID-less legacy records omit `mediaId` and use the already-approved canonical identity match. Playback keys, ordering, authoring and Post tracking are unchanged. Three regression cases exercise Review/update projection against the actual server resolver.
2. **Deleted media eligibility:** ready persisted media marked `is_deleted` could qualify on a forged submission although the UI hides it. The resolver now rejects it; one Deno regression covers ID and canonical-path submissions. Deleted source records already fail source lookup.
3. **Webhook typing:** use the SDK client type rather than generic function ReturnType. All six separate checks now pass.
4. **Temporary logging:** Post upload timing used unconditional `console.debug`; browser verbosity was not a production gate. Now DEV-only. `[feed-video-mobile]` remains DEV or explicit `?feedvideodebug=1`, OFF in production by default. Operational Edge errors/idempotency logs are retained, not mislabeled QA logs.
5. **Verification runner omission:** the existing `postDisplayMedia` (4 cases) and `lightboxHandoffSeek` (6 cases) suites were outside the explicit allowlist. Included without changing production behavior. Together with 3 identity regressions this explains 1,143 → 1,156 app passes.

## Actual content-specific contracts, verified against live definitions

**Correction to the earlier interim report:** `mux_upload_mappings.media_id` DOES exist: nullable UUID, column 14. The Post-only BEFORE INSERT trigger `mux_mapping_require_media_id` raises `23502/post_mapping_media_id_required` only for new Post mappings lacking it. No equivalent requirement applies to Review/Timeline mappings. Earlier incomplete catalog output was not evidence of absence.

| Contract | Posts | Root Reviews / Timeline Updates |
|---|---|---|
| Media identity | `post_media_assign_ids` preserves existing unique saved UUIDs, accepts valid new client IDs or assigns IDs when appropriate; clientKey is local render identity. Never assume every new ID is server-created. | Saved media remains under the approved Review architecture; namespaced display key uses kind + content UUID + upload/id/url. `viewMediaId` preserves saved ID separately for analytics only. |
| Mapping authority | Post save triggers + `post_mux_link_items` derive `media_id` and position from persisted media; browser compatibility endpoints invoke catch-up RPC, not direct mapping inserts. | `review_media_mux_after` synchronizes kind/content UUID/owner/upload in the save; patch locates current item by persisted upload ID. `media_index` is current slot data, not a requirement for Post-style Review UUID mapping. |
| Historical maps | Old NULL Post media_id remains grandfathered; no repair/backfill. | NULL media_id is expected and approved. |
| New-video readiness | Successful upload plus authoritative Ready, asset ID, playback ID, finite positive duration ≤60 s; upload/processing cannot publish. | Same complete new-video readiness gate; retained saved processing/failed video does not newly block unrelated edits under its existing policy. |
| Upload | Concurrent Post poster/URL flow, immediate PUT after URL, scoped attempts, nonfatal poster errors, frozen local preview. | Existing sequential Review upload path retained, declared size, Mux only; no Post flow migration. |
| Edit | One-hour user edit window, existing admin exception. | Root one-hour immutability; timeline edit through latest-entry RPC within its own hour; after-hour broken-video removal is not a bypass. |
| Playback | Stable Post key for open/resume, video-first display projection; manager owns activation and managed HLS budget. | Approved Review block/display/player architecture retained, including existing numeric navigation/return contract. No Post-only ID/navigation migration imposed. Shared managed players use existing coordinator where present; unmanaged legacy paths remain. |

Live data: 18 patched Post maps, 17 with historical NULL media_id; 12 removed Post maps, 4 NULL. Reviews: 1 patched/1 removed, NULL IDs; updates: 3 patched/3 removed, NULL IDs. Read-only targeted audits found **0 recent enforced Post missing IDs, 0 active non-NULL Post ID/upload mismatches, 0 active Review/update owner/content/upload mismatches**. These are current data consistency checks, not simultaneous race tests.

## Analytics, privacy and Edge/database consistency

- Sources permitted: post/review/entity/review_update. Root → reviews.id; update → review_updates.id, never root ID/user ID. Home Review-type Posts remain post.
- Verified viewer derives from authentication; no browser-supplied user ID. Review/update source rows loaded server-side, parent Review loaded for update. Missing rows, unauthorized parent access, signed-in source/parent author, unrelated/non-ready/deleted media rejected.
- Current Review RLS reads public OR owner. Updates follow parent visibility through parent RLS. No invented Circle/private sharing rule; owners may read their private content but self-views still do not qualify.
- Canonical stored identity is server-derived `mux:<playback_id>` or `storage:<bucket>/<object-path>`; client presentation URL is only a hint when no saved ID is supplied. Unknown submitted ID never falls back to a URL.
- Review/update qualification: accumulated ≥2.5 s within one player, playing, ≥50% visible, foreground, excluding waiting/seeking/paused time. Pause preserves accrued time. Card and lightbox sessions are separate. Muted playback may qualify; sound is not a requirement.
- Lifetime uniqueness: user+source+content+canonical media, or anonymous session+source+content+canonical media. Partial unique indexes and concurrent 23505 handling verified statically; true concurrent insertion NOT executed.
- **Existing Post-tracker limitation explicitly preserved:** Post waiting/seeking events do not stop its elapsed playback accumulator. Existing regression asserts that behavior; this phase does not silently change it. Post/entity endpoint normalization and count paths remain unchanged. Review elapsed timing is client telemetry, not independent server proof of physical playback.
- `media_views` has RLS enabled and only a service_role policy. Ordinary roles have table grants but no allowing RLS policy, so cannot directly read/write analytics. No ordinary/admin raw viewer list exposed. `mux_upload_mappings` has no user-facing policy; internal access remains server-side.
- Admin RPC internally requires auth.uid + has_role(admin), fixed `pg_catalog, public` search path, aggregate columns exactly `source`, `qualified_views`, `registered_viewers`, `anonymous_sessions`. anon EXECUTE false; authenticated/service EXECUTE true (service context alone still fails internal auth check). `_source_id` requires `_source`; invalid source raises 22023 after admin authorization. No average watch duration or viewer identifiers returned.
- Current unauthenticated/no-user RPC call returned **42501 permission denied**. Actual non-admin/admin session calls and 22023 cases are pending, not inferred from this test.
- Current aggregate snapshot: only post rows (92, 6 registered viewers, 3 anonymous sessions); no Review/update analytics rows. Zero duplicate identity groups. This snapshot is NOT a QA baseline for future tests and does not prove live Review qualification.
- No noninternal triggers on media_views: view insert has no trigger path mutating content timestamps, Post counters or deletion queues. End-to-end before/after invariance remains pending.

## Rerun inventory

Full `bun run test` now includes stable mediaIdentity, Post display order, handoff seek, load budget/provider, active selection, Post upload Fix 3, Review display Phase 3, composer readiness/retained-media Phase 2, Mux status readiness, review duration, entity manager, Review tracker Phase 5. Rerun the full suite after any defect correction; no green scratch-file claims.

Edge: Deno helper tests plus separate `deno check --no-lock --node-modules-dir=none` for each of the six entry points above. Typechecks do not assert network response behavior or deployed version parity.

Database suites to rerun **only in an isolated database with original triggers intact**: `review_video_phase1.sql`, `review_video_phase2.sql`, `post_video_phase2_prodsafe.sql`, `post_video_phase3.sql`, `post_video_phase4.sql`. The unsafe original `post_video_phase2.sql` disables triggers; do NOT execute it on live tables or use bypasses to manufacture fixtures. Historical cases require imported genuine pre-rule data in isolation.

## Explicit pending / blocked checks

| Check | Status / blocker |
|---|---|
| Owner device matrix below | PENDING — owner runs real devices in isolated test environment. |
| Client standalone TypeScript + current production build | BLOCKED here — use permitted external checks/current hosted diagnostics, then record exact commands and output. |
| Live endpoint integration, authenticated non-admin/admin RPC, author exclusion and lightbox-first qualification | PENDING — test sessions/fixtures required, not covered by pure helpers. |
| Review Phase 1 true overlap: private vs update-video insert; Ready vs removal; Ready vs reorder | Previously BLOCKED — two simultaneous database connections unavailable in prior SQL Editor tests; functional sequential evidence is historical only. |
| Post Phase 3/4 true save vs reconcile and save vs webhook overlap | Previously BLOCKED — single-connection SQL tool; lock order/source inspection is not overlap proof. |
| Review/update simultaneous duplicate submissions | Previously BLOCKED / unverified — needs simultaneous endpoint requests with same fresh viewer/source/media and baseline, not sequential duplicates. |
| Lifecycle SQL suites | Not rerun — request is read-only production audit; requires isolated test DB. Historical results: Review Phase 1 39/39, Phase 2 8/8; Post Phase 3 8/8, Phase 4 29/29 (not fresh results). |
| Historical Post production-safe exclusions | Previously recorded **7 agreed blocked**, not passes: pre-rule eligibility conversion; old over-60s video grandfathering; old over-limit caption/removal; historical stuck video unchanged/no link; photo removal beside historical video; stale stored playable fields. Checked-in file names six BLOCKED entries, while earlier record says seven; seventh item/result reconciliation remains unresolved, not silently invented. |
| Complete historical storage/fixture inventory | Not established by this read-only pass. 27 existing is_test upload rows; known pp_/p2_/p3_/p4_ fixture prefixes and phase6-named uploads = 0. Do not delete is_test rows without provenance/owner approval. No Phase 6 content/storage/Mux assets created; no storage downloads/uploads performed. |

## Owner-run checklist: preparation and exact device matrix

Use a separate test Supabase/environment. Identify author A, non-author viewer V1, fresh viewer V2, non-admin N and admin; use fresh anonymous browser sessions as needed. Create a root Review R and its Timeline Update U with distinct ready videos, plus Post P with a photo/video. Use normal app controls, not forged trusted Mux fields or disabled triggers. Use videos ≤60 s and ≤100 MB; retain a genuine historical processing/failed fixture for unrelated edits. Enable Review picking in test only; record test URL, build/version, device/OS/browser, account role, fixture IDs, timestamp, screenshots/network evidence and PASS/FAIL/BLOCKED per row.

Every cell below starts **PENDING**. Run against the surfaces that exist: Posts Home/Post Detail/Profile; Reviews entity/Profile cards; updates entity timeline/Profile timeline viewer; each associated existing lightbox. Do not create new surfaces.

| ID / exact action and acceptance | Desktop Chrome | iPhone Safari | iPhone Chrome | Android Chrome |
|---|---|---|---|---|
| L1 Create P/R/U with photo+video; local preview/progress; Publish/Save blocked while uploading/finishing/processing; trusted Ready then save/readback and playback | Pending | Pending | Pending | Pending |
| L2 Remove while upload, finalizing and processing; video slot immediately free; replace with different file (also same filename); late old response cannot restore item or affect replacement | Pending | Pending | Pending | Pending |
| L3 Within edit hour: text-only edit, remove photo beside video, remove video, replace video on P/R/U; saved retained video unchanged; mapping reflects correct content/upload | Pending | Pending | Pending | Pending |
| L4 Existing processing/failed saved media permits agreed unrelated edit; after hour non-admin media change blocked; update latest/hour rule; normal whole-entry/thread deletion path | Pending | Pending | Pending | Pending |
| L5 Limits: 5th media, 2nd video, >100 MB, >60 s cannot publish; Ready missing asset/playback or invalid/nonfinite/nonpositive duration is blocked | Pending | Pending | Pending | Pending |
| P1 Cold feed entry, restored scroll and tall Post; ≥0.60 activation or exactly one dominant ≥0.35 fallback; manual Play requests coordinator and actually starts; no async gesture-token guarantee | Pending | Pending | Pending | Pending |
| P2 Scroll several Posts rapidly: poster-first standby, max two coordinator-authorized managed HLS sources; no competing preload path; do not apply a new global two-source rule to all viewers/unmanaged surfaces | Pending | Pending | Pending | Pending |
| P3 Card/feed → lightbox around 12 s → return, all content types; repeat paused/playing × muted/unmuted; same logical time, state and shared sound intent | Pending | Pending | Pending | Pending |
| P4 Post lightbox video → photo → back resumes remembered time/state; rapid arrows, closure and immediate reopen cancel stale callbacks; no abnormal poster freeze | Pending | Pending | Pending | Pending |
| P5 Post photo+video → video-only saved edit, return to Home/Detail/Profile without refresh; right stable item plays and old cleanup cannot unregister replacement | Pending | Pending | Pending | Pending |
| A1 Review/update card-first qualification + lightbox repeat: expected deltas below; independently test lightbox-first with fresh viewer | Pending | Pending | Pending | Pending |
| A2 Pause, buffering, forward seek, hidden tab, <50% visibility, separate short card/lightbox sessions; no ineligible-time inflation; author/anon cases below | Pending | Pending | Pending | Pending |
| A3 Root/update distinct attribution and unchanged Home Review-type Post analytics; rejected private/deleted/unrelated media; tracking error must not break playback/mute/handoff | Pending | Pending | Pending | Pending |
| F1 Test flag OFF after saved video: no new Review picks, saved playback/unrelated edits unchanged; nonpublic/parent visibility locks retained; production stays OFF | Pending | Pending | Pending | Pending |

Playback acceptance uses existing Post `HANDOFF_REACHED_TOLERANCE=0.25 s` (and duration-end clamp), measured at completed resume before normal playing advances. No restart at zero, wrong-item playback, lost explicit pause/mute intent or abnormal persistent freeze. Normal HLS rebuffering is allowed. Review/Timeline retains its existing return/navigation contract; report deviations rather than silently adopting Post keyed-carousel behavior.

## Analytics baselines and expected deltas

Before EVERY row, admin captures current per-source/per-content aggregates; after event completion reread and subtract. Never assume absolute 0/1. Missing RPC row means baseline zero for that source; the SQL GROUP BY does not manufacture empty rows. Keep a fresh viewer/source/video pair per first-qualification test so lifetime dedup does not mask success. Screenshot/count only aggregates; do not expose user IDs or tokens.

Admin read examples (own authenticated admin session, or owner SQL Editor):

```sql
SELECT * FROM public.admin_review_video_view_stats('review', '<R_UUID>');
SELECT * FROM public.admin_review_video_view_stats('review_update', '<U_UUID>');
-- global and source-only supported:
SELECT * FROM public.admin_review_video_view_stats();
SELECT * FROM public.admin_review_video_view_stats('review', NULL);
```

For each row write baseline B and result A for `(qualified_views, registered_viewers, anonymous_sessions)`; assert A−B:

| Scenario (fresh pair unless noted) | Expected delta |
|---|---|
| Non-author V1 ≥2.5 s Review card playback | (+1,+1,0) for R; (0,0,0) for U |
| Same V1 opens R lightbox and qualifies again | (0,0,0) for R: lifetime dedupe |
| V2 qualifies in lightbox FIRST, then card | First (+1,+1,0); card repeat (0,0,0) |
| Same V1 qualifies U | (+1,+1,0) for U; (0,0,0) for R. Global registered count can stay unchanged if V1 already appears there. |
| Author A signed in watches R or U | (0,0,0); owner/private read access does not override author exclusion |
| Fresh anonymous session qualifies | (+1,0,+1); same session/same video/card+viewer repeat (0,0,0) |
| Another fresh anonymous session qualifies same video | (+1,0,+1); sessions are not unique people |
| Same player plays 1.2 s, pauses, then 1.3 s | First interval delta 0; qualifies at total 2.5 s (allow next frame/send), then one qualified view |
| Card 1.2 s + lightbox 1.3 s separately | (0,0,0); no cross-player subthreshold accumulation |
| Pause/waiting/seeking/background/<50% visibility | No delta until 2.5 s of eligible playback accumulated; seeking forward cannot substitute for playback |
| Unrelated ID/URL, photo, preparing/failed/deleted media, missing/deleted source, unauthorized private parent | (0,0,0), rejected; never create an otherwise disallowed private video to build fixture |
| Two concurrent identical fresh submissions | Exactly one view delta (registered or anonymous as appropriate); still pending actual concurrency evidence |
| Composer/local preview | (0,0,0); source-less viewer must not start Review analytics |

Post check: record P's existing video-row aggregate and separate posts.view_count before/after; repeat approved existing Post/card/lightbox policy, not new Review dedup/self-exclusion rules. Review/update tests must not change P counters, content timestamps, or media-deletion candidate counts; record those baselines before any view-only test.

Admin security checklist: anon cannot execute summary; real N receives 42501; admin sees aggregates only. As admin, `(NULL,<id>)` and invalid source receive 22023; valid no-args/source-only/source+ID calls return exactly the documented columns. Direct anon/member analytics access denied by RLS. Verify live Edge version and client projection fix together before recording analytics PASS.

## Close-out gate and exceptions

Owner returns completed matrix/evidence. Rerun affected automation for any confirmed defect, and the full suite/typecheck/build at final candidate. Record exact fresh SQL/Edge integration/concurrency outputs separately from historical evidence; clear no fixtures/assets without approved exact provenance. Read back production Review flag OFF and reconcile roadmap.

Only mark **VIDEO PROGRAM — COMPLETE** after required QA and current compiler/build checks pass, with each remaining exception explicitly accepted by the owner. No Phase 7 is started automatically. Current unresolved concurrency/history/compiler/storage-provenance items are not newly accepted exceptions merely because listed here.

Intentionally deferred: Post view-count redesign; watch-duration analytics; cross-player accumulation; admin dashboard/UI; private Mux playback; asset deletion/cleanup; production Review rollout; historical Post repair/backfill. Signed-out authors cannot be recognized and anonymous metrics identify sessions, not people. Existing historical test exclusions and Post qualification limitation remain clearly disclosed for owner acceptance.
## Steps 1–3 re-run (2026-10-17 12:20 UTC) — Phase 6 still OPEN
- tsgo tsconfig.app.json: PASS (exit 0) · tsgo tsconfig.node.json: PASS (exit 0) · bun run build: PASS (built 18.19s)
- track-media-view deployed with review path: PASS (unknown review → `not_found`; real public review + unknown mediaId → `media`, no path fallback)
- mux-webhook parity: BLOCKED (no safe signed-webhook probe; source fix present)
- Client fixes in source + build (viewMediaId, is_deleted rejection): PASS
- reviews.video_enabled = false (get_public_flags): PASS
- RPC non-admin 42501 / admin success / 22023: BLOCKED live (project is external_unmanaged — no authenticated session can be minted; SQL tool role lacks EXECUTE). Static: SECURITY DEFINER, search_path pg_catalog,public, EXECUTE only authenticated+service_role (anon denied), body raises 22023 and 42501.
- Deleted media live: BLOCKED (no deleted video rows exist); covered by Deno test + unknown-id live rejection.

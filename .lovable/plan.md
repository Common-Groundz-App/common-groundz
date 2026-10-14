# Post video Phase 4, Step 2 — stable media IDs (database draft for review)

Step 1 approved. The Post view-count change is dropped from Phase 4: views are already keyed by file or playback identity, not by position. Existing view-tracker tests stay as regression coverage. Review and timeline analytics remain Phase 5. Composer and viewer changes are Step 3 and are not part of this step.

## Phase 3 discrepancy (resolved, with a correction)
- No report said the composer's linking calls were removed, and they weren't. The composer still calls `mux-sync-post-mappings` on edit (`EnhancedCreatePostForm.tsx:746`) and `mux-register-mappings` on create (`:914`).
- The earlier plan had said these endpoints would become "no-op-safe for one release". Phase 3 did not change them.
- Correction to the Phase 3 record: `docs/verification/post-video-phase-3.md` says legacy linking "follows the Post as currently saved". That is only partly true:
  - `mux-sync-post-mappings` checks the client's slot list against an unlocked read of the Post, then passes that list to `sync_mux_post_mappings`, which treats it as the truth.
  - A stale tab sending a shorter list could mark a still-present video's link as removed. That video would then sit in "processing" until the Post is edited again.
  - `mux-register-mappings` inserts links directly. Today it harmlessly hits the link the save already created.
- This step closes both gaps and corrects the Phase 3 document.

## What this step does
1. **Server ID rule on every Post save that changes media** (create, or edit with different media):
   - Existing items keep their saved ID, matched by Mux upload ID or by canonical own-storage path. A changed or forged ID is put back.
   - A brand-new item keeps a valid client UUID, unless that UUID belongs to another saved item in this Post. Otherwise it gets a fresh server UUID.
   - Duplicate IDs introduced by the save are refused (`post_media_duplicate_id`).
   - Position is never used. Ambiguous historical items (same identity twice, or an invalid saved ID) pass only if unchanged apart from order. Otherwise the save is refused (`post_media_identity_ambiguous`).
   - Items with no identity (foreign host or empty URL) pass untouched if unchanged, and are treated as new if changed.
   - The rule never runs on caption-only edits or on the trusted Mux patch. No existing Post is rewritten by this migration, and clean data stays byte-identical unless that Post's media is actually edited.
2. **Mux links store `media_id`:**
   - Nullable column, no backfill.
   - New Post links must carry it (insert trigger).
   - Saves write it. A removed link that is reactivated takes the item's current ID.
3. **Patching uses the ID when present.** For links with `media_id`, the Mux patch finds the item by ID and requires the upload ID to match. `media_index` is only a location hint, and a stale hint can't redirect the patch. Old links with an empty `media_id` keep today's slot plus upload-ID rule.
4. **Compatibility endpoints derive everything from the locked saved Post.**
   - `sync_mux_post_mappings` ignores client items. It locks the Post, retires links if the Post is deleted or missing, and otherwise links from saved media with catch-up patching.
   - Both Edge Functions keep their request shape and ownership checks, then call it. `mux-register-mappings` no longer inserts links itself.
5. **Unchanged:** the Phase 3 lock order, all-or-nothing saves, the `app.mux_system_patch` exemption, the "removed upload can't move to another Post" rule, Review mappings, grandfathered and stuck Posts, Mux assets, and Review videos (OFF).

## Exact migration SQL

```sql
-- 1. Canonical own-storage key and media identity (server-only helpers)
CREATE OR REPLACE FUNCTION public.post_media_storage_key(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT CASE WHEN p_url ~ '^https://uyjtgybbktgapspodajy\.supabase\.co/storage/v1/object/(public|sign)/[^/?#]+/[^?#]+'
    THEN regexp_replace(split_part(split_part(p_url,'?',1),'#',1),
           '^https://uyjtgybbktgapspodajy\.supabase\.co/storage/v1/object/(public|sign)/','') END;
$f$;

CREATE OR REPLACE FUNCTION public.post_media_identity(p_item jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT CASE
    WHEN jsonb_typeof(p_item) <> 'object' THEN NULL
    WHEN coalesce(p_item->>'mux_upload_id','') <> '' THEN 'mux:' || (p_item->>'mux_upload_id')
    WHEN public.post_media_storage_key(p_item->>'url') IS NOT NULL THEN 'file:' || public.post_media_storage_key(p_item->>'url')
  END;
$f$;

-- 2. ID rule
CREATE OR REPLACE FUNCTION public.post_media_assign_ids(p_old jsonb, p_new jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path TO 'public' AS $f$
DECLARE
  v_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_old jsonb := CASE WHEN jsonb_typeof(p_old) = 'array' THEN p_old ELSE '[]'::jsonb END;
  v_out jsonb := '[]'::jsonb; v_item jsonb; v_ident text; v_id text; v_saved text; v_cnt int;
  v_unchanged boolean; v_new_dups int; v_old_dups int;
BEGIN
  IF jsonb_typeof(p_new) <> 'array' THEN RETURN p_new; END IF;
  FOR v_item IN SELECT e FROM jsonb_array_elements(p_new) WITH ORDINALITY t(e,o) ORDER BY o LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN v_out := v_out || jsonb_build_array(v_item); CONTINUE; END IF;
    v_ident := public.post_media_identity(v_item);
    v_id := v_item->>'id';
    v_unchanged := EXISTS (SELECT 1 FROM jsonb_array_elements(v_old) e
                            WHERE jsonb_typeof(e) = 'object' AND (e - 'order') = (v_item - 'order'));
    v_cnt := 0; v_saved := NULL;
    IF v_ident IS NOT NULL THEN
      SELECT count(*), min(e->>'id') INTO v_cnt, v_saved FROM jsonb_array_elements(v_old) e
       WHERE public.post_media_identity(e) = v_ident;
    END IF;

    IF v_cnt = 1 AND v_saved ~* v_re THEN
      IF v_id IS DISTINCT FROM v_saved THEN v_item := v_item || jsonb_build_object('id', v_saved); END IF;
    ELSIF v_cnt >= 1 THEN
      IF NOT v_unchanged THEN RAISE EXCEPTION 'post_media_identity_ambiguous' USING ERRCODE = '22023'; END IF;
    ELSIF v_ident IS NULL AND v_unchanged THEN
      NULL; -- untouched item without identity: leave byte-identical
    ELSE
      IF NOT (coalesce(v_id,'') ~* v_re)
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_old) e WHERE e->>'id' = v_id) THEN
        v_item := v_item || jsonb_build_object('id', gen_random_uuid()::text);
      END IF;
    END IF;
    v_out := v_out || jsonb_build_array(v_item);
  END LOOP;

  SELECT count(*) INTO v_new_dups FROM (SELECT e->>'id' FROM jsonb_array_elements(v_out) e
    WHERE coalesce(e->>'id','') <> '' GROUP BY 1 HAVING count(*) > 1) x;
  SELECT count(*) INTO v_old_dups FROM (SELECT e->>'id' FROM jsonb_array_elements(v_old) e
    WHERE coalesce(e->>'id','') <> '' GROUP BY 1 HAVING count(*) > 1) x;
  IF v_new_dups > v_old_dups THEN RAISE EXCEPTION 'post_media_duplicate_id' USING ERRCODE = '22023'; END IF;
  RETURN v_out;
END $f$;

REVOKE EXECUTE ON FUNCTION public.post_media_storage_key(text), public.post_media_identity(jsonb),
  public.post_media_assign_ids(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_media_storage_key(text), public.post_media_identity(jsonb),
  public.post_media_assign_ids(jsonb, jsonb) TO service_role;

-- 3. Call it in the existing BEFORE trigger (only change: one line after the early returns)
--    CREATE OR REPLACE public.posts_media_mux_before() identical to the live definition, plus:
--      IF NEW.media IS NULL OR jsonb_typeof(NEW.media) <> 'array' THEN RETURN NEW; END IF;
--      NEW.media := public.post_media_assign_ids(v_old, NEW.media);   -- new
--    The system-patch branch and the caption-only early return run before it, so neither is affected.

-- 4. media_id on links
ALTER TABLE public.mux_upload_mappings ADD COLUMN IF NOT EXISTS media_id uuid;

CREATE OR REPLACE FUNCTION public.mux_mapping_require_media_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $f$
BEGIN
  IF NEW.content_type = 'post' AND NEW.media_id IS NULL THEN
    RAISE EXCEPTION 'post_mapping_media_id_required' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS mux_mapping_require_media_id ON public.mux_upload_mappings;
CREATE TRIGGER mux_mapping_require_media_id BEFORE INSERT ON public.mux_upload_mappings
FOR EACH ROW EXECUTE FUNCTION public.mux_mapping_require_media_id();

-- 5. post_mux_link_items: also emit media_id (valid UUID or NULL)
--    jsonb_build_object('mux_upload_id', ..., 'media_index', e.idx - 1,
--      'media_id', CASE WHEN e.item->>'id' ~* '<uuid re>' THEN e.item->>'id' END)

-- 6. sync_mux_post_mappings_core: identical to Phase 3 except
--    a) v_items keeps media_id;
--    b) reactivation:  SET ..., media_id = (s->>'media_id')::uuid
--    c) insert:        INSERT (..., media_id) SELECT ..., (v_item->>'media_id')::uuid
--    Advisory lock, row locks, parking, atomic unique_violation rule and patch branch unchanged.

-- 7. Legacy wrapper derives from the locked saved Post (client items ignored)
CREATE OR REPLACE FUNCTION public.sync_mux_post_mappings(p_content_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE v_media jsonb; v_deleted boolean; v_found boolean;
BEGIN
  SELECT media, is_deleted, true INTO v_media, v_deleted, v_found
    FROM public.posts WHERE id = p_content_id FOR UPDATE;
  IF v_found IS NOT TRUE OR v_deleted IS TRUE THEN
    UPDATE public.mux_upload_mappings SET status='removed', last_error='content_deleted'
     WHERE content_type='post' AND content_id=p_content_id AND status IN ('pending','patched','errored');
    RETURN jsonb_build_object('results','[]'::jsonb, 'post', CASE WHEN v_found IS TRUE THEN 'deleted' ELSE 'missing' END);
  END IF;
  RETURN public.sync_mux_post_mappings_core(p_content_id, public.post_mux_link_items(p_content_id, v_media), true);
END $f$;
-- grants unchanged (service_role only)

-- 8. patch_content_media_from_mux: identical to Phase 3 except, for Post links, after the
--    media-array check and before the slot-range check:
--      IF v_mapping.media_id IS NOT NULL THEN
--        SELECT (t.o - 1)::int INTO v_idx FROM jsonb_array_elements(v_media) WITH ORDINALITY t(e,o)
--         WHERE t.e->>'id' = v_mapping.media_id::text LIMIT 1;
--        IF v_idx IS NULL THEN
--          UPDATE mappings SET status='orphaned', last_error='media_id_not_found' WHERE id = v_mapping.id;
--          RETURN 'orphaned';
--        END IF;
--        v_mapping.media_index := v_idx;   -- local only; row hint is refreshed by the next save
--      END IF;
--    The existing upload-ID/type/provider slot check then runs on that item. NULL media_id keeps the old path.
--    Lock order (Post row -> advisory -> mapping) unchanged.
```

In the migration itself, items 3, 5, 6 and 8 will be written out in full as `CREATE OR REPLACE` statements. Each one is the live definition with only the lines described above changed.

## Edge Functions (deployed with this step)
- **`mux-sync-post-mappings`:** keep authentication, request parsing and the ownership check. Drop the unlocked slot check. Call `sync_mux_post_mappings(content_id, '[]')`, which derives from the saved Post, and return `{ results }`.
- **`mux-register-mappings`:** keep authentication, request parsing and the ownership check. Replace the direct insert and catch-up loop with the same call, and return `{ results }`. The composer only checks for an error, so its behavior is unchanged.

## Tests: `supabase/tests/post_video_phase4.sql` (rolled back, owner test account)
1. **New item with a valid client UUID:** the UUID is kept.
2. **New items with a missing, empty or non-UUID ID:** each gets a fresh UUID.
3. **New item reusing the ID of another saved item in the Post:** it gets a fresh UUID, and the saved item keeps its own.
4. **Edit that forges an existing photo's or Mux video's ID:** the saved ID is restored.
5. **Two new items with the same ID:** refused with `post_media_duplicate_id`. Post unchanged.
6. **Canonical storage:** the same file sent as a public URL, a signed URL with a token, and with `?x=1` keeps one ID. A foreign-host URL is not matched.
7. **Removing the first of three items:** the remaining two keep their IDs and are otherwise byte-identical except `order`.
8. **Caption-only edit:** media is byte-identical.
9. **Ambiguous historical Post** (seeded with triggers off, same file twice):
   - an edit that leaves both copies unchanged passes;
   - an edit that changes one copy is refused with `post_media_identity_ambiguous`.
10. **New Post video save:** the link stores `media_id` equal to the item's ID.
11. **Direct insert of a Post link without `media_id`:** refused.
12. **Webhook after the video moves to slot 0, with the link's slot hint deliberately left stale:** the correct video is patched, the photo is untouched, and the result is `patched`.
13. **Link with a mismatched `media_id`:** `orphaned`, and the Post is unchanged.
14. **Legacy link** (`media_id` set to NULL): patched through the old slot rule.
15. **Late webhook after the video is removed:** `noop_removed`, and the Post is unchanged.
16. **Legacy wrapper given a stale shorter client list while the video is still in the Post:** the link stays active, because the saved Post decides.
17. **Legacy wrapper on a deleted Post:** links retired.
18. **Lock order:** checked against the function definitions (Post `FOR UPDATE` comes before the advisory lock, which comes before the mapping `FOR UPDATE`, in the patch, wrapper and catch-up functions).
19. **Helper permissions:** service role only.

**Also run:**
- the Phase 2 suite (31) and the Phase 3 suite (8);
- the existing app view-tracker tests (view-count regression);
- the full app suite and typecheck.

The simultaneous-race checks remain unverified, as before.

## Corrections from review (apply before drafting the full package)
1. **Helper execution context (confirmed).** The live `posts_media_mux_before()` is `SECURITY DEFINER` with a fixed `search_path`, so it can call the server-only helper while signed-in users still can't. The suite adds tests for both: a signed-in save works, and a direct helper call by a signed-in user fails with a permission error.
2. **Duplicate detection by actual ID, not group count.** A duplicated ID is allowed only when every item carrying it is unchanged from the saved Post, ignoring order, and it appears no more times than before. Any other repeated ID is refused, even if an unrelated old duplicate disappears in the same save.
3. **UUID comparison is case-insensitive.** IDs are compared in lowercase (or cast to `uuid`) everywhere: ID matching, the reuse check, duplicate detection and the webhook's lookup by `media_id`. New server IDs are lowercase. Historical IDs are never rewritten, so uppercase ones stay byte-identical.
4. **Every legitimate path that creates or reactivates a link supplies `media_id`.**
   - After the migration, Post link creation and reactivation happen only in `sync_mux_post_mappings_core`, which always writes `media_id`. It is called by the save trigger, catch-up and the legacy wrapper.
   - Old links with an empty `media_id` are never touched, and still patch through the slot plus upload-ID rule.
   - The suite asserts that normal create, edit, catch-up and wrapper calls leave no new active link without `media_id`.
5. **Rollout order and mixed versions.**
   - Run the migration first, then deploy both Edge Functions straight away.
   - **Old sync function in that window:** safe, because the wrapper now ignores its slot list.
   - **Old register function in that window:** its direct insert is refused by the new rule. It reports `insert_failed` for that item but still returns success, so the composer carries on. The save itself already created the link with `media_id`, and catch-up patching happens at save time, so publishing is unaffected.
   - The suite simulates both old-function calls and checks the saved link stays intact.
   - **Rollback:** redeploying the old functions remains safe for the same reasons.
6. **No trigger switching on live tables for new fixtures.** Ambiguous-history and duplicate-history cases are tested by calling `post_media_assign_ids()` directly with old and new arrays inside the rolled-back test, not by seeding the `posts` table with triggers off.
   - Known issue in the existing Phase 2 suite: it switches `posts` and `mux_uploads` triggers off inside its rolled-back transaction. That briefly locks those tables for live saves while it runs.
   - Phase 4 doesn't change that suite. I'll propose converting it separately.
7. **Complete executable package.** The migration contains full `CREATE OR REPLACE` definitions of every changed function, with no comment placeholders. It is saved as a review file, alongside the complete test file. Checking function text for lock order is supporting evidence only; true concurrency remains unverified.

**Extra tests added by these corrections:**
- uppercase UUID kept, and matched by the webhook;
- a new duplicate refused even while an unrelated old duplicate disappears;
- a grandfathered duplicate passes untouched;
- old register and old sync calls during the deployment window;
- a signed-in user can save but can't call the helper directly.

## After approval
1. Write the complete migration file (`docs/drafts/post-video-phase-4-migration.sql`), the complete `supabase/tests/post_video_phase4.sql`, and the two Edge Function changes, and show them. Nothing runs or deploys.
2. Only on your go-ahead:
   - run the migration, then deploy the two Edge Functions;
   - run the Phase 4, Phase 2 and Phase 3 suites, the app suite and typecheck;
   - correct the Phase 3 document;
   - report passed, failed and blocked.
3. Stop before Step 3 (composer and viewer). `/create`, historical media and view counts stay unchanged, and Review videos stay OFF.

## App change list for Step 3 (for reference, not built now)
- The lightbox opens and resumes by media ID instead of position (`PostMediaDisplay`, `FeedCollage` `videoResume`, `LightboxPreview` entry and exit handoff).
- When a Post loads, a missing ID stays absent instead of becoming `''` (`hooks/feed/api/utils.ts:41`).
- After saving, the composer adopts server IDs from the readback without resetting local previews.
- Tests: the X button with a same-type neighbour, ID adoption, and the lightbox after a removal.

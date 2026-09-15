DO $$
DECLARE
  v_capture  uuid := '9d2d21bd-bd34-4e97-a78f-6be7685973ab';
  v_kinds    text[] := ARRAY['recommendation','recommendation_comment','recommendation_like',
                             'recommendation_save','legacy_comment_like','legacy_comment_mention',
                             'legacy_notification','review_marker'];
  v_n        bigint;
  v_expected bigint;
  v_deleted  bigint;
  v_kind     text;
BEGIN
  -- 0. the selected capture and its bookkeeping must be complete ------------
  --    (older captures are legitimate and deliberately not inspected)
  IF NOT EXISTS (SELECT 1 FROM audit.phase_4_3_manifest_captures WHERE capture_id = v_capture) THEN
    RAISE EXCEPTION 'Gate 4 abort: capture % not found', v_capture;
  END IF;

  FOREACH v_kind IN ARRAY v_kinds LOOP
    SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest_counts
      WHERE capture_id = v_capture AND kind = v_kind AND row_count IS NOT NULL;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Gate 4 abort: capture % has % usable count rows for kind %', v_capture, v_n, v_kind;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND NOT (kind = ANY (v_kinds));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: capture % has % unexpected count kinds', v_capture, v_n;
  END IF;

  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest
    WHERE capture_id = v_capture AND NOT (kind = ANY (v_kinds));
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: capture % has % manifest rows of unexpected kind', v_capture, v_n;
  END IF;

  -- manifest rows must agree with the recorded counts, kind by kind
  FOREACH v_kind IN ARRAY v_kinds LOOP
    SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
      WHERE capture_id = v_capture AND kind = v_kind;
    SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest
      WHERE capture_id = v_capture AND kind = v_kind;
    IF v_n <> v_expected THEN
      RAISE EXCEPTION 'Gate 4 abort: kind % has % manifest rows but count row says %', v_kind, v_n, v_expected;
    END IF;
    SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest
      WHERE capture_id = v_capture AND kind = v_kind AND record_id IS NULL;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'Gate 4 abort: kind % has % manifest rows without a record id', v_kind, v_n;
    END IF;
  END LOOP;

  -- 1. serialise against concurrent writers ---------------------------------
  LOCK TABLE public.recommendations,
             public.recommendation_comments,
             public.recommendation_likes,
             public.recommendation_saves
    IN ACCESS EXCLUSIVE MODE;

  -- audited review rows are row-locked before validation and clearing
  PERFORM 1 FROM public.reviews r
   WHERE r.id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                  WHERE capture_id = v_capture AND kind = 'review_marker')
   FOR UPDATE;

  -- 2. the manifest must be the COMPLETE cohort at transaction time ---------
  --    every legacy table: count equality AND exact identity membership in
  --    both directions, so a same-count substitution cannot pass.

  -- recommendations
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation';
  SELECT count(*) INTO v_n FROM public.recommendations;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: recommendations live=% manifest=%', v_n, v_expected;
  END IF;
  SELECT count(*) INTO v_n FROM public.recommendations r
    WHERE NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'recommendation' AND m.record_id = r.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % live recommendations are not in the manifest', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest m
    WHERE m.capture_id = v_capture AND m.kind = 'recommendation'
      AND NOT EXISTS (SELECT 1 FROM public.recommendations r WHERE r.id = m.record_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % audited recommendations are missing live', v_n;
  END IF;

  -- comments
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_comment';
  SELECT count(*) INTO v_n FROM public.recommendation_comments;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: recommendation_comments live=% manifest=%', v_n, v_expected;
  END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_comments c
    WHERE NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'recommendation_comment' AND m.record_id = c.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % live legacy comments are not in the manifest', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest m
    WHERE m.capture_id = v_capture AND m.kind = 'recommendation_comment'
      AND NOT EXISTS (SELECT 1 FROM public.recommendation_comments c WHERE c.id = m.record_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % audited legacy comments are missing live', v_n;
  END IF;

  -- likes (exact identity, not count alone)
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_like';
  SELECT count(*) INTO v_n FROM public.recommendation_likes;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: recommendation_likes live=% manifest=%', v_n, v_expected;
  END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_likes l
    WHERE NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'recommendation_like' AND m.record_id = l.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % live legacy likes are not in the manifest', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest m
    WHERE m.capture_id = v_capture AND m.kind = 'recommendation_like'
      AND NOT EXISTS (SELECT 1 FROM public.recommendation_likes l WHERE l.id = m.record_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % audited legacy likes are missing live', v_n;
  END IF;

  -- saves (exact identity, not count alone)
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_save';
  SELECT count(*) INTO v_n FROM public.recommendation_saves;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: recommendation_saves live=% manifest=%', v_n, v_expected;
  END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_saves s
    WHERE NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'recommendation_save' AND m.record_id = s.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % live legacy saves are not in the manifest', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM audit.phase_4_3_legacy_manifest m
    WHERE m.capture_id = v_capture AND m.kind = 'recommendation_save'
      AND NOT EXISTS (SELECT 1 FROM public.recommendation_saves s WHERE s.id = m.record_id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % audited legacy saves are missing live', v_n;
  END IF;

  -- polymorphic children: nothing outside the manifest may reference an audited comment
  SELECT count(*) INTO v_n FROM public.comment_likes cl
    WHERE cl.comment_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                            WHERE capture_id = v_capture AND kind = 'recommendation_comment')
      AND NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'legacy_comment_like' AND m.record_id = cl.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % comment likes on audited comments are not in the manifest', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.comment_mentions cm
    WHERE cm.comment_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                            WHERE capture_id = v_capture AND kind = 'recommendation_comment')
      AND NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'legacy_comment_mention' AND m.record_id = cm.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % comment mentions on audited comments are not in the manifest', v_n;
  END IF;

  -- review markers must still be exactly the audited six
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'review_marker';
  SELECT count(*) INTO v_n FROM public.reviews
    WHERE recommendation_id IS NOT NULL OR is_converted = true;
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: review markers live=% manifest=%', v_n, v_expected;
  END IF;
  SELECT count(*) INTO v_n FROM public.reviews r
    WHERE (r.recommendation_id IS NOT NULL OR r.is_converted = true)
      AND NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'review_marker' AND m.record_id = r.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % marked reviews are not in the manifest', v_n;
  END IF;

  -- notifications pointing at audited destinations must all be audited;
  -- comment destinations are reconstructed exactly from each audited comment's
  -- parent recommendation id and its own id, in both legacy route forms
  SELECT count(*) INTO v_n FROM public.notifications n
    WHERE (
        n.entity_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                        WHERE capture_id = v_capture
                          AND kind IN ('recommendation','recommendation_comment'))
        OR EXISTS (
          SELECT 1 FROM audit.phase_4_3_legacy_manifest m
          WHERE m.capture_id = v_capture AND m.kind = 'recommendation'
            AND n.action_url IN ('/recommendations/' || m.record_id::text,
                                 '/recommendation/'  || m.record_id::text)
        )
        OR EXISTS (
          SELECT 1 FROM audit.phase_4_3_legacy_manifest m
          WHERE m.capture_id = v_capture AND m.kind = 'recommendation_comment'
            AND n.action_url IN (
              '/recommendations/' || m.recommendation_id::text || '?commentId=' || m.record_id::text,
              '/recommendation/'  || m.recommendation_id::text || '?commentId=' || m.record_id::text)
        )
      )
      AND NOT EXISTS (SELECT 1 FROM audit.phase_4_3_legacy_manifest m
                      WHERE m.capture_id = v_capture AND m.kind = 'legacy_notification' AND m.record_id = n.id);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Gate 4 abort: % notifications point at audited legacy destinations but are not in the manifest', v_n;
  END IF;

  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'legacy_notification';
  SELECT count(*) INTO v_n FROM public.notifications n
    WHERE n.id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                   WHERE capture_id = v_capture AND kind = 'legacy_notification');
  IF v_n <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: audited notifications live=% manifest=%', v_n, v_expected;
  END IF;

  -- 3. delete the audited notifications first (trigger-aware) ---------------
  DELETE FROM public.notifications
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'legacy_notification');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % notifications, expected %', v_deleted, v_expected;
  END IF;

  -- 4. clear the restricting review references ------------------------------
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'review_marker';
  UPDATE public.reviews
     SET recommendation_id = NULL,
         is_converted = false
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'review_marker');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: cleared % review markers, expected %', v_deleted, v_expected;
  END IF;

  -- 5. polymorphic children of the audited comments -------------------------
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'legacy_comment_like';
  DELETE FROM public.comment_likes
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'legacy_comment_like');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy comment likes, expected %', v_deleted, v_expected;
  END IF;

  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'legacy_comment_mention';
  DELETE FROM public.comment_mentions
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'legacy_comment_mention');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy comment mentions, expected %', v_deleted, v_expected;
  END IF;

  -- 6. audited comments, likes, saves ---------------------------------------
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_comment';
  DELETE FROM public.recommendation_comments
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'recommendation_comment');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy comments, expected %', v_deleted, v_expected;
  END IF;

  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_like';
  DELETE FROM public.recommendation_likes
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'recommendation_like');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy likes, expected %', v_deleted, v_expected;
  END IF;

  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation_save';
  DELETE FROM public.recommendation_saves
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'recommendation_save');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy saves, expected %', v_deleted, v_expected;
  END IF;

  -- 7. audited parents -------------------------------------------------------
  SELECT row_count INTO v_expected FROM audit.phase_4_3_legacy_manifest_counts
    WHERE capture_id = v_capture AND kind = 'recommendation';
  DELETE FROM public.recommendations
   WHERE id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                WHERE capture_id = v_capture AND kind = 'recommendation');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'Gate 4 abort: deleted % legacy recommendations, expected %', v_deleted, v_expected;
  END IF;

  -- 8. final zero-reference assertions --------------------------------------
  SELECT count(*) INTO v_n FROM public.recommendations;
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % recommendations remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_comments;
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % legacy comments remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_likes;
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % legacy likes remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.recommendation_saves;
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % legacy saves remain', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.reviews
    WHERE recommendation_id IS NOT NULL OR is_converted = true;
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % review markers remain', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.comment_likes cl
    WHERE cl.comment_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                            WHERE capture_id = v_capture AND kind = 'recommendation_comment');
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % comment likes on audited comments remain', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.comment_mentions cm
    WHERE cm.comment_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                            WHERE capture_id = v_capture AND kind = 'recommendation_comment');
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % comment mentions on audited comments remain', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.notifications n
    WHERE n.id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                   WHERE capture_id = v_capture AND kind = 'legacy_notification')
       OR n.entity_id IN (SELECT record_id FROM audit.phase_4_3_legacy_manifest
                          WHERE capture_id = v_capture
                            AND kind IN ('recommendation','recommendation_comment'))
       OR EXISTS (
            SELECT 1 FROM audit.phase_4_3_legacy_manifest m
            WHERE m.capture_id = v_capture AND m.kind = 'recommendation'
              AND n.action_url IN ('/recommendations/' || m.record_id::text,
                                   '/recommendation/'  || m.record_id::text))
       OR EXISTS (
            SELECT 1 FROM audit.phase_4_3_legacy_manifest m
            WHERE m.capture_id = v_capture AND m.kind = 'recommendation_comment'
              AND n.action_url IN (
                '/recommendations/' || m.recommendation_id::text || '?commentId=' || m.record_id::text,
                '/recommendation/'  || m.recommendation_id::text || '?commentId=' || m.record_id::text));
  IF v_n <> 0 THEN RAISE EXCEPTION 'Gate 4 abort: % notifications still point at audited legacy destinations', v_n; END IF;

  UPDATE audit.phase_4_3_manifest_captures
     SET note = coalesce(note || ' | ', '') || 'Gate 4 cleanup executed ' || now()::text
   WHERE capture_id = v_capture;

  RAISE NOTICE 'Gate 4 cleanup complete for capture %', v_capture;
END $$;
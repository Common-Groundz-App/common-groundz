BEGIN;
LOCK TABLE public.review_likes IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.review_likes l JOIN public.reviews r ON r.id=l.review_id
 WHERE (l.id,l.review_id,l.user_id) IN (
 ('96e9f774-9eb9-457b-8f56-17cc9490f504'::uuid,'d788a78d-cd1f-4ab5-880f-ad3cb2c46d62'::uuid,'abfcbf43-b985-40dc-933c-201e5448b794'::uuid),
 ('1a14635a-95c4-4d24-8037-4d13853e1008'::uuid,'af1cd578-e75e-449e-a9af-50c242fd52ef'::uuid,'abfcbf43-b985-40dc-933c-201e5448b794'::uuid),
 ('f36fb145-ecdb-4516-9695-a9a719c0848a'::uuid,'e1f992e0-78dc-427c-acf1-797605b8ad72'::uuid,'c8508bd3-35a9-4cce-a7c8-0b5fc2bca965'::uuid))
 AND l.user_id=r.user_id;
 IF n<>3 THEN RAISE EXCEPTION 'Dummy self-vote cohort changed; aborting cleanup'; END IF;
END $$;
DELETE FROM public.review_likes WHERE id IN ('96e9f774-9eb9-457b-8f56-17cc9490f504','1a14635a-95c4-4d24-8037-4d13853e1008','f36fb145-ecdb-4516-9695-a9a719c0848a');
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='review_likes' LOOP
 EXECUTE format('DROP POLICY %I ON public.review_likes',p.policyname);
 END LOOP;
END $$;
REVOKE ALL ON public.review_likes FROM PUBLIC,anon,authenticated;
-- Remove any column-level privileges too: table revokes do not revoke these.
REVOKE SELECT(id,review_id,user_id,created_at), INSERT(id,review_id,user_id,created_at), UPDATE(id,review_id,user_id,created_at), REFERENCES(id,review_id,user_id,created_at) ON public.review_likes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.review_likes TO authenticated;
GRANT ALL ON public.review_likes TO service_role;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_likes_own_eligible_read ON public.review_likes FOR SELECT TO authenticated USING (
 user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id=review_id AND r.visibility='public' AND r.status='published' AND r.user_id<>auth.uid())
);
CREATE OR REPLACE FUNCTION public.toggle_review_like(p_review_id uuid,p_user_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_review public.reviews%ROWTYPE; v_removed integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Not authorized to vote for another user' USING ERRCODE='42501'; END IF;
 -- Parent lock serializes toggles and holds eligibility stable against visibility/deletion changes.
 SELECT * INTO v_review FROM public.reviews WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND OR v_review.visibility<>'public' OR v_review.status<>'published' THEN RAISE EXCEPTION 'Review is not eligible for Helpful' USING ERRCODE='42501'; END IF;
 IF v_review.user_id=v_uid THEN RAISE EXCEPTION 'Authors cannot vote on their own reviews' USING ERRCODE='42501'; END IF;
 DELETE FROM public.review_likes WHERE review_id=p_review_id AND user_id=v_uid;
 GET DIAGNOSTICS v_removed=ROW_COUNT;
 IF v_removed>0 THEN RETURN false; END IF;
 INSERT INTO public.review_likes(review_id,user_id) VALUES(p_review_id,v_uid);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.get_review_likes_batch(p_review_ids uuid[])
RETURNS TABLE(review_id uuid,like_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.review_id,count(*)::bigint FROM public.review_likes l JOIN public.reviews r ON r.id=l.review_id
 WHERE l.review_id=ANY(p_review_ids) AND r.visibility='public' AND r.status='published' AND l.user_id<>r.user_id GROUP BY l.review_id;
$$;
CREATE OR REPLACE FUNCTION public.get_user_review_likes(p_review_ids uuid[],p_user_id uuid DEFAULT NULL)
RETURNS TABLE(review_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Not authorized to inspect another user votes' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT l.review_id FROM public.review_likes l JOIN public.reviews r ON r.id=l.review_id
 WHERE l.user_id=v_uid AND l.review_id=ANY(p_review_ids) AND r.visibility='public' AND r.status='published' AND l.user_id<>r.user_id;
END $$;
ALTER FUNCTION public.toggle_review_like(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.get_review_likes_batch(uuid[]) OWNER TO postgres;
ALTER FUNCTION public.get_user_review_likes(uuid[],uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.toggle_review_like(uuid,uuid),public.get_user_review_likes(uuid[],uuid),public.get_review_likes_batch(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.toggle_review_like(uuid,uuid),public.get_user_review_likes(uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_likes_batch(uuid[]) TO anon,authenticated;
-- Preserve explicit backend access; session identity checks still apply to voting/viewer RPCs.
GRANT EXECUTE ON FUNCTION public.toggle_review_like(uuid,uuid),public.get_user_review_likes(uuid[],uuid),public.get_review_likes_batch(uuid[]) TO service_role;
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname IN ('toggle_review_like','get_user_review_likes','get_review_likes_batch');
 IF n<>3 THEN RAISE EXCEPTION 'Unexpected Helpful RPC overload: audit required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.review_likes'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (review_id, user_id)') THEN RAISE EXCEPTION 'Helpful uniqueness missing'; END IF;
END $$;
COMMIT;
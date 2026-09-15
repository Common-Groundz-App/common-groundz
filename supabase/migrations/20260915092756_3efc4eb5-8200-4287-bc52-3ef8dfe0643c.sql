SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

CREATE SCHEMA IF NOT EXISTS audit;
ALTER SCHEMA audit OWNER TO postgres;

CREATE TABLE IF NOT EXISTS audit.phase_4_3_manifest_captures (
  capture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  note text
);
ALTER TABLE audit.phase_4_3_manifest_captures OWNER TO postgres;

CREATE TABLE IF NOT EXISTS audit.phase_4_3_legacy_manifest (
  id bigserial PRIMARY KEY,
  capture_id uuid NOT NULL REFERENCES audit.phase_4_3_manifest_captures(capture_id),
  kind text NOT NULL,
  record_id uuid NOT NULL,
  recommendation_id uuid,
  parent_id uuid,
  user_id uuid,
  entity_id uuid,
  created_at timestamptz,
  details jsonb,
  UNIQUE (capture_id, kind, record_id)
);
ALTER TABLE audit.phase_4_3_legacy_manifest OWNER TO postgres;

CREATE TABLE IF NOT EXISTS audit.phase_4_3_legacy_manifest_counts (
  capture_id uuid NOT NULL REFERENCES audit.phase_4_3_manifest_captures(capture_id),
  kind text NOT NULL,
  row_count bigint NOT NULL,
  PRIMARY KEY (capture_id, kind)
);
ALTER TABLE audit.phase_4_3_legacy_manifest_counts OWNER TO postgres;

-- Access model (Option A): administrative/owner context only. No app role, including
-- service_role and dashboard_user (both confirmed to exist live), may reach this
-- user-linked manifest. Gate 4 executes in this same administrative context.
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
REVOKE ALL ON SCHEMA audit FROM anon, authenticated, service_role, authenticator, dashboard_user;
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM anon, authenticated, service_role, authenticator, dashboard_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA audit FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA audit FROM anon, authenticated, service_role, authenticator, dashboard_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Extra protection for the four legacy cohort tables (isolation already guarantees
-- one snapshot; these locks additionally prevent concurrent cohort mutation).
LOCK TABLE public.recommendations, public.recommendation_comments,
           public.recommendation_likes, public.recommendation_saves IN SHARE MODE;

-- Whole capture is ONE statement: capture id, every manifest row and the per-kind counts
-- all observe a single snapshot, and the counts can never attach to another capture.
WITH cap AS (
  INSERT INTO audit.phase_4_3_manifest_captures (note)
  VALUES ('Phase 4.3 Gate 3 legacy recommendation cleanup manifest')
  RETURNING capture_id
),
legacy_routes AS (
  SELECT '/recommendations/' || r.id::text AS url FROM public.recommendations r
  UNION ALL
  SELECT '/recommendation/' || r.id::text FROM public.recommendations r
  UNION ALL
  SELECT '/recommendations/' || r.id::text || '?commentId=' || c.id::text
  FROM public.recommendation_comments c
  JOIN public.recommendations r ON r.id = c.recommendation_id
  UNION ALL
  SELECT '/recommendation/' || r.id::text || '?commentId=' || c.id::text
  FROM public.recommendation_comments c
  JOIN public.recommendations r ON r.id = c.recommendation_id
),
rows_to_capture AS (
  SELECT 'recommendation'::text AS kind, r.id AS record_id, r.id AS recommendation_id,
         NULL::uuid AS parent_id, r.user_id, r.entity_id, r.created_at,
         jsonb_build_object('title', r.title, 'image_url', r.image_url, 'updated_at', r.updated_at) AS details
  FROM public.recommendations r
  UNION ALL
  SELECT 'recommendation_comment', c.id, c.recommendation_id, c.parent_id, c.user_id, NULL::uuid, c.created_at,
         jsonb_build_object('is_deleted', to_jsonb(c) -> 'is_deleted')
  FROM public.recommendation_comments c
  UNION ALL
  SELECT 'recommendation_like', l.id, l.recommendation_id, NULL::uuid, l.user_id, NULL::uuid, l.created_at, NULL::jsonb
  FROM public.recommendation_likes l
  UNION ALL
  SELECT 'recommendation_save', s.id, s.recommendation_id, NULL::uuid, s.user_id, NULL::uuid, s.created_at, NULL::jsonb
  FROM public.recommendation_saves s
  UNION ALL
  SELECT 'legacy_comment_like', cl.id, NULL::uuid, NULL::uuid, cl.user_id, NULL::uuid, cl.created_at,
         jsonb_build_object('comment_id', cl.comment_id, 'comment_type', cl.comment_type)
  FROM public.comment_likes cl
  WHERE cl.comment_id IN (SELECT id FROM public.recommendation_comments)
  UNION ALL
  SELECT 'legacy_comment_mention', cm.id, NULL::uuid, NULL::uuid, cm.mentioner_user_id, NULL::uuid, cm.created_at,
         jsonb_build_object('comment_id', cm.comment_id, 'comment_type', cm.comment_type,
                            'mentioned_user_id', cm.mentioned_user_id)
  FROM public.comment_mentions cm
  WHERE cm.comment_id IN (SELECT id FROM public.recommendation_comments)
  UNION ALL
  SELECT 'legacy_notification', n.id, NULL::uuid, NULL::uuid, n.user_id, n.entity_id, n.created_at,
         jsonb_build_object('type', n.type, 'entity_type', n.entity_type, 'action_url', n.action_url)
  FROM public.notifications n
  WHERE n.entity_id IN (SELECT id FROM public.recommendations)
     OR n.entity_id IN (SELECT id FROM public.recommendation_comments)
     OR n.action_url IN (SELECT url FROM legacy_routes)
  UNION ALL
  SELECT 'review_marker', rv.id, rv.recommendation_id, NULL::uuid, rv.user_id, rv.entity_id, rv.created_at,
         jsonb_build_object('is_converted', rv.is_converted)
  FROM public.reviews rv
  WHERE rv.recommendation_id IS NOT NULL OR rv.is_converted IS TRUE
),
inserted AS (
  INSERT INTO audit.phase_4_3_legacy_manifest
    (capture_id, kind, record_id, recommendation_id, parent_id, user_id, entity_id, created_at, details)
  SELECT c.capture_id, x.kind, x.record_id, x.recommendation_id, x.parent_id,
         x.user_id, x.entity_id, x.created_at, x.details
  FROM cap c CROSS JOIN rows_to_capture x
  RETURNING kind
)
INSERT INTO audit.phase_4_3_legacy_manifest_counts (capture_id, kind, row_count)
SELECT c.capture_id, k.kind, (SELECT count(*) FROM inserted i WHERE i.kind = k.kind)
FROM cap c
CROSS JOIN (VALUES ('recommendation'), ('recommendation_comment'), ('recommendation_like'),
                   ('recommendation_save'), ('legacy_comment_like'), ('legacy_comment_mention'),
                   ('legacy_notification'), ('review_marker')) AS k(kind);
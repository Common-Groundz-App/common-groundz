
-- ============================================================
-- Security Fix: Function Search Paths + RLS Hardening
-- ============================================================

-- 1. Fix search_path on 7 functions (preserving all attributes)

-- 1a. queue_entity_enrichment (SECURITY DEFINER, VOLATILE, trigger)
CREATE OR REPLACE FUNCTION public.queue_entity_enrichment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.last_enriched_at IS NULL OR NEW.last_enriched_at < (now() - interval '7 days') THEN
    INSERT INTO public.entity_enrichment_queue (entity_id, priority, requested_by)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.api_source IS NOT NULL THEN 3
        ELSE 5 
      END,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    )
    ON CONFLICT (entity_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 1b. cleanup_spaced_hashtags (INVOKER, VOLATILE)
CREATE OR REPLACE FUNCTION public.cleanup_spaced_hashtags()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
    result jsonb := '{}';
    spaced_hashtag_count int := 0;
    fixed_posts_count int := 0;
    created_hashtags_count int := 0;
    hashtag_rec RECORD;
    post_rec RECORD;
    first_word text;
    normalized_first_word text;
    new_hashtag_id uuid;
BEGIN
    SELECT COUNT(*) INTO spaced_hashtag_count 
    FROM hashtags 
    WHERE name_original LIKE '% %';
    
    FOR hashtag_rec IN 
        SELECT id, name_original, name_norm 
        FROM hashtags 
        WHERE name_original LIKE '% %'
    LOOP
        first_word := split_part(hashtag_rec.name_original, ' ', 1);
        normalized_first_word := lower(regexp_replace(first_word, '[^a-z0-9\-_]', '', 'g'));
        
        IF length(normalized_first_word) = 0 THEN
            CONTINUE;
        END IF;
        
        SELECT id INTO new_hashtag_id 
        FROM hashtags 
        WHERE name_norm = normalized_first_word 
        LIMIT 1;
        
        IF new_hashtag_id IS NULL THEN
            INSERT INTO hashtags (name_original, name_norm)
            VALUES (first_word, normalized_first_word)
            RETURNING id INTO new_hashtag_id;
            created_hashtags_count := created_hashtags_count + 1;
        END IF;
        
        FOR post_rec IN 
            SELECT DISTINCT post_id 
            FROM post_hashtags 
            WHERE hashtag_id = hashtag_rec.id
        LOOP
            INSERT INTO post_hashtags (post_id, hashtag_id)
            VALUES (post_rec.post_id, new_hashtag_id)
            ON CONFLICT (post_id, hashtag_id) DO NOTHING;
            
            fixed_posts_count := fixed_posts_count + 1;
        END LOOP;
        
        DELETE FROM post_hashtags WHERE hashtag_id = hashtag_rec.id;
        DELETE FROM hashtags WHERE id = hashtag_rec.id;
    END LOOP;
    
    result := jsonb_build_object(
        'spaced_hashtags_removed', spaced_hashtag_count,
        'posts_fixed', fixed_posts_count,
        'new_hashtags_created', created_hashtags_count
    );
    
    RETURN result;
END;
$function$;

-- 1c. get_who_to_follow (INVOKER, VOLATILE, SQL language)
CREATE OR REPLACE FUNCTION public.get_who_to_follow(p_user_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(user_id uuid, username text, avatar_url text, reason text, source text, score double precision, mutuals integer, activity_count integer, profile_quality double precision)
 LANGUAGE sql
 SET search_path = public, pg_temp
AS $function$
  WITH user_follows AS (
    SELECT f.following_id 
    FROM follows f 
    WHERE f.follower_id = p_user_id
  ),
  
  friends_of_friends AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      COUNT(f1.follower_id)::integer as mutual_count,
      0 as activity_7d,
      'fof' as source_type
    FROM profiles p
    JOIN follows f2 ON f2.following_id = p.id
    JOIN follows f1 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = p_user_id
      AND p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.username IS NOT NULL
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '24 hours'
      )
    GROUP BY p.id, p.username, p.avatar_url
  ),
  
  active_creators AS (
    SELECT DISTINCT
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      COUNT(activity.user_id)::integer as activity_7d,
      'active' as source_type
    FROM profiles p
    JOIN (
      SELECT user_id, created_at FROM posts WHERE created_at >= now() - interval '7 days'
      UNION ALL
      SELECT user_id, created_at FROM recommendations WHERE created_at >= now() - interval '7 days'
    ) activity ON activity.user_id = p.id
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.id NOT IN (SELECT fof.id FROM friends_of_friends fof)
      AND p.username IS NOT NULL
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '24 hours'
      )
    GROUP BY p.id, p.username, p.avatar_url
    HAVING COUNT(activity.user_id) > 0
  ),
  
  fresh_creators AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      0 as activity_7d,
      'fresh' as source_type
    FROM profiles p
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.id NOT IN (SELECT fof.id FROM friends_of_friends fof)
      AND p.id NOT IN (SELECT ac.id FROM active_creators ac)
      AND p.username IS NOT NULL
      AND p.deleted_at IS NULL
      AND p.created_at >= now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM suggestion_impressions si
        WHERE si.viewer_id = p_user_id
          AND si.suggested_id = p.id
          AND si.seen_at >= now() - interval '24 hours'
      )
  ),
  
  emergency_fallback AS (
    SELECT 
      p.id,
      p.username,
      p.avatar_url,
      0 as mutual_count,
      0 as activity_7d,
      'fallback' as source_type
    FROM profiles p
    WHERE p.id != p_user_id
      AND p.id NOT IN (SELECT following_id FROM user_follows)
      AND p.username IS NOT NULL
      AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT p_limit * 2
  ),
  
  all_candidates AS (
    SELECT * FROM friends_of_friends
    UNION ALL
    SELECT * FROM active_creators
    UNION ALL
    SELECT * FROM fresh_creators
  ),
  
  final_candidates AS (
    SELECT DISTINCT ON (combined.id) combined.*
    FROM (
      SELECT * FROM all_candidates
      UNION ALL
      SELECT * FROM emergency_fallback 
      WHERE (SELECT COUNT(*) FROM all_candidates) < p_limit
    ) combined
    ORDER BY combined.id,
      CASE combined.source_type
        WHEN 'fof' THEN 1
        WHEN 'active' THEN 2
        WHEN 'fresh' THEN 3
        WHEN 'fallback' THEN 4
      END,
      COALESCE(combined.mutual_count, 0) DESC,
      COALESCE(combined.activity_7d, 0) DESC
  ),
  
  scored_candidates AS (
    SELECT 
      c.id,
      c.username,
      c.avatar_url,
      c.source_type,
      c.mutual_count,
      c.activity_7d,
      (CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END)::DOUBLE PRECISION / 2.0 as quality_score,
      (0.6 * CASE WHEN c.mutual_count > 0 THEN LEAST(c.mutual_count::DOUBLE PRECISION / 5.0, 1.0) ELSE 0 END +
       0.3 * CASE WHEN c.activity_7d > 0 THEN LEAST(c.activity_7d::DOUBLE PRECISION / 10.0, 1.0) ELSE 0 END +
       0.1 * (CASE WHEN c.username IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN c.avatar_url IS NOT NULL THEN 1 ELSE 0 END)::DOUBLE PRECISION / 2.0) as calculated_score,
      CASE 
        WHEN c.source_type = 'fof' AND c.mutual_count > 1 THEN 
          'Followed by ' || c.mutual_count || ' people you follow'
        WHEN c.source_type = 'fof' AND c.mutual_count = 1 THEN 
          'Followed by someone you follow'
        WHEN c.source_type = 'active' THEN 
          'Popular this week'
        WHEN c.source_type = 'fresh' THEN 
          'New on Common Groundz'
        WHEN c.source_type = 'fallback' THEN
          'Suggested for you'
        ELSE 'Suggested for you'
      END as reason_text
    FROM final_candidates c
  )
  
  SELECT 
    sc.id as user_id,
    sc.username,
    sc.avatar_url,
    sc.reason_text as reason,
    sc.source_type as source,
    sc.calculated_score as score,
    sc.mutual_count as mutuals,
    sc.activity_7d as activity_count,
    sc.quality_score as profile_quality
  FROM scored_candidates sc
  ORDER BY 
    sc.calculated_score DESC,
    sc.id
  LIMIT p_limit;
$function$;

-- 1d. notify_entity_update (INVOKER, VOLATILE, trigger)
CREATE OR REPLACE FUNCTION public.notify_entity_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

-- 1e. prevent_parent_entity_deletion (INVOKER, VOLATILE, trigger)
CREATE OR REPLACE FUNCTION public.prevent_parent_entity_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.entities WHERE parent_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete entity that has child entities. Please remove children first.';
  END IF;
  RETURN OLD;
END;
$function$;

-- 1f. update_cached_photos_updated_at (INVOKER, VOLATILE, trigger)
CREATE OR REPLACE FUNCTION public.update_cached_photos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 1g. update_conversation_updated_at (INVOKER, VOLATILE, trigger)
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Make update_entity_slug() SECURITY DEFINER + REVOKE
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_entity_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (OLD.name IS DISTINCT FROM NEW.name) OR 
     (OLD.parent_id IS DISTINCT FROM NEW.parent_id) OR 
     (NEW.slug IS NULL OR NEW.slug = '') THEN
    
    IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
      VALUES (OLD.id, OLD.slug)
      ON CONFLICT DO NOTHING;
    END IF;

    NEW.slug := public.generate_entity_slug(NEW.name, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Revoke direct invocation from users
REVOKE EXECUTE ON FUNCTION public.update_entity_slug() FROM anon, authenticated;

-- ============================================================
-- 3. Fix entity_slug_history RLS policies
-- ============================================================

-- Drop the overly permissive FOR ALL policy
DROP POLICY IF EXISTS "System can manage slug history" ON public.entity_slug_history;

-- Keep: "Anyone can view slug history" SELECT policy (already exists)

-- ============================================================
-- 4. Fix entity_enrichment_queue RLS policies
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow insert enrichment jobs" ON public.entity_enrichment_queue;
DROP POLICY IF EXISTS "Allow system delete" ON public.entity_enrichment_queue;
DROP POLICY IF EXISTS "Allow system updates" ON public.entity_enrichment_queue;

-- Keep: "Allow system select" (public SELECT)
-- Keep: "Authenticated users can insert enrichment requests" (already scoped to requested_by = auth.uid())

-- Revoke write access from anon
REVOKE INSERT, UPDATE, DELETE ON public.entity_enrichment_queue FROM anon;

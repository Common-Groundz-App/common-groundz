
CREATE OR REPLACE FUNCTION public.upsert_user_interest(
  p_user_id UUID,
  p_category TEXT,
  p_entity_type TEXT,
  p_interaction_strength FLOAT DEFAULT 1.0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_interests (
    user_id,
    category,
    entity_type,
    interest_score,
    last_interaction,
    interaction_count
  )
  VALUES (
    p_user_id,
    p_category,
    p_entity_type,
    p_interaction_strength,
    now(),
    1
  )
  ON CONFLICT (user_id, category, entity_type)
  DO UPDATE SET
    interest_score = user_interests.interest_score + (p_interaction_strength * 0.1),
    last_interaction = now(),
    interaction_count = user_interests.interaction_count + 1,
    updated_at = now();
END;
$$;

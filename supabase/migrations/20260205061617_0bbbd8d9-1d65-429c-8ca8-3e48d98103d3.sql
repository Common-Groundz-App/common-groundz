-- Migration 3: Update handle_new_user trigger for OAuth support
-- Maps Google OAuth metadata fields to profile columns

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    first_name, 
    last_name, 
    avatar_url
  )
  VALUES (
    new.id,
    -- Only set username if explicitly provided (email signup)
    -- OAuth users get NULL -> triggers profile completion flow
    new.raw_user_meta_data->>'username',
    COALESCE(
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'given_name'  -- Google OAuth field
    ),
    COALESCE(
      new.raw_user_meta_data->>'last_name',
      new.raw_user_meta_data->>'family_name'  -- Google OAuth field
    ),
    COALESCE(
      new.raw_user_meta_data->>'picture',     -- Google OAuth field
      new.raw_user_meta_data->>'avatar_url'
    )
  );
  RETURN new;
END;
$$;
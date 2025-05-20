
-- Function to help create storage policies from edge functions
CREATE OR REPLACE FUNCTION storage.create_storage_helper_functions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage
AS $$
BEGIN
  -- Function already exists, do nothing
END;
$$;

-- Function to create an open policy for a storage bucket
CREATE OR REPLACE FUNCTION storage.create_storage_open_policy(bucket_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage
AS $$
DECLARE
  select_policy_name text := bucket_id || '_open_select';
  insert_policy_name text := bucket_id || '_open_insert';
  update_policy_name text := bucket_id || '_open_update';
  delete_policy_name text := bucket_id || '_open_delete';
BEGIN
  -- Create SELECT policy
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id, action)
    VALUES (
      select_policy_name,
      'TRUE',
      bucket_id,
      'SELECT'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Policy already exists, update it
    UPDATE storage.policies
    SET definition = 'TRUE'
    WHERE name = select_policy_name AND bucket_id = bucket_id;
  END;

  -- Create INSERT policy
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id, action)
    VALUES (
      insert_policy_name,
      'TRUE',
      bucket_id,
      'INSERT'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Policy already exists, update it
    UPDATE storage.policies
    SET definition = 'TRUE'
    WHERE name = insert_policy_name AND bucket_id = bucket_id;
  END;

  -- Create UPDATE policy
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id, action)
    VALUES (
      update_policy_name,
      'TRUE',
      bucket_id,
      'UPDATE'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Policy already exists, update it
    UPDATE storage.policies
    SET definition = 'TRUE'
    WHERE name = update_policy_name AND bucket_id = bucket_id;
  END;

  -- Create DELETE policy
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id, action)
    VALUES (
      delete_policy_name,
      'TRUE',
      bucket_id,
      'DELETE'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Policy already exists, update it
    UPDATE storage.policies
    SET definition = 'TRUE'
    WHERE name = delete_policy_name AND bucket_id = bucket_id;
  END;

  RETURN TRUE;
END;
$$;

-- Function to create a custom storage policy
CREATE OR REPLACE FUNCTION storage.create_storage_policy(
  bucket_name text,
  policy_name text,
  definition text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage
AS $$
BEGIN
  -- Try to create the policy, handle if it already exists
  BEGIN
    INSERT INTO storage.policies (name, definition, bucket_id, action)
    VALUES (
      policy_name,
      definition,
      bucket_name,
      'SELECT'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Policy already exists, update it
    UPDATE storage.policies
    SET definition = definition
    WHERE name = policy_name AND bucket_id = bucket_name;
  END;

  RETURN TRUE;
END;
$$;

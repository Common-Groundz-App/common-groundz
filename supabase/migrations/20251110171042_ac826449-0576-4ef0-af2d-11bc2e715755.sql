-- Step 1: Drop old broken storage helper functions that reference storage.policies
DROP FUNCTION IF EXISTS public.create_storage_helper_functions() CASCADE;
DROP FUNCTION IF EXISTS public.create_storage_policy(text, text, text) CASCADE;

-- Step 2: Replace create_storage_open_policy with modern RLS-based version
DROP FUNCTION IF EXISTS public.create_storage_open_policy(text) CASCADE;

CREATE OR REPLACE FUNCTION public.create_storage_open_policy(bucket_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'storage'
AS $$
BEGIN
  -- Create SELECT policy for public access
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON storage.objects',
    bucket_id || '_public_select'
  );
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects 
     FOR SELECT TO public 
     USING (bucket_id = %L)',
    bucket_id || '_public_select',
    bucket_id
  );
  
  -- Create INSERT policy for authenticated users
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON storage.objects',
    bucket_id || '_authenticated_insert'
  );
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects 
     FOR INSERT TO authenticated 
     WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
    bucket_id || '_authenticated_insert',
    bucket_id
  );
  
  -- Create UPDATE policy for authenticated users (own files only)
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON storage.objects',
    bucket_id || '_authenticated_update'
  );
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects 
     FOR UPDATE TO authenticated 
     USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
    bucket_id || '_authenticated_update',
    bucket_id
  );
  
  -- Create DELETE policy for authenticated users (own files only)
  EXECUTE format(
    'DROP POLICY IF EXISTS %I ON storage.objects',
    bucket_id || '_authenticated_delete'
  );
  EXECUTE format(
    'CREATE POLICY %I ON storage.objects 
     FOR DELETE TO authenticated 
     USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)',
    bucket_id || '_authenticated_delete',
    bucket_id
  );
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating policies for bucket %: %', bucket_id, SQLERRM;
  RETURN FALSE;
END;
$$;

-- Step 3: Drop and recreate secure RLS policies for enhanced-entity-data bucket
DROP POLICY IF EXISTS "Public can view enhanced entity data" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload enhanced entity data" ON storage.objects;
DROP POLICY IF EXISTS "Users can update enhanced entity data" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete enhanced entity data" ON storage.objects;

-- Public can view enhanced entity data
CREATE POLICY "Public can view enhanced entity data"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'enhanced-entity-data');

-- Authenticated users can upload their own enhanced entity data
CREATE POLICY "Authenticated can upload enhanced entity data"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'enhanced-entity-data'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update THEIR OWN enhanced entity data
CREATE POLICY "Users can update enhanced entity data"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'enhanced-entity-data'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete THEIR OWN enhanced entity data
CREATE POLICY "Users can delete enhanced entity data"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'enhanced-entity-data'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 4: Drop and recreate secure RLS policies for entity-images bucket
DROP POLICY IF EXISTS "Public can view entity images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload entity images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update entity images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete entity images" ON storage.objects;

-- Public can view entity images
CREATE POLICY "Public can view entity images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'entity-images');

-- Authenticated users can upload their own entity images
CREATE POLICY "Authenticated can upload entity images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'entity-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own entity images
CREATE POLICY "Users can update entity images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'entity-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own entity images
CREATE POLICY "Users can delete entity images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'entity-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
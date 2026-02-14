
-- Migration 8: Scope Cached Tables to Authenticated

-- Drop public access policies on cached_queries
DROP POLICY IF EXISTS "Allow anyone to read cached queries" ON public.cached_queries;
DROP POLICY IF EXISTS "Allow public access to cached_queries" ON public.cached_queries;

-- Drop public access policies on cached_products
DROP POLICY IF EXISTS "Allow anyone to read cached products" ON public.cached_products;
DROP POLICY IF EXISTS "Allow public access to cached_products" ON public.cached_products;

-- Create authenticated-only SELECT policies
CREATE POLICY "Authenticated users can read cached queries"
  ON public.cached_queries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read cached products"
  ON public.cached_products FOR SELECT TO authenticated USING (true);

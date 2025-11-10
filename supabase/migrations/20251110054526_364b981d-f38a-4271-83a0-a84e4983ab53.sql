-- Enable pg_vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to reviews table
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp with time zone;

-- Add embedding columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp with time zone;

-- Create IVFFlat index on reviews for fast similarity search
-- Using cosine distance operator for semantic similarity
CREATE INDEX IF NOT EXISTS reviews_embedding_idx ON public.reviews 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create IVFFlat index on profiles for fast similarity search
CREATE INDEX IF NOT EXISTS profiles_embedding_idx ON public.profiles 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Add comments for documentation
COMMENT ON COLUMN public.reviews.embedding IS 'Vector embedding (1536 dimensions) for semantic search using OpenAI text-embedding-3-small model';
COMMENT ON COLUMN public.reviews.embedding_updated_at IS 'Timestamp when the embedding was last generated or updated';
COMMENT ON COLUMN public.profiles.embedding IS 'Vector embedding (1536 dimensions) representing user profile semantic content';
COMMENT ON COLUMN public.profiles.embedding_updated_at IS 'Timestamp when the profile embedding was last generated or updated';
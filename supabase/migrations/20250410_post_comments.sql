
-- Create post comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);

-- Add RLS policies
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can view comments
CREATE POLICY "Anyone can view post comments" 
ON public.post_comments FOR SELECT USING (true);

-- Only authenticated users can insert comments
CREATE POLICY "Authenticated users can add post comments" 
ON public.post_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own comments
CREATE POLICY "Users can update their own post comments" 
ON public.post_comments FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only delete their own comments
CREATE POLICY "Users can delete their own post comments" 
ON public.post_comments FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger to update updated_at column
CREATE TRIGGER post_comments_updated_at
BEFORE UPDATE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

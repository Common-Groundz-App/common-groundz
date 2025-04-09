
-- Create recommendation comments table
CREATE TABLE IF NOT EXISTS public.recommendation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommendation_comments_rec_id ON public.recommendation_comments(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_comments_user_id ON public.recommendation_comments(user_id);

-- Add RLS policies
ALTER TABLE public.recommendation_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can view comments
CREATE POLICY "Anyone can view recommendation comments" 
ON public.recommendation_comments FOR SELECT USING (true);

-- Only authenticated users can insert comments
CREATE POLICY "Authenticated users can add comments" 
ON public.recommendation_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own comments
CREATE POLICY "Users can update their own comments" 
ON public.recommendation_comments FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.recommendation_comments FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger to update updated_at column
CREATE TRIGGER recommendation_comments_updated_at
BEFORE UPDATE ON public.recommendation_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

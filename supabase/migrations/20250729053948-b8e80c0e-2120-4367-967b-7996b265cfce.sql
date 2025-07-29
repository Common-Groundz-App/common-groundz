-- Create entity_photos table for direct photo uploads to entities
CREATE TABLE public.entity_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  content_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_entity_photos_entity_id ON public.entity_photos(entity_id);
CREATE INDEX idx_entity_photos_user_id ON public.entity_photos(user_id);
CREATE INDEX idx_entity_photos_category ON public.entity_photos(category);
CREATE INDEX idx_entity_photos_status ON public.entity_photos(status);
CREATE INDEX idx_entity_photos_created_at ON public.entity_photos(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.entity_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view approved entity photos
CREATE POLICY "Anyone can view approved entity photos" 
ON public.entity_photos 
FOR SELECT 
USING (status = 'approved');

-- Users can create their own entity photos
CREATE POLICY "Users can create their own entity photos" 
ON public.entity_photos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own entity photos
CREATE POLICY "Users can update their own entity photos" 
ON public.entity_photos 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own entity photos
CREATE POLICY "Users can delete their own entity photos" 
ON public.entity_photos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can manage all entity photos
CREATE POLICY "Admins can manage all entity photos" 
ON public.entity_photos 
FOR ALL 
USING (public.is_current_user_admin());

-- Create updated_at trigger
CREATE TRIGGER update_entity_photos_updated_at
BEFORE UPDATE ON public.entity_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
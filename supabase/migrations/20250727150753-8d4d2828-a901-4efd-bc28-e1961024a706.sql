-- Create photo_reports table for photo reporting functionality
CREATE TABLE IF NOT EXISTS public.photo_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  photo_source text NOT NULL, -- 'google_places', 'user_review', 'user_upload'
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.photo_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own photo reports" 
ON public.photo_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own photo reports" 
ON public.photo_reports 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admin policy for managing reports
CREATE POLICY "Admins can view all photo reports" 
ON public.photo_reports 
FOR ALL 
USING (public.is_current_user_admin());

-- Create index for performance
CREATE INDEX idx_photo_reports_entity_id ON public.photo_reports(entity_id);
CREATE INDEX idx_photo_reports_status ON public.photo_reports(status);
CREATE INDEX idx_photo_reports_user_id ON public.photo_reports(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_photo_reports_updated_at
BEFORE UPDATE ON public.photo_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
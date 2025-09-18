-- Enable RLS on the entity_slug_history table
ALTER TABLE public.entity_slug_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for entity_slug_history table
CREATE POLICY "Anyone can view slug history"
ON public.entity_slug_history
FOR SELECT
USING (true);

CREATE POLICY "System can manage slug history"
ON public.entity_slug_history
FOR ALL
USING (true)
WITH CHECK (true);
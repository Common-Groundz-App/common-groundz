-- Add foreign key constraints for entity_suggestions table

-- Add foreign key constraint for user_id referencing profiles table
ALTER TABLE public.entity_suggestions 
ADD CONSTRAINT entity_suggestions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key constraint for reviewed_by referencing profiles table  
ALTER TABLE public.entity_suggestions 
ADD CONSTRAINT entity_suggestions_reviewed_by_fkey 
FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
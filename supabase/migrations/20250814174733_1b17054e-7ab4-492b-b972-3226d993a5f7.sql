-- Add foreign key constraint from posts.user_id to profiles.id
-- This enables PostgREST to automatically resolve the relationship using profiles!user_id syntax

ALTER TABLE public.posts 
ADD CONSTRAINT posts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id);
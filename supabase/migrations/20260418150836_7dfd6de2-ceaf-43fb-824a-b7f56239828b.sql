ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.posts.last_edited_at IS 'Set only when a user edits the post via the composer. Used to show "edited" indicator. Null = never edited.';
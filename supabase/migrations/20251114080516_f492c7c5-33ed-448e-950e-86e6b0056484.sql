-- Add UNIQUE constraint on user_id for UPSERT support
ALTER TABLE public.user_conversation_memory
  ADD CONSTRAINT user_memory_unique_user UNIQUE (user_id);
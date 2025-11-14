-- Phase 4 P1: Update user_conversation_memory for scoped memory
-- Rename existing columns for clearer semantics
ALTER TABLE public.user_conversation_memory 
  RENAME COLUMN content TO memory_summary;

ALTER TABLE public.user_conversation_memory 
  RENAME COLUMN source_conversation_id TO last_conversation_id;

-- Add last_update_trigger column to track what triggered the memory update
ALTER TABLE public.user_conversation_memory 
  ADD COLUMN last_update_trigger TEXT;

-- Add GIN index on metadata (which will store memory_scopes)
-- This enables efficient JSONB queries for scope-based filtering
CREATE INDEX IF NOT EXISTS idx_user_conversation_memory_metadata_gin 
  ON public.user_conversation_memory USING GIN (metadata);

-- Add comment for clarity on metadata usage
COMMENT ON COLUMN public.user_conversation_memory.metadata IS 'Stores memory_scopes as JSONB with scope-specific memories (e.g., {"skincare": {...}, "food": {...}})';
COMMENT ON COLUMN public.user_conversation_memory.last_update_trigger IS 'Tracks what triggered the memory update: "conversation-end", "context-needed", or "manual-reset"';
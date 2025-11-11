-- Add metadata column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN conversations.metadata IS 'Stores conversation-specific metadata like context, settings, or AI model preferences';
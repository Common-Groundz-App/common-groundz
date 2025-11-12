-- Add metadata column for storing tool execution info, model details, and token usage
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_conversation_messages_metadata 
ON conversation_messages USING GIN (metadata);

-- Add comment for documentation
COMMENT ON COLUMN conversation_messages.metadata IS 'Stores tool_calls, model info, and token usage for assistant messages';
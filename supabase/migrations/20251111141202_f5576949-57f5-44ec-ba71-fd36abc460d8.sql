-- Add is_deleted column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_conversation_messages_is_deleted 
ON conversation_messages(conversation_id, is_deleted, created_at);

-- Add comment for documentation
COMMENT ON COLUMN conversation_messages.is_deleted IS 'Soft delete flag - when true, message is hidden from conversation history';
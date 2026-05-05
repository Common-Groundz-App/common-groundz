
-- Disable the edit-window trigger so bulk updates work
ALTER TABLE posts DISABLE TRIGGER enforce_post_edit_window_trigger;

-- Step 1: Consolidate all legacy post types to 'story'
UPDATE posts SET post_type = 'story' WHERE post_type IN ('routine', 'project', 'note', 'update');

-- Step 2: Drop default
ALTER TABLE posts ALTER COLUMN post_type DROP DEFAULT;

-- Step 3: Convert to text
ALTER TABLE posts ALTER COLUMN post_type SET DATA TYPE text USING post_type::text;

-- Step 4: Rename old enum
ALTER TYPE post_type RENAME TO post_type_old;

-- Step 5: Create new enum
CREATE TYPE post_type AS ENUM ('experience', 'review', 'recommendation', 'comparison', 'question', 'tip');

-- Step 6: Map story -> experience
UPDATE posts SET post_type = 'experience' WHERE post_type = 'story';

-- Step 7: Cast back to enum
ALTER TABLE posts ALTER COLUMN post_type SET DATA TYPE post_type USING post_type::post_type;

-- Step 8: Set default
ALTER TABLE posts ALTER COLUMN post_type SET DEFAULT 'experience';

-- Step 9: Drop old enum
DROP TYPE post_type_old;

-- Step 10: Strip ui_post_type from structured_fields
UPDATE posts 
SET structured_fields = structured_fields - 'ui_post_type'
WHERE structured_fields ? 'ui_post_type';

-- Re-enable the trigger
ALTER TABLE posts ENABLE TRIGGER enforce_post_edit_window_trigger;

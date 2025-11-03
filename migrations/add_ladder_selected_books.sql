-- Add ladder_selected_books field to user_preferences table
-- Default to empty array (NULL) which means "select all books"
-- Empty array behavior: If empty, frontend will show all active sportsbooks

ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS ladder_selected_books text[] DEFAULT '{}';

-- Add comment explaining the behavior
COMMENT ON COLUMN user_preferences.ladder_selected_books IS 
'Array of sportsbook IDs selected for ladder filtering. Empty array (default) means all books are selected.';

-- Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_user_preferences_ladder_selected_books 
ON user_preferences USING GIN (ladder_selected_books);


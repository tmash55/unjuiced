-- Add best_odds preferences fields to user_preferences table
-- These preferences control filtering for the Best Odds feature
-- Empty arrays mean "select all" (show everything)

ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS best_odds_selected_books text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS best_odds_selected_sports text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS best_odds_selected_leagues text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS best_odds_selected_markets text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS best_odds_min_improvement numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_odds_max_odds numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS best_odds_min_odds numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS best_odds_scope text DEFAULT 'pregame',
ADD COLUMN IF NOT EXISTS best_odds_sort_by text DEFAULT 'improvement',
ADD COLUMN IF NOT EXISTS best_odds_search_query text DEFAULT '';

-- Add comments explaining the behavior
COMMENT ON COLUMN user_preferences.best_odds_selected_books IS 
'Array of sportsbook IDs selected for best odds filtering. Empty array (default) means all books are selected.';

COMMENT ON COLUMN user_preferences.best_odds_selected_sports IS 
'Array of sport IDs (basketball, football, hockey, baseball) selected for best odds filtering. Empty array (default) means all sports are selected.';

COMMENT ON COLUMN user_preferences.best_odds_selected_leagues IS 
'Array of league IDs (nba, nfl, ncaaf, ncaab, nhl, mlb, wnba) selected for best odds filtering. Empty array (default) means all leagues are selected.';

COMMENT ON COLUMN user_preferences.best_odds_selected_markets IS 
'Array of market codes (player_points, passing_yards, pra, etc.) selected for best odds filtering. Empty array (default) means all markets are selected.';

COMMENT ON COLUMN user_preferences.best_odds_min_improvement IS 
'Minimum improvement percentage to show in best odds. Default 0 means show all.';

COMMENT ON COLUMN user_preferences.best_odds_scope IS 
'Scope filter for best odds: all, pregame, or live. Default is pregame.';

COMMENT ON COLUMN user_preferences.best_odds_sort_by IS 
'Sort order for best odds: improvement or odds. Default is improvement.';

-- Create indexes for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_user_preferences_best_odds_selected_books 
ON user_preferences USING GIN (best_odds_selected_books);

CREATE INDEX IF NOT EXISTS idx_user_preferences_best_odds_selected_sports 
ON user_preferences USING GIN (best_odds_selected_sports);

CREATE INDEX IF NOT EXISTS idx_user_preferences_best_odds_selected_leagues 
ON user_preferences USING GIN (best_odds_selected_leagues);

CREATE INDEX IF NOT EXISTS idx_user_preferences_best_odds_selected_markets 
ON user_preferences USING GIN (best_odds_selected_markets);


-- Add best_odds_market_lines column to user_preferences table
-- This stores market-specific line selections for the Edge Finder
-- Format: {"touchdowns": [0.5, 1.5, 2.5], "player_points": [9.5, 14.5]}
-- NULL or empty object = all lines selected for all markets

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS best_odds_market_lines jsonb DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN public.user_preferences.best_odds_market_lines IS 'Market-specific line selections for Edge Finder (e.g., {"touchdowns": [0.5, 1.5, 2.5]}). NULL or empty object = all lines selected for all markets.';


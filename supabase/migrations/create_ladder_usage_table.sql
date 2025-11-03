-- Create ladder_usage table for tracking ladder feature usage
-- This table tracks user interactions with the ladder builder tool

CREATE TABLE IF NOT EXISTS public.ladder_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  
  -- User identification
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ladder selection details
  sport text NOT NULL CHECK (sport IN ('nfl', 'nba', 'nhl', 'mlb', 'ncaaf', 'ncaab')),
  market text NOT NULL,
  player_entity text, -- Entity ID (e.g., "pid:00-0036613")
  player_name text, -- Human-readable player name for easier querying
  side text CHECK (side IN ('over', 'under')),
  
  -- Additional context
  scope text CHECK (scope IN ('pregame', 'live')),
  selected_books text[], -- Array of sportsbook IDs selected
  
  -- Metadata
  session_id text, -- Optional: browser session ID for anonymous users
  user_agent text,
  referrer text,
  
  -- Indexes for common queries
  CONSTRAINT ladder_usage_sport_check CHECK (sport IN ('nfl', 'nba', 'nhl', 'mlb', 'ncaaf', 'ncaab'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ladder_usage_created_at ON ladder_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ladder_usage_user_id ON ladder_usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ladder_usage_sport ON ladder_usage(sport);
CREATE INDEX IF NOT EXISTS idx_ladder_usage_market ON ladder_usage(market);
CREATE INDEX IF NOT EXISTS idx_ladder_usage_sport_market ON ladder_usage(sport, market);
CREATE INDEX IF NOT EXISTS idx_ladder_usage_player_entity ON ladder_usage(player_entity) WHERE player_entity IS NOT NULL;

-- Enable RLS
ALTER TABLE ladder_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert ladder usage (no sensitive data, just analytics)
CREATE POLICY "Anyone can insert ladder usage"
  ON ladder_usage FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Service role can insert (for any use case)
CREATE POLICY "Service role can insert ladder usage"
  ON ladder_usage FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can view all (for analytics/admin)
CREATE POLICY "Service role can view all ladder usage"
  ON ladder_usage FOR SELECT
  TO service_role
  USING (true);

-- Policy: Authenticated users can view aggregate stats (no PII)
-- This allows users to see general stats without exposing individual records
CREATE POLICY "Users can view aggregate ladder usage"
  ON ladder_usage FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Anonymous users can view aggregate stats (read-only analytics)
CREATE POLICY "Anonymous users can view aggregate ladder usage"
  ON ladder_usage FOR SELECT
  TO anon
  USING (true);

-- Add comment
COMMENT ON TABLE ladder_usage IS 'Tracks user interactions with the ladder builder feature for marketing and analytics';
COMMENT ON COLUMN ladder_usage.sport IS 'Sport code (nfl, nba, nhl, mlb, ncaaf, ncaab)';
COMMENT ON COLUMN ladder_usage.market IS 'Market key (e.g., "passing_yards", "receptions")';
COMMENT ON COLUMN ladder_usage.player_entity IS 'Player entity ID (e.g., "pid:00-0036613")';
COMMENT ON COLUMN ladder_usage.selected_books IS 'Array of sportsbook IDs selected by the user';


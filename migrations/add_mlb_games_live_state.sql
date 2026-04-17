-- Add live game state columns to mlb_games
-- Populated by the VPS live game poller every 30 seconds for in-progress games

ALTER TABLE mlb_games
  ADD COLUMN IF NOT EXISTS current_pitcher_id       integer,
  ADD COLUMN IF NOT EXISTS current_pitcher_name     text,
  ADD COLUMN IF NOT EXISTS current_batter_id        integer,
  ADD COLUMN IF NOT EXISTS current_batter_name      text,
  ADD COLUMN IF NOT EXISTS current_inning           integer,
  ADD COLUMN IF NOT EXISTS current_inning_half      text,   -- 'top' | 'bottom'
  ADD COLUMN IF NOT EXISTS current_outs             integer,
  ADD COLUMN IF NOT EXISTS current_balls            integer,
  ADD COLUMN IF NOT EXISTS current_strikes          integer,
  ADD COLUMN IF NOT EXISTS runners_on_base          jsonb,  -- { first: bool, second: bool, third: bool }
  ADD COLUMN IF NOT EXISTS last_play_description    text,
  ADD COLUMN IF NOT EXISTS live_feed_updated_at     timestamptz;

-- Index for fast lookup of in-progress games by the poller
CREATE INDEX IF NOT EXISTS mlb_games_live_state_idx
  ON mlb_games (status_detailed_state, game_date)
  WHERE status_detailed_state ILIKE '%in progress%';

COMMENT ON COLUMN mlb_games.current_pitcher_id IS 'MLB player ID of the current pitcher on the mound';
COMMENT ON COLUMN mlb_games.current_pitcher_name IS 'Full name of the current pitcher';
COMMENT ON COLUMN mlb_games.current_batter_id IS 'MLB player ID of the current batter';
COMMENT ON COLUMN mlb_games.current_batter_name IS 'Full name of the current batter';
COMMENT ON COLUMN mlb_games.current_inning IS 'Current inning number (1-9+)';
COMMENT ON COLUMN mlb_games.current_inning_half IS '"top" or "bottom"';
COMMENT ON COLUMN mlb_games.current_outs IS 'Outs in the current half-inning (0-2)';
COMMENT ON COLUMN mlb_games.current_balls IS 'Current ball count (0-3)';
COMMENT ON COLUMN mlb_games.current_strikes IS 'Current strike count (0-2)';
COMMENT ON COLUMN mlb_games.runners_on_base IS 'JSON: { first: bool, second: bool, third: bool }';
COMMENT ON COLUMN mlb_games.last_play_description IS 'Description of the most recent play';
COMMENT ON COLUMN mlb_games.live_feed_updated_at IS 'When the live feed was last successfully polled';

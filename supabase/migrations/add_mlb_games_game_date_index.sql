-- Partial index on mlb_games for today's games.
-- Queries filtering game_date = CURRENT_DATE were doing full table scans.
-- This index covers the hot path for the live poller and the games API route.
CREATE INDEX IF NOT EXISTS mlb_games_game_date_today_idx
  ON mlb_games (game_date)
  WHERE game_date >= CURRENT_DATE;

CREATE TABLE IF NOT EXISTS public.wnba_player_correlations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id BIGINT NOT NULL,
  market TEXT NOT NULL,
  line NUMERIC NOT NULL,
  season TEXT NOT NULL DEFAULT '2025',
  last_n_games_key INTEGER NOT NULL,
  requested_last_n_games INTEGER,
  effective_last_n_games INTEGER NOT NULL,
  game_log_limit INTEGER NOT NULL,
  source_team_id INTEGER,
  source_updated_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '6 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wnba_player_correlations_cache_key UNIQUE (player_id, market, line, season, last_n_games_key)
);

CREATE INDEX IF NOT EXISTS idx_wnba_player_corr_cache_lookup
ON public.wnba_player_correlations_cache (player_id, market, season, last_n_games_key, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_wnba_player_corr_cache_expires
ON public.wnba_player_correlations_cache (expires_at);

ALTER TABLE public.wnba_player_correlations_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct public access to WNBA correlation cache" ON public.wnba_player_correlations_cache;
CREATE POLICY "No direct public access to WNBA correlation cache"
ON public.wnba_player_correlations_cache
FOR ALL
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_wnba_box_scores_team_season_updated
ON public.wnba_player_box_scores (team_id, season, updated_at DESC)
WHERE season_type <> 'Preseason' AND minutes > 0;

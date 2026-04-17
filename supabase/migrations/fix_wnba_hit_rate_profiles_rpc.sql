-- Fix WNBA hit rate profiles RPC
--
-- Run this in Supabase SQL editor.
--
-- Problem addressed:
--   get_wnba_hit_rate_profiles_fast_v3 was filtering every row out because
--   p_has_odds defaulted to TRUE and all WNBA profiles have null odds
--   (no live odds vendor yet).  The function is recreated here so that
--   passing p_has_odds = NULL skips the odds-presence filter entirely,
--   matching the same pattern used in get_wnba_hit_rate_cheatsheet_v2.

CREATE OR REPLACE FUNCTION get_wnba_hit_rate_profiles_fast_v3(
  p_dates   DATE[]    DEFAULT NULL,
  p_market  TEXT      DEFAULT NULL,
  p_has_odds BOOLEAN  DEFAULT NULL,
  p_limit   INTEGER   DEFAULT 3000,
  p_offset  INTEGER   DEFAULT 0
)
RETURNS TABLE (
  id                    BIGINT,
  player_id             BIGINT,
  player_name           TEXT,
  team_id               BIGINT,
  team_name             TEXT,
  team_abbr             TEXT,
  opponent_team_id      BIGINT,
  opponent_team_name    TEXT,
  opponent_team_abbr    TEXT,
  player_position       TEXT,
  player_depth_chart_pos TEXT,
  jersey_number         TEXT,
  market                TEXT,
  line                  NUMERIC,
  game_id               BIGINT,
  game_date             DATE,
  game_status           TEXT,
  home_team_name        TEXT,
  away_team_name        TEXT,
  home_away             TEXT,
  national_broadcast    TEXT,
  is_primetime          BOOLEAN,
  last_5_pct            NUMERIC,
  last_10_pct           NUMERIC,
  last_20_pct           NUMERIC,
  season_pct            NUMERIC,
  h2h_pct               NUMERIC,
  h2h_avg               NUMERIC,
  h2h_games             INTEGER,
  hit_streak            INTEGER,
  last_5_avg            NUMERIC,
  last_10_avg           NUMERIC,
  last_20_avg           NUMERIC,
  season_avg            NUMERIC,
  spread                NUMERIC,
  total                 NUMERIC,
  spread_clv            NUMERIC,
  total_clv             NUMERIC,
  injury_status         TEXT,
  injury_notes          TEXT,
  primary_color         TEXT,
  secondary_color       TEXT,
  dvp_rank              INTEGER,
  dvp_label             TEXT,
  odds_selection_id     TEXT,
  sel_key               TEXT,
  event_id              TEXT,
  is_back_to_back       BOOLEAN,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id::BIGINT,
    h.player_id::BIGINT,
    h.player_name,
    NULL::BIGINT                      AS team_id,
    h.team_name,
    h.team_abbr,
    NULL::BIGINT                      AS opponent_team_id,
    h.opponent_team_name,
    h.opponent_team_abbr,
    h.position                        AS player_position,
    h.position                        AS player_depth_chart_pos,
    NULL::TEXT                        AS jersey_number,
    h.market,
    h.line,
    h.game_id::BIGINT,
    h.game_date,
    h.game_status,
    h.home_team_name,
    h.away_team_name,
    h.home_away,
    NULL::TEXT                        AS national_broadcast,
    NULL::BOOLEAN                     AS is_primetime,
    COALESCE(h.last_5_pct,  0),
    COALESCE(h.last_10_pct, 0),
    COALESCE(h.last_20_pct, 0),
    COALESCE(h.season_pct,  0),
    NULL::NUMERIC                     AS h2h_pct,
    NULL::NUMERIC                     AS h2h_avg,
    NULL::INTEGER                     AS h2h_games,
    COALESCE(h.hit_streak,  0),
    COALESCE(h.last_5_avg,  0),
    COALESCE(h.last_10_avg, 0),
    COALESCE(h.last_20_avg, 0),
    COALESCE(h.season_avg,  0),
    NULL::NUMERIC                     AS spread,
    NULL::NUMERIC                     AS total,
    NULL::NUMERIC                     AS spread_clv,
    NULL::NUMERIC                     AS total_clv,
    h.injury_status,
    h.injury_notes,
    h.primary_color,
    h.secondary_color,
    h.dvp_rank,
    NULL::TEXT                        AS dvp_label,
    h.odds_selection_id,
    h.odds_selection_id               AS sel_key,
    h.event_id,
    COALESCE(h.is_back_to_back, FALSE),
    h.created_at,
    h.updated_at

  FROM wnba_hit_rate_profiles h
  WHERE
    -- Date filter: NULL → no restriction
    (p_dates IS NULL OR h.game_date = ANY(p_dates))

    -- Market filter: NULL → all markets
    AND (p_market IS NULL OR h.market = p_market)

    -- Odds presence filter:
    --   NULL  → skip entirely (WNBA has no live odds yet — show all rows)
    --   TRUE  → only profiles that have an odds selection (odds_selection_id IS NOT NULL)
    --   FALSE → only profiles without odds
    AND (
      p_has_odds IS NULL
      OR (p_has_odds = TRUE  AND h.odds_selection_id IS NOT NULL)
      OR (p_has_odds = FALSE AND h.odds_selection_id IS NULL)
    )

  ORDER BY
    COALESCE(h.last_10_pct, 0) DESC,
    COALESCE(h.hit_streak,  0) DESC

  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

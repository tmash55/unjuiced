-- Fix WNBA cheat sheet data pipeline
--
-- Run this in Supabase SQL editor.
--
-- Problems addressed:
--   1. `wnba_games` table does not exist — create a view over wnba_games_hr
--   2. `get_wnba_hit_rate_cheatsheet_v2` filtered all rows because:
--        a. It joined/referenced the non-existent wnba_games table
--        b. The odds filter eliminated every row (over_price IS NULL for
--           preseason profiles built from season averages, not live odds)
--   3. Ambiguous `line` column was already fixed externally; this re-creates
--      the function with the correct column references.

-- ============================================================
-- 1. wnba_games view — aliases wnba_games_hr so any code that
--    references "wnba_games" by name continues to work.
-- ============================================================
CREATE OR REPLACE VIEW wnba_games AS
SELECT * FROM wnba_games_hr;

-- ============================================================
-- 2. Corrected get_wnba_hit_rate_cheatsheet_v2
--    Reads directly from wnba_hit_rate_profiles (fully
--    denormalized — no games join needed).
--    Skips the odds filter when over_price IS NULL or when
--    no odds bounds are supplied.
-- ============================================================
CREATE OR REPLACE FUNCTION get_wnba_hit_rate_cheatsheet_v2(
  p_time_window  TEXT      DEFAULT 'last_10_pct',
  p_min_hit_rate NUMERIC   DEFAULT 0.80,
  p_odds_floor   INTEGER   DEFAULT NULL,
  p_odds_ceiling INTEGER   DEFAULT NULL,
  p_markets      TEXT[]    DEFAULT NULL,
  p_dates        DATE[]    DEFAULT NULL
)
RETURNS TABLE (
  player_id        BIGINT,
  player_name      TEXT,
  team_abbr        TEXT,
  team_name        TEXT,
  opponent_abbr    TEXT,
  opponent_name    TEXT,
  player_position  TEXT,
  game_date        DATE,
  game_id          BIGINT,
  home_away        TEXT,
  home_team_abbr   TEXT,
  away_team_abbr   TEXT,
  home_team_name   TEXT,
  away_team_name   TEXT,
  game_status      TEXT,
  start_time       TEXT,
  market           TEXT,
  line             NUMERIC,
  over_odds        TEXT,
  over_odds_decimal NUMERIC,
  hit_rate         NUMERIC,
  last_5_pct       NUMERIC,
  last_10_pct      NUMERIC,
  last_20_pct      NUMERIC,
  season_pct       NUMERIC,
  hit_streak       INTEGER,
  avg_stat         NUMERIC,
  edge             NUMERIC,
  edge_pct         NUMERIC,
  dvp_rank         INTEGER,
  dvp_avg          NUMERIC,
  matchup_quality  TEXT,
  confidence_grade TEXT,
  confidence_score NUMERIC,
  trend            TEXT,
  odds_selection_id TEXT,
  event_id         TEXT,
  is_back_to_back  BOOLEAN,
  injury_status    TEXT,
  injury_notes     TEXT,
  primary_color    TEXT,
  secondary_color  TEXT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_hit_col TEXT;
  v_avg_col TEXT;
BEGIN
  v_hit_col := CASE p_time_window
    WHEN 'last_5_pct'  THEN 'last_5_pct'
    WHEN 'last_20_pct' THEN 'last_20_pct'
    WHEN 'season_pct'  THEN 'season_pct'
    ELSE                    'last_10_pct'
  END;

  v_avg_col := CASE p_time_window
    WHEN 'last_5_pct'  THEN 'last_5_avg'
    WHEN 'last_20_pct' THEN 'last_20_avg'
    WHEN 'season_pct'  THEN 'season_avg'
    ELSE                    'last_10_avg'
  END;

  RETURN QUERY
  SELECT
    h.player_id::BIGINT,
    h.player_name,
    h.team_abbr,
    h.team_name,
    h.opponent_team_abbr                              AS opponent_abbr,
    h.opponent_team_name                              AS opponent_name,
    h.position                                        AS player_position,
    h.game_date,
    h.game_id::BIGINT,
    h.home_away,
    -- Derive home/away team abbr from home_away flag
    CASE h.home_away
      WHEN 'H' THEN h.team_abbr
      ELSE h.opponent_team_abbr
    END                                               AS home_team_abbr,
    CASE h.home_away
      WHEN 'A' THEN h.team_abbr
      ELSE h.opponent_team_abbr
    END                                               AS away_team_abbr,
    h.home_team_name,
    h.away_team_name,
    h.game_status,
    NULL::TEXT                                        AS start_time,
    h.market,
    h.line,
    h.over_price::TEXT                                AS over_odds,
    h.over_price_decimal                              AS over_odds_decimal,

    -- Hit rate (0–1) selected by time window
    selected.selected_hit_pct / 100.0                  AS hit_rate,

    COALESCE(h.last_5_pct,  0) / 100.0               AS last_5_pct,
    COALESCE(h.last_10_pct, 0) / 100.0               AS last_10_pct,
    COALESCE(h.last_20_pct, 0) / 100.0               AS last_20_pct,
    COALESCE(h.season_pct,  0) / 100.0               AS season_pct,
    COALESCE(h.hit_streak,  0)                        AS hit_streak,

    -- avg_stat selected by time window
    selected.selected_avg                              AS avg_stat,

    -- edge = avg_stat - line
    score_parts.edge_value                             AS edge,

    -- edge_pct = (avg_stat / line - 1) * 100, guarded against div-by-zero
    score_parts.edge_pct_value                         AS edge_pct,

    h.dvp_rank,
    NULL::NUMERIC                                     AS dvp_avg,

    -- matchup_quality from dvp_rank. Uses the team count from the DvP season
    -- in play, so 2026 opening day can still use 2025's 13-team scale until
    -- 2026 DvP rows exist, then expand to the 15-team scale.
    CASE
      WHEN h.dvp_rank IS NULL   THEN 'neutral'
      WHEN h.dvp_rank >= dvp_context.total_teams - GREATEST(1, FLOOR(dvp_context.total_teams / 3.0))::INT + 1
        THEN 'favorable'
      WHEN h.dvp_rank <= GREATEST(1, FLOOR(dvp_context.total_teams / 3.0))::INT
        THEN 'unfavorable'
      ELSE                           'neutral'
    END                                               AS matchup_quality,

    -- confidence_grade: bucket from composite confidence score
    CASE
      WHEN confidence.composite_score >= 90 THEN 'A+'
      WHEN confidence.composite_score >= 80 THEN 'A'
      WHEN confidence.composite_score >= 70 THEN 'B+'
      WHEN confidence.composite_score >= 60 THEN 'B'
      ELSE 'C'
    END                                               AS confidence_grade,

    -- confidence_score (0–100): hit rate + edge + WNBA-scaled DvP + streak + odds
    confidence.composite_score                         AS confidence_score,

    -- trend: compare recency vs season baseline
    CASE
      WHEN COALESCE(h.last_5_pct, 0) >= 80 AND COALESCE(h.hit_streak, 0) >= 3
        THEN 'hot'
      WHEN COALESCE(h.last_5_pct, 0) > COALESCE(h.last_10_pct, 0)
        AND COALESCE(h.last_5_pct, 0) > COALESCE(h.season_pct, 0)
        THEN 'improving'
      WHEN COALESCE(h.last_5_pct, 0) < COALESCE(h.last_10_pct, 0)
        AND COALESCE(h.last_5_pct, 0) < COALESCE(h.season_pct, 0) - 10
        THEN 'declining'
      WHEN COALESCE(h.hit_streak, 0) = 0 AND COALESCE(h.last_5_pct, 0) < 40
        THEN 'cold'
      ELSE 'stable'
    END                                               AS trend,

    h.odds_selection_id,
    h.event_id,
    COALESCE(h.is_back_to_back, FALSE)               AS is_back_to_back,
    h.injury_status,
    h.injury_notes,
    h.primary_color,
    h.secondary_color

  FROM wnba_hit_rate_profiles h
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(
        CASE v_hit_col
          WHEN 'last_5_pct'  THEN h.last_5_pct
          WHEN 'last_20_pct' THEN h.last_20_pct
          WHEN 'season_pct'  THEN h.season_pct
          ELSE                    h.last_10_pct
        END, 0
      ) AS selected_hit_pct,
      COALESCE(
        CASE v_avg_col
          WHEN 'last_5_avg'  THEN h.last_5_avg
          WHEN 'last_20_avg' THEN h.last_20_avg
          WHEN 'season_avg'  THEN h.season_avg
          ELSE                    h.last_10_avg
        END, h.line, 0
      ) AS selected_avg
  ) selected
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF((
        SELECT COUNT(DISTINCT d.team_id)::INT
        FROM wnba_team_defense_by_position d
        WHERE d.season::TEXT = EXTRACT(YEAR FROM h.game_date)::TEXT
      ), 0),
      NULLIF((
        SELECT COUNT(DISTINCT d.team_id)::INT
        FROM wnba_team_defense_by_position d
        WHERE d.season::TEXT = (EXTRACT(YEAR FROM h.game_date)::INT - 1)::TEXT
      ), 0),
      13
    ) AS total_teams
  ) dvp_context
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN h.over_price::TEXT ~ '^-?\d+$' THEN h.over_price::TEXT::INTEGER
      ELSE NULL::INTEGER
    END AS over_price_int
  ) odds_values
  CROSS JOIN LATERAL (
    SELECT
      selected.selected_avg - COALESCE(h.line, selected.selected_avg, 0) AS edge_value,
      CASE WHEN COALESCE(h.line, 0) > 0 THEN
        (selected.selected_avg / h.line - 1.0) * 100.0
      ELSE 0
      END AS edge_pct_value,
      COALESCE(
        LEAST(
          20.0,
          GREATEST(
            0.0,
            ((h.dvp_rank - 1)::NUMERIC / GREATEST(1, dvp_context.total_teams - 1)) * 20.0
          )
        ),
        10.0
      ) AS dvp_score,
      LEAST(10.0, GREATEST(0.0, COALESCE(h.hit_streak, 0)::NUMERIC * 2.0)) AS streak_score,
      CASE
        WHEN h.over_price_decimal >= 2.00 THEN 10.0
        WHEN h.over_price_decimal >= 1.91 THEN 8.0
        WHEN h.over_price_decimal >= 1.83 THEN 6.0
        WHEN h.over_price_decimal >= 1.72 THEN 4.0
        WHEN h.over_price_decimal IS NOT NULL THEN 2.0
        WHEN odds_values.over_price_int >= 100 THEN 10.0
        WHEN odds_values.over_price_int >= -110 THEN 8.0
        WHEN odds_values.over_price_int >= -120 THEN 6.0
        WHEN odds_values.over_price_int >= -140 THEN 4.0
        WHEN odds_values.over_price_int IS NOT NULL THEN 2.0
        ELSE 5.0
      END AS odds_score
  ) score_parts
  CROSS JOIN LATERAL (
    SELECT LEAST(
      100.0,
      GREATEST(
        0.0,
        (selected.selected_hit_pct / 100.0) * 40.0
        + LEAST(20.0, GREATEST(0.0, score_parts.edge_value * 4.0))
        + score_parts.dvp_score
        + score_parts.streak_score
        + score_parts.odds_score
      )
    )::NUMERIC(5, 2) AS composite_score
  ) confidence
  WHERE
    -- Date filter: NULL → no restriction
    (p_dates IS NULL OR h.game_date = ANY(p_dates))

    -- Hit-rate threshold (stored as 0–100 in the table)
    AND selected.selected_hit_pct / 100.0 >= p_min_hit_rate

    -- Odds filter: skip entirely when:
    --   • no bounds are provided (NULL), OR
    --   • the profile has no live odds (over_price IS NULL)
    AND (
      p_odds_floor   IS NULL
      OR p_odds_ceiling IS NULL
      OR h.over_price   IS NULL
      OR h.over_price BETWEEN p_odds_floor AND p_odds_ceiling
    )

    -- Market filter: NULL → all markets
    AND (p_markets IS NULL OR h.market = ANY(p_markets))

  ORDER BY
    confidence.composite_score DESC,
    selected.selected_hit_pct DESC,
    COALESCE(h.hit_streak, 0) DESC;
END;
$$;

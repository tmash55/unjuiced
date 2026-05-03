-- WNBA position-vs-team matchup stats.
--
-- Mirrors the NBA get_positional_matchup_stats RPC response contract while
-- using WNBA position buckets: G, F, and C.

CREATE OR REPLACE FUNCTION public.get_wnba_positional_matchup_stats(
    p_position TEXT,
    p_opponent_team_id BIGINT,
    p_market TEXT,
    p_season TEXT DEFAULT '2025',
    p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  normalized_position TEXT;
BEGIN
  normalized_position := CASE UPPER(p_position)
    WHEN 'PG' THEN 'G'
    WHEN 'SG' THEN 'G'
    WHEN 'SF' THEN 'F'
    WHEN 'PF' THEN 'F'
    WHEN 'C' THEN 'C'
    WHEN 'F' THEN 'F'
    ELSE 'G'
  END;

  WITH position_players AS (
    SELECT wnba_player_id
    FROM wnba_players_hr
    WHERE CASE
      WHEN COALESCE(depth_chart_pos, position) = 'C' THEN 'C'
      WHEN COALESCE(depth_chart_pos, position) = 'F' THEN 'F'
      ELSE 'G'
    END = normalized_position
  ),
  matchup_games AS (
    SELECT
      bs.player_id,
      bs.pts,
      bs.reb,
      bs.ast,
      bs.fg3m,
      bs.blk,
      bs.stl,
      bs.tov,
      bs.fgm,
      bs.fga,
      bs.minutes,
      bs.game_date,
      p.name AS player_name,
      COALESCE(t.abbreviation, p.odds_team_abbr) AS team_abbr,
      CASE
        WHEN COALESCE(p.depth_chart_pos, p.position) = 'C' THEN 'C'
        WHEN COALESCE(p.depth_chart_pos, p.position) = 'F' THEN 'F'
        ELSE 'G'
      END AS player_position,
      CASE p_market
        WHEN 'player_points' THEN bs.pts
        WHEN 'player_rebounds' THEN bs.reb
        WHEN 'player_assists' THEN bs.ast
        WHEN 'player_threes_made' THEN bs.fg3m
        WHEN 'player_blocks' THEN bs.blk
        WHEN 'player_steals' THEN bs.stl
        WHEN 'player_turnovers' THEN bs.tov
        WHEN 'player_points_rebounds_assists' THEN (bs.pts + bs.reb + bs.ast)
        WHEN 'player_points_rebounds' THEN (bs.pts + bs.reb)
        WHEN 'player_points_assists' THEN (bs.pts + bs.ast)
        WHEN 'player_rebounds_assists' THEN (bs.reb + bs.ast)
        WHEN 'player_blocks_steals' THEN (bs.blk + bs.stl)
        ELSE bs.pts
      END AS market_stat,
      CASE p_market
        WHEN 'player_points' THEN bs.closing_ln_player_points
        WHEN 'player_rebounds' THEN bs.closing_ln_player_rebounds
        WHEN 'player_assists' THEN bs.closing_ln_player_assists
        WHEN 'player_threes_made' THEN bs.closing_ln_player_threes_made
        WHEN 'player_blocks' THEN bs.closing_ln_player_blocks
        WHEN 'player_steals' THEN bs.closing_ln_player_steals
        WHEN 'player_turnovers' THEN bs.closing_ln_player_turnovers
        WHEN 'player_points_rebounds_assists' THEN bs.closing_ln_player_points_rebounds_assists
        WHEN 'player_points_rebounds' THEN bs.closing_ln_player_points_rebounds
        WHEN 'player_points_assists' THEN bs.closing_ln_player_points_assists
        WHEN 'player_rebounds_assists' THEN bs.closing_ln_player_rebounds_assists
        WHEN 'player_blocks_steals' THEN bs.closing_ln_player_blocks_steals
        ELSE NULL
      END AS closing_line,
      CASE p_market
        WHEN 'player_points' THEN bs.closing_price_over_player_points
        WHEN 'player_rebounds' THEN bs.closing_price_over_player_rebounds
        WHEN 'player_assists' THEN bs.closing_price_over_player_assists
        WHEN 'player_threes_made' THEN bs.closing_price_over_player_threes_made
        WHEN 'player_blocks' THEN bs.closing_price_over_player_blocks
        WHEN 'player_steals' THEN bs.closing_price_over_player_steals
        WHEN 'player_turnovers' THEN bs.closing_price_over_player_turnovers
        WHEN 'player_points_rebounds_assists' THEN bs.closing_price_over_player_points_rebounds_assists
        WHEN 'player_points_rebounds' THEN bs.closing_price_over_player_points_rebounds
        WHEN 'player_points_assists' THEN bs.closing_price_over_player_points_assists
        WHEN 'player_rebounds_assists' THEN bs.closing_price_over_player_rebounds_assists
        WHEN 'player_blocks_steals' THEN bs.closing_price_over_player_blocks_steals
        ELSE NULL
      END AS closing_price_over,
      CASE p_market
        WHEN 'player_points' THEN bs.closing_price_under_player_points
        WHEN 'player_rebounds' THEN bs.closing_price_under_player_rebounds
        WHEN 'player_assists' THEN bs.closing_price_under_player_assists
        WHEN 'player_threes_made' THEN bs.closing_price_under_player_threes_made
        WHEN 'player_blocks' THEN bs.closing_price_under_player_blocks
        WHEN 'player_steals' THEN bs.closing_price_under_player_steals
        WHEN 'player_turnovers' THEN bs.closing_price_under_player_turnovers
        WHEN 'player_points_rebounds_assists' THEN bs.closing_price_under_player_points_rebounds_assists
        WHEN 'player_points_rebounds' THEN bs.closing_price_under_player_points_rebounds
        WHEN 'player_points_assists' THEN bs.closing_price_under_player_points_assists
        WHEN 'player_rebounds_assists' THEN bs.closing_price_under_player_rebounds_assists
        WHEN 'player_blocks_steals' THEN bs.closing_price_under_player_blocks_steals
        ELSE NULL
      END AS closing_price_under
    FROM wnba_player_box_scores bs
    JOIN position_players pp ON bs.player_id = pp.wnba_player_id
    JOIN wnba_players_hr p ON bs.player_id = p.wnba_player_id
    LEFT JOIN wnba_teams t ON p.team_id = t.team_id
    WHERE bs.opponent_team_id = p_opponent_team_id
      AND bs.season = p_season
      AND bs.season_type != 'Preseason'
      AND bs.minutes IS NOT NULL
      AND bs.minutes > 0
    ORDER BY bs.game_date DESC
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'position', normalized_position,
    'opponent_team_id', p_opponent_team_id,
    'market', p_market,
    'season', p_season,
    'total_games', COUNT(*)::integer,
    'player_count', COUNT(DISTINCT player_id)::integer,
    'avg_stat', COALESCE(ROUND(AVG(market_stat), 1), 0),
    'min_stat', COALESCE(MIN(market_stat), 0),
    'max_stat', COALESCE(MAX(market_stat), 0),
    'avg_points', COALESCE(ROUND(AVG(pts), 1), 0),
    'avg_rebounds', COALESCE(ROUND(AVG(reb), 1), 0),
    'avg_assists', COALESCE(ROUND(AVG(ast), 1), 0),
    'avg_closing_line', ROUND(AVG(closing_line), 1),
    'games_with_lines', COUNT(closing_line)::integer,
    'over_hit_count', SUM(CASE WHEN closing_line IS NOT NULL AND market_stat > closing_line THEN 1 ELSE 0 END)::integer,
    'under_hit_count', SUM(CASE WHEN closing_line IS NOT NULL AND market_stat < closing_line THEN 1 ELSE 0 END)::integer,
    'push_count', SUM(CASE WHEN closing_line IS NOT NULL AND market_stat = closing_line THEN 1 ELSE 0 END)::integer,
    'over_hit_rate', ROUND(
      100.0 * SUM(CASE WHEN closing_line IS NOT NULL AND market_stat > closing_line THEN 1 ELSE 0 END)
      / NULLIF(COUNT(closing_line), 0), 1
    ),
    'recent_games', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'player_id', player_id,
          'player_name', player_name,
          'team_abbr', team_abbr,
          'position', player_position,
          'date', game_date,
          'stat', market_stat,
          'closing_line', closing_line,
          'closing_price_over', closing_price_over,
          'closing_price_under', closing_price_under,
          'hit_over', CASE
            WHEN closing_line IS NULL THEN NULL
            WHEN market_stat > closing_line THEN true
            WHEN market_stat < closing_line THEN false
            ELSE NULL
          END,
          'pts', pts,
          'reb', reb,
          'ast', ast,
          'fg3m', fg3m,
          'stl', stl,
          'blk', blk,
          'tov', tov,
          'fgm', fgm,
          'fga', fga,
          'minutes', minutes
        )
        ORDER BY game_date DESC
      )
      FROM (SELECT * FROM matchup_games LIMIT 20) recent
    )
  )
  INTO result
  FROM matchup_games;

  RETURN result;
END;
$$;

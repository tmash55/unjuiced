CREATE OR REPLACE FUNCTION public.get_wnba_player_correlations(
  p_player_id BIGINT,
  p_market TEXT,
  p_line NUMERIC,
  p_last_n_games INTEGER DEFAULT NULL,
  p_season TEXT DEFAULT '2025',
  p_game_log_limit INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_anchor_team_id INTEGER;
  v_anchor_name TEXT;
  v_anchor_position TEXT;
  v_result JSONB;
BEGIN
  SELECT team_id, name, COALESCE(depth_chart_pos::TEXT, position::TEXT)
  INTO v_anchor_team_id, v_anchor_name, v_anchor_position
  FROM wnba_players_hr
  WHERE wnba_player_id = p_player_id;

  IF v_anchor_name IS NULL THEN
    RETURN NULL;
  END IF;

  WITH anchor_games_raw AS (
    SELECT
      bs.game_id,
      bs.game_date,
      bs.team_id,
      bs.opponent_team_id,
      bs.minutes,
      CASE WHEN bs.home_away = 'H' THEN 'home' ELSE 'away' END AS home_away,
      (bs.game_date - LAG(bs.game_date) OVER (ORDER BY bs.game_date)) = 1 AS is_back_to_back,
      CASE p_market
        WHEN 'player_points' THEN bs.pts
        WHEN 'player_rebounds' THEN bs.reb
        WHEN 'player_assists' THEN bs.ast
        WHEN 'player_threes_made' THEN bs.fg3m
        WHEN 'player_steals' THEN bs.stl
        WHEN 'player_blocks' THEN bs.blk
        WHEN 'player_turnovers' THEN bs.tov
        WHEN 'player_points_rebounds_assists' THEN (bs.pts + bs.reb + bs.ast)
        WHEN 'player_points_rebounds' THEN (bs.pts + bs.reb)
        WHEN 'player_points_assists' THEN (bs.pts + bs.ast)
        WHEN 'player_rebounds_assists' THEN (bs.reb + bs.ast)
        WHEN 'player_blocks_steals' THEN (bs.blk + bs.stl)
        ELSE bs.pts
      END AS anchor_stat,
      bs.pts,
      bs.reb,
      bs.ast,
      bs.fg3m,
      bs.stl,
      bs.blk,
      bs.tov,
      (bs.pts + bs.reb + bs.ast) AS pra,
      ROW_NUMBER() OVER (ORDER BY bs.game_date DESC) AS game_num
    FROM wnba_player_box_scores bs
    WHERE bs.player_id = p_player_id
      AND bs.season = p_season
      AND bs.season_type <> 'Preseason'
      AND bs.minutes > 0
  ),
  anchor_games AS (
    SELECT *
    FROM anchor_games_raw
    WHERE p_last_n_games IS NULL OR game_num <= p_last_n_games
  ),
  anchor_classified AS (
    SELECT *, anchor_stat >= p_line AS did_hit
    FROM anchor_games
  ),
  anchor_summary AS (
    SELECT
      COUNT(*) AS total_games,
      COUNT(*) FILTER (WHERE did_hit) AS games_hit,
      COUNT(*) FILTER (WHERE NOT did_hit) AS games_miss,
      ROUND(100.0 * COUNT(*) FILTER (WHERE did_hit) / NULLIF(COUNT(*), 0), 1) AS hit_rate,
      ROUND(AVG(anchor_stat), 1) AS avg_stat,
      COUNT(*) FILTER (WHERE home_away = 'home') AS home_games,
      COUNT(*) FILTER (WHERE did_hit AND home_away = 'home') AS home_hits,
      COUNT(*) FILTER (WHERE home_away = 'away') AS away_games,
      COUNT(*) FILTER (WHERE did_hit AND home_away = 'away') AS away_hits,
      COUNT(*) FILTER (WHERE is_back_to_back) AS b2b_games,
      COUNT(*) FILTER (WHERE did_hit AND is_back_to_back) AS b2b_hits,
      COUNT(*) FILTER (WHERE NOT is_back_to_back) AS rest_games,
      COUNT(*) FILTER (WHERE did_hit AND NOT is_back_to_back) AS rest_hits
    FROM anchor_classified
  ),
  teammate_games AS (
    SELECT
      bs.player_id,
      bs.game_id,
      p.name AS player_name,
      p.nba_player_id,
      COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT) AS position,
      bs.pts,
      bs.reb,
      bs.ast,
      bs.fg3m,
      bs.stl,
      bs.blk,
      bs.tov,
      (bs.pts + bs.reb + bs.ast) AS pra,
      (bs.pts + bs.reb) AS pr,
      (bs.pts + bs.ast) AS pa,
      (bs.reb + bs.ast) AS ra,
      (bs.blk + bs.stl) AS bs_combo,
      bs.minutes,
      ac.did_hit AS anchor_hit,
      ac.home_away,
      ac.is_back_to_back,
      ac.game_date
    FROM wnba_player_box_scores bs
    JOIN wnba_players_hr p ON p.wnba_player_id = bs.player_id
    JOIN anchor_classified ac ON ac.game_id = bs.game_id
    WHERE bs.team_id = v_anchor_team_id
      AND bs.player_id <> p_player_id
      AND bs.season = p_season
      AND bs.season_type <> 'Preseason'
      AND bs.minutes > 5
  ),
  teammate_avgs AS (
    SELECT
      player_id,
      GREATEST(0.5, ROUND(AVG(pts), 0) - 0.5) AS pts_line,
      GREATEST(0.5, ROUND(AVG(reb), 0) - 0.5) AS reb_line,
      GREATEST(0.5, ROUND(AVG(ast), 0) - 0.5) AS ast_line,
      GREATEST(0.5, ROUND(AVG(fg3m) * 2, 0) / 2.0) AS fg3m_line,
      GREATEST(0.5, ROUND(AVG(stl) * 2, 0) / 2.0) AS stl_line,
      GREATEST(0.5, ROUND(AVG(blk) * 2, 0) / 2.0) AS blk_line,
      GREATEST(0.5, ROUND(AVG(tov), 0) - 0.5) AS tov_line,
      GREATEST(0.5, ROUND(AVG(pra), 0) - 0.5) AS pra_line,
      GREATEST(0.5, ROUND(AVG(pr), 0) - 0.5) AS pr_line,
      GREATEST(0.5, ROUND(AVG(pa), 0) - 0.5) AS pa_line,
      GREATEST(0.5, ROUND(AVG(ra), 0) - 0.5) AS ra_line,
      GREATEST(0.5, ROUND(AVG(bs_combo) * 2, 0) / 2.0) AS bs_line
    FROM teammate_games
    GROUP BY player_id
  ),
  teammate_correlations AS (
    SELECT
      tg.player_id,
      tg.player_name,
      tg.nba_player_id,
      tg.position,
      COUNT(*) AS total_games_together,
      ROUND(AVG(tg.pts), 1) AS pts_avg,
      ROUND(AVG(tg.reb), 1) AS reb_avg,
      ROUND(AVG(tg.ast), 1) AS ast_avg,
      ROUND(AVG(tg.fg3m), 1) AS fg3m_avg,
      ROUND(AVG(tg.stl), 1) AS stl_avg,
      ROUND(AVG(tg.blk), 1) AS blk_avg,
      ROUND(AVG(tg.tov), 1) AS tov_avg,
      ROUND(AVG(tg.pra), 1) AS pra_avg,
      ROUND(AVG(tg.pr), 1) AS pr_avg,
      ROUND(AVG(tg.pa), 1) AS pa_avg,
      ROUND(AVG(tg.ra), 1) AS ra_avg,
      ROUND(AVG(tg.bs_combo), 1) AS bs_avg,
      ROUND(AVG(tg.minutes), 1) AS minutes_avg,
      COUNT(*) FILTER (WHERE anchor_hit) AS games_when_anchor_hits,
      COUNT(*) FILTER (WHERE NOT anchor_hit) AS games_when_anchor_misses,
      ROUND(AVG(tg.pts) FILTER (WHERE anchor_hit), 1) AS pts_when_hit,
      ROUND(AVG(tg.pts) FILTER (WHERE NOT anchor_hit), 1) AS pts_when_miss,
      ROUND(AVG(tg.pts) FILTER (WHERE anchor_hit) - AVG(tg.pts) FILTER (WHERE NOT anchor_hit), 1) AS pts_diff,
      ROUND(AVG(tg.reb) FILTER (WHERE anchor_hit), 1) AS reb_when_hit,
      ROUND(AVG(tg.reb) FILTER (WHERE NOT anchor_hit), 1) AS reb_when_miss,
      ROUND(AVG(tg.reb) FILTER (WHERE anchor_hit) - AVG(tg.reb) FILTER (WHERE NOT anchor_hit), 1) AS reb_diff,
      ROUND(AVG(tg.ast) FILTER (WHERE anchor_hit), 1) AS ast_when_hit,
      ROUND(AVG(tg.ast) FILTER (WHERE NOT anchor_hit), 1) AS ast_when_miss,
      ROUND(AVG(tg.ast) FILTER (WHERE anchor_hit) - AVG(tg.ast) FILTER (WHERE NOT anchor_hit), 1) AS ast_diff,
      ROUND(AVG(tg.fg3m) FILTER (WHERE anchor_hit), 1) AS fg3m_when_hit,
      ROUND(AVG(tg.fg3m) FILTER (WHERE NOT anchor_hit), 1) AS fg3m_when_miss,
      ROUND(AVG(tg.fg3m) FILTER (WHERE anchor_hit) - AVG(tg.fg3m) FILTER (WHERE NOT anchor_hit), 1) AS fg3m_diff,
      ROUND(AVG(tg.stl) FILTER (WHERE anchor_hit), 1) AS stl_when_hit,
      ROUND(AVG(tg.stl) FILTER (WHERE NOT anchor_hit), 1) AS stl_when_miss,
      ROUND(AVG(tg.stl) FILTER (WHERE anchor_hit) - AVG(tg.stl) FILTER (WHERE NOT anchor_hit), 1) AS stl_diff,
      ROUND(AVG(tg.blk) FILTER (WHERE anchor_hit), 1) AS blk_when_hit,
      ROUND(AVG(tg.blk) FILTER (WHERE NOT anchor_hit), 1) AS blk_when_miss,
      ROUND(AVG(tg.blk) FILTER (WHERE anchor_hit) - AVG(tg.blk) FILTER (WHERE NOT anchor_hit), 1) AS blk_diff,
      ROUND(AVG(tg.tov) FILTER (WHERE anchor_hit), 1) AS tov_when_hit,
      ROUND(AVG(tg.tov) FILTER (WHERE NOT anchor_hit), 1) AS tov_when_miss,
      ROUND(AVG(tg.tov) FILTER (WHERE anchor_hit) - AVG(tg.tov) FILTER (WHERE NOT anchor_hit), 1) AS tov_diff,
      ROUND(AVG(tg.pra) FILTER (WHERE anchor_hit), 1) AS pra_when_hit,
      ROUND(AVG(tg.pra) FILTER (WHERE NOT anchor_hit), 1) AS pra_when_miss,
      ROUND(AVG(tg.pra) FILTER (WHERE anchor_hit) - AVG(tg.pra) FILTER (WHERE NOT anchor_hit), 1) AS pra_diff,
      ROUND(AVG(tg.pr) FILTER (WHERE anchor_hit), 1) AS pr_when_hit,
      ROUND(AVG(tg.pr) FILTER (WHERE NOT anchor_hit), 1) AS pr_when_miss,
      ROUND(AVG(tg.pr) FILTER (WHERE anchor_hit) - AVG(tg.pr) FILTER (WHERE NOT anchor_hit), 1) AS pr_diff,
      ROUND(AVG(tg.pa) FILTER (WHERE anchor_hit), 1) AS pa_when_hit,
      ROUND(AVG(tg.pa) FILTER (WHERE NOT anchor_hit), 1) AS pa_when_miss,
      ROUND(AVG(tg.pa) FILTER (WHERE anchor_hit) - AVG(tg.pa) FILTER (WHERE NOT anchor_hit), 1) AS pa_diff,
      ROUND(AVG(tg.ra) FILTER (WHERE anchor_hit), 1) AS ra_when_hit,
      ROUND(AVG(tg.ra) FILTER (WHERE NOT anchor_hit), 1) AS ra_when_miss,
      ROUND(AVG(tg.ra) FILTER (WHERE anchor_hit) - AVG(tg.ra) FILTER (WHERE NOT anchor_hit), 1) AS ra_diff,
      ROUND(AVG(tg.bs_combo) FILTER (WHERE anchor_hit), 1) AS bs_when_hit,
      ROUND(AVG(tg.bs_combo) FILTER (WHERE NOT anchor_hit), 1) AS bs_when_miss,
      ROUND(AVG(tg.bs_combo) FILTER (WHERE anchor_hit) - AVG(tg.bs_combo) FILTER (WHERE NOT anchor_hit), 1) AS bs_diff,
      ta.pts_line,
      ta.reb_line,
      ta.ast_line,
      ta.fg3m_line,
      ta.stl_line,
      ta.blk_line,
      ta.tov_line,
      ta.pra_line,
      ta.pr_line,
      ta.pa_line,
      ta.ra_line,
      ta.bs_line,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.pts >= ta.pts_line) AS pts_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.reb >= ta.reb_line) AS reb_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.ast >= ta.ast_line) AS ast_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.fg3m >= ta.fg3m_line) AS fg3_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.stl >= ta.stl_line) AS stl_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.blk >= ta.blk_line) AS blk_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.tov <= ta.tov_line) AS tov_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.pra >= ta.pra_line) AS pra_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.pr >= ta.pr_line) AS pr_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.pa >= ta.pa_line) AS pa_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.ra >= ta.ra_line) AS ra_hits_when_anchor_hits,
      COUNT(*) FILTER (WHERE anchor_hit AND tg.bs_combo >= ta.bs_line) AS bs_hits_when_anchor_hits
    FROM teammate_games tg
    JOIN teammate_avgs ta ON ta.player_id = tg.player_id
    GROUP BY tg.player_id, tg.player_name, tg.nba_player_id, tg.position, ta.pts_line, ta.reb_line, ta.ast_line, ta.fg3m_line, ta.stl_line, ta.blk_line, ta.tov_line, ta.pra_line, ta.pr_line, ta.pa_line, ta.ra_line, ta.bs_line
    HAVING COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE anchor_hit) >= 2
  ),
  teammate_game_logs AS (
    SELECT
      player_id,
      jsonb_agg(
        jsonb_build_object(
          'gameId', game_id::TEXT,
          'gameDate', game_date,
          'anchorHit', anchor_hit,
          'homeAway', home_away,
          'isBackToBack', is_back_to_back,
          'stats', jsonb_build_object(
            'pts', pts,
            'reb', reb,
            'ast', ast,
            'fg3m', fg3m,
            'stl', stl,
            'blk', blk,
            'tov', tov,
            'pra', pra,
            'pr', pr,
            'pa', pa,
            'ra', ra,
            'bs', bs_combo,
            'minutes', minutes
          )
        )
        ORDER BY game_date DESC
      ) AS logs
    FROM (
      SELECT tg.*, ROW_NUMBER() OVER (PARTITION BY tg.player_id ORDER BY tg.game_date DESC) AS rn
      FROM teammate_games tg
      WHERE EXISTS (SELECT 1 FROM teammate_correlations tc WHERE tc.player_id = tg.player_id)
    ) ranked
    WHERE rn <= p_game_log_limit
    GROUP BY player_id
  )
  SELECT jsonb_build_object(
    'version', 'wnba-1.1',
    'filters', jsonb_build_object(
      'lastNGames', p_last_n_games,
      'season', p_season,
      'isFiltered', p_last_n_games IS NOT NULL
    ),
    'anchorPlayer', jsonb_build_object(
      'playerId', p_player_id,
      'playerName', v_anchor_name,
      'position', v_anchor_position,
      'teamId', v_anchor_team_id,
      'market', p_market,
      'line', p_line
    ),
    'anchorPerformance', (
      SELECT jsonb_build_object(
        'gamesAnalyzed', total_games,
        'timesHit', games_hit,
        'timesMissed', games_miss,
        'hitRate', hit_rate,
        'avgStat', avg_stat,
        'display', games_hit || '/' || total_games || ' (' || COALESCE(hit_rate::TEXT, '0') || '%)',
        'splits', jsonb_build_object(
          'home', jsonb_build_object('games', home_games, 'hits', home_hits, 'hitRate', ROUND(100.0 * home_hits / NULLIF(home_games, 0), 0), 'display', home_hits || '/' || home_games),
          'away', jsonb_build_object('games', away_games, 'hits', away_hits, 'hitRate', ROUND(100.0 * away_hits / NULLIF(away_games, 0), 0), 'display', away_hits || '/' || away_games),
          'backToBack', jsonb_build_object('games', b2b_games, 'hits', b2b_hits, 'hitRate', ROUND(100.0 * b2b_hits / NULLIF(b2b_games, 0), 0), 'display', b2b_hits || '/' || b2b_games),
          'rested', jsonb_build_object('games', rest_games, 'hits', rest_hits, 'hitRate', ROUND(100.0 * rest_hits / NULLIF(rest_games, 0), 0), 'display', rest_hits || '/' || rest_games)
        )
      )
      FROM anchor_summary
    ),
    'teammateCorrelations', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'playerId', tc.player_id,
          'nbaPlayerId', tc.nba_player_id,
          'playerName', tc.player_name,
          'position', tc.position,
          'minutesAvg', tc.minutes_avg,
          'sample', jsonb_build_object('totalGames', tc.total_games_together, 'whenAnchorHits', tc.games_when_anchor_hits, 'whenAnchorMisses', tc.games_when_anchor_misses),
          'points', jsonb_build_object('avgOverall', tc.pts_avg, 'avgWhenHit', tc.pts_when_hit, 'avgWhenMiss', tc.pts_when_miss, 'diff', tc.pts_diff, 'strength', CASE WHEN ABS(tc.pts_diff) >= 5 THEN 'strong' WHEN ABS(tc.pts_diff) >= 2.5 THEN 'moderate' ELSE 'weak' END, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.pts_line, 'timesHit', tc.pts_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.pts_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.pts_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'rebounds', jsonb_build_object('avgOverall', tc.reb_avg, 'avgWhenHit', tc.reb_when_hit, 'avgWhenMiss', tc.reb_when_miss, 'diff', tc.reb_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.reb_line, 'timesHit', tc.reb_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.reb_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.reb_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'assists', jsonb_build_object('avgOverall', tc.ast_avg, 'avgWhenHit', tc.ast_when_hit, 'avgWhenMiss', tc.ast_when_miss, 'diff', tc.ast_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.ast_line, 'timesHit', tc.ast_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.ast_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.ast_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'threes', jsonb_build_object('avgOverall', tc.fg3m_avg, 'avgWhenHit', tc.fg3m_when_hit, 'avgWhenMiss', tc.fg3m_when_miss, 'diff', tc.fg3m_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.fg3m_line, 'timesHit', tc.fg3_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.fg3_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.fg3_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'steals', jsonb_build_object('avgOverall', tc.stl_avg, 'avgWhenHit', tc.stl_when_hit, 'avgWhenMiss', tc.stl_when_miss, 'diff', tc.stl_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.stl_line, 'timesHit', tc.stl_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.stl_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.stl_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'blocks', jsonb_build_object('avgOverall', tc.blk_avg, 'avgWhenHit', tc.blk_when_hit, 'avgWhenMiss', tc.blk_when_miss, 'diff', tc.blk_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.blk_line, 'timesHit', tc.blk_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.blk_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.blk_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'turnovers', jsonb_build_object('avgOverall', tc.tov_avg, 'avgWhenHit', tc.tov_when_hit, 'avgWhenMiss', tc.tov_when_miss, 'diff', tc.tov_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.tov_line, 'timesHit', tc.tov_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.tov_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.tov_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'pra', jsonb_build_object('avgOverall', tc.pra_avg, 'avgWhenHit', tc.pra_when_hit, 'avgWhenMiss', tc.pra_when_miss, 'diff', tc.pra_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.pra_line, 'timesHit', tc.pra_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.pra_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.pra_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'pointsRebounds', jsonb_build_object('avgOverall', tc.pr_avg, 'avgWhenHit', tc.pr_when_hit, 'avgWhenMiss', tc.pr_when_miss, 'diff', tc.pr_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.pr_line, 'timesHit', tc.pr_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.pr_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.pr_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'pointsAssists', jsonb_build_object('avgOverall', tc.pa_avg, 'avgWhenHit', tc.pa_when_hit, 'avgWhenMiss', tc.pa_when_miss, 'diff', tc.pa_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.pa_line, 'timesHit', tc.pa_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.pa_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.pa_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'reboundsAssists', jsonb_build_object('avgOverall', tc.ra_avg, 'avgWhenHit', tc.ra_when_hit, 'avgWhenMiss', tc.ra_when_miss, 'diff', tc.ra_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.ra_line, 'timesHit', tc.ra_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.ra_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.ra_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'blocksSteals', jsonb_build_object('avgOverall', tc.bs_avg, 'avgWhenHit', tc.bs_when_hit, 'avgWhenMiss', tc.bs_when_miss, 'diff', tc.bs_diff, 'hitRateWhenAnchorHits', jsonb_build_object('lineUsed', tc.bs_line, 'timesHit', tc.bs_hits_when_anchor_hits, 'games', tc.games_when_anchor_hits, 'pct', ROUND(100.0 * tc.bs_hits_when_anchor_hits / NULLIF(tc.games_when_anchor_hits, 0), 0), 'display', tc.bs_hits_when_anchor_hits || '/' || tc.games_when_anchor_hits)),
          'gameLogs', COALESCE(tgl.logs, '[]'::jsonb)
        )
        ORDER BY tc.games_when_anchor_hits DESC, ABS(tc.pts_diff) DESC
      ), '[]'::jsonb)
      FROM teammate_correlations tc
      LEFT JOIN teammate_game_logs tgl ON tgl.player_id = tc.player_id
    ),
    'headline', (
      SELECT jsonb_build_object(
        'anchor', v_anchor_name || ' hit ' || p_line || '+ ' || REPLACE(p_market, 'player_', '') || ' in ' || games_hit || '/' || total_games || ' games (' || COALESCE(hit_rate::TEXT, '0') || '%)',
        'topTeammate', (
          SELECT player_name || ' averaged ' || pts_when_hit || ' pts in those ' || games_when_anchor_hits || ' games'
          FROM teammate_correlations
          ORDER BY games_when_anchor_hits DESC
          LIMIT 1
        )
      )
      FROM anchor_summary
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- WNBA players-out filter RPC
--
-- Mirrors public.get_players_out_for_filter for WNBA drilldown lineup filters.
-- Returns players who were out during the selected player's historical games,
-- grouped into teammates and opponents with season averages for impact labels.

CREATE OR REPLACE FUNCTION public.get_wnba_players_out_for_filter(
    p_player_id BIGINT,
    p_season    TEXT DEFAULT '2025'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_id BIGINT;
    v_result  JSONB;
BEGIN
    SELECT team_id INTO v_team_id
    FROM wnba_players_hr
    WHERE wnba_player_id = p_player_id;

    WITH player_games AS (
        SELECT
            bs.game_id,
            bs.team_id,
            bs.opponent_team_id
        FROM wnba_player_box_scores bs
        WHERE bs.player_id = p_player_id
          AND (p_season IS NULL OR bs.season = p_season)
          AND bs.season_type != 'Preseason'
    ),
    player_avgs AS (
        SELECT
            player_id,
            ROUND(AVG(pts), 1) AS avg_pts,
            ROUND(AVG(reb), 1) AS avg_reb,
            ROUND(AVG(ast), 1) AS avg_ast
        FROM wnba_player_box_scores
        WHERE (p_season IS NULL OR season = p_season)
          AND season_type != 'Preseason'
        GROUP BY player_id
    ),
    teammates AS (
        SELECT
            gpo.player_id AS out_player_id,
            p.nba_player_id,
            p.name,
            COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT) AS position,
            COUNT(DISTINCT gpo.game_id) AS games_out,
            MAX(pa.avg_pts) AS avg_pts,
            MAX(pa.avg_reb) AS avg_reb,
            MAX(pa.avg_ast) AS avg_ast
        FROM player_games pg
        JOIN wnba_game_players_out gpo
          ON gpo.game_id = pg.game_id
         AND gpo.team_id = pg.team_id
        JOIN wnba_players_hr p ON p.wnba_player_id = gpo.player_id
        LEFT JOIN player_avgs pa ON pa.player_id = gpo.player_id
        WHERE gpo.player_id != p_player_id
        GROUP BY gpo.player_id, p.nba_player_id, p.name, p.depth_chart_pos, p.position
        HAVING COUNT(DISTINCT gpo.game_id) >= 1
    ),
    opponents AS (
        SELECT
            gpo.player_id AS out_player_id,
            p.nba_player_id,
            p.name,
            gpo.team_id AS opp_team_id,
            COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT) AS position,
            COUNT(DISTINCT gpo.game_id) AS games_out,
            MAX(pa.avg_pts) AS avg_pts,
            MAX(pa.avg_reb) AS avg_reb,
            MAX(pa.avg_ast) AS avg_ast
        FROM player_games pg
        JOIN wnba_game_players_out gpo
          ON gpo.game_id = pg.game_id
         AND gpo.team_id = pg.opponent_team_id
        JOIN wnba_players_hr p ON p.wnba_player_id = gpo.player_id
        LEFT JOIN player_avgs pa ON pa.player_id = gpo.player_id
        GROUP BY gpo.player_id, p.nba_player_id, p.name, gpo.team_id, p.depth_chart_pos, p.position
        HAVING COUNT(DISTINCT gpo.game_id) >= 1
    )
    SELECT jsonb_build_object(
        'player_id', p_player_id,
        'team_id', v_team_id,
        'teammates_out', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'player_id', out_player_id,
                    'nba_player_id', nba_player_id,
                    'name', name,
                    'position', position,
                    'games_out', games_out,
                    'avg_pts', avg_pts,
                    'avg_reb', avg_reb,
                    'avg_ast', avg_ast
                )
                ORDER BY games_out DESC, name ASC
            ), '[]'::jsonb)
            FROM teammates
        ),
        'opponents_out', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'player_id', out_player_id,
                    'nba_player_id', nba_player_id,
                    'name', name,
                    'team_id', opp_team_id,
                    'position', position,
                    'games_out', games_out,
                    'avg_pts', avg_pts,
                    'avg_reb', avg_reb,
                    'avg_ast', avg_ast
                )
                ORDER BY games_out DESC, name ASC
            ), '[]'::jsonb)
            FROM opponents
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

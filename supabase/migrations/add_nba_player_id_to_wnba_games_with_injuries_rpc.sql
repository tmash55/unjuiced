-- Add nba_player_id to get_wnba_player_games_with_injuries response
--
-- Run this in Supabase SQL editor.
--
-- Adds nba_player_id (cdn.nba.com headshot ID) to each entry in the
-- teammates_out and opponents_out arrays. Uses the existing JOIN to
-- wnba_players_hr; no schema changes needed.

CREATE OR REPLACE FUNCTION public.get_wnba_player_games_with_injuries(
    p_player_id        BIGINT,
    p_season           TEXT   DEFAULT '2025',
    p_filter_player_id BIGINT DEFAULT NULL
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

    SELECT jsonb_build_object(
        'player_id',        p_player_id,
        'team_id',          v_team_id,
        'season',           p_season,
        'filter_player_id', p_filter_player_id,
        'total_games',      COUNT(*),
        'games',            jsonb_agg(game_data ORDER BY game_date DESC)
    )
    INTO v_result
    FROM (
        SELECT
            bs.game_id,
            bs.game_date,
            bs.team_id,
            bs.opponent_team_id,
            bs.home_away,
            bs.pts, bs.reb, bs.ast, bs.fg3m, bs.stl, bs.blk, bs.tov,
            bs.fgm, bs.fga, bs.minutes,
            (bs.pts + bs.reb + bs.ast) AS pra,
            (bs.pts + bs.reb)          AS pr,
            (bs.pts + bs.ast)          AS pa,
            (bs.reb + bs.ast)          AS ra,
            (bs.blk + bs.stl)          AS bs_combo,
            CASE
                WHEN g.home_team_id = bs.team_id THEN
                    CASE WHEN g.home_team_score > g.away_team_score THEN 'W' ELSE 'L' END
                ELSE
                    CASE WHEN g.away_team_score > g.home_team_score THEN 'W' ELSE 'L' END
            END AS result,
            jsonb_build_object(
                'game_id',          bs.game_id,
                'game_date',        bs.game_date,
                'opponent_team_id', bs.opponent_team_id,
                'home_away',        bs.home_away,
                'result', CASE
                    WHEN g.home_team_id = bs.team_id THEN
                        CASE WHEN g.home_team_score > g.away_team_score THEN 'W' ELSE 'L' END
                    ELSE
                        CASE WHEN g.away_team_score > g.home_team_score THEN 'W' ELSE 'L' END
                END,
                'pts', bs.pts, 'reb', bs.reb, 'ast', bs.ast, 'fg3m', bs.fg3m,
                'stl', bs.stl, 'blk', bs.blk, 'tov', bs.tov,
                'fgm', bs.fgm, 'fga', bs.fga, 'minutes', bs.minutes,
                'pra', bs.pts + bs.reb + bs.ast,
                'pr',  bs.pts + bs.reb,
                'pa',  bs.pts + bs.ast,
                'ra',  bs.reb + bs.ast,
                'bs',  bs.blk + bs.stl,
                'teammates_out', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'player_id',     gpo.player_id,
                        'nba_player_id', p.nba_player_id,
                        'name',          p.name,
                        'position',      COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT),
                        'reason',        gpo.reason,
                        'avg_pts',       (SELECT ROUND(AVG(pts), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season)),
                        'avg_reb',       (SELECT ROUND(AVG(reb), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season)),
                        'avg_ast',       (SELECT ROUND(AVG(ast), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season))
                    )), '[]'::jsonb)
                    FROM wnba_game_players_out gpo
                    JOIN wnba_players_hr p ON p.wnba_player_id = gpo.player_id
                    WHERE gpo.game_id = bs.game_id
                      AND gpo.team_id = bs.team_id
                ),
                'opponents_out', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'player_id',     gpo.player_id,
                        'nba_player_id', p.nba_player_id,
                        'name',          p.name,
                        'position',      COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT),
                        'reason',        gpo.reason,
                        'avg_pts',       (SELECT ROUND(AVG(pts), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season)),
                        'avg_reb',       (SELECT ROUND(AVG(reb), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season)),
                        'avg_ast',       (SELECT ROUND(AVG(ast), 1) FROM wnba_player_box_scores
                                          WHERE player_id = gpo.player_id
                                            AND (p_season IS NULL OR season = p_season))
                    )), '[]'::jsonb)
                    FROM wnba_game_players_out gpo
                    JOIN wnba_players_hr p ON p.wnba_player_id = gpo.player_id
                    WHERE gpo.game_id = bs.game_id
                      AND gpo.team_id = bs.opponent_team_id
                )
            ) AS game_data
        FROM wnba_player_box_scores bs
        LEFT JOIN wnba_games_hr g ON g.game_id = bs.game_id
        WHERE bs.player_id = p_player_id
          AND (p_season IS NULL OR bs.season = p_season)
          AND bs.season_type != 'Preseason'
          AND (
              p_filter_player_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM wnba_game_players_out gpo
                  WHERE gpo.game_id   = bs.game_id
                    AND gpo.player_id = p_filter_player_id
              )
          )
    ) subq;

    RETURN v_result;
END;
$$;

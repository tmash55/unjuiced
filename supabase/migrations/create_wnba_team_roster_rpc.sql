-- WNBA team roster RPC
--
-- Mirrors public.get_team_roster for the WNBA drilldown roster and injury
-- section. Uses current roster rows from wnba_players_hr and joins historical
-- box score averages for the requested season when available.

CREATE OR REPLACE FUNCTION public.get_wnba_team_roster(
    p_team_id INTEGER,
    p_season  TEXT DEFAULT '2025'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH player_season_stats AS (
        SELECT
            bs.player_id,
            COUNT(*) AS games_played,
            ROUND(AVG(bs.pts), 1) AS avg_points,
            ROUND(AVG(bs.reb), 1) AS avg_rebounds,
            ROUND(AVG(bs.ast), 1) AS avg_assists,
            ROUND(AVG(bs.fg3m), 1) AS avg_threes,
            ROUND(AVG(bs.blk), 1) AS avg_blocks,
            ROUND(AVG(bs.stl), 1) AS avg_steals,
            ROUND(AVG(bs.minutes), 1) AS avg_minutes,
            ROUND(AVG(bs.pts + bs.reb + bs.ast), 1) AS avg_pra,
            ROUND(AVG(bs.usage_pct), 1) AS avg_usage
        FROM wnba_player_box_scores bs
        WHERE (p_season IS NULL OR bs.season = p_season)
          AND bs.season_type != 'Preseason'
          AND bs.minutes IS NOT NULL
          AND bs.minutes > 0
          AND bs.player_id IN (
              SELECT wnba_player_id FROM wnba_players_hr WHERE team_id = p_team_id
          )
        GROUP BY bs.player_id
    )
    SELECT jsonb_build_object(
        'team_id', p_team_id,
        'team_abbr', t.abbreviation,
        'team_name', t.name,
        'player_count', (
            SELECT COUNT(*)
            FROM wnba_players_hr
            WHERE team_id = p_team_id
              AND status = 'active'
        ),
        'players', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'player_id', p.wnba_player_id,
                    'nba_player_id', p.nba_player_id,
                    'name', p.name,
                    'position', COALESCE(p.depth_chart_pos::TEXT, p.position::TEXT),
                    'jersey_number', p.jersey_number,
                    'injury_status', p.injury_status,
                    'injury_notes', p.injury_notes,
                    'games_played', COALESCE(s.games_played, 0),
                    'avg_points', COALESCE(s.avg_points, 0),
                    'avg_rebounds', COALESCE(s.avg_rebounds, 0),
                    'avg_assists', COALESCE(s.avg_assists, 0),
                    'avg_threes', COALESCE(s.avg_threes, 0),
                    'avg_blocks', COALESCE(s.avg_blocks, 0),
                    'avg_steals', COALESCE(s.avg_steals, 0),
                    'avg_minutes', COALESCE(s.avg_minutes, 0),
                    'avg_pra', COALESCE(s.avg_pra, 0),
                    'avg_usage', COALESCE(s.avg_usage, 0)
                )
                ORDER BY COALESCE(s.avg_minutes, 0) DESC, p.jersey_number NULLS LAST, p.name
            )
            FROM wnba_players_hr p
            LEFT JOIN player_season_stats s ON p.wnba_player_id = s.player_id
            WHERE p.team_id = p_team_id
              AND p.status = 'active'
        ), '[]'::jsonb)
    ) INTO result
    FROM wnba_teams t
    WHERE t.team_id = p_team_id;

    RETURN result;
END;
$$;

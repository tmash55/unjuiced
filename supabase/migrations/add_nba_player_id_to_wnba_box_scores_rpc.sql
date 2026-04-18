-- Add nba_player_id to get_wnba_player_box_scores response
--
-- Run this in Supabase SQL editor.
--
-- Adds nba_player_id (the cdn.nba.com headshot ID) to the `player` object
-- in the response. Returns NULL for players whose nba_player_id hasn't been
-- backfilled yet (mostly 2025 rookies / international players).

CREATE OR REPLACE FUNCTION public.get_wnba_player_box_scores(
    p_player_id INTEGER,
    p_season    TEXT    DEFAULT '2025',
    p_limit     INTEGER DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    output_result jsonb;
BEGIN
    WITH player_info AS (
        SELECT
            p.wnba_player_id,
            p.nba_player_id,
            p.name,
            p.first_name,
            p.last_name,
            p.position,
            p.jersey_number,
            p.team_id,
            t.abbreviation AS team_abbr,
            t.name         AS team_name,
            p.injury_status,
            p.injury_notes
        FROM wnba_players_hr p
        LEFT JOIN wnba_teams t ON p.team_id = t.team_id
        WHERE p.wnba_player_id = p_player_id
    ),
    box_scores AS (
        SELECT
            bs.game_id,
            bs.game_date,
            bs.season,
            bs.season_type,
            bs.home_away,
            bs.opponent_team_id,
            opp.abbreviation AS opponent_abbr,
            opp.name         AS opponent_name,
            bs.minutes, bs.pts, bs.reb, bs.ast, bs.stl, bs.blk, bs.tov, bs.fouls,
            bs.fgm, bs.fga, bs.fg_pct,
            bs.fg3m, bs.fg3a, bs.fg3_pct,
            bs.ftm, bs.fta, bs.ft_pct,
            bs.oreb, bs.dreb,
            bs.plus_minus, bs.usage_pct, bs.ts_pct, bs.efg_pct,
            bs.off_rating, bs.def_rating, bs.net_rating, bs.pace, bs.pie,
            bs.passes, bs.potential_off_reb, bs.potential_def_reb, bs.potential_reb,
            (bs.pts + bs.reb + bs.ast) AS pra,
            (bs.pts + bs.reb)          AS pr,
            (bs.pts + bs.ast)          AS pa,
            (bs.reb + bs.ast)          AS ra,
            (bs.blk + bs.stl)          AS bs_combo,
            g.home_team_score,
            g.away_team_score,
            CASE
                WHEN bs.home_away = 'H' THEN
                    CASE WHEN g.home_team_score > g.away_team_score THEN 'W' ELSE 'L' END
                ELSE
                    CASE WHEN g.away_team_score > g.home_team_score THEN 'W' ELSE 'L' END
            END AS game_result,
            CASE
                WHEN bs.home_away = 'H' THEN g.home_team_score - g.away_team_score
                ELSE g.away_team_score - g.home_team_score
            END AS margin
        FROM wnba_player_box_scores bs
        LEFT JOIN wnba_teams opp ON bs.opponent_team_id = opp.team_id
        LEFT JOIN wnba_games_hr g ON bs.game_id = g.game_id
        WHERE bs.player_id = p_player_id
          AND (p_season IS NULL OR bs.season = p_season)
          AND bs.season_type != 'Preseason'
        ORDER BY bs.game_date DESC
        LIMIT p_limit
    ),
    season_totals AS (
        SELECT
            COUNT(*)                                                    AS games_played,
            ROUND(AVG(pts), 1)                                          AS avg_points,
            ROUND(AVG(reb), 1)                                          AS avg_rebounds,
            ROUND(AVG(ast), 1)                                          AS avg_assists,
            ROUND(AVG(stl), 1)                                          AS avg_steals,
            ROUND(AVG(blk), 1)                                          AS avg_blocks,
            ROUND(AVG(fg3m), 1)                                         AS avg_threes,
            ROUND(AVG(minutes), 1)                                      AS avg_minutes,
            ROUND(AVG(pts + reb + ast), 1)                              AS avg_pra,
            ROUND(AVG(usage_pct), 1)                                    AS avg_usage,
            ROUND(SUM(fgm)::numeric  / NULLIF(SUM(fga), 0) * 100, 1)    AS fg_pct,
            ROUND(SUM(fg3m)::numeric / NULLIF(SUM(fg3a), 0) * 100, 1)   AS fg3_pct,
            ROUND(SUM(ftm)::numeric  / NULLIF(SUM(fta), 0) * 100, 1)    AS ft_pct,
            SUM(CASE WHEN game_result = 'W' THEN 1 ELSE 0 END)          AS wins,
            SUM(CASE WHEN game_result = 'L' THEN 1 ELSE 0 END)          AS losses
        FROM box_scores
    )
    SELECT jsonb_build_object(
        'player', (
            SELECT jsonb_build_object(
                'player_id',     wnba_player_id,
                'nba_player_id', nba_player_id,
                'name',          name,
                'first_name',    first_name,
                'last_name',     last_name,
                'position',      position,
                'jersey_number', jersey_number,
                'team_id',       team_id,
                'team_abbr',     team_abbr,
                'team_name',     team_name,
                'injury_status', injury_status,
                'injury_notes',  injury_notes
            )
            FROM player_info
        ),
        'season', p_season,
        'season_summary', (
            SELECT jsonb_build_object(
                'games_played', games_played,
                'record',       wins || '-' || losses,
                'avg_points',   avg_points,
                'avg_rebounds', avg_rebounds,
                'avg_assists',  avg_assists,
                'avg_steals',   avg_steals,
                'avg_blocks',   avg_blocks,
                'avg_threes',   avg_threes,
                'avg_minutes',  avg_minutes,
                'avg_pra',      avg_pra,
                'avg_usage',    avg_usage,
                'fg_pct',       fg_pct,
                'fg3_pct',      fg3_pct,
                'ft_pct',       ft_pct
            )
            FROM season_totals
        ),
        'games', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'game_id',         game_id,
                    'date',            game_date,
                    'season_type',     season_type,
                    'home_away',       home_away,
                    'opponent_team_id',opponent_team_id,
                    'opponent_abbr',   opponent_abbr,
                    'opponent_name',   opponent_name,
                    'result',          game_result,
                    'margin',          margin,
                    'team_score',      CASE WHEN home_away = 'H' THEN home_team_score ELSE away_team_score END,
                    'opponent_score',  CASE WHEN home_away = 'H' THEN away_team_score ELSE home_team_score END,
                    'minutes', minutes, 'pts', pts, 'reb', reb, 'ast', ast,
                    'stl', stl, 'blk', blk, 'tov', tov, 'fouls', fouls,
                    'fgm', fgm, 'fga', fga, 'fg_pct', fg_pct,
                    'fg3m', fg3m, 'fg3a', fg3a, 'fg3_pct', fg3_pct,
                    'ftm', ftm, 'fta', fta, 'ft_pct', ft_pct,
                    'oreb', oreb, 'dreb', dreb,
                    'plus_minus', plus_minus, 'usage_pct', usage_pct,
                    'ts_pct', ts_pct, 'efg_pct', efg_pct,
                    'off_rating', off_rating, 'def_rating', def_rating,
                    'net_rating', net_rating, 'pace', pace, 'pie', pie,
                    'passes', passes, 'potential_reb', potential_reb,
                    'pra', pra, 'pr', pr, 'pa', pa, 'ra', ra, 'bs', bs_combo
                )
                ORDER BY game_date DESC
            )
            FROM box_scores
        ), '[]'::jsonb)
    ) INTO output_result;

    RETURN output_result;
END;
$$;

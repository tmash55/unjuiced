-- WNBA shot-zone matchup data.
--
-- Mirrors the NBA get_shot_zone_matchup RPC response shape while reading
-- WNBA player and team defense shot-zone tables.

CREATE OR REPLACE FUNCTION public.get_wnba_shot_zone_matchup(
    p_player_id BIGINT,
    p_opponent_team_id BIGINT,
    p_season TEXT DEFAULT '2025'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_name TEXT;
    v_player_team_id BIGINT;
    v_player_team_name TEXT;
    v_player_team_abbr TEXT;
    v_opponent_team_name TEXT;
    v_opponent_team_abbr TEXT;
    v_result JSONB;
    v_zones JSONB[] := '{}';
    v_total_points INT := 0;
    v_total_teams INT := 13;
    v_tough_max INT;
    v_neutral_max INT;
    v_favorable_zones INT := 0;
    v_tough_zones INT := 0;
    v_favorable_pct_of_points NUMERIC := 0;
    v_neutral_pct_of_points NUMERIC := 0;
    v_tough_pct_of_points NUMERIC := 0;
    r RECORD;
BEGIN
    SELECT p.name, p.team_id, t.name, t.abbreviation
    INTO v_player_name, v_player_team_id, v_player_team_name, v_player_team_abbr
    FROM wnba_players_hr p
    LEFT JOIN wnba_teams t ON t.team_id = p.team_id
    WHERE p.wnba_player_id = p_player_id;

    IF v_player_name IS NULL THEN
        RETURN jsonb_build_object('error', 'Player not found');
    END IF;

    SELECT name, abbreviation
    INTO v_opponent_team_name, v_opponent_team_abbr
    FROM wnba_teams
    WHERE team_id = p_opponent_team_id;

    IF v_opponent_team_name IS NULL THEN
        RETURN jsonb_build_object('error', 'Opponent team not found');
    END IF;

    SELECT COALESCE(SUM(points), 0)
    INTO v_total_points
    FROM wnba_player_shot_zones
    WHERE player_id = p_player_id AND season = p_season;

    SELECT COALESCE(COUNT(DISTINCT team_id), 13)
    INTO v_total_teams
    FROM wnba_team_defense_shot_zones
    WHERE season = p_season;

    IF v_total_teams < 1 THEN
        v_total_teams := 13;
    END IF;

    v_tough_max := CEIL(v_total_teams / 3.0)::INT;
    v_neutral_max := CEIL((v_total_teams * 2) / 3.0)::INT;

    FOR r IN (
        SELECT
            psz.zone,
            psz.fgm,
            psz.fga,
            psz.fg_pct AS player_fg_pct,
            psz.points,
            psz.pct_of_total,
            tdsz.opp_fg_pct,
            tdsz.rank AS opponent_def_rank
        FROM wnba_player_shot_zones psz
        LEFT JOIN wnba_team_defense_shot_zones tdsz
            ON tdsz.team_id = p_opponent_team_id
            AND tdsz.season = psz.season
            AND tdsz.zone = psz.zone
        WHERE psz.player_id = p_player_id
          AND psz.season = p_season
          AND psz.fga > 0
        ORDER BY psz.pct_of_total DESC
    ) LOOP
        DECLARE
            v_matchup_rating TEXT;
            v_matchup_color TEXT;
            v_display_name TEXT;
        BEGIN
            IF r.opponent_def_rank IS NULL THEN
                v_matchup_rating := 'N/A';
                v_matchup_color := 'gray';
            ELSIF r.opponent_def_rank <= v_tough_max THEN
                v_matchup_rating := 'tough';
                v_matchup_color := 'red';
                v_tough_zones := v_tough_zones + 1;
                v_tough_pct_of_points := v_tough_pct_of_points + COALESCE(r.pct_of_total, 0);
            ELSIF r.opponent_def_rank > v_neutral_max THEN
                v_matchup_rating := 'favorable';
                v_matchup_color := 'green';
                v_favorable_zones := v_favorable_zones + 1;
                v_favorable_pct_of_points := v_favorable_pct_of_points + COALESCE(r.pct_of_total, 0);
            ELSE
                v_matchup_rating := 'neutral';
                v_matchup_color := 'yellow';
                v_neutral_pct_of_points := v_neutral_pct_of_points + COALESCE(r.pct_of_total, 0);
            END IF;

            v_display_name := CASE
                WHEN r.zone = 'In The Paint (Non-RA)' THEN 'In The Paint'
                WHEN r.zone = 'Above the Break 3' THEN 'Above Break 3'
                ELSE r.zone
            END;

            v_zones := array_append(v_zones, jsonb_build_object(
                'zone', r.zone,
                'display_name', v_display_name,
                'player_fgm', r.fgm,
                'player_fga', r.fga,
                'player_fg_pct', r.player_fg_pct,
                'player_points', r.points,
                'player_pct_of_total', r.pct_of_total,
                'opponent_def_rank', r.opponent_def_rank,
                'opponent_opp_fg_pct', r.opp_fg_pct,
                'matchup_rating', v_matchup_rating,
                'matchup_color', v_matchup_color
            ));
        END;
    END LOOP;

    v_result := jsonb_build_object(
        'player', jsonb_build_object(
            'id', p_player_id,
            'name', v_player_name,
            'team_id', v_player_team_id,
            'team_name', v_player_team_name,
            'team_abbr', v_player_team_abbr,
            'total_points', v_total_points,
            'season', p_season
        ),
        'opponent', jsonb_build_object(
            'team_id', p_opponent_team_id,
            'team_name', v_opponent_team_name,
            'team_abbr', v_opponent_team_abbr
        ),
        'zones', v_zones,
        'summary', jsonb_build_object(
            'total_zones_shown', COALESCE(array_length(v_zones, 1), 0),
            'total_teams', v_total_teams,
            'tough_max_rank', v_tough_max,
            'neutral_max_rank', v_neutral_max,
            'favorable_zones', v_favorable_zones,
            'neutral_zones', COALESCE(array_length(v_zones, 1), 0) - v_favorable_zones - v_tough_zones,
            'tough_zones', v_tough_zones,
            'favorable_pct_of_points', ROUND(v_favorable_pct_of_points, 1),
            'neutral_pct_of_points', ROUND(v_neutral_pct_of_points, 1),
            'tough_pct_of_points', ROUND(v_tough_pct_of_points, 1)
        ),
        'methodology', jsonb_build_object(
            'data_source', 'Official WNBA shot-zone data',
            'defense_ranking', 'Teams ranked by opponent FG% allowed per zone. Rank 1 = best defense (lowest FG% allowed).',
            'matchup_ratings', 'League-adjusted thirds: low ranks = Tough, middle ranks = Neutral, high ranks = Favorable.'
        )
    );

    RETURN v_result;
END;
$$;

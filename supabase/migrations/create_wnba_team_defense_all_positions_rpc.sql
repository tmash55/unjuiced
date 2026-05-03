-- WNBA defensive analysis by position bucket.
--
-- Mirrors the NBA defensive analysis RPC, but reads the WNBA summary table
-- where positions are stored as G, F, and C.

CREATE OR REPLACE FUNCTION public.get_wnba_team_defense_all_positions(
    p_team_id BIGINT,
    p_season  TEXT DEFAULT '2025'
)
RETURNS TABLE(
    team_id BIGINT,
    team_abbr TEXT,
    team_name TEXT,
    def_position TEXT,
    total_teams INTEGER,
    games INTEGER,
    pts_avg NUMERIC,
    pts_rank INTEGER,
    reb_avg NUMERIC,
    reb_rank INTEGER,
    ast_avg NUMERIC,
    ast_rank INTEGER,
    fg3m_avg NUMERIC,
    fg3m_rank INTEGER,
    stl_avg NUMERIC,
    stl_rank INTEGER,
    blk_avg NUMERIC,
    blk_rank INTEGER,
    pra_avg NUMERIC,
    pra_rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ranked AS (
        SELECT
            d.*,
            COUNT(*) OVER (PARTITION BY d.position)::INTEGER AS total_teams
        FROM wnba_team_defense_by_position d
        WHERE d.season = p_season
    )
    SELECT
        r.team_id::BIGINT,
        r.team_abbr,
        r.team_name,
        r.position,
        r.total_teams,
        r.games,
        r.pts_avg,
        r.pts_rank,
        r.reb_avg,
        r.reb_rank,
        r.ast_avg,
        r.ast_rank,
        r.fg3m_avg,
        r.fg3m_rank,
        r.stl_avg,
        r.stl_rank,
        r.blk_avg,
        r.blk_rank,
        r.pra_avg,
        r.pra_rank
    FROM ranked r
    WHERE r.team_id = p_team_id
    ORDER BY
        CASE r.position
            WHEN 'G' THEN 1
            WHEN 'F' THEN 2
            WHEN 'C' THEN 3
            ELSE 4
        END;
END;
$$;

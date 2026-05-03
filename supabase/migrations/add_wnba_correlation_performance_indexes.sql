CREATE INDEX IF NOT EXISTS idx_wnba_box_scores_player_season_date
ON public.wnba_player_box_scores (player_id, season, game_date DESC)
WHERE season_type <> 'Preseason' AND minutes > 0;

CREATE INDEX IF NOT EXISTS idx_wnba_box_scores_team_season_game
ON public.wnba_player_box_scores (team_id, season, game_id)
WHERE season_type <> 'Preseason' AND minutes > 5;

export interface SportMarket {
    value: string;
    label: string;
    apiKey: string; // The key used in the API request
    hasAlternates?: boolean; // Indicates if this market has alternate lines
    alternateKey?: string; // The API key for alternate lines
    alwaysFetchAlternate?: boolean; // Indicates if we should always fetch both standard and alternate markets
    // Optional metadata for grouping/filtering in UI
    group?: string; // e.g., 'Passing', 'Receiving', 'Rushing', 'Kicking', 'Defense', 'Scoring', 'Combo'
    period?: 'full' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h' | 'both_halves' | 'p1' | 'p2' | 'p3';
    periodLabel?: string; // e.g., '1Q', '1H', 'Both Halves', 'P1', 'P2', 'P3'
    singleLine?: boolean; // True for markets with no over/under (e.g., Anytime TD, First Goalscorer, Double Double)
  }
  
  export interface SportMarkets {
    [key: string]: SportMarket[];
  }
  
  // =============================================================================
  // BASKETBALL MARKETS (NBA, NCAAB, WNBA)
  // Keys are standardized to match Redis data feed format
  // =============================================================================
  const BASKETBALL_MARKETS: SportMarket[] = [
    // -------------------------------------------------------------------------
    // GAME MARKETS - Full Game
    // -------------------------------------------------------------------------
    { value: "game_moneyline", label: "Moneyline", apiKey: "game_moneyline", group: "Game", period: 'full' },
    { value: "game_spread", label: "Point Spread", apiKey: "game_spread", group: "Game", period: 'full' },
    { value: "total_points", label: "Total Points", apiKey: "total_points", group: "Game", period: 'full' },
    { value: "team_total", label: "Team Total", apiKey: "team_total", group: "Game", period: 'full' },
    { value: "total_points_odd_even", label: "Total Points Odd/Even", apiKey: "total_points_odd_even", group: "Game", period: 'full' },
    { value: "overtime", label: "Overtime?", apiKey: "overtime", group: "Game", period: 'full', singleLine: true },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 1st Half
    // -------------------------------------------------------------------------
    { value: "game_1h_moneyline", label: "1st Half Moneyline", apiKey: "game_1h_moneyline", group: "1st Half", period: '1h' },
    { value: "1st_half_point_spread", label: "1st Half Spread", apiKey: "1st_half_point_spread", group: "1st Half", period: '1h' },
    { value: "1st_half_total_points", label: "1st Half Total", apiKey: "1st_half_total_points", group: "1st Half", period: '1h' },
    { value: "1st_half_moneyline_3_way", label: "1st Half ML 3-Way", apiKey: "1st_half_moneyline_3_way", group: "1st Half", period: '1h' },
    { value: "1st_half_home_team_total_points", label: "1st Half Home Total", apiKey: "1st_half_home_team_total_points", group: "1st Half", period: '1h' },
    { value: "1st_half_away_team_total_points", label: "1st Half Away Total", apiKey: "1st_half_away_team_total_points", group: "1st Half", period: '1h' },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 2nd Half
    // -------------------------------------------------------------------------
    { value: "2nd_half_moneyline", label: "2nd Half Moneyline", apiKey: "2nd_half_moneyline", group: "2nd Half", period: '2h' },
    { value: "2nd_half_point_spread", label: "2nd Half Spread", apiKey: "2nd_half_point_spread", group: "2nd Half", period: '2h' },
    { value: "2nd_half_total_points", label: "2nd Half Total", apiKey: "2nd_half_total_points", group: "2nd Half", period: '2h' },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 1st Quarter
    // -------------------------------------------------------------------------
    { value: "game_1q_moneyline", label: "1st Quarter Moneyline", apiKey: "game_1q_moneyline", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_point_spread", label: "1st Quarter Spread", apiKey: "1st_quarter_point_spread", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_total_points", label: "1st Quarter Total", apiKey: "1st_quarter_total_points", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_moneyline_3_way", label: "1st Quarter ML 3-Way", apiKey: "1st_quarter_moneyline_3_way", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_last_team_to_score", label: "1st Quarter Last Team to Score", apiKey: "1st_quarter_last_team_to_score", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_home_team_total_points", label: "1st Quarter Home Total", apiKey: "1st_quarter_home_team_total_points", group: "1st Quarter", period: '1q' },
    { value: "1st_quarter_away_team_total_points", label: "1st Quarter Away Total", apiKey: "1st_quarter_away_team_total_points", group: "1st Quarter", period: '1q' },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 2nd Quarter
    // -------------------------------------------------------------------------
    { value: "2nd_quarter_moneyline", label: "2nd Quarter Moneyline", apiKey: "2nd_quarter_moneyline", group: "2nd Quarter", period: '2q' },
    { value: "2nd_quarter_point_spread", label: "2nd Quarter Spread", apiKey: "2nd_quarter_point_spread", group: "2nd Quarter", period: '2q' },
    { value: "2nd_quarter_total_points", label: "2nd Quarter Total", apiKey: "2nd_quarter_total_points", group: "2nd Quarter", period: '2q' },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 3rd Quarter
    // -------------------------------------------------------------------------
    { value: "3rd_quarter_moneyline", label: "3rd Quarter Moneyline", apiKey: "3rd_quarter_moneyline", group: "3rd Quarter", period: '3q' },
    { value: "3rd_quarter_point_spread", label: "3rd Quarter Spread", apiKey: "3rd_quarter_point_spread", group: "3rd Quarter", period: '3q' },
    { value: "3rd_quarter_total_points", label: "3rd Quarter Total", apiKey: "3rd_quarter_total_points", group: "3rd Quarter", period: '3q' },
    
    // -------------------------------------------------------------------------
    // GAME MARKETS - 4th Quarter
    // -------------------------------------------------------------------------
    { value: "4th_quarter_moneyline", label: "4th Quarter Moneyline", apiKey: "4th_quarter_moneyline", group: "4th Quarter", period: '4q' },
    { value: "4th_quarter_point_spread", label: "4th Quarter Spread", apiKey: "4th_quarter_point_spread", group: "4th Quarter", period: '4q' },
    { value: "4th_quarter_total_points", label: "4th Quarter Total", apiKey: "4th_quarter_total_points", group: "4th Quarter", period: '4q' },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - Core Stats (Over/Under)
    // -------------------------------------------------------------------------
    {
      value: "player_points",
      label: "Points",
      apiKey: "player_points",
      hasAlternates: true,
      alternateKey: "player_points_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "player_rebounds",
      label: "Rebounds",
      apiKey: "player_rebounds",
      hasAlternates: true,
      alternateKey: "player_rebounds_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "player_assists",
      label: "Assists",
      apiKey: "player_assists",
      hasAlternates: true,
      alternateKey: "player_assists_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "player_threes_made",
      label: "3-Pointers",
      apiKey: "player_threes_made",
      hasAlternates: true,
      alternateKey: "player_threes_made_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "player_fgm",
      label: "Field Goals Made",
      apiKey: "player_fgm",
      hasAlternates: true,
      alternateKey: "player_fgm_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - Combo Stats (Over/Under)
    // -------------------------------------------------------------------------
    {
      value: "player_pra",
      label: "Pts+Reb+Ast",
      apiKey: "player_pra",
      hasAlternates: true,
      alternateKey: "player_pra_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "player_pr",
      label: "Pts+Reb",
      apiKey: "player_pr",
      hasAlternates: true,
      alternateKey: "player_pr_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "player_pa",
      label: "Pts+Ast",
      apiKey: "player_pa",
      hasAlternates: true,
      alternateKey: "player_pa_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "player_ra",
      label: "Reb+Ast",
      apiKey: "player_ra",
      hasAlternates: true,
      alternateKey: "player_ra_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "player_double_double",
      label: "Double Double",
      apiKey: "player_double_double",
      group: "Combo",
      period: 'full',
      singleLine: true,
    },
    {
      value: "player_triple_double",
      label: "Triple Double",
      apiKey: "player_triple_double",
      group: "Combo",
      period: 'full',
      singleLine: true,
    },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - Defense (Over/Under)
    // -------------------------------------------------------------------------
    {
      value: "player_blocks",
      label: "Blocks",
      apiKey: "player_blocks",
      hasAlternates: true,
      alternateKey: "player_blocks_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    {
      value: "player_steals",
      label: "Steals",
      apiKey: "player_steals",
      hasAlternates: true,
      alternateKey: "player_steals_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    {
      value: "player_bs",
      label: "Blocks+Steals",
      apiKey: "player_bs",
      group: "Defense",
      period: 'full',
    },
    {
      value: "player_turnovers",
      label: "Turnovers",
      apiKey: "player_turnovers",
      hasAlternates: true,
      alternateKey: "player_turnovers_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - First Basket / Scoring (Single Line)
    // -------------------------------------------------------------------------
    {
      value: "first_field_goal",
      label: "1st Basket (Game)",
      apiKey: "first_field_goal",
      group: "First Basket",
      period: 'full',
      singleLine: true,
    },
    {
      value: "team_first_basket",
      label: "1st Basket (Team)",
      apiKey: "team_first_basket",
      group: "First Basket",
      period: 'full',
      singleLine: true,
    },
    {
      value: "home_team_first_field_goal",
      label: "Home Team First Basket",
      apiKey: "home_team_first_field_goal",
      group: "First Basket",
      period: 'full',
      singleLine: true,
    },
    {
      value: "away_team_first_field_goal",
      label: "Away Team First Basket",
      apiKey: "away_team_first_field_goal",
      group: "First Basket",
      period: 'full',
      singleLine: true,
    },
    {
      value: "top_points_scorer",
      label: "Top Points Scorer",
      apiKey: "top_points_scorer",
      group: "Scoring",
      period: 'full',
      singleLine: true,
    },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - 1st Quarter (Over/Under)
    // -------------------------------------------------------------------------
    {
      value: "1st_quarter_player_points",
      label: "Points (1Q)",
      apiKey: "1st_quarter_player_points",
      hasAlternates: true,
      alternateKey: "1st_quarter_player_points_alternate",
      alwaysFetchAlternate: true,
      group: "1st Quarter",
      period: '1q',
    },
    {
      value: "1st_quarter_player_assists",
      label: "Assists (1Q)",
      apiKey: "1st_quarter_player_assists",
      hasAlternates: true,
      alternateKey: "1st_quarter_player_assists_alternate",
      alwaysFetchAlternate: true,
      group: "1st Quarter",
      period: '1q',
    },
    {
      value: "1st_quarter_player_rebounds",
      label: "Rebounds (1Q)",
      apiKey: "1st_quarter_player_rebounds",
      hasAlternates: true,
      alternateKey: "1st_quarter_player_rebounds_alternate",
      alwaysFetchAlternate: true,
      group: "1st Quarter",
      period: '1q',
    },
    
    // -------------------------------------------------------------------------
    // PLAYER PROPS - 1st 3 Minutes (Single Line - Yes/No)
    // -------------------------------------------------------------------------
    {
      value: "1st_3_minutes_player_points",
      label: "Points (1st 3 Min)",
      apiKey: "1st_3_minutes_player_points",
      group: "1st 3 Minutes",
      period: '1q',
      singleLine: true,
    },
    {
      value: "1st_3_minutes_player_assists",
      label: "Assists (1st 3 Min)",
      apiKey: "1st_3_minutes_player_assists",
      group: "1st 3 Minutes",
      period: '1q',
      singleLine: true,
    },
    {
      value: "1st_3_minutes_player_rebounds",
      label: "Rebounds (1st 3 Min)",
      apiKey: "1st_3_minutes_player_rebounds",
      group: "1st 3 Minutes",
      period: '1q',
      singleLine: true,
    },
  ];
  
  const FOOTBALL_MARKETS: SportMarket[] = [
    // Game-level markets
    { value: "moneyline", label: "Moneyline", apiKey: "moneyline", group: "Game", period: 'full' },
    { value: "spread", label: "Point Spread", apiKey: "spread", group: "Game", period: 'full' },
    { value: "total", label: "Total Points", apiKey: "total", group: "Game", period: 'full' },
    
    // Team Totals
    { value: "home_total", label: "Home Team Total", apiKey: "home_total", group: "Team Totals", period: 'full' },
    { value: "away_total", label: "Away Team Total", apiKey: "away_total", group: "Team Totals", period: 'full' },
    { value: "1st_half_home_team_total_points", label: "Home Team Total (1H)", apiKey: "1st_half_home_team_total_points", group: "Team Totals", period: '1h' },
    { value: "1st_half_away_team_total_points", label: "Away Team Total (1H)", apiKey: "1st_half_away_team_total_points", group: "Team Totals", period: '1h' },
    
    // Halves/Quarters
    { value: "1h_total", label: "1st Half Total", apiKey: "1h_total", group: "Halves", period: '1h' },
    { value: "2h_total", label: "2nd Half Total", apiKey: "2h_total", group: "Halves", period: '2h' },
    { value: "1q_total", label: "1st Quarter Total", apiKey: "1q_total", group: "Quarters", period: '1q' },
    
    // Touchdowns
    { value: "total_touchdowns", label: "Total Touchdowns", apiKey: "total_touchdowns", group: "Touchdowns", period: 'full' },
    { value: "1st_half_total_touchdowns", label: "Total TDs (1H)", apiKey: "1st_half_total_touchdowns", group: "Touchdowns", period: '1h' },
    { value: "2nd_half_total_touchdowns", label: "Total TDs (2H)", apiKey: "2nd_half_total_touchdowns", group: "Touchdowns", period: '2h' },
    { value: "1st_quarter_total_touchdowns", label: "Total TDs (1Q)", apiKey: "1st_quarter_total_touchdowns", group: "Touchdowns", period: '1q' },
    { value: "1st_half_home_team_total_touchdowns", label: "Home Team TDs (1H)", apiKey: "1st_half_home_team_total_touchdowns", group: "Touchdowns", period: '1h' },
    { value: "1st_half_away_team_total_touchdowns", label: "Away Team TDs (1H)", apiKey: "1st_half_away_team_total_touchdowns", group: "Touchdowns", period: '1h' },
    
   
    
    // Special Plays
    { value: "safety", label: "Safety", apiKey: "safety", group: "Special", period: 'full' },
    { value: "home_safety", label: "Home Team Safety", apiKey: "home_safety", group: "Special", period: 'full' },
    { value: "away_safety", label: "Away Team Safety", apiKey: "away_safety", group: "Special", period: 'full' },
    { value: "overtime", label: "Overtime", apiKey: "overtime", group: "Special", period: 'full', singleLine: true },
    
    // Other
    { value: "total_punts", label: "Total Punts", apiKey: "total_punts", group: "Other", period: 'full' },
    { value: "largest_lead", label: "Largest Lead", apiKey: "largest_lead", group: "Other", period: 'full' },
    { value: "first_score_yards", label: "First Score Yards", apiKey: "first_score_yards", group: "Other", period: 'full' },
  
    // Player props - Most Popular Markets First
    // Top Scoring Markets
    { value: "player_touchdowns", label: "Anytime TD", apiKey: "player_touchdowns", group: "Scoring", period: 'full', singleLine: true },
    { value: "first_td", label: "1st TD", apiKey: "first_td", group: "Scoring", period: 'full', singleLine: true },
    { value: "last_td", label: "Last TD", apiKey: "last_td", group: "Scoring", period: 'full', singleLine: true },
    
    // Top Passing Markets
    { value: "passing_yards", label: "Passing Yards", apiKey: "passing_yards", group: "Passing", period: 'full', hasAlternates: true },
    { value: "passing_tds", label: "Passing Touchdowns", apiKey: "passing_tds", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_completions", label: "Pass Completions", apiKey: "pass_completions", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_attempts", label: "Pass Attempts", apiKey: "pass_attempts", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_interceptions", label: "Interceptions Thrown", apiKey: "pass_interceptions", group: "Passing", period: 'full', hasAlternates: true },
    { value: "longest_pass", label: "Longest Pass Completion", apiKey: "longest_pass", group: "Passing", period: 'full' },
    
    // Top Receiving Markets
    { value: "receiving_yards", label: "Receiving Yards", apiKey: "receiving_yards", group: "Receiving", period: 'full', hasAlternates: true },
    { value: "receptions", label: "Receptions", apiKey: "receptions", group: "Receiving", period: 'full', hasAlternates: true },
    { value: "longest_reception", label: "Longest Reception", apiKey: "longest_reception", group: "Receiving", period: 'full' },
    
    // Top Rushing Markets
    { value: "rushing_yards", label: "Rushing Yards", apiKey: "rushing_yards", group: "Rushing", period: 'full', hasAlternates: true },
    { value: "rush_attempts", label: "Rush Attempts", apiKey: "rush_attempts", group: "Rushing", period: 'full', hasAlternates: true },
    { value: "longest_rush", label: "Longest Rush", apiKey: "longest_rush", group: "Rushing", period: 'full' },
    
    // Combo Markets
    { value: "pass_rush_yards", label: "Pass + Rush Yards", apiKey: "pass_rush_yards", group: "Combo", period: 'full', hasAlternates: true, alternateKey: "pass_rush_yards_alternate", alwaysFetchAlternate: true },
    { value: "rush_rec_yards", label: "Rush + Reception Yards", apiKey: "rush_rec_yards", group: "Combo", period: 'full', hasAlternates: true, alternateKey: "rush_rec_yards_alternate", alwaysFetchAlternate: true },
    
    // Quarter Markets - Passing
    { value: "1q_passing_yards", label: "Passing Yards (1Q)", apiKey: "1q_passing_yards", group: "Passing", period: '1q', hasAlternates: true, alternateKey: "1q_passing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_quarter_player_passing_yards", label: "Passing Yards (1Q)", apiKey: "1st_quarter_player_passing_yards", group: "Passing", period: '1q', hasAlternates: true },
    { value: "1st_quarter_passing_completions", label: "Pass Completions (1Q)", apiKey: "1st_quarter_passing_completions", group: "Passing", period: '1q', hasAlternates: true, alternateKey: "1st_quarter_passing_completions_alternate", alwaysFetchAlternate: true },
    { value: "1q_pass_attempts", label: "Pass Attempts (1Q)", apiKey: "1q_pass_attempts", group: "Passing", period: '1q', hasAlternates: true, alternateKey: "1q_pass_attempts_alternate", alwaysFetchAlternate: true },
    { value: "1st_quarter_player_passing_+_rushing_yards", label: "Pass + Rush Yards (1Q)", apiKey: "1st_quarter_player_passing_+_rushing_yards", group: "Combo", period: '1q', hasAlternates: true, alternateKey: "1st_quarter_player_passing_+_rushing_yards_alternate", alwaysFetchAlternate: true },
     // Field Goals & Kicking
     { value: "total_field_goals_made", label: "Total Field Goals Made", apiKey: "total_field_goals_made", group: "Field Goals", period: 'full' },
     { value: "1st_half_total_field_goals_made", label: "Total FGs Made (1H)", apiKey: "1st_half_total_field_goals_made", group: "Field Goals", period: '1h' },
     { value: "2nd_half_total_field_goals_made", label: "Total FGs Made (2H)", apiKey: "2nd_half_total_field_goals_made", group: "Field Goals", period: '2h' },
     { value: "total_field_goal_yards", label: "Total FG Yards", apiKey: "total_field_goal_yards", group: "Field Goals", period: 'full' },
     { value: "longest_field_goal_made_yards", label: "Longest FG Yards", apiKey: "longest_field_goal_made_yards", group: "Field Goals", period: 'full' },
     { value: "shortest_field_goal_made_yards", label: "Shortest FG Yards", apiKey: "shortest_field_goal_made_yards", group: "Field Goals", period: 'full' },
    
    // Quarter Markets - Receiving
    { value: "1q_receiving_yards", label: "Receiving Yards (1Q)", apiKey: "1q_receiving_yards", group: "Receiving", period: '1q', hasAlternates: true, alternateKey: "1q_receiving_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_quarter_player_receiving_yards", label: "Receiving Yards (1Q)", apiKey: "1st_quarter_player_receiving_yards", group: "Receiving", period: '1q', hasAlternates: true },
    { value: "1st_quarter_player_receptions", label: "Receptions (1Q)", apiKey: "1st_quarter_player_receptions", group: "Receiving", period: '1q', hasAlternates: true },
    
    // Quarter Markets - Rushing
    { value: "1q_rushing_yards", label: "Rushing Yards (1Q)", apiKey: "1q_rushing_yards", group: "Rushing", period: '1q', hasAlternates: true, alternateKey: "1q_rushing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_quarter_player_rushing_yards", label: "Rushing Yards (1Q)", apiKey: "1st_quarter_player_rushing_yards", group: "Rushing", period: '1q', hasAlternates: true },
    { value: "1q_rush_attempts", label: "Rush Attempts (1Q)", apiKey: "1q_rush_attempts", group: "Rushing", period: '1q', hasAlternates: true, alternateKey: "1q_rush_attempts_alternate", alwaysFetchAlternate: true },
    { value: "1st_quarter_player_rushing_attempts", label: "Rush Attempts (1Q)", apiKey: "1st_quarter_player_rushing_attempts", group: "Rushing", period: '1q', hasAlternates: true },
    
    // Half Markets - Passing
    { value: "1h_passing_yards", label: "Passing Yards (1H)", apiKey: "1h_passing_yards", group: "Passing", period: '1h', hasAlternates: true, alternateKey: "1h_passing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_half_player_passing_yards", label: "Passing Yards (1H)", apiKey: "1st_half_player_passing_yards", group: "Passing", period: '1h', hasAlternates: true },
    { value: "1st_half_player_passing_touchdowns", label: "Passing TDs (1H)", apiKey: "1st_half_player_passing_touchdowns", group: "Passing", period: '1h', hasAlternates: true, alternateKey: "1st_half_player_passing_touchdowns_alternate", alwaysFetchAlternate: true },
    
    // Half Markets - Receiving
    { value: "1st_half_player_receiving_yards", label: "Receiving Yards (1H)", apiKey: "1st_half_player_receiving_yards", group: "Receiving", period: '1h', hasAlternates: true, alternateKey: "1st_half_player_receiving_yards_alternate", alwaysFetchAlternate: true },
    
    // Half Markets - Rushing
    { value: "1h_rushing_yards", label: "Rushing Yards (1H)", apiKey: "1h_rushing_yards", group: "Rushing", period: '1h', hasAlternates: true, alternateKey: "1h_rushing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_half_player_rushing_yards", label: "Rushing Yards (1H)", apiKey: "1st_half_player_rushing_yards", group: "Rushing", period: '1h', hasAlternates: true },
    
    // Additional Scoring Markets
    { value: "1q_player_touchdowns", label: "Player Touchdowns (1Q)", apiKey: "1q_player_touchdowns", group: "Scoring", period: '1q', singleLine: true },
    { value: "1st_quarter_player_touchdowns", label: "Player Touchdowns (1Q)", apiKey: "1st_quarter_player_touchdowns", group: "Scoring", period: '1q', singleLine: true },
    { value: "1h_player_touchdowns", label: "Player Touchdowns (1H)", apiKey: "1h_player_touchdowns", group: "Scoring", period: '1h', singleLine: true },
    { value: "1st_half_player_touchdowns", label: "Player Touchdowns (1H)", apiKey: "1st_half_player_touchdowns", group: "Scoring", period: '1h', singleLine: true },
    { value: "2h_player_touchdowns", label: "Player Touchdowns (2H)", apiKey: "2h_player_touchdowns", group: "Scoring", period: '2h', singleLine: true },
    { value: "2nd_half_player_touchdowns", label: "Player Touchdowns (2H)", apiKey: "2nd_half_player_touchdowns", group: "Scoring", period: '2h', singleLine: true },
    { value: "2nd_half_first_touchdown_scorer", label: "First TD Scorer (2H)", apiKey: "2nd_half_first_touchdown_scorer", group: "Scoring", period: '2h', singleLine: true },
    { value: "3q_player_touchdowns", label: "Player Touchdowns (3Q)", apiKey: "3q_player_touchdowns", group: "Scoring", period: '3q', singleLine: true },
    { value: "both_halves_player_touchdowns", label: "Player TDs (Both Halves)", apiKey: "both_halves_player_touchdowns", group: "Scoring", period: 'both_halves', singleLine: true },
  
    // Defense
    { value: "player_defensive_interceptions", label: "Defensive Interceptions", apiKey: "player_defensive_interceptions", group: "Defense", period: 'full' },
    { value: "player_sacks", label: "Sacks", apiKey: "player_sacks", group: "Defense", period: 'full' },
    { value: "player_tackles", label: "Tackles", apiKey: "player_tackles", group: "Defense", period: 'full' },
    { value: "player_tackles_and_assists", label: "Tackles + Assists", apiKey: "player_tackles_and_assists", group: "Defense", period: 'full' },
    { value: "1st_quarter_player_interceptions_thrown", label: "Interceptions Thrown (1Q)", apiKey: "1st_quarter_player_interceptions_thrown", group: "Passing", period: '1q' },
  
    // Kicking (Moved to bottom as least popular)
    { value: "player_field_goals", label: "Field Goals", apiKey: "player_field_goals", group: "Kicking", period: 'full' },
    { value: "player_field_goals_made", label: "Field Goals Made", apiKey: "player_field_goals_made", group: "Kicking", period: 'full' },
    { value: "player_extra_points", label: "Extra Points", apiKey: "player_extra_points", group: "Kicking", period: 'full' },
    { value: "player_extra_points_made", label: "Extra Points Made", apiKey: "player_extra_points_made", group: "Kicking", period: 'full' },
    { value: "player_kicking_points", label: "Kicking Points", apiKey: "player_kicking_points", group: "Kicking", period: 'full' },
    { value: "1st_half_player_field_goals_made", label: "Field Goals Made (1H)", apiKey: "1st_half_player_field_goals_made", group: "Kicking", period: '1h' }
  ];

  // Soccer (EPL) markets
  // Note: Our data feed includes keys like odds:soccer_epl:*:player_goals:*
  const SOCCER_EPL_MARKETS: SportMarket[] = [
    // Game-level markets
    { value: "Moneyline 3-Way", label: "Moneyline 3-Way", apiKey: "moneyline_3way", group: "Game", period: "full" },
    { value: "Draw No Bet", label: "Draw No Bet", apiKey: "draw_no_bet", group: "Game", period: "full" },
    { value: "Match Goals", label: "Match Goals", apiKey: "match_goals", group: "Game", period: "full" },
    { value: "Total Goals", label: "Total Goals", apiKey: "total_goals", group: "Game", period: "full" },
    { value: "Total Goals Odd/Even", label: "Total Goals Odd/Even", apiKey: "total_goals_odd_even", group: "Game", period: "full" },
    { value: "Both Teams To Score", label: "Both Teams To Score", apiKey: "both_teams_to_score", group: "Game", period: "full" },
    { value: "Team Total Goals", label: "Team Total Goals", apiKey: "team_total_goals", group: "Game", period: "full" },
    { value: "Win To Nil", label: "Win To Nil", apiKey: "win_to_nil", group: "Game", period: "full" },
    { value: "Clean Sheet", label: "Clean Sheet", apiKey: "clean_sheet", group: "Game", period: "full" },

    // Player props - Goals
    {
      value: "Goals",
      label: "Goals",
      apiKey: "player_goals",
      hasAlternates: true,
      alternateKey: "player_goals_alternate",
      alwaysFetchAlternate: true,
      group: "Player",
      period: "full",
    },
    { value: "Anytime Goalscorer", label: "Anytime Goalscorer", apiKey: "anytime_goalscorer", group: "Player", period: "full", singleLine: true },
    { value: "First Goalscorer", label: "First Goalscorer", apiKey: "first_goalscorer", group: "Player", period: "full", singleLine: true },
    { value: "Last Goalscorer", label: "Last Goalscorer", apiKey: "last_goalscorer", group: "Player", period: "full", singleLine: true },
    
    // Player props - Shots
    { value: "Shots On Target", label: "Shots On Target", apiKey: "player_shots_on_target", group: "Player", period: "full" },
    { value: "Shots", label: "Shots", apiKey: "player_shots", group: "Player", period: "full" },
    
    // Player props - Other
    { value: "Assists", label: "Assists", apiKey: "player_assists", group: "Player", period: "full" },
    { value: "Tackles", label: "Tackles", apiKey: "player_tackles", group: "Player", period: "full" },
    { value: "Fouls Committed", label: "Fouls Committed", apiKey: "player_fouls_committed", group: "Player", period: "full" },
    { value: "Yellow Cards", label: "Yellow Cards", apiKey: "player_yellow_cards", group: "Player", period: "full" },
    { value: "To Be Carded", label: "To Be Carded", apiKey: "player_to_be_carded", group: "Player", period: "full" },
    { value: "Passes", label: "Passes", apiKey: "player_passes", group: "Player", period: "full" },
  ];
  
  export const SPORT_MARKETS: SportMarkets = {
    basketball_nba: BASKETBALL_MARKETS,
    basketball_wnba: BASKETBALL_MARKETS,
    basketball_ncaab: BASKETBALL_MARKETS,
    football_nfl: FOOTBALL_MARKETS,
    football_ncaaf: FOOTBALL_MARKETS,
    soccer_epl: SOCCER_EPL_MARKETS,
    baseball_mlb: [
      // Game-level markets
      { value: "Moneyline", label: "Moneyline", apiKey: "h2h", group: "Game" },
      { value: "Spread", label: "Run Line", apiKey: "spreads", group: "Game" },
      { value: "Total", label: "Total Runs", apiKey: "totals", group: "Game" },
      
      // Batter Props
      {
        value: "Home_Runs",
        label: "Home Runs",
        apiKey: "batter_home_runs",
        hasAlternates: true,
        alternateKey: "batter_home_runs_alternate",
        alwaysFetchAlternate: true,
        group: "Batter",
      },
      {
        value: "Hits",
        label: "Hits",
        apiKey: "batter_hits",
        hasAlternates: true,
        alternateKey: "batter_hits_alternate",
        alwaysFetchAlternate: true,
        group: "Batter",
      },
      {
        value: "Total_Bases",
        label: "Total Bases",
        apiKey: "batter_total_bases",
        hasAlternates: true,
        alternateKey: "batter_total_bases_alternate",
        alwaysFetchAlternate: true,
        group: "Batter",
      },
  
      {
        value: "RBIs",
        label: "RBIs",
        apiKey: "batter_rbis",
        hasAlternates: true,
        alternateKey: "batter_rbis_alternate",
        alwaysFetchAlternate: true,
        group: "Batter",
      },
      { value: "Runs", label: "Runs Scored", apiKey: "batter_runs_scored", group: "Batter" },
      { value: "Walks", label: "Walks", apiKey: "batter_walks", group: "Batter" },
      { value: "Singles", label: "Singles", apiKey: "batter_singles", group: "Batter" },
      { value: "Doubles", label: "Doubles", apiKey: "batter_doubles", group: "Batter" },
      { value: "Triples", label: "Triples", apiKey: "batter_triples", group: "Batter" },
      { value: "Stolen_Bases", label: "Stolen Bases", apiKey: "batter_stolen_bases", group: "Batter" },
      {
        value: "Extra_Base_Hits",
        label: "Extra Base Hits",
        apiKey: "batter_extra_base_hits",
        group: "Batter",
      },
      {
        value: "Hits_Runs_RBIs",
        label: "Hits + Runs + RBIs",
        apiKey: "batter_hits_runs_rbis",
        group: "Batter",
      },
      {
        value: "Batter_First_Home_Run",
        label: "1st Home Run",
        apiKey: "batter_first_home_run",
        group: "Batter",
        singleLine: true,
      },
  
      // Pitcher Props
      {
        value: "Strikeouts",
        label: "Strikeouts",
        apiKey: "pitcher_strikeouts",
        hasAlternates: true,
        alternateKey: "pitcher_strikeouts_alternate",
        alwaysFetchAlternate: true,
        group: "Pitcher",
      },
      {
        value: "Hits_Allowed",
        label: "Hits Allowed",
        apiKey: "pitcher_hits_allowed",
        hasAlternates: true,
        alternateKey: "pitcher_hits_allowed_alternate",
        alwaysFetchAlternate: true,
        group: "Pitcher",
      },
      {
        value: "Walks_Allowed",
        label: "Walks Allowed",
        apiKey: "pitcher_walks",
        hasAlternates: true,
        alternateKey: "pitcher_walks_alternate",
        alwaysFetchAlternate: true,
        group: "Pitcher",
      },
      {
        value: "Earned_Runs",
        label: "Earned Runs",
        apiKey: "pitcher_earned_runs",
        group: "Pitcher",
      },
      { value: "Outs_Recorded", label: "Outs Recorded", apiKey: "pitcher_outs", group: "Pitcher" },
      {
        value: "Pitches_Thrown",
        label: "Pitches Thrown",
        apiKey: "pitcher_pitches_thrown",
        group: "Pitcher",
      },
    ],
    icehockey_nhl: [
      // Game-level markets
      { value: "Moneyline", label: "Moneyline", apiKey: "moneyline", group: "Game", period: 'full' },
      { value: "Puck Line", label: "Puck Line", apiKey: "puck_line", group: "Game", period: 'full' },
      { value: "Total Goals", label: "Total Goals", apiKey: "total_goals", group: "Game", period: 'full' },
      { value: "Moneyline 3-Way", label: "Moneyline 3-Way", apiKey: "moneyline_3way", group: "Game", period: 'full' },
      { value: "Total Goals Reg Time", label: "Total Goals (Reg)", apiKey: "total_goals_reg", group: "Game", period: 'full' },
      { value: "Total Goals Odd/Even", label: "Total Goals Odd/Even", apiKey: "total_goals_odd_even", group: "Game", period: 'full' },
      { value: "Puck Line Reg Time", label: "Puck Line (Reg)", apiKey: "puck_line_reg", group: "Game", period: 'full' },
      { value: "Draw No Bet", label: "Draw No Bet", apiKey: "draw_no_bet", group: "Game", period: 'full' },
      { value: "Both Teams To Score", label: "Both Teams To Score", apiKey: "both_teams_to_score", group: "Game", period: 'full' },
      { value: "Both Teams To Score 2 Goals", label: "Both Teams To Score 2+", apiKey: "both_teams_to_score_2", group: "Game", period: 'full' },
      { value: "First Team To Score", label: "First Team To Score", apiKey: "first_team_to_score", group: "Game", period: 'full' },
      { value: "First Team To Score 3-Way", label: "First Team To Score (3-Way)", apiKey: "first_team_to_score_3way", group: "Game", period: 'full' },
      { value: "last-team-to-score-3-way", label: "Last Team To Score (3-Way)", apiKey: "last_team_to_score_3way", group: "Game", period: 'full' },
      { value: "Away Team Total Goals", label: "Away Team Total Goals", apiKey: "away_total_goals", group: "Game", period: 'full' },
      { value: "Away Team Total Goals Reg Time", label: "Away Team Total Goals (Reg)", apiKey: "away_total_goals_reg", group: "Game", period: 'full' },
      { value: "Home Team Total Goals", label: "Home Team Total Goals", apiKey: "home_total_goals", group: "Game", period: 'full' },
      { value: "Home Team Total Goals Reg Time", label: "Home Team Total Goals (Reg)", apiKey: "home_total_goals_reg", group: "Game", period: 'full' },

      // Period game markets
      { value: "1st Period Moneyline", label: "1st Period Moneyline", apiKey: "p1_moneyline", group: "1st Period", period: 'p1' },
      { value: "1st Period Moneyline 3-Way", label: "1st Period Moneyline (3-Way)", apiKey: "p1_moneyline_3way", group: "1st Period", period: 'p1' },
      { value: "1st Period Total Goals", label: "1st Period Total Goals", apiKey: "p1_total_goals", group: "1st Period", period: 'p1' },
      { value: "1st Period Total Goals Odd/Even", label: "1st Period Total Goals Odd/Even", apiKey: "p1_total_goals_odd_even", group: "1st Period", period: 'p1' },
      { value: "1st Period Puck Line", label: "1st Period Puck Line", apiKey: "p1_puck_line", group: "1st Period", period: 'p1' },
      { value: "1st 10 Minutes Total Goals", label: "1st 10 Minutes Total Goals", apiKey: "p1_10m_total_goals", group: "1st Period", period: 'p1' },
      { value: "1st 5 Minutes Total Goals", label: "1st 5 Minutes Total Goals", apiKey: "p1_5m_total_goals", group: "1st Period", period: 'p1' },
      { value: "1st Period Both Teams To Score", label: "1st Period Both Teams To Score", apiKey: "p1_btts", group: "1st Period", period: 'p1' },
      { value: "1st Period First Team To Score 3-Way", label: "1st Period First Team To Score (3-Way)", apiKey: "p1_first_team_to_score_3way", group: "1st Period", period: 'p1' },
      { value: "1st Period Home Team Total Goals", label: "1st Period Home Team Total Goals", apiKey: "p1_home_total_goals", group: "1st Period", period: 'p1' },
      { value: "1st Period Away Team Total Goals", label: "1st Period Away Team Total Goals", apiKey: "p1_away_total_goals", group: "1st Period", period: 'p1' },
      { value: "2nd Period Moneyline", label: "2nd Period Moneyline", apiKey: "p2_moneyline", group: "2nd Period", period: 'p2' },
      { value: "2nd Period Moneyline 3-Way", label: "2nd Period Moneyline (3-Way)", apiKey: "p2_moneyline_3way", group: "2nd Period", period: 'p2' },
      { value: "2nd Period Puck Line", label: "2nd Period Puck Line", apiKey: "p2_puck_line", group: "2nd Period", period: 'p2' },
      { value: "2nd Period Total Goals", label: "2nd Period Total Goals", apiKey: "p2_total_goals", group: "2nd Period", period: 'p2' },
      { value: "2nd Period Total Goals Odd/Even", label: "2nd Period Total Goals Odd/Even", apiKey: "p2_total_goals_odd_even", group: "2nd Period", period: 'p2' },
      { value: "2nd Period Both Teams To Score", label: "2nd Period Both Teams To Score", apiKey: "p2_btts", group: "2nd Period", period: 'p2' },
      { value: "2nd Period 1st 10 Minutes Total Goals", label: "2nd Period First 10 Minutes Total Goals", apiKey: "p2_10m_total_goals", group: "2nd Period", period: 'p2' },
      { value: "2nd Period 1st 5 Minutes Total Goals", label: "2nd Period First 5 Minutes Total Goals", apiKey: "p2_5m_total_goals", group: "2nd Period", period: 'p2' },
      { value: "3rd Period Moneyline", label: "3rd Period Moneyline", apiKey: "p3_moneyline", group: "3rd Period", period: 'p3' },
      { value: "3rd Period Moneyline 3-Way", label: "3rd Period Moneyline (3-Way)", apiKey: "p3_moneyline_3way", group: "3rd Period", period: 'p3' },
      { value: "3rd Period Puck Line", label: "3rd Period Puck Line", apiKey: "p3_puck_line", group: "3rd Period", period: 'p3' },
      { value: "3rd Period Total Goals", label: "3rd Period Total Goals", apiKey: "p3_total_goals", group: "3rd Period", period: 'p3' },
      { value: "3rd Period Total Goals Odd/Even", label: "3rd Period Total Goals Odd/Even", apiKey: "p3_total_goals_odd_even", group: "3rd Period", period: 'p3' },

      // Races
      { value: "Race To 2 Goals 3-Way Reg Time", label: "Race To 2 Goals (3-Way, Reg)", apiKey: "race_to_2_goals_3way_reg", group: "Races", period: 'full' },
      { value: "Race To 3 Goals 3-Way Reg Time", label: "Race To 3 Goals (3-Way, Reg)", apiKey: "race_to_3_goals_3way_reg", group: "Races", period: 'full' },
      { value: "Race To 4 Goals 3-Way Reg Time", label: "Race To 4 Goals (3-Way, Reg)", apiKey: "race_to_4_goals_3way_reg", group: "Races", period: 'full' },
      { value: "Race To 5 Goals 3-Way Reg Time", label: "Race To 5 Goals (3-Way, Reg)", apiKey: "race_to_5_goals_3way_reg", group: "Races", period: 'full' },
      
      // Player props - Full Game (Most Popular Markets First)
      // Top Scoring Markets
      {
        value: "Goals",
        label: "Goals",
        apiKey: "player_goals",
        hasAlternates: true,
        alternateKey: "player_goals_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
        singleLine: true,
      },
      {
        value: "First_Goal_Scorer",
        label: "1st Goal",
        apiKey: "player_first_goal",
        group: "Scoring",
        period: 'full',
        singleLine: true,
      },
      {
        value: "Last_Goal_Scorer",
        label: "Last Goal",
        apiKey: "player_last_goal",
        group: "Scoring",
        period: 'full',
        singleLine: true,
      },
      {
        value: "Assists",
        label: "Assists",
        apiKey: "player_assists",
        hasAlternates: true,
        alternateKey: "player_assists_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
      },
      {
        value: "Points",
        label: "Points",
        apiKey: "player_points",
        hasAlternates: true,
        alternateKey: "player_points_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
      },
      {
        value: "Shots",
        label: "Shots on Goal",
        apiKey: "player_shots_on_goal",
        hasAlternates: true,
        alternateKey: "player_shots_on_goal_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
      },
      {
        value: "Power_Play_Points",
        label: "Power Play Points",
        apiKey: "player_power_play_points",
        hasAlternates: true,
        alternateKey: "player_power_play_points_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
      },
      {
        value: "PP_Points",
        label: "PP Points",
        apiKey: "player_pp_points",
        group: "Skater",
        period: 'full',
      },
      {
        value: "Blocked_Shots",
        label: "Blocked Shots",
        apiKey: "player_blocked_shots",
        hasAlternates: true,
        alternateKey: "player_blocked_shots_alternate",
        alwaysFetchAlternate: true,
        group: "Skater",
        period: 'full',
      },
      { value: "Hits", label: "Hits", apiKey: "player_hits", group: "Skater", period: 'full' },
      { value: "Plus/Minus", label: "Plus/Minus", apiKey: "player_plus_minus", group: "Skater", period: 'full' },
      
      // Goalie props
      {
        value: "Total_Saves",
        label: "Total Saves",
        apiKey: "player_total_saves",
        hasAlternates: true,
        alternateKey: "player_total_saves_alternate",
        alwaysFetchAlternate: true,
        group: "Goalie",
        period: 'full',
      },
      { value: "Shutout", label: "Shutout", apiKey: "player_shutout", group: "Goalie", period: 'full', singleLine: true },

      // 1st Period player props
      { value: "1st Period Player Goals", label: "Goals - 1st Period", apiKey: "1st_period_player_goals", group: "Skater", period: 'p1' },
      { value: "1st Period Player Assists", label: "Assists - 1st Period", apiKey: "1st_period_player_assists", group: "Skater", period: 'p1' },
      { value: "1st Period Player Points", label: "Points - 1st Period", apiKey: "1st_period_player_points", group: "Skater", period: 'p1' },
      { value: "1st Period Player Shots On Goal", label: "Shots on Goal - 1st Period", apiKey: "1st_period_player_shots_on_goal", group: "Skater", period: 'p1' },
      { value: "1st Period Player Saves", label: "Saves - 1st Period", apiKey: "1st_period_player_saves", group: "Goalie", period: 'p1' },
      
      // 2nd Period player props
      { value: "2nd Period Player Goals", label: "Goals - 2nd Period", apiKey: "2nd_period_player_goals", group: "Skater", period: 'p2' },
      { value: "2nd Period Player Assists", label: "Assists - 2nd Period", apiKey: "2nd_period_player_assists", group: "Skater", period: 'p2' },
      { value: "2nd Period Player Points", label: "Points - 2nd Period", apiKey: "2nd_period_player_points", group: "Skater", period: 'p2' },
      { value: "2nd Period Player Shots On Goal", label: "Shots on Goal - 2nd Period", apiKey: "2nd_period_player_shots_on_goal", group: "Skater", period: 'p2' },
      { value: "2nd Period Player Saves", label: "Saves - 2nd Period", apiKey: "2nd_period_player_saves", group: "Goalie", period: 'p2' },
      
      // 3rd Period player props
      { value: "3rd Period Player Goals", label: "Goals - 3rd Period", apiKey: "3rd_period_player_goals", group: "Skater", period: 'p3' },
      { value: "3rd Period Player Assists", label: "Assists - 3rd Period", apiKey: "3rd_period_player_assists", group: "Skater", period: 'p3' },
      { value: "3rd Period Player Points", label: "Points - 3rd Period", apiKey: "3rd_period_player_points", group: "Skater", period: 'p3' },
      { value: "3rd Period Player Shots On Goal", label: "Shots on Goal - 3rd Period", apiKey: "3rd_period_player_shots_on_goal", group: "Skater", period: 'p3' },
      { value: "3rd Period Player Saves", label: "Saves - 3rd Period", apiKey: "3rd_period_player_saves", group: "Goalie", period: 'p3' },
    ],
  };
  
  // Helper function to get markets for a sport
  export function getMarketsForSport(sport: string): SportMarket[] {
    return SPORT_MARKETS[sport] || [];
  }
  
  // Market types by sport
  export const SUPPORTED_MARKETS: Record<string, string[]> = {
    mlb: [
      // Batter markets
      'home runs',  // Set as first item to be default
      'hits',
      'total bases',
      'rbis',
      'runs',
      'batting strikeouts',
      'batting walks',
      'singles',
      'doubles',
      'triples',
      'hits + runs + rbis',
      'stolen bases',
      // Pitcher markets
      'strikeouts',
      'hits allowed',
      'walks',
      'earned runs',
      'outs',
      'pitcher win'
    ],
    nba: [
      'points', // Set as default
      'rebounds',
      'assists',
      'threes',
      'pra',  // Points + Rebounds + Assists
      'pr',   // Points + Rebounds
      'pa',   // Points + Assists
      'ra',   // Rebounds + Assists
      'blocks',
      'steals',
      'bs',   // Blocks + Steals
      'turnovers',
      'double_double',
      'triple_double'
    ],
    wnba: [
      'points', // Set as default
      'rebounds',
      'assists',
      'threes',
      'pra',  // Points + Rebounds + Assists
      'pr',   // Points + Rebounds
      'pa',   // Points + Assists
      'ra',   // Rebounds + Assists
      'blocks',
      'steals',
      'bs',   // Blocks + Steals
      'turnovers',
      'double_double',
      'triple_double'
    ],
    ncaab: [
      'points', // Set as default
      'rebounds',
      'assists',
      'threes',
      'pra',  // Points + Rebounds + Assists
      'pr',   // Points + Rebounds
      'pa',   // Points + Assists
      'ra',   // Rebounds + Assists
      'blocks',
      'steals',
      'bs',   // Blocks + Steals
      'turnovers',
      'double_double',
      'triple_double'
    ],
    nfl: [
      // Default
      'anytime touchdown scorer',
      // Passing
      'pass yards',
      'pass touchdowns',
      'pass attempts',
      'pass completions',
      'pass intercepts',
      'longest pass completion',
      '1st quarter pass yards',
      // Receiving
      'receptions',
      'reception yards',
      'reception touchdowns',
      'longest reception',
      // Rushing
      'rush yards',
      'rush attempts',
      'rush touchdowns',
      'longest rush',
      // Combo markets
      'pass + rush + reception yards',
      'pass + rush + reception touchdowns',
      'rush + reception yards',
      'rush + reception touchdowns',
      // Kicking
      'field goals',
      'kicking points',
      'points after touchdown',
      // Defense
      'defensive interceptions',
      'sacks',
      'solo tackles',
      'tackles + assists',
      // Team scoring / specials
      'assists',
      'touchdowns',
      '1st touchdown scorer',
      'last touchdown scorer'
    ],
    ncaaf: [
      // Mirror NFL markets (same keys/formatting)
      'anytime touchdown scorer',
      // Passing
      'pass yards',
      'pass touchdowns',
      'pass attempts',
      'pass completions',
      'pass intercepts',
      'longest pass completion',
      '1st quarter pass yards',
      // Receiving
      'receptions',
      'reception yards',
      'reception touchdowns',
      'longest reception',
      // Rushing
      'rush yards',
      'rush attempts',
      'rush touchdowns',
      'longest rush',
      // Combo markets
      'pass + rush + reception yards',
      'pass + rush + reception touchdowns',
      'rush + reception yards',
      'rush + reception touchdowns',
      // Kicking
      'field goals',
      'kicking points',
      'points after touchdown',
      // Defense
      'defensive interceptions',
      'sacks',
      'solo tackles',
      'tackles + assists',
      // Team scoring / specials
      'assists',
      'touchdowns',
      '1st touchdown scorer',
      'last touchdown scorer'
    ],
    nhl: [
      'goals', // Set as default (player_goals)
      'first goal',
      'last goal',
      'assists',
      'points',
      'shots on goal',
      'power play points',
      'blocked shots',
      'total saves'
    ],
    soccer_epl: [
      'goals', // Set as default (player_goals)
      'anytime goalscorer',
      'first goalscorer',
      'last goalscorer',
      'shots on target',
      'shots',
      'assists',
      'tackles',
      'fouls committed',
      'yellow cards',
      'to be carded',
      'passes'
    ]
  };
  
  // Export supported sports array
  // NOTE: mlb and wnba temporarily removed - no active odds feeds
  export const SUPPORTED_SPORTS = ['nba', 'ncaab', 'nfl', 'ncaaf', 'nhl', 'soccer_epl'] as const;
  
// Canonical mapping for market display names → internal API keys
// Maps backend market names to frontend API keys for consistent routing
// Keys are standardized to match Redis data feed format
export const MARKET_NAME_MAP: Record<string, string> = {
  // -------------------------------------------------------------------------
  // BASKETBALL - Player Props (Core)
  // -------------------------------------------------------------------------
  'Player Points': 'player_points',
  'player-points': 'player_points',
  'Player Rebounds': 'player_rebounds',
  'player-rebounds': 'player_rebounds',
  'Player Assists': 'player_assists',
  'player-assists': 'player_assists',
  'Player Threes': 'player_threes_made',
  'Player Three Pointers': 'player_threes_made',
  'Player 3-Point Field Goals': 'player_threes_made',
  'Player Threes Made': 'player_threes_made',
  'player-threes-made': 'player_threes_made',
  'Player FGM': 'player_fgm',
  'Player Field Goals Made': 'player_fgm',
  'player-fgm': 'player_fgm',
  'Player Blocks': 'player_blocks',
  'player-blocks': 'player_blocks',
  'Player Steals': 'player_steals',
  'player-steals': 'player_steals',
  'Player Turnovers': 'player_turnovers',
  'player-turnovers': 'player_turnovers',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Player Props (Combos) - Using Redis keys
  // -------------------------------------------------------------------------
  'Player Points + Rebounds + Assists': 'player_pra',
  'player-points-rebounds-assists': 'player_pra',
  'PRA': 'player_pra',
  'Player Points + Rebounds': 'player_pr',
  'player-points-rebounds': 'player_pr',
  'PR': 'player_pr',
  'Player Points + Assists': 'player_pa',
  'player-points-assists': 'player_pa',
  'PA': 'player_pa',
  'Player Rebounds + Assists': 'player_ra',
  'player-rebounds-assists': 'player_ra',
  'RA': 'player_ra',
  'Player Blocks + Steals': 'player_bs',
  'player-blocks-steals': 'player_bs',
  'BS': 'player_bs',
  'Player Double-Double': 'player_double_double',
  'player-double-double': 'player_double_double',
  'Player Triple-Double': 'player_triple_double',
  'player-triple-double': 'player_triple_double',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - First Basket Markets
  // -------------------------------------------------------------------------
  'First Basket': 'first_field_goal',
  'first-basket': 'first_field_goal',
  'First Field Goal': 'first_field_goal',
  'first-field-goal': 'first_field_goal',
  'Team First Basket': 'team_first_basket',
  'team-first-basket': 'team_first_basket',
  'Home Team First Field Goal': 'home_team_first_field_goal',
  'home-team-first-field-goal': 'home_team_first_field_goal',
  'Home Team First Basket': 'home_team_first_field_goal',
  'Away Team First Field Goal': 'away_team_first_field_goal',
  'away-team-first-field-goal': 'away_team_first_field_goal',
  'Away Team First Basket': 'away_team_first_field_goal',
  'Top Points Scorer': 'top_points_scorer',
  'top-points-scorer': 'top_points_scorer',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - 1st Quarter Player Props
  // -------------------------------------------------------------------------
  '1st Quarter Player Points': '1st_quarter_player_points',
  '1st-quarter-player-points': '1st_quarter_player_points',
  '1st Quarter Player Assists': '1st_quarter_player_assists',
  '1st-quarter-player-assists': '1st_quarter_player_assists',
  '1st Quarter Player Rebounds': '1st_quarter_player_rebounds',
  '1st-quarter-player-rebounds': '1st_quarter_player_rebounds',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - 1st 3 Minutes Player Props (Single Line)
  // -------------------------------------------------------------------------
  '1st 3 Minutes Player Points': '1st_3_minutes_player_points',
  '1st 3 Minutes Player Assists': '1st_3_minutes_player_assists',
  '1st 3 Minutes Player Rebounds': '1st_3_minutes_player_rebounds',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Game Markets (Full Game) - Using Redis keys
  // -------------------------------------------------------------------------
  'Moneyline': 'game_moneyline',
  'moneyline': 'game_moneyline',
  'game_moneyline': 'game_moneyline',
  'Point Spread': 'game_spread',
  'point-spread': 'game_spread',
  'game_spread': 'game_spread',
  'Total Points': 'total_points',
  'total-points': 'total_points',
  'total_points': 'total_points',
  'Team Total': 'team_total',
  'team_total': 'team_total',
  'Total Points Odd/Even': 'total_points_odd_even',
  'total-points-odd-even': 'total_points_odd_even',
  'Overtime?': 'overtime',
  'overtime': 'overtime',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Game Markets (1st Half) - Using Redis keys
  // -------------------------------------------------------------------------
  '1st Half Moneyline': 'game_1h_moneyline',
  '1st-half-moneyline': 'game_1h_moneyline',
  'game_1h_moneyline': 'game_1h_moneyline',
  '1st Half Point Spread': '1st_half_point_spread',
  '1st-half-point-spread': '1st_half_point_spread',
  '1st Half Total Points': '1st_half_total_points',
  '1st-half-total-points': '1st_half_total_points',
  '1st Half ML 3-Way': '1st_half_moneyline_3_way',
  '1st Half Home Total': '1st_half_home_team_total_points',
  '1st Half Away Total': '1st_half_away_team_total_points',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Game Markets (2nd Half) - Using Redis keys
  // -------------------------------------------------------------------------
  '2nd Half Moneyline': '2nd_half_moneyline',
  '2nd-half-moneyline': '2nd_half_moneyline',
  '2nd Half Point Spread': '2nd_half_point_spread',
  '2nd-half-point-spread': '2nd_half_point_spread',
  '2nd Half Total Points': '2nd_half_total_points',
  '2nd-half-total-points': '2nd_half_total_points',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Game Markets (1st Quarter) - Using Redis keys
  // -------------------------------------------------------------------------
  '1st Quarter Moneyline': 'game_1q_moneyline',
  '1st-quarter-moneyline': 'game_1q_moneyline',
  'game_1q_moneyline': 'game_1q_moneyline',
  '1st Quarter Point Spread': '1st_quarter_point_spread',
  '1st-quarter-point-spread': '1st_quarter_point_spread',
  '1st Quarter Total Points': '1st_quarter_total_points',
  '1st-quarter-total-points': '1st_quarter_total_points',
  '1st Quarter ML 3-Way': '1st_quarter_moneyline_3_way',
  '1st Quarter Last Team to Score': '1st_quarter_last_team_to_score',
  '1st Quarter Home Total': '1st_quarter_home_team_total_points',
  '1st Quarter Away Total': '1st_quarter_away_team_total_points',
  
  // -------------------------------------------------------------------------
  // BASKETBALL - Game Markets (2nd-4th Quarter) - Using Redis keys
  // -------------------------------------------------------------------------
  '2nd Quarter Moneyline': '2nd_quarter_moneyline',
  '2nd-quarter-moneyline': '2nd_quarter_moneyline',
  '2nd Quarter Point Spread': '2nd_quarter_point_spread',
  '2nd-quarter-point-spread': '2nd_quarter_point_spread',
  '2nd Quarter Total Points': '2nd_quarter_total_points',
  '2nd-quarter-total-points': '2nd_quarter_total_points',
  '3rd Quarter Moneyline': '3rd_quarter_moneyline',
  '3rd-quarter-moneyline': '3rd_quarter_moneyline',
  '3rd Quarter Point Spread': '3rd_quarter_point_spread',
  '3rd-quarter-point-spread': '3rd_quarter_point_spread',
  '3rd Quarter Total Points': '3rd_quarter_total_points',
  '3rd-quarter-total-points': '3rd_quarter_total_points',
  '4th Quarter Moneyline': '4th_quarter_moneyline',
  '4th-quarter-moneyline': '4th_quarter_moneyline',
  '4th Quarter Point Spread': '4th_quarter_point_spread',
  '4th-quarter-point-spread': '4th_quarter_point_spread',
  '4th Quarter Total Points': '4th_quarter_total_points',
  '4th-quarter-total-points': '4th_quarter_total_points',
  
  // Hockey player markets
  'Player Goals': 'player_goals',
  // We standardize to 'player_total_saves' to match SPORT_MARKETS (not 'player_saves')
  'Player Saves': 'player_total_saves',
  'Player Shots On Goal': 'player_shots_on_goal',
  'Player Hits': 'player_hits',
  'Player Blocked Shots': 'player_blocked_shots',
  'Player Plus Minus': 'player_plus_minus',
  // We standardize to 'player_power_play_points' (not 'player_pp_points')
  'Player Power Play Points': 'player_power_play_points',
  'Player Shutout': 'player_shutout',

  // Period player markets (generic prefixes)
  '1st Period Player Goals': 'p1_player_goals',
  '1st Period Player Assists': 'p1_player_assists',
  '1st Period Player Saves': 'p1_player_total_saves',
  '1st Period Player Shots On Goal': 'p1_player_shots_on_goal',
  '2nd Period Player Goals': 'p2_player_goals',
  '2nd Period Player Assists': 'p2_player_assists',
  '2nd Period Player Points': 'p2_player_points',
  '2nd Period Player Saves': 'p2_player_total_saves',
  '2nd Period Player Shots On Goal': 'p2_player_shots_on_goal',
  '3rd Period Player Goals': 'p3_player_goals',
  '3rd Period Player Assists': 'p3_player_assists',
  '3rd Period Player Points': 'p3_player_points',
  '3rd Period Player Saves': 'p3_player_total_saves',
  '3rd Period Player Shots On Goal': 'p3_player_shots_on_goal',

  // First/Last/Team first goalscorer
  'First Goalscorer': 'first_goalscorer',
  'Last Goalscorer': 'last_goalscorer',
  'Away Team First Goalscorer': 'away_first_goalscorer',
  'Home Team First Goalscorer': 'home_first_goalscorer',

  // Hockey-specific game markets
  'Moneyline 3-Way': 'moneyline_3way',
  'Total Goals': 'total_goals',
  'Total Goals Reg Time': 'total_goals_reg',
  'Total Goals Odd/Even': 'total_goals_odd_even',
  'Puck Line': 'puck_line',
  'Puck Line Reg Time': 'puck_line_reg',
  'Draw No Bet': 'draw_no_bet',
  'Both Teams To Score': 'both_teams_to_score',
  'Both Teams To Score 2 Goals': 'both_teams_to_score_2',
  'First Team To Score': 'first_team_to_score',
  'First Team To Score 3-Way': 'first_team_to_score_3way',
  'last-team-to-score-3-way': 'last_team_to_score_3way',
  'Away Team Total Goals': 'away_total_goals',
  'Away Team Total Goals Reg Time': 'away_total_goals_reg',
  'Home Team Total Goals': 'home_total_goals',
  'Home Team Total Goals Reg Time': 'home_total_goals_reg',

  // Period game markets
  '1st Period Moneyline': 'p1_moneyline',
  '1st Period Moneyline 3-Way': 'p1_moneyline_3way',
  '1st Period Total Goals': 'p1_total_goals',
  '1st Period Total Goals Odd/Even': 'p1_total_goals_odd_even',
  '1st Period Puck Line': 'p1_puck_line',
  '1st 10 Minutes Total Goals': 'p1_10m_total_goals',
  '1st 5 Minutes Total Goals': 'p1_5m_total_goals',
  '1st Period Both Teams To Score': 'p1_btts',
  '1st Period First Team To Score 3-Way': 'p1_first_team_to_score_3way',
  '1st Period Home Team Total Goals': 'p1_home_total_goals',
  '1st Period Away Team Total Goals': 'p1_away_total_goals',
  '2nd Period Moneyline': 'p2_moneyline',
  '2nd Period Moneyline 3-Way': 'p2_moneyline_3way',
  '2nd Period Puck Line': 'p2_puck_line',
  '2nd Period Total Goals': 'p2_total_goals',
  '2nd Period Total Goals Odd/Even': 'p2_total_goals_odd_even',
  '2nd Period Both Teams To Score': 'p2_btts',
  '2nd Period 1st 10 Minutes Total Goals': 'p2_10m_total_goals',
  '2nd Period 1st 5 Minutes Total Goals': 'p2_5m_total_goals',
  '3rd Period Moneyline': 'p3_moneyline',
  '3rd Period Moneyline 3-Way': 'p3_moneyline_3way',
  '3rd Period Puck Line': 'p3_puck_line',
  '3rd Period Total Goals': 'p3_total_goals',
  '3rd Period Total Goals Odd/Even': 'p3_total_goals_odd_even',

  // Races
  'Race To 2 Goals 3-Way Reg Time': 'race_to_2_goals_3way_reg',
  'Race To 3 Goals 3-Way Reg Time': 'race_to_3_goals_3way_reg',
  'Race To 4 Goals 3-Way Reg Time': 'race_to_4_goals_3way_reg',
  'Race To 5 Goals 3-Way Reg Time': 'race_to_5_goals_3way_reg',
};

  // Helper function to get short market labels (PTS, REB, AST, etc.)
  export function formatMarketLabelShort(market: string): string {
    const shortLabels: Record<string, string> = {
      // Basketball - Core
      'player_points': 'PTS',
      'player_rebounds': 'REB',
      'player_assists': 'AST',
      'player_threes_made': '3PM',
      'player_fgm': 'FGM',
      'player_steals': 'STL',
      'player_blocks': 'BLK',
      'player_turnovers': 'TO',
      
      // Basketball - Combos (standardized Redis keys)
      'player_pra': 'PRA',
      'player_pr': 'P+R',
      'player_pa': 'P+A',
      'player_ra': 'R+A',
      'player_bs': 'B+S',
      'player_double_double': 'DD',
      'player_triple_double': 'TD',
      // Legacy combo keys (for backwards compatibility)
      'player_points_rebounds_assists': 'PRA',
      'player_points_rebounds': 'P+R',
      'player_points_assists': 'P+A',
      'player_rebounds_assists': 'R+A',
      'player_blocks_steals': 'B+S',
      
      // Basketball - Game Markets
      'game_moneyline': 'ML',
      'game_spread': 'SPR',
      'total_points': 'TOT',
      'team_total': 'TT',
      
      // Hockey
      'player_goals': 'G',
      'player_shots_on_goal': 'SOG',
      'player_power_play_points': 'PPP',
      'player_total_saves': 'SV',
      'player_blocked_shots': 'BS',
      'player_hits': 'HIT',
      
      // Football
      'passing_yards': 'PASS',
      'rushing_yards': 'RUSH',
      'receiving_yards': 'REC',
      'receptions': 'RCPT',
      'player_touchdowns': 'TD',
      
      // Baseball
      'batter_home_runs': 'HR',
      'batter_hits': 'H',
      'batter_total_bases': 'TB',
      'batter_rbis': 'RBI',
      'pitcher_strikeouts': 'K',
    };
    
    return shortLabels[market] || formatMarketLabel(market).split(' ')[0];
  }

  // Helper function to format market labels with special cases
  export function formatMarketLabel(market: string): string {
    // First, check if this is an API key and map it to a display name
    const apiKeyMappings: Record<string, string> = {
      // Basketball - Core Player Props
      'player_points': 'Points',
      'player_rebounds': 'Rebounds',
      'player_assists': 'Assists',
      'player_threes_made': "3-Pointers",
      'player_threes': "3-Pointers",
      'player_fgm': 'Field Goals Made',
      'player_blocks': 'Blocks',
      'player_steals': 'Steals',
      'player_turnovers': 'Turnovers',
      
      // Basketball - Combos (standardized Redis keys)
      'player_pra': 'Pts+Reb+Ast',
      'player_pr': 'Pts+Reb',
      'player_pa': 'Pts+Ast',
      'player_ra': 'Reb+Ast',
      'player_bs': 'Blk+Stl',
      'player_double_double': 'Double Double',
      'player_triple_double': 'Triple Double',
      // Legacy combo keys (for backwards compatibility)
      'player_points_rebounds_assists': 'Pts+Reb+Ast',
      'player_points_rebounds': 'Pts+Reb',
      'player_points_assists': 'Pts+Ast',
      'player_rebounds_assists': 'Reb+Ast',
      'player_blocks_steals': 'Blk+Stl',
      
      // Basketball - First Basket
      'first_field_goal': '1st Basket (Game)',
      'team_first_basket': '1st Basket (Team)',
      'home_team_first_field_goal': 'Home Team 1st Basket',
      'away_team_first_field_goal': 'Away Team 1st Basket',
      'top_points_scorer': 'Top Points Scorer',
      
      // Basketball - Game Markets (standardized Redis keys)
      'game_moneyline': 'Moneyline',
      'game_spread': 'Point Spread',
      'total_points': 'Total Points',
      'team_total': 'Team Total',
      'total_points_odd_even': 'Total Odd/Even',
      'overtime': 'Overtime?',
      'game_1h_moneyline': '1H Moneyline',
      '1st_half_point_spread': '1H Spread',
      '1st_half_total_points': '1H Total',
      '1st_half_moneyline_3_way': '1H ML 3-Way',
      '1st_half_home_team_total_points': '1H Home Total',
      '1st_half_away_team_total_points': '1H Away Total',
      '2nd_half_moneyline': '2H Moneyline',
      '2nd_half_point_spread': '2H Spread',
      '2nd_half_total_points': '2H Total',
      'game_1q_moneyline': '1Q Moneyline',
      '1st_quarter_point_spread': '1Q Spread',
      '1st_quarter_total_points': '1Q Total',
      '1st_quarter_moneyline_3_way': '1Q ML 3-Way',
      '1st_quarter_last_team_to_score': '1Q Last Team to Score',
      '1st_quarter_home_team_total_points': '1Q Home Total',
      '1st_quarter_away_team_total_points': '1Q Away Total',
      '2nd_quarter_moneyline': '2Q Moneyline',
      '2nd_quarter_point_spread': '2Q Spread',
      '2nd_quarter_total_points': '2Q Total',
      '3rd_quarter_moneyline': '3Q Moneyline',
      '3rd_quarter_point_spread': '3Q Spread',
      '3rd_quarter_total_points': '3Q Total',
      '4th_quarter_moneyline': '4Q Moneyline',
      '4th_quarter_point_spread': '4Q Spread',
      '4th_quarter_total_points': '4Q Total',
      
      // Basketball - 1st Quarter Player Props
      '1st_quarter_player_points': 'Points (1Q)',
      '1st_quarter_player_assists': 'Assists (1Q)',
      '1st_quarter_player_rebounds': 'Rebounds (1Q)',
      
      // Basketball - 1st 3 Minutes Player Props
      '1st_3_minutes_player_points': 'Points (1st 3 Min)',
      '1st_3_minutes_player_assists': 'Assists (1st 3 Min)',
      '1st_3_minutes_player_rebounds': 'Rebounds (1st 3 Min)',
      
      // Football - Passing
      'passing_yards': 'Passing Yards',
      'passing_tds': 'Passing Touchdowns',
      'pass_completions': 'Pass Completions',
      'passing_completions': 'Pass Completions',
      'pass_attempts': 'Pass Attempts',
      'passing_attempts': 'Pass Attempts',
      'pass_interceptions': 'Interceptions Thrown',
      'passing_interceptions': 'Interceptions Thrown',
      
      // Football - Rushing
      'rushing_yards': 'Rushing Yards',
      'rush_attempts': 'Rush Attempts',
      'rushing_attempts': 'Rush Attempts',
      'rushing_tds': 'Rushing Touchdowns',
      
      // Football - Receiving
      'receiving_yards': 'Receiving Yards',
      'receptions': 'Receptions',
      'receiving_tds': 'Receiving Touchdowns',
      
      // Football - Combo
      'pass_rush_yards': 'Pass + Rush Yards',
      'rush_rec_yards': 'Rush + Reception Yards',
      
      // Football - Scoring
      'player_anytime_td': 'Anytime TD',
      'player_touchdowns': 'Touchdowns',
      'first_td': 'First TD Scorer',
      'last_td': 'Last TD Scorer',
      
      // Football - Defense
      'player_sacks': 'Sacks',
      'player_tackles_and_assists': 'Tackles + Assists',
      'player_defensive_interceptions': 'Defensive Interceptions',
      
      // Football - Kicking
      'player_field_goals_made': 'Field Goals Made',
      'player_extra_points_made': 'Extra Points Made',
      'player_kicking_points': 'Kicking Points',
      
      // Hockey (player_points and player_assists already defined in Basketball)
      'player_goals': 'Goals',
      'player_shots_on_goal': 'Shots on Goal',
      'player_blocked_shots': 'Blocked Shots',
      'player_power_play_points': 'Power Play Points',
      'player_total_saves': 'Total Saves',
      'player_hits': 'Hits',
      'player_first_goal': 'First Goal',
      'player_last_goal': 'Last Goal',
      
      // Baseball - Batter
      'batter_home_runs': 'Home Runs',
      'batter_hits': 'Hits',
      'batter_total_bases': 'Total Bases',
      'batter_rbis': 'RBIs',
      'batter_runs_scored': 'Runs Scored',
      'batter_walks': 'Walks',
      'batter_singles': 'Singles',
      'batter_doubles': 'Doubles',
      'batter_triples': 'Triples',
      'batter_stolen_bases': 'Stolen Bases',
      'batter_hits_runs_rbis': 'Hits + Runs + RBIs',
      
      // Baseball - Pitcher
      'pitcher_strikeouts': 'Strikeouts',
      'pitcher_hits_allowed': 'Hits Allowed',
      'pitcher_walks': 'Walks Allowed',
      'pitcher_earned_runs': 'Earned Runs',
      'pitcher_outs': 'Outs Recorded',
      
      // Soccer (EPL)
      'match_goals': 'Match Goals',
      'total_goals': 'Total Goals',
      'both_teams_to_score': 'Both Teams To Score',
      'team_total_goals': 'Team Total Goals',
      'win_to_nil': 'Win To Nil',
      'clean_sheet': 'Clean Sheet',
      'anytime_goalscorer': 'Anytime Goalscorer',
      'first_goalscorer': 'First Goalscorer',
      'last_goalscorer': 'Last Goalscorer',
      'player_shots_on_target': 'Shots on Target',
      'player_shots': 'Shots',
      'player_tackles': 'Tackles',
      'player_fouls_committed': 'Fouls Committed',
      'player_yellow_cards': 'Yellow Cards',
      'player_to_be_carded': 'To Be Carded',
      'player_passes': 'Passes',
    };
    
    // Check if this is a known API key
    if (apiKeyMappings[market]) {
      return apiKeyMappings[market];
    }
    
    // Legacy special case mappings (for display names)
    const specialCases: Record<string, string> = {
      'rbis': 'RBIs',
      'hits + runs + rbis': 'HRR',
      'pra': 'PRA',
      'pr': 'PR',
      'pa': 'PA',
      'ra': 'RA',
      'bs': 'Blk+Stl',
      'double_double': 'Double Double',
      'triple_double': 'Triple Double',
      // Football phrasing preferences
      'reception yards': 'Receiving Yards',
      'reception touchdowns': 'Receiving Touchdowns',
      'rush yards': 'Rushing Yards',
      'rush attempts': 'Rushing Attempts',
      'rush touchdowns': 'Rushing Touchdowns',
      'pass yards': 'Passing Yards',
      'pass touchdowns': 'Passing Touchdowns',
      'pass intercepts': 'Interceptions Thrown',
    };
  
    if (specialCases[market]) {
      return specialCases[market];
    }
  
    // Handle markets with + signs
    if (market.includes(' + ')) {
      return market.split(' + ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' + ');
    }
    
    // Convert underscores to spaces and capitalize
    const formatted = market
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Clean up common prefixes
    return formatted
      .replace(/^Player /, '')
      .replace(/^Batter /, '')
      .replace(/^Pitcher /, '');
  }
  
  // Helper function to get default market for a sport
  // Returns the most popular player market for each sport
  export function getDefaultMarket(sport: string, type?: 'game' | 'player'): string {
    // If type is specified and it's game, return moneyline (using Redis key)
    if (type === 'game') {
      return 'game_moneyline';
    }
    
    // Default player markets by sport
    const defaultPlayerMarkets: Record<string, string> = {
      'nfl': 'player_touchdowns', // Anytime TD
      'ncaaf': 'player_touchdowns', // Anytime TD
      'nba': 'player_points',
      'ncaab': 'player_points',
      'nhl': 'player_goals',
      'mlb': 'batter_hits',
      'soccer_epl': 'player_goals',
    };
    
    // Return sport-specific default or fallback to game_moneyline
    return defaultPlayerMarkets[sport.toLowerCase()] || 'game_moneyline';
  }
  
  // Helper function to get API key for a market
  export function getMarketApiKey(
    sport: string,
    marketValue: string,
    useAlternate: boolean = false
  ): string {
    const market = getMarketsForSport(sport).find((m) => m.value === marketValue);
    if (!market) return "player_points";

    if (useAlternate && market.hasAlternates && market.alternateKey) {
      return market.alternateKey;
    }

    return market.apiKey;
  }

  // Helper function to check if a market is single-line (no over/under)
  export function isSingleLineMarket(sport: string, marketApiKey: string): boolean {
    const markets = getMarketsForSport(sport);
    const market = markets.find((m) => m.apiKey === marketApiKey);
    return market?.singleLine === true;
  }
  
  // List of API keys that are known single-line markets (for quick lookup without sport context)
  export const SINGLE_LINE_MARKETS = new Set([
    // Basketball
    'player_double_double',
    'player_triple_double',
    'first_field_goal',
    'team_first_basket',
    'home_team_first_field_goal',
    'away_team_first_field_goal',
    'top_points_scorer',
    // Basketball - 1st 3 Minutes (single-line)
    '1st_3_minutes_player_points',
    '1st_3_minutes_player_assists',
    '1st_3_minutes_player_rebounds',
    // Game markets (all sports)
    'overtime',
    // Hockey
    'player_goals',
    // Football
    'player_touchdowns',
    'first_td',
    'last_td',
    '1q_player_touchdowns',
    '1st_quarter_player_touchdowns',
    '1h_player_touchdowns',
    '1st_half_player_touchdowns',
    '2h_player_touchdowns',
    '2nd_half_player_touchdowns',
    '2nd_half_first_touchdown_scorer',
    '3q_player_touchdowns',
    'both_halves_player_touchdowns',
    // Soccer
    'anytime_goalscorer',
    'first_goalscorer',
    'last_goalscorer',
    // Hockey
    'player_first_goal',
    'player_last_goal',
    'player_shutout',
    // Baseball
    'batter_first_home_run',
  ]);
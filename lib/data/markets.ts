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
  }
  
  export interface SportMarkets {
    [key: string]: SportMarket[];
  }
  
  // Common market definitions for reuse
  const BASKETBALL_MARKETS: SportMarket[] = [
    // Game-level markets
    { value: "Moneyline", label: "Moneyline", apiKey: "moneyline", group: "Game", period: 'full' },
    { value: "Spread", label: "Point Spread", apiKey: "spread", group: "Game", period: 'full' },
    { value: "Total", label: "Total Points", apiKey: "total", group: "Game", period: 'full' },
    { value: "Total Points Odd/Even", label: "Total Points Odd/Even", apiKey: "total_points_odd_even", group: "Game", period: 'full' },
    { value: "Overtime", label: "Overtime?", apiKey: "overtime", group: "Game", period: 'full' },
    
    // Half markets
    { value: "1st Half Moneyline", label: "1st Half Moneyline", apiKey: "1h_moneyline", group: "Halves", period: '1h' },
    { value: "1st Half Spread", label: "1st Half Point Spread", apiKey: "1h_spread", group: "Halves", period: '1h' },
    { value: "1st Half Total", label: "1st Half Total Points", apiKey: "1h_total", group: "Halves", period: '1h' },
    { value: "2nd Half Total", label: "2nd Half Total Points", apiKey: "2h_total", group: "Halves", period: '2h' },
    
    // Quarter markets
    { value: "1st Quarter Moneyline", label: "1st Quarter Moneyline", apiKey: "1q_moneyline", group: "Quarters", period: '1q' },
    { value: "1st Quarter Spread", label: "1st Quarter Point Spread", apiKey: "1q_spread", group: "Quarters", period: '1q' },
    { value: "1st Quarter Total", label: "1st Quarter Total Points", apiKey: "1q_total", group: "Quarters", period: '1q' },
    { value: "2nd Quarter Moneyline", label: "2nd Quarter Moneyline", apiKey: "2q_moneyline", group: "Quarters", period: '2q' },
    { value: "2nd Quarter Spread", label: "2nd Quarter Point Spread", apiKey: "2q_spread", group: "Quarters", period: '2q' },
    { value: "2nd Quarter Total", label: "2nd Quarter Total Points", apiKey: "2q_total", group: "Quarters", period: '2q' },
    { value: "3rd Quarter Moneyline", label: "3rd Quarter Moneyline", apiKey: "3q_moneyline", group: "Quarters", period: '3q' },
    { value: "3rd Quarter Spread", label: "3rd Quarter Point Spread", apiKey: "3q_spread", group: "Quarters", period: '3q' },
    { value: "3rd Quarter Total", label: "3rd Quarter Total Points", apiKey: "3q_total", group: "Quarters", period: '3q' },
    { value: "4th Quarter Moneyline", label: "4th Quarter Moneyline", apiKey: "4q_moneyline", group: "Quarters", period: '4q' },
    { value: "4th Quarter Spread", label: "4th Quarter Point Spread", apiKey: "4q_spread", group: "Quarters", period: '4q' },
    { value: "4th Quarter Total", label: "4th Quarter Total Points", apiKey: "4q_total", group: "Quarters", period: '4q' },
    
    // Player props
    {
      value: "Points",
      label: "Points",
      apiKey: "player_points",
      hasAlternates: true,
      alternateKey: "player_points_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Rebounds",
      label: "Rebounds",
      apiKey: "player_rebounds",
      hasAlternates: true,
      alternateKey: "player_rebounds_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Assists",
      label: "Assists",
      apiKey: "player_assists",
      hasAlternates: true,
      alternateKey: "player_assists_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Threes",
      label: "Threes",
      apiKey: "player_threes_made",
      hasAlternates: true,
      alternateKey: "player_threes_made_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: 'full',
    },
    {
      value: "PRA",
      label: "Pts+Reb+Ast",
      apiKey: "player_points_rebounds_assists",
      hasAlternates: true,
      alternateKey: "player_points_rebounds_assists_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "Points_Rebounds",
      label: "Pts+Reb",
      apiKey: "player_points_rebounds",
      hasAlternates: true,
      alternateKey: "player_points_rebounds_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "Points_Assists",
      label: "Pts+Ast",
      apiKey: "player_points_assists",
      hasAlternates: true,
      alternateKey: "player_points_assists_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "Rebounds_Assists",
      label: "Reb+Ast",
      apiKey: "player_rebounds_assists",
      hasAlternates: true,
      alternateKey: "player_rebounds_assists_alternate",
      alwaysFetchAlternate: true,
      group: "Combo",
      period: 'full',
    },
    {
      value: "Double_Double",
      label: "Double Double",
      apiKey: "player_double_double",
      group: "Combo",
      period: 'full',
    },
    {
      value: "Triple_Double",
      label: "Triple Double",
      apiKey: "player_triple_double",
      group: "Combo",
      period: 'full',
    },
    {
      value: "Blocks",
      label: "Blocks",
      apiKey: "player_blocks",
      hasAlternates: true,
      alternateKey: "player_blocks_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    {
      value: "Steals",
      label: "Steals",
      apiKey: "player_steals",
      hasAlternates: true,
      alternateKey: "player_steals_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    {
      value: "Blocks_steals",
      label: "Blocks+Steals",
      apiKey: "player_blocks_steals",
      group: "Defense",
      period: 'full',
    },
    {
      value: "Turnovers",
      label: "Turnovers",
      apiKey: "player_turnovers",
      hasAlternates: true,
      alternateKey: "player_turnovers_alternate",
      alwaysFetchAlternate: true,
      group: "Defense",
      period: 'full',
    },
    {
      value: "First_Team_Basket",
      label: "Team First Point",
      apiKey: "player_first_team_basket",
      group: "Scoring",
      period: 'full',
    },
    {
      value: "First_Field_Goal",
      label: "First Point",
      apiKey: "first_field_goal",
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Home_Team_First_Field_Goal",
      label: "Home Team First Point",
      apiKey: "home_team_first_field_goal",
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Away_Team_First_Field_Goal",
      label: "Away Team First Point",
      apiKey: "away_team_first_field_goal",
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Top_Points_Scorer",
      label: "Top Points Scorer",
      apiKey: "top_points_scorer",
      group: "Scoring",
      period: 'full',
    },
    {
      value: "Player_Points_Q1",
      label: "Points - 1st Quarter",
      apiKey: "1q_player_points",
      hasAlternates: true,
      alternateKey: "1q_player_points_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: '1q',
    },
    {
      value: "Player_Assists_Q1",
      label: "Assists - 1st Quarter",
      apiKey: "player_assists_q1",
      hasAlternates: true,
      alternateKey: "player_assists_q1_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: '1q',
    },
    {
      value: "Player_Rebounds_Q1",
      label: "Rebounds - 1st Quarter",
      apiKey: "player_rebounds_q1",
      hasAlternates: true,
      alternateKey: "player_rebounds_q1_alternate",
      alwaysFetchAlternate: true,
      group: "Scoring",
      period: '1q',
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
    { value: "overtime", label: "Overtime", apiKey: "overtime", group: "Special", period: 'full' },
    
    // Other
    { value: "total_punts", label: "Total Punts", apiKey: "total_punts", group: "Other", period: 'full' },
    { value: "largest_lead", label: "Largest Lead", apiKey: "largest_lead", group: "Other", period: 'full' },
    { value: "first_score_yards", label: "First Score Yards", apiKey: "first_score_yards", group: "Other", period: 'full' },
  
    // Player props - Most Popular Markets First
    // Top Scoring Markets
    { value: "player_touchdowns", label: "Anytime TD", apiKey: "player_touchdowns", group: "Scoring", period: 'full' },
    { value: "first_td", label: "1st TD", apiKey: "first_td", group: "Scoring", period: 'full' },
    { value: "last_td", label: "Last TD", apiKey: "last_td", group: "Scoring", period: 'full' },
    
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
    
    // Quarter Markets - Rushing
    { value: "1q_rushing_yards", label: "Rushing Yards (1Q)", apiKey: "1q_rushing_yards", group: "Rushing", period: '1q', hasAlternates: true, alternateKey: "1q_rushing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1q_rush_attempts", label: "Rush Attempts (1Q)", apiKey: "1q_rush_attempts", group: "Rushing", period: '1q', hasAlternates: true, alternateKey: "1q_rush_attempts_alternate", alwaysFetchAlternate: true },
    
    // Half Markets - Passing
    { value: "1h_passing_yards", label: "Passing Yards (1H)", apiKey: "1h_passing_yards", group: "Passing", period: '1h', hasAlternates: true, alternateKey: "1h_passing_yards_alternate", alwaysFetchAlternate: true },
    { value: "1st_half_player_passing_touchdowns", label: "Passing TDs (1H)", apiKey: "1st_half_player_passing_touchdowns", group: "Passing", period: '1h', hasAlternates: true, alternateKey: "1st_half_player_passing_touchdowns_alternate", alwaysFetchAlternate: true },
    
    // Half Markets - Receiving
    { value: "1st_half_player_receiving_yards", label: "Receiving Yards (1H)", apiKey: "1st_half_player_receiving_yards", group: "Receiving", period: '1h', hasAlternates: true, alternateKey: "1st_half_player_receiving_yards_alternate", alwaysFetchAlternate: true },
    
    // Half Markets - Rushing
    { value: "1h_rushing_yards", label: "Rushing Yards (1H)", apiKey: "1h_rushing_yards", group: "Rushing", period: '1h', hasAlternates: true, alternateKey: "1h_rushing_yards_alternate", alwaysFetchAlternate: true },
    
    // Additional Scoring Markets
    { value: "1q_player_touchdowns", label: "Player Touchdowns (1Q)", apiKey: "1q_player_touchdowns", group: "Scoring", period: '1q' },
    { value: "1h_player_touchdowns", label: "Player Touchdowns (1H)", apiKey: "1h_player_touchdowns", group: "Scoring", period: '1h' },
    { value: "2h_player_touchdowns", label: "Player Touchdowns (2H)", apiKey: "2h_player_touchdowns", group: "Scoring", period: '2h' },
    { value: "2nd_half_first_touchdown_scorer", label: "First TD Scorer (2H)", apiKey: "2nd_half_first_touchdown_scorer", group: "Scoring", period: '2h' },
    { value: "3q_player_touchdowns", label: "Player Touchdowns (3Q)", apiKey: "3q_player_touchdowns", group: "Scoring", period: '3q' },
    { value: "both_halves_player_touchdowns", label: "Player TDs (Both Halves)", apiKey: "both_halves_player_touchdowns", group: "Scoring", period: 'both_halves' },
  
    // Defense
    { value: "player_defensive_interceptions", label: "Defensive Interceptions", apiKey: "player_defensive_interceptions", group: "Defense", period: 'full' },
    { value: "player_sacks", label: "Sacks", apiKey: "player_sacks", group: "Defense", period: 'full' },
    { value: "player_tackles_and_assists", label: "Tackles + Assists", apiKey: "player_tackles_and_assists", group: "Defense", period: 'full' },
    { value: "1st_quarter_player_interceptions_thrown", label: "Interceptions Thrown (1Q)", apiKey: "1st_quarter_player_interceptions_thrown", group: "Passing", period: '1q' },
  
    // Kicking (Moved to bottom as least popular)
    { value: "player_field_goals_made", label: "Field Goals Made", apiKey: "player_field_goals_made", group: "Kicking", period: 'full' },
    { value: "player_extra_points_made", label: "Extra Points Made", apiKey: "player_extra_points_made", group: "Kicking", period: 'full' },
    { value: "player_kicking_points", label: "Kicking Points", apiKey: "player_kicking_points", group: "Kicking", period: 'full' },
    { value: "1st_half_player_field_goals_made", label: "Field Goals Made (1H)", apiKey: "1st_half_player_field_goals_made", group: "Kicking", period: '1h' }
  ];

  // Soccer (EPL) markets
  // Note: Our data feed currently includes keys like odds:soccer_epl:*:player_goals:*
  // Keep this list small + correct; we can expand as more EPL market keys appear.
  const SOCCER_EPL_MARKETS: SportMarket[] = [
    // Game-level markets
    { value: "Moneyline 3-Way", label: "Moneyline 3-Way", apiKey: "moneyline_3way", group: "Game", period: "full" },
    { value: "Draw No Bet", label: "Draw No Bet", apiKey: "draw_no_bet", group: "Game", period: "full" },
    { value: "Total Goals", label: "Total Goals", apiKey: "total_goals", group: "Game", period: "full" },
    { value: "Total Goals Odd/Even", label: "Total Goals Odd/Even", apiKey: "total_goals_odd_even", group: "Game", period: "full" },
    { value: "Both Teams To Score", label: "Both Teams To Score", apiKey: "both_teams_to_score", group: "Game", period: "full" },

    // Player props
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
      },
      {
        value: "First_Goal_Scorer",
        label: "1st Goal",
        apiKey: "player_first_goal",
        group: "Scoring",
        period: 'full',
      },
      {
        value: "Last_Goal_Scorer",
        label: "Last Goal",
        apiKey: "player_last_goal",
        group: "Scoring",
        period: 'full',
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
      { value: "Shutout", label: "Shutout", apiKey: "player_shutout", group: "Goalie", period: 'full' },

      // 1st Period player props
      { value: "1st Period Player Goals", label: "Goals - 1st Period", apiKey: "1st_period_player_goals", group: "Skater", period: 'p1' },
      { value: "1st Period Player Assists", label: "Assists - 1st Period", apiKey: "1st_period_player_assists", group: "Skater", period: 'p1' },
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
    ]
  };
  
  // Export supported sports array
  export const SUPPORTED_SPORTS = ['mlb', 'nba', 'wnba', 'ncaab', 'nfl', 'ncaaf', 'nhl'] as const;
  
// Canonical mapping for market display names → internal API keys
// Maps backend market names to frontend API keys for consistent routing
export const MARKET_NAME_MAP: Record<string, string> = {
  // Basketball player markets
  'Player Points': 'player_points',
  'player-points': 'player_points',
  'Player Rebounds': 'player_rebounds',
  'player-rebounds': 'player_rebounds',
  'Player Assists': 'player_assists',
  'player-assists': 'player_assists',
  'Player Points + Rebounds + Assists': 'player_points_rebounds_assists',
  'player-points-rebounds-assists': 'player_points_rebounds_assists',
  'Player Points + Rebounds': 'player_points_rebounds',
  'player-points-rebounds': 'player_points_rebounds',
  'Player Points + Assists': 'player_points_assists',
  'player-points-assists': 'player_points_assists',
  'Player Rebounds + Assists': 'player_rebounds_assists',
  'player-rebounds-assists': 'player_rebounds_assists',
  'Player Threes': 'player_threes_made',
  'Player Three Pointers': 'player_threes_made',
  'Player 3-Point Field Goals': 'player_threes_made',
  'Player Threes Made': 'player_threes_made',
  'player-threes-made': 'player_threes_made',
  'Player Blocks': 'player_blocks',
  'player-blocks': 'player_blocks',
  'Player Steals': 'player_steals',
  'player-steals': 'player_steals',
  'Player Blocks + Steals': 'player_blocks_steals',
  'Player Turnovers': 'player_turnovers',
  'player-turnovers': 'player_turnovers',
  'First Basket': 'first_field_goal',
  'first-basket': 'first_field_goal',
  'First Field Goal': 'first_field_goal',
  'first-field-goal': 'first_field_goal',
  'Home Team First Field Goal': 'home_team_first_field_goal',
  'home-team-first-field-goal': 'home_team_first_field_goal',
  'Home Team First Basket': 'home_team_first_field_goal',
  'Away Team First Field Goal': 'away_team_first_field_goal',
  'away-team-first-field-goal': 'away_team_first_field_goal',
  'Away Team First Basket': 'away_team_first_field_goal',
  'Player Double-Double': 'player_double_double',
  'player-double-double': 'player_double_double',
  'Player Triple-Double': 'player_triple_double',
  'player-triple-double': 'player_triple_double',
  'Top Points Scorer': 'top_points_scorer',
  'top-points-scorer': 'top_points_scorer',
  '1st Quarter Player Points': '1q_player_points',
  '1st-quarter-player-points': '1q_player_points',
  
  // Basketball game markets
  'Moneyline': 'moneyline',
  'moneyline': 'moneyline',
  'Point Spread': 'spread',
  'point-spread': 'spread',
  'Total Points': 'total',
  'total-points': 'total',
  'Total Points Odd/Even': 'total_points_odd_even',
  'total-points-odd-even': 'total_points_odd_even',
  'Overtime?': 'overtime',
  'overtime': 'overtime',
  '1st Half Moneyline': '1h_moneyline',
  '1st-half-moneyline': '1h_moneyline',
  '1st Half Point Spread': '1h_spread',
  '1st-half-point-spread': '1h_spread',
  '1st Half Total Points': '1h_total',
  '1st-half-total-points': '1h_total',
  '2nd Half Total Points': '2h_total',
  '2nd-half-total-points': '2h_total',
  '1st Quarter Moneyline': '1q_moneyline',
  '1st-quarter-moneyline': '1q_moneyline',
  '1st Quarter Point Spread': '1q_spread',
  '1st-quarter-point-spread': '1q_spread',
  '1st Quarter Total Points': '1q_total',
  '1st-quarter-total-points': '1q_total',
  '2nd Quarter Moneyline': '2q_moneyline',
  '2nd-quarter-moneyline': '2q_moneyline',
  '2nd Quarter Point Spread': '2q_spread',
  '2nd-quarter-point-spread': '2q_spread',
  '2nd Quarter Total Points': '2q_total',
  '2nd-quarter-total-points': '2q_total',
  '3rd Quarter Moneyline': '3q_moneyline',
  '3rd-quarter-moneyline': '3q_moneyline',
  '3rd Quarter Point Spread': '3q_spread',
  '3rd-quarter-point-spread': '3q_spread',
  '3rd Quarter Total Points': '3q_total',
  '3rd-quarter-total-points': '3q_total',
  '4th Quarter Moneyline': '4q_moneyline',
  '4th-quarter-moneyline': '4q_moneyline',
  '4th Quarter Point Spread': '4q_spread',
  '4th-quarter-point-spread': '4q_spread',
  '4th Quarter Total Points': '4q_total',
  '4th-quarter-total-points': '4q_total',
  
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
      // Basketball
      'player_points': 'PTS',
      'player_rebounds': 'REB',
      'player_assists': 'AST',
      'player_threes_made': '3PM',
      'player_points_rebounds_assists': 'PRA',
      'player_points_rebounds': 'P+R',
      'player_points_assists': 'P+A',
      'player_rebounds_assists': 'R+A',
      'player_steals': 'STL',
      'player_blocks': 'BLK',
      'player_blocks_steals': 'B+S',
      'player_turnovers': 'TO',
      'player_double_double': 'DD',
      'player_triple_double': 'TD',
      
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
      // Basketball
      'player_points': 'Points',
      'player_rebounds': 'Rebounds',
      'player_assists': 'Assists',
      'player_points_rebounds_assists': 'PRA',
      'player_points_rebounds': 'PR',
      'player_points_assists': 'PA',
      'player_rebounds_assists': 'RA',
      'player_threes_made': "3's Made",
      'player_threes': "3's Made",
      'player_blocks': 'Blocks',
      'player_steals': 'Steals',
      'player_blocks_steals': 'Blk+Stl',
      'player_turnovers': 'Turnovers',
      'player_double_double': 'Double Double',
      'player_triple_double': 'Triple Double',
      
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
  export function getDefaultMarket(sport: string): string {
    const markets = SUPPORTED_MARKETS[sport] || [];
    if (!markets.length) return '';
    
    // Sport-specific defaults
    switch (sport) {
      case 'mlb':
        return 'home runs';
      case 'nba':
      case 'wnba':
      case 'ncaab':
        return 'points';
      case 'nfl':
      case 'ncaaf':
        return 'anytime touchdown scorer';
      case 'nhl':
        return 'goals';
      default:
        return markets[0];
    }
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
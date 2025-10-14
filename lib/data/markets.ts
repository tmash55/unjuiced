export interface SportMarket {
    value: string;
    label: string;
    apiKey: string; // The key used in the API request
    hasAlternates?: boolean; // Indicates if this market has alternate lines
    alternateKey?: string; // The API key for alternate lines
    alwaysFetchAlternate?: boolean; // Indicates if we should always fetch both standard and alternate markets
    // Optional metadata for grouping/filtering in UI
    group?: string; // e.g., 'Passing', 'Receiving', 'Rushing', 'Kicking', 'Defense', 'Scoring', 'Combo'
    period?: 'full' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h' | 'both_halves';
    periodLabel?: string; // e.g., '1Q', '1H', 'Both Halves'
  }
  
  export interface SportMarkets {
    [key: string]: SportMarket[];
  }
  
  // Common market definitions for reuse
  const BASKETBALL_MARKETS: SportMarket[] = [
    // Game-level markets
    { value: "Moneyline", label: "Moneyline", apiKey: "h2h" },
    { value: "Spread", label: "Point Spread", apiKey: "spreads" },
    { value: "Total", label: "Total Points", apiKey: "totals" },
    
    // Player props
    {
      value: "Points",
      label: "Points",
      apiKey: "player_points",
      hasAlternates: true,
      alternateKey: "player_points_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Rebounds",
      label: "Rebounds",
      apiKey: "player_rebounds",
      hasAlternates: true,
      alternateKey: "player_rebounds_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Assists",
      label: "Assists",
      apiKey: "player_assists",
      hasAlternates: true,
      alternateKey: "player_assists_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Threes",
      label: "Threes",
      apiKey: "player_threes",
      hasAlternates: true,
      alternateKey: "player_threes_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "PRA",
      label: "Pts+Reb+Ast",
      apiKey: "player_points_rebounds_assists",
      hasAlternates: true,
      alternateKey: "player_points_rebounds_assists_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Points_Rebounds",
      label: "Pts+Reb",
      apiKey: "player_points_rebounds",
      hasAlternates: true,
      alternateKey: "player_points_rebounds_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Points_Assists",
      label: "Pts+Ast",
      apiKey: "player_points_assists",
      hasAlternates: true,
      alternateKey: "player_points_assists_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Rebounds_Assists",
      label: "Reb+Ast",
      apiKey: "player_rebounds_assists",
      hasAlternates: true,
      alternateKey: "player_rebounds_assists_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Double_Double",
      label: "Double Double",
      apiKey: "player_double_double",
    },
    {
      value: "Triple_Double",
      label: "Triple Double",
      apiKey: "player_triple_double",
    },
    {
      value: "Blocks",
      label: "Blocks",
      apiKey: "player_blocks",
      hasAlternates: true,
      alternateKey: "player_blocks_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Steals",
      label: "Steals",
      apiKey: "player_steals",
      hasAlternates: true,
      alternateKey: "player_steals_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "Blocks_steals",
      label: "Blocks+Steals",
      apiKey: "player_blocks_steals",
    },
    {
      value: "Turnovers",
      label: "Turnovers",
      apiKey: "player_turnovers",
      hasAlternates: true,
      alternateKey: "player_turnovers_alternate",
      alwaysFetchAlternate: true,
    },
    {
      value: "First_Team_Basket",
      label: "Team First Point",
      apiKey: "player_first_team_basket",
    },
    {
      value: "First_Field_Goal",
      label: "First Point",
      apiKey: "player_first_basket",
    },
    {
      value: "Player_Points_Q1",
      label: "Points - 1st Quarter",
      apiKey: "player_points_q1",
    },
    {
      value: "Player_Assists_Q1",
      label: "Assists- 1st Quarter",
      apiKey: "player_assists_q1",
    },
    {
      value: "Player_Rebounds_Q1",
      label: "Rebounds - 1st Quarter",
      apiKey: "player_rebounds_q1",
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
    { value: "2nd_half_total_points_reg_time", label: "2nd Half Total (Reg Time)", apiKey: "2nd_half_total_points_reg_time", group: "Halves", period: '2h' },
    
    // Touchdowns
    { value: "total_touchdowns", label: "Total Touchdowns", apiKey: "total_touchdowns", group: "Touchdowns", period: 'full' },
    { value: "1st_half_total_touchdowns", label: "Total TDs (1H)", apiKey: "1st_half_total_touchdowns", group: "Touchdowns", period: '1h' },
    { value: "2nd_half_total_touchdowns", label: "Total TDs (2H)", apiKey: "2nd_half_total_touchdowns", group: "Touchdowns", period: '2h' },
    { value: "1st_quarter_total_touchdowns", label: "Total TDs (1Q)", apiKey: "1st_quarter_total_touchdowns", group: "Touchdowns", period: '1q' },
    { value: "1st_half_home_team_total_touchdowns", label: "Home Team TDs (1H)", apiKey: "1st_half_home_team_total_touchdowns", group: "Touchdowns", period: '1h' },
    { value: "1st_half_away_team_total_touchdowns", label: "Away Team TDs (1H)", apiKey: "1st_half_away_team_total_touchdowns", group: "Touchdowns", period: '1h' },
    { value: "total_td_yards", label: "Total TD Yards", apiKey: "total_td_yards", group: "Touchdowns", period: 'full' },
    { value: "longest_td_yards", label: "Longest TD Yards", apiKey: "longest_td_yards", group: "Touchdowns", period: 'full' },
    { value: "shortest_td_yards", label: "Shortest TD Yards", apiKey: "shortest_td_yards", group: "Touchdowns", period: 'full' },
    { value: "first_td_yards", label: "First TD Yards", apiKey: "first_td_yards", group: "Touchdowns", period: 'full' },
    
    // Field Goals & Kicking
    { value: "total_fgs", label: "Total Field Goals", apiKey: "total_fgs", group: "Field Goals", period: 'full' },
    { value: "1h_total_fgs", label: "Total FGs (1H)", apiKey: "1h_total_fgs", group: "Field Goals", period: '1h' },
    { value: "2h_total_fgs", label: "Total FGs (2H)", apiKey: "2h_total_fgs", group: "Field Goals", period: '2h' },
    { value: "total_fg_yards", label: "Total FG Yards", apiKey: "total_fg_yards", group: "Field Goals", period: 'full' },
    { value: "longest_field_goal_made_yards", label: "Longest FG Yards", apiKey: "longest_field_goal_made_yards", group: "Field Goals", period: 'full' },
    { value: "shortest_field_goal_made_yards", label: "Shortest FG Yards", apiKey: "shortest_field_goal_made_yards", group: "Field Goals", period: 'full' },
    
    // Special Plays
    { value: "safety", label: "Safety", apiKey: "safety", group: "Special", period: 'full' },
    { value: "home_safety", label: "Home Team Safety", apiKey: "home_safety", group: "Special", period: 'full' },
    { value: "away_safety", label: "Away Team Safety", apiKey: "away_safety", group: "Special", period: 'full' },
    { value: "2pt_attempt", label: "2-Point Attempt", apiKey: "2pt_attempt", group: "Special", period: 'full' },
    { value: "2pt_conversion", label: "2-Point Conversion", apiKey: "2pt_conversion", group: "Special", period: 'full' },
    { value: "overtime", label: "Overtime", apiKey: "overtime", group: "Special", period: 'full' },
    
    // Other
    { value: "total_punts", label: "Total Punts", apiKey: "total_punts", group: "Other", period: 'full' },
    { value: "largest_lead", label: "Largest Lead", apiKey: "largest_lead", group: "Other", period: 'full' },
    { value: "first_score_yards", label: "First Score Yards", apiKey: "first_score_yards", group: "Other", period: 'full' },
    { value: "1st_quarter_both_teams_to_score", label: "Both Teams Score (1Q)", apiKey: "1st_quarter_both_teams_to_score", group: "Other", period: '1q' },
  
    // Player props
    // Passing
    { value: "passing_yards", label: "Passing Yards", apiKey: "passing_yards", group: "Passing", period: 'full', hasAlternates: true },
    { value: "passing_tds", label: "Passing Touchdowns", apiKey: "passing_tds", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_attempts", label: "Pass Attempts", apiKey: "pass_attempts", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_completions", label: "Pass Completions", apiKey: "pass_completions", group: "Passing", period: 'full', hasAlternates: true },
    { value: "pass_interceptions", label: "Interceptions Thrown", apiKey: "pass_interceptions", group: "Passing", period: 'full', hasAlternates: true },
    { value: "longest_pass", label: "Longest Pass Completion", apiKey: "longest_pass", group: "Passing", period: 'full' },
    { value: "1q_passing_yards", label: "Passing Yards (1Q)", apiKey: "1q_passing_yards", group: "Passing", period: '1q' },
    { value: "1st_quarter_passing_completions", label: "Pass Completions (1Q)", apiKey: "1st_quarter_passing_completions", group: "Passing", period: '1q' },
    { value: "1q_pass_attempts", label: "Pass Attempts (1Q)", apiKey: "1q_pass_attempts", group: "Passing", period: '1q' },
    { value: "1h_passing_yards", label: "Passing Yards (1H)", apiKey: "1h_passing_yards", group: "Passing", period: '1h' },
    { value: "1st_half_player_passing_touchdowns", label: "Passing TDs (1H)", apiKey: "1st_half_player_passing_touchdowns", group: "Passing", period: '1h' },
  
    // Receiving
    { value: "receiving_yards", label: "Receiving Yards", apiKey: "receiving_yards", group: "Receiving", period: 'full', hasAlternates: true },
    { value: "receptions", label: "Receptions", apiKey: "receptions", group: "Receiving", period: 'full', hasAlternates: true },
    { value: "longest_reception", label: "Longest Reception", apiKey: "longest_reception", group: "Receiving", period: 'full' },
    { value: "1q_receiving_yards", label: "Receiving Yards (1Q)", apiKey: "1q_receiving_yards", group: "Receiving", period: '1q' },
    { value: "1st_half_player_receiving_yards", label: "Receiving Yards (1H)", apiKey: "1st_half_player_receiving_yards", group: "Receiving", period: '1h' },
  
    // Rushing
    { value: "rushing_yards", label: "Rushing Yards", apiKey: "rushing_yards", group: "Rushing", period: 'full', hasAlternates: true },
    { value: "rush_attempts", label: "Rush Attempts", apiKey: "rush_attempts", group: "Rushing", period: 'full', hasAlternates: true },
    { value: "longest_rush", label: "Longest Rush", apiKey: "longest_rush", group: "Rushing", period: 'full' },
    { value: "1q_rushing_yards", label: "Rushing Yards (1Q)", apiKey: "1q_rushing_yards", group: "Rushing", period: '1q' },
    { value: "1q_rush_attempts", label: "Rush Attempts (1Q)", apiKey: "1q_rush_attempts", group: "Rushing", period: '1q' },
    { value: "1h_rushing_yards", label: "Rushing Yards (1H)", apiKey: "1h_rushing_yards", group: "Rushing", period: '1h' },
  
    // Combo
    { value: "pass_rush_yards", label: "Pass + Rush Yards", apiKey: "pass_rush_yards", group: "Combo", period: 'full' },
    { value: "rush_rec_yards", label: "Rush + Reception Yards", apiKey: "rush_rec_yards", group: "Combo", period: 'full' },
    { value: "1st_quarter_player_passing_+_rushing_yards", label: "Pass + Rush Yards (1Q)", apiKey: "1st_quarter_player_passing_+_rushing_yards", group: "Combo", period: '1q' },
  
    // Scoring
    { value: "player_touchdowns", label: "Player Touchdowns", apiKey: "player_touchdowns", group: "Scoring", period: 'full' },
    { value: "1q_player_touchdowns", label: "Player Touchdowns (1Q)", apiKey: "1q_player_touchdowns", group: "Scoring", period: '1q' },
    { value: "1h_player_touchdowns", label: "Player Touchdowns (1H)", apiKey: "1h_player_touchdowns", group: "Scoring", period: '1h' },
    { value: "2h_player_touchdowns", label: "Player Touchdowns (2H)", apiKey: "2h_player_touchdowns", group: "Scoring", period: '2h' },
    { value: "3q_player_touchdowns", label: "Player Touchdowns (3Q)", apiKey: "3q_player_touchdowns", group: "Scoring", period: '3q' },
    { value: "both_halves_player_touchdowns", label: "Player TDs (Both Halves)", apiKey: "both_halves_player_touchdowns", group: "Scoring", period: 'both_halves' },
    { value: "first_td", label: "First TD Scorer", apiKey: "first_td", group: "Scoring", period: 'full' },
    { value: "last_td", label: "Last TD Scorer", apiKey: "last_td", group: "Scoring", period: 'full' },
    { value: "2nd_half_first_touchdown_scorer", label: "First TD Scorer (2H)", apiKey: "2nd_half_first_touchdown_scorer", group: "Scoring", period: '2h' },
  
    // Defense
    { value: "player_defensive_interceptions", label: "Defensive Interceptions", apiKey: "player_defensive_interceptions", group: "Defense", period: 'full' },
    { value: "player_sacks", label: "Sacks", apiKey: "player_sacks", group: "Defense", period: 'full' },
    { value: "player_tackles_and_assists", label: "Tackles + Assists", apiKey: "player_tackles_and_assists", group: "Defense", period: 'full' },
    { value: "1st_quarter_player_interceptions_thrown", label: "Interceptions Thrown (1Q)", apiKey: "1st_quarter_player_interceptions_thrown", group: "Passing", period: '1q' },
  
    // Kicking
    { value: "player_field_goals_made", label: "Field Goals Made", apiKey: "player_field_goals_made", group: "Kicking", period: 'full' },
    { value: "player_extra_points_made", label: "Extra Points Made", apiKey: "player_extra_points_made", group: "Kicking", period: 'full' },
    { value: "player_kicking_points", label: "Kicking Points", apiKey: "player_kicking_points", group: "Kicking", period: 'full' },
    { value: "1st_half_player_field_goals_made", label: "Field Goals Made (1H)", apiKey: "1st_half_player_field_goals_made", group: "Kicking", period: '1h' }
  ];
  
  export const SPORT_MARKETS: SportMarkets = {
    basketball_nba: BASKETBALL_MARKETS,
    basketball_wnba: BASKETBALL_MARKETS,
    basketball_ncaab: BASKETBALL_MARKETS,
    football_nfl: FOOTBALL_MARKETS,
    football_ncaaf: FOOTBALL_MARKETS,
    baseball_mlb: [
      // Game-level markets
      { value: "Moneyline", label: "Moneyline", apiKey: "h2h" },
      { value: "Spread", label: "Run Line", apiKey: "spreads" },
      { value: "Total", label: "Total Runs", apiKey: "totals" },
      
      // Batter Props
      {
        value: "Home_Runs",
        label: "Home Runs",
        apiKey: "batter_home_runs",
        hasAlternates: true,
        alternateKey: "batter_home_runs_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Hits",
        label: "Hits",
        apiKey: "batter_hits",
        hasAlternates: true,
        alternateKey: "batter_hits_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Total_Bases",
        label: "Total Bases",
        apiKey: "batter_total_bases",
        hasAlternates: true,
        alternateKey: "batter_total_bases_alternate",
        alwaysFetchAlternate: true,
      },
  
      {
        value: "RBIs",
        label: "RBIs",
        apiKey: "batter_rbis",
        hasAlternates: true,
        alternateKey: "batter_rbis_alternate",
        alwaysFetchAlternate: true,
      },
      { value: "Runs", label: "Runs Scored", apiKey: "batter_runs_scored" },
      { value: "Walks", label: "Walks", apiKey: "batter_walks" },
      { value: "Singles", label: "Singles", apiKey: "batter_singles" },
      { value: "Doubles", label: "Doubles", apiKey: "batter_doubles" },
      { value: "Triples", label: "Triples", apiKey: "batter_triples" },
      { value: "Stolen_Bases", label: "Stolen Bases", apiKey: "batter_stolen_bases" },
      {
        value: "Extra_Base_Hits",
        label: "Extra Base Hits",
        apiKey: "batter_extra_base_hits",
      },
      {
        value: "Hits_Runs_RBIs",
        label: "Hits + Runs + RBIs",
        apiKey: "batter_hits_runs_rbis",
      },
      {
        value: "Batter_First_Home_Run",
        label: "1st Home Run",
        apiKey: "batter_first_home_run",
      },
  
      // Pitcher Props
      {
        value: "Strikeouts",
        label: "Strikeouts",
        apiKey: "pitcher_strikeouts",
        hasAlternates: true,
        alternateKey: "pitcher_strikeouts_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Hits_Allowed",
        label: "Hits Allowed",
        apiKey: "pitcher_hits_allowed",
        hasAlternates: true,
        alternateKey: "pitcher_hits_allowed_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Walks_Allowed",
        label: "Walks Allowed",
        apiKey: "pitcher_walks",
        hasAlternates: true,
        alternateKey: "pitcher_walks_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Earned_Runs",
        label: "Earned Runs",
        apiKey: "pitcher_earned_runs",
      },
      { value: "Outs_Recorded", label: "Outs Recorded", apiKey: "pitcher_outs" },
      {
        value: "Pitches_Thrown",
        label: "Pitches Thrown",
        apiKey: "pitcher_pitches_thrown",
      },
    ],
    icehockey_nhl: [
      // Game-level markets
      { value: "Moneyline", label: "Moneyline", apiKey: "h2h" },
      { value: "Spread", label: "Puck Line", apiKey: "spreads" },
      { value: "Total", label: "Total Goals", apiKey: "totals" },
      
      // Player props
      {
        value: "Points",
        label: "Points",
        apiKey: "player_points",
        hasAlternates: true,
        alternateKey: "player_points_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Shots",
        label: "Shots on Goal",
        apiKey: "player_shots_on_goal",
        hasAlternates: true,
        alternateKey: "player_shots_on_goal_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Goals",
        label: "Goals",
        apiKey: "player_goals",
        hasAlternates: true,
        alternateKey: "player_goals_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Assists",
        label: "Assists",
        apiKey: "player_assists",
        hasAlternates: true,
        alternateKey: "player_assists_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Power_Play_Points",
        label: "Power Play Points",
        apiKey: "player_power_play_points",
        hasAlternates: true,
        alternateKey: "player_power_play_points_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Blocked_Shots",
        label: "Blocked Shots",
        apiKey: "player_blocked_shots",
        hasAlternates: true,
        alternateKey: "player_blocked_shots_alternate",
        alwaysFetchAlternate: true,
      },
      {
        value: "Total_Saves",
        label: "Total Saves",
        apiKey: "player_total_saves",
        hasAlternates: true,
        alternateKey: "player_total_saves_alternate",
        alwaysFetchAlternate: true,
      },
  
      {
        value: "First_Goal_Scorer",
        label: "First Goal",
        apiKey: "player_goal_scorer_first",
      },
      {
        value: "Last_Goal_Scorer",
        label: "Last Goal",
        apiKey: "player_goal_scorer_last",
      },
      {
        value: "Anytime_Goal_Scorer",
        label: "Anytime Goal",
        apiKey: "player_goal_scorer_anytime",
      },
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
      'anytime goal', // Set as default
      'points',
      'goals',
      'assists',
      'shots on goal',
      'power play points',
      'blocked shots',
      'total saves',
      'first goal',
      'last goal'
    ]
  };
  
  // Export supported sports array
  export const SUPPORTED_SPORTS = ['mlb', 'nba', 'wnba', 'ncaab', 'nfl', 'ncaaf', 'nhl'] as const;
  
  // Helper function to format market labels with special cases
  export function formatMarketLabel(market: string): string {
    // Special case mappings
    const specialCases: Record<string, string> = {
      'rbis': 'RBIs',
      'hits + runs + rbis': 'Hits + Runs + RBIs',
      'pra': 'Points + Rebounds + Assists',
      'pr': 'Points + Rebounds',
      'pa': 'Points + Assists',
      'ra': 'Rebounds + Assists',
      'bs': 'Blocks + Steals',
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
  
    return market
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
        return 'anytime goal';
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
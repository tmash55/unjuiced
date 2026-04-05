// Types for the Pitcher Weakness API response

// Batting order split (b1-b9) — how pitcher performs vs each lineup spot
export interface BattingOrderSplit {
  slot: string; // "b1" through "b9"
  slot_label: string; // "1st", "2nd", etc.
  ip: number | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null; // slg - avg
  whip: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hr: number;
  doubles: number;
  triples: number;
  rbi: number;
  pa: number;
}

// Inning split (i01-i09) — how pitcher performs per inning
export interface InningSplit {
  inning: string; // "i01" through "i09", "ix" for extras
  inning_label: string; // "1st", "2nd", etc.
  ip: number | null;
  avg: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null;
  whip: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  era: number | null;
  hr: number;
  pa: number;
}

// Pitcher hand split aggregate
export interface PitcherHandSplit {
  hand: "L" | "R";
  pa: number;
  avg: number | null;
  slg: number | null;
  ops: number | null;
  whip: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  hr: number;
}

// Pitcher headline stats
export interface PitcherHeadline {
  era: number | null;
  whip: number | null;
  k_per_9: number | null;
  bb_per_9: number | null;
  hr_per_9: number | null;
  ip: number | null;
  wins: number;
  losses: number;
  games_started: number;
}

// Full pitcher data
export interface PitcherData {
  player_id: number;
  name: string;
  hand: string; // "L" or "R"
  team_abbr: string;
  headline: PitcherHeadline;
  batting_order_splits: BattingOrderSplit[];
  inning_splits: InningSplit[];
  hand_splits: {
    vs_lhb: PitcherHandSplit | null;
    vs_rhb: PitcherHandSplit | null;
  };
}

// Batter odds from Redis
export interface BatterOdds {
  hr: {
    best_price: number;
    best_book: string;
    link: string | null;
    mobile_link: string | null;
  } | null;
  hits: {
    best_price: number;
    best_book: string;
    link: string | null;
    mobile_link: string | null;
  } | null;
  strikeouts: {
    best_price: number;
    best_book: string;
    link: string | null;
    mobile_link: string | null;
  } | null;
}

// Lineup batter with edge score
export interface LineupBatter {
  player_id: number;
  player_name: string;
  batting_order: number;
  bats: string; // "L", "R", "S"
  edge_score: number; // 0-100
  edge_tier: "strong_edge" | "edge" | "mild" | "neutral" | "no_edge";
  season_ops: number | null;
  season_avg: number | null;
  season_slg: number | null;
  season_hr: number;
  l7_trend: "hot" | "cold" | null; // based on L7 OPS vs season
  bvp: { pa: number; avg: number | null; hr: number } | null;
  odds: BatterOdds;
  // Batter's stats at their current batting order position
  spot_stats: BatterSpotStats | null;
  // All batting order spot stats (b1-b9) for dropdown selector
  all_spot_stats: Record<string, BatterSpotStats>;
}

export interface BatterSpotStats {
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  iso: number | null;
  hr: number;
  doubles: number;
  triples: number;
  rbi: number;
  k_pct: number | null;
  bb_pct: number | null;
  pa: number;
}

// Game info
export interface GameInfo {
  game_id: number;
  game_date: string;
  game_datetime: string | null;
  venue_name: string | null;
  home_team_abbr: string;
  away_team_abbr: string;
  home_team_name: string;
  away_team_name: string;
  weather: {
    temperature_f: number | null;
    wind_speed_mph: number | null;
    wind_label: string | null;
    wind_impact: string | null;
    roof_type: string | null;
  } | null;
  odds: {
    home_ml: string | null;
    away_ml: string | null;
    total: number | null;
  } | null;
}

// Full response
export interface PitcherWeaknessResponse {
  game: GameInfo;
  away_pitcher: PitcherData | null;
  home_pitcher: PitcherData | null;
  away_lineup: LineupBatter[];
  home_lineup: LineupBatter[];
  meta: {
    season: number;
    lineup_confirmed_away: boolean;
    lineup_confirmed_home: boolean;
  };
}

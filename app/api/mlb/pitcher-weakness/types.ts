// ── Pitcher Weakness Report Types ─────────────────────────────────────────

export interface InningBreakdown {
  inning: number;
  batters_faced: number;
  whiff_rate: number;
  in_play_count: number;
}

export interface ArsenalVsHand {
  pitch_type: string;
  opponent_hand: "L" | "R";
  pa: number;
  ab: number;
  ba: number | null;
  slg: number | null;
  woba: number | null;
  xwoba: number | null;
  whiff_percent: number | null;
  k_percent: number | null;
  barrel_percent: number | null;
  hard_hit_percent: number | null;
  iso: number | null;
  hits: number;
  home_runs: number;
  is_weak_spot: boolean;
}

export interface HandSplit {
  opponent_hand: "L" | "R";
  pa: number;
  ba: number | null;
  slg: number | null;
  woba: number | null;
  k_percent: number | null;
  bb_percent: number | null;
  hr: number;
}

export interface PitcherInfo {
  player_id: number;
  name: string;
  team_id: number;
  throw_hand: string;
}

export interface PitcherWeaknessReport {
  pitcher: PitcherInfo;
  inning_breakdown: InningBreakdown[];
  arsenal_vs_hand: ArsenalVsHand[];
  hand_splits: HandSplit[];
}

// ── Lineup Matchup Edge Types ────────────────────────────────────────────

export interface StatLine {
  pa: number | null;
  ab?: number | null;
  avg: number | null;
  slg: number | null;
  ops: number | null;
  hr: number | null;
}

export interface BvPStats {
  pa: number;
  avg: number | null;
  slg: number | null;
  ops: number | null;
  hr: number;
  so: number;
}

export interface PitchMatchup {
  pitch_type: string;
  batter_slg: number | null;
  pitcher_slg: number | null;
  batter_woba: number | null;
  pitcher_woba: number | null;
  batter_barrel: number | null;
  pitcher_barrel: number | null;
  batter_whiff: number | null;
  pitcher_whiff: number | null;
  edge: "green" | "red" | "yellow" | "neutral";
}

export interface OddsLine {
  market: string;
  line: number | null;
  over_price: number | null;
  under_price: number | null;
  book: string;
}

export interface BatterEdge {
  player_id: number;
  player_name: string;
  batting_order: number;
  position: string;
  bat_hand: string;
  pitcher_hand: string;
  season: StatLine;
  l7: StatLine;
  l30: StatLine;
  hot_cold: "🔥" | "❄️" | null;
  bvp: BvPStats | null;
  pitch_matchups: PitchMatchup[];
  edge_score: number;
  edge_color: "green" | "yellow" | "red";
  odds?: OddsLine[];
}

// ── Combined Response ────────────────────────────────────────────────────

export interface PitcherWeaknessResponse {
  pitcher_report: PitcherWeaknessReport;
  lineup_edges: BatterEdge[];
  odds_game_id: string | null;
}

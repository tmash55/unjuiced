// ── NRFI Types & Helpers ─────────────────────────────────────────────────────
// Maps to Supabase tables: mlb_nrfi_grades, mlb_pitcher_first_inning,
// mlb_pitcher_first_inning_games, mlb_team_first_inning

export type Lean =
  | "strong_nrfi"
  | "nrfi"
  | "lean_nrfi"
  | "neutral"
  | "lean_yrfi"
  | "yrfi"
  | "strong_yrfi";

export function getLeanLabel(lean: Lean): string {
  switch (lean) {
    case "strong_nrfi": return "STRONG NRFI";
    case "nrfi": return "NRFI";
    case "lean_nrfi": return "LEAN NRFI";
    case "neutral": return "NEUTRAL";
    case "lean_yrfi": return "LEAN YRFI";
    case "yrfi": return "YRFI";
    case "strong_yrfi": return "STRONG YRFI";
  }
}

export const NRFI_LEANS: Lean[] = ["strong_nrfi", "nrfi", "lean_nrfi"];
export const YRFI_LEANS: Lean[] = ["strong_yrfi", "yrfi", "lean_yrfi"];

export type LeanColor = "green" | "red" | "yellow";

export function getLeanColor(lean: Lean): LeanColor {
  switch (lean) {
    case "strong_nrfi":
    case "nrfi":
    case "lean_nrfi":
      return "green";
    case "lean_yrfi":
    case "yrfi":
    case "strong_yrfi":
      return "red";
    case "neutral":
      return "yellow";
  }
}

/** Pre-computed Tailwind classes for a lean color. Call once per render, pass results down. */
export function getLeanClasses(lean: Lean) {
  const c = getLeanColor(lean);
  return {
    color: c,
    isNrfi: c === "green",
    isYrfi: c === "red",
    text:
      c === "green" ? "text-emerald-600 dark:text-emerald-400"
      : c === "red" ? "text-red-500 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400",
    badge:
      c === "green" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
      : c === "red" ? "bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/25"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25",
    bg:
      c === "green" ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
      : c === "red" ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/20"
      : "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20",
    accent:
      c === "green" ? "border-l-emerald-500/60"
      : c === "red" ? "border-l-red-500/60"
      : "border-l-amber-500/60",
    bar:
      c === "green" ? "bg-emerald-500"
      : c === "red" ? "bg-red-500"
      : "bg-amber-500",
  };
}

/** Derive lean from grade_score (0-100, higher = more NRFI) */
export function deriveLean(grade: string | null, gradeScore: number | null): Lean {
  const s = gradeScore ?? 50;
  if (s >= 80) return "strong_nrfi";
  if (s >= 65) return "nrfi";
  if (s >= 55) return "lean_nrfi";
  if (s >= 45) return "neutral";
  if (s >= 35) return "lean_yrfi";
  if (s >= 20) return "yrfi";
  return "strong_yrfi";
}

/**
 * Calculate NRFI grade score (0-100) using defined weights:
 *   35% home SP scoreless %
 *   35% away SP scoreless %
 *   10% home team scoring rate (inverted — lower scoring = higher score)
 *   10% away team scoring rate (inverted)
 *    5% park factor (inverted — lower factor = more pitcher-friendly)
 *    5% weather (inverted — less hitter-friendly = higher score)
 */
export function calculateGradeScore(inputs: {
  homeSPScorelessPct: number;   // 0-100
  awaySPScorelessPct: number;   // 0-100
  homeTeamScoringPct: number;   // 0-100
  awayTeamScoringPct: number;   // 0-100
  parkFactor: number | null;    // ~0.8 to ~1.2
  weatherScore: number;         // 0-100 (higher = more NRFI-friendly)
}): number {
  const { homeSPScorelessPct, awaySPScorelessPct, homeTeamScoringPct, awayTeamScoringPct, parkFactor, weatherScore } = inputs;

  // Pitchers: scoreless % maps directly (higher = better for NRFI)
  const homeSP = Math.min(100, Math.max(0, homeSPScorelessPct));
  const awaySP = Math.min(100, Math.max(0, awaySPScorelessPct));

  // Offense: invert — lower scoring rate = better for NRFI
  // Scoring rates typically 20-40%, map to 0-100 inverted
  const homeOff = Math.min(100, Math.max(0, 100 - homeTeamScoringPct * 2));
  const awayOff = Math.min(100, Math.max(0, 100 - awayTeamScoringPct * 2));

  // Park: factor ~1.0 is neutral, <1.0 is pitcher-friendly, >1.0 is hitter-friendly
  // Map 0.8→100, 1.0→50, 1.2→0
  const park = parkFactor != null
    ? Math.min(100, Math.max(0, (1.2 - parkFactor) * 250))
    : 50;

  const raw = homeSP * 0.35 + awaySP * 0.35 + homeOff * 0.10 + awayOff * 0.10 + park * 0.05 + weatherScore * 0.05;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/** Map grade score to letter grade */
export function scoreToGrade(score: number): string {
  if (score >= 85) return "A+";
  if (score >= 75) return "A";
  if (score >= 65) return "B+";
  if (score >= 55) return "B";
  if (score >= 45) return "C";
  if (score >= 35) return "D";
  return "F";
}

// ── Pitcher ─────────────────────────────────────────────────────────────────

export interface RecentStart {
  date: string;
  scoreless: boolean;
  opponent: string;
  isHome: boolean;
  detail: string; // e.g. "0 R, 3 K, 4 BF"
}

export interface Pitcher {
  playerId: number;
  name: string;
  team: string;
  scorelessRecord: string; // e.g. "18/24"
  scorelessPct: string;    // e.g. "75.0"
  k_pct: string;
  bb_pct: string;
  whip: string;
  era_1st: string | null;     // 1st-inning ERA proxy (runs/starts * 9)
  homeNrfiPct: string | null;
  awayNrfiPct: string | null;
  recentStarts: RecentStart[];
}

// ── Team Offense ────────────────────────────────────────────────────────────

export interface TeamOffense {
  teamId: number;
  team: string;
  pressure: "Low" | "Medium" | "High";
  scoringPct: string;      // e.g. "28.5%"
  offenseRank: number | null; // 1-30 (1 = most dangerous, 30 = safest for NRFI)
  ops: string;             // e.g. ".698"
  homePct: string;         // home 1st-inn scoring pct
  awayPct: string;         // away 1st-inn scoring pct
  l30Trend: "up" | "down" | "flat";
  l30ScoringPct: string;
}

// ── Weather ──────────────────────────────────────────────────────────────────

export interface GameWeather {
  temperatureF: number | null;
  feelsLikeF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  windLabel: string | null;       // "Out to CF", "In from RF", "Cross L→R", etc.
  windImpact: string | null;      // "favorable", "unfavorable", "neutral"
  humidityPct: number | null;
  precipProbability: number | null;
  roofType: string | null;        // "open", "retractable", "dome"
  hrImpactScore: number | null;
}

// ── Sportsbook Odds ─────────────────────────────────────────────────────────

export interface Sportsbook {
  name: string;
  nrfiOdds: string;
  yrfiOdds: string;
  link: string;
}

// ── Game Card ───────────────────────────────────────────────────────────────

export interface GameCard {
  gameId: number;
  gameDate: string;
  gameTime: string;
  lean: Lean;
  grade: string;           // "A+", "A", "B", "C", etc.
  gradeScore: number;
  awayTeam: string;
  homeTeam: string;
  awayTricode: string;
  homeTricode: string;
  awayPitcher: Pitcher;
  homePitcher: Pitcher;
  awayOffense: TeamOffense;
  homeOffense: TeamOffense;
  reasonTags: string[];
  gradeExplanation: string;
  componentScores: {
    pitching: number;
    offense: number;
    environment: number;
    price: number;
  };
  bestNrfiOdds: string;
  bestYrfiOdds: string;
  parkFactor: string;
  weather: GameWeather | null;
  weatherFlag?: string;       // short summary like "92°F · Wind Out 15mph"
  lineupStatus: "Confirmed" | "Pending";
  sportsbooks: Sportsbook[];
  // Result (post-game)
  nrfiResult: boolean | null;
  home1stRuns: number | null;
  away1stRuns: number | null;
}

// ── API Response ────────────────────────────────────────────────────────────

export interface NrfiResponse {
  games: GameCard[];
  meta: {
    date: string;
    totalGames: number;
    nrfiLeans: number;
    yrfiLeans: number;
    lastUpdated: string;
    availableDates?: string[]; // YYYY-MM-DD dates with scheduled games
  };
}

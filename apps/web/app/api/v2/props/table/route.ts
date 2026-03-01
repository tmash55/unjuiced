export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  getMarketDisplay,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";
import { resolveRedisCommandEndpoint } from "@/lib/redis-endpoints";

// Single-line markets where we show ALL players (no main line filtering)
// For these markets, each player is their own "line" - show everyone
// NOTE: These are "to score" markets with no over/under - just yes (player scores)
// Do NOT include over/under markets like player_goals (Over 0.5 goals) or player_touchdowns (Over 0.5 TDs)
const SINGLE_LINE_PLAYER_MARKETS = new Set([
  // Hockey goalscorers (single-line "to score" markets)
  "player_first_goal",
  "player_last_goal",
  "first_goalscorer",
  "last_goalscorer",
  "home_team_first_goalscorer",
  "away_team_first_goalscorer",
  "second_goalscorer",
  "third_goalscorer",
  "anytime_goalscorer",
  // Note: player_goals is an OVER/UNDER market (Over 0.5 goals) - NOT single-line
  
  // Football TD scorers (single-line "to score" markets)
  // Note: player_touchdowns is an OVER/UNDER market (Over 0.5 TDs) - NOT single-line
  "player_first_td",
  "player_last_td",
  "first_td",
  "last_td",
  "player_anytime_td", // Anytime TD scorer (single-line)
  "2nd_half_first_touchdown_scorer",
  "home_team_first_touchdown_scorer",
  "away_team_first_touchdown_scorer",
  // Note: 1st_half_player_touchdowns, 2nd_half_player_touchdowns, 1st_quarter_player_touchdowns 
  // are OVER/UNDER markets - NOT single-line
  
  // Basketball first basket
  "first_field_goal",
  "first_basket",
  "team_first_basket",
  "home_team_first_field_goal",
  "away_team_first_field_goal",
  
  // Soccer goalscorers (already listed above with hockey, same markets apply)
]);

const commandEndpoint = resolveRedisCommandEndpoint();
if (!commandEndpoint.url || !commandEndpoint.token) {
  const reason = commandEndpoint.rejectedLoopback
    ? "loopback Redis URL rejected in production"
    : "missing Redis endpoint credentials";
  throw new Error(`[v2/props/table] Redis endpoint configuration invalid: ${reason}`);
}

const redis = new Redis({
  url: commandEndpoint.url,
  token: commandEndpoint.token,
});
let invalidOddsPayloadWarnCount = 0;
const MAX_INVALID_ODDS_PAYLOAD_WARNINGS = 8;

function parseBookSelectionsValue(
  value: SSEBookSelections | string | null,
  key: string
): SSEBookSelections | null {
  if (!value) return null;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || trimmed.startsWith("<")) {
    if (invalidOddsPayloadWarnCount < MAX_INVALID_ODDS_PAYLOAD_WARNINGS) {
      invalidOddsPayloadWarnCount += 1;
      console.warn(`[v2/props/table] Skipping non-JSON odds payload for key: ${key}`);
    }
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as SSEBookSelections;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    if (invalidOddsPayloadWarnCount < MAX_INVALID_ODDS_PAYLOAD_WARNINGS) {
      invalidOddsPayloadWarnCount += 1;
      console.warn(`[v2/props/table] Skipping invalid JSON odds payload for key: ${key}`);
    }
    return null;
  }
}

const VALID_SPORTS = new Set([
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaab",
  "ncaaf",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

// OPTIMIZATION: Higher scan count = fewer round trips
const SCAN_COUNT = 1000;

// OPTIMIZATION: Known sportsbooks to construct exact keys (avoids SCAN)
const KNOWN_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm-michigan", "caesars", "pointsbet", "bet365",
  "pinnacle", "circa", "hard-rock", "bally-bet", "betrivers", "unibet",
  "wynnbet", "espnbet", "fanatics", "betparx", "thescore", "prophetx",
  "superbook", "si-sportsbook", "betfred", "tipico", "fliff",
  // Common aliases/variants seen across feeds
  "betmgm", "hardrock", "ballybet", "bally_bet", "bet-rivers", "bet_rivers"
];

// In-memory cache for odds keys (reduces SCAN frequency)
// NOTE: If odds_keys:{sport} set doesn't exist, ingestor needs to populate it
const oddsKeysCache = new Map<string, { keys: string[]; ts: number }>();
const ODDS_KEYS_CACHE_TTL = 30000; // 30 seconds - longer since SCAN fallback is expensive
const activeEventsCache = new Map<string, { ids: string[]; ts: number }>();
const ACTIVE_EVENTS_CACHE_TTL = 15000; // 15s
// In indexed deployments, scanning odds:* should be unnecessary and can be unstable on some proxies.
// Opt-in to scan fallback only when explicitly needed.
const ENABLE_ODDS_SCAN_FALLBACK = process.env.ENABLE_ODDS_SCAN_FALLBACK === "true";

/**
 * Normalize book IDs to match our canonical sportsbook IDs (from sportsbooks.ts)
 */
function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
    case "bally_bet":
      return "bally-bet";
    case "bet-rivers":
    case "bet_rivers":
      return "betrivers";
    case "sportsinteraction":
      return "sports-interaction";
    // FanDuel YourWay - matches sportsbooks.ts ID
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    // BetMGM Michigan is our preferred BetMGM source (US odds)
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

function getBookKeyCandidates(rawBook: string): string[] {
  const lower = rawBook.toLowerCase();
  const candidates = new Set<string>([lower]);

  const normalized = normalizeBookId(lower);
  candidates.add(normalized);

  // Add common separator variants for robust key lookups.
  candidates.add(lower.replace(/-/g, "_"));
  candidates.add(lower.replace(/_/g, "-"));
  candidates.add(normalized.replace(/-/g, "_"));
  candidates.add(normalized.replace(/_/g, "-"));

  // Common canonical aliases used in feeds
  if (normalized === "bally-bet") {
    candidates.add("ballybet");
    candidates.add("bally_bet");
  }
  if (normalized === "betrivers") {
    candidates.add("bet-rivers");
    candidates.add("bet_rivers");
  }
  if (normalized === "hard-rock") {
    candidates.add("hardrock");
  }

  return [...candidates].filter(Boolean);
}

// Books to exclude (Canada, regional variants)
const EXCLUDED_BOOKS = new Set([
  "hard-rock-indiana",
  "hardrockindiana",
]);

/**
 * Normalize market names to match Redis key format
 * Maps frontend-friendly names to actual Redis key market names
 */
function normalizeMarketName(market: string): string {
  const lower = market.toLowerCase();
  
  // Common shorthand → full key mapping
  const marketMap: Record<string, string> = {
    // ============ GAME LINES (All Sports) ============
    "spread": "game_spread",
    "point_spread": "game_spread",
    "pointspread": "game_spread",
    "handicap": "handicap",
    "match_handicap": "handicap",
    "1st_half_handicap": "1st_half_handicap",
    "1st_half_match_handicap": "1st_half_handicap",
    "2nd_half_handicap": "2nd_half_handicap",
    "2nd_half_match_handicap": "2nd_half_handicap",
    "run_line": "game_run_line",
    "runline": "game_run_line",
    "moneyline": "game_moneyline",
    "ml": "game_moneyline",
    "money_line": "game_moneyline",
    "total": "total_points",
    "totals": "total_points",
    "game_total": "total_points",
    "over_under": "total_points",
    "ou": "total_points",
    
    // Half/Quarter shorthands
    "1h_spread": "1st_half_point_spread",
    "1st_half_spread": "1st_half_point_spread",
    "1st_half_point_spread": "1st_half_point_spread",
    "1h_total": "1st_half_total_points",
    "1st_half_total": "1st_half_total_points",
    "1st_half_total_points": "1st_half_total_points",
    "1h_ml": "game_1h_moneyline",
    "1h_moneyline": "game_1h_moneyline",
    "game_1h_moneyline": "game_1h_moneyline",
    "1st_half_moneyline": "game_1h_moneyline",
    "1st_half_moneyline_3_way": "1st_half_moneyline_3_way",
    "1h_moneyline_3way": "1st_half_moneyline_3_way",
    "1h_moneyline_3_way": "1st_half_moneyline_3_way",
    "1h_ml_3way": "1st_half_moneyline_3_way",
    "1h_ml_3_way": "1st_half_moneyline_3_way",
    "1q_spread": "1st_quarter_point_spread",
    "1st_quarter_spread": "1st_quarter_point_spread",
    "1st_quarter_point_spread": "1st_quarter_point_spread",
    "1q_total": "1st_quarter_total_points",
    "1st_quarter_total": "1st_quarter_total_points",
    "1st_quarter_total_points": "1st_quarter_total_points",
    "1q_ml": "1st_quarter_moneyline",
    "1q_moneyline": "1st_quarter_moneyline",
    "1st_quarter_moneyline": "1st_quarter_moneyline",
    "2q_spread": "2nd_quarter_point_spread",
    "2nd_quarter_spread": "2nd_quarter_point_spread",
    "2nd_quarter_point_spread": "2nd_quarter_point_spread",
    "3q_spread": "3rd_quarter_point_spread",
    "3rd_quarter_spread": "3rd_quarter_point_spread",
    "3rd_quarter_point_spread": "3rd_quarter_point_spread",
    "4q_spread": "4th_quarter_point_spread",
    "4th_quarter_spread": "4th_quarter_point_spread",
    "4th_quarter_point_spread": "4th_quarter_point_spread",
    
    // Team totals
    "home_total": "home_team_total_points",
    "home_team_total": "home_team_total_points",
    "home_team_total_points": "home_team_total_points",
    "away_total": "away_team_total_points",
    "away_team_total": "away_team_total_points",
    "away_team_total_points": "away_team_total_points",
    "1h_home_total": "1st_half_home_team_total_points",
    "1st_half_home_team_total_points": "1st_half_home_team_total_points",
    "1h_away_total": "1st_half_away_team_total_points",
    "1st_half_away_team_total_points": "1st_half_away_team_total_points",
    
    // Touchdowns totals
    "total_touchdowns": "game_total_touchdowns",
    "game_total_touchdowns": "game_total_touchdowns",
    "1h_total_touchdowns": "1st_half_total_touchdowns",
    "1st_half_total_touchdowns": "1st_half_total_touchdowns",
    "2h_total_touchdowns": "2nd_half_total_touchdowns",
    "2nd_half_total_touchdowns": "2nd_half_total_touchdowns",
    
    // Field Goals (Game Totals)
    "total_field_goals_made": "total_field_goals_made",
    "1st_half_total_field_goals_made": "1st_half_total_field_goals_made",
    "1h_total_field_goals_made": "1st_half_total_field_goals_made",
    "2nd_half_total_field_goals_made": "2nd_half_total_field_goals_made",
    "2h_total_field_goals_made": "2nd_half_total_field_goals_made",
    "total_field_goal_yards": "total_field_goal_yards",
    "total_fg_yards": "total_field_goal_yards",
    "longest_field_goal_made_yards": "longest_field_goal_made_yards",
    "shortest_field_goal_made_yards": "shortest_field_goal_made_yards",
    
    // Overtime
    "overtime": "overtime",
    
    // 3-way moneyline
    "moneyline_3_way": "moneyline_3_way",
    "moneyline_3way": "moneyline_3_way",
    "ml_3way": "moneyline_3_way",
    
    // ============ BASKETBALL PLAYER PROPS ============
    "points": "player_points",
    "assists": "player_assists",
    "rebounds": "player_rebounds",
    "threes": "player_threes_made",
    "3pm": "player_threes_made",
    "steals": "player_steals",
    "blocks": "player_blocks",
    "turnovers": "player_turnovers",
    "pra": "player_pra",
    "pts_reb_ast": "player_pra",
    "player_points_rebounds_assists": "player_pra",
    "points_rebounds_assists": "player_pra",
    "pr": "player_pr",
    "pts_reb": "player_pr",
    "player_points_rebounds": "player_pr",
    "points_rebounds": "player_pr",
    "pa": "player_pa",
    "pts_ast": "player_pa",
    "player_points_assists": "player_pa",
    "points_assists": "player_pa",
    "ra": "player_ra",
    "reb_ast": "player_ra",
    "player_rebounds_assists": "player_ra",
    "rebounds_assists": "player_ra",
    "double_double": "player_double_double",
    "dd": "player_double_double",
    
    // ============ FOOTBALL (NFL/NCAAF) PLAYER PROPS ============
    // NOTE: Redis keys use "player_" prefix like NBA (e.g., player_passing_yards)
    
    // Passing - with and without player_ prefix for compatibility
    "passing_yards": "player_passing_yards",
    "pass_yards": "player_passing_yards",
    "player_passing_yards": "player_passing_yards",
    "passing_tds": "player_passing_tds",
    "pass_tds": "player_passing_tds",
    "passing_touchdowns": "player_passing_tds",
    "player_passing_tds": "player_passing_tds",
    "player_passing_touchdowns": "player_passing_tds",
    "pass_attempts": "player_passing_attempts",
    "passing_attempts": "player_passing_attempts",
    "player_pass_attempts": "player_passing_attempts",
    "player_passing_attempts": "player_passing_attempts",
    "pass_completions": "player_passing_completions",
    "passing_completions": "player_passing_completions",
    "completions": "player_passing_completions",
    "player_pass_completions": "player_passing_completions",
    "player_passing_completions": "player_passing_completions",
    "pass_interceptions": "player_interceptions_thrown",
    "passing_interceptions": "player_interceptions_thrown",
    "interceptions_thrown": "player_interceptions_thrown",
    "player_interceptions": "player_interceptions_thrown",
    "player_interceptions_thrown": "player_interceptions_thrown",
    "longest_pass": "player_longest_passing_completion",
    "player_longest_pass": "player_longest_passing_completion",
    "longest_passing_completion": "player_longest_passing_completion",
    "player_longest_passing_completion": "player_longest_passing_completion",
    
    // 1st Quarter Passing
    "1q_passing_yards": "1st_quarter_player_passing_yards",
    "1st_quarter_passing_yards": "1st_quarter_player_passing_yards",
    "1st_quarter_player_passing_yards": "1st_quarter_player_passing_yards",
    "1q_pass_attempts": "1st_quarter_player_passing_attempts",
    "1st_quarter_pass_attempts": "1st_quarter_player_passing_attempts",
    "1st_quarter_player_passing_attempts": "1st_quarter_player_passing_attempts",
    "1q_pass_completions": "1st_quarter_player_passing_completions",
    "1q_passing_completions": "1st_quarter_player_passing_completions",
    "1st_quarter_pass_completions": "1st_quarter_player_passing_completions",
    "1st_quarter_passing_completions": "1st_quarter_player_passing_completions",
    "1st_quarter_player_passing_completions": "1st_quarter_player_passing_completions",
    "1q_passing_tds": "1st_quarter_player_passing_touchdowns",
    "1st_quarter_passing_tds": "1st_quarter_player_passing_touchdowns",
    "1st_quarter_player_passing_touchdowns": "1st_quarter_player_passing_touchdowns",
    
    // 1st Half Passing
    "1h_passing_yards": "1st_half_player_passing_yards",
    "1st_half_passing_yards": "1st_half_player_passing_yards",
    "1st_half_player_passing_yards": "1st_half_player_passing_yards",
    "1h_pass_attempts": "1st_half_player_passing_attempts",
    "1st_half_pass_attempts": "1st_half_player_passing_attempts",
    "1st_half_player_passing_attempts": "1st_half_player_passing_attempts",
    "1st_half_player_passing_touchdowns": "1st_half_player_passing_touchdowns",
    "1h_passing_tds": "1st_half_player_passing_touchdowns",
    "1st_half_passing_tds": "1st_half_player_passing_touchdowns",
    
    // Rushing - with and without player_ prefix
    "rushing_yards": "player_rushing_yards",
    "rush_yards": "player_rushing_yards",
    "player_rushing_yards": "player_rushing_yards",
    "rush_attempts": "player_rushing_attempts",
    "rushing_attempts": "player_rushing_attempts",
    "carries": "player_rushing_attempts",
    "player_rush_attempts": "player_rushing_attempts",
    "player_rushing_attempts": "player_rushing_attempts",
    "rushing_tds": "player_rushing_touchdowns",
    "rushing_touchdowns": "player_rushing_touchdowns",
    "player_rushing_tds": "player_rushing_touchdowns",
    "player_rushing_touchdowns": "player_rushing_touchdowns",
    "longest_rush": "player_longest_rush",
    "player_longest_rush": "player_longest_rush",
    
    // 1st Quarter Rushing
    "1q_rushing_yards": "1st_quarter_player_rushing_yards",
    "1st_quarter_rushing_yards": "1st_quarter_player_rushing_yards",
    "1st_quarter_player_rushing_yards": "1st_quarter_player_rushing_yards",
    "1q_rush_attempts": "1st_quarter_player_rushing_attempts",
    "1st_quarter_rush_attempts": "1st_quarter_player_rushing_attempts",
    "1st_quarter_player_rushing_attempts": "1st_quarter_player_rushing_attempts",
    
    // 1st Half Rushing
    "1h_rushing_yards": "1st_half_player_rushing_yards",
    "1st_half_rushing_yards": "1st_half_player_rushing_yards",
    "1st_half_player_rushing_yards": "1st_half_player_rushing_yards",
    
    // Receiving - with and without player_ prefix
    "receiving_yards": "player_receiving_yards",
    "rec_yards": "player_receiving_yards",
    "player_receiving_yards": "player_receiving_yards",
    "receptions": "player_receptions",
    "catches": "player_receptions",
    "player_receptions": "player_receptions",
    "receiving_tds": "player_receiving_touchdowns",
    "receiving_touchdowns": "player_receiving_touchdowns",
    "player_receiving_tds": "player_receiving_touchdowns",
    "player_receiving_touchdowns": "player_receiving_touchdowns",
    "longest_reception": "player_longest_reception",
    "player_longest_reception": "player_longest_reception",
    
    // 1st Quarter Receiving
    "1q_receiving_yards": "1st_quarter_player_receiving_yards",
    "1st_quarter_receiving_yards": "1st_quarter_player_receiving_yards",
    "1st_quarter_player_receiving_yards": "1st_quarter_player_receiving_yards",
    "1q_receptions": "1st_quarter_player_receptions",
    "1st_quarter_receptions": "1st_quarter_player_receptions",
    "1st_quarter_player_receptions": "1st_quarter_player_receptions",
    
    // 1st Half Receiving
    "1h_receiving_yards": "1st_half_player_receiving_yards",
    "1st_half_receiving_yards": "1st_half_player_receiving_yards",
    "1st_half_player_receiving_yards": "1st_half_player_receiving_yards",
    
    // Combo stats (note: Redis uses double underscore __)
    "pass_rush_yards": "player_passing__rushing_yards",
    "passing_rushing_yards": "player_passing__rushing_yards",
    "player_pass_rush_yards": "player_passing__rushing_yards",
    "player_passing__rushing_yards": "player_passing__rushing_yards",
    "player_passing_+_rushing_yards": "player_passing__rushing_yards",
    "rush_rec_yards": "player_rush_rec_yards",
    "rushing_receiving_yards": "player_rush_rec_yards",
    "player_rush_rec_yards": "player_rush_rec_yards",
    "player_rushing_+_receiving_yards": "player_rush_rec_yards",
    
    // 1st Quarter Combo
    "1q_pass_rush_yards": "1st_quarter_player_passing__rushing_yards",
    "1st_quarter_player_passing__rushing_yards": "1st_quarter_player_passing__rushing_yards",
    "1st_quarter_player_passing_+_rushing_yards": "1st_quarter_player_passing__rushing_yards",
    
    // 1st Half Combo
    "1h_pass_rush_yards": "1st_half_player_passing__rushing_yards",
    "1st_half_player_passing__rushing_yards": "1st_half_player_passing__rushing_yards",
    "1st_half_player_passing_+_rushing_yards": "1st_half_player_passing__rushing_yards",
    
    // Touchdowns - OVER/UNDER markets (Over 0.5 TDs)
    "player_touchdowns": "player_touchdowns",
    "touchdowns": "player_touchdowns",
    
    // First/Last TD Scorer - SINGLE-LINE markets
    "first_td": "player_first_td",
    "first_touchdown": "player_first_td",
    "first_td_scorer": "player_first_td",
    "player_first_td": "player_first_td",
    "last_td": "player_last_td",
    "last_touchdown": "player_last_td",
    "last_td_scorer": "player_last_td",
    "player_last_td": "player_last_td",
    
    // Anytime TD Scorer - SINGLE-LINE market (NOT the same as player_touchdowns over/under)
    "anytime_td": "player_anytime_td",
    "anytime_touchdown": "player_anytime_td",
    "anytime_td_scorer": "player_anytime_td",
    "player_anytime_td": "player_anytime_td",
    
    // 1st Quarter Touchdowns
    "1q_player_touchdowns": "1st_quarter_player_touchdowns",
    "1st_quarter_player_touchdowns": "1st_quarter_player_touchdowns",
    "1st_quarter_touchdowns": "1st_quarter_player_touchdowns",
    
    // 1st Half Touchdowns
    "1h_player_touchdowns": "1st_half_player_touchdowns",
    "1st_half_player_touchdowns": "1st_half_player_touchdowns",
    "1st_half_touchdowns": "1st_half_player_touchdowns",
    
    // 2nd Half Touchdowns
    "2h_player_touchdowns": "2nd_half_player_touchdowns",
    "2nd_half_player_touchdowns": "2nd_half_player_touchdowns",
    "2nd_half_touchdowns": "2nd_half_player_touchdowns",
    
    // Both halves
    "both_halves_player_touchdowns": "both_halves_player_touchdowns",
    "both_halves_touchdowns": "both_halves_player_touchdowns",
    
    // Defense
    "player_sacks": "player_sacks",
    "sacks": "player_sacks",
    "player_tackles_and_assists": "player_tackles_assists",
    "tackles_assists": "player_tackles_assists",
    "player_tackles_assists": "player_tackles_assists",
    "player_defensive_interceptions": "player_defense_interceptions",
    "defensive_interceptions": "player_defense_interceptions",
    "player_defense_interceptions": "player_defense_interceptions",
    
    // Kicking
    "player_field_goals_made": "player_field_goals",
    "field_goals": "player_field_goals",
    "fgs_made": "player_field_goals",
    "player_field_goals": "player_field_goals",
    "player_extra_points_made": "player_extra_points",
    "extra_points": "player_extra_points",
    "player_extra_points": "player_extra_points",
    "player_kicking_points": "player_kicking_points",
    "kicking_points": "player_kicking_points",
    "triple_double": "player_triple_double",
    "td": "player_triple_double",
    
    // ============ HOCKEY (NHL) PLAYER PROPS ============
    // Goals
    "goals": "player_goals",
    "player_goals": "player_goals",
    "anytime_goals": "player_goals",
    "anytime_goal": "player_goals",
    
    // First/Last Goalscorer markets - multiple naming conventions
    "first_goal": "player_first_goal",
    "player_first_goal": "player_first_goal",
    "first_goalscorer": "player_first_goal",
    "first_goal_scorer": "player_first_goal",
    "firstgoalscorer": "player_first_goal",
    "last_goal": "player_last_goal",
    "player_last_goal": "player_last_goal",
    "last_goalscorer": "player_last_goal",
    "last_goal_scorer": "player_last_goal",
    "lastgoalscorer": "player_last_goal",
    
    // Team-specific goalscorers
    "home_team_first_goalscorer": "home_team_first_goalscorer",
    "home_first_goalscorer": "home_team_first_goalscorer",
    "away_team_first_goalscorer": "away_team_first_goalscorer", 
    "away_first_goalscorer": "away_team_first_goalscorer",
    "second_goalscorer": "second_goalscorer",
    "2nd_goalscorer": "second_goalscorer",
    "third_goalscorer": "third_goalscorer",
    "3rd_goalscorer": "third_goalscorer",
    
    // Anytime goalscorer
    "anytime_goalscorer": "anytime_goalscorer",
    "1p_player_goals": "1st_period_player_goals",
    "1st_period_player_goals": "1st_period_player_goals",
    "1st_period_goals": "1st_period_player_goals",
    "2p_player_goals": "2nd_period_player_goals",
    "2nd_period_player_goals": "2nd_period_player_goals",
    "2nd_period_goals": "2nd_period_player_goals",
    "3p_player_goals": "3rd_period_player_goals",
    "3rd_period_player_goals": "3rd_period_player_goals",
    "3rd_period_goals": "3rd_period_player_goals",
    
    // Assists & Points
    "player_assists": "player_assists",
    "player_points": "player_points",
    "pp_points": "player_pp_points",
    "player_pp_points": "player_pp_points",
    "power_play_points": "player_pp_points",
    "1p_player_assists": "1st_period_player_assists",
    "1st_period_player_assists": "1st_period_player_assists",
    "1p_player_points": "1st_period_player_points",
    "1st_period_player_points": "1st_period_player_points",
    "2p_player_assists": "2nd_period_player_assists",
    "2nd_period_player_assists": "2nd_period_player_assists",
    "2p_player_points": "2nd_period_player_points",
    "2nd_period_player_points": "2nd_period_player_points",
    "3p_player_assists": "3rd_period_player_assists",
    "3rd_period_player_assists": "3rd_period_player_assists",
    
    // Shots & Other
    "shots_on_goal": "player_shots_on_goal",
    "player_shots_on_goal": "player_shots_on_goal",
    "sog": "player_shots_on_goal",
    "1p_shots_on_goal": "1st_period_player_shots_on_goal",
    "1st_period_player_shots_on_goal": "1st_period_player_shots_on_goal",
    "2p_shots_on_goal": "2nd_period_player_shots_on_goal",
    "2nd_period_player_shots_on_goal": "2nd_period_player_shots_on_goal",
    "3p_shots_on_goal": "3rd_period_player_shots_on_goal",
    "3rd_period_player_shots_on_goal": "3rd_period_player_shots_on_goal",
    "blocked_shots": "player_blocked_shots",
    "player_blocked_shots": "player_blocked_shots",
    "hits": "player_hits",
    "player_hits": "player_hits",
    "plus_minus": "player_plus_minus",
    "player_plus_minus": "player_plus_minus",
    
    // ============ HOCKEY (NHL) GAME LINES ============
    // Puck line (spread)
    "puck_line": "game_spread",
    "puckline": "game_spread",
    "puck_line_reg_time": "puck_line_reg_time",
    "1p_puck_line": "game_1p_spread",
    "1p_spread": "game_1p_spread",
    "game_1p_spread": "game_1p_spread",
    "1st_period_puck_line": "game_1p_spread",
    "2p_puck_line": "2nd_period_puck_line",
    "2nd_period_puck_line": "2nd_period_puck_line",
    "3p_puck_line": "3rd_period_puck_line",
    "3rd_period_puck_line": "3rd_period_puck_line",
    
    // Total goals
    "total_goals": "game_total_goals",
    "game_total_goals": "game_total_goals",
    "total_goals_reg_time": "total_goals_reg_time",
    "1p_total": "1st_period_total_goals",
    "1p_total_goals": "1st_period_total_goals",
    "1st_period_total_goals": "1st_period_total_goals",
    "2p_total": "2nd_period_total_goals",
    "2p_total_goals": "2nd_period_total_goals",
    "2nd_period_total_goals": "2nd_period_total_goals",
    "3p_total": "3rd_period_total_goals",
    "3p_total_goals": "3rd_period_total_goals",
    "3rd_period_total_goals": "3rd_period_total_goals",
    
    // Team totals
    "home_team_total_goals": "home_team_total_goals",
    "away_team_total_goals": "away_team_total_goals",
    "home_team_total_goals_reg_time": "home_team_total_goals_reg_time",
    "away_team_total_goals_reg_time": "away_team_total_goals_reg_time",
    "1st_period_home_team_total_goals": "1st_period_home_team_total_goals",
    "1st_period_away_team_total_goals": "1st_period_away_team_total_goals",
    
    // Period moneylines
    "1p_ml": "game_1p_moneyline",
    "1p_moneyline": "game_1p_moneyline",
    "game_1p_moneyline": "game_1p_moneyline",
    "1st_period_moneyline": "game_1p_moneyline",
    "1st_period_moneyline_3_way": "1st_period_moneyline_3_way",
    "2p_ml": "2nd_period_moneyline",
    "2p_moneyline": "2nd_period_moneyline",
    "2nd_period_moneyline": "2nd_period_moneyline",
    "2nd_period_moneyline_3_way": "2nd_period_moneyline_3_way",
    "3p_ml": "3rd_period_moneyline",
    "3p_moneyline": "3rd_period_moneyline",
    "3rd_period_moneyline": "3rd_period_moneyline",
    
    // Both teams to score
    "btts": "both_teams_to_score",
    "both_teams_to_score": "both_teams_to_score",
    "both_teams_to_score_2_goals": "both_teams_to_score_2_goals",
    "1p_btts": "1st_period_both_teams_to_score",
    "1st_period_both_teams_to_score": "1st_period_both_teams_to_score",
    "2p_btts": "2nd_period_both_teams_to_score",
    "2nd_period_both_teams_to_score": "2nd_period_both_teams_to_score",
    
    // Other game props
    "draw_no_bet": "draw_no_bet",
    "first_team_to_score": "first_team_to_score",
    "first_team_to_score_3_way": "first_team_to_score_3_way",
    "1st_period_first_team_to_score_3_way": "1st_period_first_team_to_score_3_way",
    "last_team_to_score_3_way": "last_team_to_score_3_way",
    
    // 10 minute props
    "1st_10_minutes_total_goals": "1st_10_minutes_total_goals",
    "2nd_period_1st_10_minutes_total_goals": "2nd_period_1st_10_minutes_total_goals",
    "3rd_period_1st_10_minutes_total_goals": "3rd_period_1st_10_minutes_total_goals",
  };
  
  return marketMap[lower] || lower;
}

/**
 * Normalize side values to "over" or "under" for consistent handling
 * 
 * Side types:
 * - over/under: standard props
 * - yes/no: for yes/no markets (double doubles, anytime scorer, etc.)
 * - spread/ml/moneyline: game lines - treat as single-sided entries
 *   For game lines, we use "over" for positive/favorite sides
 *   and "under" could be the opposite, but often game lines
 *   are displayed as separate rows per team
 */
function normalizeSide(side: string): "over" | "under" | null {
  const lower = side.toLowerCase();
  switch (lower) {
    // Standard over/under
    case "over":
    case "o":
      return "over";
    case "under":
    case "u":
      return "under";
    // Odd/Even totals
    case "odd":
      return "over";
    case "even":
      return "under";
    // Yes/No markets (treated as over/under)
    case "yes":
      return "over";
    case "no":
      return "under";
    // Game lines - each team/selection is its own "side"
    // For spreads: home team at -X and away at +X are displayed separately
    // Treat as "over" since each row represents that specific selection
    case "spread":
    case "ml":
    case "moneyline":
    case "home":
    case "away":
    case "draw":
      return "over"; // Single-sided entries, use "over" slot
    default:
      // Unknown side type - try to handle gracefully
      // If it contains "over" or "yes", treat as over
      if (lower.includes("over") || lower.includes("yes") || lower.includes("odd")) return "over";
      if (lower.includes("under") || lower.includes("no") || lower.includes("even")) return "under";
      // Default to "over" for unknown single-sided entries
      return "over";
  }
}

/**
 * Alternative market names to scan for when primary market returns no results
 * Maps canonical market name -> array of alternative Redis key names to try
 */
const MARKET_SCAN_ALIASES: Record<string, string[]> = {
  // Soccer game market aliases (vendor naming can vary by feed/book)
  "match_total_goals": ["total_goals"],
  "moneyline_3_way": ["match_moneyline_3_way", "moneyline_3way"],
  "handicap": ["match_handicap"],
  "draw_no_bet": ["match_draw_no_bet"],
  "1st_half_moneyline_3_way": [
    "1st_half_match_moneyline_3_way",
    "first_half_moneyline_3_way",
    "1h_moneyline_3way",
    "1h_moneyline_3_way",
    "1h_ml_3way",
    "1h_ml_3_way"
  ],
  "1st_half_handicap": ["1st_half_match_handicap", "first_half_handicap"],
  "1st_half_total_goals": ["1st_half_match_total_goals", "first_half_total_goals"],
  "1st_half_draw_no_bet": ["first_half_draw_no_bet"],
  "2nd_half_moneyline_3_way": [
    "2nd_half_match_moneyline_3_way",
    "second_half_moneyline_3_way",
    "2h_moneyline_3way",
    "2h_moneyline_3_way",
    "2h_ml_3way",
    "2h_ml_3_way"
  ],
  "2nd_half_total_goals": ["2nd_half_match_total_goals", "second_half_total_goals"],
  "1st_half_both_teams_to_score": ["first_half_both_teams_to_score"],
  "1st_half_first_team_to_score_3_way": ["first_half_first_team_to_score_3_way"],
  "2nd_half_first_team_to_score_3_way": ["second_half_first_team_to_score_3_way"],
  "1st_half_total_corners_odd_even": ["first_half_total_corners_odd_even"],
  "2nd_half_total_corners_odd_even": ["second_half_total_corners_odd_even"],

  // First goalscorer - Redis might use different naming
  "player_first_goal": ["first_goalscorer", "first_goal_scorer", "first_goal"],
  "player_last_goal": ["last_goalscorer", "last_goal_scorer", "last_goal"],
  "home_team_first_goalscorer": ["home_first_goalscorer", "home_team_first_goal"],
  "away_team_first_goalscorer": ["away_first_goalscorer", "away_team_first_goal"],
  // Anytime goalscorer (single-line "to score" market - NOT the same as player_goals over/under)
  "anytime_goalscorer": ["anytime_goal_scorer", "anytime_goal"],
  // Note: player_goals is over/under (e.g., Over 0.5 goals) - do NOT alias to anytime_goalscorer
  // They are different market types and should not be mixed
  
  // NBA Combo markets - Redis uses long form, we use short form
  "player_pra": ["player_points_rebounds_assists", "player_pts_rebs_asts", "pra"],
  "player_pr": ["player_points_rebounds", "player_pts_rebs", "pr"],
  "player_pa": ["player_points_assists", "player_pts_asts", "pa"],
  "player_ra": ["player_rebounds_assists", "player_rebs_asts", "ra"],
  
  // Steals + Blocks combo
  "player_steals_blocks": ["player_sb", "sb", "steals_blocks"],
};

/**
 * Soccer feeds sometimes use compact 1h/2h market keys instead of 1st_half/2nd_half.
 * Expand aliases only for soccer so other sports keep their existing behavior.
 */
function getSoccerHalfMarketAliases(market: string): string[] {
  const aliases: string[] = [];

  const add = (...values: string[]) => aliases.push(...values);

  switch (market) {
    case "1st_half_moneyline_3_way":
      add("1h_moneyline_3way", "1h_moneyline_3_way", "1h_ml_3way", "1h_ml_3_way");
      break;
    case "1st_half_handicap":
      add("1h_handicap");
      break;
    case "1st_half_total_goals":
      add("1h_total_goals");
      break;
    case "1st_half_draw_no_bet":
      add("1h_draw_no_bet");
      break;
    case "1st_half_both_teams_to_score":
      add("1h_both_teams_to_score", "1h_btts");
      break;
    case "1st_half_first_team_to_score_3_way":
      add("1h_first_team_to_score_3way", "1h_first_team_to_score_3_way");
      break;
    case "1st_half_total_corners_odd_even":
      add("1h_total_corners_odd_even");
      break;
    case "2nd_half_moneyline_3_way":
      add("2h_moneyline_3way", "2h_moneyline_3_way", "2h_ml_3way", "2h_ml_3_way");
      break;
    case "2nd_half_handicap":
      add("2h_handicap");
      break;
    case "2nd_half_total_goals":
      add("2h_total_goals");
      break;
    case "2nd_half_draw_no_bet":
      add("2h_draw_no_bet");
      break;
    case "2nd_half_first_team_to_score_3_way":
      add("2h_first_team_to_score_3way", "2h_first_team_to_score_3_way");
      break;
    case "2nd_half_total_corners_odd_even":
      add("2h_total_corners_odd_even");
      break;
    default:
      break;
  }

  return aliases;
}

/**
 * Read per-event odds index keys populated by the consumer:
 * odds_idx:{sport}:{eventId} => members like "{market}:{book}"
 */
async function getOddsKeysFromIndex(
  sport: string,
  eventIds: string[],
  marketsToScan: string[]
): Promise<{ keys: string[]; foundEventMarket: Set<string>; eventsWithIndex: Set<string> }> {
  const keys: string[] = [];
  const foundEventMarket = new Set<string>();
  const eventsWithIndex = new Set<string>();
  const marketSet = new Set(marketsToScan);

  const BATCH_SIZE = 20;
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const membersByEvent = await Promise.all(
      batch.map((eventId) => redis.smembers(`odds_idx:${sport}:${eventId}`))
    );

    batch.forEach((eventId, batchIdx) => {
      const members = (membersByEvent[batchIdx] || []).map(String);
      if (members.length > 0) {
        eventsWithIndex.add(eventId);
      }
      for (const member of members) {
        // Member format: "{market}:{book}".
        const sep = member.lastIndexOf(":");
        if (sep <= 0 || sep >= member.length - 1) continue;
        const market = member.slice(0, sep);
        const book = member.slice(sep + 1);
        if (!marketSet.has(market) || !book) continue;

        for (const bookCandidate of getBookKeyCandidates(book)) {
          keys.push(`odds:${sport}:${eventId}:${market}:${bookCandidate}`);
        }
        foundEventMarket.add(`${eventId}:${market}`);
      }
    });
  }

  return { keys, foundEventMarket, eventsWithIndex };
}

/**
 * OPTIMIZATION: Get odds keys for specific events and market
 * Uses event-scoped scanning: active_events (O(1) SET) + per-event focused scans
 * This avoids maintaining a massive global odds_keys set that's hard to clean up
 */
async function getOddsKeysForEvents(
  sport: string, 
  eventIds: string[], 
  market: string
): Promise<string[]> {
  // Cache key includes concrete event IDs to avoid collisions across same-size event sets.
  const cacheKey = `${sport}:${market}:${[...eventIds].sort().join(",")}`;
  const cached = oddsKeysCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < ODDS_KEYS_CACHE_TTL) {
    return cached.keys;
  }

  const allKeys: string[] = [];
  
  // Primary market name + aliases to try
  const baseMarketsToScan = [
    market,
    ...(MARKET_SCAN_ALIASES[market] || []),
    ...(sport.startsWith("soccer_") ? getSoccerHalfMarketAliases(market) : []),
  ];
  const soccerCompact3WayAliases = sport.startsWith("soccer_")
    ? baseMarketsToScan.flatMap((m) => (m.includes("_3_way") ? [m.replace(/_3_way/g, "_3way")] : []))
    : [];
  const marketsToScan = Array.from(new Set([
    ...baseMarketsToScan,
    ...soccerCompact3WayAliases,
  ]));

  // 1) Preferred path: read consumer-maintained per-event index.
  const indexed = await getOddsKeysFromIndex(sport, eventIds, marketsToScan);
  allKeys.push(...indexed.keys);

  const foundEventMarket = new Set(indexed.foundEventMarket);
  const unresolvedPairs: Array<{ eventId: string; market: string }> = [];
  for (const eventId of eventIds) {
    for (const m of marketsToScan) {
      // Probe all event+market pairs to fill any index gaps (missing books/aliases).
      unresolvedPairs.push({ eventId, market: m });
    }
  }

  // 2) Fast fallback: build exact keys for known books, then mget to detect existing keys.
  // This avoids expensive SCAN traversal on Redis proxies with large keyspaces.
  // Probe known books for all event+market pairs.
  // This complements indexes and recovers books when index members use variant IDs.
  const fallbackCandidates = unresolvedPairs;

  const candidateKeys: string[] = [];
  const candidateMeta: Array<{ eventId: string; market: string }> = [];
  for (const { eventId, market: m } of fallbackCandidates) {
    for (const book of KNOWN_BOOKS) {
      candidateKeys.push(`odds:${sport}:${eventId}:${m}:${book}`);
      candidateMeta.push({ eventId, market: m });
    }
  }

  const MGET_CHUNK_SIZE = 1000;
  for (let i = 0; i < candidateKeys.length; i += MGET_CHUNK_SIZE) {
    const keysChunk = candidateKeys.slice(i, i + MGET_CHUNK_SIZE);
    const values = await redis.mget<(SSEBookSelections | string | null)[]>(...keysChunk);

    values.forEach((value, idx) => {
      if (!value) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        // Ignore obvious non-odds payloads (e.g., HTML error pages).
        if (!trimmed.startsWith("{") || trimmed.startsWith("<")) return;
      }
      const key = keysChunk[idx];
      const meta = candidateMeta[i + idx];
      allKeys.push(key);
      foundEventMarket.add(`${meta.eventId}:${meta.market}`);
    });
  }

  // 3) Final fallback: SCAN only unresolved event+market pairs.
  const fallbackPairs = fallbackCandidates.filter(
    ({ eventId, market: m }) => !foundEventMarket.has(`${eventId}:${m}`)
  );

  if (ENABLE_ODDS_SCAN_FALLBACK && fallbackPairs.length > 0) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < fallbackPairs.length; i += BATCH_SIZE) {
      const batch = fallbackPairs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(({ eventId, market: m }) => scanKeysOnce(`odds:${sport}:${eventId}:${m}:*`))
      );
      allKeys.push(...batchResults.flat());
    }
  }
  
  // Deduplicate keys (same data might be under different market names)
  const uniqueKeys = [...new Set(allKeys)];
  
  oddsKeysCache.set(cacheKey, { keys: uniqueKeys, ts: Date.now() });
  return uniqueKeys;
}

/**
 * Single SCAN call with high count (fallback only)
 */
async function scanKeysOnce(pattern: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 200; // Safety limit for very large keyspaces/proxy scans
  const seenCursors = new Set<number>();

  do {
    iterations++;
    if (seenCursors.has(cursor)) {
      console.warn(`[scanKeysOnce] Cursor cycle detected for ${pattern}, stopping at ${results.length} keys`);
      break;
    }
    seenCursors.add(cursor);

    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = Number(nextCursor);
    results.push(...keys);
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[scanKeysOnce] Hit limit for ${pattern}, got ${results.length} keys`);
      break;
    }
  } while (cursor !== 0);

  return results;
}

/**
 * Get active event IDs for a sport - uses index set (O(1))
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  const cached = activeEventsCache.get(sport);
  if (cached && (Date.now() - cached.ts) < ACTIVE_EVENTS_CACHE_TTL) {
    return cached.ids;
  }

  const key = `active_events:${sport}`;
  const members = (await redis.smembers(key)).map(String).filter(Boolean);

  // Fast path: if set looks healthy, avoid additional scans.
  if (members.length > 8) {
    const unique = [...new Set(members)];
    activeEventsCache.set(sport, { ids: unique, ts: Date.now() });
    return unique;
  }

  // Fallback/merge for partially populated sets (common during feed migrations).
  const eventKeys = await scanKeysOnce(`events:${sport}:*`);
  const prefix = `events:${sport}:`;
  const scannedIds = eventKeys
    .map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : ""))
    .filter(Boolean);

  const merged = [...new Set([...members, ...scannedIds])];
  activeEventsCache.set(sport, { ids: merged, ts: Date.now() });

  if (scannedIds.length > members.length) {
    console.warn(
      `[v2/props/table] active_events:${sport} appears incomplete (${members.length}); merged with events scan (${scannedIds.length})`
    );
  }

  return merged;
}

/**
 * Row format matching the old props API
 */
interface PropsRow {
  sid: string;
  eid: string;
  ent: string;
  player: string | null;
  team: string | null;
  position: string | null;
  mkt: string;
  ln: number;
  ev: {
    dt: string;
    live: boolean;
    home: { id: string; name: string; abbr: string };
    away: { id: string; name: string; abbr: string };
  };
  best?: {
    over?: { bk: string; price: number; limit_max?: number | null; locked?: boolean };
    under?: { bk: string; price: number; limit_max?: number | null; locked?: boolean };
  };
  avg?: { over?: number; under?: number };
  books?: Record<string, {
    over?: { price: number; line: number; u: string; m?: string; sgp?: string | null; limit_max?: number | null; locked?: boolean };
    under?: { price: number; line: number; u: string; m?: string; sgp?: string | null; limit_max?: number | null; locked?: boolean };
  }>;
  ts?: number;
}

/**
 * Build props rows from new key structure
 */
async function buildPropsRows(
  sport: string,
  marketInput: string,
  scope: "pregame" | "live",
  limit: number
): Promise<{ sids: string[]; rows: PropsRow[]; normalizedMarket: string }> {
  // Normalize market name (e.g., "spread" → "game_spread")
  const market = normalizeMarketName(marketInput);
  
  // 1. Get active events
  const eventIds = await getActiveEventIds(sport);
  if (eventIds.length === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 2. Get event metadata in parallel
  const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
  const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

  // Build event map and filter by scope (pregame vs live)
  const now = new Date();
  const eventMap = new Map<string, {
    eventId: string;
    homeTeam: string;
    awayTeam: string;
    homeName: string;
    awayName: string;
    startTime: string;
    isLive: boolean;
  }>();

  eventIds.forEach((id, i) => {
    const event = eventsRaw[i];
    if (!event) return;

    const startTime = (event.commence_time as string) || (event.start_time as string) || "";
    const isLive = event.is_live === true;
    
    // Filter by scope
    if (scope === "pregame") {
      // Only include games that haven't started
      if (startTime) {
        const gameStart = new Date(startTime);
        if (!isNaN(gameStart.getTime()) && gameStart <= now) {
          return; // Skip - game has started
        }
      }
      if (isLive) return;
    } else if (scope === "live") {
      // Only include live games
      if (!isLive) return;
    }

    const homeTeam = (event.home_team as string) || "";
    const awayTeam = (event.away_team as string) || "";
    if (!homeTeam || !awayTeam) return;

    eventMap.set(id, {
      eventId: id,
      homeTeam,
      awayTeam,
      homeName: (event.home_team_name as string) || homeTeam,
      awayName: (event.away_team_name as string) || awayTeam,
      startTime,
      isLive,
    });
  });

  if (eventMap.size === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 3. OPTIMIZATION: Get odds keys scoped to active events + specific market
  // Uses focused per-event scans instead of a massive global odds_keys set
  // Pattern: odds:{sport}:{eventId}:{market}:* for each active event
  const activeEventIdList = Array.from(eventMap.keys());
  const allOddsKeys = await getOddsKeysForEvents(sport, activeEventIdList, market);

  if (allOddsKeys.length === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 4. Fetch all odds data in parallel chunks
  const MGET_CHUNK_SIZE = 500;
  const chunks: string[][] = [];
  for (let i = 0; i < allOddsKeys.length; i += MGET_CHUNK_SIZE) {
    chunks.push(allOddsKeys.slice(i, i + MGET_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => redis.mget<(SSEBookSelections | string | null)[]>(...chunk))
  );
  const allOddsData = chunkResults.flat();

  // Build key -> data map
  const oddsDataMap = new Map<string, SSEBookSelections>();
  allOddsKeys.forEach((key, i) => {
    const data = allOddsData[i];
    if (data) {
      const parsed = parseBookSelectionsValue(data, key);
      if (parsed) {
        oddsDataMap.set(key, parsed);
      }
    }
  });

  // 5. Aggregate by player/line to build rows
  // Key: "eventId:player:line" -> aggregated data
  const rowMap = new Map<string, {
    eventId: string;
    player: string;
    playerId: string;
    team: string | null;
    position: string | null;
    line: number;
    books: Map<string, {
      over?: SSESelection;
      under?: SSESelection;
    }>;
  }>();

  // Helper to identify game markets
  const isSpreadLikeMarket =
    market.includes("spread") ||
    market.includes("puck_line") ||
    market.includes("run_line") ||
    market.includes("handicap");
  const isGameTotal = market.includes("total") || market.includes("over_under");
  const isThreeWayTeamMarket =
    market.includes("moneyline_3_way") ||
    market.includes("team_to_score_3_way");
  const isGameLine =
    (
      isSpreadLikeMarket ||
      market.includes("moneyline") ||
      market.includes("draw_no_bet") ||
      isThreeWayTeamMarket
    ) &&
    !isGameTotal;
  const isGameMarket = isGameTotal || isGameLine;
  
  // Check if this is a single-line player market (goalscorers, TDs, first basket)
  // For these markets, we show ALL players - no main line filtering
  const isSingleLinePlayerMarket = SINGLE_LINE_PLAYER_MARKETS.has(market);

  // THREE-PASS APPROACH:
  // Pass 1: Find main lines (main=true) for each player per book
  // Pass 1.5: Determine canonical main line per player (FanDuel > DraftKings > any book with main=true)
  // Pass 2: Build rows using canonical main lines for all rows
  
  // Structure to track main lines: eventId:player:book -> line number
  const mainLinesByPlayerBook = new Map<string, number>();
  // Canonical main line per player: eventId:player -> { line, source }
  const canonicalMainLine = new Map<string, { line: number; priority: number }>();
  
  // Priority order for determining canonical main line (lower = higher priority)
  // DraftKings first, then FanDuel as fallback (per user request)
  const BOOK_PRIORITY: Record<string, number> = {
    "draftkings": 1,
    "fanduel": 2,
    "betmgm": 3,
    "caesars": 4,
    "pinnacle": 5,
  };
  const DEFAULT_PRIORITY = 99;
  
  // Track ALL lines available per entity+book for closest line fallback
  // Structure: eventId:entity:book -> Set of lines
  const allLinesByEntityBook = new Map<string, Set<number>>();
  
  // PASS 1: Collect all main=true selections and their lines
  // Also collect ALL available lines per entity+book for closest line fallback
  for (const [key, selections] of oddsDataMap) {
    const parts = key.split(":");
    const eventId = parts[2];
    const rawBook = parts[4];
    
    // Skip excluded books (Canada, regional variants)
    if (EXCLUDED_BOOKS.has(rawBook.toLowerCase())) continue;
    
    const book = normalizeBookId(rawBook);

    if (!eventMap.has(eventId)) continue;

    for (const [selKey, sel] of Object.entries(selections)) {
      const [rawName, , lineStr] = selKey.split("|");
      if (!rawName || !lineStr) continue;

      const line = parseFloat(lineStr);
      if (isNaN(line)) continue;

      // For game markets, treat the "player" as a single entity "Game" so we find one main line per game
      // For player props, use the player name
      const entityKey = isGameMarket ? "Game" : rawName;

      // Special handling for spreads where line signs differ (e.g. -3.5 vs +3.5)
      const isSpread = isSpreadLikeMarket;
      const effectiveLine = isSpread && isGameMarket ? Math.abs(line) : line;

      // Track ALL lines available for this entity+book (for closest line fallback)
      const playerBookKey = `${eventId}:${entityKey}:${book}`;
      if (!allLinesByEntityBook.has(playerBookKey)) {
        allLinesByEntityBook.set(playerBookKey, new Set());
      }
      allLinesByEntityBook.get(playerBookKey)!.add(effectiveLine);

      // Only process main=true for canonical line determination
      if (sel.main !== true) continue;

      // Sanity check: For game spreads, skip if odds are unreasonable (likely wrong line marked as main)
      // Legitimate spread odds are typically between -200 and +200
      if (isSpread && isGameMarket) {
        const oddsValue = parseInt(sel.price.replace("+", ""), 10);
        if (!isNaN(oddsValue)) {
          // Skip if odds are outside reasonable range for spreads
          if (oddsValue <= -500 || oddsValue >= +300) {
            console.warn(
              `[v2/props/table] Skipping unreasonable spread odds in canonical line selection for ${book}: ${sel.price} (line: ${line})`
            );
            continue;
          }
        }
      }

      // Track the main line for this entity+book
      mainLinesByPlayerBook.set(playerBookKey, effectiveLine);
      
      // Update canonical main line if this book has higher priority
      const playerKey = `${eventId}:${entityKey}`;
      const bookPriority = BOOK_PRIORITY[book] || DEFAULT_PRIORITY;
      const existing = canonicalMainLine.get(playerKey);
      
      if (!existing || bookPriority < existing.priority) {
        canonicalMainLine.set(playerKey, { line: effectiveLine, priority: bookPriority });
      }
    }
  }
  
  // PASS 2: Build rows using main lines OR canonical main line for books without main=true
  for (const [key, selections] of oddsDataMap) {
    const parts = key.split(":");
    const eventId = parts[2];
    const rawBook = parts[4];
    
    // Skip excluded books (Canada, regional variants)
    if (EXCLUDED_BOOKS.has(rawBook.toLowerCase())) continue;
    
    const book = normalizeBookId(rawBook);

    const event = eventMap.get(eventId);
    if (!event) continue;

    for (const [selKey, sel] of Object.entries(selections)) {
      const [rawName, side, lineStr] = selKey.split("|");
      if (!rawName || !side || !lineStr) continue;

      const line = parseFloat(lineStr);
      if (isNaN(line)) continue;

      // Determine entity key for main line lookup
      const entityKey = isGameMarket ? "Game" : rawName;
      const playerBookKey = `${eventId}:${entityKey}:${book}`;
      const playerKey = `${eventId}:${entityKey}`;
      
      // SINGLE-LINE PLAYER MARKETS: Skip main line filtering
      // For markets like First Goalscorer, Anytime TD, etc., show ALL players
      // Each player is their own "entity" with line=0
      if (!isSingleLinePlayerMarket) {
        // Check if this book has its own main line (main=true)
        const bookMainLine = mainLinesByPlayerBook.get(playerBookKey);
        // Get canonical main line (from DraftKings/FanDuel/etc)
        const canonical = canonicalMainLine.get(playerKey);
        
        // Determine which line to show for this book:
        // 1. If this book has main=true for any line, use that line
        // 2. Otherwise, use the canonical main line from DraftKings/FanDuel
        // 3. If book doesn't have the canonical line, find the closest available line
        let targetLine: number | undefined = bookMainLine;
        
        if (targetLine === undefined && canonical?.line !== undefined) {
          // This book doesn't have main=true, check if it has the canonical line
          const bookLines = allLinesByEntityBook.get(playerBookKey);
          if (bookLines) {
            const isSpread = isSpreadLikeMarket;
            const canonicalLine = canonical.line;
            
            // Check if book has exact canonical line
            const hasExact = isSpread && isGameMarket
              ? [...bookLines].some(l => Math.abs(l) === Math.abs(canonicalLine))
              : bookLines.has(canonicalLine);
            
            if (hasExact) {
              targetLine = canonicalLine;
            } else {
              // Find closest line to canonical
              let closestLine: number | undefined;
              let closestDiff = Infinity;
              for (const availLine of bookLines) {
                const diff = Math.abs(availLine - canonicalLine);
                if (diff < closestDiff) {
                  closestDiff = diff;
                  closestLine = availLine;
                }
              }
              // Only use closest if within reasonable range (0.5 for most markets)
              if (closestLine !== undefined && closestDiff <= 0.5) {
                targetLine = closestLine;
              } else {
                // No suitable line found, skip this selection
                continue;
              }
            }
          } else {
            // Book has no lines for this entity
            continue;
          }
        }
        
        // Only include if line matches the target
        if (targetLine !== undefined) {
          const isSpread = isSpreadLikeMarket;
          const match = (isSpread && isGameMarket) 
            ? Math.abs(line) === Math.abs(targetLine)
            : line === targetLine;
            
          if (!match) continue;
        }
      }
      // For single-line player markets, we don't filter by main line - show ALL selections

      // SANITY CHECK: For game spreads/puck lines, reject unreasonable odds
      // Legitimate spread odds are typically between -200 and +200
      // Extreme odds (like -2500 or +900) indicate wrong line selection
      if (isGameLine && isSpreadLikeMarket) {
        const oddsValue = parseInt(sel.price.replace("+", ""), 10);
        if (!isNaN(oddsValue)) {
          // Reject if odds are outside reasonable range for spreads
          if (oddsValue <= -500 || oddsValue >= +300) {
            console.warn(
              `[v2/props/table] Rejecting unreasonable spread odds for ${book} ${rawName}: ${sel.price} (line: ${line})`
            );
            continue;
          }
        }
      }

      // BUILD ROW KEY & MAP SIDES
      let rowKey = "";
      let finalPlayerName = sel.player || rawName;
      let mappedSide: "over" | "under" | null = null;
      let finalTeam: string | null = sel.team || null;

      if (isGameLine) {
        // GAME LINE (Spread/ML) - Single row per game
        const awayAbbr = event.awayTeam || event.awayName.substring(0, 3).toUpperCase();
        const homeAbbr = event.homeTeam || event.homeName.substring(0, 3).toUpperCase();
        
        // Use unique row key for game lines
        rowKey = `${eventId}:GameLine`;
        finalPlayerName = `${awayAbbr} @ ${homeAbbr}`; 
        
        // Map teams to sides (Away/Top -> Over, Home/Bottom -> Under)
        // Use sel.player for better team name (e.g., "New Orleans Pelicans")
        // Also check rawName from key (e.g., "new_orleans_pelicans")
        const playerName = (sel.player || "").toLowerCase().replace(/_/g, " ");
        const keyName = rawName.toLowerCase().replace(/_/g, " ");
        const sideLower = side.toLowerCase();
        
        // Normalize event team names similarly
        const homeNameNorm = event.homeName.toLowerCase().replace(/_/g, " ");
        const homeTeamNorm = event.homeTeam.toLowerCase().replace(/_/g, " ");
        const awayNameNorm = event.awayName.toLowerCase().replace(/_/g, " ");
        const awayTeamNorm = event.awayTeam.toLowerCase().replace(/_/g, " ");

        // Helper to check if input matches a team (exact, contains, or word match)
        const matchesTeam = (
          input: string,
          teamName: string,
          teamAbbr: string,
          opts?: { allowCityMatch?: boolean }
        ): boolean => {
          if (!input || input.length === 0) return false;
          
          // Normalize inputs
          const inputNorm = input.toLowerCase().trim();
          const teamNameNorm = teamName.toLowerCase().trim();
          const teamAbbrNorm = teamAbbr.toLowerCase().trim();
          const allowCityMatch = opts?.allowCityMatch !== false;
          
          // Exact match
          if (inputNorm === teamNameNorm || inputNorm === teamAbbrNorm) return true;
          
          // Input contains full team name or vice versa
          if (inputNorm.includes(teamNameNorm) || teamNameNorm.includes(inputNorm)) return true;
          
          // Extract city and mascot from team name (e.g., "los angeles rams" -> ["los angeles", "rams"])
          const teamParts = teamNameNorm.split(" ");
          const mascot = teamParts[teamParts.length - 1]; // Last word is usually the mascot
          const city = teamParts.slice(0, -1).join(" "); // Everything else is the city
          
          // Check if mascot matches (e.g., "rams", "falcons", "knicks")
          if (mascot && mascot.length >= 3 && inputNorm.includes(mascot)) return true;
          
          // Check if input ends with mascot
          if (mascot && inputNorm.endsWith(mascot)) return true;
          
          // Check abbreviation (3-letter codes like "LAR", "ATL")
          if (teamAbbrNorm.length >= 2) {
            // Direct abbreviation match
            if (inputNorm === teamAbbrNorm) return true;
            // Input ends with abbreviation (for cases like "la_rams" containing "lar")
            if (inputNorm.includes(teamAbbrNorm) && teamAbbrNorm.length >= 3) return true;
          }
          
          // Check city match for multi-word cities.
          // Same-city matchups (e.g. Lakers vs Clippers) are ambiguous on city alone.
          if (allowCityMatch && city && city.length >= 4 && inputNorm.includes(city)) return true;
          
          return false;
        };

        const getCity = (teamName: string): string => {
          const parts = teamName.trim().split(/\s+/);
          if (parts.length <= 1) return "";
          return parts.slice(0, -1).join(" ").toLowerCase();
        };
        const homeCity = getCity(homeNameNorm);
        const awayCity = getCity(awayNameNorm);
        const sameCityMatchup = homeCity.length > 0 && homeCity === awayCity;

        // Soccer 3-way markets can encode outcomes as 1/X/2 instead of team names.
        // 1 => Home, X => Draw, 2 => Away
        const normalizeToken = (value: string): string => value.replace(/\s+/g, "").toLowerCase();
        const playerToken = normalizeToken(playerName);
        const keyToken = normalizeToken(keyName);
        const sideToken = normalizeToken(sideLower);
        const homeTokens = new Set(["home", "1"]);
        const awayTokens = new Set(["away", "2"]);
        const drawTokens = new Set(["draw", "x", "tie"]);

        // Check both player name and key name for matches
        const isHome = matchesTeam(playerName, homeNameNorm, homeTeamNorm, { allowCityMatch: !sameCityMatchup }) ||
                       matchesTeam(keyName, homeNameNorm, homeTeamNorm, { allowCityMatch: !sameCityMatchup }) ||
                       homeTokens.has(playerToken) || homeTokens.has(keyToken) || homeTokens.has(sideToken);
                       
        const isAway = matchesTeam(playerName, awayNameNorm, awayTeamNorm, { allowCityMatch: !sameCityMatchup }) ||
                       matchesTeam(keyName, awayNameNorm, awayTeamNorm, { allowCityMatch: !sameCityMatchup }) ||
                       awayTokens.has(playerToken) || awayTokens.has(keyToken) || awayTokens.has(sideToken);

        if (isAway && !isHome) mappedSide = "over";      // Top slot (Away)
        else if (isHome && !isAway) mappedSide = "under"; // Bottom slot (Home)
        else if (isAway && isHome) {
          // Both matched (shouldn't happen with good data) - skip
          continue;
        } else {
           // Fallback: If we can't determine team, check if it's Draw
           if (drawTokens.has(playerToken) || drawTokens.has(keyToken) || drawTokens.has(sideToken)) continue; 
           
           // For game lines where team matching fails completely, skip the entry
           // DO NOT use spread line sign as fallback - it doesn't indicate home/away
           // (negative spread = favorite, positive spread = underdog, NOT home/away)
           console.warn(`[v2/props/table] Could not match team for game line: ${rawName} in event ${eventId}`);
           continue;
        }

      } else if (isGameTotal) {
        // GAME TOTAL - Single row per game
        // Use different row key than game lines to prevent conflicts
        rowKey = `${eventId}:GameTotal`;
        
        // For totals, show the matchup - frontend will display Over/Under in the data cells
        const awayAbbr = event.awayTeam || event.awayName.substring(0, 3).toUpperCase();
        const homeAbbr = event.homeTeam || event.homeName.substring(0, 3).toUpperCase();
        finalPlayerName = `${awayAbbr} @ ${homeAbbr}`;
        
        // Normalize Over/Under
        const norm = normalizeSide(side);
        if (norm === "over") mappedSide = "over";
        else if (norm === "under") mappedSide = "under";

      } else {
        // PLAYER PROP - Row per player
        rowKey = `${eventId}:${rawName}`;
        finalPlayerName = sel.player || rawName;
        
        // Standard normalization
        const norm = normalizeSide(side);
        if (norm === "over") mappedSide = "over";
        else if (norm === "under") mappedSide = "under";
      }

      if (!mappedSide) continue;

      if (!rowMap.has(rowKey)) {
        // Set entity type for proper identification
        let entityId = sel.player_id || "";
        if (isGameLine) {
          entityId = "game_line";
        } else if (isGameTotal) {
          entityId = "game_total";
        }
        
        rowMap.set(rowKey, {
          eventId,
          player: finalPlayerName,
          playerId: entityId,
          team: finalTeam,
          position: sel.position || null,
          line,
          books: new Map(),
        });
      }

      const row = rowMap.get(rowKey)!;
      if (!row.books.has(book)) {
        row.books.set(book, {});
      }

      const bookData = row.books.get(book)!;
      
      if (mappedSide === "over") {
        bookData.over = sel;
        // Ensure row line is set (prioritize non-zero if possible, though ML is 0)
        if (!row.line || row.line === 0) row.line = line;
      } else if (mappedSide === "under") {
        bookData.under = sel;
        if (!row.line || row.line === 0) row.line = line;
      }
    }
  }

  // 6. Build PropsRow format
  const rows: PropsRow[] = [];
  const sids: string[] = [];

  for (const [rowKey, data] of rowMap) {
    const event = eventMap.get(data.eventId);
    if (!event) continue;

    // Build books object
    const books: PropsRow["books"] = {};
    let bestOver: { bk: string; price: number; limit_max?: number | null; locked?: boolean } | undefined;
    let bestUnder: { bk: string; price: number; limit_max?: number | null; locked?: boolean } | undefined;
    let sumOverProb = 0;
    let countOver = 0;
    let sumUnderProb = 0;
    let countUnder = 0;

    for (const [bookId, bookData] of data.books) {
      const bookEntry: NonNullable<PropsRow["books"]>[string] = {};

      if (bookData.over) {
        const price = parseInt(bookData.over.price.replace("+", ""), 10);
        const limitMax = bookData.over.limits?.max || null;
        const isLocked = bookData.over.locked === true;
        bookEntry.over = {
          price,
          line: bookData.over.line,
          u: bookData.over.link || "",
          m: bookData.over.mobile_link || undefined,
          sgp: bookData.over.sgp ?? null,
          limit_max: limitMax,
          locked: isLocked,
        };

        // Track best over (skip locked odds for best calculation)
        if (!isLocked && (!bestOver || price > parseInt(bestOver.price.toString(), 10))) {
          bestOver = { bk: bookId, price, limit_max: limitMax, locked: false };
        }

        // Sum for average (convert to probability) - skip locked
        if (!isLocked) {
          const decimal = bookData.over.price_decimal;
          if (decimal > 0) {
            sumOverProb += 1 / decimal;
            countOver++;
          }
        }
      }

      if (bookData.under) {
        const price = parseInt(bookData.under.price.replace("+", ""), 10);
        const limitMax = bookData.under.limits?.max || null;
        const isLocked = bookData.under.locked === true;
        bookEntry.under = {
          price,
          line: bookData.under.line,
          u: bookData.under.link || "",
          m: bookData.under.mobile_link || undefined,
          sgp: bookData.under.sgp ?? null,
          limit_max: limitMax,
          locked: isLocked,
        };

        // Track best under (skip locked odds for best calculation)
        if (!isLocked && (!bestUnder || price > parseInt(bestUnder.price.toString(), 10))) {
          bestUnder = { bk: bookId, price, limit_max: limitMax, locked: false };
        }

        // Sum for average - skip locked
        if (!isLocked) {
          const decimal = bookData.under.price_decimal;
          if (decimal > 0) {
            sumUnderProb += 1 / decimal;
            countUnder++;
          }
        }
      }

      if (bookEntry.over || bookEntry.under) {
        books[bookId] = bookEntry;
      }
    }

    // Skip rows with no books
    if (Object.keys(books).length === 0) continue;

    // Calculate average odds
    const avgOver = countOver > 0
      ? probToAmerican(sumOverProb / countOver)
      : undefined;
    const avgUnder = countUnder > 0
      ? probToAmerican(sumUnderProb / countUnder)
      : undefined;

    // Generate SID
    const sid = `${sport}:${data.eventId}:${market}:${data.playerId || data.player}:${data.line}`;

    sids.push(sid);
    rows.push({
      sid,
      eid: data.eventId,
      // Use 'game:' prefix for game markets, 'pid:' for player props
      ent: data.playerId === "game_line" || data.playerId === "game_total" 
        ? `game:${data.playerId}` 
        : data.playerId 
          ? `pid:${data.playerId}` 
          : `pid:${data.player}`,
      player: data.player,
      team: data.team,
      position: data.position,
      mkt: market,
      ln: data.line,
      ev: {
        dt: event.startTime,
        live: event.isLive,
        home: { id: "", name: event.homeName, abbr: event.homeTeam },
        away: { id: "", name: event.awayName, abbr: event.awayTeam },
      },
      best: {
        over: bestOver,
        under: bestUnder,
      },
      avg: {
        over: avgOver,
        under: avgUnder,
      },
      books,
      ts: Date.now(),
    });
  }

  // 7. Sort rows by best odds price (for single-line markets) or alphabetically (for better UX)
  // For single-line player markets (first goalscorer, etc.), sort alphabetically by player name
  // This ensures consistent ordering and all players are visible
  if (isSingleLinePlayerMarket) {
    rows.sort((a, b) => {
      // Sort by player name for single-line markets
      const aName = a.player || "";
      const bName = b.player || "";
      return aName.localeCompare(bName);
    });
  } else {
    rows.sort((a, b) => {
      const aPrice = a.best?.over?.price ?? -Infinity;
      const bPrice = b.best?.over?.price ?? -Infinity;
      return bPrice - aPrice; // Higher price first
    });
  }

  // Limit and return - extract sids from the sorted/limited rows to ensure alignment
  const limitedRows = rows.slice(0, limit);
  const limitedSids = limitedRows.map(row => row.sid);

  return { sids: limitedSids, rows: limitedRows, normalizedMarket: market };
}

/**
 * Convert probability to American odds
 */
function probToAmerican(prob: number): number {
  if (prob >= 0.5) {
    return Math.round(-(prob / (1 - prob)) * 100);
  } else {
    return Math.round(((1 - prob) / prob) * 100);
  }
}

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const market = (sp.get("market") || "").trim();
    const scope = (sp.get("scope") || "pregame").toLowerCase() as "pregame" | "live";
    const limit = Math.max(1, Math.min(1000, parseIntSafe(sp.get("limit"), 200)));

    // Validate sport
    if (!sport || !VALID_SPORTS.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!market) {
      return NextResponse.json(
        { error: "market_required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const startTime = performance.now();

    // Build rows from new key structure (market gets normalized inside)
    const { sids, rows, normalizedMarket } = await buildPropsRows(sport, market, scope, limit);

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      const marketNote = market !== normalizedMarket ? ` (normalized: ${normalizedMarket})` : '';
      console.log(`[v2/props/table] ${sport} ${market}${marketNote} (${scope}): ${rows.length} rows in ${duration.toFixed(0)}ms`);
    }

    return NextResponse.json(
      { 
        sids, 
        rows, 
        nextCursor: rows.length >= limit ? String(limit) : null,
        meta: {
          sport,
          market: normalizedMarket, // Use normalized market in response
          market_input: market, // Original input for debugging
          market_display: getMarketDisplay(normalizedMarket),
          scope,
          count: rows.length,
          duration_ms: Math.round(duration),
        }
      },
      {
        headers: {
          "Cache-Control": scope === "live" ? "no-store" : "public, max-age=30, s-maxage=30",
        },
      }
    );
  } catch (error: any) {
    console.error("[v2/props/table] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

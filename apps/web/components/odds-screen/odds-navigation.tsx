"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, SlidersHorizontal, CalendarDays, ALargeSmall } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";

// Game info for the game selector
export interface GameInfo {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeAbbr?: string;
  awayAbbr?: string;
  startTime?: string;
  isLive?: boolean;
}

// Sport key mapping for logo URLs (matches /team-logos/{sport}/ folder structure)
const SPORT_KEY_MAP: Record<string, string> = {
  nba: "nba",
  nfl: "nfl",
  nhl: "nhl",
  ncaab: "ncaab",
  ncaaf: "ncaaf",
  mlb: "mlb",
  wnba: "wnba",
};

// Sport configuration
interface SportConfig {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

// Active sports first, off-season at the bottom
const SPORTS: SportConfig[] = [
  // Active
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "nhl", label: "NHL" },
  { id: "ncaab", label: "NCAAB" },
  // Off season
  { id: "mlb", label: "MLB", disabled: true, disabledReason: "Off Season" },
  { id: "wnba", label: "WNBA", disabled: true, disabledReason: "Off Season" },
  { id: "ncaaf", label: "NCAAF", disabled: true, disabledReason: "Off Season" },
];

// Market configuration - separated into Tier 1 (primary) and Tier 2 (more)
interface MarketTab {
  id: string;
  label: string;
  apiKey: string;
  type: "game" | "player";
}

// Tier 1: Always visible core markets
// NOTE: apiKeys standardized to match Redis data feed format
const PRIMARY_MARKETS: Record<string, MarketTab[]> = {
  nba: [
    { id: "pts", label: "PTS", apiKey: "player_points", type: "player" },
    { id: "reb", label: "REB", apiKey: "player_rebounds", type: "player" },
    { id: "ast", label: "AST", apiKey: "player_assists", type: "player" },
    { id: "pra", label: "PRA", apiKey: "player_pra", type: "player" },
    { id: "pr", label: "P+R", apiKey: "player_pr", type: "player" },
    { id: "pa", label: "P+A", apiKey: "player_pa", type: "player" },
    { id: "ra", label: "R+A", apiKey: "player_ra", type: "player" },
    { id: "3pm", label: "3PM", apiKey: "player_threes_made", type: "player" },
    { id: "dd", label: "DD", apiKey: "player_double_double", type: "player" },
    { id: "1st", label: "1st Basket", apiKey: "first_field_goal", type: "player" },
  ],
  nfl: [
    { id: "pass_yds", label: "Pass Yds", apiKey: "player_passing_yards", type: "player" },
    { id: "pass_tds", label: "Pass TDs", apiKey: "player_passing_tds", type: "player" },
    { id: "rush_yds", label: "Rush Yds", apiKey: "player_rushing_yards", type: "player" },
    { id: "rec_yds", label: "Rec Yds", apiKey: "player_receiving_yards", type: "player" },
    { id: "receptions", label: "Rec", apiKey: "player_receptions", type: "player" },
    { id: "atd", label: "ATD", apiKey: "player_touchdowns", type: "player" },
    { id: "ftd", label: "1st TD", apiKey: "player_first_td", type: "player" },
    { id: "ltd", label: "Last TD", apiKey: "player_last_td", type: "player" },
  ],
  nhl: [
    { id: "goals", label: "Goals", apiKey: "player_goals", type: "player" },
    { id: "assists", label: "Assists", apiKey: "player_assists", type: "player" },
    { id: "points", label: "Points", apiKey: "player_points", type: "player" },
    { id: "shots", label: "SOG", apiKey: "player_shots_on_goal", type: "player" },
    { id: "saves", label: "Saves", apiKey: "player_saves", type: "player" },
    { id: "1st_goal", label: "1st Goal", apiKey: "player_first_goal", type: "player" },
    { id: "last_goal", label: "Last Goal", apiKey: "player_last_goal", type: "player" },
  ],
  ncaab: [
    { id: "pts", label: "PTS", apiKey: "player_points", type: "player" },
    { id: "reb", label: "REB", apiKey: "player_rebounds", type: "player" },
    { id: "ast", label: "AST", apiKey: "player_assists", type: "player" },
    { id: "pra", label: "PRA", apiKey: "player_pra", type: "player" },
    { id: "pr", label: "P+R", apiKey: "player_pr", type: "player" },
    { id: "pa", label: "P+A", apiKey: "player_pa", type: "player" },
    { id: "ra", label: "R+A", apiKey: "player_ra", type: "player" },
    { id: "3pm", label: "3PM", apiKey: "player_threes_made", type: "player" },
    { id: "dd", label: "DD", apiKey: "player_double_double", type: "player" },
    { id: "1st", label: "1st Basket", apiKey: "first_field_goal", type: "player" },
  ],
  ncaaf: [
    { id: "pass_yds", label: "Pass Yds", apiKey: "player_passing_yards", type: "player" },
    { id: "rush_yds", label: "Rush Yds", apiKey: "player_rushing_yards", type: "player" },
    { id: "rec_yds", label: "Rec Yds", apiKey: "player_receiving_yards", type: "player" },
    { id: "receptions", label: "Rec", apiKey: "player_receptions", type: "player" },
    { id: "atd", label: "ATD", apiKey: "player_touchdowns", type: "player" },
  ],
  mlb: [],
  wnba: [],
};

// Tier 2: Secondary markets in "More" dropdown
// NOTE: apiKeys standardized to match Redis data feed format
const SECONDARY_MARKETS: Record<string, MarketTab[]> = {
  nba: [
    { id: "td", label: "Triple Double", apiKey: "player_triple_double", type: "player" },
    { id: "1st_tm", label: "1st Basket (Team)", apiKey: "team_first_basket", type: "player" },
    { id: "stl", label: "Steals", apiKey: "player_steals", type: "player" },
    { id: "blk", label: "Blocks", apiKey: "player_blocks", type: "player" },
    { id: "to", label: "Turnovers", apiKey: "player_turnovers", type: "player" },
    { id: "blk_stl", label: "Blocks + Steals", apiKey: "player_bs", type: "player" },
    { id: "fgm", label: "Field Goals Made", apiKey: "player_fgm", type: "player" },
    { id: "1q_pts", label: "1Q Points", apiKey: "1st_quarter_player_points", type: "player" },
    { id: "1q_ast", label: "1Q Assists", apiKey: "1st_quarter_player_assists", type: "player" },
    { id: "1q_reb", label: "1Q Rebounds", apiKey: "1st_quarter_player_rebounds", type: "player" },
    { id: "3min_pts", label: "3Min Points", apiKey: "1st_3_minutes_player_points", type: "player" },
    { id: "3min_ast", label: "3Min Assists", apiKey: "1st_3_minutes_player_assists", type: "player" },
    { id: "3min_reb", label: "3Min Rebounds", apiKey: "1st_3_minutes_player_rebounds", type: "player" },
  ],
  nfl: [
    // Core stats (standardized Redis keys)
    { id: "pass_comp", label: "Pass Completions", apiKey: "player_passing_completions", type: "player" },
    { id: "pass_att", label: "Pass Attempts", apiKey: "player_passing_attempts", type: "player" },
    { id: "int", label: "INTs Thrown", apiKey: "player_interceptions_thrown", type: "player" },
    { id: "rush_att", label: "Rush Attempts", apiKey: "player_rushing_attempts", type: "player" },
    // Combo markets (note: double underscore for pass+rush!)
    { id: "pass_rush", label: "Pass + Rush Yds", apiKey: "player_passing__rushing_yards", type: "player" },
    { id: "rush_rec", label: "Rush + Rec Yds", apiKey: "player_rush_rec_yards", type: "player" },
    // Longest plays
    { id: "longest_pass", label: "Longest Pass", apiKey: "player_longest_passing_completion", type: "player" },
    { id: "longest_rush", label: "Longest Rush", apiKey: "player_longest_rush", type: "player" },
    { id: "longest_rec", label: "Longest Rec", apiKey: "player_longest_reception", type: "player" },
    // TD scorers
    { id: "home_first_td", label: "Home 1st TD", apiKey: "home_team_first_touchdown_scorer", type: "player" },
    { id: "away_first_td", label: "Away 1st TD", apiKey: "away_team_first_touchdown_scorer", type: "player" },
    { id: "2h_first_td", label: "2H 1st TD", apiKey: "2nd_half_first_touchdown_scorer", type: "player" },
    // 1st Half props
    { id: "1h_pass_yds", label: "1H Pass Yds", apiKey: "1st_half_player_passing_yards", type: "player" },
    { id: "1h_rush_yds", label: "1H Rush Yds", apiKey: "1st_half_player_rushing_yards", type: "player" },
    { id: "1h_rec_yds", label: "1H Rec Yds", apiKey: "1st_half_player_receiving_yards", type: "player" },
    { id: "1h_td", label: "1H TD", apiKey: "1st_half_player_touchdowns", type: "player" },
    // 1st Quarter props
    { id: "1q_pass_yds", label: "1Q Pass Yds", apiKey: "1st_quarter_player_passing_yards", type: "player" },
    { id: "1q_rush_yds", label: "1Q Rush Yds", apiKey: "1st_quarter_player_rushing_yards", type: "player" },
    { id: "1q_rec_yds", label: "1Q Rec Yds", apiKey: "1st_quarter_player_receiving_yards", type: "player" },
    { id: "1q_rec", label: "1Q Receptions", apiKey: "1st_quarter_player_receptions", type: "player" },
    { id: "1q_rush_att", label: "1Q Rush Att", apiKey: "1st_quarter_player_rushing_attempts", type: "player" },
    { id: "1q_td", label: "1Q TD", apiKey: "1st_quarter_player_touchdowns", type: "player" },
    { id: "2h_td", label: "2H TD", apiKey: "2nd_half_player_touchdowns", type: "player" },
    { id: "both_halves_td", label: "Both Halves TD", apiKey: "both_halves_player_touchdowns", type: "player" },
    // Kicking
    { id: "extra_points", label: "Extra Points", apiKey: "player_extra_points", type: "player" },
    { id: "field_goals", label: "Field Goals", apiKey: "player_field_goals", type: "player" },
    { id: "kicking_pts", label: "Kicking Points", apiKey: "player_kicking_points", type: "player" },
    // Defense
    { id: "sacks", label: "Sacks", apiKey: "player_sacks", type: "player" },
    { id: "tackles", label: "Tackles", apiKey: "player_tackles", type: "player" },
    { id: "tackles_assists", label: "Tackles+Ast", apiKey: "player_tackles_assists", type: "player" },
  ],
  nhl: [
    // Goalscorers (standardized Redis keys)
    { id: "home_1st_goal", label: "Home 1st Goal", apiKey: "home_team_first_goalscorer", type: "player" },
    { id: "away_1st_goal", label: "Away 1st Goal", apiKey: "away_team_first_goalscorer", type: "player" },
    { id: "2nd_goal", label: "2nd Goal", apiKey: "second_goalscorer", type: "player" },
    { id: "3rd_goal", label: "3rd Goal", apiKey: "third_goalscorer", type: "player" },
    // Skater props
    { id: "pp_pts", label: "PP Points", apiKey: "player_pp_points", type: "player" },
    { id: "blocked", label: "Blocked Shots", apiKey: "player_blocked_shots", type: "player" },
    { id: "hits", label: "Hits", apiKey: "player_hits", type: "player" },
    { id: "plus_minus", label: "+/-", apiKey: "player_plus_minus", type: "player" },
    // Goalie props
    { id: "goals_against", label: "Goals Against", apiKey: "player_goals_against", type: "player" },
    { id: "shutout", label: "Shutout", apiKey: "player_shutout", type: "player" },
    // 1st Period props
    { id: "1p_goals", label: "1P Goals", apiKey: "1st_period_player_goals", type: "player" },
    { id: "1p_assists", label: "1P Assists", apiKey: "1st_period_player_assists", type: "player" },
    { id: "1p_points", label: "1P Points", apiKey: "1st_period_player_points", type: "player" },
    { id: "1p_sog", label: "1P SOG", apiKey: "1st_period_player_shots_on_goal", type: "player" },
    { id: "1p_saves", label: "1P Saves", apiKey: "1st_period_player_saves", type: "player" },
    // 2nd Period props
    { id: "2p_goals", label: "2P Goals", apiKey: "2nd_period_player_goals", type: "player" },
    { id: "2p_assists", label: "2P Assists", apiKey: "2nd_period_player_assists", type: "player" },
    { id: "2p_points", label: "2P Points", apiKey: "2nd_period_player_points", type: "player" },
    // 3rd Period props  
    { id: "3p_goals", label: "3P Goals", apiKey: "3rd_period_player_goals", type: "player" },
    { id: "3p_assists", label: "3P Assists", apiKey: "3rd_period_player_assists", type: "player" },
    { id: "p1_goals", label: "P1 Goals", apiKey: "1st_period_player_goals", type: "player" },
    { id: "p1_assists", label: "P1 Assists", apiKey: "1st_period_player_assists", type: "player" },
    { id: "p1_points", label: "P1 Points", apiKey: "1st_period_player_points", type: "player" },
    { id: "p1_sog", label: "P1 SOG", apiKey: "1st_period_player_shots_on_goal", type: "player" },
    { id: "p2_assists", label: "P2 Assists", apiKey: "2nd_period_player_assists", type: "player" },
    { id: "p2_points", label: "P2 Points", apiKey: "2nd_period_player_points", type: "player" },
    { id: "p2_sog", label: "P2 SOG", apiKey: "2nd_period_player_shots_on_goal", type: "player" },
    { id: "p3_assists", label: "P3 Assists", apiKey: "3rd_period_player_assists", type: "player" },
    { id: "p3_sog", label: "P3 SOG", apiKey: "3rd_period_player_shots_on_goal", type: "player" },
  ],
  ncaab: [
    { id: "td", label: "Triple Double", apiKey: "player_triple_double", type: "player" },
    { id: "1st_tm", label: "1st Basket (Team)", apiKey: "team_first_basket", type: "player" },
    { id: "stl", label: "Steals", apiKey: "player_steals", type: "player" },
    { id: "blk", label: "Blocks", apiKey: "player_blocks", type: "player" },
    { id: "to", label: "Turnovers", apiKey: "player_turnovers", type: "player" },
    { id: "blk_stl", label: "Blocks + Steals", apiKey: "player_bs", type: "player" },
    { id: "fgm", label: "Field Goals Made", apiKey: "player_fgm", type: "player" },
    { id: "1q_pts", label: "1Q Points", apiKey: "1st_quarter_player_points", type: "player" },
    { id: "1q_ast", label: "1Q Assists", apiKey: "1st_quarter_player_assists", type: "player" },
    { id: "1q_reb", label: "1Q Rebounds", apiKey: "1st_quarter_player_rebounds", type: "player" },
    { id: "3min_pts", label: "3Min Points", apiKey: "1st_3_minutes_player_points", type: "player" },
    { id: "3min_ast", label: "3Min Assists", apiKey: "1st_3_minutes_player_assists", type: "player" },
    { id: "3min_reb", label: "3Min Rebounds", apiKey: "1st_3_minutes_player_rebounds", type: "player" },
  ],
  ncaaf: [
    { id: "pass_comp", label: "Pass Completions", apiKey: "pass_completions", type: "player" },
    { id: "pass_att", label: "Pass Attempts", apiKey: "pass_attempts", type: "player" },
    { id: "rush_att", label: "Rush Attempts", apiKey: "rush_attempts", type: "player" },
  ],
  mlb: [],
  wnba: [],
};

// Tier 1: Primary game markets (always visible when in Game mode)
// NOTE: apiKeys standardized to match Redis data feed format
const PRIMARY_GAME_MARKETS: Record<string, MarketTab[]> = {
  nba: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Spread", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_points", type: "game" },
    { id: "team_total", label: "Team Total", apiKey: "team_total", type: "game" },
    { id: "1h_ml", label: "1H ML", apiKey: "game_1h_moneyline", type: "game" },
    { id: "1h_spread", label: "1H Spread", apiKey: "1st_half_point_spread", type: "game" },
    { id: "1h_total", label: "1H Total", apiKey: "1st_half_total_points", type: "game" },
  ],
  nfl: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Spread", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_points", type: "game" },
    { id: "1h_ml", label: "1H ML", apiKey: "game_1h_moneyline", type: "game" },
    { id: "1h_spread", label: "1H Spread", apiKey: "1st_half_point_spread", type: "game" },
    { id: "1h_total", label: "1H Total", apiKey: "1st_half_total_points", type: "game" },
  ],
  nhl: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "puck_line", label: "Puck Line", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "game_total_goals", type: "game" },
    { id: "ml_3way", label: "ML 3-Way", apiKey: "moneyline_3_way", type: "game" },
    { id: "p1_ml", label: "1P ML", apiKey: "game_1p_moneyline", type: "game" },
    { id: "p1_spread", label: "1P Spread", apiKey: "game_1p_spread", type: "game" },
    { id: "p1_total", label: "1P Total", apiKey: "1st_period_total_goals", type: "game" },
  ],
  ncaab: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Spread", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_points", type: "game" },
    { id: "1h_ml", label: "1H ML", apiKey: "game_1h_moneyline", type: "game" },
    { id: "1h_spread", label: "1H Spread", apiKey: "1st_half_point_spread", type: "game" },
    { id: "1h_total", label: "1H Total", apiKey: "1st_half_total_points", type: "game" },
  ],
  ncaaf: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Spread", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_points", type: "game" },
    { id: "1h_ml", label: "1H ML", apiKey: "game_1h_moneyline", type: "game" },
    { id: "1h_spread", label: "1H Spread", apiKey: "1st_half_point_spread", type: "game" },
    { id: "1h_total", label: "1H Total", apiKey: "1st_half_total_points", type: "game" },
  ],
  mlb: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Run Line", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_runs", type: "game" },
  ],
  wnba: [
    { id: "ml", label: "ML", apiKey: "game_moneyline", type: "game" },
    { id: "spread", label: "Spread", apiKey: "game_spread", type: "game" },
    { id: "total", label: "Total", apiKey: "total_points", type: "game" },
  ],
};

// Tier 2: Secondary game markets (in "More" dropdown)
// NOTE: apiKeys standardized to match Redis data feed format
const SECONDARY_GAME_MARKETS: Record<string, MarketTab[]> = {
  nba: [
    { id: "1q_ml", label: "1Q ML", apiKey: "game_1q_moneyline", type: "game" },
    { id: "1q_spread", label: "1Q Spread", apiKey: "1st_quarter_point_spread", type: "game" },
    { id: "1q_total", label: "1Q Total", apiKey: "1st_quarter_total_points", type: "game" },
    { id: "2q_ml", label: "2Q ML", apiKey: "2nd_quarter_moneyline", type: "game" },
    { id: "2q_spread", label: "2Q Spread", apiKey: "2nd_quarter_point_spread", type: "game" },
    { id: "2q_total", label: "2Q Total", apiKey: "2nd_quarter_total_points", type: "game" },
    { id: "3q_ml", label: "3Q ML", apiKey: "3rd_quarter_moneyline", type: "game" },
    { id: "3q_spread", label: "3Q Spread", apiKey: "3rd_quarter_point_spread", type: "game" },
    { id: "3q_total", label: "3Q Total", apiKey: "3rd_quarter_total_points", type: "game" },
    { id: "4q_ml", label: "4Q ML", apiKey: "4th_quarter_moneyline", type: "game" },
    { id: "4q_spread", label: "4Q Spread", apiKey: "4th_quarter_point_spread", type: "game" },
    { id: "4q_total", label: "4Q Total", apiKey: "4th_quarter_total_points", type: "game" },
    { id: "2h_ml", label: "2H ML", apiKey: "2nd_half_moneyline", type: "game" },
    { id: "2h_spread", label: "2H Spread", apiKey: "2nd_half_point_spread", type: "game" },
    { id: "2h_total", label: "2H Total", apiKey: "2nd_half_total_points", type: "game" },
    { id: "overtime", label: "Overtime?", apiKey: "overtime", type: "game" },
  ],
  nfl: [
    { id: "1q_ml", label: "1Q Moneyline", apiKey: "1st_quarter_moneyline", type: "game" },
    { id: "1q_spread", label: "1Q Spread", apiKey: "1st_quarter_point_spread", type: "game" },
    { id: "1q_total", label: "1Q Total", apiKey: "1st_quarter_total_points", type: "game" },
    { id: "2q_spread", label: "2Q Spread", apiKey: "2nd_quarter_point_spread", type: "game" },
    { id: "3q_spread", label: "3Q Spread", apiKey: "3rd_quarter_point_spread", type: "game" },
    { id: "4q_spread", label: "4Q Spread", apiKey: "4th_quarter_point_spread", type: "game" },
    { id: "home_total", label: "Home Total", apiKey: "home_team_total_points", type: "game" },
    { id: "away_total", label: "Away Total", apiKey: "away_team_total_points", type: "game" },
    { id: "total_tds", label: "Total TDs", apiKey: "game_total_touchdowns", type: "game" },
    { id: "1h_total_tds", label: "1H Total TDs", apiKey: "1st_half_total_touchdowns", type: "game" },
    { id: "first_to_score", label: "First To Score", apiKey: "first_team_to_score", type: "game" },
    { id: "overtime", label: "Overtime?", apiKey: "overtime", type: "game" },
  ],
  nhl: [
    { id: "total_reg", label: "Total (Reg)", apiKey: "total_goals_reg_time", type: "game" },
    { id: "puck_reg", label: "Puck Line (Reg)", apiKey: "puck_line_reg_time", type: "game" },
    { id: "p2_ml", label: "2P Moneyline", apiKey: "2nd_period_moneyline", type: "game" },
    { id: "p2_puck", label: "2P Puck Line", apiKey: "2nd_period_puck_line", type: "game" },
    { id: "p2_total", label: "2P Total", apiKey: "2nd_period_total_goals", type: "game" },
    { id: "p3_ml", label: "3P Moneyline", apiKey: "3rd_period_moneyline", type: "game" },
    { id: "p3_puck", label: "3P Puck Line", apiKey: "3rd_period_puck_line", type: "game" },
    { id: "p3_total", label: "3P Total", apiKey: "3rd_period_total_goals", type: "game" },
    { id: "btts", label: "Both Teams Score", apiKey: "both_teams_to_score", type: "game" },
    { id: "1p_btts", label: "1P BTTS", apiKey: "1st_period_both_teams_to_score", type: "game" },
    { id: "draw_no_bet", label: "Draw No Bet", apiKey: "draw_no_bet", type: "game" },
    { id: "first_to_score", label: "First To Score", apiKey: "first_team_to_score", type: "game" },
    { id: "home_total", label: "Home Total", apiKey: "home_team_total_goals", type: "game" },
    { id: "away_total", label: "Away Total", apiKey: "away_team_total_goals", type: "game" },
    { id: "1st_10_min", label: "1st 10 Min Goals", apiKey: "1st_10_minutes_total_goals", type: "game" },
  ],
  ncaab: [
    { id: "2h_ml", label: "2H ML", apiKey: "2nd_half_moneyline", type: "game" },
    { id: "2h_spread", label: "2H Spread", apiKey: "2nd_half_point_spread", type: "game" },
    { id: "2h_total", label: "2H Total", apiKey: "2nd_half_total_points", type: "game" },
  ],
  ncaaf: [
    { id: "1q_ml", label: "1Q ML", apiKey: "1st_quarter_moneyline", type: "game" },
    { id: "1q_spread", label: "1Q Spread", apiKey: "1st_quarter_point_spread", type: "game" },
    { id: "1q_total", label: "1Q Total", apiKey: "1st_quarter_total_points", type: "game" },
    { id: "2h_spread", label: "2H Spread", apiKey: "2nd_half_point_spread", type: "game" },
    { id: "total_tds", label: "Total TDs", apiKey: "game_total_touchdowns", type: "game" },
  ],
  mlb: [],
  wnba: [],
};

// Default game market for each sport (used when switching to Game mode)
// NOTE: NBA uses standardized Redis keys
const DEFAULT_GAME_MARKET: Record<string, string> = {
  nba: "game_moneyline",
  nfl: "game_moneyline",
  nhl: "game_moneyline",
  ncaab: "game_moneyline",
  ncaaf: "game_moneyline",
  mlb: "game_moneyline",
  wnba: "game_moneyline",
};

interface OddsNavigationProps {
  sport: string;
  market: string;
  type: "game" | "player";
  scope: "pregame" | "live";
  onSportChange: (sport: string) => void;
  onMarketChange: (market: string, type: "game" | "player") => void;
  onScopeChange: (scope: "pregame" | "live") => void;
  // Utility controls
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onFiltersClick?: () => void;
  connectionStatus?: {
    connected: boolean;
    reconnecting: boolean;
    show: boolean;
  };
  // View toggle
  tableView?: 'compact' | 'relaxed';
  onTableViewChange?: (view: 'compact' | 'relaxed') => void;
  // Game selector
  games?: GameInfo[];
  onGameSelect?: (gameId: string) => void;
  className?: string;
}

export function OddsNavigation({
  sport,
  market,
  type,
  scope,
  onSportChange,
  onMarketChange,
  onScopeChange,
  searchQuery = "",
  onSearchChange,
  onFiltersClick,
  connectionStatus,
  tableView = 'compact',
  onTableViewChange,
  games = [],
  onGameSelect,
  className,
}: OddsNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<HTMLDivElement>(null);
  
  // Player markets
  const primaryMarkets = useMemo(() => PRIMARY_MARKETS[sport] || [], [sport]);
  const secondaryMarkets = useMemo(() => SECONDARY_MARKETS[sport] || [], [sport]);
  
  // Game markets
  const primaryGameMarkets = useMemo(() => PRIMARY_GAME_MARKETS[sport] || [], [sport]);
  const secondaryGameMarkets = useMemo(() => SECONDARY_GAME_MARKETS[sport] || [], [sport]);
  
  // Find active market in primary or secondary (for player mode)
  const activeMarketId = useMemo(() => {
    if (type === "player") {
      const allMarkets = [...primaryMarkets, ...secondaryMarkets];
      const match = allMarkets.find(tab => tab.apiKey === market);
      return match?.id || null;
    } else {
      const allGameMarkets = [...primaryGameMarkets, ...secondaryGameMarkets];
      const match = allGameMarkets.find(tab => tab.apiKey === market);
      return match?.id || null;
    }
  }, [market, type, primaryMarkets, secondaryMarkets, primaryGameMarkets, secondaryGameMarkets]);

  // Check if active market is in secondary (for More button highlight)
  const isSecondaryActive = useMemo(() => {
    if (type === "player") {
      return secondaryMarkets.some(tab => tab.apiKey === market);
    } else {
      return secondaryGameMarkets.some(tab => tab.apiKey === market);
    }
  }, [market, type, secondaryMarkets, secondaryGameMarkets]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
      if (gamesRef.current && !gamesRef.current.contains(event.target as Node)) {
        setGamesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format time for game display
  const formatGameTime = (timeStr?: string) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Format date for grouping (Today, Tomorrow, or actual date)
  const formatGameDate = (timeStr?: string) => {
    if (!timeStr) return "TBD";
    try {
      const date = new Date(timeStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Reset time portions for comparison
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      
      if (dateOnly.getTime() === todayOnly.getTime()) {
        return "Today";
      } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
        return "Tomorrow";
      } else {
        return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      }
    } catch {
      return "TBD";
    }
  };

  // Group games by date, sorted by time within each date
  const groupedGames = useMemo(() => {
    if (!games.length) return [];
    
    // Create a map of date -> games with their sort time
    const dateMap = new Map<string, { game: GameInfo; time: string; sortTime: Date }[]>();
    
    games.forEach((game) => {
      const dateLabel = formatGameDate(game.startTime);
      const timeLabel = formatGameTime(game.startTime) || "TBD";
      const sortTime = game.startTime ? new Date(game.startTime) : new Date(0);
      
      if (!dateMap.has(dateLabel)) {
        dateMap.set(dateLabel, []);
      }
      
      dateMap.get(dateLabel)!.push({ game, time: timeLabel, sortTime });
    });
    
    // Convert to sorted array structure
    const result: { date: string; sortDate: Date; games: { game: GameInfo; time: string }[] }[] = [];
    
    dateMap.forEach((gameList, dateLabel) => {
      // Sort games by time within this date
      gameList.sort((a, b) => a.sortTime.getTime() - b.sortTime.getTime());
      
      // Get the earliest time for date sorting
      const earliestTime = gameList.length > 0 ? gameList[0].sortTime : new Date(9999, 0, 1);
      
      result.push({
        date: dateLabel,
        sortDate: earliestTime,
        games: gameList.map(({ game, time }) => ({ game, time })),
      });
    });
    
    // Sort by date
    result.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
    
    return result;
  }, [games]);

  return (
    <div className={cn("w-full", className)}>
      {/* Row 1: Sports Selector (Segmented Control) */}
      <div className="px-4 sm:px-6 py-2 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
        <div className="inline-flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-900 p-0.5">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => !s.disabled && onSportChange(s.id)}
              disabled={s.disabled}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                sport === s.id
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                  : s.disabled
                  ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
              title={s.disabled ? s.disabledReason : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Game/Player + Markets + Scope + Utilities (all on one line) */}
      <div className="px-4 sm:px-6 py-2 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Mode Toggle + Markets */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mode Toggle - Prominent segmented control */}
            <div className="inline-flex items-center rounded-lg p-0.5 bg-neutral-200 dark:bg-neutral-800 shrink-0">
              <button
                onClick={() => onMarketChange(DEFAULT_GAME_MARKET[sport] || "moneyline", "game")}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  type === "game"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Game
              </button>
              <button
                onClick={() => {
                  if (primaryMarkets.length > 0 && type !== "player") {
                    const firstMarket = primaryMarkets[0];
                    if (firstMarket) {
                      onMarketChange(firstMarket.apiKey, "player");
                    }
                  }
                }}
                disabled={primaryMarkets.length === 0}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  type === "player"
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                    : primaryMarkets.length === 0
                    ? "text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Player
              </button>
            </div>

            {/* Divider - show when either game or player markets exist */}
            {((type === "player" && primaryMarkets.length > 0) || (type === "game" && primaryGameMarkets.length > 0)) && (
              <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 shrink-0" />
            )}

            {/* Player Market Pills (Tier 1) - Only show when in Player mode */}
            {type === "player" && primaryMarkets.length > 0 && (
              <>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0">
                  {primaryMarkets.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onMarketChange(tab.apiKey, tab.type)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap transition-all h-[22px] flex items-center",
                        activeMarketId === tab.id
                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* More Dropdown (Tier 2) - Outside overflow container so dropdown isn't clipped */}
                {secondaryMarkets.length > 0 && (
                  <div className="relative shrink-0 flex items-center" ref={moreRef}>
                    <button
                      onClick={() => setMoreOpen(!moreOpen)}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap transition-all h-[22px]",
                        isSecondaryActive
                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {isSecondaryActive 
                        ? secondaryMarkets.find(m => m.apiKey === market)?.label || "More"
                        : "More"}
                      <ChevronDown className={cn("w-3 h-3 transition-transform", moreOpen && "rotate-180")} />
                    </button>
                    
                    {moreOpen && (
                      <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 min-w-[180px] max-h-[320px] overflow-y-auto z-[100]">
                        {secondaryMarkets.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              onMarketChange(tab.apiKey, tab.type);
                              setMoreOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-1.5 text-left text-xs font-medium transition-colors",
                              activeMarketId === tab.id
                                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Game Market Pills (Tier 1) - Only show when in Game mode */}
            {type === "game" && primaryGameMarkets.length > 0 && (
              <>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide min-w-0">
                  {primaryGameMarkets.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onMarketChange(tab.apiKey, tab.type)}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap transition-all h-[22px] flex items-center",
                        activeMarketId === tab.id
                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* More Dropdown for Game Markets (Tier 2) */}
                {secondaryGameMarkets.length > 0 && (
                  <div className="relative shrink-0 flex items-center" ref={moreRef}>
                    <button
                      onClick={() => setMoreOpen(!moreOpen)}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap transition-all h-[22px]",
                        isSecondaryActive
                          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                      )}
                    >
                      {isSecondaryActive 
                        ? secondaryGameMarkets.find(m => m.apiKey === market)?.label || "More"
                        : "More"}
                      <ChevronDown className={cn("w-3 h-3 transition-transform", moreOpen && "rotate-180")} />
                    </button>
                    
                    {moreOpen && (
                      <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 min-w-[180px] max-h-[320px] overflow-y-auto z-[100]">
                        {secondaryGameMarkets.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              onMarketChange(tab.apiKey, tab.type);
                              setMoreOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-1.5 text-left text-xs font-medium transition-colors",
                              activeMarketId === tab.id
                                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side: Scope + Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Pre-Game / Live Toggle */}
            <div className="inline-flex items-center rounded-lg p-0.5 bg-neutral-200 dark:bg-neutral-800">
              <button
                onClick={() => onScopeChange("pregame")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  scope === "pregame"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                Pre-Game
              </button>
              <button
                onClick={() => onScopeChange("live")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                  scope === "live"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                {scope === "live" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
                Live
              </button>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700" />

            {/* Search - Compact, expands on focus */}
            {onSearchChange && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder={type === "player" ? "Search..." : "Search..."}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className={cn(
                    "h-7 pl-7 pr-2 text-xs bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 transition-all duration-200",
                    searchFocused || searchQuery
                      ? "w-40 md:w-52"
                      : "w-24 md:w-32"
                  )}
                />
              </div>
            )}

            {/* View Toggle - Compact vs Relaxed */}
            {onTableViewChange && (
              <Tooltip content={tableView === 'compact' ? 'Switch to relaxed view' : 'Switch to compact view'} side="bottom">
                <button
                  onClick={() => onTableViewChange(tableView === 'compact' ? 'relaxed' : 'compact')}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-md border transition-colors",
                    "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                    "text-neutral-500 hover:text-neutral-900 dark:hover:text-white",
                    "hover:border-neutral-300 dark:hover:border-neutral-600"
                  )}
                  aria-label={tableView === 'compact' ? 'Switch to relaxed view' : 'Switch to compact view'}
                >
                  <ALargeSmall className={cn(
                    "transition-transform",
                    tableView === 'compact' ? "w-4 h-4" : "w-5 h-5"
                  )} />
                </button>
              </Tooltip>
            )}

            {/* Game Selector - Jump to matchup */}
            {games.length > 0 && onGameSelect && (
              <div className="relative" ref={gamesRef}>
                <Tooltip content="Jump to game" side="bottom">
                  <button
                    onClick={() => setGamesOpen(!gamesOpen)}
                    className={cn(
                      "flex items-center justify-center gap-1 h-7 px-2 rounded-md border transition-colors",
                      gamesOpen
                        ? "bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white"
                        : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600"
                    )}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium hidden sm:inline">Games</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform", gamesOpen && "rotate-180")} />
                  </button>
                </Tooltip>

                {gamesOpen && (
                  <div className="absolute top-full right-0 mt-1 py-2 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 min-w-[240px] max-h-[320px] overflow-y-auto z-[100]">
                    {groupedGames.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">No games available</span>
                      </div>
                    ) : (
                      groupedGames.map((dateGroup, dateIndex) => (
                        <div key={dateGroup.date}>
                          {/* Date header */}
                          <div className={cn(
                            "px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50",
                            dateIndex > 0 && "mt-1 border-t border-neutral-200 dark:border-neutral-700"
                          )}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                              {dateGroup.date}
                            </span>
                          </div>
                          
                          {/* Games within this date */}
                          {dateGroup.games.map(({ game, time }) => {
                            const sportKey = SPORT_KEY_MAP[sport] || sport;
                            const awayLogo = getTeamLogoUrl(game.awayAbbr || game.awayTeam, sportKey);
                            const homeLogo = getTeamLogoUrl(game.homeAbbr || game.homeTeam, sportKey);
                            
                            return (
                              <button
                                key={game.id}
                                onClick={() => {
                                  onGameSelect(game.id);
                                  setGamesOpen(false);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-2"
                              >
                                {/* Away team */}
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <img 
                                    src={awayLogo} 
                                    alt={game.awayAbbr || game.awayTeam}
                                    className="w-5 h-5 object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                                    {game.awayAbbr || game.awayTeam}
                                  </span>
                                </div>
                                
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 px-0.5">@</span>
                                
                                {/* Home team */}
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <img 
                                    src={homeLogo} 
                                    alt={game.homeAbbr || game.homeTeam}
                                    className="w-5 h-5 object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                                    {game.homeAbbr || game.homeTeam}
                                  </span>
                                </div>
                                
                                {/* Time or Live indicator */}
                                <span className="ml-auto shrink-0">
                                  {game.isLive ? (
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                      <span className="text-[10px] font-bold text-red-500">LIVE</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                      {time}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filters - Icon only */}
            {onFiltersClick && (
              <Tooltip content="Filters" side="bottom">
                <button
                  onClick={onFiltersClick}
                  className="flex items-center justify-center w-7 h-7 rounded-md bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Connection Status */}
            {connectionStatus?.show && (
              <Tooltip
                content={
                  connectionStatus.connected 
                    ? "Live updates active" 
                    : connectionStatus.reconnecting 
                    ? "Reconnecting..." 
                    : "Updates paused"
                }
                side="bottom"
              >
                <div 
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md border cursor-help transition-colors",
                    connectionStatus.connected
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : connectionStatus.reconnecting
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                      : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                  )}
                >
                  <svg 
                    className={cn(
                      "h-3.5 w-3.5",
                      connectionStatus.connected 
                        ? "text-green-600 dark:text-green-400" 
                        : connectionStatus.reconnecting 
                        ? "text-amber-600 dark:text-amber-400 animate-pulse" 
                        : "text-neutral-400 dark:text-neutral-500"
                    )}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                  </svg>
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export for use elsewhere - combine all markets for backward compatibility
const MARKET_TABS: Record<string, MarketTab[]> = Object.keys(PRIMARY_MARKETS).reduce((acc, sport) => {
  acc[sport] = [
    ...(PRIMARY_GAME_MARKETS[sport] || []),
    ...(SECONDARY_GAME_MARKETS[sport] || []),
    ...(PRIMARY_MARKETS[sport] || []),
    ...(SECONDARY_MARKETS[sport] || []),
  ].filter(Boolean);
  return acc;
}, {} as Record<string, MarketTab[]>);

export { SPORTS, MARKET_TABS, PRIMARY_GAME_MARKETS, SECONDARY_GAME_MARKETS, PRIMARY_MARKETS, SECONDARY_MARKETS };

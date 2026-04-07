"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbPropScores } from "@/hooks/use-mlb-prop-scores";
import { usePropLiveOdds } from "@/hooks/use-prop-live-odds";
import { useMlbGames, type MlbGame } from "@/hooks/use-mlb-games";
import type { PropScorePlayer } from "@/app/api/mlb/prop-scores/types";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  SheetFilterBar,
  SegmentedControl,
  FilterDivider,
  FilterSearch,
  FilterCount,
  DateNav,
} from "@/components/cheat-sheet/sheet-filter-bar";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  ExternalLink,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const FREE_MAX_ROWS = 5;
const UPGRADE_URL = "/pricing";

const MIN_SCORE_OPTIONS = [
  { value: 0, label: "All" },
  { value: 50, label: "50+" },
  { value: 65, label: "65+" },
  { value: 80, label: "80+" },
] as const;

// ── Market Config ────────────────────────────────────────────────────────────

interface MarketColumnDef {
  key: string;         // key_stats field name
  label: string;       // column header
  shortLabel: string;  // mobile label
  format: "avg" | "pct" | "pct100" | "stat" | "int" | "speed";
  tooltip?: string;
}

interface MarketFactorDef {
  key: string;
  label: string;
  tooltip?: string;
}

interface MarketConfig {
  key: string;
  label: string;
  shortLabel: string;
  playerType: "batter" | "pitcher";
  columns: MarketColumnDef[];
  factors: MarketFactorDef[];
  lineLabel: string;  // e.g., "K's", "Hits"
  lineOptions?: number[];  // Available lines for line selector (e.g., [0.5, 1.5, 2.5])
  hideOdds?: boolean;  // true for markets with no sportsbook odds (e.g., fantasy points)
}

const MARKETS: MarketConfig[] = [
  {
    key: "hr",
    label: "Home Runs",
    shortLabel: "HR",
    playerType: "batter",
    lineLabel: "HR",
    lineOptions: [0.5, 1.5, 2.5],
    columns: [
      { key: "barrel_pct", label: "Brl%", shortLabel: "Brl", format: "pct", tooltip: "Barrel rate" },
      { key: "max_exit_velo", label: "Max EV", shortLabel: "EV", format: "speed", tooltip: "Maximum exit velocity" },
      { key: "hard_hit_pct", label: "Hard%", shortLabel: "Hard", format: "pct", tooltip: "Hard hit percentage" },
    ],
    factors: [
      { key: "power", label: "Power", tooltip: "Batter power — barrel rate, exit velo, ISO (40%)" },
      { key: "matchup", label: "Matchup", tooltip: "Composite matchup quality (20%)" },
      { key: "pitcher", label: "Pitcher", tooltip: "Pitcher vulnerability — HR/9, FB%, hard contact (18%)" },
      { key: "park", label: "Park", tooltip: "Park HR factor (15%)" },
      { key: "environment", label: "Env", tooltip: "Weather + altitude impact (7%)" },
      { key: "platoon", label: "Platoon", tooltip: "Handedness matchup advantage (L vs R, etc.)" },
      { key: "surge", label: "Surge", tooltip: "Recent form — z-score vs season baseline" },
      { key: "bvp", label: "BvP", tooltip: "Batter vs pitcher career HR history (Bayesian)" },
      { key: "batting_order", label: "Order", tooltip: "Lineup position bonus — higher order = more PAs" },
    ],
  },
  {
    key: "pitcher_k",
    label: "Strikeouts",
    shortLabel: "K's",
    playerType: "pitcher",
    lineLabel: "K's",
    columns: [
      { key: "k_per_9", label: "K/9", shortLabel: "K/9", format: "stat", tooltip: "Strikeouts per 9 innings" },
      { key: "whiff_pct", label: "Whiff%", shortLabel: "Whiff", format: "pct", tooltip: "Swing-and-miss rate" },
      { key: "opp_lineup_k_rate", label: "Opp K%", shortLabel: "Opp K", format: "pct", tooltip: "Opposing lineup average strikeout rate" },
    ],
    factors: [
      { key: "recent_k9", label: "Recent K's", tooltip: "Recent starts K/9 rate — measures current form" },
      { key: "k_rate", label: "K Rate", tooltip: "Season K rate — overall strikeout ability" },
      { key: "whiff", label: "Whiff", tooltip: "Swing-and-miss rate — pitch stuff quality" },
      { key: "csw", label: "CSW", tooltip: "Called strikes + whiffs rate — pitch command + stuff combined" },
      { key: "chase", label: "Chase", tooltip: "Chase rate — how often batters swing at pitches outside the zone" },
      { key: "opp_lineup_k", label: "Opponent", tooltip: "Opposing lineup K-rate — higher means easier to strike out" },
      { key: "bvp", label: "BvP", tooltip: "Batter vs pitcher history — career K performance against these batters" },
      { key: "durability", label: "Durability", tooltip: "Innings depth — ability to go deep in games for more K opportunities" },
      { key: "ballpark", label: "Ballpark", tooltip: "Park strikeout factor" },
    ],
  },
  {
    key: "hits",
    label: "Hits",
    shortLabel: "Hits",
    playerType: "batter",
    lineLabel: "Hits",
    lineOptions: [0.5, 1.5, 2.5],
    columns: [
      { key: "xba", label: "xBA", shortLabel: "xBA", format: "avg", tooltip: "Expected batting average (Statcast)" },
      { key: "contact_rate", label: "Contact", shortLabel: "Cont", format: "pct", tooltip: "Contact rate (100 - K%)" },
      { key: "vs_hand_ba", label: "vs Hand", shortLabel: "vs H", format: "avg", tooltip: "BA vs pitcher's handedness" },
    ],
    factors: [
      { key: "contact", label: "Contact", tooltip: "Contact rate — ability to put bat on ball" },
      { key: "xba", label: "xBA", tooltip: "Expected batting average from Statcast" },
      { key: "recent", label: "Recent", tooltip: "Recent batting average trend" },
      { key: "ld_pct", label: "Line Drive", tooltip: "Line drive percentage — quality of contact" },
      { key: "sprint", label: "Speed", tooltip: "Sprint speed — infield hit potential" },
      { key: "pitcher_k_inv", label: "P K Rate", tooltip: "Pitcher K rate (inverted — lower K% = harder to get hits)" },
      { key: "pitcher_gb", label: "P GB Rate", tooltip: "Pitcher ground ball rate" },
      { key: "pitcher_h9", label: "P H/9", tooltip: "Pitcher hits allowed per 9 innings" },
      { key: "vs_hand", label: "vs Hand", tooltip: "Performance vs pitcher's handedness" },
      { key: "bvp", label: "BvP", tooltip: "Batter vs pitcher history (Bayesian weighted)" },
      { key: "order", label: "Order", tooltip: "Batting order position — more ABs = more hit chances" },
      { key: "park", label: "Park", tooltip: "Park hits factor" },
      { key: "weather", label: "Weather", tooltip: "Temperature + wind impact" },
      { key: "defense", label: "Defense", tooltip: "Opposing team defensive quality" },
      { key: "form_trend", label: "Form", tooltip: "Recent form vs season baseline (hot/cold)" },
    ],
  },
  {
    key: "tb",
    label: "Total Bases",
    shortLabel: "TB",
    playerType: "batter",
    lineLabel: "TB",
    lineOptions: [0.5, 1.5, 2.5, 3.5],
    columns: [
      { key: "xslg", label: "xSLG", shortLabel: "xSLG", format: "avg", tooltip: "Expected slugging or xSLG blend" },
      { key: "barrel_pct", label: "Brl%", shortLabel: "Brl", format: "pct", tooltip: "Barrel rate" },
      { key: "hard_hit_pct", label: "Hard%", shortLabel: "Hard", format: "pct", tooltip: "Hard hit percentage" },
    ],
    factors: [
      { key: "barrel", label: "Barrel", tooltip: "Barrel rate — perfect contact" },
      { key: "iso", label: "ISO", tooltip: "Isolated power" },
      { key: "xslg_blend", label: "xSLG", tooltip: "2/3 xSLG + 1/3 SLG blend" },
      { key: "hard_hit", label: "Hard Hit", tooltip: "Hard hit percentage" },
      { key: "recent_xslg", label: "Recent", tooltip: "Recent xSLG trend" },
      { key: "ld_pct", label: "Line Drive", tooltip: "Line drive percentage" },
      { key: "pitcher_xslg", label: "P xSLG", tooltip: "Pitcher SLG allowed" },
      { key: "pitcher_barrel", label: "P Barrel", tooltip: "Pitcher barrel rate allowed" },
      { key: "vs_hand", label: "vs Hand", tooltip: "Performance vs pitcher handedness" },
      { key: "bvp", label: "BvP", tooltip: "Batter vs pitcher history" },
      { key: "batting_order", label: "Order", tooltip: "Lineup position PA bonus" },
      { key: "park", label: "Park", tooltip: "Park TB factor composite" },
      { key: "weather", label: "Weather", tooltip: "Temperature + wind impact" },
      { key: "avg_exit_velo", label: "Exit Velo", tooltip: "Average exit velocity" },
      { key: "surge", label: "Surge", tooltip: "Recent form z-score" },
      // Fallbacks for old data
      { key: "xslg", label: "xSLG" },
      { key: "opp_hr9", label: "Opp HR/9" },
      { key: "ballpark", label: "Ballpark" },
      { key: "recent", label: "Recent" },
    ],
  },
  {
    key: "rbi",
    label: "RBIs",
    shortLabel: "RBI",
    playerType: "batter",
    lineLabel: "RBI",
    lineOptions: [0.5, 1.5],
    columns: [
      { key: "rbi_rate", label: "RBI Rate", shortLabel: "Rate", format: "avg", tooltip: "RBI per plate appearance" },
      { key: "slg", label: "SLG", shortLabel: "SLG", format: "avg", tooltip: "Slugging percentage" },
      { key: "base_traffic", label: "Traffic", shortLabel: "Traffic", format: "avg", tooltip: "Base traffic — OBP of hitters batting ahead" },
    ],
    factors: [
      // Run production
      { key: "base_traffic", label: "Traffic", tooltip: "OBP of hitters batting ahead — runners on base (top factor)" },
      { key: "batting_order", label: "Order", tooltip: "Batting order zone — 3-5 = RBI spots" },
      { key: "walk_rate_ahead", label: "BB Ahead", tooltip: "Walk rate of hitters batting before — free baserunners" },
      { key: "slg", label: "SLG", tooltip: "Slugging percentage — extra-base hit power" },
      { key: "rbi_rate", label: "RBI Rate", tooltip: "RBI per plate appearance" },
      { key: "recent_rbi", label: "Recent", tooltip: "Recent RBI production" },
      // Pitcher vulnerability
      { key: "pitcher_fip", label: "P FIP", tooltip: "Pitcher FIP — run prevention ability" },
      { key: "platoon_slg", label: "Platoon", tooltip: "SLG vs pitcher's handedness" },
      { key: "bvp", label: "BvP", tooltip: "Batter vs pitcher RBI history" },
      { key: "recent_form", label: "Form", tooltip: "Recent form trend" },
      // Environment
      { key: "park_factor", label: "Park", tooltip: "Park run factor" },
      { key: "weather", label: "Weather", tooltip: "Temperature + wind impact on runs" },
      { key: "opp_era", label: "Opp ERA", tooltip: "Opposing pitcher ERA" },
      { key: "pitcher_bb_rate", label: "P BB Rate", tooltip: "Pitcher walk rate — free baserunners" },
      { key: "game_total", label: "Game Total", tooltip: "Vegas game total — higher O/U = more RBI opportunity" },
      // Fallbacks for old data
      { key: "power", label: "Power" },
      { key: "lineup_spot", label: "Lineup" },
      { key: "opp_whip", label: "Opp WHIP" },
      { key: "recent", label: "Recent" },
    ],
  },
  {
    key: "sb",
    label: "Stolen Bases",
    shortLabel: "SB",
    playerType: "batter",
    lineLabel: "SB",
    columns: [
      { key: "sprint_speed", label: "Speed", shortLabel: "Speed", format: "speed", tooltip: "Sprint speed (ft/sec). Elite: 30+, Avg: 27, Slow: <26" },
      { key: "sb_attempt_rate", label: "Att%", shortLabel: "Att%", format: "pct100", tooltip: "% of games with at least 1 SB attempt" },
      { key: "success_rate", label: "Success", shortLabel: "Suc%", format: "pct100", tooltip: "Stolen base success rate" },
    ],
    factors: [
      { key: "attempt_rate", label: "Attempt Rate", tooltip: "SB attempt frequency (18%)" },
      { key: "speed", label: "Speed", tooltip: "Sprint speed from Statcast (12%)" },
      { key: "recent", label: "Recent", tooltip: "Recent SB production (10%)" },
      { key: "success_rate", label: "Success", tooltip: "SB success rate (5%)" },
      { key: "obp", label: "OBP", tooltip: "On-base percentage (10%)" },
      { key: "batting_order", label: "Order", tooltip: "Lineup position bonus (6%)" },
      { key: "walk_rate", label: "Walk Rate", tooltip: "Walk rate — free passes (4%)" },
      { key: "catcher_pop", label: "C Pop Time", tooltip: "Catcher pop time to 2B — slower = easier (12%)" },
      { key: "catcher_cs", label: "C CS%", tooltip: "Catcher caught stealing rate (5%)" },
      { key: "catcher_arm", label: "C Arm", tooltip: "Catcher arm strength (3%)" },
      { key: "pitcher_sb_rate", label: "P SB Rate", tooltip: "Pitcher SB allowed rate (7%)" },
      { key: "pitcher_hand", label: "P Hand", tooltip: "Pitcher handedness — lefties hold runners (5%)" },
      { key: "pitcher_k_rate", label: "P K Rate", tooltip: "Pitcher K rate — high K = more SB chances (3%)" },
    ],
  },
  {
    key: "pitcher_h",
    label: "Hits Allowed",
    shortLabel: "H Allow",
    playerType: "pitcher",
    lineLabel: "Hits",
    columns: [
      { key: "pitcher_k_rate", label: "K%", shortLabel: "K%", format: "pct", tooltip: "Pitcher strikeout rate — #1 factor for hits allowed" },
      { key: "h_per_9", label: "H/9", shortLabel: "H/9", format: "stat", tooltip: "Hits allowed per 9 innings" },
      { key: "opp_contact_rate", label: "Opp Cont", shortLabel: "Cont", format: "pct", tooltip: "Opposing lineup contact rate" },
    ],
    factors: [
      { key: "pitcher_k_rate", label: "K Rate", tooltip: "Pitcher K% — low K = more hits (20%)" },
      { key: "pitcher_h9", label: "H/9", tooltip: "Season hits per 9 innings" },
      { key: "pitcher_bb_rate", label: "BB Rate", tooltip: "Walk rate — free baserunners" },
      { key: "pitcher_ld_rate", label: "LD Rate", tooltip: "Line drive rate allowed" },
      { key: "opp_contact_rate", label: "Opp Contact", tooltip: "Opposing lineup contact rate (12%)" },
      { key: "opp_ba", label: "Opp BA", tooltip: "Opposing lineup batting average" },
      { key: "opp_xba", label: "Opp xBA", tooltip: "Opposing lineup expected BA" },
      { key: "ballpark", label: "Park", tooltip: "Park hits factor" },
      { key: "defense_oaa", label: "Defense", tooltip: "Team defensive OAA" },
      { key: "projected_ip", label: "Proj IP", tooltip: "Projected innings pitched" },
      { key: "weather", label: "Weather", tooltip: "Temperature + wind impact" },
      { key: "platoon", label: "Platoon", tooltip: "Lineup platoon composition (5%)" },
      { key: "recent_h9", label: "Recent H/9", tooltip: "Recent starts H/9" },
      { key: "form_trend", label: "Form", tooltip: "Recent form trend" },
    ],
  },
  {
    key: "pitcher_er",
    label: "Earned Runs",
    shortLabel: "ER",
    playerType: "pitcher",
    lineLabel: "ER",
    columns: [
      { key: "fip", label: "FIP", shortLabel: "FIP", format: "stat", tooltip: "Fielding independent pitching — #1 factor (18%)" },
      { key: "k_bb_pct", label: "K-BB%", shortLabel: "K-BB", format: "pct", tooltip: "Strikeout minus walk rate — most stable pitcher metric (10%)" },
      { key: "opp_woba", label: "Opp wOBA", shortLabel: "Opp", format: "avg", tooltip: "Opposing lineup wOBA" },
    ],
    factors: [
      { key: "pitcher_fip", label: "FIP", tooltip: "Fielding independent pitching (18%)" },
      { key: "pitcher_k_bb_pct", label: "K-BB%", tooltip: "Strikeout minus walk rate (10%)" },
      { key: "pitcher_hr9", label: "HR/9", tooltip: "Home runs per 9 innings (8%)" },
      { key: "opp_woba", label: "Opp wOBA", tooltip: "Opposing lineup wOBA (10%)" },
      { key: "opp_iso", label: "Opp ISO", tooltip: "Opposing lineup isolated power (7%)" },
      { key: "opp_barrel_rate", label: "Opp Barrel", tooltip: "Opposing lineup barrel rate (5%)" },
      { key: "park_run_factor", label: "Park", tooltip: "Park run factor (5%)" },
      { key: "environment", label: "Environment", tooltip: "Weather impact — neutral for roofed stadiums (5%)" },
      { key: "defense_oaa", label: "Defense", tooltip: "Team defensive OAA (3%)" },
      { key: "projected_ip", label: "Proj IP", tooltip: "Projected innings pitched (8%)" },
      { key: "platoon_composition", label: "Platoon", tooltip: "Lineup platoon composition (3%)" },
      { key: "recent_er_avg", label: "Recent ER", tooltip: "Recent ER per start average (5%)" },
      { key: "form_trend", label: "Form", tooltip: "Recent form trend (3%)" },
    ],
  },
  {
    key: "h_r_rbi",
    label: "H+R+RBI",
    shortLabel: "H+R+RBI",
    playerType: "batter",
    lineLabel: "H+R+RBI",
    lineOptions: [1.5, 2.5, 3.5, 4.5],
    columns: [
      { key: "xba", label: "xBA", shortLabel: "xBA", format: "avg", tooltip: "Expected batting average from Statcast" },
      { key: "obp", label: "OBP", shortLabel: "OBP", format: "avg", tooltip: "On-base percentage" },
      { key: "expected_combo", label: "Exp Combo", shortLabel: "Exp", format: "stat", tooltip: "Expected H+R+RBI per game from model" },
    ],
    factors: [
      { key: "contact_quality", label: "Contact", tooltip: "Contact quality (xBA, barrel rate)" },
      { key: "power", label: "Power", tooltip: "ISO and extra-base hit ability" },
      { key: "rbi_opportunity", label: "RBI Opp", tooltip: "RBI opportunity (base traffic, lineup spot)" },
      { key: "runs_opportunity", label: "Runs Opp", tooltip: "Runs opportunity (OBP, speed, lineup spot)" },
      { key: "pitcher_vulnerability", label: "Pitcher", tooltip: "Opposing pitcher vulnerability (FIP)" },
      { key: "platoon_matchup", label: "Platoon", tooltip: "Platoon advantage vs pitcher hand" },
      { key: "park_factor", label: "Park", tooltip: "Park run factor" },
      { key: "weather", label: "Weather", tooltip: "Temperature + wind impact" },
      { key: "recent_form", label: "Recent", tooltip: "Recent H+R+RBI production" },
      { key: "batting_order", label: "Order", tooltip: "Batting order position" },
    ],
  },
];

const MARKET_MAP = new Map(MARKETS.map((m) => [m.key, m]));


// ── Grade System ─────────────────────────────────────────────────────────────

const GRADES = [
  { grade: "S", min: 90, label: "Elite", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  { grade: "A", min: 75, label: "Strong", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  { grade: "B", min: 60, label: "Solid", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30" },
  { grade: "C", min: 40, label: "Average", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  { grade: "D", min: 0, label: "Weak", color: "text-neutral-400", bg: "bg-neutral-500/10", border: "border-neutral-500/20" },
] as const;

function getGradeConfig(grade: string) {
  return GRADES.find((g) => g.grade === grade) ?? GRADES[GRADES.length - 1];
}

function getScoreConfig(score: number) {
  return GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1];
}

function getScoreBg(score: number): string {
  if (score >= 90) return "bg-purple-500";
  if (score >= 75) return "bg-emerald-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-neutral-500";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function formatOdds(odds: number | string | null): string {
  if (odds == null) return "-";
  const str = String(odds);
  if (str.startsWith("+") || str.startsWith("-")) return str;
  const num = Number(odds);
  if (Number.isNaN(num)) return str;
  return num > 0 ? `+${num}` : String(num);
}

function formatStatValue(val: any, format: MarketColumnDef["format"]): string {
  if (val == null) return "-";
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  switch (format) {
    case "avg":
      return num >= 1 ? num.toFixed(3) : `.${Math.round(num * 1000).toString().padStart(3, "0")}`;
    case "pct":
      return `${num.toFixed(1)}%`;
    case "pct100":
      return `${(num * 100).toFixed(1)}%`;
    case "stat":
      return num.toFixed(2);
    case "int":
      return String(Math.round(num));
    case "speed":
      return num.toFixed(1);
    default:
      return String(num);
  }
}

/** Cell color for market-specific stat columns — returns Tailwind classes */
const STAT_CELL_THRESHOLDS: Record<string, { elite: number; good: number; poor: number; bad: number; higher?: boolean }> = {
  // SB market (values are 0-1 decimals, not percentages)
  sprint_speed:       { elite: 30, good: 28, poor: 26, bad: 24, higher: true },
  sb_attempt_rate:    { elite: 0.35, good: 0.25, poor: 0.15, bad: 0.10, higher: true },
  success_rate:       { elite: 0.90, good: 0.80, poor: 0.65, bad: 0.50, higher: true },
  // Pitcher K market
  k_per_9:            { elite: 10, good: 8.5, poor: 6.5, bad: 5, higher: true },
  whiff_pct:          { elite: 30, good: 25, poor: 18, bad: 14, higher: true },
  opp_lineup_k_rate:  { elite: 28, good: 24, poor: 20, bad: 17, higher: true },
  csw_pct:            { elite: 32, good: 28, poor: 24, bad: 20, higher: true },
  chase_rate:         { elite: 35, good: 30, poor: 24, bad: 20, higher: true },
  // Hits market
  xba:                { elite: 0.300, good: 0.270, poor: 0.220, bad: 0.190, higher: true },
  recent_ba:          { elite: 0.320, good: 0.280, poor: 0.220, bad: 0.180, higher: true },
  vs_hand_ba:         { elite: 0.300, good: 0.270, poor: 0.220, bad: 0.190, higher: true },
  contact_rate:       { elite: 82, good: 76, poor: 68, bad: 62, higher: true },
  hard_hit_pct:       { elite: 45, good: 38, poor: 28, bad: 22, higher: true },
  // TB market
  slg:                { elite: 0.500, good: 0.420, poor: 0.340, bad: 0.280, higher: true },
  xslg:               { elite: 0.500, good: 0.420, poor: 0.340, bad: 0.280, higher: true },
  barrel_pct:         { elite: 12, good: 8, poor: 4, bad: 2, higher: true },
  // RBI market
  rbi_rate:           { elite: 0.25, good: 0.18, poor: 0.10, bad: 0.05, higher: true },
  base_traffic:       { elite: 0.370, good: 0.330, poor: 0.290, bad: 0.260, higher: true },
  // HR market
  max_exit_velo:      { elite: 112, good: 108, poor: 104, bad: 100, higher: true },
  iso:                { elite: 0.250, good: 0.200, poor: 0.130, bad: 0.080, higher: true },
  // Pitcher H market — from batter perspective (higher = more hits expected)
  pitcher_k_rate:     { elite: 15, good: 20, poor: 28, bad: 33, higher: false },  // low K% = more hits
  h_per_9:            { elite: 10, good: 8.5, poor: 7, bad: 6, higher: true },
  opp_contact_rate:   { elite: 82, good: 78, poor: 72, bad: 68, higher: true },
  opp_lineup_ba:      { elite: 0.270, good: 0.255, poor: 0.230, bad: 0.210, higher: true },
  // Pitcher ER market
  era:                { elite: 3, good: 3.5, poor: 4.5, bad: 5.5, higher: false },
  whip:               { elite: 1.05, good: 1.2, poor: 1.4, bad: 1.6, higher: false },
  opp_woba:           { elite: 0.370, good: 0.340, poor: 0.300, bad: 0.270, higher: true },
};

/** Convert American odds to implied probability */
function oddsToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

/** Books that share the same Kambi odds engine — only count once for avg */
const KAMBI_BOOKS = new Set(["betparx", "bally-bet", "betrivers"]);

/** Compute deduped average implied probability from odds snapshot at a given line */
function avgImpliedDeduped(
  snapshot: Record<string, { line: number; over: number | null; under: number | null; mobile_link: string | null }> | null,
  targetLine: number | null
): number | null {
  if (!snapshot || targetLine == null) return null;
  let kambiIncluded = false;
  const seen = new Set<string>();
  const impliedValues: number[] = [];
  for (const [bookKey, data] of Object.entries(snapshot)) {
    if (!data || data.over == null) continue;
    if (targetLine != null && data.line !== targetLine) continue;
    const book = parseBookKey(bookKey);
    // Deduplicate same book appearing under multiple keys (e.g. "dk" and "dk__6.5")
    if (seen.has(book)) continue;
    seen.add(book);
    // Deduplicate Kambi books — only count the first one
    if (KAMBI_BOOKS.has(book)) {
      if (kambiIncluded) continue;
      kambiIncluded = true;
    }
    impliedValues.push(oddsToImplied(data.over));
  }
  return impliedValues.length > 0
    ? impliedValues.reduce((a, b) => a + b, 0) / impliedValues.length
    : null;
}

// Stats where 0 means "no data" rather than an actual zero value
const ZERO_IS_NULL_STATS = new Set([
  "opp_lineup_k_rate", "k_rate", "whiff_pct", "csw_pct", "chase_rate", "sb_attempt_rate", "success_rate",
  "hard_hit_pct", "barrel_pct", "opp_lineup_ba", "opp_woba",
  "xba", "recent_ba", "vs_hand_ba", "slg", "xslg", "rbi_rate", "base_traffic", "obp",
  "sprint_speed", "contact_rate", "babip", "iso", "recent_xslg", "vs_hand_iso",
  "ld_pct", "pitcher_k_pct", "pitcher_h9", "effective_ba", "season_ba",
  "walk_rate_pct", "recent_sb_avg", "catcher_pop_time", "catcher_arm_strength",
  "catcher_cs_pct", "catcher_exchange", "pitcher_sb_per9", "pitcher_k9",
]);

function getStatCellColor(key: string, val: any): string {
  if (val == null) return "";
  const num = Number(val);
  if (Number.isNaN(num)) return "";
  if (num === 0 && ZERO_IS_NULL_STATS.has(key)) return "";
  const t = STAT_CELL_THRESHOLDS[key];
  if (!t) return "";
  const higher = t.higher !== false;
  if (higher) {
    if (num >= t.elite) return "bg-emerald-100 dark:bg-emerald-500/40 text-emerald-800 dark:text-white font-bold";
    if (num >= t.good) return "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (num <= t.bad) return "bg-red-100 dark:bg-red-500/40 text-red-800 dark:text-white font-bold";
    if (num <= t.poor) return "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300";
  } else {
    if (num <= t.elite) return "bg-emerald-100 dark:bg-emerald-500/40 text-emerald-800 dark:text-white font-bold";
    if (num <= t.good) return "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (num >= t.bad) return "bg-red-100 dark:bg-red-500/40 text-red-800 dark:text-white font-bold";
    if (num >= t.poor) return "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300";
  }
  return "";
}

function LineupBadge({ status }: { status: string | null }) {
  if (!status) return null;
  switch (status) {
    case "confirmed":
      return <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 leading-none shrink-0">Confirmed</span>;
    case "projected":
      return <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 leading-none shrink-0">Projected</span>;
    case "roster":
      return <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-neutral-500/15 text-neutral-400 leading-none shrink-0">Roster</span>;
    default:
      return null;
  }
}

function getGameState(status: string | null): "upcoming" | "live" | "final" {
  if (!status) return "upcoming";
  const s = status.toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("progress") || s.includes("top") || s.includes("bot") || s.includes("mid") || s.includes("end")) return "live";
  return "upcoming";
}

/** Extract real book ID from snapshot key (e.g. "draftkings__6.5" → "draftkings") */
function parseBookKey(key: string): string {
  const idx = key.indexOf("__");
  return idx >= 0 ? key.slice(0, idx) : key;
}

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(parseBookKey(bookId));
  return sb?.image?.light || sb?.image?.square || null;
}

function getBookName(bookId: string): string {
  const sb = getSportsbookById(parseBookKey(bookId));
  return sb?.name || parseBookKey(bookId);
}

/** Resolve the best link for a book entry: mobile link on mobile, desktop link on desktop, fallback to sportsbook landing page */
function resolveBookLink(
  bookKey: string,
  data: { link?: string | null; mobile_link?: string | null } | null,
  isMobile: boolean
): string | null {
  const realBook = parseBookKey(bookKey);
  const desktopLink = data?.link;
  const mobileLink = data?.mobile_link;

  // On mobile: prefer mobile_link, fall back to desktop link
  // On desktop: prefer desktop link, fall back to mobile_link
  let resolved: string | null = null;
  if (isMobile) {
    resolved = mobileLink || desktopLink || null;
  } else {
    resolved = desktopLink || mobileLink || null;
  }

  // Fallback to sportsbook landing page
  if (!resolved) {
    const sb = getSportsbookById(realBook);
    if (sb?.links) {
      resolved = isMobile ? (sb.links.mobile || sb.links.desktop || null) : (sb.links.desktop || sb.links.mobile || null);
    }
  }

  return resolved;
}

type SortField = "score" | "player" | "edge_pct" | "line" | "best_odds" | "col0" | "col1" | "col2";
type SortDirection = "asc" | "desc";

// ── Sub-components ──────────────────────────────────────────────────────────

function ScorePill({ score, grade }: { score: number; grade: string }) {
  const config = getGradeConfig(grade);
  return (
    <Tooltip content={`${config.label} (${grade}): Score ${Math.round(score)}/100`} side="top">
      <div className="flex flex-col items-center gap-0.5 cursor-help">
        <div className={cn("relative w-12 h-12 rounded-full flex items-center justify-center border-2", config.border, config.bg)}>
          <span className={cn("text-base font-black tabular-nums", config.color)}>{Math.round(score)}</span>
        </div>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider", config.color)}>{config.label}</span>
      </div>
    </Tooltip>
  );
}

function SubScoreBar({ label, value, tooltip }: { label: string; value: number; tooltip?: string }) {
  const bar = (
    <div className="flex items-center gap-2">
      <span className={cn("text-[10px] text-neutral-500 w-20 shrink-0 text-right", tooltip && "cursor-help border-b border-dotted border-neutral-400/40")}>{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", getScoreBg(value))} style={{ width: `${value}%` }} />
      </div>
      <span className={cn("text-[10px] font-bold tabular-nums w-6 shrink-0", getScoreConfig(value).color)}>{Math.round(value)}</span>
    </div>
  );
  if (tooltip) {
    return <Tooltip content={tooltip} side="left"><div>{bar}</div></Tooltip>;
  }
  return bar;
}

function OddsCell({ player, marketConfig, isMobile = false }: { player: PropScorePlayer; marketConfig: MarketConfig; isMobile?: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasOdds = player.best_odds != null;
  if (!hasOdds) return <span className="text-xs text-neutral-500">—</span>;

  const logo = player.best_odds_book ? getBookLogo(player.best_odds_book) : null;
  const snapshot = player.odds_snapshot ?? {};
  const targetLine = player.line;
  // Only show books offering the same line — deduplicate by real book ID (prefer best price)
  const bookEntries = Object.entries(snapshot)
    .filter(([, d]) => d?.over != null && (targetLine == null || d.line === targetLine))
    .sort((a, b) => (b[1]?.over ?? -9999) - (a[1]?.over ?? -9999))
    .reduce<[string, typeof snapshot[string]][]>((acc, entry) => {
      const realBook = parseBookKey(entry[0]);
      if (!acc.some(([k]) => parseBookKey(k) === realBook)) acc.push(entry);
      return acc;
    }, []);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
          isOpen && "bg-neutral-100 dark:bg-neutral-800/60 ring-1 ring-brand/30"
        )}
      >
        {logo && <img src={logo} alt="" className="h-4 w-auto shrink-0" />}
        <span className="text-xs font-bold tabular-nums text-emerald-400">{formatOdds(player.best_odds)}</span>
        <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && bookEntries.length > 0 && (() => {
        const bestPrice = bookEntries[0]?.[1]?.over ?? null;
        const worstPrice = bookEntries[bookEntries.length - 1]?.[1]?.over ?? null;
        const spread = bestPrice != null && worstPrice != null ? Math.abs(bestPrice - worstPrice) : 0;

        return (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {marketConfig.lineLabel} {player.line}+ Over
              </span>
              <div className="flex items-center gap-2">
                {spread >= 30 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                    {spread}pt spread
                  </span>
                )}
                <span className="text-[10px] tabular-nums text-neutral-400">{bookEntries.length} books</span>
              </div>
            </div>

            {/* Book list */}
            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100/60 dark:divide-neutral-800/40">
              {bookEntries.map(([book, data]) => {
                const bLogo = getBookLogo(book);
                const isBest = parseBookKey(book) === parseBookKey(player.best_odds_book ?? "");
                const bookLink = resolveBookLink(book, data, isMobile);

                return (
                  <a
                    key={book}
                    href={bookLink ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.stopPropagation(); if (!bookLink) e.preventDefault(); }}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-2 transition-colors group",
                      bookLink ? "cursor-pointer hover:bg-brand/5 dark:hover:bg-brand/10" : "cursor-default",
                      isBest && "bg-emerald-500/5 dark:bg-emerald-500/8"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {bLogo
                          ? <img src={bLogo} alt="" className="h-5 w-5 object-contain rounded" />
                          : <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                        }
                      </div>
                      <span className={cn(
                        "text-[11px] font-semibold truncate",
                        isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300"
                      )}>
                        {getBookName(book)}
                      </span>
                      {isBest && (
                        <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">
                          Best
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "text-[13px] font-bold tabular-nums",
                        isBest ? "text-emerald-500" : "text-neutral-800 dark:text-neutral-200"
                      )}>
                        {data?.over != null ? formatOdds(data.over) : "—"}
                      </span>
                      {bookLink ? (
                        <ExternalLink className="w-3 h-3 text-neutral-300 dark:text-neutral-600 group-hover:text-brand transition-colors" />
                      ) : (
                        <div className="w-3 h-3" />
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Pitch type display helpers ───────────────────────────────────────────────

const PITCH_NAMES: Record<string, string> = {
  FF: "4-Seam", SI: "Sinker", FC: "Cutter", CH: "Changeup", CU: "Curveball",
  SL: "Slider", SV: "Sweeper", ST: "Sweeper", FS: "Splitter", KC: "Knuckle Curve",
  KN: "Knuckleball", EP: "Eephus", CS: "Slow Curve", SC: "Screwball",
};

function getPitchName(code: string): string {
  return PITCH_NAMES[code?.toUpperCase()] ?? code;
}

function kRateColor(rate: number): string {
  if (rate >= 35) return "text-emerald-400";
  if (rate >= 28) return "text-green-400";
  if (rate >= 22) return "text-amber-400";
  if (rate >= 15) return "text-orange-400";
  return "text-red-400";
}

function kRateBg(rate: number): string {
  if (rate >= 35) return "bg-emerald-500";
  if (rate >= 28) return "bg-green-500";
  if (rate >= 22) return "bg-amber-500";
  if (rate >= 15) return "bg-orange-500";
  return "bg-red-500";
}

// ── Stat display config per market ──────────────────────────────────────────

interface StatDisplayItem {
  key: string;
  label: string;
  format: "avg" | "pct" | "pct100" | "stat" | "int" | "raw" | "speed";
  group?: string;
}

const MARKET_STATS: Record<string, StatDisplayItem[]> = {
  hr: [
    { key: "barrel_pct", label: "Barrel%", format: "pct", group: "Power" },
    { key: "max_exit_velo", label: "Max Exit Velo", format: "speed", group: "Power" },
    { key: "hard_hit_pct", label: "Hard Hit%", format: "pct", group: "Power" },
    { key: "iso", label: "ISO", format: "avg", group: "Power" },
    { key: "park_hr_factor", label: "Park HR Factor", format: "int", group: "Park" },
    { key: "pitcher_fb_pct", label: "Pitcher FB%", format: "pct", group: "Pitcher" },
    { key: "pitcher_hard_hit", label: "Pitcher Hard Hit%", format: "pct", group: "Pitcher" },
    { key: "pitcher_k_rate", label: "Pitcher K%", format: "pct", group: "Pitcher" },
    { key: "bvp_hr", label: "BvP HR", format: "int", group: "History" },
    { key: "bvp_pa", label: "BvP PA", format: "int", group: "History" },
    { key: "recent_barrel", label: "Recent Barrel%", format: "pct", group: "Recent" },
    { key: "wind_speed", label: "Wind Speed", format: "int", group: "Environment" },
    { key: "elevation_ft", label: "Elevation", format: "int", group: "Environment" },
  ],
  pitcher_k: [
    { key: "k_per_9", label: "K/9", format: "stat", group: "K Ability" },
    { key: "k_rate", label: "K%", format: "pct", group: "K Ability" },
    { key: "k_last_5_avg", label: "Avg K/Start (L5)", format: "stat", group: "K Ability" },
    { key: "recent_ip_avg", label: "Avg IP/Start", format: "stat", group: "K Ability" },
    { key: "whiff_pct", label: "Whiff Rate", format: "pct", group: "Arsenal" },
    { key: "csw_pct", label: "CSW Rate", format: "pct", group: "Arsenal" },
    { key: "chase_rate", label: "Chase Rate", format: "pct", group: "Arsenal" },
    { key: "opp_lineup_k_rate", label: "Opp Lineup K%", format: "pct", group: "Opponent" },
    { key: "bvp_batters_qualifying", label: "BvP Qualifying", format: "int", group: "Opponent" },
  ],
  hits: [
    { key: "season_ba", label: "Season BA", format: "avg", group: "Batting" },
    { key: "xba", label: "xBA", format: "avg", group: "Batting" },
    { key: "recent_ba", label: "Recent BA", format: "avg", group: "Batting" },
    { key: "contact_rate", label: "Contact Rate", format: "pct", group: "Contact" },
    { key: "ld_pct", label: "Line Drive%", format: "pct", group: "Contact" },
    { key: "sprint_speed", label: "Sprint Speed", format: "speed", group: "Contact" },
    { key: "vs_hand_ba", label: "vs Hand BA", format: "avg", group: "Matchup" },
    { key: "pitcher_h9", label: "Pitcher H/9", format: "stat", group: "Matchup" },
    { key: "pitcher_k_pct", label: "Pitcher K%", format: "pct", group: "Matchup" },
    { key: "bvp_avg", label: "BvP AVG", format: "avg", group: "History" },
    { key: "bvp_pa", label: "BvP PA", format: "int", group: "History" },
    { key: "effective_ba", label: "Effective BA", format: "avg", group: "Model" },
    { key: "exp_abs", label: "Expected ABs", format: "stat", group: "Model" },
    { key: "form_diff", label: "Form Trend", format: "stat", group: "Recent" },
  ],
  tb: [
    { key: "xslg_blend", label: "xSLG Blend", format: "avg", group: "Power" },
    { key: "slg", label: "SLG", format: "avg", group: "Power" },
    { key: "xslg", label: "xSLG", format: "avg", group: "Power" },
    { key: "iso", label: "ISO", format: "avg", group: "Power" },
    { key: "barrel_pct", label: "Barrel%", format: "pct", group: "Power" },
    { key: "hard_hit_pct", label: "Hard Hit%", format: "pct", group: "Power" },
    { key: "avg_exit_velo", label: "Avg Exit Velo", format: "speed", group: "Power" },
    { key: "pitcher_slg_allowed", label: "Pitcher SLG", format: "avg", group: "Matchup" },
    { key: "pitcher_barrel_allowed", label: "Pitcher Brl%", format: "pct", group: "Matchup" },
    { key: "vs_hand_iso", label: "vs Hand ISO", format: "avg", group: "Matchup" },
    { key: "park_tb_factor", label: "Park TB Factor", format: "int", group: "Park" },
    { key: "expected_tb", label: "Expected TB", format: "stat", group: "Model" },
    { key: "effective_slg", label: "Effective SLG", format: "avg", group: "Model" },
  ],
  rbi: [
    { key: "rbi_rate", label: "RBI/PA", format: "avg", group: "Production" },
    { key: "slg", label: "SLG", format: "avg", group: "Production" },
    { key: "rbi_total", label: "Season RBI", format: "int", group: "Production" },
    { key: "recent_rbi_avg", label: "Recent RBI/G", format: "stat", group: "Recent" },
    { key: "base_traffic_obp", label: "Traffic OBP", format: "avg", group: "Lineup" },
    { key: "batting_order_zone", label: "Order Zone", format: "raw", group: "Lineup" },
    { key: "pitcher_fip", label: "Pitcher FIP", format: "stat", group: "Matchup" },
    { key: "platoon_slg", label: "Platoon SLG", format: "avg", group: "Matchup" },
    { key: "pitcher_hand", label: "Pitcher Hand", format: "raw", group: "Matchup" },
    { key: "park_run_factor", label: "Park Run Factor", format: "int", group: "Environment" },
    { key: "game_total_line", label: "Game Total (O/U)", format: "stat", group: "Environment" },
  ],
  sb: [
    { key: "sprint_speed", label: "Sprint Speed (ft/s)", format: "stat", group: "Runner" },
    { key: "sb_total", label: "Season SB", format: "int", group: "Runner" },
    { key: "cs_total", label: "Caught Stealing", format: "int", group: "Runner" },
    { key: "sb_attempt_rate", label: "Attempt Rate", format: "pct100", group: "Runner" },
    { key: "success_rate", label: "Success Rate", format: "pct100", group: "Runner" },
    { key: "recent_sb_avg", label: "Recent SB/Game", format: "stat", group: "Runner" },
    { key: "obp", label: "OBP", format: "avg", group: "Opportunity" },
    { key: "walk_rate_pct", label: "Walk Rate", format: "pct", group: "Opportunity" },
    { key: "batting_order", label: "Batting Order", format: "int", group: "Opportunity" },
    { key: "catcher_name", label: "Catcher", format: "raw", group: "Catcher" },
    { key: "catcher_pop_time", label: "Pop Time (2B)", format: "stat", group: "Catcher" },
    { key: "catcher_arm_strength", label: "Arm Strength", format: "stat", group: "Catcher" },
    { key: "catcher_cs_pct", label: "CS Rate", format: "pct", group: "Catcher" },
    { key: "catcher_exchange", label: "Exchange Time", format: "stat", group: "Catcher" },
    { key: "pitcher_sb_per9", label: "Pitcher SB/9", format: "stat", group: "Pitcher" },
    { key: "pitcher_k9", label: "Pitcher K/9", format: "stat", group: "Pitcher" },
    { key: "pitcher_hand", label: "Pitcher Hand", format: "raw", group: "Pitcher" },
  ],
  pitcher_h: [
    { key: "pitcher_k_rate", label: "K Rate", format: "pct", group: "Pitcher" },
    { key: "h_per_9", label: "H/9", format: "stat", group: "Pitcher" },
    { key: "bb_per_9", label: "BB/9", format: "stat", group: "Pitcher" },
    { key: "ld_rate_allowed", label: "LD Rate", format: "pct", group: "Pitcher" },
    { key: "projected_ip", label: "Projected IP", format: "stat", group: "Pitcher" },
    { key: "opp_contact_rate", label: "Opp Contact Rate", format: "pct", group: "Opponent" },
    { key: "opp_lineup_ba", label: "Opp BA", format: "avg", group: "Opponent" },
    { key: "opp_lineup_xba", label: "Opp xBA", format: "avg", group: "Opponent" },
    { key: "platoon_pct", label: "Platoon Comp", format: "pct", group: "Opponent" },
    { key: "park_factor_h", label: "Park Hits Factor", format: "int", group: "Environment" },
    { key: "pitcher_hand", label: "Pitcher Hand", format: "raw", group: "Environment" },
  ],
  pitcher_er: [
    { key: "fip", label: "FIP", format: "stat", group: "Pitcher" },
    { key: "k_bb_pct", label: "K-BB%", format: "pct", group: "Pitcher" },
    { key: "hr_per_9", label: "HR/9", format: "stat", group: "Pitcher" },
    { key: "projected_ip", label: "Proj IP", format: "stat", group: "Pitcher" },
    { key: "expected_er", label: "Expected ER", format: "stat", group: "Pitcher" },
    { key: "recent_er_avg", label: "Recent ER/Start", format: "stat", group: "Recent" },
    { key: "opp_woba", label: "Opp wOBA", format: "avg", group: "Opponent" },
    { key: "opp_iso", label: "Opp ISO", format: "avg", group: "Opponent" },
    { key: "opp_barrel_pct", label: "Opp Barrel%", format: "pct", group: "Opponent" },
    { key: "park_factor", label: "Park Factor", format: "stat", group: "Environment" },
    { key: "temperature_f", label: "Temp", format: "raw", group: "Environment" },
    { key: "wind_mph", label: "Wind", format: "raw", group: "Environment" },
    { key: "roof_type", label: "Roof", format: "raw", group: "Environment" },
  ],
  h_r_rbi: [
    { key: "xba", label: "xBA", format: "avg", group: "Batter" },
    { key: "obp", label: "OBP", format: "avg", group: "Batter" },
    { key: "iso", label: "ISO", format: "avg", group: "Batter" },
    { key: "barrel_rate", label: "Barrel%", format: "pct", group: "Batter" },
    { key: "sprint_speed", label: "Sprint Speed", format: "speed", group: "Batter" },
    { key: "batting_order", label: "Batting Order", format: "int", group: "Batter" },
    { key: "expected_combo", label: "Expected H+R+RBI", format: "stat", group: "Model" },
    { key: "season_combo_per_game", label: "Season Combo/G", format: "stat", group: "Model" },
    { key: "recent_combo_avg", label: "Recent Combo Avg", format: "stat", group: "Recent" },
    { key: "pitcher_fip", label: "Pitcher FIP", format: "stat", group: "Opponent" },
    { key: "base_traffic_obp", label: "Base Traffic OBP", format: "avg", group: "Opponent" },
    { key: "park_run_factor", label: "Park Factor", format: "int", group: "Environment" },
  ],
};

function formatDisplayStat(val: any, format: StatDisplayItem["format"]): string {
  if (val == null) return "-";
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  switch (format) {
    case "avg": return num >= 1 ? num.toFixed(3) : `.${Math.round(num * 1000).toString().padStart(3, "0")}`;
    case "pct": return `${num.toFixed(1)}%`;
    case "pct100": return `${(num * 100).toFixed(1)}%`;
    case "stat": return num.toFixed(1);
    case "int": return String(Math.round(num));
    case "speed": return num.toFixed(1);
    default: return String(val);
  }
}

// ── Expanded Row ────────────────────────────────────────────────────────────

function ExpandedRow({ player, marketConfig }: { player: PropScorePlayer; marketConfig: MarketConfig }) {
  const factors = player.factor_scores ?? {};
  const keyStats = player.key_stats ?? {};
  const expandedStats = player.expanded_stats ?? {};
  const allData = { ...keyStats, ...expandedStats };
  const snapshot = player.odds_snapshot ?? {};
  const targetLine = player.line;
  const bookEntries = Object.entries(snapshot)
    .filter(([, d]) => d?.over != null && (targetLine == null || d.line === targetLine))
    .sort((a, b) => (b[1]?.over ?? -9999) - (a[1]?.over ?? -9999))
    .reduce<[string, typeof snapshot[string]][]>((acc, entry) => {
      const realBook = parseBookKey(entry[0]);
      if (!acc.some(([k]) => parseBookKey(k) === realBook)) acc.push(entry);
      return acc;
    }, []);
  const bestBook = player.best_odds_book;

  // Market-specific stat display
  const statItems = MARKET_STATS[marketConfig.key] ?? [];
  const groups = new Map<string, StatDisplayItem[]>();
  statItems.forEach((s) => {
    const g = s.group ?? "Stats";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  });

  // Opposing lineup K-rates (pitcher_k market)
  const oppKRates: number[] = expandedStats?.opp_k_rates_hand_weighted ?? expandedStats?.opp_k_rates_raw ?? expandedStats?.opp_k_rates ?? [];
  const hasOppKRates = marketConfig.key === "pitcher_k" && Array.isArray(oppKRates) && oppKRates.length > 0;

  // Best pitch whiff (pitcher_k market)
  const bestPitch = expandedStats?.best_pitch_whiff;
  const hasBestPitch = marketConfig.key === "pitcher_k" && bestPitch && typeof bestPitch === "object" && bestPitch.type;

  // SB market hero data
  const isSBMarket = marketConfig.key === "sb";
  const sprintSpeed = keyStats?.sprint_speed as number | null;
  const sbTotal = keyStats?.sb_total as number ?? 0;
  const csTotal = keyStats?.cs_total as number ?? 0;
  const sbSuccessRate = keyStats?.success_rate as number | null;
  const attemptFreq = keyStats?.sb_attempt_rate as number | null;
  const pitcherSbPerStart = expandedStats?.pitcher_sb_per_start as number | null;
  const pitcherCsRate = expandedStats?.pitcher_cs_rate as number | null;

  return (
    <tr>
      <td colSpan={20} className="p-0">
        <div className="px-6 py-5 bg-neutral-50/50 dark:bg-neutral-800/30 border-b border-neutral-200/80 dark:border-neutral-700/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Column 1: Score Breakdown */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Score Breakdown</h4>
                {marketConfig.factors.map((f) => (
                  <SubScoreBar key={f.key} label={f.label} value={factors[f.key] ?? 0} tooltip={f.tooltip} />
                ))}
              </div>

              {/* Best Pitch Whiff (pitcher_k) */}
              {hasBestPitch && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Best Pitch</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-brand/10 text-brand">
                      {getPitchName(bestPitch.type)}
                    </span>
                    <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(bestPitch.whiff ?? 0, 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-brand tabular-nums">{bestPitch.whiff}%</span>
                    <span className="text-[10px] text-neutral-400">whiff</span>
                    {bestPitch.whiff >= 90 && (
                      <span className="text-[8px] text-amber-400 font-semibold">small sample</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Grouped Stats */}
            <div className="flex flex-col gap-3">
              {[...groups.entries()].map(([group, items]) => {
                // Filter out items with null/undefined/zero values
                const visibleItems = items.filter((item) => {
                  const val = allData[item.key];
                  return val != null && val !== 0 && val !== "";
                });
                if (visibleItems.length === 0) return null;
                return (
                <div key={group}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5">{group}</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {visibleItems.map((item) => {
                      const val = allData[item.key];
                      return (
                        <React.Fragment key={item.key}>
                          <span className="text-neutral-500">{item.label}</span>
                          <span className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">
                            {formatDisplayStat(val, item.format)}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Column 3: Market-specific hero + Odds */}
            <div className="flex flex-col gap-4">
              {/* Recent Form summary (pitcher_k) */}
              {marketConfig.key === "pitcher_k" && keyStats.k_last_5_avg != null && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200/40 dark:border-neutral-700/30">
                  <div className="text-center">
                    <div className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">{Number(keyStats.k_last_5_avg).toFixed(1)}</div>
                    <div className="text-[9px] font-semibold text-neutral-400 uppercase">Avg K/Start</div>
                  </div>
                  <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/40" />
                  <div className="text-center">
                    <div className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">{Number(keyStats.recent_ip_avg ?? 0).toFixed(1)}</div>
                    <div className="text-[9px] font-semibold text-neutral-400 uppercase">Avg IP</div>
                  </div>
                  {keyStats.k_season != null && (
                    <>
                      <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/40" />
                      <div className="text-center">
                        <div className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">{keyStats.k_season}</div>
                        <div className="text-[9px] font-semibold text-neutral-400 uppercase">Season K</div>
                      </div>
                    </>
                  )}
                  <div className="ml-auto text-[9px] font-semibold text-neutral-400">L5 Starts</div>
                </div>
              )}

              {/* SB Market Hero */}
              {isSBMarket && (
                <div className="space-y-3">
                  {/* Speed + Success + Attempts summary */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200/40 dark:border-neutral-700/30">
                    {sprintSpeed != null && (
                      <div className="text-center">
                        <div className={cn("text-lg font-black tabular-nums",
                          sprintSpeed >= 30 ? "text-emerald-400" :
                          sprintSpeed >= 28 ? "text-amber-400" :
                          sprintSpeed >= 26 ? "text-neutral-300" :
                          "text-red-400"
                        )}>
                          {sprintSpeed.toFixed(1)}
                        </div>
                        <div className="text-[9px] font-semibold text-neutral-400 uppercase">ft/sec</div>
                      </div>
                    )}
                    <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/40" />
                    <div className="text-center">
                      <div className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">{sbTotal}/{sbTotal + csTotal}</div>
                      <div className="text-[9px] font-semibold text-neutral-400 uppercase">SB/Att</div>
                    </div>
                    {sbSuccessRate != null && (
                      <>
                        <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/40" />
                        <div className="text-center">
                          <div className={cn("text-lg font-black tabular-nums",
                            sbSuccessRate >= 0.85 ? "text-emerald-400" :
                            sbSuccessRate >= 0.70 ? "text-amber-400" :
                            "text-red-400"
                          )}>
                            {(sbSuccessRate * 100).toFixed(0)}%
                          </div>
                          <div className="text-[9px] font-semibold text-neutral-400 uppercase">Success</div>
                        </div>
                      </>
                    )}
                    {attemptFreq != null && (
                      <>
                        <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/40" />
                        <div className="text-center">
                          <div className="text-lg font-black text-neutral-900 dark:text-white tabular-nums">{(attemptFreq * 100).toFixed(0)}%</div>
                          <div className="text-[9px] font-semibold text-neutral-400 uppercase">Att Freq</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pitcher matchup indicator */}
                  {pitcherSbPerStart != null && (
                    <div className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border",
                      pitcherSbPerStart > 1.2
                        ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
                        : pitcherSbPerStart < 0.6
                          ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/20"
                          : "bg-neutral-100/50 dark:bg-neutral-800/30 border-neutral-200/40 dark:border-neutral-700/30"
                    )}>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">Pitcher</div>
                        <div className={cn("text-xs font-bold",
                          pitcherSbPerStart > 1.2 ? "text-emerald-400" :
                          pitcherSbPerStart < 0.6 ? "text-red-400" :
                          "text-neutral-400"
                        )}>
                          {pitcherSbPerStart > 1.2 ? "Easy to run on" :
                           pitcherSbPerStart < 0.6 ? "Tough to run on" :
                           "Average"}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <div className="font-bold text-neutral-900 dark:text-white tabular-nums">{pitcherSbPerStart.toFixed(2)}</div>
                          <div className="text-[8px] text-neutral-400">SB/Start</div>
                        </div>
                        {pitcherCsRate != null && (
                          <div className="text-center">
                            <div className={cn("font-bold tabular-nums",
                              pitcherCsRate > 30 ? "text-red-400" : pitcherCsRate < 15 ? "text-emerald-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {pitcherCsRate.toFixed(0)}%
                            </div>
                            <div className="text-[8px] text-neutral-400">CS Rate</div>
                          </div>
                        )}
                        {(expandedStats?.pitcher_pickoffs as number | null) != null && (expandedStats.pitcher_pickoffs as number) > 0 && (
                          <div className="text-center">
                            <div className={cn("font-bold tabular-nums",
                              (expandedStats.pitcher_pickoffs as number) >= 3 ? "text-amber-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {expandedStats.pitcher_pickoffs as number}
                            </div>
                            <div className="text-[8px] text-neutral-400">
                              {(expandedStats.pitcher_pickoffs as number) >= 3 ? "Pickoffs ⚠" : "Pickoffs"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Catcher matchup card */}
                  {isSBMarket && !expandedStats?.catcher_name && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">vs C: Unknown</span>
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 leading-none">Not confirmed</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-1">Catcher not confirmed — matchup data may change</div>
                    </div>
                  )}
                  {expandedStats?.catcher_name && (() => {
                    const pop = expandedStats?.catcher_pop_time as number | null;
                    const arm = expandedStats?.catcher_arm_strength as number | null;
                    const csPct = expandedStats?.catcher_cs_pct as number | null;
                    const exchange = expandedStats?.catcher_exchange as number | null;
                    const sbAllowed = expandedStats?.catcher_sb_allowed as number | null;
                    // Verdict: count green indicators
                    const greens = [
                      pop != null && pop > 2.0,
                      arm != null && arm < 79,
                      csPct != null && csPct < 20,
                    ].filter(Boolean).length;
                    const reds = [
                      pop != null && pop < 1.93,
                      arm != null && arm > 85,
                      csPct != null && csPct > 30,
                    ].filter(Boolean).length;
                    const verdict = greens >= 2 ? "easy" : reds >= 2 ? "tough" : "neutral";
                    return (
                      <div className={cn(
                        "rounded-lg border p-3",
                        verdict === "easy" ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
                          : verdict === "tough" ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/20"
                          : "bg-neutral-100/50 dark:bg-neutral-800/30 border-neutral-200/40 dark:border-neutral-700/30"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">vs C: {expandedStats.catcher_name}</span>
                              <LineupBadge status={expandedStats?.catcher_lineup_status as string | null} />
                            </div>
                          </div>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                            verdict === "easy" ? "bg-emerald-500/15 text-emerald-400"
                              : verdict === "tough" ? "bg-red-500/15 text-red-400"
                              : "bg-neutral-500/10 text-neutral-400"
                          )}>
                            {verdict === "easy" ? "Easy to steal" : verdict === "tough" ? "Tough to steal" : "Average"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          {pop != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">Pop Time</span>
                              <span className={cn("font-bold tabular-nums",
                                pop > 2.0 ? "text-emerald-400" : pop < 1.93 ? "text-red-400" : "text-neutral-300"
                              )}>{pop.toFixed(2)}s</span>
                            </div>
                          )}
                          {arm != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">Arm</span>
                              <span className={cn("font-bold tabular-nums",
                                arm < 79 ? "text-emerald-400" : arm > 85 ? "text-red-400" : "text-neutral-300"
                              )}>{arm.toFixed(1)} mph</span>
                            </div>
                          )}
                          {csPct != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">CS Rate</span>
                              <span className={cn("font-bold tabular-nums",
                                csPct < 20 ? "text-emerald-400" : csPct > 30 ? "text-red-400" : "text-neutral-300"
                              )}>{csPct.toFixed(0)}%</span>
                            </div>
                          )}
                          {exchange != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">Exchange</span>
                              <span className={cn("font-bold tabular-nums",
                                exchange > 0.68 ? "text-emerald-400" : exchange < 0.60 ? "text-red-400" : "text-neutral-300"
                              )}>{exchange.toFixed(2)}s</span>
                            </div>
                          )}
                          {sbAllowed != null && (
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">SB Allowed</span>
                              <span className="font-bold text-neutral-300 tabular-nums">{sbAllowed}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Opposing Lineup K-Rates (pitcher_k hero visualization) */}
              {hasOppKRates && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Opp Lineup K%</h4>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const highK = oppKRates.filter((r) => r >= 28).length;
                        const lowK = oppKRates.filter((r) => r < 18).length;
                        return (
                          <>
                            {highK > 0 && <span className="text-[9px] font-bold text-emerald-400">{highK} high-K</span>}
                            {lowK > 0 && <span className="text-[9px] font-bold text-red-400">{lowK} tough</span>}
                          </>
                        );
                      })()}
                      <span className="text-[10px] font-bold text-neutral-400 tabular-nums">
                        Avg {(oppKRates.reduce((a, b) => a + b, 0) / oppKRates.length).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {oppKRates.map((rate, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 w-4 shrink-0 text-right tabular-nums">{i + 1}</span>
                        <div className="flex-1 h-2.5 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", kRateBg(rate))}
                            style={{ width: `${Math.min(rate * 1.5, 100)}%` }}
                          />
                        </div>
                        <span className={cn("text-[11px] font-bold tabular-nums w-10 text-right", kRateColor(rate))}>
                          {rate.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Book Odds */}
              {!marketConfig.hideOdds && bookEntries.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">All Book Odds</h4>
                    {/* Odds variance callout */}
                    {(() => {
                      const prices = bookEntries.map(([, d]) => d?.over).filter((p): p is number => p != null);
                      if (prices.length < 3) return null;
                      const spread = Math.max(...prices) - Math.min(...prices);
                      if (spread < 200) return null;
                      return (
                        <Tooltip content={`${spread}+ point spread across books — market hasn't settled, potential value opportunity`} side="left">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 cursor-help">
                            Wide Spread
                          </span>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <div className="space-y-0.5">
                    {bookEntries.map(([book, info], idx) => {
                      const bLogo = getBookLogo(book);
                      const isBest = parseBookKey(book) === parseBookKey(bestBook ?? "");
                      const bookLink = resolveBookLink(book, info, false);
                      return (
                        <a
                          key={book}
                          href={bookLink ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { e.stopPropagation(); if (!bookLink) e.preventDefault(); }}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors group",
                            isBest
                              ? "bg-emerald-500/10 dark:bg-emerald-500/10"
                              : idx > 2
                                ? "opacity-50 hover:opacity-100"
                                : "hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {bLogo && <img src={bLogo} alt="" className="h-3.5 w-auto shrink-0" />}
                            <span className="text-neutral-600 dark:text-neutral-400 truncate">{getBookName(book)}</span>
                            {isBest && <span className="text-[9px] font-bold text-emerald-500 shrink-0">BEST</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn(
                              "font-bold tabular-nums",
                              isBest ? "text-emerald-400" : "text-neutral-500 dark:text-neutral-400"
                            )}>
                              {formatOdds(info?.over ?? null)}
                            </span>
                            {bookLink && <ExternalLink className="w-2.5 h-2.5 text-neutral-300 dark:text-neutral-600 group-hover:text-brand transition-colors" />}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4 text-xs text-neutral-400">
                  No odds available for this player
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function MobileCard({ player, rank, marketConfig }: { player: PropScorePlayer; rank: number; marketConfig: MarketConfig }) {
  const [expanded, setExpanded] = useState(false);
  const config = getGradeConfig(player.grade);
  const factors = player.factor_scores ?? {};

  return (
    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 flex items-center gap-3">
        <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
          rank <= 3 ? "bg-amber-500/20 text-amber-400" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
        )}>
          {rank}
        </span>

        <Image
          src={getMlbHeadshotUrl(player.player_id, "tiny")}
          alt={player.player_name}
          width={36}
          height={36}
          className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
          unoptimized
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Image src={`/team-logos/mlb/${player.team_abbr.toUpperCase()}.svg`} alt="" width={14} height={14} className="shrink-0" />
            <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{player.player_name}</span>
            <span className={cn("text-[10px] font-semibold px-1 py-0.5 rounded", config.bg, config.color)}>{player.grade}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
            <span>vs {player.opponent_name || "TBD"}</span>
            {player.line != null && (
              <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">{player.line} {marketConfig.lineLabel}</span>
            )}
            {player.hit_over != null && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                player.hit_over
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              )}>
                {player.hit_over ? "✓" : "✗"}
                {player.actual_stat != null && <span className="tabular-nums">{player.actual_stat}</span>}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!marketConfig.hideOdds && (
            <div className="text-right">
              <span className="text-[10px] text-neutral-500 block">Edge</span>
              <span className={cn("text-xs font-bold tabular-nums",
                (player.edge_pct ?? 0) > 0 ? "text-emerald-400" : (player.edge_pct ?? 0) < 0 ? "text-red-400" : "text-neutral-400"
              )}>
                {player.edge_pct != null ? `${player.edge_pct > 0 ? "+" : ""}${player.edge_pct.toFixed(1)}%` : "-"}
              </span>
            </div>
          )}
          <div className={cn("w-11 h-11 rounded-full flex items-center justify-center border-2 shrink-0", config.border, config.bg)}>
            <span className={cn("text-sm font-black tabular-nums", config.color)}>{Math.round(player.composite_score)}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-neutral-100 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="flex flex-col gap-1.5">
              {marketConfig.factors.map((f) => (
                <SubScoreBar key={f.key} label={f.label} value={factors[f.key] ?? 0} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {marketConfig.columns.map((col) => (
                <React.Fragment key={col.key}>
                  <span className="text-neutral-500">{col.label}</span>
                  <span className="font-bold text-neutral-200 tabular-nums">
                    {formatStatValue(player.key_stats?.[col.key], col.format)}
                  </span>
                </React.Fragment>
              ))}
              {!marketConfig.hideOdds && (
                <>
                  <span className="text-neutral-500">Best Odds</span>
                  <span className="font-bold text-emerald-400 tabular-nums">{formatOdds(player.best_odds)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Game Filter Dropdown (Game Center style) ────────────────────────────────

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function GameFilterDropdown({
  games,
  selectedGame,
  onSelect,
}: {
  games: MlbGame[];
  selectedGame: string;
  onSelect: (gameId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visibleGames = games.filter((g) => {
    const status = (g.game_status || "").toLowerCase();
    return !status.includes("postponed") && !status.includes("cancelled");
  });

  const selectedGameData = selectedGame === "all"
    ? null
    : visibleGames.find((g) => String(g.game_id) === selectedGame);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
          "bg-neutral-100 dark:bg-neutral-800/60 hover:bg-neutral-200 dark:hover:bg-neutral-700/60",
          open && "ring-1 ring-brand/30"
        )}
      >
        {selectedGameData ? (
          <>
            <img src={`/team-logos/mlb/${selectedGameData.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
            <span className="text-neutral-700 dark:text-neutral-300">
              {selectedGameData.away_team_tricode} @ {selectedGameData.home_team_tricode}
            </span>
            <img src={`/team-logos/mlb/${selectedGameData.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
          </>
        ) : (
          <span className="text-neutral-500">All Games</span>
        )}
        <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/50 shadow-2xl overflow-hidden">
          {/* All Games option */}
          <button
            onClick={() => { onSelect("all"); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold transition-colors border-b border-neutral-100 dark:border-neutral-800/50",
              selectedGame === "all"
                ? "bg-brand/5 dark:bg-brand/10 text-brand"
                : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            )}
          >
            All Games
            {selectedGame === "all" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />}
          </button>

          {/* Game list */}
          <div className="max-h-[400px] overflow-y-auto">
            {visibleGames.map((g) => {
              const id = String(g.game_id);
              const isSelected = id === selectedGame;
              const isFinal = (g.game_status || "").toLowerCase().includes("final");
              return (
                <button
                  key={g.game_id}
                  onClick={() => { onSelect(id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                    isSelected
                      ? "bg-brand/5 dark:bg-brand/10"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-5 h-5 object-contain shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                      {g.away_team_tricode} @ {g.home_team_tricode}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">
                      {lastNameOnly(g.away_probable_pitcher)} vs {lastNameOnly(g.home_probable_pitcher)}
                    </div>
                  </div>
                  <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-5 h-5 object-contain shrink-0" alt="" />
                  <div className="text-right shrink-0">
                    {isFinal ? (
                      <span className="text-[10px] font-bold text-neutral-900 dark:text-white tabular-nums">
                        {g.away_team_score}-{g.home_team_score}
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 tabular-nums">{g.game_status}</span>
                    )}
                  </div>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table Helpers ────────────────────────────────────────────────────────────

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      "h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/95 dark:bg-neutral-800/95",
      className
    )}>
      {children}
    </th>
  );
}

function SortBtn({ field, current, dir, onClick, children }: {
  field: SortField; current: SortField; dir: SortDirection; onClick: (f: SortField) => void; children: React.ReactNode;
}) {
  const isActive = field === current;
  return (
    <button
      onClick={() => onClick(field)}
      className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
    >
      {children}
      {isActive
        ? (dir === "desc" ? <ChevronDown className="w-3 h-3 text-brand" /> : <ChevronUp className="w-3 h-3 text-brand" />)
        : <ChevronDown className="w-3 h-3 opacity-30" />}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MlbPropCommandCenter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedDate, setSelectedDateState] = useState(() => searchParams.get("date") || getETDate());
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const [selectedMarket, setSelectedMarketState] = useState<string>(() => searchParams.get("market") || "hr");
  const setSelectedMarket = useCallback((market: string) => {
    setSelectedMarketState(market);
    const params = new URLSearchParams(searchParams.toString());
    params.set("market", market);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const [minScore, setMinScore] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("all");
  const [selectedLine, setSelectedLine] = useState<number | null>(null); // null = use consensus

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();
  const isGated = !isLoadingAccess && !hasAccess;

  const marketConfig = MARKET_MAP.get(selectedMarket) ?? MARKETS[0];

  // Fetch games list for game filter dropdown + status lookup
  const { games: allGames } = useMlbGames();
  const gameMap = useMemo(() => {
    const map = new Map<number, MlbGame>();
    allGames.forEach((g) => map.set(Number(g.game_id), g));
    return map;
  }, [allGames]);

  // Fetch prop scores — all markets including HR now use the same source
  const propResult = useMlbPropScores(selectedDate, selectedMarket);

  // Extract unique game IDs for live odds fetching
  const gameIdsForOdds = useMemo(() => {
    return Array.from(new Set(propResult.players.map((p) => p.game_id)));
  }, [propResult.players]);

  // Fetch live odds per game (same architecture as slate insights)
  const { odds: liveOdds } = usePropLiveOdds(
    marketConfig.hideOdds ? [] : gameIdsForOdds,
    selectedMarket
  );

  // Process players: merge live odds, apply line selection
  const players = useMemo(() => {
    const raw = propResult.players;
    const FIXED_LINES: Record<string, number> = {}; // No forced lines — use Default/selector

    return raw.map((p) => {
      // Determine target line: user-selected > fixed > consensus (null = use API default)
      const fixedLine = FIXED_LINES[p.market];
      const targetLine = selectedLine != null ? selectedLine : (fixedLine ?? p.line);

      // Merge live odds into snapshot (same architecture as slate insights)
      const playerNorm = p.player_name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
      const liveEntry = liveOdds[playerNorm];
      let mergedSnapshot = { ...(p.odds_snapshot ?? {}) };
      if (liveEntry?.all_books) {
        // Live odds have all lines per book — build snapshot entries keyed by book__line
        for (const ab of liveEntry.all_books) {
          const line = ab.line ?? liveEntry.line;
          if (line == null) continue;
          const key = `${ab.book}__${line}`;
          mergedSnapshot[key] = {
            line,
            over: ab.price,
            under: null,
            link: ab.link,
            mobile_link: ab.mobile_link,
          };
        }
      }

      let updated = { ...p, line: targetLine, odds_snapshot: mergedSnapshot };

      // Filter best_odds to target line from odds_snapshot
      if (updated.odds_snapshot && targetLine != null) {
        let bestPrice: number | null = null;
        let bestBook: string | null = null;
        const seenBooks = new Set<string>();
        for (const [bookKey, data] of Object.entries(updated.odds_snapshot)) {
          if (!data || data.line !== targetLine || data.over == null) continue;
          const realBook = parseBookKey(bookKey);
          if (seenBooks.has(realBook)) continue;
          seenBooks.add(realBook);
          if (bestPrice == null || data.over > bestPrice) {
            bestPrice = data.over;
            bestBook = realBook;
          }
        }
        if (bestPrice != null) {
          updated = { ...updated, best_odds: bestPrice, best_odds_book: bestBook };

          // Use prob_lines from backend for line-specific model probability
          const probLines = (p.key_stats?.prob_lines ?? {}) as Record<string, number>;
          const lineKey = targetLine != null ? String(targetLine) : null;
          const modelProb = lineKey && probLines[lineKey] != null ? probLines[lineKey] : p.model_prob;

          // Compute deduped avg implied (Kambi books counted once)
          const avgImplied = avgImpliedDeduped(updated.odds_snapshot, targetLine);
          const impliedProb = avgImplied ?? oddsToImplied(bestPrice);

          // Compute edge: model prob vs market implied
          const edge = modelProb != null && impliedProb > 0
            ? ((modelProb - impliedProb) / impliedProb) * 100
            : null;

          updated = {
            ...updated,
            model_prob: modelProb,
            implied_prob: impliedProb,
            edge_pct: edge != null ? Math.round(edge * 100) / 100 : null,
          };
        } else {
          updated = { ...updated, best_odds: null, best_odds_book: null };
        }
      }

      return updated;
    });
  }, [propResult.players, selectedLine, liveOdds]);
  const isLoading = propResult.isLoading;
  const availableDates = propResult.availableDates;

  // Reset state when market changes
  React.useEffect(() => {
    setExpandedPlayerId(null);
    setSortField("score");
    setSortDirection("desc");
    setSelectedGame("all");
    setSelectedLine(null);
  }, [selectedMarket]);

  // Auto-advance to available date
  React.useEffect(() => {
    if (isLoading || players.length > 0 || availableDates.length === 0) return;
    if (!availableDates.includes(selectedDate)) {
      const nextDate = availableDates.find((d) => d >= selectedDate) ?? availableDates[0];
      setSelectedDate(nextDate);
    }
  }, [isLoading, players.length, availableDates, selectedDate]);

  // Game filter options — extract team tricodes for logos
  const gameOptions = useMemo(() => {
    const games = new Map<string, { teams: Set<string>; tricodes: string[] }>();
    players.forEach((p) => {
      const key = String(p.game_id);
      if (!games.has(key)) games.set(key, { teams: new Set(), tricodes: [] });
      const entry = games.get(key)!;
      entry.teams.add(p.team_abbr);
      if (p.opponent_name) entry.teams.add(p.opponent_name);
    });
    return Array.from(games.entries())
      .map(([gameId, { teams }]) => {
        const sorted = [...teams].sort();
        return { gameId, label: sorted.join(" @ "), teams: sorted };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [players]);

  React.useEffect(() => { setSelectedGame("all"); }, [selectedDate]);

  // Filter
  const filteredPlayers = useMemo(() => {
    let result = players;
    if (selectedGame !== "all") {
      result = result.filter((p) => String(p.game_id) === selectedGame);
    }
    if (minScore > 0) {
      result = result.filter((p) => p.composite_score >= minScore);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          p.team_abbr.toLowerCase().includes(q) ||
          (p.opponent_name ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [players, minScore, searchQuery, selectedGame]);

  // Sort
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortField) {
        case "score": aVal = a.composite_score; bVal = b.composite_score; break;
        case "player": aVal = a.player_name; bVal = b.player_name; break;
        case "edge_pct": aVal = a.edge_pct ?? -999; bVal = b.edge_pct ?? -999; break;
        case "line": aVal = a.line ?? -999; bVal = b.line ?? -999; break;
        case "best_odds": aVal = a.best_odds ?? -9999; bVal = b.best_odds ?? -9999; break;
        case "col0": {
          const k = marketConfig.columns[0]?.key;
          aVal = k ? Number(a.key_stats?.[k] ?? 0) : 0;
          bVal = k ? Number(b.key_stats?.[k] ?? 0) : 0;
          break;
        }
        case "col1": {
          const k = marketConfig.columns[1]?.key;
          aVal = k ? Number(a.key_stats?.[k] ?? 0) : 0;
          bVal = k ? Number(b.key_stats?.[k] ?? 0) : 0;
          break;
        }
        case "col2": {
          const k = marketConfig.columns[2]?.key;
          aVal = k ? Number(a.key_stats?.[k] ?? 0) : 0;
          bVal = k ? Number(b.key_stats?.[k] ?? 0) : 0;
          break;
        }
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortDirection === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [filteredPlayers, sortField, sortDirection, marketConfig]);

  const displayPlayers = isGated ? sortedPlayers.slice(0, FREE_MAX_ROWS) : sortedPlayers;

  const rankMap = useMemo(() => {
    const ranked = [...filteredPlayers].sort((a, b) => b.composite_score - a.composite_score);
    const map = new Map<number, number>();
    ranked.forEach((p, i) => map.set(p.player_id, i + 1));
    return map;
  }, [filteredPlayers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-0">
      {/* Unified header card: Market Tabs + Filters */}
      <div className="rounded-xl bg-neutral-50/80 dark:bg-neutral-950/40 border border-neutral-200/60 dark:border-neutral-800/60 overflow-visible">
        {/* Market Tabs — grouped by player type */}
        <div className="px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {/* Batter props */}
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400/70 dark:text-neutral-500/70 mr-0.5 shrink-0 hidden sm:inline">Bat</span>
            {MARKETS.filter((m) => m.playerType === "batter").map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  selectedMarket === m.key
                    ? "bg-brand text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-800/60"
                )}
              >
                {isMobile ? m.shortLabel : m.label}
              </button>
            ))}

            {/* Divider */}
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1 shrink-0" />

            {/* Pitcher props */}
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400/70 dark:text-neutral-500/70 mr-0.5 shrink-0 hidden sm:inline">Pitch</span>
            {MARKETS.filter((m) => m.playerType === "pitcher").map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  selectedMarket === m.key
                    ? "bg-brand text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-800/60"
                )}
              >
                {isMobile ? m.shortLabel : m.label}
              </button>
            ))}
          </div>

          {/* Line selector — only show for markets with multiple lines */}
          {marketConfig.lineOptions && marketConfig.lineOptions.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Line</span>
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/60 dark:bg-neutral-800/60">
                {/* Default — uses each player's consensus line from the API */}
                <button
                  onClick={() => setSelectedLine(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    selectedLine === null
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  Default
                </button>
                {marketConfig.lineOptions.map((ln) => (
                  <button
                    key={ln}
                    onClick={() => setSelectedLine(ln)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all tabular-nums",
                      selectedLine === ln
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {ln}+
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200/40 dark:border-neutral-800/30" />

        {/* Filter row — desktop */}
        {!isMobile && (
          <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <DateNav
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              availableDates={availableDates}
            />
            <FilterDivider />
            <SegmentedControl
              value={String(minScore)}
              onChange={(v) => setMinScore(Number(v))}
              options={MIN_SCORE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
            />
            {allGames.length > 1 && (
              <>
                <FilterDivider />
                <GameFilterDropdown
                  games={allGames}
                  selectedGame={selectedGame}
                  onSelect={setSelectedGame}
                />
              </>
            )}
            <div className="flex-1 min-w-0" />
            <div className="flex items-center gap-3 shrink-0">
              <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search player..." />
              <FilterCount count={filteredPlayers.length} label="players" />
            </div>
          </div>
        )}

        {/* Filter — mobile */}
        {isMobile && (
          <div className="px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} availableDates={availableDates} />
              <FilterCount count={filteredPlayers.length} label="players" />
            </div>
            <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search player..." />
            <div className="flex items-center gap-2 w-full">
              <SegmentedControl
                fullWidth
                value={String(minScore)}
                onChange={(v) => setMinScore(Number(v))}
                options={MIN_SCORE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
              />
              {allGames.length > 1 && (
                <GameFilterDropdown
                  games={allGames}
                  selectedGame={selectedGame}
                  onSelect={setSelectedGame}
                />
              )}
            </div>
          </div>
        )}

        {/* Grade legend */}
        <div className="hidden md:flex px-4 py-1.5 items-center gap-4 border-t border-neutral-200/40 dark:border-neutral-800/30 text-[10px] text-neutral-400">
          <span className="font-medium text-neutral-500">Grades:</span>
          {GRADES.map((g) => (
            <span key={g.grade} className="flex items-center gap-1">
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", g.bg, g.color)}>{g.grade} {g.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Table / Cards */}
      <div className="relative mt-3">
        {isMobile && !isLoading && sortedPlayers.length > 0 ? (
          <div className="space-y-3">
            {displayPlayers.map((player, idx) => (
              <MobileCard key={`${player.player_id}-${player.market}-${player.game_id}`} player={player} rank={rankMap.get(player.player_id) ?? idx + 1} marketConfig={marketConfig} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden bg-white dark:bg-neutral-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand mx-auto" />
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Loading prop scores...</p>
                </div>
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center max-w-sm">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No data</h3>
                  <p className="text-sm text-neutral-500">{searchQuery ? "No players match your search." : "No prop scores available for this date and market."}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[400px]">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm">
                      <Th className="w-8 text-center">#</Th>
                      <Th className="min-w-[160px] text-left">
                        <SortBtn field="player" current={sortField} dir={sortDirection} onClick={handleSort}>Player</SortBtn>
                      </Th>
                      <Th className="text-left">Opponent</Th>
                      <Th className="w-16">
                        <SortBtn field="score" current={sortField} dir={sortDirection} onClick={handleSort}>Score</SortBtn>
                      </Th>
                      {/* Market-specific columns */}
                      {marketConfig.columns.map((col, i) => (
                        <Th key={col.key}>
                          <Tooltip content={col.tooltip ?? col.label} side="top">
                            <span className="cursor-help">
                              <SortBtn field={`col${i}` as SortField} current={sortField} dir={sortDirection} onClick={handleSort}>
                                {col.label}
                              </SortBtn>
                            </span>
                          </Tooltip>
                        </Th>
                      ))}
                      {!marketConfig.hideOdds && (
                        <Th>
                          <SortBtn field="best_odds" current={sortField} dir={sortDirection} onClick={handleSort}>Odds</SortBtn>
                        </Th>
                      )}
                      {!marketConfig.hideOdds && (
                        <Th>
                          <Tooltip content="Model probability — how likely this outcome is based on our scoring model" side="top">
                            <span className="cursor-help text-[10px]">Prob</span>
                          </Tooltip>
                        </Th>
                      )}
                      {!marketConfig.hideOdds && (
                        <Th>
                          <Tooltip content="Model edge: positive = value bet opportunity" side="top">
                            <span className="cursor-help">
                              <SortBtn field="edge_pct" current={sortField} dir={sortDirection} onClick={handleSort}>Edge</SortBtn>
                            </span>
                          </Tooltip>
                        </Th>
                      )}
                      <Th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayPlayers.map((player, idx) => {
                      const isExpanded = expandedPlayerId === player.player_id;
                      const config = getGradeConfig(player.grade);
                      const rank = rankMap.get(player.player_id) ?? idx + 1;
                      const game = gameMap.get(player.game_id);
                      const gameState = getGameState(game?.game_status ?? null);
                      const isStarted = gameState !== "upcoming";
                      return (
                        <React.Fragment key={`${player.player_id}-${player.market}-${player.game_id}`}>
                          <tr
                            onClick={() => setExpandedPlayerId(isExpanded ? null : player.player_id)}
                            className={cn(
                              "cursor-pointer border-b border-neutral-100 dark:border-neutral-800/50 transition-colors",
                              isExpanded
                                ? "bg-neutral-50 dark:bg-neutral-800/40"
                                : "hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20",
                              gameState === "final" && "opacity-50",
                              gameState === "live" && "bg-neutral-900/5 dark:bg-neutral-950/30"
                            )}
                          >
                            {/* Rank */}
                            <td className="px-2 py-2 text-center">
                              <span className={cn("inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-black",
                                rank <= 3 ? "bg-amber-500/20 text-amber-400" : rank <= 10 ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500" : "text-neutral-400"
                              )}>
                                {rank}
                              </span>
                            </td>

                            {/* Player — compact with line badge */}
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <Image
                                  src={getMlbHeadshotUrl(player.player_id, "tiny")}
                                  alt={player.player_name}
                                  width={28}
                                  height={28}
                                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                                  unoptimized
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Image src={`/team-logos/mlb/${player.team_abbr.toUpperCase()}.svg`} alt="" width={12} height={12} className="shrink-0" />
                                    <span className="font-bold text-neutral-900 dark:text-white truncate text-xs">{player.player_name}</span>
                                    {player.batting_order && (
                                      <Tooltip content={`Batting ${player.batting_order}${player.batting_order <= 3 ? " — top of order, more ABs" : player.batting_order <= 5 ? " — middle order, RBI spot" : player.batting_order <= 7 ? " — lower order" : " — bottom of order, fewer ABs"}`} side="top">
                                        <span className={cn(
                                          "text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 cursor-help tabular-nums",
                                          player.batting_order <= 2 ? "bg-emerald-500/10 text-emerald-400" :
                                          player.batting_order <= 5 ? "bg-brand/10 text-brand" :
                                          "bg-neutral-500/10 text-neutral-400"
                                        )}>
                                          #{player.batting_order}
                                        </span>
                                      </Tooltip>
                                    )}
                                    <LineupBadge status={player.lineup_status} />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {player.line != null && (
                                      <span className="text-[10px] font-mono font-semibold text-neutral-500 tabular-nums">
                                        {player.line}+ {marketConfig.lineLabel}
                                      </span>
                                    )}
                                    {player.hit_over != null && (
                                      <span className={cn(
                                        "inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                                        player.hit_over
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : "bg-red-500/15 text-red-400"
                                      )}>
                                        {player.hit_over ? "✓" : "✗"}
                                        {player.actual_stat != null && (
                                          <span className="tabular-nums">{player.actual_stat}</span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Opponent + Game Time */}
                            <td className="px-2 py-2">
                              <div className="min-w-0 max-w-[140px]">
                                <div className="text-[11px] text-neutral-500 truncate">
                                  {player.opponent_name || "TBD"}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {game && (
                                    <span className="text-[9px] text-neutral-400 tabular-nums">
                                      {game.game_status}
                                    </span>
                                  )}
                                  {gameState === "live" && game && (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 leading-none tabular-nums">
                                      {game.away_team_score ?? 0}-{game.home_team_score ?? 0}
                                    </span>
                                  )}
                                  {gameState === "final" && game && (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-neutral-500/15 text-neutral-400 leading-none tabular-nums">
                                      F {game.away_team_score ?? 0}-{game.home_team_score ?? 0}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-2 py-2 text-center">
                              <div className={cn("inline-flex w-9 h-9 rounded-full items-center justify-center border-2", config.border, config.bg)}>
                                <span className={cn("text-xs font-black tabular-nums", config.color)}>{Math.round(player.composite_score)}</span>
                              </div>
                            </td>

                            {/* Market-specific columns */}
                            {marketConfig.columns.map((col) => {
                              const rawVal = player.key_stats?.[col.key];
                              const isNullish = rawVal == null || (Number(rawVal) === 0 && ZERO_IS_NULL_STATS.has(col.key));
                              const cellColor = isNullish ? "" : getStatCellColor(col.key, rawVal);
                              return (
                                <td key={col.key} className={cn("px-3 py-2 text-center", cellColor)}>
                                  <span className={cn("text-xs font-bold tabular-nums", !cellColor && "text-neutral-700 dark:text-neutral-300")}>
                                    {isNullish ? "-" : formatStatValue(rawVal, col.format)}
                                  </span>
                                </td>
                              );
                            })}

                            {/* Odds */}
                            {!marketConfig.hideOdds && (
                              <td className="px-2 py-2 text-center">
                                <OddsCell player={player} marketConfig={marketConfig} isMobile={isMobile} />
                              </td>
                            )}

                            {/* Prob — model vs market */}
                            {!marketConfig.hideOdds && (
                              <td className="px-2 py-2 text-center">
                                {(() => {
                                  const marketImpl = avgImpliedDeduped(player.odds_snapshot, player.line);
                                  const modelProb = player.model_prob;
                                  if (modelProb == null && marketImpl == null) return <span className="text-xs text-neutral-500">-</span>;
                                  return (
                                    <div className="flex flex-col items-center gap-0.5">
                                      {modelProb != null && (
                                        <span className="text-[11px] font-bold tabular-nums text-neutral-900 dark:text-white">
                                          {(modelProb * 100).toFixed(0)}%
                                        </span>
                                      )}
                                      {marketImpl != null && (
                                        <span className="text-[9px] tabular-nums text-neutral-400">
                                          Mkt {(marketImpl * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                            )}

                            {/* Edge */}
                            {!marketConfig.hideOdds && (
                              <td className="px-2 py-2 text-center">
                                {player.edge_pct != null ? (
                                  <span className={cn("text-xs font-bold tabular-nums",
                                    player.edge_pct > 0 ? "text-emerald-400" : player.edge_pct < 0 ? "text-red-400" : "text-neutral-400"
                                  )}>
                                    {player.edge_pct > 0 ? "+" : ""}{player.edge_pct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-neutral-500">-</span>
                                )}
                              </td>
                            )}

                            {/* Expand */}
                            <td className="px-2 py-2.5 text-center">
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                                : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                            </td>
                          </tr>
                          {isExpanded && <ExpandedRow player={player} marketConfig={marketConfig} />}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Gating overlay */}
        {isGated && sortedPlayers.length > FREE_MAX_ROWS && (
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white dark:from-neutral-950 to-transparent flex items-end justify-center pb-6">
            <div className="text-center">
              <Lock className="w-5 h-5 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                {sortedPlayers.length - FREE_MAX_ROWS} more players available
              </p>
              <ButtonLink href={UPGRADE_URL} className="mt-2 text-sm">
                Upgrade to unlock
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

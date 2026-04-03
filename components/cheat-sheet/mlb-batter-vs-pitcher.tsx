"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbGames } from "@/hooks/use-mlb-games";
import type { MlbGame } from "@/hooks/use-mlb-games";
import {
  useMlbGameMatchup,
  type PitcherProfile,
  type PitchArsenalRow,
  type BatterMatchup,
  type BatterPitchSplit,
} from "@/hooks/use-mlb-game-matchup";
import { useMlbHotZone, type BatterZoneCell, type PitcherZoneCell, type OverlayZoneCell } from "@/hooks/use-mlb-hot-zone";
import { useMlbBatterOdds, type BatterOddsEntry } from "@/hooks/use-mlb-batter-odds";
import { useHasSharpAccess } from "@/hooks/use-entitlements";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { ChevronRight, ChevronDown, Users, Loader2, AlertCircle, TableProperties, GitCompare, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useStateLink } from "@/hooks/use-state-link";

// ── Constants ────────────────────────────────────────────────────────────────

const ODDS_MARKETS = [
  { key: "player_home_runs", label: "Home Runs", shortLabel: "HR", defaultLine: 0.5 },
  { key: "player_hits", label: "Hits", shortLabel: "H", defaultLine: 0.5 },
  { key: "player_total_bases", label: "Total Bases", shortLabel: "TB", defaultLine: 0.5 },
  { key: "player_rbis", label: "RBIs", shortLabel: "RBI", defaultLine: 0.5 },
  { key: "player_runs", label: "Runs", shortLabel: "R", defaultLine: 0.5 },
  { key: "player_hits__runs__rbis", label: "H+R+RBI", shortLabel: "HRR", defaultLine: 0.5 },
  { key: "player_stolen_bases", label: "Stolen Bases", shortLabel: "SB", defaultLine: 0.5 },
];

const ODDS_LINE_OPTIONS: Record<string, number[]> = {
  player_home_runs: [0.5],
  player_hits: [0.5, 1.5, 2.5],
  player_total_bases: [0.5, 1.5, 2.5, 3.5],
  player_rbis: [0.5, 1.5],
  player_runs: [0.5, 1.5],
  player_hits__runs__rbis: [0.5, 1.5, 2.5, 3.5],
  player_stolen_bases: [0.5],
};

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(normalizeSportsbookId(bookId));
  return sb?.image?.square ?? sb?.image?.light ?? null;
}

function formatOddsPrice(price: number): string {
  return price >= 0 ? `+${price}` : `${price}`;
}

function normalizePlayerForOdds(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Find a player's odds entry by normalized name lookup */
function findPlayerOdds(odds: Record<string, BatterOddsEntry>, playerName: string): BatterOddsEntry | null {
  return odds[normalizePlayerForOdds(playerName)] ?? null;
}

function getPreferredLink(desktopLink?: string | null, mobileLink?: string | null): string | null {
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? (mobileLink || desktopLink || null) : (desktopLink || mobileLink || null);
}

function OddsSkeleton() {
  return (
    <div className="inline-flex items-center gap-1.5 animate-pulse">
      <div className="h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-3.5 w-10 rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

function OddsCell({ entry, hasSharpAccess = false, isLoading = false }: { entry: BatterOddsEntry | null; hasSharpAccess?: boolean; isLoading?: boolean }) {
  const applyState = useStateLink();
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (isLoading) return <OddsSkeleton />;
  if (!entry) return <span className="text-[10px] text-neutral-400">-</span>;
  const sorted = [...entry.all_books].sort((a, b) => b.price - a.price);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        {/* Book logo with EV badge overlay */}
        <span className="relative shrink-0">
          {getBookLogo(entry.best_book) && (
            <img src={getBookLogo(entry.best_book)!} alt="" className="h-4 w-4 rounded object-contain" />
          )}
          {hasSharpAccess && entry.ev_pct != null && entry.ev_pct > 0 && (
            <span className={cn(
              "absolute -top-2 -right-3 text-[8px] font-bold px-1 py-[1px] rounded leading-none whitespace-nowrap shadow-sm",
              entry.ev_pct >= 5 ? "bg-[#22C55E] text-white"
                : entry.ev_pct >= 2 ? "bg-[#22C55E] text-white"
                : "bg-[#EAB308] text-white"
            )}>
              +{entry.ev_pct.toFixed(0)}%
            </span>
          )}
        </span>
        <span className={cn(
          "font-mono text-xs font-bold tabular-nums",
          entry.best_price >= 0 ? "text-[#22C55E]" : "text-neutral-600 dark:text-neutral-300"
        )}>
          {formatOddsPrice(entry.best_price)}
        </span>
        <ChevronDown className={cn("w-2.5 h-2.5 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/50 shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
          {/* Header: fair value + EV */}
          {hasSharpAccess && entry.fair_american && (
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/20">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-neutral-500">Fair <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{entry.fair_american}</span></span>
                {entry.ev_pct != null && entry.ev_pct > 0 && (
                  <span className={cn("font-bold px-1.5 py-0.5 rounded text-[9px]",
                    entry.ev_pct >= 5 ? "bg-[#22C55E] text-white" : entry.ev_pct >= 2 ? "bg-[#22C55E]/80 text-white" : "bg-[#EAB308] text-white"
                  )}>+{entry.ev_pct.toFixed(1)}% EV</span>
                )}
              </div>
            </div>
          )}
          {/* Book rows */}
          {sorted.map((book, idx) => {
            const logo = getBookLogo(book.book);
            const link = getPreferredLink(book.link, book.mobile_link);
            const isBest = idx === 0;
            const isPositive = book.price >= 0;
            return (
              <a
                key={book.book}
                href={link ? (applyState(link) || link) : "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.stopPropagation(); if (!link) e.preventDefault(); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-xs border-b border-neutral-100/50 dark:border-neutral-800/20 last:border-0 transition-colors",
                  link ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/30" : "opacity-40",
                  isBest && "bg-[#22C55E]/[0.04]"
                )}
              >
                <span className={cn(
                  "font-mono font-bold tabular-nums w-14",
                  isBest ? "text-[#22C55E]" : "text-neutral-700 dark:text-neutral-200"
                )}>
                  {formatOddsPrice(book.price)}
                </span>
                <div className="flex items-center justify-center">
                  {logo ? <img src={logo} alt="" className="h-5 w-5 rounded object-contain" /> : <span className="text-[9px] text-neutral-500">{book.book.slice(0, 3).toUpperCase()}</span>}
                </div>
                <span className="text-[10px] text-neutral-400 w-14 text-right">
                  {link ? "Bet →" : "—"}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SAMPLE_OPTIONS = [
  { value: "season" as const, label: "Season" },
  { value: "30" as const, label: "Last 30" },
  { value: "15" as const, label: "Last 15" },
  { value: "7" as const, label: "Last 7" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "TBD";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function fmtPct(val: number | null, digits = 1): string {
  if (val == null) return "-";
  return `${val.toFixed(digits)}%`;
}

function fmtAvg(val: number | null): string {
  if (val == null) return "-";
  return val >= 1 ? val.toFixed(3) : `.${Math.round(val * 1000).toString().padStart(3, "0")}`;
}

function fmtStat(val: number | null, digits = 2): string {
  if (val == null) return "-";
  return val.toFixed(digits);
}

// ── Stat colors — vivid hex for data-dense display ──────────────────────────
// Green: #22C55E (vivid success), Amber: #EAB308 (energetic warning), Red: #FC1414 (vibrant rose)
// Fresh & energetic palette per design system

// ── Vibrant color system — text + cell backgrounds ─────────────────────────
// 5-tier: strong green → light green → neutral → light red → strong red
// Works on both light and dark mode via opacity-based backgrounds

const STAT_GREEN = "text-[#16A34A] dark:text-[#4ADE80]";
const STAT_AMBER = "text-[#CA8A04] dark:text-[#FACC15]";
const STAT_RED   = "text-[#FC1414] dark:text-[#FC5555]";

// Cell background + text combos for heatmap-style cells
// White text on colored bg — matches competitor's high-contrast heatmap style
const CELL_STRONG_GREEN = "bg-[#16A34A]/30 dark:bg-[#22C55E]/30 text-[#15803D] dark:text-white";
const CELL_LIGHT_GREEN  = "bg-[#16A34A]/15 dark:bg-[#22C55E]/18 text-[#15803D] dark:text-white/90";
const CELL_NEUTRAL      = "text-neutral-700 dark:text-neutral-300";
const CELL_LIGHT_RED    = "bg-[#FC1414]/15 dark:bg-[#FC1414]/20 text-[#FC1414] dark:text-white/90";
const CELL_STRONG_RED   = "bg-[#FC1414]/25 dark:bg-[#FC1414]/35 text-[#FC1414] dark:text-white";

/** 5-tier cell style: returns bg + text classes for heatmap cells. Higher = good by default. */
function statCell(
  val: number | null,
  tiers: { elite: number; good: number; poor: number; bad: number },
  higherIsGood = true
): string {
  if (val == null || val === 0) return "";
  if (higherIsGood) {
    if (val >= tiers.elite) return CELL_STRONG_GREEN;
    if (val >= tiers.good)  return CELL_LIGHT_GREEN;
    if (val <= tiers.bad)   return CELL_STRONG_RED;
    if (val <= tiers.poor)  return CELL_LIGHT_RED;
  } else {
    if (val <= tiers.elite) return CELL_STRONG_GREEN;
    if (val <= tiers.good)  return CELL_LIGHT_GREEN;
    if (val >= tiers.bad)   return CELL_STRONG_RED;
    if (val >= tiers.poor)  return CELL_LIGHT_RED;
  }
  return CELL_NEUTRAL;
}

/** Text-only version for inline stats (no background) */
function statText(
  val: number | null,
  tiers: { elite: number; good: number; poor: number; bad: number },
  higherIsGood = true
): string {
  if (val == null || val === 0) return "";
  if (higherIsGood) {
    if (val >= tiers.good)  return STAT_GREEN;
    if (val <= tiers.poor)  return STAT_RED;
  } else {
    if (val <= tiers.good)  return STAT_GREEN;
    if (val >= tiers.poor)  return STAT_RED;
  }
  return "";
}

// Convenience wrappers — thresholds from batter's perspective
function slgColor(val: number | null): string {
  return statCell(val, { elite: 0.500, good: 0.400, poor: 0.350, bad: 0.300 });
}
function isoColor(val: number | null): string {
  return statCell(val, { elite: 0.220, good: 0.160, poor: 0.120, bad: 0.080 });
}
function baaColor(val: number | null): string {
  return statCell(val, { elite: 0.300, good: 0.260, poor: 0.210, bad: 0.180 });
}
function wobaColor(val: number | null): string {
  return statCell(val, { elite: 0.370, good: 0.320, poor: 0.290, bad: 0.260 });
}
function evColor(val: number | null): string {
  return statCell(val, { elite: 92, good: 89, poor: 87, bad: 85 });
}
function hardHitColor(val: number | null): string {
  return statCell(val, { elite: 45, good: 38, poor: 30, bad: 25 });
}
function barrelColor(val: number | null): string {
  return statCell(val, { elite: 10, good: 6.5, poor: 4, bad: 2 });
}
function kPctColor(val: number | null): string {
  // Lower K% = better for batter
  return statCell(val, { elite: 15, good: 20, poor: 27, bad: 32 }, false);
}
function bbPctColor(val: number | null): string {
  // Higher BB% = better for batter
  return statCell(val, { elite: 12, good: 9, poor: 5, bad: 3 });
}

// Text-only wrappers for inline stats (mobile rows, pitch splits, etc.)
function slgTextColor(val: number | null): string {
  return statText(val, { elite: 0.500, good: 0.400, poor: 0.350, bad: 0.300 });
}
function wobaTextColor(val: number | null): string {
  return statText(val, { elite: 0.370, good: 0.320, poor: 0.290, bad: 0.260 });
}
function evTextColor(val: number | null): string {
  return statText(val, { elite: 92, good: 89, poor: 87, bad: 85 });
}
function barrelTextColor(val: number | null): string {
  return statText(val, { elite: 10, good: 6.5, poor: 4, bad: 2 });
}

// Heat map cell backgrounds — vivid tints (used in zone analysis etc)
function heatBg(val: number | null, thresholds: { green: number; yellow: number; red: number; higher: "good" | "bad" }, intense = false): string {
  if (val == null) return "";
  const isHighGood = thresholds.higher === "good";
  const g = intense ? "bg-[#16A34A]/25" : "bg-[#16A34A]/12";
  const y = intense ? "bg-[#CA8A04]/20" : "bg-[#CA8A04]/10";
  const r = intense ? "bg-[#FC1414]/25" : "bg-[#FC1414]/12";
  if (isHighGood) {
    if (val >= thresholds.green) return g;
    if (val >= thresholds.yellow) return y;
    if (val <= thresholds.red) return r;
  } else {
    if (val <= thresholds.green) return g;
    if (val <= thresholds.yellow) return y;
    if (val >= thresholds.red) return r;
  }
  return "";
}

// Pitcher stat colors — from BATTER'S perspective
// Green = hittable pitcher (good for batters), Red = elite pitcher (bad for batters)
function eraColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 4.50) return STAT_GREEN;
  if (val <= 3.00) return STAT_RED;
  return "";
}

function whipColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 1.35) return STAT_GREEN;
  if (val <= 1.05) return STAT_RED;
  return "";
}

function kPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 10.0) return STAT_RED;
  if (val <= 6.5) return STAT_GREEN;
  return "";
}

function bbPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 3.5) return STAT_GREEN;
  if (val <= 2.0) return STAT_RED;
  return "";
}

function hrPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 1.40) return STAT_GREEN;
  if (val <= 0.80) return STAT_RED;
  return "";
}

function fipColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 4.50) return STAT_GREEN;
  if (val <= 3.00) return STAT_RED;
  return "";
}

function hrFbColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 14) return STAT_GREEN;
  if (val <= 7) return STAT_RED;
  return "";
}

function trendArrow(trend: "up" | "down" | "flat" | null | undefined): string {
  if (trend === "up") return " ↑";
  if (trend === "down") return " ↓";
  return "";
}

function trendColor(trend: "up" | "down" | "flat" | null | undefined): string {
  if (trend === "up") return STAT_GREEN;
  if (trend === "down") return STAT_RED;
  return "";
}

function gradeBadge(grade: "strong" | "neutral" | "weak", hrScore?: number | null) {
  // Map to letter grades using matchup grade + HR score for granularity
  const score = hrScore ?? 50;
  if (grade === "strong") {
    if (score >= 75) return { label: "A+", text: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/15" };
    if (score >= 65) return { label: "A", text: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/15" };
    return { label: "B+", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8 dark:bg-emerald-500/10" };
  }
  if (grade === "weak") {
    if (score <= 30) return { label: "D", text: "text-red-500 dark:text-red-400", bg: "bg-red-500/10 dark:bg-red-500/15" };
    return { label: "C-", text: "text-red-400 dark:text-red-400", bg: "bg-red-500/8 dark:bg-red-500/10" };
  }
  // neutral
  if (score >= 60) return { label: "B", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/8 dark:bg-amber-500/10" };
  if (score >= 45) return { label: "C+", text: "text-neutral-500 dark:text-neutral-400", bg: "bg-neutral-500/8 dark:bg-neutral-500/10" };
  return { label: "C", text: "text-neutral-500 dark:text-neutral-400", bg: "bg-neutral-500/8 dark:bg-neutral-500/10" };
}

// ── Game List Row ────────────────────────────────────────────────────────────

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "";
  if (pf >= 110) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (pf >= 103) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (pf <= 90) return "text-[#FC1414] dark:text-[#F87171]";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-500";
}

function hrImpactColor(score: number | null): string {
  if (score == null) return "";
  if (score >= 7) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (score >= 4) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (score <= -4) return "text-[#FC1414] dark:text-[#F87171]";
  return "text-neutral-500";
}

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function GameChip({
  game,
  selected,
  onClick,
}: {
  game: MlbGame;
  selected: boolean;
  onClick: () => void;
}) {
  const w = game.weather;
  const isRetractable = w?.roof_type === "retractable" || w?.roof_type === "dome";

  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 w-[148px] rounded-lg border-2 px-2.5 py-1.5 text-center transition-all",
        selected
          ? "border-brand bg-brand/5 dark:bg-brand/10"
          : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 opacity-60 hover:opacity-100"
      )}
    >
      {/* Row 1: Teams */}
      <div className="flex items-center justify-center gap-1.5">
        <img
          src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
          alt={game.away_team_tricode}
          className="h-4 w-4 object-contain shrink-0"
          loading="lazy"
        />
        <span className="text-[11px] font-bold text-neutral-900 dark:text-white">
          {game.away_team_tricode} @ {game.home_team_tricode}
        </span>
        <img
          src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
          alt={game.home_team_tricode}
          className="h-4 w-4 object-contain shrink-0"
          loading="lazy"
        />
      </div>

      {/* Row 2: Pitchers */}
      <div className="mt-0.5 text-[10px] text-neutral-500 truncate">
        {lastNameOnly(game.away_probable_pitcher)} vs {lastNameOnly(game.home_probable_pitcher)}
      </div>

      {/* Row 3: Time + Park Factor */}
      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
        <span className="text-neutral-400 tabular-nums">{game.game_status}</span>
        {game.park_factor != null && (
          <span className={cn("font-semibold tabular-nums", parkFactorColor(game.park_factor))}>
            PF {game.park_factor}
          </span>
        )}
        {isRetractable ? (
          <span className="text-neutral-400">Dome</span>
        ) : w && w.hr_impact_score != null ? (
          <span className={cn("font-medium tabular-nums", hrImpactColor(w.hr_impact_score))}>
            {w.hr_impact_score > 0 ? "+" : ""}{w.hr_impact_score}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ── Mobile Game Selector ────────────────────────────────────────────────────

function MobileGameSelector({
  games,
  selectedGameId,
  onSelect,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = games.find((g) => Number(g.game_id) === selectedGameId);

  function getDateLabel(gameDate: string) {
    const d = new Date(gameDate + "T12:00:00");
    const fmtET = (dt: Date) => dt.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const todayET = fmtET(new Date());
    const tomorrowDt = new Date();
    tomorrowDt.setDate(tomorrowDt.getDate() + 1);
    const tomorrowET = fmtET(tomorrowDt);
    if (gameDate === todayET) return "Today";
    if (gameDate === tomorrowET) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  return (
    <div data-tour="game-bar" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <img src={`/team-logos/mlb/${selected.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {selected.away_team_tricode} @ {selected.home_team_tricode}
            </span>
            <span className="text-[11px] text-neutral-400 shrink-0">
              {lastNameOnly(selected.away_probable_pitcher)} vs {lastNameOnly(selected.home_probable_pitcher)}
            </span>
            <img src={`/team-logos/mlb/${selected.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
          </div>
        ) : (
          <span className="text-sm text-neutral-500">Select a game</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-neutral-400 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Expandable game list */}
      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800/50 max-h-[280px] overflow-y-auto">
          {(() => {
            let lastDate = "";
            return games.map((g) => {
              const isSelected = Number(g.game_id) === selectedGameId;
              const showDateHeader = g.game_date !== lastDate;
              lastDate = g.game_date;
              return (
                <React.Fragment key={g.game_id}>
                  {showDateHeader && (
                    <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800/50">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{getDateLabel(g.game_date)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { onSelect(Number(g.game_id)); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                      isSelected
                        ? "bg-brand/5 dark:bg-brand/10"
                        : "active:bg-neutral-50 dark:active:bg-neutral-800/50"
                    )}
                  >
                    <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" loading="lazy" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {g.away_team_tricode} @ {g.home_team_tricode}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {lastNameOnly(g.away_probable_pitcher)} vs {lastNameOnly(g.home_probable_pitcher)}
                      </div>
                    </div>
                    <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" loading="lazy" />
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-neutral-400 tabular-nums">{g.game_status}</span>
                      {g.park_factor != null && (
                        <span className={cn("font-semibold tabular-nums", parkFactorColor(g.park_factor))}>
                          PF {g.park_factor}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                    )}
                  </button>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// ── Pitcher Profile Card ────────────────────────────────────────────────────

// ── Pitcher Odds Section ─────────────────────────────────────────────────────

const PITCHER_ODDS_MARKETS = [
  { key: "player_strikeouts", label: "Strikeouts", shortLabel: "K" },
  { key: "player_hits_allowed", label: "Hits Allowed", shortLabel: "HA" },
  { key: "player_earned_runs", label: "Earned Runs", shortLabel: "ER" },
  { key: "player_outs", label: "Outs", shortLabel: "Outs" },
];

const PITCHER_LINE_OPTIONS: Record<string, number[]> = {
  player_strikeouts: [3.5, 4.5, 5.5, 6.5, 7.5],
  player_hits_allowed: [4.5, 5.5, 6.5],
  player_earned_runs: [1.5, 2.5, 3.5],
  player_outs: [15.5, 16.5, 17.5],
};

function PitcherOddsSection({ gameId, pitcherName, hasSharpAccess }: { gameId: number | null; pitcherName: string; hasSharpAccess?: boolean }) {
  const applyState = useStateLink();
  const [market, setMarket] = useState("player_strikeouts");
  const [line, setLine] = useState(4.5);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const lines = PITCHER_LINE_OPTIONS[market] || [4.5];

  // Fetch both sides
  const { odds: overOdds, isFetching: overFetching } = useMlbBatterOdds(gameId, market, line, "over");
  const { odds: underOdds, isFetching: underFetching } = useMlbBatterOdds(gameId, market, line, "under");
  const overEntry = findPlayerOdds(overOdds, pitcherName);
  const underEntry = findPlayerOdds(underOdds, pitcherName);
  const isFetching = overFetching || underFetching;
  const marketLabel = PITCHER_ODDS_MARKETS.find((m) => m.key === market)?.label || market;

  // Keep last known odds visible during transitions
  const lastOverRef = React.useRef<BatterOddsEntry | null>(null);
  const lastUnderRef = React.useRef<BatterOddsEntry | null>(null);
  if (overEntry) lastOverRef.current = overEntry;
  if (underEntry) lastUnderRef.current = underEntry;
  const displayOver = overEntry ?? (isFetching ? lastOverRef.current : null);
  const displayUnder = underEntry ?? (isFetching ? lastUnderRef.current : null);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  useEffect(() => {
    if (overEntry || underEntry) setHasEverLoaded(true);
  }, [overEntry, underEntry]);

  const handleMarketChange = (newMarket: string) => {
    setMarket(newMarket);
    const newLines = PITCHER_LINE_OPTIONS[newMarket] || [4.5];
    setLine(newLines[0]);
  };

  function OddsSideCard({ entry, side, label }: { entry: BatterOddsEntry | null; side: "over" | "under"; label: string }) {
    if (!entry) return (
      <div className="flex-1 rounded-lg bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200/40 dark:border-neutral-700/20 p-3 text-center">
        <p className="text-[10px] text-neutral-400 font-medium">{label}</p>
        <p className="text-[10px] text-neutral-400 mt-1">—</p>
      </div>
    );
    const logo = getBookLogo(entry.best_book);
    const link = getPreferredLink(entry.best_link, entry.best_mobile_link);
    return (
      <div className="flex-1 rounded-lg border border-neutral-200/40 dark:border-neutral-700/25 bg-neutral-50 dark:bg-neutral-800/40 p-3 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</span>
          {hasSharpAccess && entry.ev_pct != null && entry.ev_pct > 0 && (
            <span className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded-full",
              entry.ev_pct >= 5 ? "bg-[#22C55E] text-white" : entry.ev_pct >= 2 ? "bg-[#22C55E]/80 text-white" : "bg-[#EAB308] text-white"
            )}>
              +{entry.ev_pct.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          {logo && <img src={logo} alt="" className="h-5 w-5 rounded object-contain" />}
          <span className="font-mono text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
            {formatOddsPrice(entry.best_price)}
          </span>
        </div>
        <p className="text-[9px] text-neutral-400 truncate mb-2">{getSportsbookById(normalizeSportsbookId(entry.best_book))?.name || entry.best_book}</p>
        {link && (
          <a href={applyState(link) || link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-full py-1.5 rounded-md text-[10px] font-semibold transition-colors active:scale-[0.98] bg-neutral-200/60 dark:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600/50">
            Bet {label}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prop Odds</h4>
        {isFetching && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />}
      </div>

      {/* Market pills */}
      <div className="flex items-center gap-1 mb-2">
        {PITCHER_ODDS_MARKETS.map((m) => (
          <button key={m.key} onClick={() => handleMarketChange(m.key)}
            className={cn("px-2 py-1 text-[10px] font-medium rounded-md transition-all active:scale-95",
              market === m.key ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/40"
            )}>{m.shortLabel}</button>
        ))}
      </div>

      {/* Line pills */}
      <div className="flex items-center gap-1 mb-3">
        {lines.map((ln) => (
          <button key={ln} onClick={() => { setLine(ln); }}
            className={cn("px-2 py-0.5 text-[10px] font-mono font-medium rounded transition-all",
              line === ln ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20" : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            )}>{ln}</button>
        ))}
      </div>

      {/* Over / Under side by side — smooth fade on transitions */}
      {!hasEverLoaded && isFetching ? (
        <div className="flex gap-2 mb-2 animate-pulse">
          <div className="flex-1 rounded-lg border border-neutral-200/30 dark:border-neutral-700/15 p-3">
            <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-700 rounded" />
              <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700 rounded" />
            </div>
            <div className="h-2 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
          <div className="flex-1 rounded-lg border border-neutral-200/30 dark:border-neutral-700/15 p-3">
            <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-700 rounded" />
              <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700 rounded" />
            </div>
            <div className="h-2 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
        </div>
      ) : (
        <div className={cn("transition-opacity duration-200", isFetching && "opacity-40")}>
          <div className="flex gap-2 mb-2">
            <OddsSideCard entry={displayOver} side="over" label={`Over ${line}`} />
            <OddsSideCard entry={displayUnder} side="under" label={`Under ${line}`} />
          </div>
        </div>
      )}

      {/* Fair value */}
      {hasSharpAccess && (displayOver ?? overEntry)?.fair_american && (
        <p className={cn("text-[10px] text-neutral-400 text-center mb-2 transition-opacity duration-200", isFetching && "opacity-40")}>
          Fair: <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{(displayOver ?? overEntry)!.fair_american}</span>
          {(displayOver ?? overEntry)!.sharp_book && <span className="text-neutral-400 ml-1">via {(displayOver ?? overEntry)!.sharp_book}</span>}
        </p>
      )}

      {/* Show all books — stays open across market/line changes */}
      {hasEverLoaded && (
        <>
          <button onClick={() => setShowAllBooks(!showAllBooks)}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors py-1">
            {showAllBooks ? "Hide books" : `Compare ${Math.max(displayOver?.all_books.length ?? 0, displayUnder?.all_books.length ?? 0)} books`}
            <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showAllBooks && "rotate-180")} />
          </button>

          {showAllBooks && (() => {
            const allBookIds = new Set<string>();
            (displayOver ?? overEntry)?.all_books.forEach((b) => allBookIds.add(b.book));
            (displayUnder ?? underEntry)?.all_books.forEach((b) => allBookIds.add(b.book));
            const overMap = new Map((displayOver ?? overEntry)?.all_books.map((b) => [b.book, b]) ?? []);
            const underMap = new Map((displayUnder ?? underEntry)?.all_books.map((b) => [b.book, b]) ?? []);
            const sorted = Array.from(allBookIds).sort((a, b) => (overMap.get(b)?.price ?? -9999) - (overMap.get(a)?.price ?? -9999));

            return (
              <div className={cn("mt-2 space-y-0 transition-opacity duration-200", isFetching && "opacity-40")}>
                {/* Header row */}
                <div className="flex items-center justify-between px-2 py-1.5 text-[9px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
                  <span className="w-16">Over {line}</span>
                  <span>Book</span>
                  <span className="w-16 text-right">Under {line}</span>
                </div>
                {sorted.map((bookId) => {
                  const logo = getBookLogo(bookId);
                  const over = overMap.get(bookId);
                  const under = underMap.get(bookId);
                  const overLink = over ? getPreferredLink(over.link, over.mobile_link) : null;
                  const underLink = under ? getPreferredLink(under.link, under.mobile_link) : null;
                  const isBestOver = over && (displayOver ?? overEntry) && over.price === (displayOver ?? overEntry)!.best_price;
                  const isBestUnder = under && (displayUnder ?? underEntry) && under.price === (displayUnder ?? underEntry)!.best_price;

                  return (
                    <div key={bookId} className="flex items-center justify-between py-1.5 border-t border-neutral-100/50 dark:border-neutral-800/20">
                      {/* Over price — left */}
                      <div className="w-16">
                        {over ? (
                          <a
                            href={overLink ? (applyState(overLink) || overLink) : "#"}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); if (!overLink) e.preventDefault(); }}
                            className={cn(
                              "inline-flex items-center justify-center w-full py-1 rounded-md font-mono text-xs font-bold tabular-nums transition-colors",
                              isBestOver
                                ? "bg-neutral-200/60 dark:bg-neutral-600/40 text-neutral-900 dark:text-white"
                                : overLink ? "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/30" : "text-neutral-500"
                            )}
                          >
                            {formatOddsPrice(over.price)}
                          </a>
                        ) : <span className="text-center block text-neutral-400 text-xs">—</span>}
                      </div>

                      {/* Book logo — center */}
                      <div className="flex items-center justify-center">
                        {logo ? (
                          <img src={logo} alt="" className="h-5 w-5 rounded object-contain" />
                        ) : (
                          <span className="text-[9px] text-neutral-500 font-medium">{bookId.slice(0, 3).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Under price — right */}
                      <div className="w-16 text-right">
                        {under ? (
                          <a
                            href={underLink ? (applyState(underLink) || underLink) : "#"}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); if (!underLink) e.preventDefault(); }}
                            className={cn(
                              "inline-flex items-center justify-center w-full py-1 rounded-md font-mono text-xs font-bold tabular-nums transition-colors",
                              isBestUnder
                                ? "bg-neutral-200/60 dark:bg-neutral-600/40 text-neutral-900 dark:text-white"
                                : underLink ? "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/30" : "text-neutral-500"
                            )}
                          >
                            {formatOddsPrice(under.price)}
                          </a>
                        ) : <span className="text-center block text-neutral-400 text-xs">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function PitcherProfileCard({ pitcher, lineupLHBCount, lineupRHBCount, vulnerabilityTags, gameId, hasSharpAccess }: { pitcher: PitcherProfile; lineupLHBCount?: number; lineupRHBCount?: number; vulnerabilityTags?: { label: string }[]; gameId?: number | null; hasSharpAccess?: boolean }) {
  const [arsenalSplitView, setArsenalSplitView] = useState<"all" | "lhb" | "rhb">("all");
  const maxUsage = Math.max(...pitcher.arsenal.map((a) => a.usage_pct), 1);

  const vsLHB = pitcher.pitcher_splits?.vs_lhb;
  const vsRHB = pitcher.pitcher_splits?.vs_rhb;
  const hasSplits = vsLHB != null || vsRHB != null;

  // Auto-generate split insight
  const splitInsight = useMemo(() => {
    if (!vsLHB || !vsRHB) return null;
    const lSlg = vsLHB.slg ?? 0;
    const rSlg = vsRHB.slg ?? 0;
    const lHr = vsLHB.hr;
    const rHr = vsRHB.hr;
    const diff = Math.abs(lSlg - rSlg);
    if (diff < 0.060) return null; // not a meaningful split
    const weak = lSlg > rSlg ? "LHB" : "RHB";
    const weakSlg = lSlg > rSlg ? lSlg : rSlg;
    const strongSlg = lSlg > rSlg ? rSlg : lSlg;
    const weakHr = lSlg > rSlg ? lHr : rHr;
    const strongHr = lSlg > rSlg ? rHr : lHr;
    const count = weak === "LHB" ? (lineupLHBCount ?? 0) : (lineupRHBCount ?? 0);
    let text = `${pitcher.name} allows .${Math.round(weakSlg * 1000)} SLG vs ${weak} (vs .${Math.round(strongSlg * 1000)} vs ${weak === "LHB" ? "RHB" : "LHB"})`;
    if (weakHr > strongHr) text += ` with ${weakHr} HR vs ${weak} (vs ${strongHr})`;
    if (count > 0) text += `. This lineup has ${count} ${weak}.`;
    return text;
  }, [vsLHB, vsRHB, pitcher.name, lineupLHBCount, lineupRHBCount]);

  // Arsenal data based on split view
  const arsenalData = useMemo(() => {
    if (arsenalSplitView === "all" || !pitcher.arsenal_splits) return pitcher.arsenal;
    const splits = arsenalSplitView === "lhb" ? pitcher.arsenal_splits.vs_lhb : pitcher.arsenal_splits.vs_rhb;
    if (!splits || !splits.length) return pitcher.arsenal;
    console.log(`[arsenal] view=${arsenalSplitView}, splits[0]=`, JSON.stringify(splits[0]));
    // Map splits to PitchArsenalRow-like objects using the overall row as base
    return pitcher.arsenal.map((a) => {
      const split = splits.find((s: any) => s.pitch_type === a.pitch_type);
      if (!split) return { ...a, usage_pct: 0, baa: null, slg: null, total_batted_balls: 0 };
      return {
        ...a,
        usage_pct: split.usage_pct,
        baa: split.baa,
        slg: split.slg,
        total_batted_balls: split.bbs,
        woba: split.woba,
        whiff_pct: split.whiff_pct ?? a.whiff_pct,
        k_pct: (split as any).k_pct ?? a.k_pct,
        bb_pct: (split as any).bb_pct ?? a.bb_pct,
      };
    });
  }, [arsenalSplitView, pitcher.arsenal, pitcher.arsenal_splits]);

  const arsenalMaxUsage = Math.max(...arsenalData.map((a) => a.usage_pct), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img
          src={getMlbHeadshotUrl(pitcher.player_id, "small")}
          alt={pitcher.name}
          className="w-16 h-16 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
        />
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{pitcher.name}</h3>
          <p className="text-sm text-neutral-500">
            {pitcher.hand === "R" ? "RHP" : pitcher.hand === "L" ? "LHP" : "P"}
            {pitcher.team_name ? ` · ${pitcher.team_name}` : ""}
            {pitcher.wins != null && pitcher.losses != null && (
              <span className="ml-1">· {pitcher.wins}-{pitcher.losses}</span>
            )}
            {pitcher.innings_pitched != null && (
              <span className="ml-1">· {pitcher.innings_pitched} IP</span>
            )}
            {pitcher.innings_pitched != null && pitcher.games_started != null && pitcher.games_started > 0 && (
              <span className="ml-1">· {(pitcher.innings_pitched / pitcher.games_started).toFixed(1)} IP/G</span>
            )}
          </p>
          {pitcher.hr_per_9 != null && pitcher.innings_pitched != null && (
            <p className={cn("text-xs font-semibold mt-0.5", pitcher.hr_per_9 >= 1.3 ? "text-emerald-600 dark:text-emerald-400" : pitcher.hr_per_9 <= 0.7 ? "text-red-500 dark:text-red-400" : "text-neutral-500")}>
              {Math.round(pitcher.hr_per_9 * pitcher.innings_pitched / 9)} HR allowed
            </p>
          )}
        </div>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-x-2 gap-y-2.5 px-3 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
        {[
          { label: "ERA", value: fmtStat(pitcher.era), color: eraColor(pitcher.era) },
          { label: "HR/9", value: fmtStat(pitcher.hr_per_9), color: hrPer9Color(pitcher.hr_per_9) },
          { label: "HR/FB%", value: pitcher.hr_fb_pct != null ? `${pitcher.hr_fb_pct}%` : "-", color: hrFbColor(pitcher.hr_fb_pct) },
          { label: "WHIP", value: fmtStat(pitcher.whip), color: whipColor(pitcher.whip) },
          { label: "K/9", value: fmtStat(pitcher.k_per_9, 1), color: kPer9Color(pitcher.k_per_9) },
          { label: "BB/9", value: fmtStat(pitcher.bb_per_9, 1), color: bbPer9Color(pitcher.bb_per_9) },
          { label: "FIP", value: fmtStat(pitcher.fip), color: fipColor(pitcher.fip) },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-medium">{s.label}</p>
            <p className={cn("text-sm font-bold tabular-nums", s.color || "text-neutral-900 dark:text-white")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pitcher Splits Table */}
      {hasSplits && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pitcher Splits</h4>
            <span className="text-[9px] text-neutral-400">Full season</span>
          </div>
          <div className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/20 overflow-hidden">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="bg-neutral-100/50 dark:bg-neutral-800/50 border-b border-neutral-200/50 dark:border-neutral-700/20">
                  <th className="px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Split</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">AVG</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">SLG</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">ISO</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">HR</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">K%</th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">BB%</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: "vs LHB", data: vsLHB, isWeak: vsRHB && vsLHB && (vsLHB.slg ?? 0) > (vsRHB.slg ?? 0) + 0.040 },
                  { label: "vs RHB", data: vsRHB, isWeak: vsLHB && vsRHB && (vsRHB.slg ?? 0) > (vsLHB.slg ?? 0) + 0.040 },
                ] as const).map((row) => row.data && (
                  <tr key={row.label} className={cn(
                    "border-b border-neutral-100 dark:border-neutral-800/50",
                    row.isWeak && "bg-red-500/5 dark:bg-red-500/10"
                  )}>
                    <td className={cn("px-2.5 py-1.5 font-semibold", row.isWeak ? "text-red-600 dark:text-red-400" : "text-neutral-700 dark:text-neutral-300")}>{row.label}</td>
                    <td className={cn("px-2.5 py-1.5 text-center font-medium", baaColor(row.data.avg))}>{fmtAvg(row.data.avg)}</td>
                    <td className={cn("px-2.5 py-1.5 text-center font-semibold", slgColor(row.data.slg))}>{fmtAvg(row.data.slg)}</td>
                    <td className={cn("px-2.5 py-1.5 text-center font-medium", isoColor(row.data.iso))}>{fmtAvg(row.data.iso)}</td>
                    <td className="px-2.5 py-1.5 text-center font-semibold text-neutral-900 dark:text-white">{row.data.hr}</td>
                    <td className={cn("px-2.5 py-1.5 text-center font-medium", kPctColor(row.data.k_pct ?? null))}>
                      {row.data.k_pct != null ? `${row.data.k_pct.toFixed(1)}%` : "-"}
                    </td>
                    <td className={cn("px-2.5 py-1.5 text-center font-medium", bbPctColor(row.data.bb_pct ?? null))}>
                      {row.data.bb_pct != null ? `${row.data.bb_pct.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {splitInsight && (
            <p className="mt-1.5 text-[11px] text-neutral-500 bg-brand/5 dark:bg-brand/10 rounded px-2.5 py-1.5 border border-brand/15">
              {splitInsight}
            </p>
          )}
        </div>
      )}

      {/* Pitch Arsenal */}
      {pitcher.arsenal.length > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pitch Arsenal</h4>
            {pitcher.arsenal_splits && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                {([
                  { value: "all" as const, label: "All" },
                  { value: "lhb" as const, label: "vs LHB" },
                  { value: "rhb" as const, label: "vs RHB" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setArsenalSplitView(opt.value)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                      arsenalSplitView === opt.value
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Desktop: bar-based layout */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-3 mb-1 text-[10px] text-neutral-400 font-medium uppercase tracking-wide">
              <div className="w-20 shrink-0">Pitch</div>
              <div className="flex-1 min-w-0 text-center">Usage</div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="w-14 text-right">Velo</span>
                <span className="w-8 text-right">BAA</span>
                <span className="w-8 text-right">SLG</span>
                <span className="w-10 text-right">Whiff</span>
                <span className="w-8 text-right">K%</span>
                <span className="w-8 text-right">BB%</span>
              </div>
            </div>
            <div className="space-y-2">
              {arsenalData.map((pitch) => (
                <ArsenalRow key={pitch.pitch_type} pitch={pitch} maxUsage={arsenalMaxUsage} />
              ))}
            </div>
          </div>
          {/* Mobile: compact table layout */}
          <div className="sm:hidden">
            <div className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/20 overflow-hidden">
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className="bg-neutral-100/50 dark:bg-neutral-800/50 border-b border-neutral-200/50 dark:border-neutral-700/20">
                    <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Pitch</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">%</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Velo</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">BAA</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">SLG</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Whiff</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">K%</th>
                    <th className="px-1.5 py-1.5 text-center text-[10px] uppercase tracking-wide font-semibold text-neutral-400">BB%</th>
                  </tr>
                </thead>
                <tbody>
                  {arsenalData.map((pitch) => (
                    <tr key={pitch.pitch_type} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
                      <td className="px-2 py-1.5 font-semibold text-neutral-900 dark:text-white">{pitch.pitch_name}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", pitch.usage_pct >= 25 ? "text-brand" : "text-neutral-500")}>{pitch.usage_pct}%</td>
                      <td className="px-1.5 py-1.5 text-center text-neutral-500">{pitch.avg_speed ?? "-"}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", baaColor(pitch.baa))}>{fmtAvg(pitch.baa)}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", slgColor(pitch.slg))}>{fmtAvg(pitch.slg)}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", statCell(pitch.whiff_pct, { elite: 15, good: 20, poor: 28, bad: 35 }, false))}>{pitch.whiff_pct != null ? `${pitch.whiff_pct}%` : "-"}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", statCell((pitch as any).k_pct, { elite: 15, good: 20, poor: 28, bad: 35 }, false))}>{(pitch as any).k_pct != null ? `${Math.round((pitch as any).k_pct)}%` : "-"}</td>
                      <td className={cn("px-1.5 py-1.5 text-center font-medium", statCell((pitch as any).bb_pct, { elite: 10, good: 7, poor: 4, bad: 2 }))}>{(pitch as any).bb_pct != null ? `${Math.round((pitch as any).bb_pct)}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Vulnerability tags */}
          {vulnerabilityTags && vulnerabilityTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              {vulnerabilityTags.map((tag) => (
                <span
                  key={tag.label}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scouting Summary */}
      {pitcher.scouting_summary && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 px-3 py-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">Scouting Report</h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{pitcher.scouting_summary}</p>
        </div>
      )}

      {/* Pitcher Prop Odds */}
      {gameId && (
        <PitcherOddsSection gameId={gameId} pitcherName={pitcher.name} hasSharpAccess={hasSharpAccess} />
      )}

      {/* Batted Ball Profile — full width */}
      {pitcher.zone_data && (pitcher.zone_data.total_fb + pitcher.zone_data.total_gb + pitcher.zone_data.total_ld + pitcher.zone_data.total_pu) > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Batted Ball Profile</h4>
          <BattedBallChart zone={pitcher.zone_data} />
        </div>
      )}

      {/* Pitch Location */}
      {pitcher.pitch_zone_grid && pitcher.pitch_zone_grid.length > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Pitch Location</h4>
          <div className="max-w-[200px] mx-auto">
            <PitchZoneGrid zones={pitcher.pitch_zone_grid} />
          </div>
        </div>
      )}

      {/* Recent HRs Allowed — full width */}
      {(pitcher.recent_hrs_allowed ?? []).length > 0 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Recent HRs Allowed ({pitcher.recent_hrs_allowed.length})
          </h4>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
            {pitcher.recent_hrs_allowed.map((hr, i) => (
              <div key={i} className="flex items-center gap-3 text-[11px] tabular-nums py-1.5 first:pt-0 last:pb-0">
                <span className="text-neutral-400 shrink-0 w-12">{hr.date?.slice(5)}</span>
                {(hr as any).batter_name ? (
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate min-w-0 flex-1">
                    {(hr as any).batter_name}
                    {hr.batter_hand && <span className="text-neutral-400 font-normal ml-1">({hr.batter_hand})</span>}
                  </span>
                ) : (
                  <span className="text-neutral-500 shrink-0 flex-1">
                    {hr.batter_hand ? `vs ${hr.batter_hand}HB` : "—"}
                  </span>
                )}
                {hr.pitch_type && <span className="text-neutral-500 shrink-0">{hr.pitch_type}</span>}
                {hr.exit_velocity != null && <span className="text-neutral-600 dark:text-neutral-400 font-medium shrink-0">{hr.exit_velocity} mph</span>}
                {hr.distance != null && <span className="text-neutral-400 shrink-0">{hr.distance} ft</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Batted Ball Chart ────────────────────────────────────────────────────────

function BattedBallChart({ zone }: { zone: NonNullable<PitcherProfile["zone_data"]> }) {
  const total = zone.total_fb + zone.total_gb + zone.total_ld + zone.total_pu;
  if (total === 0) return null;
  const bars = [
    { label: "GB", count: zone.total_gb, color: "bg-blue-500" },
    { label: "FB", count: zone.total_fb, color: "bg-orange-500" },
    { label: "LD", count: zone.total_ld, color: "bg-emerald-500" },
    { label: "PU", count: zone.total_pu, color: "bg-neutral-400" },
  ];
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      {/* Trajectory bars */}
      <div className="space-y-1.5">
        {bars.map((b) => {
          const pct = Math.round((b.count / total) * 100);
          const barW = Math.max((b.count / maxCount) * 100, 2);
          return (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-neutral-500 w-6">{b.label}</span>
              <div className="flex-1 h-3 rounded bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                <div className={cn("h-full rounded", b.color)} style={{ width: `${barW}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-neutral-500 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
      {/* Key stats */}
      <div className="flex items-center gap-4 text-[10px] tabular-nums pt-1 border-t border-neutral-100 dark:border-neutral-800">
        {zone.hard_hit_pct != null && (
          <span className="text-neutral-500">
            Hard% <span className={cn("font-semibold", zone.hard_hit_pct >= 35 ? "text-emerald-600 dark:text-emerald-400" : zone.hard_hit_pct <= 28 ? "text-red-500" : "text-neutral-700 dark:text-neutral-300")}>{zone.hard_hit_pct}%</span>
          </span>
        )}
        {zone.avg_ev_against != null && (
          <span className="text-neutral-500">
            Avg EV <span className={cn("font-semibold", zone.avg_ev_against >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300")}>{zone.avg_ev_against}</span>
          </span>
        )}
        {zone.hr_pct_fb != null && (
          <span className="text-neutral-500">
            HR/FB <span className={cn("font-semibold", hrFbColor(zone.hr_pct_fb))}>{zone.hr_pct_fb}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Pitch Zone Grid (3x3 heatmap) ──────────────────────────────────────────

function PitchZoneGrid({ zones }: { zones: NonNullable<PitcherProfile["pitch_zone_grid"]> }) {
  // Standard strike zone layout (catcher's perspective):
  // Zone 1 = top-left, Zone 2 = top-center, Zone 3 = top-right
  // Zone 4 = mid-left, Zone 5 = mid-center, Zone 6 = mid-right
  // Zone 7 = bot-left, Zone 8 = bot-center, Zone 9 = bot-right
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));
  const gridOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function tempBg(temp: string | null): string {
    switch (temp) {
      case "hot": return "bg-red-500/70 dark:bg-red-500/60";
      case "warm": return "bg-orange-400/50 dark:bg-orange-400/40";
      case "lukewarm": return "bg-yellow-400/30 dark:bg-yellow-400/20";
      case "cold": return "bg-blue-400/30 dark:bg-blue-400/20";
      default: return "bg-neutral-100 dark:bg-neutral-800";
    }
  }

  function tempText(temp: string | null): string {
    switch (temp) {
      case "hot": return "text-white";
      case "warm": return "text-neutral-900 dark:text-white";
      default: return "text-neutral-600 dark:text-neutral-400";
    }
  }

  return (
    <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
      {gridOrder.map((zn) => {
        const z = zoneMap.get(zn);
        const pct = z?.zone_pct;
        return (
          <div
            key={zn}
            className={cn(
              "w-14 h-12 flex flex-col items-center justify-center",
              tempBg(z?.temp ?? null)
            )}
          >
            <span className={cn("text-xs font-bold tabular-nums", tempText(z?.temp ?? null))}>
              {pct != null ? `${Math.round(pct)}%` : "-"}
            </span>
            {z?.whiffs != null && z.whiffs > 0 && (
              <span className="text-[8px] text-neutral-500 dark:text-neutral-400 font-medium">
                {z.whiffs}W
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Zone Grids (batter hot zones, pitcher tendencies, matchup overlay) ─────

const ZONE_GRID_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Standard 3x3 zone layout (catcher's perspective):
// 1=up-away  2=up-mid   3=up-in
// 4=mid-away 5=middle   6=mid-in
// 7=low-away 8=low-mid  9=low-in

function zoneTempBg(temp: string | null): string {
  switch (temp) {
    case "hot": return "bg-red-500/60 dark:bg-red-500/50";
    case "warm": return "bg-orange-400/40 dark:bg-orange-400/30";
    case "lukewarm": return "bg-yellow-300/25 dark:bg-yellow-300/15";
    case "cold": return "bg-blue-400/25 dark:bg-blue-400/20";
    default: return "bg-neutral-100 dark:bg-neutral-800";
  }
}

function zoneTempText(temp: string | null): string {
  switch (temp) {
    case "hot": return "text-white dark:text-white";
    case "warm": return "text-neutral-900 dark:text-white";
    default: return "text-neutral-600 dark:text-neutral-400";
  }
}

function computeHeatBg(value: number | null, allValues: (number | null)[], higherIsHotter = true): string {
  if (value == null) return "bg-neutral-100 dark:bg-neutral-800";
  const nums = allValues.filter((v): v is number => v != null);
  if (nums.length < 2) return "bg-neutral-100 dark:bg-neutral-800";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return "bg-yellow-300/25 dark:bg-yellow-300/15";
  let pct = (value - min) / (max - min); // 0 = lowest, 1 = highest
  if (!higherIsHotter) pct = 1 - pct;
  if (pct >= 0.75) return "bg-red-500/60 dark:bg-red-500/50";
  if (pct >= 0.5) return "bg-orange-400/40 dark:bg-orange-400/30";
  if (pct >= 0.25) return "bg-yellow-300/25 dark:bg-yellow-300/15";
  return "bg-blue-400/25 dark:bg-blue-400/20";
}

function computeHeatText(value: number | null, allValues: (number | null)[], higherIsHotter = true): string {
  if (value == null) return "text-neutral-600 dark:text-neutral-400";
  const nums = allValues.filter((v): v is number => v != null);
  if (nums.length < 2) return "text-neutral-600 dark:text-neutral-400";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max === min) return "text-neutral-900 dark:text-white";
  let pct = (value - min) / (max - min);
  if (!higherIsHotter) pct = 1 - pct;
  if (pct >= 0.75) return "text-white dark:text-white";
  if (pct >= 0.5) return "text-neutral-900 dark:text-white";
  return "text-neutral-600 dark:text-neutral-400";
}

function BatterHotZoneGrid({ zones, label }: { zones: BatterZoneCell[]; label: string }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));
  const allContactPcts = zones.map((z) => z.contact_pct);
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">{label}</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const val = z?.contact_pct ?? null;
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", computeHeatBg(val, allContactPcts))}>
              {val != null ? (
                <span className={cn("text-[10px] font-bold tabular-nums", computeHeatText(val, allContactPcts))}>
                  {Math.round(val)}%
                </span>
              ) : (
                <span className="text-[10px] text-neutral-300 dark:text-neutral-600">—</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Contact % by zone</p>
    </div>
  );
}

function PitcherTendencyGrid({ zones, label }: { zones: PitcherZoneCell[]; label: string }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));
  const allZonePcts = zones.map((z) => z.zone_pct);
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">{label}</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const val = z?.zone_pct ?? null;
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", computeHeatBg(val, allZonePcts))}>
              {val != null ? (
                <span className={cn("text-[10px] font-bold tabular-nums", computeHeatText(val, allZonePcts))}>
                  {Math.round(val)}%
                </span>
              ) : (
                <span className="text-[10px] text-neutral-300 dark:text-neutral-600">—</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Pitch location %</p>
    </div>
  );
}

function MatchupOverlayGrid({ zones }: { zones: OverlayZoneCell[] }) {
  const zoneMap = new Map(zones.map((z) => [z.zone, z]));

  function overlayBg(z: OverlayZoneCell | undefined): string {
    if (!z) return "bg-neutral-100 dark:bg-neutral-800";
    const adv = z.advantage;
    if (adv === "batter_advantage") return "bg-emerald-500/40 dark:bg-emerald-500/30";
    if (adv === "pitcher_advantage") return "bg-red-500/35 dark:bg-red-500/25";
    if (adv === "neutral") return "bg-yellow-400/20 dark:bg-yellow-400/15";
    // Fallback to temp if advantage not set
    return zoneTempBg(z.temp);
  }

  function overlayLabel(z: OverlayZoneCell | undefined): { text: string; color: string } {
    if (!z) return { text: "—", color: "text-neutral-400" };
    const adv = z.advantage;
    if (adv === "batter_advantage") return { text: "HIT", color: "text-emerald-800 dark:text-emerald-200" };
    if (adv === "pitcher_advantage") return { text: "MISS", color: "text-red-700 dark:text-red-200" };
    if (adv === "neutral") return { text: "EVEN", color: "text-yellow-700 dark:text-yellow-300" };
    if (adv === "dead_zone") return { text: "DEAD", color: "text-neutral-400" };
    // If no advantage label, use temp
    if (z.temp === "hot") return { text: "HOT", color: "text-white" };
    if (z.temp === "cold") return { text: "COLD", color: "text-blue-600 dark:text-blue-300" };
    return { text: "—", color: "text-neutral-400" };
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-500 mb-1">Matchup Overlay</p>
      <div className="inline-grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-700">
        {ZONE_GRID_ORDER.map((zn) => {
          const z = zoneMap.get(zn);
          const lbl = overlayLabel(z);
          return (
            <div key={zn} className={cn("w-14 h-11 flex flex-col items-center justify-center", overlayBg(z))}>
              <span className={cn("text-[9px] font-bold", lbl.color)}>{lbl.text}</span>
              {z?.pitcher_zone_pct != null && (
                <span className="text-[8px] tabular-nums text-neutral-400">{Math.round(z.pitcher_zone_pct)}%</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-neutral-400 mt-0.5">Who wins each zone</p>
    </div>
  );
}

function gbPctColor(val: number | null): string {
  if (val == null) return "";
  // High GB% is good for pitcher (bad for batters) — red from batter perspective
  if (val >= 55) return "text-red-500 dark:text-red-400";
  if (val <= 35) return "text-emerald-600 dark:text-emerald-400";
  return "";
}

function whiffColor(val: number | null): string {
  if (val == null) return "";
  // High whiff% is good for pitcher — red from batter perspective
  if (val >= 30) return "text-red-500 dark:text-red-400";
  if (val >= 25) return "text-yellow-600 dark:text-yellow-400";
  if (val < 15) return "text-emerald-600 dark:text-emerald-400";
  return "";
}

function ArsenalRow({ pitch, maxUsage }: { pitch: PitchArsenalRow; maxUsage: number }) {
  const barWidth = Math.max((pitch.usage_pct / Math.max(maxUsage, 1)) * 100, 2);
  const isHighUsage = pitch.usage_pct >= 25;
  const trend = pitch.usage_trend;
  const hasL30 = pitch.l30_usage_pct != null;

  return (
    <div className="flex items-center gap-3">
      {/* Pitch name + trend */}
      <div className="w-20 shrink-0">
        <span className="text-xs font-semibold text-neutral-900 dark:text-white">{pitch.pitch_name}</span>
        {trend && trend !== "flat" && (
          <span className={cn("text-[10px] font-bold ml-0.5", trendColor(trend))}>
            {trendArrow(trend)}
          </span>
        )}
      </div>

      {/* Usage bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-4 rounded bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
            <div
              className={cn(
                "h-full rounded transition-all",
                isHighUsage ? "bg-brand/70" : "bg-neutral-300 dark:bg-neutral-600"
              )}
              style={{ width: `${barWidth}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
              {pitch.usage_pct}%
              {hasL30 && pitch.l30_usage_pct !== pitch.usage_pct && (
                <span className="text-neutral-400 ml-0.5">({pitch.l30_usage_pct}% L30)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Stats: Velo + BAA + SLG + Whiff% + K% + BB% */}
      <div className="flex items-center gap-3 shrink-0 text-[11px] tabular-nums">
        <span className="text-neutral-500 w-14 text-right">
          {pitch.avg_speed != null ? `${pitch.avg_speed}` : "-"}
        </span>
        <span className={cn("w-8 text-right font-medium", statText(pitch.baa, { elite: 0.300, good: 0.260, poor: 0.210, bad: 0.180 }) || "text-neutral-500")}>
          {fmtAvg(pitch.baa)}
        </span>
        <span className={cn("w-8 text-right font-medium", slgTextColor(pitch.slg) || "text-neutral-500")}>
          {fmtAvg(pitch.slg)}
        </span>
        <span className={cn("w-10 text-right font-medium", statText(pitch.whiff_pct, { elite: 15, good: 20, poor: 28, bad: 35 }, false) || "text-neutral-500")}>
          {pitch.whiff_pct != null ? `${pitch.whiff_pct}%` : "-"}
        </span>
        <span className={cn("w-8 text-right font-medium", statText(pitch.k_pct, { elite: 15, good: 20, poor: 28, bad: 35 }, false) || "text-neutral-500")}>
          {pitch.k_pct != null ? `${Math.round(pitch.k_pct)}%` : "-"}
        </span>
        <span className={cn("w-8 text-right font-medium", statText(pitch.bb_pct, { elite: 10, good: 7, poor: 4, bad: 2 }) || "text-neutral-500")}>
          {pitch.bb_pct != null ? `${Math.round(pitch.bb_pct)}%` : "-"}
        </span>
      </div>
    </div>
  );
}

// ── Lineup Grade Badge ──────────────────────────────────────────────────────

function lineupGradeStyle(grade: string | undefined | null) {
  const g = grade ?? "C";
  if (g.startsWith("A")) return { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" };
  if (g.startsWith("B")) return { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" };
  if (g.startsWith("C")) return { bg: "bg-yellow-500/15", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" };
  return { bg: "bg-red-500/15", text: "text-red-500 dark:text-red-400", border: "border-red-500/30" };
}

// ── Batter Row ──────────────────────────────────────────────────────────────

interface DisplayStats {
  avg: number | null;
  slg: number | null;
  woba: number | null;
  iso: number | null;
  hr: number;
  ev: number | null;
  brl: number | null;
  bbs: number;
  k_pct?: number | null;
  bb_pct?: number | null;
}

function BatterRow({
  batter,
  pitcher,
  expanded,
  onToggle,
  isMobile,
  viewMode = "standard",
  displayStats,
  pitchFilter,
  oddsEntry,
  hasSharpAccess,
  oddsLoading,
  gameId,
}: {
  batter: BatterMatchup;
  pitcher: PitcherProfile;
  expanded: boolean;
  onToggle: () => void;
  isMobile: boolean;
  viewMode?: "standard" | "comparison";
  displayStats?: DisplayStats;
  pitchFilter?: string | null;
  oddsEntry?: BatterOddsEntry | null;
  hasSharpAccess?: boolean;
  oddsLoading?: boolean;
  gameId?: number | null;
}) {
  // Use filtered stats if provided, otherwise use overall batter stats
  const ds = displayStats ?? {
    avg: batter.avg, slg: batter.slg, woba: batter.woba, iso: batter.iso,
    hr: batter.hr_count, ev: batter.avg_exit_velo, brl: batter.barrel_pct,
    bbs: batter.total_batted_balls,
    k_pct: batter.k_pct, bb_pct: batter.bb_pct,
  };
  const badge = gradeBadge(batter.matchup_grade, batter.hr_probability_score);
  const hasPlatoon =
    (batter.batting_hand === "L" && pitcher.hand === "R") ||
    (batter.batting_hand === "R" && pitcher.hand === "L");

  // Top 2 pitcher pitches for inline splits
  const top2Pitches = pitcher.arsenal.slice(0, 2);

  if (isMobile) {
    return (
      <div className="border-b border-neutral-100 dark:border-neutral-800/50">
        <button onClick={onToggle} className="w-full text-left px-3 py-2.5">
          <div className="flex items-center gap-2">
            <img
              src={getMlbHeadshotUrl(batter.player_id, "tiny")}
              alt={batter.player_name}
              className="w-8 h-8 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-400 w-4 tabular-nums">{batter.lineup_position ?? "-"}</span>
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{batter.player_name}</span>
                <span className={cn("text-[10px] font-medium", hasPlatoon ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-neutral-500")}>
                  {batter.batting_hand}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] tabular-nums">
                <span className="text-neutral-500">AVG <span className="font-semibold text-neutral-900 dark:text-white">{fmtAvg(ds.avg)}</span></span>
                <span className="text-neutral-500">SLG <span className={cn("font-semibold", slgTextColor(ds.slg) || "text-neutral-900 dark:text-white")}>{fmtAvg(ds.slg)}</span></span>
                <span className="text-neutral-500">wOBA <span className={cn("font-semibold", wobaTextColor(ds.woba) || "text-neutral-900 dark:text-white")}>{fmtAvg(ds.woba)}</span></span>
                <span className="text-neutral-500">HR <span className="font-semibold text-neutral-900 dark:text-white">{ds.hr}</span></span>
                <span className="text-neutral-500">EV <span className={cn("font-semibold", evTextColor(ds.ev) || "text-neutral-900 dark:text-white")}>{ds.ev != null ? ds.ev.toFixed(1) : "-"}</span></span>
                {batter.k_pct != null && <span className="text-neutral-500">K% <span className={cn("font-semibold", statText(batter.k_pct, { elite: 15, good: 20, poor: 27, bad: 32 }, false) || "text-neutral-700 dark:text-neutral-300")}>{batter.k_pct.toFixed(1)}%</span></span>}
                {batter.bb_pct != null && <span className="text-neutral-500">BB% <span className={cn("font-semibold", statText(batter.bb_pct, { elite: 12, good: 9, poor: 5, bad: 3 }) || "text-neutral-700 dark:text-neutral-300")}>{batter.bb_pct.toFixed(1)}%</span></span>}
              </div>
            </div>
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", badge.text, badge.bg)}>
              {badge.label}
            </span>
            <ChevronRight className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", expanded && "rotate-90")} />
          </div>
          {/* Inline pitch splits */}
          <div className="mt-1.5 ml-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-neutral-500">
            {top2Pitches.map((p) => {
              const split = batter.pitch_splits.find((s) => s.pitch_type === p.pitch_type);
              const splitSlg = split?.slg ?? null;
              return (
                <span key={p.pitch_type}>
                  vs {p.pitch_name}: <span className={cn("font-medium", slgTextColor(splitSlg) || "text-neutral-700 dark:text-neutral-300")}>{fmtAvg(split?.avg ?? null)}/{fmtAvg(splitSlg)}</span>
                  {splitSlg != null && splitSlg >= 0.500 && <span className="ml-0.5">🔥</span>}
                </span>
              );
            })}
            {batter.h2h && batter.h2h.pa > 0 && (
              <span>
                H2H: <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {batter.h2h.hits}-{batter.h2h.pa}
                  {batter.h2h.avg != null && <span className="ml-0.5">({fmtAvg(batter.h2h.avg)})</span>}
                </span>
              </span>
            )}
          </div>
        </button>

        {expanded && <BatterExpansion batter={batter} pitcher={pitcher} isMobile pitchFilter={pitchFilter} oddsEntry={oddsEntry} hasSharpAccess={hasSharpAccess} gameId={gameId} />}
      </div>
    );
  }

  // Desktop
  return (
    <React.Fragment>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-all duration-150 group",
          "border-b border-neutral-200/40 dark:border-neutral-800/20",
          expanded
            ? "bg-sky-50/50 dark:bg-sky-500/[0.05]"
            : "bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
        )}
      >
        <td className="pl-3 pr-1 py-2 text-xs text-neutral-400 tabular-nums w-8 text-center">
          {batter.lineup_position ?? "-"}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            <img
              src={getMlbHeadshotUrl(batter.player_id, "tiny")}
              alt={batter.player_name}
              className="w-7 h-7 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0"
            />
            <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{batter.player_name}</span>
            <span
              className={cn(
                "text-[10px] font-semibold px-1 py-0.5 rounded shrink-0",
                hasPlatoon ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-neutral-400"
              )}
            >
              {batter.batting_hand}
            </span>
          </div>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", baaColor(ds.avg))}>
          {fmtAvg(ds.avg)}
        </td>
        <td className="px-1.5 py-2 text-xs text-center tabular-nums font-semibold text-neutral-900 dark:text-white">
          {ds.hr}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-semibold", slgColor(ds.slg))}>
          {fmtAvg(ds.slg)}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", isoColor(ds.iso))}>
          {fmtAvg(ds.iso)}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", evColor(ds.ev))}>
          {ds.ev != null ? ds.ev.toFixed(1) : "-"}
          {batter.recent_avg_ev != null && batter.avg_exit_velo != null && (
            <DeltaArrow current={batter.recent_avg_ev} baseline={batter.avg_exit_velo} higherGood />
          )}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", barrelColor(ds.brl))}>
          {ds.brl != null ? `${ds.brl.toFixed(1)}%` : "-"}
          {batter.recent_barrel_pct != null && batter.barrel_pct != null && (
            <DeltaArrow current={batter.recent_barrel_pct} baseline={batter.barrel_pct} higherGood />
          )}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", wobaColor(ds.woba))}>
          {fmtAvg(ds.woba)}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", kPctColor(ds.k_pct ?? null))}>
          {ds.k_pct != null ? `${ds.k_pct.toFixed(1)}%` : "-"}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-center tabular-nums font-medium", bbPctColor(ds.bb_pct ?? null))}>
          {ds.bb_pct != null ? `${ds.bb_pct.toFixed(1)}%` : "-"}
        </td>
        {/* Odds cell with dropdown */}
        <td className="px-1.5 py-2 text-right relative">
          <OddsCell entry={oddsEntry ?? null} hasSharpAccess={hasSharpAccess ?? false} isLoading={!!oddsLoading && !oddsEntry} />
        </td>
        <td className="pr-3 pl-1 py-2">
          <ChevronRight className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", expanded && "rotate-90")} />
        </td>
      </tr>
      {/* Pitch splits row (always visible below main row) */}
      <tr className={cn(
        "border-b border-neutral-200/30 dark:border-neutral-800/15",
        expanded ? "bg-sky-50/50 dark:bg-sky-500/[0.05]" : "bg-white dark:bg-neutral-900/40"
      )}>
        <td colSpan={13} className="px-3 pb-2.5 pt-0">
          <div className="ml-9 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
            {top2Pitches.map((p) => {
              const split = batter.pitch_splits.find((s) => s.pitch_type === p.pitch_type);
              const splitSlg = split?.slg ?? null;
              return (
                <span key={p.pitch_type}>
                  vs {p.pitch_name}:{" "}
                  <span className={cn("font-medium", slgTextColor(splitSlg) || "text-neutral-700 dark:text-neutral-300")}>
                    {fmtAvg(split?.avg ?? null)}/{fmtAvg(splitSlg)}
                  </span>
                  {splitSlg != null && splitSlg >= 0.500 && <span className="ml-0.5">🔥</span>}
                </span>
              );
            })}
            {batter.h2h && batter.h2h.pa > 0 && (
              <span>
                H2H:{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {batter.h2h.hits}-{batter.h2h.pa}
                  {batter.h2h.avg != null && <span className="ml-0.5">({fmtAvg(batter.h2h.avg)})</span>}
                  {batter.h2h.hrs > 0 && <span className="ml-0.5 text-emerald-600 dark:text-emerald-400">{batter.h2h.hrs} HR</span>}
                </span>
              </span>
            )}
            {batter.recent_barrel_pct != null && batter.barrel_pct != null && (
              <span>
                L60:{" "}
                <span className={cn("font-medium", batter.recent_barrel_pct > batter.barrel_pct + 2 ? STAT_GREEN : batter.recent_barrel_pct < batter.barrel_pct - 2 ? STAT_RED : "text-neutral-500")}>
                  {batter.recent_barrel_pct > batter.barrel_pct + 2 ? "↑" : batter.recent_barrel_pct < batter.barrel_pct - 2 ? "↓" : "→"}
                </span>
                <span className="ml-0.5 font-medium text-neutral-600 dark:text-neutral-400">
                  {batter.recent_avg_ev != null ? `${batter.recent_avg_ev.toFixed(1)} EV` : ""}
                  {batter.recent_hr_count > 0 && <span className="ml-0.5">{batter.recent_hr_count} HR</span>}
                </span>
              </span>
            )}
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", badge.text, badge.bg)}>
              {badge.label}
            </span>
          </div>
        </td>
      </tr>
      {/* Expansion */}
      {expanded && (
        <tr>
          <td colSpan={13} className="px-3 pb-4 bg-neutral-50/80 dark:bg-neutral-800/15 border-b border-neutral-200/40 dark:border-neutral-700/20">
            <BatterExpansion batter={batter} pitcher={pitcher} isMobile={false} pitchFilter={pitchFilter} oddsEntry={oddsEntry} hasSharpAccess={hasSharpAccess} gameId={gameId} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// ── Mini Sparkline ──────────────────────────────────────────────────────────

function MiniSparkline({ values, height = 24, width = 80 }: { values: number[]; height?: number; width?: number }) {
  if (values.length < 2) return <span className="text-[10px] text-neutral-400">-</span>;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const trending = lastVal > firstVal;

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={trending ? "#10b981" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - ((lastVal - min) / range) * height}
        r={2.5}
        fill={trending ? "#10b981" : "#ef4444"}
      />
    </svg>
  );
}

// ── HR Score Bar ────────────────────────────────────────────────────────────

function HRScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color = score >= 60 ? "bg-emerald-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400";
  const textColor = score >= 60 ? "text-emerald-600 dark:text-emerald-400" : score >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums w-8 text-right", textColor)}>{score}</span>
    </div>
  );
}

// ── Batter Expansion ────────────────────────────────────────────────────────

function BatterExpansion({
  batter,
  pitcher,
  isMobile,
  pitchFilter,
  oddsEntry,
  hasSharpAccess,
  gameId,
}: {
  batter: BatterMatchup;
  pitcher: PitcherProfile;
  isMobile: boolean;
  pitchFilter?: string | null;
  oddsEntry?: BatterOddsEntry | null;
  hasSharpAccess?: boolean;
  gameId?: number | null;
}) {
  const h2hMeetings = batter.h2h?.last_meetings ?? [];
  const hrFactors = batter.hr_factors ?? [];
  const applyState = useStateLink();

  // Local odds market selector for expanded view
  const [localOddsMarket, setLocalOddsMarket] = useState("player_home_runs");
  const [localOddsLine, setLocalOddsLine] = useState(0.5);
  const [userChangedMarket, setUserChangedMarket] = useState(false);
  const { odds: localOdds, isFetching: localOddsFetching } = useMlbBatterOdds(gameId ?? null, localOddsMarket, localOddsLine, "over");
  const localOddsEntry = gameId ? findPlayerOdds(localOdds, batter.player_name) : null;
  // Once user changes market/line, always use local fetch
  const effectiveOdds = userChangedMarket ? localOddsEntry : (oddsEntry ?? localOddsEntry);
  // Keep last known odds visible during transitions
  const lastOddsRef = React.useRef<BatterOddsEntry | null>(null);
  if (effectiveOdds && effectiveOdds.all_books.length > 0) lastOddsRef.current = effectiveOdds;
  const displayOdds = effectiveOdds ?? (localOddsFetching ? lastOddsRef.current : null);
  // Track whether we've ever had odds so the controls persist during fetches
  const [hasEverHadOdds, setHasEverHadOdds] = useState(false);
  useEffect(() => {
    if (displayOdds && displayOdds.all_books.length > 0) setHasEverHadOdds(true);
  }, [displayOdds]);
  const oddsTransitioning = userChangedMarket && localOddsFetching;
  const sparkline = batter.recent_ev_sparkline ?? [];

  // Zone pitch type synced with parent pitch filter, with local override
  const [localZonePitch, setLocalZonePitch] = useState<string | null | undefined>(undefined);
  // undefined = follow parent, string = local override, null = explicitly "All"
  const zonePitchType = localZonePitch === undefined ? (pitchFilter ?? undefined) : (localZonePitch ?? undefined);

  // Reset local override when parent filter changes
  useEffect(() => {
    setLocalZonePitch(undefined);
  }, [pitchFilter]);

  // Fetch hot zone data lazily when expanded
  const { data: hotZone, isLoading: hotZoneLoading, isFetching: hotZoneFetching } = useMlbHotZone(
    batter.player_id,
    pitcher.player_id,
    true, // always enabled when rendered (only rendered when expanded)
    zonePitchType
  );

  return (
    <div className={cn("pt-3", isMobile ? "px-3 pb-3" : "ml-8")}>
      {/* Top section: Pitch splits + HR Score side by side */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-5")}>
        {/* Pitch Type Table — 3 cols wide */}
        <div className={cn("rounded-lg border border-neutral-200/40 dark:border-neutral-800/20 bg-white dark:bg-neutral-900/40 p-3", isMobile ? "" : "col-span-3")}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">
              vs {pitcher.name.split(" ").pop()} — Pitch Splits
            </h5>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-neutral-300 dark:text-neutral-600 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[220px] text-xs">How this batter performs against each of the pitcher&apos;s pitch types. Green rows = hittable (.450+ SLG).</TooltipContent></Tooltip></TooltipProvider>
          </div>
          <div className="space-y-1">
            {pitcher.arsenal.map((a) => {
              const split = batter.pitch_splits.find((s) => s.pitch_type === a.pitch_type);
              const isHittable = (split?.slg ?? 0) >= 0.450;
              return (
                <div key={a.pitch_type} className={cn(
                  "flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs tabular-nums transition-colors",
                  isHittable ? "bg-emerald-500/5 dark:bg-emerald-500/[0.04]" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/20"
                )}>
                  <span className="font-semibold text-neutral-900 dark:text-white w-20 truncate">{a.pitch_name}</span>
                  <span className="text-neutral-400 w-10 text-right">{a.usage_pct}%</span>
                  <div className="flex-1 flex items-center gap-4 justify-end">
                    <div className="text-right">
                      <span className="text-[9px] text-neutral-400 block">AVG</span>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{fmtAvg(split?.avg ?? null)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-neutral-400 block">SLG</span>
                      <span className={cn("font-bold", slgTextColor(split?.slg ?? null) || "text-neutral-700 dark:text-neutral-300")}>{fmtAvg(split?.slg ?? null)}</span>
                    </div>
                    <div className="text-right w-6">
                      <span className="text-[9px] text-neutral-400 block">HR</span>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{split?.hrs ?? 0}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 w-8 text-right">{split?.batted_balls ?? 0} PA</span>
                  </div>
                </div>
              );
            })}
          </div>
          {batter.overlap_score != null && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/40 px-2.5">
              <span className="text-[10px] text-neutral-400">Pitch Overlap</span>
              <span className={cn(
                "text-xs font-bold tabular-nums",
                (batter.overlap_score ?? 0) >= 60 ? "text-emerald-500" :
                (batter.overlap_score ?? 0) >= 30 ? "text-amber-500" : "text-red-400"
              )}>
                {batter.overlap_score}%
              </span>
            </div>
          )}
        </div>

        {/* HR Score + Factors — 2 cols wide */}
        <div className={cn("rounded-lg border border-neutral-200/40 dark:border-neutral-800/20 bg-white dark:bg-neutral-900/40 p-3", isMobile ? "" : "col-span-2")}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">HR Score</h5>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-neutral-300 dark:text-neutral-600 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[220px] text-xs">Composite home run probability score (0-100) based on ISO, barrel rate, pitch matchups, H2H history, platoon advantage, and pitcher HR tendency.</TooltipContent></Tooltip></TooltipProvider>
          </div>
          <HRScoreBar score={batter.hr_probability_score} />
          {hrFactors.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {hrFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={cn("mt-0.5 shrink-0", f.positive ? "text-emerald-500" : "text-red-400")}>
                    {f.positive ? "+" : "-"}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400 leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Odds section in expanded view — controls always visible once loaded */}
          {hasEverHadOdds ? (
            <div className="mt-4 pt-3 border-t border-neutral-200/40 dark:border-neutral-700/20">
              {/* Market + Line selectors — always stable, never unmount */}
              <div className="mb-3">
                <div className={cn("mb-2", isMobile ? "space-y-1" : "flex items-center justify-between")}>
                  <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400">Prop Odds</h5>
                  {hasSharpAccess && displayOdds?.fair_american && (
                    <span className={cn("text-[10px] text-neutral-400 transition-opacity duration-200", oddsTransitioning && "opacity-0")}>
                      Fair <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{displayOdds.fair_american}</span>
                      {displayOdds.ev_pct != null && displayOdds.ev_pct > 0 && (
                        <span className={cn("ml-1 font-bold", displayOdds.ev_pct >= 5 ? "text-[#22C55E]" : displayOdds.ev_pct >= 2 ? "text-[#22C55E]/80" : "text-[#EAB308]")}>
                          +{displayOdds.ev_pct.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {/* Market pills — scrollable, touch-friendly */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                  {ODDS_MARKETS.map((m) => {
                    const isActive = localOddsMarket === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => { setLocalOddsMarket(m.key); setLocalOddsLine(ODDS_LINE_OPTIONS[m.key]?.[0] ?? 0.5); setUserChangedMarket(true); }}
                        className={cn(
                          "font-medium rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95",
                          isMobile ? "px-3 py-2 text-xs" : "px-2.5 py-1.5 text-[10px]",
                          isActive
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm"
                            : "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                      >
                        {m.shortLabel}
                      </button>
                    );
                  })}
                </div>
                {/* Line pills */}
                {(ODDS_LINE_OPTIONS[localOddsMarket] || []).length > 1 && (
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
                    {(ODDS_LINE_OPTIONS[localOddsMarket] || [0.5]).map((ln) => (
                      <button
                        key={ln}
                        onClick={() => { setLocalOddsLine(ln); setUserChangedMarket(true); }}
                        className={cn(
                          "font-mono font-medium rounded-md transition-all shrink-0 active:scale-95",
                          isMobile ? "px-3 py-2 text-xs" : "px-2 py-1 text-[10px]",
                          localOddsLine === ln
                            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border border-transparent"
                        )}
                      >
                        O {ln}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Books grid — smooth fade during transitions */}
              <div className={cn("transition-opacity duration-200", oddsTransitioning && "opacity-40")}>
                {displayOdds && displayOdds.all_books.length > 0 ? (
                  <div className={cn("grid gap-1.5", isMobile ? "grid-cols-3" : "grid-cols-4 md:grid-cols-5")}>
                    {[...displayOdds.all_books].sort((a, b) => b.price - a.price).slice(0, 10).map((book, idx) => {
                      const logo = getBookLogo(book.book);
                      const link = getPreferredLink(book.link, book.mobile_link);
                      const isBest = idx === 0;
                      const sbName = getSportsbookById(normalizeSportsbookId(book.book))?.name || book.book;
                      return (
                        <a
                          key={book.book}
                          href={link ? (applyState(link) || link) : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { if (!link) e.preventDefault(); }}
                          title={sbName}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-lg border transition-all",
                            isMobile ? "px-2 py-2" : "px-2 py-1.5",
                            link && "hover:scale-[1.02] active:scale-[0.98]",
                            isBest
                              ? "border-[#22C55E]/30 bg-[#22C55E]/[0.06]"
                              : "border-neutral-200/40 dark:border-neutral-700/20"
                          )}
                        >
                          {logo && <img src={logo} alt={sbName} className="h-5 w-5 rounded object-contain shrink-0" />}
                          <span className={cn("font-mono font-bold tabular-nums text-[11px]", isBest ? "text-[#22C55E]" : "text-neutral-900 dark:text-white")}>
                            {formatOddsPrice(book.price)}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className={cn("grid gap-1.5", isMobile ? "grid-cols-3" : "grid-cols-4 md:grid-cols-5")}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className={cn("flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200/20 dark:border-neutral-700/10", isMobile ? "px-2 py-2" : "px-2 py-1.5")}>
                        <div className="h-5 w-5 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
                        <div className="h-4 w-10 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (oddsEntry || localOddsEntry) ? null : gameId ? (
            <div className="mt-4 pt-3 border-t border-neutral-200/40 dark:border-neutral-700/20">
              <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 mb-2">Prop Odds</h5>
              <div className={cn("grid gap-1.5", isMobile ? "grid-cols-3" : "grid-cols-4 md:grid-cols-5")}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn("flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200/20 dark:border-neutral-700/10 animate-pulse", isMobile ? "px-2 py-2" : "px-2 py-1.5")}>
                    <div className="h-5 w-5 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
                    <div className="h-4 w-10 rounded bg-neutral-200/60 dark:bg-neutral-700/40" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom section: H2H + Recent Form */}
      <div className={cn("grid gap-3 mt-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {/* H2H */}
        <div className="rounded-lg border border-neutral-200/40 dark:border-neutral-800/20 bg-white dark:bg-neutral-900/40 p-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">Head-to-Head</h5>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-neutral-300 dark:text-neutral-600 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[220px] text-xs">Career stats for this batter vs this specific pitcher across all seasons.</TooltipContent></Tooltip></TooltipProvider>
          </div>
          {batter.h2h && batter.h2h.pa > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-6 text-center">
                {[
                  { label: "PA", value: batter.h2h.pa, color: "" },
                  { label: "AVG", value: fmtAvg(batter.h2h.avg), color: "" },
                  { label: "SLG", value: fmtAvg(batter.h2h.slg), color: slgTextColor(batter.h2h.slg) },
                  { label: "HR", value: batter.h2h.hrs, color: batter.h2h.hrs > 0 ? STAT_GREEN : "" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-[9px] text-neutral-400">{s.label}</p>
                    <p className={cn("text-sm font-bold tabular-nums", s.color || "text-neutral-900 dark:text-white")}>{s.value}</p>
                  </div>
                ))}
              </div>
              {h2hMeetings.length > 0 && (
                <div className="space-y-0.5">
                  {h2hMeetings.map((m) => (
                    <div key={m.date} className="flex items-center justify-between text-[10px] tabular-nums">
                      <span className="text-neutral-400">{m.date?.slice(5)}</span>
                      <span className="text-neutral-600 dark:text-neutral-300">
                        {m.hits}/{m.pa}
                        {m.hrs > 0 && <span className="text-emerald-500 font-bold ml-1">{m.hrs} HR</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {batter.h2h.pa < 10 && (
                <p className="text-[10px] text-amber-500">Small sample ({batter.h2h.pa} PA)</p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-500">No career data vs this pitcher</p>
          )}
        </div>

        {/* Recent Form */}
        <div className="rounded-lg border border-neutral-200/40 dark:border-neutral-800/20 bg-white dark:bg-neutral-900/40 p-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">Recent Form (60d)</h5>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-neutral-300 dark:text-neutral-600 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[220px] text-xs">Contact quality and power metrics from the last 60 days. EV Trend shows avg exit velocity per game day.</TooltipContent></Tooltip></TooltipProvider>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Brl%", value: batter.recent_barrel_pct != null ? `${batter.recent_barrel_pct}%` : "-", color: barrelTextColor(batter.recent_barrel_pct) },
              { label: "Avg EV", value: batter.recent_avg_ev?.toFixed(1) ?? "-", color: evTextColor(batter.recent_avg_ev) },
              { label: "HR", value: batter.recent_hr_count, color: batter.recent_hr_count >= 3 ? STAT_GREEN : "" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[9px] text-neutral-400">{s.label}</p>
                <p className={cn("text-sm font-bold tabular-nums", s.color || "text-neutral-900 dark:text-white")}>{s.value}</p>
              </div>
            ))}
            {sparkline.length >= 2 && (
              <div className="ml-auto text-right">
                <p className="text-[9px] text-neutral-400 mb-0.5">EV Trend</p>
                <MiniSparkline values={sparkline} width={80} height={24} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Zone Analysis */}
      {hotZone && (hotZone.batterZones.length > 0 || hotZone.pitcherZones.length > 0 || hotZone.overlay.length > 0) && (
        <div className={cn("rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-3 transition-opacity duration-200", hotZoneFetching && "opacity-50")}>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h5 className="text-[10px] uppercase tracking-wide font-semibold text-neutral-500">
                Strike Zone Analysis
              </h5>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                9-zone strike zone from the catcher&apos;s view. Red/orange = hot zones, blue = cold zones.
              </p>
            </div>
            {/* Pitch type filter pills */}
            {hotZone && hotZone.pitchTypes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setLocalZonePitch(null)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                    !zonePitchType
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  All
                </button>
                {hotZone.pitchTypes.map((pt) => (
                  <button
                    key={pt.pitch_type}
                    onClick={() => setLocalZonePitch(pt.pitch_type === zonePitchType ? null : pt.pitch_type)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                      zonePitchType === pt.pitch_type
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {pt.pitch_name ?? pt.pitch_type}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-4 flex-wrap">
            {/* Batter hot zones: where they make contact */}
            {hotZone.batterZones.length > 0 && (
              <BatterHotZoneGrid zones={hotZone.batterZones} label={`${batter.player_name.split(" ").pop()} — Contact Zones`} />
            )}

            {/* Pitcher tendencies: where they throw */}
            {hotZone.pitcherZones.length > 0 && (
              <PitcherTendencyGrid zones={hotZone.pitcherZones} label={`${pitcher.name.split(" ").pop()} — Pitch Locations`} />
            )}

            {/* Matchup overlay: who wins each zone */}
            {hotZone.overlay.length > 0 && (
              <MatchupOverlayGrid zones={hotZone.overlay} />
            )}
          </div>

          {/* Legend + insights */}
          <div className="flex items-start gap-4 flex-wrap pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-neutral-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/60" /> Hot</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400/40" /> Warm</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-300/25 border border-yellow-400/30" /> Lukewarm</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400/25" /> Cold</span>
              {hotZone.overlay.length > 0 && (
                <>
                  <span className="mx-1 text-neutral-300 dark:text-neutral-600">|</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/40" /> HIT = batter wins</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/35" /> MISS = pitcher wins</span>
                </>
              )}
            </div>
          </div>

          {/* Auto-insight */}
          {hotZone.overlay.length > 0 && (() => {
            const batterWins = hotZone.overlay.filter((z) => z.advantage === "batter_advantage").length;
            const pitcherWins = hotZone.overlay.filter((z) => z.advantage === "pitcher_advantage").length;
            if (batterWins >= 4) return (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 dark:bg-emerald-500/10 rounded px-2 py-1 border border-emerald-500/15">
                {batter.player_name.split(" ").pop()} has the advantage in {batterWins}/9 zones — favorable zone matchup
              </p>
            );
            if (pitcherWins >= 5) return (
              <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold bg-red-500/5 dark:bg-red-500/10 rounded px-2 py-1 border border-red-500/15">
                {pitcher.name.split(" ").pop()} controls {pitcherWins}/9 zones — tough zone matchup for the batter
              </p>
            );
            return null;
          })()}
        </div>
      )}
      {hotZoneLoading && !hotZone && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 mb-3">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="uppercase tracking-wider font-semibold">Loading Strike Zone</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <div key={j} className="aspect-square rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comparison View ─────────────────────────────────────────────────────────

type CompSortKey =
  | "lineup" | "grade" | "hr_score" | "overlap"
  | "slg" | "woba" | "iso" | "ev" | "brl" | "k_pct" | "bb_pct"
  | "recent_ev" | "recent_brl" | "h2h"
  | "primary_slg" | "secondary_slg";

function compSortVal(b: BatterMatchup, key: CompSortKey, primary?: PitchArsenalRow | null, secondary?: PitchArsenalRow | null): number {
  switch (key) {
    case "lineup": return b.lineup_position ?? 99;
    case "grade": return b.matchup_grade === "strong" ? 3 : b.matchup_grade === "neutral" ? 2 : 1;
    case "hr_score": return b.hr_probability_score ?? 0;
    case "overlap": return b.overlap_score ?? 0;
    case "slg": return b.slg ?? -1;
    case "woba": return b.woba ?? -1;
    case "iso": return b.iso ?? -1;
    case "ev": return b.avg_exit_velo ?? -1;
    case "brl": return b.barrel_pct ?? -1;
    case "k_pct": return b.k_pct ?? 999; // lower is better, so invert in sort
    case "bb_pct": return b.bb_pct ?? -1;
    case "recent_ev": return b.recent_avg_ev ?? -1;
    case "recent_brl": return b.recent_barrel_pct ?? -1;
    case "h2h": return b.h2h?.pa ?? 0;
    case "primary_slg": {
      const s = primary ? b.pitch_splits.find((sp) => sp.pitch_type === primary.pitch_type) : null;
      return s?.slg ?? -1;
    }
    case "secondary_slg": {
      const s = secondary ? b.pitch_splits.find((sp) => sp.pitch_type === secondary.pitch_type) : null;
      return s?.slg ?? -1;
    }
    default: return 0;
  }
}

function DeltaArrow({ current, baseline, higherGood = true }: { current: number | null; baseline: number | null; higherGood?: boolean }) {
  if (current == null || baseline == null || baseline === 0) return null;
  const diff = current - baseline;
  if (Math.abs(diff) < 0.005 && Math.abs(baseline) < 10) return null; // insignificant for rate stats
  if (Math.abs(diff) < 0.5 && Math.abs(baseline) >= 10) return null; // insignificant for counting stats
  const isUp = diff > 0;
  const isGood = higherGood ? isUp : !isUp;
  return (
    <span className={cn("text-[8px] ml-0.5", isGood ? "text-emerald-500" : "text-red-400")}>
      {isUp ? "▲" : "▼"}
    </span>
  );
}

function ComparisonView({
  batters,
  pitcher,
  expandedBatterId,
  onToggleExpand,
  pitchFilter,
  getStats,
  batterOdds,
  hasSharpAccess,
  gameId,
}: {
  batters: BatterMatchup[];
  pitcher: PitcherProfile;
  expandedBatterId: number | null;
  onToggleExpand: (id: number) => void;
  pitchFilter: string | null;
  getStats: (b: BatterMatchup) => DisplayStats;
  batterOdds?: Record<string, BatterOddsEntry>;
  hasSharpAccess?: boolean;
  gameId?: number | null;
}) {
  const primary = pitcher.arsenal[0] ?? null;
  const secondary = (pitcher.arsenal[1]?.usage_pct ?? 0) >= 15 ? pitcher.arsenal[1] : null;

  const [sortKey, setSortKey] = useState<CompSortKey>("lineup");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = useCallback((key: CompSortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      // Default to desc for most stats (higher = better), asc for k_pct and lineup
      setSortAsc(key === "k_pct" || key === "lineup");
    }
  }, [sortKey, sortAsc]);

  const sorted = useMemo(() => {
    const arr = [...batters];
    arr.sort((a, b) => {
      const va = compSortVal(a, sortKey, primary, secondary);
      const vb = compSortVal(b, sortKey, primary, secondary);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [batters, sortKey, sortAsc, primary, secondary]);

  const thCls = "px-1.5 py-2 text-[10px] uppercase tracking-wide font-semibold text-neutral-500 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors select-none whitespace-nowrap";
  const sortIcon = (key: CompSortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-2">
      {/* Sort controls */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-neutral-400">Sort by</span>
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800/60">
          {([
            { key: "lineup" as CompSortKey, label: "Order" },
            { key: "hr_score" as CompSortKey, label: "HR Score" },
            { key: "grade" as CompSortKey, label: "Grade" },
            { key: "overlap" as CompSortKey, label: "Overlap" },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-all",
                sortKey === opt.key
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.label}{sortIcon(opt.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Matchup cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {sorted.map((b) => {
          const hrScore = b.hr_probability_score ?? 0;
          const overlap = b.overlap_score ?? 0;
          const hasPlatoon =
            (b.batting_hand === "L" && pitcher.hand === "R") ||
            (b.batting_hand === "R" && pitcher.hand === "L");
          const isExpanded = expandedBatterId === b.player_id;

          // Pitch vulnerability
          const topPitchSplits = pitcher.arsenal.slice(0, 3).map((a) => {
            const split = b.pitch_splits.find((s) => s.pitch_type === a.pitch_type);
            return { name: a.pitch_name, slg: split?.slg ?? null, pa: split?.batted_balls ?? 0 };
          });

          return (
            <div
              key={b.player_id}
              className={cn(
                "rounded-xl border transition-all duration-150 overflow-hidden",
                isExpanded
                  ? "border-brand/40 bg-brand/5 dark:bg-brand/5 sm:col-span-2 xl:col-span-3"
                  : "border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900"
              )}
            >
            <button
              onClick={() => onToggleExpand(b.player_id)}
              className="text-left w-full p-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
            >
              {/* Header: name + grade */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold text-neutral-400 tabular-nums w-4 shrink-0">
                  {b.lineup_position ?? "-"}
                </span>
                <img
                  src={getMlbHeadshotUrl(b.player_id, "tiny")}
                  alt={b.player_name}
                  className="w-7 h-7 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white truncate block">{b.player_name}</span>
                  <span className={cn("text-[10px]", hasPlatoon ? "font-bold text-emerald-500" : "text-neutral-400")}>
                    {b.batting_hand}{hasPlatoon ? " PLT" : ""}
                  </span>
                </div>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                  b.matchup_grade === "strong" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : b.matchup_grade === "weak" ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700"
                )}>
                  {b.matchup_grade === "strong" ? "STRONG" : b.matchup_grade === "weak" ? "WEAK" : "NEUTRAL"}
                </span>
              </div>

              {/* HR Score bar */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-12 shrink-0">HR Score</span>
                <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", hrScore >= 60 ? "bg-emerald-500" : hrScore >= 40 ? "bg-amber-500" : "bg-red-400")}
                    style={{ width: `${hrScore}%` }}
                  />
                </div>
                <span className={cn("text-xs font-black tabular-nums w-6 text-right", hrScore >= 60 ? "text-emerald-500" : hrScore >= 40 ? "text-amber-500" : "text-red-400")}>
                  {hrScore}
                </span>
              </div>

              {/* Pitch vulnerability + overlap */}
              <div className="flex items-center gap-3 mb-2">
                {overlap > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-neutral-400">Overlap</span>
                    <span className={cn("text-[11px] font-bold tabular-nums", overlap >= 60 ? "text-emerald-500" : overlap >= 30 ? "text-amber-500" : "text-neutral-500")}>
                      {overlap}%
                    </span>
                  </div>
                )}
                {topPitchSplits.filter(s => s.pa > 0).slice(0, 2).map((s) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <span className="text-[9px] text-neutral-400">vs {s.name}</span>
                    <span className={cn("text-[11px] font-bold tabular-nums", slgTextColor(s.slg) || "text-neutral-700 dark:text-neutral-300")}>
                      {fmtAvg(s.slg)}
                    </span>
                  </div>
                ))}
              </div>

              {/* H2H + HR factors */}
              <div className="flex items-center gap-3 text-[10px]">
                {b.h2h && b.h2h.pa > 0 && (
                  <span className="text-neutral-500">
                    H2H: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{b.h2h.hits}/{b.h2h.pa}</span>
                    {b.h2h.hrs > 0 && <span className="text-emerald-500 font-bold ml-0.5">{b.h2h.hrs} HR</span>}
                  </span>
                )}
                {b.hr_factors.filter(f => f.positive).slice(0, 2).map((f, i) => (
                  <span key={i} className="text-emerald-600 dark:text-emerald-400 font-medium truncate">{f.label}</span>
                ))}
              </div>
            </button>

            {/* Expanded drilldown */}
            {isExpanded && (
              <div className="border-t border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/50 dark:bg-neutral-800/20 px-3 pb-3">
                <BatterExpansion batter={b} pitcher={pitcher} isMobile={false} pitchFilter={pitchFilter} oddsEntry={batterOdds ? findPlayerOdds(batterOdds, b.player_name) : null} hasSharpAccess={hasSharpAccess} gameId={gameId} />
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Standard View Sort ───────────────────────────────────────────────────────

type StdSortKey = "lineup" | "slg" | "iso" | "hr" | "ev" | "brl" | "woba" | "ba" | "k_pct" | "bb_pct";

function stdSortVal(b: BatterMatchup, key: StdSortKey, getStats: (b: BatterMatchup) => DisplayStats): number {
  const ds = getStats(b);
  switch (key) {
    case "lineup": return b.lineup_position ?? 99;
    case "slg": return ds.slg ?? -1;
    case "iso": return ds.iso ?? -1;
    case "hr": return ds.hr;
    case "ev": return ds.ev ?? -1;
    case "brl": return ds.brl ?? -1;
    case "woba": return ds.woba ?? -1;
    case "ba": return ds.avg ?? -1;
    case "k_pct": return b.k_pct ?? 999;
    case "bb_pct": return b.bb_pct ?? -1;
    default: return 0;
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MlbBatterVsPitcher() {
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [battingSide, setBattingSide] = useState<"home" | "away">("away");
  const [sample, setSample] = useState<"season" | "30" | "15" | "7">("season");
  const [expandedBatterId, setExpandedBatterId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "comparison">("standard");
  const [pitchFilters, setPitchFilters] = useState<string[]>([]); // empty = "All Pitches"
  const [handFilter, setHandFilter] = useState<"all" | "rhp" | "lhp">("all"); // auto-defaults to pitcher's hand
  const [handAutoSet, setHandAutoSet] = useState(false); // tracks if hand filter was auto-set
  const [statSeason, setStatSeason] = useState<number>(() => {
    // Default to current year from April onwards, prior year otherwise
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [stdSortKey, setStdSortKey] = useState<StdSortKey>("lineup");
  const [stdSortAsc, setStdSortAsc] = useState(true);
  const [showBench, setShowBench] = useState(false);

  // Odds column state
  const [oddsMarket, setOddsMarket] = useState("player_home_runs");
  const [oddsLine, setOddsLine] = useState<number>(0.5);
  const [oddsSide, setOddsSide] = useState<"over" | "under">("over");
  const [oddsMenuOpen, setOddsMenuOpen] = useState(false);
  const oddsMenuRef = React.useRef<HTMLTableCellElement>(null);

  // Click outside to close odds market dropdown
  React.useEffect(() => {
    if (!oddsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (oddsMenuRef.current && !oddsMenuRef.current.contains(e.target as Node)) setOddsMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [oddsMenuOpen]);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess: hasSharpAccess } = useHasSharpAccess();
  const { games, isLoading: gamesLoading } = useMlbGames();

  // Filter out finished games — users only care about upcoming/live
  const activeGames = useMemo(() =>
    games.filter((g) => {
      const status = (g.game_status || "").toLowerCase();
      return !status.includes("final") && !status.includes("postponed") && !status.includes("cancelled");
    }),
    [games]
  );

  // Auto-select first upcoming game
  useEffect(() => {
    if (activeGames.length > 0 && selectedGameId == null) {
      setSelectedGameId(Number(activeGames[0].game_id));
    }
  }, [activeGames, selectedGameId]);

  // Reset expanded batter and filters when changing game/side
  useEffect(() => {
    setExpandedBatterId(null);
    setPitchFilters([]);
    setHandFilter("all");
    setHandAutoSet(false);
    setShowBench(false);
  }, [selectedGameId, battingSide]);

  const { pitcher, batters, summary, game, meta, isLoading: matchupLoading, isFetching, refetch } = useMlbGameMatchup({
    gameId: selectedGameId,
    battingSide,
    sample,
    statSeason,
  });

  // Batter odds for the odds column
  const { odds: batterOdds, isFetching: oddsFetching } = useMlbBatterOdds(
    selectedGameId,
    oddsMarket,
    oddsLine,
    oddsSide
  );

  // Game-level odds from the games list (moneyline, total, spread)
  const currentGame = games.find((g) => Number(g.game_id) === selectedGameId);
  const gameOdds = currentGame?.odds ?? null;

  // Auto-default hand filter to pitcher's handedness
  useEffect(() => {
    if (pitcher?.hand && handFilter === "all" && !handAutoSet) {
      const h = pitcher.hand.toUpperCase() === "L" ? "lhp" : "rhp";
      setHandFilter(h);
      setHandAutoSet(true);
    }
  }, [pitcher?.hand]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find the selected game from the games list for display
  const selectedGame = useMemo(
    () => games.find((g) => Number(g.game_id) === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  // Pitcher pitch types for filter pills
  const pitcherPitchTypes = meta?.pitcher_pitch_types ?? [];

  // Helper: get effective stats for a batter (filtered by hand and/or pitch type)
  const getBatterStats = useCallback((b: BatterMatchup) => {
    // Start with overall stats
    let base: any = {
      avg: b.avg, slg: b.slg, woba: b.woba, iso: b.iso,
      hr: b.hr_count, ev: b.avg_exit_velo, brl: b.barrel_pct,
      bbs: b.total_batted_balls,
      k_pct: b.k_pct, bb_pct: b.bb_pct,
    };

    // Layer hand filter
    if (handFilter !== "all") {
      const hs = handFilter === "rhp" ? b.hand_splits?.vs_rhp : b.hand_splits?.vs_lhp;
      if (hs) {
        base = {
          avg: hs.avg, slg: hs.slg, woba: hs.woba, iso: hs.iso,
          hr: hs.hr, ev: hs.ev, brl: hs.brl, bbs: hs.bbs,
          k_pct: hs.k_pct ?? null, bb_pct: hs.bb_pct ?? null,
        };
      } else {
        base = { avg: null, slg: null, woba: null, iso: null, hr: 0, ev: null, brl: null, bbs: 0, k_pct: null, bb_pct: null };
      }
    }

    // Layer pitch filter(s) — aggregate stats across selected pitches
    if (pitchFilters.length > 0) {
      let splits = b.pitch_splits;
      if (handFilter !== "all" && b.pitch_hand_splits) {
        splits = handFilter === "rhp" ? b.pitch_hand_splits.vs_rhp : b.pitch_hand_splits.vs_lhp;
      }
      const matched = splits.filter((s) => pitchFilters.includes(s.pitch_type));
      if (matched.length === 0) {
        return { avg: null, slg: null, woba: null, iso: null, hr: 0, ev: null, brl: null, bbs: 0, k_pct: null, bb_pct: null };
      }
      // Weighted average across selected pitches (by PA/batted balls)
      const totalBBs = matched.reduce((sum, s) => sum + s.batted_balls, 0);
      if (totalBBs === 0) {
        return { avg: null, slg: null, woba: null, iso: null, hr: 0, ev: null, brl: null, bbs: 0, k_pct: null, bb_pct: null };
      }
      const wavg = (fn: (s: typeof matched[0]) => number | null) => {
        let sum = 0, w = 0;
        for (const s of matched) { const v = fn(s); if (v != null && s.batted_balls > 0) { sum += v * s.batted_balls; w += s.batted_balls; } }
        return w > 0 ? sum / w : null;
      };
      return {
        avg: wavg((s) => s.avg), slg: wavg((s) => s.slg), woba: wavg((s) => s.woba ?? null), iso: wavg((s) => s.iso),
        hr: matched.reduce((sum, s) => sum + s.hrs, 0), ev: wavg((s) => s.avg_ev ?? null), brl: wavg((s) => s.barrel_pct),
        bbs: totalBBs,
        k_pct: wavg((s) => s.k_pct ?? null),
        bb_pct: wavg((s) => s.bb_pct ?? null),
      };
    }

    return base;
  }, [pitchFilters, handFilter]);

  // Lineup totals (respects pitch filter) — computed per group: all, lefties, righties
  const lineupTotals = useMemo(() => {
    if (batters.length === 0) return null;

    function computeGroup(group: BatterMatchup[]) {
      const stats = group.map((b) => getBatterStats(b));
      const withData = stats.filter((s) => s.bbs > 0);
      if (withData.length === 0) return null;
      const avg = (arr: { avg: number | null }[]) => { const v = arr.filter((s) => s.avg != null); return v.length > 0 ? v.reduce((sum, s) => sum + s.avg!, 0) / v.length : null; };
      const mean = (arr: (number | null)[]) => { const v = arr.filter((x): x is number => x != null); return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      return {
        avg: avg(withData),
        slg: mean(withData.map((s) => s.slg)),
        woba: mean(withData.map((s) => s.woba)),
        iso: mean(withData.map((s) => s.iso)),
        hr: stats.reduce((sum, s) => sum + s.hr, 0),
        ev: mean(withData.map((s) => s.ev)),
        brl: mean(withData.map((s) => s.brl)),
        k_pct: mean(group.map((b) => b.k_pct)),
        bb_pct: mean(group.map((b) => b.bb_pct)),
        count: group.length,
      };
    }

    const lefties = batters.filter((b) => b.batting_hand === "L" || b.batting_hand === "S");
    const righties = batters.filter((b) => b.batting_hand === "R");

    return {
      all: computeGroup(batters),
      lefties: lefties.length > 0 ? computeGroup(lefties) : null,
      righties: righties.length > 0 ? computeGroup(righties) : null,
      lhb: lefties.length,
      rhb: righties.length,
      count: batters.length,
    };
  }, [batters, getBatterStats]);

  const handleStdSort = useCallback((key: StdSortKey) => {
    if (stdSortKey === key) {
      setStdSortAsc(!stdSortAsc);
    } else {
      setStdSortKey(key);
      setStdSortAsc(key === "k_pct" || key === "lineup");
    }
  }, [stdSortKey, stdSortAsc]);

  const sortedBatters = useMemo(() => {
    const arr = [...batters];
    arr.sort((a, b) => {
      const va = stdSortVal(a, stdSortKey, getBatterStats);
      const vb = stdSortVal(b, stdSortKey, getBatterStats);
      return stdSortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [batters, stdSortKey, stdSortAsc, getBatterStats]);

  // Split into starters (lineup 1-9) and bench
  const starters = useMemo(() =>
    sortedBatters.filter((b) => b.lineup_position != null && b.lineup_position >= 1 && b.lineup_position <= 9),
    [sortedBatters]
  );
  const benchPlayers = useMemo(() =>
    sortedBatters.filter((b) => b.lineup_position == null || b.lineup_position < 1 || b.lineup_position > 9),
    [sortedBatters]
  );
  // If fewer than 5 starters, show everyone (lineups not posted yet)
  const hasLineup = starters.length >= 5;
  const isLineupConfirmed = !!(meta as any)?.lineup_confirmed;
  const displayBatters = hasLineup ? starters : sortedBatters;

  const stdSortIcon = (key: StdSortKey) => stdSortKey === key ? (stdSortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-3">
      {gamesLoading ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-500">Loading games...</p>
          </div>
        ) : activeGames.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center">
            <p className="text-sm text-neutral-500">{games.length > 0 ? "All games have finished" : "No games scheduled today"}</p>
          </div>
        ) : (
          <>
            {/* ── Section A: Game Selector ── */}
            {isMobile ? (
              /* Mobile: dropdown game selector */
              <MobileGameSelector
                games={activeGames}
                selectedGameId={selectedGameId}
                onSelect={(id) => { setSelectedGameId(id); setBattingSide("away"); }}
              />
            ) : (
              /* Desktop: horizontal game chip bar */
              <div data-tour="game-bar" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-2 py-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-0.5 px-0.5">
                  {(() => {
                    let lastDate = "";
                    return activeGames.map((g, gi) => {
                      const showDateHeader = g.game_date !== lastDate;
                      lastDate = g.game_date;
                      const dateLabel = (() => {
                        const d = new Date(g.game_date + "T12:00:00");
                        const fmtET = (dt: Date) => dt.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
                        const todayET = fmtET(new Date());
                        const tomorrowDt = new Date();
                        tomorrowDt.setDate(tomorrowDt.getDate() + 1);
                        const tomorrowET = fmtET(tomorrowDt);
                        if (g.game_date === todayET) return "Today";
                        if (g.game_date === tomorrowET) return "Tomorrow";
                        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                      })();
                      return (
                        <React.Fragment key={g.game_id}>
                          {showDateHeader && (
                            <div className="shrink-0 flex items-center px-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 whitespace-nowrap">{dateLabel}</span>
                            </div>
                          )}
                          <GameChip
                            game={g}
                            selected={Number(g.game_id) === selectedGameId}
                            onClick={() => {
                              setSelectedGameId(Number(g.game_id));
                              setBattingSide("away");
                            }}
                          />
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ── Section B: Team Toggle + Context + Filters ── */}
            {game && (
              <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
                {/* Row 1: Team toggle + summary stats */}
                <div className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2.5 border-b border-neutral-200/40 dark:border-neutral-700/20",
                  isMobile && "flex-col items-stretch gap-2"
                )}>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 flex-1 sm:flex-initial">
                      <button
                        onClick={() => setBattingSide("away")}
                        className={cn(
                          "flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                          battingSide === "away"
                            ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                      >
                        <img
                          src={`/team-logos/mlb/${game.away_team.abbr.toUpperCase()}.svg`}
                          className="w-4 h-4 object-contain"
                          alt={game.away_team.abbr}
                        />
                        {game.away_team.abbr}{!isMobile && " Batting"}
                      </button>
                      <button
                        onClick={() => setBattingSide("home")}
                        className={cn(
                          "flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                          battingSide === "home"
                            ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                      >
                        <img
                          src={`/team-logos/mlb/${game.home_team.abbr.toUpperCase()}.svg`}
                          className="w-4 h-4 object-contain"
                          alt={game.home_team.abbr}
                        />
                        {game.home_team.abbr}{!isMobile && " Batting"}
                      </button>
                    </div>
                    {summary && !isMobile && (
                      <>
                        <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />
                        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{summary.strong_count}</span> Strong
                          <span className="mx-1 text-neutral-300 dark:text-neutral-700">&middot;</span>
                          <span className="font-semibold">{summary.neutral_count}</span> Neutral
                          <span className="mx-1 text-neutral-300 dark:text-neutral-700">&middot;</span>
                          <span className="text-red-500 dark:text-red-400 font-semibold">{summary.weak_count}</span> Weak
                        </span>
                      </>
                    )}
                  </div>
                  {/* Mobile: summary + controls in one row */}
                  {isMobile && pitcher && (
                    <div className="flex items-center justify-between gap-2">
                      {summary && (
                        <span className="text-[11px] text-neutral-400 tabular-nums">
                          <span className="text-emerald-600 font-semibold">{summary.strong_count}</span>S
                          <span className="mx-0.5 text-neutral-600">/</span>
                          <span className="font-semibold">{summary.neutral_count}</span>N
                          <span className="mx-0.5 text-neutral-600">/</span>
                          <span className="text-red-500 font-semibold">{summary.weak_count}</span>W
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {[2025, 2026].map((yr) => (
                            <button
                              key={yr}
                              onClick={() => setStatSeason(yr)}
                              className={cn(
                                "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                                statSeason === yr
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500"
                              )}
                            >
                              {yr}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {SAMPLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setSample(opt.value)}
                              className={cn(
                                "px-1.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                                sample === opt.value
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500"
                              )}
                            >
                              {opt.value === "season" ? "Szn" : opt.label.replace("Last ", "")}
                            </button>
                          ))}
                        </div>
                        {isFetching && !matchupLoading && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                        )}
                      </div>
                    </div>
                  )}
                  {/* Mobile: Odds + Weather row */}
                  {isMobile && currentGame && (
                    <div className="flex items-center justify-between gap-2 px-0.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/20">
                      {/* Odds */}
                      {gameOdds && (gameOdds.away_ml || gameOdds.total != null) && (
                        <div className="flex items-center gap-2 text-[10px] tabular-nums">
                          {(() => { const fdLogo = getBookLogo("fanduel"); return fdLogo ? <img src={fdLogo} alt="" className="w-3.5 h-3.5 rounded object-contain opacity-50" /> : null; })()}
                          {(gameOdds.away_ml || gameOdds.home_ml) && (
                            <span className="flex items-center gap-0.5 text-neutral-400">
                              <img src={`/team-logos/mlb/${currentGame.away_team_tricode.toUpperCase()}.svg`} className="w-2.5 h-2.5 object-contain" alt="" />
                              <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.away_ml}</span>
                              <span className="mx-0.5">/</span>
                              <img src={`/team-logos/mlb/${currentGame.home_team_tricode.toUpperCase()}.svg`} className="w-2.5 h-2.5 object-contain" alt="" />
                              <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.home_ml}</span>
                            </span>
                          )}
                          {gameOdds.total != null && (
                            <span className="text-neutral-400">
                              O/U <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.total}</span>
                            </span>
                          )}
                          {(gameOdds.away_total != null || gameOdds.home_total != null) && (
                            <span className="flex items-center gap-0.5 text-neutral-400">
                              TT
                              <img src={`/team-logos/mlb/${currentGame.away_team_tricode.toUpperCase()}.svg`} className="w-2.5 h-2.5 object-contain ml-0.5" alt="" />
                              <span className="font-medium text-neutral-700 dark:text-neutral-300">{gameOdds.away_total ?? "-"}</span>
                              <span className="mx-0.5">/</span>
                              <img src={`/team-logos/mlb/${currentGame.home_team_tricode.toUpperCase()}.svg`} className="w-2.5 h-2.5 object-contain" alt="" />
                              <span className="font-medium text-neutral-700 dark:text-neutral-300">{gameOdds.home_total ?? "-"}</span>
                            </span>
                          )}
                        </div>
                      )}
                      {/* Weather */}
                      {currentGame.weather && (
                        <div className="flex items-center gap-1.5 text-[10px] tabular-nums text-neutral-400">
                          {currentGame.weather.temperature_f != null && (
                            <span className="font-semibold text-neutral-900 dark:text-white">{currentGame.weather.temperature_f}°</span>
                          )}
                          {currentGame.weather.wind_speed_mph != null && currentGame.weather.wind_speed_mph > 0 && (
                            <span className="flex items-center gap-0.5">
                              <span className="font-medium">{currentGame.weather.wind_speed_mph}mph</span>
                              {currentGame.weather.wind_impact && (
                                <span className={cn(
                                  "font-semibold",
                                  currentGame.weather.wind_impact === "Blowing Out" ? "text-emerald-600 dark:text-emerald-400" :
                                  currentGame.weather.wind_impact === "Blowing In" ? "text-red-500 dark:text-red-400" :
                                  "text-neutral-400"
                                )}>
                                  {currentGame.weather.wind_impact === "Blowing Out" ? "Out" :
                                   currentGame.weather.wind_impact === "Blowing In" ? "In" :
                                   currentGame.weather.wind_label?.split(" ").pop() || ""}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!isMobile && (
                    <div className="flex items-center gap-3">
                      {/* Inline odds */}
                      {gameOdds && (gameOdds.away_ml || gameOdds.total != null) && currentGame && (
                        <div className="flex items-center gap-3.5 text-[11px] tabular-nums">
                          {/* FD logo */}
                          {(() => { const fdLogo = getBookLogo("fanduel"); return fdLogo ? <img src={fdLogo} alt="FD" className="w-4 h-4 rounded object-contain opacity-60" /> : null; })()}
                          {/* Moneyline */}
                          {(gameOdds.away_ml || gameOdds.home_ml) && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-semibold text-neutral-400">ML</span>
                              <span className="flex items-center gap-0.5">
                                <img src={`/team-logos/mlb/${currentGame.away_team_tricode.toUpperCase()}.svg`} className="w-3 h-3 object-contain" alt="" />
                                <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.away_ml || "—"}</span>
                              </span>
                              <span className="text-neutral-300 dark:text-neutral-600">/</span>
                              <span className="flex items-center gap-0.5">
                                <img src={`/team-logos/mlb/${currentGame.home_team_tricode.toUpperCase()}.svg`} className="w-3 h-3 object-contain" alt="" />
                                <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.home_ml || "—"}</span>
                              </span>
                            </div>
                          )}
                          {/* Game Total */}
                          {gameOdds.total != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] uppercase tracking-wider font-semibold text-neutral-400">O/U</span>
                              <span className="font-bold text-neutral-900 dark:text-white">{gameOdds.total}</span>
                            </div>
                          )}
                          {/* Team Totals */}
                          {(gameOdds.away_total != null || gameOdds.home_total != null) && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-semibold text-neutral-400">TT</span>
                              {gameOdds.away_total != null && (
                                <span className="flex items-center gap-0.5">
                                  <img src={`/team-logos/mlb/${currentGame.away_team_tricode.toUpperCase()}.svg`} className="w-3 h-3 object-contain" alt="" />
                                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{gameOdds.away_total}</span>
                                </span>
                              )}
                              {gameOdds.home_total != null && (
                                <span className="flex items-center gap-0.5">
                                  <img src={`/team-logos/mlb/${currentGame.home_team_tricode.toUpperCase()}.svg`} className="w-3 h-3 object-contain" alt="" />
                                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{gameOdds.home_total}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {gameOdds && <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700/30 shrink-0" />}
                      {selectedGame && (
                        <span className="text-[11px] text-neutral-400 tabular-nums">{selectedGame.game_status}</span>
                      )}
                      {isFetching && !matchupLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Pitcher filters + Weather (desktop only) */}
                {!isMobile && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-neutral-100 dark:border-neutral-800/20">
                    {/* Left: Pitcher season + sample filters */}
                    {pitcher && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Pitcher</span>
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {[new Date().getFullYear() - 1, new Date().getFullYear()].map((yr) => (
                            <button
                              key={yr}
                              onClick={() => setStatSeason(yr)}
                              className={cn(
                                "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                                statSeason === yr
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                              )}
                            >
                              {yr}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {SAMPLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setSample(opt.value)}
                              className={cn(
                                "px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                                sample === opt.value
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Right: Weather + mini wind compass */}
                    {currentGame?.weather && (
                      <div className="flex items-center gap-2.5 text-[11px] tabular-nums">
                        {/* Text stats */}
                        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                          {currentGame.weather.temperature_f != null && (
                            <span className="font-semibold text-neutral-900 dark:text-white">{currentGame.weather.temperature_f}°F</span>
                          )}
                          {currentGame.weather.wind_speed_mph != null && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">{currentGame.weather.wind_speed_mph} mph</span>
                              {currentGame.weather.wind_impact && (
                                <span className={cn(
                                  "font-semibold",
                                  currentGame.weather.wind_impact === "Blowing Out" ? "text-emerald-600 dark:text-emerald-400" :
                                  currentGame.weather.wind_impact === "Blowing In" ? "text-red-500 dark:text-red-400" :
                                  "text-neutral-500"
                                )}>
                                  {currentGame.weather.wind_impact}
                                </span>
                              )}
                            </span>
                          )}
                          {currentGame.weather.roof_type && currentGame.weather.roof_type !== "Open" && (
                            <span className="font-medium">{currentGame.weather.roof_type}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Section C: Two-Column Layout (or loading) ── */}
            {matchupLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              </div>
            ) : !game ? (
              <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
                Select a game to view matchup breakdown
              </div>
            ) : (
              <div className="flex flex-col xl:flex-row gap-4">
                {/* Left: Pitcher Column */}
                <div data-tour="pitcher-card" className="xl:w-[38%] xl:sticky xl:top-0 xl:self-start">
                  {pitcher && (
                    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-4">
                      <PitcherProfileCard
                        pitcher={pitcher}
                        lineupLHBCount={lineupTotals?.lhb}
                        lineupRHBCount={lineupTotals?.rhb}
                        vulnerabilityTags={(summary?.pitcher_tags ?? []).filter((t) => t.type === "vulnerability" && /hittable|SLG/i.test(t.label))}
                        gameId={selectedGameId}
                        hasSharpAccess={hasSharpAccess}
                      />
                    </div>
                  )}
                </div>

                {/* Right: Lineup Column */}
                <div className="xl:w-[62%] space-y-3">
                  {/* Batter controls — view toggle + pitch pills + hand filter */}
                  {batters.length > 0 && pitcher && (
                    <div data-tour="batter-controls" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-3 py-2.5 space-y-2">
                      {/* Row 1: View toggle + hand filter */}
                      <div className="flex items-center justify-between gap-3">
                        <div data-tour="view-toggle" className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {([
                            { value: "standard" as const, label: "Standard", icon: TableProperties },
                            { value: "comparison" as const, label: "Matchup", icon: GitCompare },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setViewMode(opt.value)}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5",
                                viewMode === opt.value
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                              )}
                            >
                              <opt.icon className="w-3 h-3" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                          {([
                            { value: "all" as const, label: "All" },
                            { value: "rhp" as const, label: "vs RHP" },
                            { value: "lhp" as const, label: "vs LHP" },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setHandFilter(opt.value); setHandAutoSet(false); }}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                                handFilter === opt.value
                                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Row 2: Pitch pills */}
                      {pitcher.arsenal.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            onClick={() => setPitchFilters([])}
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border",
                              pitchFilters.length === 0
                                ? "bg-brand/10 border-brand/20 text-brand"
                                : "bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200/60 dark:border-neutral-700/30 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                            )}
                          >
                            All Pitches
                          </button>
                          {pitcher.arsenal.map((a) => (
                            <button
                              key={a.pitch_type}
                              onClick={() => setPitchFilters(pitchFilters.includes(a.pitch_type) ? pitchFilters.filter(p => p !== a.pitch_type) : [...pitchFilters, a.pitch_type])}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border",
                                pitchFilters.includes(a.pitch_type)
                                  ? "bg-brand/10 border-brand/20 text-brand"
                                  : "bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200/60 dark:border-neutral-700/30 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                              )}
                            >
                              {a.pitch_name} <span className="text-neutral-400 font-normal">{a.usage_pct}%</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lineup Table */}
                  <div data-tour="batter-table">
                  {batters.length > 0 ? (
                    viewMode === "comparison" && pitcher ? (
                      <ComparisonView
                        batters={displayBatters}
                        pitcher={pitcher}
                        expandedBatterId={expandedBatterId}
                        onToggleExpand={(id) => setExpandedBatterId(expandedBatterId === id ? null : id)}
                        pitchFilter={pitchFilters[0] ?? null}
                        getStats={getBatterStats}
                        batterOdds={batterOdds}
                        hasSharpAccess={hasSharpAccess}
                        gameId={selectedGameId}
                      />
                    ) : isMobile ? (
                      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 divide-y divide-neutral-100 dark:divide-neutral-800/30 overflow-hidden">
                        {displayBatters.map((b) => (
                          <BatterRow
                            key={b.player_id}
                            batter={b}
                            pitcher={pitcher!}
                            expanded={expandedBatterId === b.player_id}
                            onToggle={() => setExpandedBatterId(expandedBatterId === b.player_id ? null : b.player_id)}
                            isMobile
                            viewMode={viewMode}
                            displayStats={(pitchFilters.length > 0 || handFilter !== "all") ? getBatterStats(b) : undefined}
                            pitchFilter={pitchFilters[0] ?? null}
                            oddsEntry={findPlayerOdds(batterOdds, b.player_name)}
                            hasSharpAccess={hasSharpAccess}
                            oddsLoading={oddsFetching}
                            gameId={selectedGameId}
                          />
                        ))}
                        {hasLineup && benchPlayers.length > 0 && (
                          <>
                            <button
                              onClick={() => setShowBench(!showBench)}
                              className="w-full flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                            >
                              {showBench ? "Hide Bench" : `Show Bench (${benchPlayers.length})`}
                              <svg className={cn("w-3 h-3 transition-transform", showBench && "rotate-180")} viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            {showBench && benchPlayers.map((b) => (
                              <BatterRow
                                key={b.player_id}
                                batter={b}
                                pitcher={pitcher!}
                                expanded={expandedBatterId === b.player_id}
                                onToggle={() => setExpandedBatterId(expandedBatterId === b.player_id ? null : b.player_id)}
                                isMobile
                                viewMode={viewMode}
                                displayStats={(pitchFilters.length > 0 || handFilter !== "all") ? getBatterStats(b) : undefined}
                                pitchFilter={pitchFilters[0] ?? null}
                                gameId={selectedGameId}
                              />
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-neutral-50/50 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-800/50 overflow-x-auto shadow-sm">
                        <table className="w-full border-separate border-spacing-0">
                          <thead>
                            {/* Lineup status row */}
                            {!matchupLoading && batters.length > 0 && (
                              <tr>
                                <th colSpan={13} className="px-4 py-2 bg-white dark:bg-neutral-900 border-b border-neutral-200/40 dark:border-neutral-800/40">
                                  <div className="flex items-center justify-between">
                                    <span className={cn(
                                      "inline-flex items-center gap-1.5 text-[10px] font-semibold",
                                      isLineupConfirmed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                    )}>
                                      {isLineupConfirmed ? (
                                        <>
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          Confirmed
                                        </>
                                      ) : (
                                        <>
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                          Projected
                                        </>
                                      )}
                                    </span>
                                    <button
                                      onClick={() => refetch()}
                                      disabled={isFetching}
                                      className="text-[10px] font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
                                    >
                                      <svg className={cn("w-2.5 h-2.5", isFetching && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                                      {isFetching ? "..." : "Refresh"}
                                    </button>
                                  </div>
                                </th>
                              </tr>
                            )}
                            {(() => {
                              const sThCls = "px-1.5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 text-center cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors select-none whitespace-nowrap";
                              return (
                                <tr className="bg-white dark:bg-neutral-900/60 border-b border-neutral-200/60 dark:border-neutral-700/20">
                                  <th className={cn(sThCls, "text-center pl-3 pr-1 w-8")} onClick={() => handleStdSort("lineup")}>#</th>
                                  <th className={cn(sThCls, "text-left px-2")}>Batter</th>
                                  <th className={sThCls} onClick={() => handleStdSort("ba")}>BA{stdSortIcon("ba")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("hr")}>HR{stdSortIcon("hr")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("slg")}>SLG{stdSortIcon("slg")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("iso")}>ISO{stdSortIcon("iso")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("ev")}>EV{stdSortIcon("ev")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("brl")}>BRL%{stdSortIcon("brl")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("woba")}>wOBA{stdSortIcon("woba")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("k_pct")}>K%{stdSortIcon("k_pct")}</th>
                                  <th className={sThCls} onClick={() => handleStdSort("bb_pct")}>BB%{stdSortIcon("bb_pct")}</th>
                                  {/* Odds column header — clickable dropdown */}
                                  <th ref={oddsMenuRef} className="px-1.5 py-2 text-right relative">
                                    <button
                                      onClick={() => setOddsMenuOpen(!oddsMenuOpen)}
                                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-sky-500 hover:text-sky-400 transition-colors select-none"
                                    >
                                      {oddsSide === "under" ? "U" : ""}{ODDS_MARKETS.find(m => m.key === oddsMarket)?.shortLabel || "Odds"}
                                      {oddsLine !== 0.5 && <span className="text-neutral-400 font-normal">{oddsLine}</span>}
                                      <ChevronDown className="w-2.5 h-2.5" />
                                    </button>
                                    {oddsMenuOpen && (
                                      <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl py-1">
                                        {/* Over/Under toggle */}
                                        <div className="flex items-center gap-0.5 mx-2 mb-1 p-0.5 bg-neutral-100 dark:bg-neutral-700/50 rounded-md">
                                          <button
                                            onClick={() => setOddsSide("over")}
                                            className={cn(
                                              "flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-all",
                                              oddsSide === "over" ? "bg-white dark:bg-neutral-600 text-[#22C55E] shadow-sm" : "text-neutral-500"
                                            )}
                                          >Over</button>
                                          <button
                                            onClick={() => setOddsSide("under")}
                                            className={cn(
                                              "flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-all",
                                              oddsSide === "under" ? "bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-500"
                                            )}
                                          >Under</button>
                                        </div>
                                        <div className="border-t border-neutral-100 dark:border-neutral-700/50 mt-1 pt-1">
                                        {ODDS_MARKETS.map((m) => {
                                          const lines = ODDS_LINE_OPTIONS[m.key] || [0.5];
                                          return (
                                            <div key={m.key}>
                                              {lines.map((ln) => (
                                                <button
                                                  key={`${m.key}-${ln}`}
                                                  onClick={() => { setOddsMarket(m.key); setOddsLine(ln); setOddsMenuOpen(false); }}
                                                  className={cn(
                                                    "w-full text-left px-3 py-1.5 text-xs font-medium transition-colors",
                                                    oddsMarket === m.key && oddsLine === ln
                                                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                                      : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                                                  )}
                                                >
                                                  {m.label} {ln !== 0.5 ? `${oddsSide === "over" ? "O" : "U"} ${ln}` : ""}
                                                </button>
                                              ))}
                                            </div>
                                          );
                                        })}
                                        </div>
                                      </div>
                                    )}
                                  </th>
                                  <th className="w-8" />
                                </tr>
                              );
                            })()}
                          </thead>
                          <tbody>
                            {displayBatters.map((b) => (
                              <BatterRow
                                key={b.player_id}
                                batter={b}
                                pitcher={pitcher!}
                                expanded={expandedBatterId === b.player_id}
                                onToggle={() => setExpandedBatterId(expandedBatterId === b.player_id ? null : b.player_id)}
                                isMobile={false}
                                viewMode={viewMode}
                                displayStats={(pitchFilters.length > 0 || handFilter !== "all") ? getBatterStats(b) : undefined}
                                pitchFilter={pitchFilters[0] ?? null}
                                oddsEntry={findPlayerOdds(batterOdds, b.player_name)}
                                hasSharpAccess={hasSharpAccess}
                                oddsLoading={oddsFetching}
                                gameId={selectedGameId}
                              />
                            ))}
                            {/* Bench expand row */}
                            {hasLineup && benchPlayers.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan={13} className="px-3 py-0">
                                    <button
                                      onClick={() => setShowBench(!showBench)}
                                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                    >
                                      {showBench ? "Hide Bench" : `Show Bench (${benchPlayers.length})`}
                                      <svg className={cn("w-3 h-3 transition-transform", showBench && "rotate-180")} viewBox="0 0 12 12" fill="none">
                                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                                {showBench && benchPlayers.map((b) => (
                                  <BatterRow
                                    key={b.player_id}
                                    batter={b}
                                    pitcher={pitcher!}
                                    expanded={expandedBatterId === b.player_id}
                                    onToggle={() => setExpandedBatterId(expandedBatterId === b.player_id ? null : b.player_id)}
                                    isMobile={false}
                                    viewMode={viewMode}
                                    displayStats={(pitchFilters.length > 0 || handFilter !== "all") ? getBatterStats(b) : undefined}
                                    pitchFilter={pitchFilters[0] ?? null}
                                    oddsEntry={findPlayerOdds(batterOdds, b.player_name)}
                                    hasSharpAccess={hasSharpAccess}
                                    oddsLoading={oddsFetching}
                                    gameId={selectedGameId}
                                  />
                                ))}
                              </>
                            )}
                          </tbody>
                          {lineupTotals && (
                            <tfoot>
                              {([
                                { label: "All", data: lineupTotals.all, extra: `${lineupTotals.lhb}L / ${lineupTotals.rhb}R`, isFirst: true },
                                { label: `Lefties (${lineupTotals.lhb})`, data: lineupTotals.lefties, extra: null, isFirst: false },
                                { label: `Righties (${lineupTotals.rhb})`, data: lineupTotals.righties, extra: null, isFirst: false },
                              ] as const).map((row) => row.data && (
                                <tr key={row.label} className={cn(
                                  "bg-neutral-100/60 dark:bg-neutral-800/40",
                                  row.isFirst ? "border-t-2 border-neutral-300 dark:border-neutral-600" : "border-t border-neutral-200 dark:border-neutral-700"
                                )}>
                                  <td className="pl-3 pr-1 py-1.5" />
                                  <td className={cn("px-2 py-1.5 text-xs text-neutral-900 dark:text-white", row.isFirst ? "font-bold" : "font-medium text-neutral-600 dark:text-neutral-400")}>
                                    {row.label}
                                    {row.extra && <span className="text-[10px] font-normal text-neutral-400 ml-1">{row.extra}</span>}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", baaColor(row.data.avg))}>
                                    {row.data.avg != null ? fmtAvg(row.data.avg) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold text-neutral-900 dark:text-white" : "font-medium text-neutral-600 dark:text-neutral-400")}>
                                    {row.data.hr}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", slgColor(row.data.slg))}>
                                    {row.data.slg != null ? fmtAvg(row.data.slg) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", isoColor(row.data.iso))}>
                                    {row.data.iso != null ? fmtAvg(row.data.iso) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", evColor(row.data.ev))}>
                                    {row.data.ev != null ? row.data.ev.toFixed(1) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", barrelColor(row.data.brl))}>
                                    {row.data.brl != null ? `${row.data.brl.toFixed(1)}%` : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", wobaColor(row.data.woba))}>
                                    {row.data.woba != null ? fmtAvg(row.data.woba) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", kPctColor(row.data.k_pct ?? null))}>
                                    {row.data.k_pct != null ? `${row.data.k_pct.toFixed(1)}%` : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-center tabular-nums", row.isFirst ? "font-bold" : "font-medium", bbPctColor(row.data.bb_pct ?? null))}>
                                    {row.data.bb_pct != null ? `${row.data.bb_pct.toFixed(1)}%` : "-"}
                                  </td>
                                  <td />
                                </tr>
                              ))}
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )
                  ) : !matchupLoading ? (
                    <div className="text-center py-8 text-sm text-neutral-500">
                      <Users className="w-6 h-6 mx-auto mb-2 text-neutral-400" />
                      <p>No lineup data available for this game</p>
                      <p className="text-xs text-neutral-400 mt-1">Lineups typically post 2-4 hours before game time</p>
                    </div>
                  ) : null}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}

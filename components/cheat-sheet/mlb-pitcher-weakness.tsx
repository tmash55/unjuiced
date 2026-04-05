"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbGames } from "@/hooks/use-mlb-games";
import type { MlbGame } from "@/hooks/use-mlb-games";
import {
  useMlbPitcherWeakness,
  type PitcherData,
  type BattingOrderSplit,
  type InningSplit,
  type LineupBatter,
  type GameInfo,
} from "@/hooks/use-mlb-pitcher-weakness";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { Loader2, ChevronRight, AlertTriangle, Users, ChevronDown, Zap, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { useStateLink } from "@/hooks/use-state-link";

// ── Row Color System (Bettor Perspective) ───────────────────────────────────

// Pitcher rows: green = pitcher is WEAK (opportunity for bettor)
// Subtle left border accent + light tint — cell-level colors do the heavy lifting
const ROW_PITCHER_DEEP_GREEN = "bg-emerald-50/80 dark:bg-emerald-500/[0.08] border-l-2 border-l-emerald-500";
const ROW_PITCHER_LIGHT_GREEN = "bg-emerald-50/40 dark:bg-emerald-500/[0.04] border-l-2 border-l-emerald-500/50";
const ROW_PITCHER_NEUTRAL = "";
const ROW_PITCHER_LIGHT_RED = "bg-red-50/40 dark:bg-red-500/[0.04] border-l-2 border-l-red-500/50";
const ROW_PITCHER_DEEP_RED = "bg-red-50/80 dark:bg-red-500/[0.08] border-l-2 border-l-red-500";

// Batter rows: green = batter is STRONG (opportunity for bettor)
const ROW_BATTER_DEEP_GREEN = "bg-emerald-50/80 dark:bg-emerald-500/[0.08] border-l-2 border-l-emerald-500";
const ROW_BATTER_LIGHT_GREEN = "bg-emerald-50/40 dark:bg-emerald-500/[0.04] border-l-2 border-l-emerald-500/50";
const ROW_BATTER_NEUTRAL = "";
const ROW_BATTER_LIGHT_RED = "bg-red-50/40 dark:bg-red-500/[0.04] border-l-2 border-l-red-500/50";
const ROW_BATTER_DEEP_RED = "bg-red-50/80 dark:bg-red-500/[0.08] border-l-2 border-l-red-500";

function getPitcherRowColor(slg: number | null): string {
  if (slg == null) return ROW_PITCHER_NEUTRAL;
  if (slg >= 0.550) return ROW_PITCHER_DEEP_GREEN;   // truly hittable
  if (slg >= 0.440) return ROW_PITCHER_LIGHT_GREEN;   // hittable — matches competitor threshold
  if (slg < 0.150) return ROW_PITCHER_DEEP_RED;        // dominant
  if (slg < 0.250) return ROW_PITCHER_LIGHT_RED;       // tough spot
  return ROW_PITCHER_NEUTRAL;                           // .250-.439 = neutral
}

function isPitcherRowGreen(slg: number | null): boolean {
  return slg != null && slg >= 0.440;
}

function getBatterRowColor(slg: number | null): string {
  if (slg == null) return ROW_BATTER_NEUTRAL;
  if (slg >= 0.600) return ROW_BATTER_DEEP_GREEN;     // elite matchup
  if (slg >= 0.500) return ROW_BATTER_LIGHT_GREEN;     // strong matchup
  if (slg < 0.200) return ROW_BATTER_DEEP_RED;         // overmatched
  if (slg < 0.300) return ROW_BATTER_LIGHT_RED;        // tough matchup
  return ROW_BATTER_NEUTRAL;                            // .300-.499 = neutral
}

function isBatterRowGreen(slg: number | null): boolean {
  return slg != null && slg >= 0.500;
}

// ── Vivid cell color helpers ─────────────────────────────────────────────────

function statCellColor(val: number | null, thresholds: { elite: number; good: number; poor: number; bad: number }, higherIsGood = true): string {
  if (val == null) return "text-neutral-600 dark:text-neutral-400";
  if (higherIsGood) {
    if (val >= thresholds.elite) return "bg-emerald-100 dark:bg-emerald-500/45 text-emerald-800 dark:text-white font-bold";
    if (val >= thresholds.good) return "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (val <= thresholds.bad) return "bg-red-100 dark:bg-red-500/45 text-red-800 dark:text-white font-bold";
    if (val <= thresholds.poor) return "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300";
  } else {
    if (val <= thresholds.elite) return "bg-emerald-100 dark:bg-emerald-500/45 text-emerald-800 dark:text-white font-bold";
    if (val <= thresholds.good) return "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (val >= thresholds.bad) return "bg-red-100 dark:bg-red-500/45 text-red-800 dark:text-white font-bold";
    if (val >= thresholds.poor) return "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300";
  }
  return "text-neutral-700 dark:text-neutral-300";
}

// Pitcher perspective: high SLG/AVG against = green (weak pitcher = opportunity)
function pitcherAvgCell(val: number | null) { return statCellColor(val, { elite: 0.300, good: 0.260, poor: 0.210, bad: 0.180 }); }
function pitcherSlgCell(val: number | null) { return statCellColor(val, { elite: 0.500, good: 0.400, poor: 0.300, bad: 0.250 }); }
function pitcherOpsCell(val: number | null) { return statCellColor(val, { elite: 0.850, good: 0.750, poor: 0.650, bad: 0.600 }); }
function pitcherKPctCell(val: number | null) { return statCellColor(val, { elite: 15, good: 20, poor: 27, bad: 32 }, false); } // lower K% = opportunity
function pitcherBBPctCell(val: number | null) { return statCellColor(val, { elite: 12, good: 9, poor: 5, bad: 3 }); }

// Batter perspective: high SLG/AVG = green (strong batter = opportunity)
function batterAvgCell(val: number | null) { return statCellColor(val, { elite: 0.300, good: 0.260, poor: 0.210, bad: 0.180 }); }
function batterSlgCell(val: number | null) { return statCellColor(val, { elite: 0.500, good: 0.400, poor: 0.300, bad: 0.250 }); }
function batterOpsCell(val: number | null) { return statCellColor(val, { elite: 0.850, good: 0.750, poor: 0.650, bad: 0.600 }); }
function batterKPctCell(val: number | null) { return statCellColor(val, { elite: 15, good: 20, poor: 27, bad: 32 }, false); }

// Legacy per-cell helpers (still used in heatmap)
const CELL_NEUTRAL = "text-neutral-700 dark:text-neutral-300";

type HeatmapStat = "ops" | "whip" | "avg" | "k_pct" | "bb_pct" | "iso";

const HEATMAP_STAT_OPTIONS: { label: string; value: HeatmapStat }[] = [
  { label: "OPS", value: "ops" },
  { label: "WHIP", value: "whip" },
  { label: "AVG", value: "avg" },
  { label: "ISO", value: "iso" },
  { label: "K%", value: "k_pct" },
  { label: "BB%", value: "bb_pct" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(normalizeSportsbookId(bookId));
  return sb?.image?.square ?? sb?.image?.light ?? null;
}

function formatOddsPrice(price: number): string {
  return price >= 0 ? `+${price}` : `${price}`;
}

function getPreferredLink(desktopLink?: string | null, mobileLink?: string | null): string | null {
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? (mobileLink || desktopLink || null) : (desktopLink || mobileLink || null);
}

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

function fmtAvg(val: number | null): string {
  if (val == null) return "-";
  return val >= 1 ? val.toFixed(3) : `.${Math.round(val * 1000).toString().padStart(3, "0")}`;
}

function fmtStat(val: number | null, digits = 2): string {
  if (val == null) return "-";
  return val.toFixed(digits);
}

function fmtPct(val: number | null, digits = 1): string {
  if (val == null) return "-";
  return `${val.toFixed(digits)}%`;
}

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "";
  if (pf >= 110) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (pf >= 103) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (pf <= 90) return "text-[#FC1414] dark:text-[#F87171]";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "";
}

/** Returns Tailwind classes for inning heatmap cells — vivid emerald/red system */
function heatmapClasses(val: number | null, stat: HeatmapStat): string {
  if (val == null) return "";

  let pct: number;
  switch (stat) {
    case "ops":
      pct = Math.max(0, Math.min(1, (val - 0.550) / (0.900 - 0.550)));
      break;
    case "whip":
      pct = Math.max(0, Math.min(1, (val - 0.80) / (1.80 - 0.80)));
      break;
    case "avg":
      pct = Math.max(0, Math.min(1, (val - 0.150) / (0.320 - 0.150)));
      break;
    case "iso":
      pct = Math.max(0, Math.min(1, (val - 0.050) / (0.250 - 0.050)));
      break;
    case "k_pct":
      pct = Math.max(0, Math.min(1, 1 - (val - 12) / (35 - 12)));
      break;
    case "bb_pct":
      pct = Math.max(0, Math.min(1, (val - 3) / (15 - 3)));
      break;
    default:
      pct = 0.5;
  }

  // 5-tier: strong green → light green → neutral → light red → strong red
  // From bettor perspective: high pct = pitcher vulnerable = green
  if (pct >= 0.75) return "bg-emerald-500/60 dark:bg-emerald-500/50 text-white font-bold";
  if (pct >= 0.55) return "bg-emerald-500/35 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200";
  if (pct <= 0.25) return "bg-red-500/50 dark:bg-red-500/45 text-white font-bold";
  if (pct <= 0.45) return "bg-red-500/25 dark:bg-red-500/20 text-red-800 dark:text-red-300";
  return "bg-neutral-200/50 dark:bg-neutral-700/30 text-neutral-700 dark:text-neutral-300";
}

function formatHeatmapVal(val: number | null, stat: HeatmapStat): string {
  if (val == null) return "-";
  switch (stat) {
    case "ops": return fmtAvg(val);
    case "avg": return fmtAvg(val);
    case "iso": return fmtAvg(val);
    case "whip": return fmtStat(val, 2);
    case "k_pct": return fmtPct(val, 0);
    case "bb_pct": return fmtPct(val, 0);
  }
}

function getInningStatVal(inning: InningSplit, stat: HeatmapStat): number | null {
  switch (stat) {
    case "ops": return inning.ops;
    case "avg": return inning.avg;
    case "iso": return inning.iso;
    case "whip": return inning.whip;
    case "k_pct": return inning.k_pct;
    case "bb_pct": return inning.bb_pct;
  }
}

function computeISO(slg: number | null, avg: number | null): number | null {
  if (slg == null || avg == null) return null;
  return slg - avg;
}

function computeHitsAB(avg: number | null, pa: number): string {
  if (avg == null || pa === 0) return "-";
  // Approximate AB from PA (rough — no walk data available)
  const ab = Math.round(pa * 0.9);
  const hits = Math.round(avg * ab);
  return `${hits}-${ab}`;
}

// Spot label from batting order number
function spotLabel(order: number): string {
  const labels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  return labels[order - 1] || `${order}th`;
}

// ── Game Selector (Mobile) ────────────────────────────────────────────────────

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

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
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

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800/50 max-h-[280px] overflow-y-auto">
          {games.map((g) => {
            const isSelected = Number(g.game_id) === selectedGameId;
            return (
              <button
                key={g.game_id}
                onClick={() => { onSelect(Number(g.game_id)); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                  isSelected ? "bg-brand/5 dark:bg-brand/10" : "active:bg-neutral-50 dark:active:bg-neutral-800/50"
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
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Desktop Game Strip ────────────────────────────────────────────────────────

function DesktopGameStrip({
  games,
  selectedGameId,
  onSelect,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600"
      >
        {games.map((g) => {
          const id = Number(g.game_id);
          const isSelected = id === selectedGameId;
          return (
            <button
              key={g.game_id}
              onClick={() => onSelect(id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                isSelected
                  ? "border-brand bg-brand/5 dark:bg-brand/10 ring-1 ring-brand/30"
                  : "border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
              )}
            >
              <div className="flex items-center gap-1.5">
                <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                  {g.away_team_tricode} @ {g.home_team_tricode}
                </span>
                <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
              </div>
              <div className="flex flex-col items-end text-[10px] text-neutral-500">
                <span className="whitespace-nowrap">
                  {lastNameOnly(g.away_probable_pitcher)} vs {lastNameOnly(g.home_probable_pitcher)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums">{g.game_status}</span>
                  {g.park_factor != null && (
                    <span className={cn("font-semibold tabular-nums", parkFactorColor(g.park_factor))}>
                      PF {g.park_factor}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Header Bar ────────────────────────────────────────────────────────────────

function GameHeaderBar({ game, gameTime }: { game: GameInfo; gameTime: string }) {
  const fdLogo = getBookLogo("fanduel");

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Left: teams & venue */}
        <div className="flex items-center gap-2.5">
          <img
            src={`/team-logos/mlb/${game.away_team_abbr.toUpperCase()}.svg`}
            className="w-6 h-6 object-contain"
            alt={game.away_team_abbr}
          />
          <span className="text-sm font-bold text-neutral-900 dark:text-white">
            {game.away_team_abbr} @ {game.home_team_abbr}
          </span>
          <img
            src={`/team-logos/mlb/${game.home_team_abbr.toUpperCase()}.svg`}
            className="w-6 h-6 object-contain"
            alt={game.home_team_abbr}
          />
          {game.venue_name && (
            <span className="text-[11px] text-neutral-500 hidden md:inline">{game.venue_name}</span>
          )}
        </div>

        {/* Right: weather + odds + time */}
        <div className="flex items-center gap-3 text-[11px] text-neutral-600 dark:text-neutral-400 flex-wrap">
          {game.weather && (
            <div className="flex items-center gap-1.5">
              {game.weather.temperature_f != null && (
                <span className="font-medium">{game.weather.temperature_f}°F</span>
              )}
              {game.weather.wind_speed_mph != null && game.weather.wind_speed_mph > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="font-medium">{game.weather.wind_speed_mph}mph</span>
                  {game.weather.wind_impact && (
                    <span className={cn(
                      "font-semibold",
                      game.weather.wind_impact === "Blowing Out" ? "text-emerald-600 dark:text-emerald-400" :
                      game.weather.wind_impact === "Blowing In" ? "text-red-500 dark:text-red-400" :
                      "text-neutral-400"
                    )}>
                      {game.weather.wind_impact === "Blowing Out" ? "Out" :
                       game.weather.wind_impact === "Blowing In" ? "In" :
                       game.weather.wind_label?.split(" ").pop() || ""}
                    </span>
                  )}
                </span>
              )}
              {game.weather.roof_type && game.weather.roof_type !== "Open" && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  {game.weather.roof_type}
                </span>
              )}
            </div>
          )}

          {game.odds && (
            <div className="flex items-center gap-2">
              {fdLogo && (
                <img src={fdLogo} alt="FanDuel" className="h-4 w-4 rounded object-contain" />
              )}
              {game.odds.away_ml && game.odds.home_ml && (
                <span className="tabular-nums font-mono text-[11px]">
                  <span className="font-medium">{game.odds.away_ml}</span>
                  <span className="text-neutral-400 mx-0.5">/</span>
                  <span className="font-medium">{game.odds.home_ml}</span>
                </span>
              )}
              {game.odds.total != null && (
                <span className="tabular-nums font-mono text-[11px]">
                  O/U <span className="font-medium">{game.odds.total}</span>
                </span>
              )}
            </div>
          )}

          <span className="font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
            {gameTime} ET
          </span>
        </div>
      </div>

      {game.venue_name && (
        <div className="text-[10px] text-neutral-500 mt-1 md:hidden">{game.venue_name}</div>
      )}
    </div>
  );
}

// ── Pitcher Header (compact, for matchup card) ──────────────────────────────

function PitcherHeader({ pitcher }: { pitcher: PitcherData }) {
  const h = pitcher.headline;
  return (
    <div className="flex items-center gap-2.5 p-3">
      <img
        src={getMlbHeadshotUrl(pitcher.player_id, "small")}
        alt={pitcher.name}
        className="w-10 h-10 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">{pitcher.name}</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
            pitcher.hand === "L"
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
          )}>
            {pitcher.hand}HP
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-neutral-500">{pitcher.team_abbr}</span>
          <span className="text-[10px] text-neutral-500 tabular-nums">
            {h.wins}-{h.losses} &middot; {fmtStat(h.era)} ERA &middot; {fmtStat(h.ip, 1)} IP
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Lineup Header ───────────────────────────────────────────────────────────

function LineupHeader({
  teamAbbr,
  isConfirmed,
}: {
  teamAbbr: string;
  isConfirmed: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 p-3">
      <img
        src={`/team-logos/mlb/${teamAbbr.toUpperCase()}.svg`}
        className="w-8 h-8 object-contain"
        alt={teamAbbr}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-neutral-900 dark:text-white">{teamAbbr} Lineup</span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none",
            isConfirmed
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          )}>
            {isConfirmed ? "Confirmed" : "Projected"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Pitcher Splits Table (left column of matchup card) ─────────────────────

function PitcherSplitsTable({
  splits,
  isMobile,
}: {
  splits: BattingOrderSplit[];
  isMobile: boolean;
}) {
  const sorted = useMemo(
    () => [...splits].sort((a, b) => {
      const slotA = parseInt(a.slot.replace("b", ""));
      const slotB = parseInt(b.slot.replace("b", ""));
      return slotA - slotB;
    }),
    [splits]
  );

  // Pad to 9 rows if needed
  const rows = useMemo(() => {
    const padded: (BattingOrderSplit | null)[] = [];
    for (let i = 1; i <= 9; i++) {
      const found = sorted.find((s) => s.slot === `b${i}`);
      padded.push(found ?? null);
    }
    return padded;
  }, [sorted]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-neutral-100 dark:border-neutral-800/50 text-[10px] uppercase tracking-wider text-neutral-400">
            <th className="py-1.5 px-2 text-left font-medium w-10">Spot</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">IP</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">AVG</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">OBP</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">SLG</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">OPS</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">ISO</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">HR</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">2B</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">3B</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">RBI</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">K%</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">BB%</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">PA</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, idx) => {
            const spot = idx + 1;
            const slg = s?.slg ?? null;
            const rowColor = getPitcherRowColor(slg);
            const lowSample = s != null && s.pa < 15;

            return (
              <tr
                key={`pitcher-spot-${spot}`}
                className={cn(
                  "border-b border-neutral-50 dark:border-neutral-800/30 transition-colors h-9",
                  rowColor
                )}
              >
                <td className="py-1.5 px-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                  {s?.slot_label ?? spotLabel(spot)}
                  {lowSample && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-0.5 text-amber-500 cursor-help">&#9888;</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-[10px]">
                          Small sample: {s?.pa} PA
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-600 dark:text-neutral-400">
                    {s ? fmtStat(s.ip, 1) : "-"}
                  </td>
                )}
                <td className={cn("py-1.5 px-1.5 text-center", pitcherAvgCell(s?.avg ?? null))}>
                  {s ? fmtAvg(s.avg) : "-"}
                </td>
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                    {s ? fmtAvg(s.obp) : "-"}
                  </td>
                )}
                <td className={cn("py-1.5 px-1.5 text-center", pitcherSlgCell(s?.slg ?? null))}>
                  {s ? fmtAvg(s.slg) : "-"}
                </td>
                {!isMobile && (
                  <td className={cn("py-1.5 px-1.5 text-center", pitcherOpsCell(s?.ops ?? null))}>
                    {s ? fmtAvg(s.ops) : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                    {s ? fmtAvg(s.iso) : "-"}
                  </td>
                )}
                <td className="py-1.5 px-1.5 text-center font-medium text-neutral-800 dark:text-neutral-200">
                  {s ? s.hr : "-"}
                </td>
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                    {s ? s.doubles : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                    {s ? s.triples : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                    {s ? s.rbi : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className={cn("py-1.5 px-1.5 text-center", pitcherKPctCell(s?.k_pct ?? null))}>
                    {s ? fmtPct(s.k_pct, 0) : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className={cn("py-1.5 px-1.5 text-center", pitcherBBPctCell(s?.bb_pct ?? null))}>
                    {s ? fmtPct(s.bb_pct, 0) : "-"}
                  </td>
                )}
                {!isMobile && (
                  <td className="py-1.5 px-1.5 text-center text-neutral-400">
                    {s ? s.pa : "-"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Batter Lineup Table (right column of matchup card) ─────────────────────

function BatterLineupTable({
  lineup,
  isMobile,
  expandedBatterId,
  onToggleBatter,
}: {
  lineup: LineupBatter[];
  isMobile: boolean;
  expandedBatterId: number | null;
  onToggleBatter: (id: number) => void;
}) {
  const applyState = useStateLink();
  // Track which batting order spot each batter is viewing (default: their actual spot)
  const [selectedSpots, setSelectedSpots] = useState<Record<number, string>>({});
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (openDropdownId == null) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdownId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  const sorted = useMemo(
    () => [...lineup].sort((a, b) => a.batting_order - b.batting_order),
    [lineup]
  );

  // Pad to 9 rows
  const rows = useMemo(() => {
    const padded: (LineupBatter | null)[] = [];
    for (let i = 1; i <= 9; i++) {
      const found = sorted.find((b) => b.batting_order === i);
      padded.push(found ?? null);
    }
    return padded;
  }, [sorted]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-neutral-100 dark:border-neutral-800/50 text-[10px] uppercase tracking-wider text-neutral-400">
            <th className="py-1.5 px-1 text-center font-medium w-6">#</th>
            <th className="py-1.5 px-1.5 text-left font-medium">Player</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">Split</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">H-AB</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">AVG</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">OBP</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">SLG</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">OPS</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">ISO</th>}
            <th className="py-1.5 px-1.5 text-center font-medium">HR</th>
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">2B</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">3B</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">RBI</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">K%</th>}
            {!isMobile && <th className="py-1.5 px-1.5 text-center font-medium">BB%</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((b, idx) => {
            const spot = idx + 1;
            // Use selected spot override if set, otherwise default to current spot
            const activeSpotCode = b ? (selectedSpots[b.player_id] || `b${b.batting_order}`) : `b${spot}`;
            const activeStats = b ? (b.all_spot_stats?.[activeSpotCode] ?? b.spot_stats) : null;
            const slg = activeStats?.slg ?? null;
            const rowColor = getBatterRowColor(slg);
            const isExpanded = b != null && expandedBatterId === b.player_id;

            return (
              <React.Fragment key={`batter-spot-${spot}`}>
                <tr
                  className={cn(
                    "border-b border-neutral-50 dark:border-neutral-800/30 transition-colors h-9",
                    rowColor,
                    b != null && "cursor-pointer hover:bg-neutral-50/30 dark:hover:bg-neutral-800/10"
                  )}
                  onClick={() => b && onToggleBatter(b.player_id)}
                >
                  <td className="py-1.5 px-1 text-center font-semibold text-neutral-400">
                    {spot}
                  </td>
                  <td className="py-1.5 px-1.5 text-left">
                    {b ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={getMlbHeadshotUrl(b.player_id, "small")}
                          alt={b.player_name}
                          className="w-6 h-6 rounded-full object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0"
                        />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[100px]">
                          {isMobile ? lastNameOnly(b.player_name) : b.player_name}
                        </span>
                        <span className={cn(
                          "text-[8px] font-bold px-1 py-0.5 rounded leading-none shrink-0",
                          b.bats === "L"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                            : b.bats === "S"
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                              : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                        )}>
                          {b.bats === "S" ? "SW" : b.bats}
                        </span>
                        {b.l7_trend === "hot" && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 leading-none shrink-0">HOT</span>
                        )}
                        {b.l7_trend === "cold" && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 leading-none shrink-0">COLD</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  {!isMobile && (
                    <td className="py-1 px-1 text-center relative" onClick={(e) => e.stopPropagation()}>
                      {b && b.all_spot_stats && Object.keys(b.all_spot_stats).length > 0 ? (
                        <div ref={openDropdownId === b.player_id ? dropdownRef : undefined} className="relative inline-block">
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === b.player_id ? null : b.player_id)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                              "border border-neutral-200/50 dark:border-neutral-700/30",
                              "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
                              openDropdownId === b.player_id
                                ? "bg-neutral-50 dark:bg-neutral-800/50 ring-1 ring-brand/20"
                                : "bg-white dark:bg-neutral-900/60"
                            )}
                          >
                            <span className="text-neutral-700 dark:text-neutral-300">
                              {spotLabel(parseInt(activeSpotCode.replace("b", "")))}
                            </span>
                            <span className="text-neutral-400 text-[9px]">
                              ({(b.all_spot_stats[activeSpotCode]?.pa ?? 0)} PA)
                            </span>
                            <ChevronDown className={cn("w-2.5 h-2.5 text-neutral-400 transition-transform", openDropdownId === b.player_id && "rotate-180")} />
                          </button>
                          {openDropdownId === b.player_id && (
                            <div className="absolute left-0 top-full mt-1 z-50 w-40 rounded-lg border border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
                              <div className="py-1">
                                {Array.from({ length: 9 }, (_, i) => {
                                  const code = `b${i + 1}`;
                                  const stats = b.all_spot_stats[code];
                                  const pa = stats?.pa ?? 0;
                                  const isCurrent = i + 1 === b.batting_order;
                                  const isSelected = code === activeSpotCode;
                                  return (
                                    <button
                                      key={code}
                                      onClick={() => {
                                        setSelectedSpots((prev) => ({ ...prev, [b.player_id]: code }));
                                        setOpenDropdownId(null);
                                      }}
                                      className={cn(
                                        "w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors",
                                        isSelected
                                          ? "bg-brand/8 text-brand font-semibold"
                                          : pa > 0
                                            ? "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                                            : "text-neutral-400 dark:text-neutral-600"
                                      )}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span className={cn("w-4 text-right tabular-nums", isSelected && "font-bold")}>{spotLabel(i + 1)}</span>
                                        {isCurrent && <span className="text-[8px] text-amber-500">★</span>}
                                      </span>
                                      <span className={cn("tabular-nums", pa > 0 ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-300 dark:text-neutral-700")}>
                                        {pa > 0 ? `${pa} PA` : "—"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-500">{b ? `Batting ${spotLabel(b.batting_order)}` : "-"}</span>
                      )}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-600 dark:text-neutral-400">
                      {activeStats && activeStats.avg != null && activeStats.pa > 0 ? (() => {
                        const ab = Math.round(activeStats.pa * 0.9);
                        const h = Math.round((activeStats.avg ?? 0) * ab);
                        return `${h}-${ab}`;
                      })() : "-"}
                    </td>
                  )}
                  <td className={cn("py-1.5 px-1.5 text-center", batterAvgCell(activeStats?.avg ?? null))}>
                    {activeStats ? fmtAvg(activeStats.avg) : "-"}
                  </td>
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats ? fmtAvg(activeStats.obp) : "-"}
                    </td>
                  )}
                  <td className={cn("py-1.5 px-1.5 text-center", batterSlgCell(activeStats?.slg ?? null))}>
                    {activeStats ? fmtAvg(activeStats.slg) : "-"}
                  </td>
                  {!isMobile && (
                    <td className={cn("py-1.5 px-1.5 text-center", batterOpsCell(activeStats?.ops ?? null))}>
                      {activeStats ? fmtAvg(activeStats.ops) : "-"}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats ? fmtAvg(activeStats.iso) : "-"}
                    </td>
                  )}
                  <td className="py-1.5 px-1.5 text-center font-medium text-neutral-800 dark:text-neutral-200">
                    {activeStats ? activeStats.hr : "-"}
                  </td>
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats ? activeStats.doubles : "-"}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats ? activeStats.triples : "-"}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats ? activeStats.rbi : "-"}
                    </td>
                  )}
                  {!isMobile && (
                    <td className={cn("py-1.5 px-1.5 text-center", batterKPctCell(activeStats?.k_pct ?? null))}>
                      {activeStats?.k_pct != null ? `${activeStats.k_pct.toFixed(1)}%` : "-"}
                    </td>
                  )}
                  {!isMobile && (
                    <td className="py-1.5 px-1.5 text-center text-neutral-700 dark:text-neutral-300">
                      {activeStats?.bb_pct != null ? `${activeStats.bb_pct.toFixed(1)}%` : "-"}
                    </td>
                  )}
                </tr>
                {/* Expanded batter detail */}
                {isExpanded && b && (
                  <tr>
                    <td colSpan={isMobile ? 5 : 16} className="p-0">
                      <BatterExpandedDetail batter={b} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Batter Expanded Detail ──────────────────────────────────────────────────

function BatterExpandedDetail({ batter }: { batter: LineupBatter }) {
  const applyState = useStateLink();

  return (
    <div className="border-t border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-800/20 px-3 py-2.5 space-y-2">
      {/* Season stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-neutral-400">Season OPS</div>
          <div className="text-xs font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{fmtAvg(batter.season_ops)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-neutral-400">Season AVG</div>
          <div className="text-xs font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{fmtAvg(batter.season_avg)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-neutral-400">Season SLG</div>
          <div className="text-xs font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{fmtAvg(batter.season_slg)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-neutral-400">Season HR</div>
          <div className="text-xs font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{batter.season_hr}</div>
        </div>
      </div>

      {/* BvP */}
      {batter.bvp && batter.bvp.pa > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800/30">
          <span className="uppercase tracking-wider font-semibold text-neutral-400">BvP</span>
          <span className="tabular-nums">{batter.bvp.pa} PA</span>
          <span className="tabular-nums">AVG {fmtAvg(batter.bvp.avg)}</span>
          <span className="tabular-nums">{batter.bvp.hr} HR</span>
        </div>
      )}

      {/* Odds row */}
      <div className="flex items-center gap-4 pt-1 border-t border-neutral-100 dark:border-neutral-800/30">
        <OddsBadge label="HR" odds={batter.odds.hr} />
        <OddsBadge label="Hits" odds={batter.odds.hits} />
        <OddsBadge label="Ks" odds={batter.odds.strikeouts} />
      </div>
    </div>
  );
}

// ── Odds Badge ─────────────────────────────────────────────────────────────

function OddsBadge({
  label,
  odds,
}: {
  label: string;
  odds: { best_price: number; best_book: string; link: string | null; mobile_link: string | null } | null;
}) {
  const applyState = useStateLink();

  if (!odds) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-neutral-400">
        <span className="font-medium">{label}</span>
        <span>-</span>
      </div>
    );
  }

  const logo = getBookLogo(odds.best_book);
  const link = getPreferredLink(odds.link, odds.mobile_link);
  const isPositive = odds.best_price >= 0;

  const inner = (
    <div className="flex items-center gap-1">
      {logo && <img src={logo} alt="" className="h-3.5 w-3.5 rounded object-contain" />}
      <span className="text-[10px] font-medium text-neutral-500">{label}</span>
      <span className={cn(
        "text-[11px] font-bold tabular-nums font-mono",
        isPositive ? "text-[#22C55E]" : "text-neutral-600 dark:text-neutral-300"
      )}>
        {formatOddsPrice(odds.best_price)}
      </span>
    </div>
  );

  if (link) {
    return (
      <a href={applyState(link) || link} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
        {inner}
      </a>
    );
  }

  return inner;
}

// ── Edge Badge ──────────────────────────────────────────────────────────────

function EdgeBadge() {
  return (
    <div className="flex items-center justify-center py-0.5">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16A34A]/15 dark:bg-[#22C55E]/15 border border-[#16A34A]/30 dark:border-[#22C55E]/30">
        <Zap className="w-3 h-3 text-[#16A34A] dark:text-[#22C55E]" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#16A34A] dark:text-[#22C55E]">Edge</span>
      </div>
    </div>
  );
}

// ── Inning Heatmap ────────────────────────────────────────────────────────────

function InningHeatmap({
  innings,
  stat,
  onStatChange,
}: {
  innings: InningSplit[];
  stat: HeatmapStat;
  onStatChange: (s: HeatmapStat) => void;
}) {
  const sorted = useMemo(
    () => [...innings]
      .filter((i) => i.inning !== "ix")
      .sort((a, b) => {
        const ia = parseInt(a.inning.replace("i", ""));
        const ib = parseInt(b.inning.replace("i", ""));
        return ia - ib;
      }),
    [innings]
  );

  // Find the worst (highest) and best (lowest) inning for context
  const statVals = sorted.map((inn) => getInningStatVal(inn, stat)).filter((v): v is number => v != null);
  const worstInning = statVals.length > 0 ? sorted[statVals.indexOf(Math.max(...statVals))] : null;
  const bestInning = statVals.length > 0 ? sorted[statVals.indexOf(Math.min(...statVals))] : null;

  return (
    <div className="rounded-lg border border-neutral-200/40 dark:border-neutral-800/20 bg-neutral-50/50 dark:bg-neutral-800/10 p-3">
      {/* Header: title + info + stat dropdown */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">
          Inning Breakdown
        </span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-neutral-300 dark:text-neutral-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-[10px] space-y-1">
              <p className="font-semibold">Pitcher performance by inning</p>
              <p>Shows how this pitcher performs in each inning of the game. Useful for live betting and NRFI analysis.</p>
              <p><span className="text-[#4ADE80] font-semibold">Green</span> = pitcher vulnerable (opportunity) · <span className="text-[#F87171] font-semibold">Red</span> = pitcher dominant</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
          {HEATMAP_STAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatChange(opt.value)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                stat === opt.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap cells */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {sorted.map((inn) => {
          const val = getInningStatVal(inn, stat);
          const cellClasses = heatmapClasses(val, stat);
          const inningNum = parseInt(inn.inning.replace("i0", "").replace("i", ""));
          const isWorst = worstInning && inn.inning === worstInning.inning;
          const isBest = bestInning && inn.inning === bestInning.inning;
          return (
            <TooltipProvider key={inn.inning} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex-1 min-w-[60px] text-center rounded-lg py-3 px-1.5 cursor-default transition-all relative",
                      val != null ? cellClasses : "bg-neutral-100 dark:bg-neutral-800/40 text-neutral-400"
                    )}
                  >
                    <div className="text-[10px] font-bold leading-none mb-1.5">
                      {inningNum}
                    </div>
                    <div className="text-[15px] font-black tabular-nums font-mono leading-none">
                      {formatHeatmapVal(val, stat)}
                    </div>
                    {inn.pa > 0 && (
                      <div className="text-[9px] mt-1.5 leading-none opacity-60">
                        {inn.pa} PA
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] min-w-[140px]">
                  <div className="space-y-1">
                    <div className="font-semibold text-[11px] border-b border-neutral-200 dark:border-neutral-700 pb-1 mb-1">
                      Inning {inningNum} ({inn.pa} PA)
                    </div>
                    {inn.avg != null && <div className="flex justify-between"><span className="text-neutral-400">AVG</span> <span className="font-mono font-medium">{fmtAvg(inn.avg)}</span></div>}
                    {inn.slg != null && <div className="flex justify-between"><span className="text-neutral-400">SLG</span> <span className="font-mono font-medium">{fmtAvg(inn.slg)}</span></div>}
                    {inn.ops != null && <div className="flex justify-between"><span className="text-neutral-400">OPS</span> <span className="font-mono font-medium">{fmtAvg(inn.ops)}</span></div>}
                    {inn.iso != null && <div className="flex justify-between"><span className="text-neutral-400">ISO</span> <span className="font-mono font-medium">{fmtAvg(inn.iso)}</span></div>}
                    {inn.whip != null && <div className="flex justify-between"><span className="text-neutral-400">WHIP</span> <span className="font-mono font-medium">{fmtStat(inn.whip, 2)}</span></div>}
                    {inn.era != null && <div className="flex justify-between"><span className="text-neutral-400">ERA</span> <span className="font-mono font-medium">{fmtStat(inn.era)}</span></div>}
                    {inn.k_pct != null && <div className="flex justify-between"><span className="text-neutral-400">K%</span> <span className="font-mono font-medium">{fmtPct(inn.k_pct, 0)}</span></div>}
                    {inn.bb_pct != null && <div className="flex justify-between"><span className="text-neutral-400">BB%</span> <span className="font-mono font-medium">{fmtPct(inn.bb_pct, 0)}</span></div>}
                    {inn.hr > 0 && <div className="flex justify-between"><span className="text-neutral-400">HR</span> <span className="font-mono font-medium text-[#EF4444]">{inn.hr}</span></div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>

      {/* Legend row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-200/30 dark:border-neutral-700/15">
        <div className="flex items-center gap-3 text-[9px] text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500/50" />
            Vulnerable
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-neutral-400/30" />
            Neutral
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500/50" />
            Dominant
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Matchup Card ─────────────────────────────────────────────────────────────
// Each card: pitcher (left/top) vs opposing lineup (right/bottom)
// Rows align — pitcher's "vs 1st batter" aligns with lineup's leadoff hitter

function MatchupCard({
  pitcher,
  lineup,
  lineupTeamAbbr,
  isLineupConfirmed,
  heatmapStat,
  onHeatmapStatChange,
  isMobile,
  expandedBatterId,
  onToggleBatter,
}: {
  pitcher: PitcherData;
  lineup: LineupBatter[];
  lineupTeamAbbr: string;
  isLineupConfirmed: boolean;
  heatmapStat: HeatmapStat;
  onHeatmapStatChange: (s: HeatmapStat) => void;
  isMobile: boolean;
  expandedBatterId: number | null;
  onToggleBatter: (id: number) => void;
}) {
  // Pre-compute edge spots: pitcher weak (SLG >= .400) AND batter strong (SLG >= .450)
  const edgeSpots = useMemo(() => {
    const spots = new Set<number>();
    for (let i = 1; i <= 9; i++) {
      const pitcherSplit = pitcher.batting_order_splits.find((s) => s.slot === `b${i}`);
      const batter = lineup.find((b) => b.batting_order === i);
      const pitcherSlg = pitcherSplit?.slg ?? null;
      const batterSlg = batter?.spot_stats?.slg ?? null;
      if (isPitcherRowGreen(pitcherSlg) && isBatterRowGreen(batterSlg)) {
        spots.add(i);
      }
    }
    return spots;
  }, [pitcher.batting_order_splits, lineup]);

  if (isMobile) {
    return (
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
        {/* Pitcher section */}
        <PitcherHeader pitcher={pitcher} />
        <div className="border-t border-neutral-100 dark:border-neutral-800/50">
          <PitcherSplitsTable splits={pitcher.batting_order_splits} isMobile={isMobile} />
        </div>

        {/* Edge indicators between sections */}
        {edgeSpots.size > 0 && (
          <div className="border-t border-neutral-100 dark:border-neutral-800/50 px-3 py-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Zap className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#22C55E]" />
              <span className="text-[10px] font-bold text-[#16A34A] dark:text-[#22C55E] uppercase tracking-wider">
                Edge Spots:
              </span>
              {Array.from(edgeSpots).sort((a, b) => a - b).map((spot) => (
                <span
                  key={spot}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#16A34A]/15 dark:bg-[#22C55E]/15 text-[#16A34A] dark:text-[#22C55E]"
                >
                  #{spot}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Lineup section */}
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60">
          <LineupHeader teamAbbr={lineupTeamAbbr} isConfirmed={isLineupConfirmed} />
          <BatterLineupTable
            lineup={lineup}
            isMobile={isMobile}
            expandedBatterId={expandedBatterId}
            onToggleBatter={onToggleBatter}
          />
        </div>

        {/* Inning heatmap */}
        <div className="border-t border-neutral-100 dark:border-neutral-800/50 px-3 py-2.5">
          <InningHeatmap innings={pitcher.inning_splits} stat={heatmapStat} onStatChange={onHeatmapStatChange} />
        </div>
      </div>
    );
  }

  // Desktop: side-by-side with edge indicators
  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      <div className="flex">
        {/* Left column (40%): Pitcher splits */}
        <div className="w-[40%] border-r border-neutral-200/60 dark:border-neutral-800/60">
          <PitcherHeader pitcher={pitcher} />
          <div className="border-t border-neutral-100 dark:border-neutral-800/50">
            <PitcherSplitsTable splits={pitcher.batting_order_splits} isMobile={false} />
          </div>
        </div>

        {/* Edge column */}
        <div className="w-6 flex flex-col shrink-0">
          {/* Header spacer - aligns with table header row */}
          <div className="h-[68px]" /> {/* pitcher header height */}
          <div className="h-[29px]" /> {/* table header row height */}
          {/* Edge indicators per row */}
          {Array.from({ length: 9 }, (_, i) => i + 1).map((spot) => (
            <div key={`edge-${spot}`} className="h-9 flex items-center justify-center">
              {edgeSpots.has(spot) && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-5 h-5 rounded-full bg-[#16A34A]/20 dark:bg-[#22C55E]/20 flex items-center justify-center cursor-default">
                        <Zap className="w-3 h-3 text-[#16A34A] dark:text-[#22C55E]" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">
                      <div className="font-semibold">Edge Matchup</div>
                      <div>Pitcher weak + Batter strong at #{spot}</div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ))}
        </div>

        {/* Right column (60%): Opposing lineup */}
        <div className="flex-1">
          <LineupHeader teamAbbr={lineupTeamAbbr} isConfirmed={isLineupConfirmed} />
          <div className="border-t border-neutral-100 dark:border-neutral-800/50">
            <BatterLineupTable
              lineup={lineup}
              isMobile={false}
              expandedBatterId={expandedBatterId}
              onToggleBatter={onToggleBatter}
            />
          </div>
        </div>
      </div>

      {/* Inning heatmap below */}
      <div className="border-t border-neutral-100 dark:border-neutral-800/50 px-3 py-2.5">
        <InningHeatmap innings={pitcher.inning_splits} stat={heatmapStat} onStatChange={onHeatmapStatChange} />
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────

export interface MlbPitcherWeaknessProps {
  externalGameId?: number | null;
  externalSeason?: number;
  embedded?: boolean;
}

export function MlbPitcherWeakness({
  externalGameId,
  externalSeason,
  embedded = false,
}: MlbPitcherWeaknessProps = {}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const currentYear = new Date().getFullYear();

  // State
  const [internalGameId, setInternalGameId] = useState<number | null>(null);
  const [internalSeason, setInternalSeason] = useState<number>(currentYear);

  // Use external values when provided, fall back to internal state
  const selectedGameId = externalGameId ?? internalGameId;
  const setSelectedGameId = (id: number | null) => { if (!embedded) setInternalGameId(id); };
  const statSeason = externalSeason ?? internalSeason;
  const setStatSeason = (s: number) => { if (!embedded) setInternalSeason(s); };
  const [heatmapStat, setHeatmapStat] = useState<HeatmapStat>("ops");
  const [expandedBatterId, setExpandedBatterId] = useState<number | null>(null);

  // Data
  const { games, isLoading: gamesLoading } = useMlbGames(!embedded);
  const {
    game,
    awayPitcher,
    homePitcher,
    awayLineup,
    homeLineup,
    meta,
    isLoading: dataLoading,
    isFetching,
    error,
  } = useMlbPitcherWeakness({ gameId: selectedGameId, season: statSeason });

  // Auto-select first game (only in standalone mode)
  useEffect(() => {
    if (!embedded && games.length > 0 && selectedGameId == null) {
      setSelectedGameId(Number(games[0].game_id));
    }
  }, [games, selectedGameId, embedded]);

  const currentGame = useMemo(
    () => games.find((g) => Number(g.game_id) === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  const gameTime = useMemo(
    () => currentGame ? getETTime(currentGame.game_status) : "TBD",
    [currentGame]
  );

  function handleToggleBatter(id: number) {
    setExpandedBatterId((prev) => (prev === id ? null : id));
  }

  // Season options
  const seasonOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [];
    if (currentYear >= 2026) opts.push({ label: "2025", value: "2025" });
    opts.push({ label: String(currentYear), value: String(currentYear) });
    return opts;
  }, [currentYear]);

  // Loading state (standalone mode only)
  if (!embedded && gamesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading games...</span>
      </div>
    );
  }

  if (!embedded && games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <AlertTriangle className="w-8 h-8 mb-2 text-neutral-400" />
        <span className="text-sm">No games scheduled today</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Game Selector (hidden in embedded mode) */}
      {!embedded && (isMobile ? (
        <MobileGameSelector
          games={games}
          selectedGameId={selectedGameId}
          onSelect={setSelectedGameId}
        />
      ) : (
        <DesktopGameStrip
          games={games}
          selectedGameId={selectedGameId}
          onSelect={setSelectedGameId}
        />
      ))}

      {/* Header Bar (hidden in embedded mode) */}
      {!embedded && game && <GameHeaderBar game={game} gameTime={gameTime} />}

      {/* Filters: Season + Heatmap Stat (hidden in embedded mode) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          {seasonOptions.length > 1 && (
            <SegmentedControl
              options={seasonOptions}
              value={String(statSeason)}
              onChange={(v) => setStatSeason(Number(v))}
            />
          )}
          {isFetching && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 shrink-0" />
          )}
          {meta && (
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 ml-auto">
              {!meta.lineup_confirmed_away && (
                <span className="flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Away lineup projected
                </span>
              )}
              {!meta.lineup_confirmed_home && (
                <span className="flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Home lineup projected
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 text-sm text-red-700 dark:text-red-300">
          {error.message}
        </div>
      )}

      {/* Loading state for data */}
      {dataLoading && !error && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <span className="ml-2 text-sm text-neutral-500">Loading pitcher data...</span>
        </div>
      )}

      {/* Matchup Cards — stacked vertically */}
      {!dataLoading && !error && game && (
        <div className="space-y-4">
          {/* Card 1: Away pitcher (left) vs Home lineup (right) */}
          {awayPitcher ? (
            <MatchupCard
              pitcher={awayPitcher}
              lineup={homeLineup}
              lineupTeamAbbr={game.home_team_abbr}
              isLineupConfirmed={meta?.lineup_confirmed_home ?? false}
              heatmapStat={heatmapStat}
              onHeatmapStatChange={setHeatmapStat}
              isMobile={isMobile}
              expandedBatterId={expandedBatterId}
              onToggleBatter={handleToggleBatter}
            />
          ) : (
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-6 text-center text-sm text-neutral-500">
              Away pitcher TBD
            </div>
          )}

          {/* Card 2: Home pitcher (left) vs Away lineup (right) */}
          {homePitcher ? (
            <MatchupCard
              pitcher={homePitcher}
              lineup={awayLineup}
              lineupTeamAbbr={game.away_team_abbr}
              isLineupConfirmed={meta?.lineup_confirmed_away ?? false}
              heatmapStat={heatmapStat}
              onHeatmapStatChange={setHeatmapStat}
              isMobile={isMobile}
              expandedBatterId={expandedBatterId}
              onToggleBatter={handleToggleBatter}
            />
          ) : (
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-6 text-center text-sm text-neutral-500">
              Home pitcher TBD
            </div>
          )}
        </div>
      )}
    </div>
  );
}

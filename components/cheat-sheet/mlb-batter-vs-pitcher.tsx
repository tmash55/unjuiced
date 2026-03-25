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
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { ChevronRight, Users, Loader2, AlertCircle, TableProperties, GitCompare } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// ── Constants ────────────────────────────────────────────────────────────────

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

function slgColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.500) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 0.400) return "text-yellow-600 dark:text-yellow-400";
  if (val < 0.350 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function isoColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.220) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 0.160) return "text-yellow-600 dark:text-yellow-400";
  if (val < 0.120 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function baaColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.280) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 0.200 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function wobaColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 0.370) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 0.320) return "text-yellow-600 dark:text-yellow-400";
  if (val < 0.290 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function evColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 92) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 89) return "text-yellow-600 dark:text-yellow-400";
  if (val < 87 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function hardHitColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 45) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 35) return "text-yellow-600 dark:text-yellow-400";
  if (val < 30 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

function barrelColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 10) return "text-emerald-600 dark:text-emerald-400";
  if (val >= 6) return "text-yellow-600 dark:text-yellow-400";
  if (val < 4 && val > 0) return "text-red-500 dark:text-red-400";
  return "";
}

// Heat map cell backgrounds (subtle tint behind the value)
function heatBg(val: number | null, thresholds: { green: number; yellow: number; red: number; higher: "good" | "bad" }, intense = false): string {
  if (val == null) return "";
  const isHighGood = thresholds.higher === "good";
  const g = intense ? "bg-emerald-500/25" : "bg-emerald-500/10";
  const y = intense ? "bg-yellow-500/20" : "bg-yellow-500/8";
  const r = intense ? "bg-red-500/25" : "bg-red-500/10";
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
// Pitcher stat colors — only color outliers (no yellow middle tier)
function eraColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 4.50) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 3.00) return "text-red-500 dark:text-red-400";
  return "";
}

function whipColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 1.35) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 1.05) return "text-red-500 dark:text-red-400";
  return "";
}

function kPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 10.0) return "text-red-500 dark:text-red-400";
  if (val <= 6.5) return "text-emerald-600 dark:text-emerald-400";
  return "";
}

function bbPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 3.5) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 2.0) return "text-red-500 dark:text-red-400";
  return "";
}

function hrPer9Color(val: number | null): string {
  if (val == null) return "";
  if (val >= 1.40) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 0.80) return "text-red-500 dark:text-red-400";
  return "";
}

function fipColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 4.50) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 3.00) return "text-red-500 dark:text-red-400";
  return "";
}

function hrFbColor(val: number | null): string {
  if (val == null) return "";
  if (val >= 14) return "text-emerald-600 dark:text-emerald-400";
  if (val <= 7) return "text-red-500 dark:text-red-400";
  return "";
}

function trendArrow(trend: "up" | "down" | "flat" | null | undefined): string {
  if (trend === "up") return " ↑";
  if (trend === "down") return " ↓";
  return "";
}

function trendColor(trend: "up" | "down" | "flat" | null | undefined): string {
  if (trend === "up") return "text-emerald-500";
  if (trend === "down") return "text-red-400";
  return "";
}

function gradeBadge(grade: "strong" | "neutral" | "weak") {
  switch (grade) {
    case "strong":
      return { label: "STRONG", text: "text-emerald-600 dark:text-emerald-400" };
    case "neutral":
      return { label: "NEUTRAL", text: "text-neutral-500 dark:text-neutral-400" };
    case "weak":
      return { label: "WEAK", text: "text-red-500 dark:text-red-400" };
  }
}

// ── Game List Row ────────────────────────────────────────────────────────────

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "";
  if (pf >= 110) return "text-emerald-600 dark:text-emerald-400";
  if (pf >= 103) return "text-yellow-600 dark:text-yellow-400";
  if (pf <= 90) return "text-red-500 dark:text-red-400";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-500";
}

function hrImpactColor(score: number | null): string {
  if (score == null) return "";
  if (score >= 7) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 4) return "text-yellow-600 dark:text-yellow-400";
  if (score <= -4) return "text-red-500 dark:text-red-400";
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

// ── Pitcher Profile Card ────────────────────────────────────────────────────

function PitcherProfileCard({ pitcher, lineupLHBCount, lineupRHBCount, vulnerabilityTags }: { pitcher: PitcherProfile; lineupLHBCount?: number; lineupRHBCount?: number; vulnerabilityTags?: { label: string }[] }) {
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
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 px-3 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
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
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Pitcher Splits</h4>
          <div className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/20 overflow-hidden">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="bg-neutral-100/50 dark:bg-neutral-800/50 border-b border-neutral-200/50 dark:border-neutral-700/20">
                  <th className="px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wide font-semibold text-neutral-400">Split</th>
                  <th className="px-2.5 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold text-neutral-400">AVG</th>
                  <th className="px-2.5 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold text-neutral-400">SLG</th>
                  <th className="px-2.5 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold text-neutral-400">ISO</th>
                  <th className="px-2.5 py-1.5 text-right text-[10px] uppercase tracking-wide font-semibold text-neutral-400">HR</th>
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
                    <td className="px-2.5 py-1.5 text-right font-medium text-neutral-700 dark:text-neutral-300">{fmtAvg(row.data.avg)}</td>
                    <td className={cn("px-2.5 py-1.5 text-right font-semibold", slgColor(row.data.slg))}>{fmtAvg(row.data.slg)}</td>
                    <td className={cn("px-2.5 py-1.5 text-right font-medium", isoColor(row.data.iso))}>{fmtAvg(row.data.iso)}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold text-neutral-900 dark:text-white">{row.data.hr}</td>
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
              <div className="flex items-center gap-1">
                {([
                  { value: "all" as const, label: "All" },
                  { value: "lhb" as const, label: "vs LHB" },
                  { value: "rhb" as const, label: "vs RHB" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setArsenalSplitView(opt.value)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
                      arsenalSplitView === opt.value
                        ? "bg-brand/10 text-brand"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Column headers */}
          <div className="flex items-center gap-3 mb-1 text-[10px] text-neutral-400 font-medium uppercase tracking-wide">
            <div className="w-20 shrink-0">Pitch</div>
            <div className="flex-1 min-w-0 text-center">Usage</div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="w-14 text-right">Velo</span>
              <span className="w-8 text-right">BAA</span>
              <span className="w-8 text-right">SLG</span>
              <span className="w-10 text-right">Whiff</span>
            </div>
          </div>
          <div className="space-y-2">
            {arsenalData.map((pitch) => (
              <ArsenalRow key={pitch.pitch_type} pitch={pitch} maxUsage={arsenalMaxUsage} />
            ))}
          </div>
          {/* Vulnerability tags (moved from matchup summary) */}
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

      {/* Stats: Velo + BAA + SLG + Whiff% */}
      <div className="flex items-center gap-3 shrink-0 text-[11px] tabular-nums">
        <span className="text-neutral-500 w-14 text-right">
          {pitch.avg_speed != null ? `${pitch.avg_speed}` : "-"}
        </span>
        <span className={cn("w-8 text-right font-medium", baaColor(pitch.baa))}>
          {fmtAvg(pitch.baa)}
        </span>
        <span className={cn("w-8 text-right font-medium", slgColor(pitch.slg))}>
          {fmtAvg(pitch.slg)}
        </span>
        <span className={cn("w-10 text-right font-medium", pitch.whiff_pct != null && pitch.whiff_pct >= 30 ? "text-red-500 dark:text-red-400" : pitch.whiff_pct != null && pitch.whiff_pct <= 15 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500")}>
          {pitch.whiff_pct != null ? `${pitch.whiff_pct}%` : "-"}
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
}: {
  batter: BatterMatchup;
  pitcher: PitcherProfile;
  expanded: boolean;
  onToggle: () => void;
  isMobile: boolean;
  viewMode?: "standard" | "comparison";
  displayStats?: DisplayStats;
  pitchFilter?: string | null;
}) {
  // Use filtered stats if provided, otherwise use overall batter stats
  const ds = displayStats ?? {
    avg: batter.avg, slg: batter.slg, woba: batter.woba, iso: batter.iso,
    hr: batter.hr_count, ev: batter.avg_exit_velo, brl: batter.barrel_pct,
    bbs: batter.total_batted_balls,
    k_pct: batter.k_pct, bb_pct: batter.bb_pct,
  };
  const badge = gradeBadge(batter.matchup_grade);
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
                <span className="text-neutral-500">SLG <span className={cn("font-semibold", slgColor(ds.slg))}>{fmtAvg(ds.slg)}</span></span>
                <span className="text-neutral-500">wOBA <span className={cn("font-semibold", wobaColor(ds.woba))}>{fmtAvg(ds.woba)}</span></span>
                <span className="text-neutral-500">HR <span className="font-semibold text-neutral-900 dark:text-white">{ds.hr}</span></span>
                <span className="text-neutral-500">EV <span className={cn("font-semibold", evColor(ds.ev))}>{ds.ev != null ? ds.ev.toFixed(1) : "-"}</span></span>
                {batter.k_pct != null && <span className="text-neutral-500">K% <span className={cn("font-semibold", batter.k_pct >= 30 ? "text-red-500" : batter.k_pct <= 15 ? "text-emerald-600" : "text-neutral-700 dark:text-neutral-300")}>{batter.k_pct}%</span></span>}
                {batter.bb_pct != null && <span className="text-neutral-500">BB% <span className={cn("font-semibold", batter.bb_pct >= 12 ? "text-emerald-600" : batter.bb_pct <= 5 ? "text-red-500" : "text-neutral-700 dark:text-neutral-300")}>{batter.bb_pct}%</span></span>}
              </div>
            </div>
            <span className={cn("text-[9px] font-bold", badge.text)}>
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
                  vs {p.pitch_name}: <span className={cn("font-medium", slgColor(splitSlg))}>{fmtAvg(split?.avg ?? null)}/{fmtAvg(splitSlg)}</span>
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

        {expanded && <BatterExpansion batter={batter} pitcher={pitcher} isMobile pitchFilter={pitchFilter} />}
      </div>
    );
  }

  // Desktop
  return (
    <React.Fragment>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-all duration-150 border-b border-neutral-100/80 dark:border-neutral-800/30",
          expanded
            ? "bg-sky-50/40 dark:bg-sky-500/[0.04]"
            : "hover:bg-neutral-50/80 dark:hover:bg-neutral-800/20"
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
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.avg, { green: 0.280, yellow: 0.250, red: 0.200, higher: "good" }))}>
          <span className={cn("font-medium", baaColor(ds.avg))}>{fmtAvg(ds.avg)}</span>
        </td>
        <td className="px-1.5 py-2 text-xs text-right tabular-nums font-semibold">
          <span className="text-neutral-900 dark:text-white">{ds.hr}</span>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.slg, { green: 0.500, yellow: 0.400, red: 0.300, higher: "good" }))}>
          <span className={cn("font-semibold", slgColor(ds.slg))}>{fmtAvg(ds.slg)}</span>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.iso, { green: 0.220, yellow: 0.160, red: 0.100, higher: "good" }))}>
          <span className={cn("font-medium", isoColor(ds.iso))}>{fmtAvg(ds.iso)}</span>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.ev, { green: 92, yellow: 89, red: 85, higher: "good" }))}>
          <span className={cn("font-medium", evColor(ds.ev))}>{ds.ev != null ? ds.ev.toFixed(1) : "-"}</span>
          {batter.recent_avg_ev != null && batter.avg_exit_velo != null && (
            <DeltaArrow current={batter.recent_avg_ev} baseline={batter.avg_exit_velo} higherGood />
          )}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.brl, { green: 10, yellow: 6, red: 3, higher: "good" }))}>
          <span className={cn("font-medium", barrelColor(ds.brl))}>{ds.brl != null ? `${ds.brl.toFixed(1)}%` : "-"}</span>
          {batter.recent_barrel_pct != null && batter.barrel_pct != null && (
            <DeltaArrow current={batter.recent_barrel_pct} baseline={batter.barrel_pct} higherGood />
          )}
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.woba, { green: 0.370, yellow: 0.320, red: 0.280, higher: "good" }))}>
          <span className={cn("font-medium", wobaColor(ds.woba))}>{fmtAvg(ds.woba)}</span>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.k_pct ?? null, { green: 15, yellow: 22, red: 30, higher: "bad" }))}>
          <span className={cn(
            "font-medium",
            ds.k_pct != null && ds.k_pct >= 30 ? "text-red-500" :
            ds.k_pct != null && ds.k_pct <= 15 ? "text-emerald-600" : ""
          )}>
            {ds.k_pct != null ? `${ds.k_pct}%` : "-"}
          </span>
        </td>
        <td className={cn("px-1.5 py-2 text-xs text-right tabular-nums", heatBg(ds.bb_pct ?? null, { green: 12, yellow: 8, red: 5, higher: "good" }))}>
          <span className={cn(
            "font-medium",
            ds.bb_pct != null && ds.bb_pct >= 12 ? "text-emerald-600" :
            ds.bb_pct != null && ds.bb_pct <= 5 ? "text-red-500" : ""
          )}>
            {ds.bb_pct != null ? `${ds.bb_pct}%` : "-"}
          </span>
        </td>
        <td className="pr-3 pl-1 py-2">
          <ChevronRight className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", expanded && "rotate-90")} />
        </td>
      </tr>
      {/* Pitch splits row (always visible below main row) */}
      <tr className={cn(
        "border-b border-neutral-200/40 dark:border-neutral-700/20",
        expanded ? "bg-sky-50/40 dark:bg-sky-500/[0.04]" : ""
      )}>
        <td colSpan={12} className="px-3 pb-2.5 pt-0">
          <div className="ml-9 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
            {top2Pitches.map((p) => {
              const split = batter.pitch_splits.find((s) => s.pitch_type === p.pitch_type);
              const splitSlg = split?.slg ?? null;
              return (
                <span key={p.pitch_type}>
                  vs {p.pitch_name}:{" "}
                  <span className={cn("font-medium", slgColor(splitSlg))}>
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
                <span className={cn("font-medium", slgColor(batter.recent_barrel_pct != null ? (batter.recent_barrel_pct >= batter.barrel_pct ? 0.5 : 0.3) : null))}>
                  {batter.recent_barrel_pct > batter.barrel_pct + 2 ? "↑" : batter.recent_barrel_pct < batter.barrel_pct - 2 ? "↓" : "→"}
                </span>
                <span className="ml-0.5 font-medium text-neutral-600 dark:text-neutral-400">
                  {batter.recent_avg_ev != null ? `${batter.recent_avg_ev.toFixed(1)} EV` : ""}
                  {batter.recent_hr_count > 0 && <span className="ml-0.5">{batter.recent_hr_count} HR</span>}
                </span>
              </span>
            )}
            <span className={cn("text-[9px] font-bold", badge.text)}>
              {badge.label}
            </span>
          </div>
        </td>
      </tr>
      {/* Expansion */}
      {expanded && (
        <tr>
          <td colSpan={12} className="px-3 pb-4 bg-brand/5 dark:bg-brand/10">
            <BatterExpansion batter={batter} pitcher={pitcher} isMobile={false} pitchFilter={pitchFilter} />
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
}: {
  batter: BatterMatchup;
  pitcher: PitcherProfile;
  isMobile: boolean;
  pitchFilter?: string | null;
}) {
  const h2hMeetings = batter.h2h?.last_meetings ?? [];
  const hrFactors = batter.hr_factors ?? [];
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
      <div className={cn("grid gap-4 mb-4", isMobile ? "grid-cols-1" : "grid-cols-5")}>
        {/* Pitch Type Table — 3 cols wide */}
        <div className={cn(isMobile ? "" : "col-span-3")}>
          <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 mb-2">
            vs {pitcher.name.split(" ").pop()} — Pitch Splits
          </h5>
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
                      <span className={cn("font-bold", slgColor(split?.slg ?? null))}>{fmtAvg(split?.slg ?? null)}</span>
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
        <div className={cn(isMobile ? "" : "col-span-2")}>
          <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 mb-2">HR Score</h5>
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
        </div>
      </div>

      {/* Bottom section: H2H + Recent Form — single row, no card borders */}
      <div className={cn("grid gap-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/40", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {/* H2H */}
        <div>
          <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 mb-2">Head-to-Head</h5>
          {batter.h2h && batter.h2h.pa > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-6 text-center">
                {[
                  { label: "PA", value: batter.h2h.pa, color: "" },
                  { label: "AVG", value: fmtAvg(batter.h2h.avg), color: "" },
                  { label: "SLG", value: fmtAvg(batter.h2h.slg), color: slgColor(batter.h2h.slg) },
                  { label: "HR", value: batter.h2h.hrs, color: batter.h2h.hrs > 0 ? "text-emerald-500" : "" },
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
        <div>
          <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 mb-2">Recent Form (60d)</h5>
          <div className="flex items-center gap-6">
            {[
              { label: "Brl%", value: batter.recent_barrel_pct != null ? `${batter.recent_barrel_pct}%` : "-", color: barrelColor(batter.recent_barrel_pct) },
              { label: "Avg EV", value: batter.recent_avg_ev?.toFixed(1) ?? "-", color: evColor(batter.recent_avg_ev) },
              { label: "HR", value: batter.recent_hr_count, color: batter.recent_hr_count >= 3 ? "text-emerald-500" : "" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[9px] text-neutral-400">{s.label}</p>
                <p className={cn("text-sm font-bold tabular-nums", s.color || "text-neutral-900 dark:text-white")}>{s.value}</p>
              </div>
            ))}
            {sparkline.length >= 2 && (
              <div className="ml-auto">
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
}: {
  batters: BatterMatchup[];
  pitcher: PitcherProfile;
  expandedBatterId: number | null;
  onToggleExpand: (id: number) => void;
  pitchFilter: string | null;
  getStats: (b: BatterMatchup) => DisplayStats;
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
                    <span className={cn("text-[11px] font-bold tabular-nums", slgColor(s.slg))}>
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
                <BatterExpansion batter={b} pitcher={pitcher} isMobile={false} pitchFilter={pitchFilter} />
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
  const [statSeason, setStatSeason] = useState<number>(2025);
  const [stdSortKey, setStdSortKey] = useState<StdSortKey>("lineup");
  const [stdSortAsc, setStdSortAsc] = useState(true);
  const [showBench, setShowBench] = useState(false);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { games, isLoading: gamesLoading } = useMlbGames();

  // Auto-select first upcoming game; if all today's games are done, pick first game of next day
  useEffect(() => {
    if (games.length > 0 && selectedGameId == null) {
      // Find first game that isn't "Final"
      const upcoming = games.find((g) => !g.game_status?.toLowerCase().includes("final"));
      if (upcoming) {
        setSelectedGameId(Number(upcoming.game_id));
      } else {
        // All games are final — find the first game from a future date
        const todayGames = games.filter((g) => g.game_date === games[0].game_date);
        const futureGame = games.find((g) => g.game_date !== todayGames[0]?.game_date);
        setSelectedGameId(Number((futureGame ?? games[0]).game_id));
      }
    }
  }, [games, selectedGameId]);

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
          k_pct: (hs as any).k_pct ?? null, bb_pct: (hs as any).bb_pct ?? null,
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
        bbs: totalBBs, k_pct: null, bb_pct: null,
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
  const displayBatters = hasLineup ? starters : sortedBatters;

  const stdSortIcon = (key: StdSortKey) => stdSortKey === key ? (stdSortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-3">
      {gamesLoading ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-500">Loading games...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center">
            <p className="text-sm text-neutral-500">No games scheduled today</p>
          </div>
        ) : (
          <>
            {/* ── Section A: Horizontal Game Bar ── */}
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-2 py-2">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
                {(() => {
                  let lastDate = "";
                  return games.map((g, gi) => {
                    const showDateHeader = g.game_date !== lastDate;
                    lastDate = g.game_date;
                    const dateLabel = (() => {
                      const d = new Date(g.game_date + "T12:00:00");
                      const today = new Date();
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
                      if (g.game_date === fmt(today)) return "Today";
                      if (g.game_date === fmt(tomorrow)) return "Tomorrow";
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

            {/* ── Section B: Team Toggle + Context + Filters ── */}
            {game && (
              <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
                {/* Row 1: Team toggle + summary stats */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-neutral-200/40 dark:border-neutral-700/20">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                      <button
                        onClick={() => setBattingSide("away")}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
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
                        {game.away_team.abbr} Batting
                      </button>
                      <button
                        onClick={() => setBattingSide("home")}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
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
                        {game.home_team.abbr} Batting
                      </button>
                    </div>
                    {summary && (
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
                  <div className="flex items-center gap-2">
                    {selectedGame && (
                      <span className="text-[11px] text-neutral-400 tabular-nums">{selectedGame.game_status}</span>
                    )}
                    {isFetching && !matchupLoading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                    )}
                  </div>
                </div>

                {/* Pitcher controls — season + sample */}
                {pitcher && (
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mr-1">Pitcher</span>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                      {[2025, 2026].map((yr) => (
                        <button
                          key={yr}
                          onClick={() => setStatSeason(yr)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                            statSeason === yr
                              ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          )}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
                      {SAMPLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSample(opt.value)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
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
                <div className="xl:w-[38%] xl:sticky xl:top-0 xl:self-start">
                  {pitcher && (
                    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-4">
                      <PitcherProfileCard
                        pitcher={pitcher}
                        lineupLHBCount={lineupTotals?.lhb}
                        lineupRHBCount={lineupTotals?.rhb}
                        vulnerabilityTags={(summary?.pitcher_tags ?? []).filter((t) => t.type === "vulnerability" && /hittable|SLG/i.test(t.label))}
                      />
                    </div>
                  )}
                </div>

                {/* Right: Lineup Column */}
                <div className="xl:w-[62%] space-y-3">
                  {/* Batter controls — view toggle + pitch pills + hand filter */}
                  {batters.length > 0 && pitcher && (
                    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-3 py-2.5 space-y-2">
                      {/* Row 1: View toggle + hand filter */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60">
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
                  {batters.length > 0 ? (
                    viewMode === "comparison" && pitcher ? (
                      <ComparisonView
                        batters={displayBatters}
                        pitcher={pitcher}
                        expandedBatterId={expandedBatterId}
                        onToggleExpand={(id) => setExpandedBatterId(expandedBatterId === id ? null : id)}
                        pitchFilter={pitchFilters[0] ?? null}
                        getStats={getBatterStats}
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
                              />
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            {/* Lineup status row */}
                            {!matchupLoading && batters.length > 0 && (
                              <tr className="border-b border-neutral-100 dark:border-neutral-800/40">
                                <th colSpan={12} className="px-3 py-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className={cn(
                                      "inline-flex items-center gap-1.5 text-[10px] font-semibold",
                                      hasLineup ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                    )}>
                                      {hasLineup ? (
                                        <>
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
                              const sThCls = "px-1.5 py-2 text-[10px] uppercase tracking-wide font-semibold text-neutral-500 text-right cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors select-none whitespace-nowrap";
                              return (
                                <tr className="bg-neutral-50/80 dark:bg-neutral-800/40 border-b border-neutral-200/60 dark:border-neutral-700/30">
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
                              />
                            ))}
                            {/* Bench expand row */}
                            {hasLineup && benchPlayers.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan={12} className="px-3 py-0">
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
                                  "bg-neutral-50/80 dark:bg-neutral-800/50",
                                  row.isFirst ? "border-t-2 border-neutral-300 dark:border-neutral-600" : "border-t border-neutral-200 dark:border-neutral-700"
                                )}>
                                  <td className="pl-3 pr-1 py-1.5" />
                                  <td className={cn("px-2 py-1.5 text-xs text-neutral-900 dark:text-white", row.isFirst ? "font-bold" : "font-medium text-neutral-600 dark:text-neutral-400")}>
                                    {row.label}
                                    {row.extra && <span className="text-[10px] font-normal text-neutral-400 ml-1">{row.extra}</span>}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", baaColor(row.data.avg))}>
                                    {row.data.avg != null ? fmtAvg(row.data.avg) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold text-neutral-900 dark:text-white" : "font-medium text-neutral-600 dark:text-neutral-400")}>
                                    {row.data.hr}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", slgColor(row.data.slg))}>
                                    {row.data.slg != null ? fmtAvg(row.data.slg) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", isoColor(row.data.iso))}>
                                    {row.data.iso != null ? fmtAvg(row.data.iso) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", "text-neutral-700 dark:text-neutral-300")}>
                                    {row.data.ev != null ? row.data.ev.toFixed(1) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", barrelColor(row.data.brl))}>
                                    {row.data.brl != null ? `${row.data.brl.toFixed(1)}%` : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", wobaColor(row.data.woba))}>
                                    {row.data.woba != null ? fmtAvg(row.data.woba) : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", "text-neutral-700 dark:text-neutral-300")}>
                                    {row.data.k_pct != null ? `${row.data.k_pct.toFixed(1)}%` : "-"}
                                  </td>
                                  <td className={cn("px-1.5 py-1.5 text-xs text-right tabular-nums", row.isFirst ? "font-bold" : "font-medium", "text-neutral-700 dark:text-neutral-300")}>
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
            )}
          </>
        )}
    </div>
  );
}

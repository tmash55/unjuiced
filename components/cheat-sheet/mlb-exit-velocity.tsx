"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbExitVelocity } from "@/hooks/use-mlb-exit-velocity";
import type { ExitVeloLeader, BattedBallDetail } from "@/app/api/mlb/exit-velocity-leaders/route";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Snowflake,
  Lock,
  ArrowRight,
  Search,
  X,
  Table,
  ScatterChart as ScatterChartIcon,
  ChevronRight,
} from "lucide-react";
import Chart from "@/icons/chart";
import { SheetFilterBar, SegmentedControl, FilterDivider, FilterSearch, FilterCount } from "@/components/cheat-sheet/sheet-filter-bar";

// ── Constants ────────────────────────────────────────────────────────────────

const FREE_MAX_ROWS = 5;
const UPGRADE_URL = "/pricing";

const SAMPLE_OPTIONS = [
  { value: 10, label: "10 ABs" },
  { value: 15, label: "15 ABs" },
  { value: 25, label: "25 ABs" },
  { value: 50, label: "50 ABs" },
] as const;

const PITCH_TYPE_LABELS: Record<string, string> = {
  FF: "4-Seam",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  CU: "Curveball",
  CH: "Changeup",
  FS: "Splitter",
  KC: "Knuckle Curve",
  ST: "Sweeper",
  SV: "Slurve",
  KN: "Knuckleball",
  EP: "Eephus",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatLongDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function getEvColor(ev: number): string {
  if (ev >= 93) return "text-emerald-600 dark:text-emerald-400";
  if (ev >= 90) return "text-green-600 dark:text-green-400";
  if (ev >= 88) return "text-amber-500 dark:text-amber-400";
  if (ev >= 85) return "text-neutral-600 dark:text-neutral-300";
  return "text-neutral-400 dark:text-neutral-500";
}

function getBarrelColor(pct: number): string {
  if (pct >= 15) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 10) return "text-green-600 dark:text-green-400";
  if (pct >= 6) return "text-amber-500 dark:text-amber-400";
  return "text-neutral-500 dark:text-neutral-400";
}

function getHardHitColor(pct: number): string {
  if (pct >= 50) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 40) return "text-green-600 dark:text-green-400";
  if (pct >= 33) return "text-amber-500 dark:text-amber-400";
  return "text-neutral-500 dark:text-neutral-400";
}

function getSlgColor(slg: number): string {
  if (slg >= 0.550) return "text-emerald-600 dark:text-emerald-400";
  if (slg >= 0.450) return "text-green-600 dark:text-green-400";
  if (slg >= 0.350) return "text-amber-500 dark:text-amber-400";
  return "text-neutral-500 dark:text-neutral-400";
}

function getSlgDiffColor(diff: number): string {
  if (diff >= 0.1) return "text-emerald-600 dark:text-emerald-400";
  if (diff >= 0.02) return "text-green-600 dark:text-green-400";
  if (diff >= -0.02) return "text-neutral-500 dark:text-neutral-400";
  if (diff >= -0.1) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function getLaColor(la: number): string {
  if (la >= 12 && la <= 25) return "text-emerald-600 dark:text-emerald-400";
  if (la >= 8 && la <= 32) return "text-green-600 dark:text-green-400";
  return "text-neutral-500 dark:text-neutral-400";
}

// ── Sort types ───────────────────────────────────────────────────────────────

type SortField =
  | "rank"
  | "player"
  | "avg_ev"
  | "max_ev"
  | "barrel_pct"
  | "hard_hit_pct"
  | "sweet_spot"
  | "avg_la"
  | "avg_distance"
  | "hits"
  | "home_runs"
  | "xbh"
  | "xslg"
  | "actual_slg"
  | "slg_diff"
  | "trend";

type SortDirection = "asc" | "desc";

// ── Trend Badge ─────────────────────────────────────────────────────────────

function TrendBadge({ trend, diff }: { trend: ExitVeloLeader["ev_trend"]; diff: number }) {
  const config = {
    hot: { icon: Flame, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Hot" },
    warm: { icon: TrendingUp, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10", label: "Warm" },
    steady: { icon: Minus, color: "text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-800", label: "Steady" },
    cooling: { icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-500/10", label: "Cooling" },
    cold: { icon: Snowflake, color: "text-red-500", bg: "bg-red-500/10", label: "Cold" },
  }[trend];

  const Icon = config.icon;

  return (
    <Tooltip content={`${config.label}: ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} mph vs season avg`} side="top">
      <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-help", config.bg, config.color)}>
        <Icon className="w-3 h-3" />
        <span>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}</span>
      </div>
    </Tooltip>
  );
}

// ── EV Meter ────────────────────────────────────────────────────────────────

function EvMeter({ value }: { value: number }) {
  const pct = Math.min(Math.max(((value - 80) / 20) * 100, 0), 100);
  const barColor =
    value >= 93
      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
      : value >= 90
        ? "bg-gradient-to-r from-green-500 to-green-400"
        : value >= 88
          ? "bg-gradient-to-r from-amber-500 to-amber-400"
          : "bg-gradient-to-r from-neutral-400 to-neutral-300";

  return (
    <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
      <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) {
  if (field !== currentField) return <ChevronDown className="w-3 h-3 text-neutral-300" />;
  return direction === "desc" ? <ChevronDown className="w-3 h-3 text-brand" /> : <ChevronUp className="w-3 h-3 text-brand" />;
}

// ── Mobile Card ──────────────────────────────────────────────────────────────

function MobileEvCard({ leader, rank }: { leader: ExitVeloLeader; rank: number }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-neutral-100 dark:border-neutral-800/50">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold tabular-nums shrink-0",
            rank <= 3
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
              : rank <= 10
                ? "bg-brand/10 text-brand"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
          )}
        >
          {rank}
        </span>
        <div
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg"
          style={{
            background:
              leader.primary_color && leader.secondary_color
                ? `linear-gradient(180deg, ${leader.primary_color} 0%, ${leader.primary_color} 55%, ${leader.secondary_color} 100%)`
                : leader.primary_color || "#6b7280",
          }}
        >
          <img src={getMlbHeadshotUrl(leader.player_id, "small")} alt={leader.player_name} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-neutral-900 dark:text-white truncate">{leader.player_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            <img src={`/team-logos/mlb/${leader.team_abbr.toUpperCase()}.svg`} alt={leader.team_abbr} className="h-3.5 w-3.5 object-contain" />
            <span>{leader.position}</span>
            <span className="text-neutral-300 dark:text-neutral-600">&bull;</span>
            <span>
              {leader.home_away === "H" ? "vs" : "@"} {leader.opponent_team_abbr}
              {leader.opposing_pitcher && <span className="text-neutral-400"> ({leader.opposing_pitcher.split(" ").pop()})</span>}
            </span>
          </div>
        </div>
        <TrendBadge trend={leader.ev_trend} diff={leader.ev_vs_season} />
      </div>

      <div className="grid grid-cols-4 divide-x divide-neutral-100 dark:divide-neutral-800/50">
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Avg EV</p>
          <p className={cn("text-base font-bold tabular-nums mt-0.5", getEvColor(leader.avg_exit_velo))}>{leader.avg_exit_velo.toFixed(1)}</p>
          <EvMeter value={leader.avg_exit_velo} />
          <p className="text-[9px] text-neutral-400 tabular-nums mt-0.5">Szn {leader.season_avg_ev?.toFixed(1) ?? "—"}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Max EV</p>
          <p className={cn("text-base font-bold tabular-nums mt-0.5", getEvColor(leader.max_exit_velo))}>{leader.max_exit_velo.toFixed(1)}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Barrel%</p>
          <p className={cn("text-base font-bold tabular-nums mt-0.5", getBarrelColor(leader.barrel_pct))}>{leader.barrel_pct.toFixed(1)}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">HH%</p>
          <p className={cn("text-base font-bold tabular-nums mt-0.5", getHardHitColor(leader.hard_hit_pct))}>{leader.hard_hit_pct.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-neutral-100 dark:divide-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800/50">
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Avg LA</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", getLaColor(leader.avg_launch_angle))}>{leader.avg_launch_angle.toFixed(1)}&deg;</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">xSLG</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", getSlgColor(leader.xslg))}>{leader.xslg.toFixed(3)}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">SLG</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", getSlgColor(leader.actual_slg))}>{leader.actual_slg.toFixed(3)}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Diff</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", getSlgDiffColor(leader.slg_diff))}>{leader.slg_diff >= 0 ? "+" : ""}{leader.slg_diff.toFixed(3)}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-neutral-100 dark:divide-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800/50">
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Hits</p>
          <p className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white mt-0.5">{leader.hits}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">HR</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", leader.home_runs > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500")}>{leader.home_runs}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">XBH</p>
          <p className={cn("text-sm font-bold tabular-nums mt-0.5", leader.xbh > 0 ? "text-green-600 dark:text-green-400" : "text-neutral-500")}>{leader.xbh}</p>
        </div>
        <div className="p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Dist</p>
          <p className="text-sm font-bold tabular-nums text-neutral-600 dark:text-neutral-300 mt-0.5">{leader.avg_distance}ft</p>
        </div>
      </div>

      <div className="px-3 pb-2 pt-1">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          {leader.line_drive_pct > 0 && <div className="h-full bg-emerald-500/80" style={{ width: `${leader.line_drive_pct}%` }} />}
          {leader.fly_ball_pct > 0 && <div className="h-full bg-blue-500/80" style={{ width: `${leader.fly_ball_pct}%` }} />}
          {leader.ground_ball_pct > 0 && <div className="h-full bg-amber-500/80" style={{ width: `${leader.ground_ball_pct}%` }} />}
        </div>
        <div className="flex justify-between mt-0.5 text-[9px] tabular-nums text-neutral-400">
          <span className="text-emerald-500">LD {leader.line_drive_pct.toFixed(0)}%</span>
          <span className="text-blue-500">FB {leader.fly_ball_pct.toFixed(0)}%</span>
          <span className="text-amber-500">GB {leader.ground_ball_pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ── BB Expansion Row ────────────────────────────────────────────────────────

function getTrajectoryLabel(t: string | null): string {
  if (!t) return "—";
  const map: Record<string, string> = { line_drive: "LD", fly_ball: "FB", ground_ball: "GB", popup: "PU" };
  return map[t] ?? t;
}

function getTrajectoryColor(t: string | null): string {
  if (!t) return "";
  if (t === "line_drive") return "text-emerald-500";
  if (t === "fly_ball") return "text-blue-500";
  if (t === "ground_ball") return "text-amber-500";
  return "text-neutral-400";
}

function getEventLabel(e: string | null): string {
  if (!e) return "—";
  const map: Record<string, string> = {
    single: "1B", double: "2B", triple: "3B", home_run: "HR",
    field_out: "Out", strikeout: "K", walk: "BB",
    grounded_into_double_play: "GDP", force_out: "FO",
    sac_fly: "SF", fielders_choice: "FC", field_error: "E",
    double_play: "DP", sac_bunt: "SAC",
  };
  return map[e] ?? e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getEventColor(e: string | null, isHit: boolean): string {
  if (!e) return "";
  if (e === "home_run") return "text-emerald-500 font-bold";
  if (e === "triple") return "text-green-500 font-bold";
  if (e === "double") return "text-green-500";
  if (isHit) return "text-blue-500";
  return "text-neutral-400";
}

function BattedBallExpansion({
  balls,
  isMobile,
}: {
  balls: BattedBallDetail[];
  isMobile: boolean;
}) {
  if (balls.length === 0) {
    return <p className="text-sm text-neutral-500 py-4 text-center">No batted ball data available</p>;
  }

  if (isMobile) {
    return (
      <div className="space-y-2 p-3">
        {balls.map((bb, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg border p-2.5 text-xs",
              bb.is_barrel
                ? "border-emerald-500/30 bg-emerald-500/5"
                : bb.is_hit
                  ? "border-blue-500/20 bg-blue-500/5"
                  : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                <span>{bb.game_date}</span>
                {bb.inning != null && <span>Inn {bb.inning}</span>}
              </div>
              <span className={cn("font-bold", getEventColor(bb.event_type, bb.is_hit))}>
                {getEventLabel(bb.event_type)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <p className="text-[9px] text-neutral-400 uppercase">EV</p>
                <p className={cn("font-bold tabular-nums", getEvColor(bb.exit_velocity))}>{bb.exit_velocity}</p>
              </div>
              <div>
                <p className="text-[9px] text-neutral-400 uppercase">LA</p>
                <p className="font-semibold tabular-nums">{bb.launch_angle != null ? `${bb.launch_angle}°` : "—"}</p>
              </div>
              <div>
                <p className="text-[9px] text-neutral-400 uppercase">Dist</p>
                <p className="font-semibold tabular-nums">{bb.distance ?? "—"}{bb.distance ? "ft" : ""}</p>
              </div>
              <div>
                <p className="text-[9px] text-neutral-400 uppercase">Type</p>
                <p className={cn("font-semibold", getTrajectoryColor(bb.trajectory))}>{getTrajectoryLabel(bb.trajectory)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
              {bb.pitcher_name && <span className="font-medium text-neutral-500">vs {bb.pitcher_name}</span>}
              {bb.pitcher_hand && <span>({bb.pitcher_hand}HP)</span>}
              {bb.pitch_type && <span className="bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded font-semibold">{PITCH_TYPE_LABELS[bb.pitch_type] ?? bb.pitch_type}</span>}
              {bb.pitch_speed && <span>{bb.pitch_speed} mph</span>}
              {bb.is_barrel && <span className="text-emerald-500 font-bold">BARREL</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-100/95 dark:bg-neutral-800/95 backdrop-blur-sm">
            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">#</th>
            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Date</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Inn</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">EV</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">LA</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Dist</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Type</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Result</th>
            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Pitcher</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Pitch</th>
            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200/50 dark:border-neutral-700/50">Velo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100/50 dark:divide-neutral-800/30">
          {balls.map((bb, i) => (
            <tr
              key={i}
              className={cn(
                "transition-colors hover:bg-brand/5",
                bb.is_barrel
                  ? "bg-emerald-500/5"
                  : bb.is_hit
                    ? "bg-blue-500/[0.02]"
                    : i % 2 === 0
                      ? "bg-white dark:bg-neutral-900"
                      : "bg-neutral-50/30 dark:bg-neutral-800/10"
              )}
            >
              <td className="px-2.5 py-1.5 text-neutral-400 tabular-nums">{i + 1}</td>
              <td className="px-2.5 py-1.5 text-neutral-500 whitespace-nowrap">{bb.game_date}</td>
              <td className="px-2.5 py-1.5 text-center tabular-nums text-neutral-500">
                {bb.inning ?? "—"}
              </td>
              <td className="px-2.5 py-1.5 text-center">
                <span className={cn("font-bold tabular-nums", getEvColor(bb.exit_velocity))}>
                  {bb.exit_velocity}
                </span>
                {bb.is_barrel && (
                  <Tooltip content="Barrel: optimal EV + launch angle" side="top">
                    <span className="ml-1 text-[9px] font-bold text-emerald-500 cursor-help">BRL</span>
                  </Tooltip>
                )}
              </td>
              <td className={cn("px-2.5 py-1.5 text-center tabular-nums", bb.launch_angle != null ? getLaColor(bb.launch_angle) : "")}>
                {bb.launch_angle != null ? `${bb.launch_angle}°` : "—"}
              </td>
              <td className="px-2.5 py-1.5 text-center tabular-nums text-neutral-600 dark:text-neutral-400">
                {bb.distance ?? "—"}{bb.distance ? "ft" : ""}
              </td>
              <td className={cn("px-2.5 py-1.5 text-center font-semibold", getTrajectoryColor(bb.trajectory))}>
                {getTrajectoryLabel(bb.trajectory)}
              </td>
              <td className={cn("px-2.5 py-1.5 text-center font-semibold", getEventColor(bb.event_type, bb.is_hit))}>
                {getEventLabel(bb.event_type)}
              </td>
              <td className="px-2.5 py-1.5 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                {bb.pitcher_name ? (
                  <span>
                    {bb.pitcher_name}
                    {bb.pitcher_hand && <span className="text-neutral-400 ml-1">({bb.pitcher_hand})</span>}
                  </span>
                ) : bb.pitcher_hand ? (
                  <span className="text-neutral-400">{bb.pitcher_hand}HP</span>
                ) : "—"}
              </td>
              <td className="px-2.5 py-1.5 text-center">
                {bb.pitch_type ? (
                  <Tooltip content={PITCH_TYPE_LABELS[bb.pitch_type] ?? bb.pitch_type} side="top">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold cursor-help">
                      {bb.pitch_type}
                    </span>
                  </Tooltip>
                ) : "—"}
              </td>
              <td className="px-2.5 py-1.5 text-center tabular-nums text-neutral-500">
                {bb.pitch_speed ? `${bb.pitch_speed}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Scatter Plot ─────────────────────────────────────────────────────────────

type ScatterYAxis = "hard_hit_pct" | "barrel_pct" | "xslg" | "sweet_spot_pct";

const SCATTER_Y_OPTIONS: { value: ScatterYAxis; label: string; shortLabel: string; leagueAvg: number; format: (v: number) => string; isPercent: boolean }[] = [
  { value: "hard_hit_pct", label: "Hard Hit %", shortLabel: "HH%", leagueAvg: 35, format: (v) => `${v.toFixed(0)}%`, isPercent: true },
  { value: "barrel_pct", label: "Barrel %", shortLabel: "Brl%", leagueAvg: 7.5, format: (v) => `${v.toFixed(0)}%`, isPercent: true },
  { value: "xslg", label: "xSLG", shortLabel: "xSLG", leagueAvg: 0.39, format: (v) => v.toFixed(3), isPercent: false },
  { value: "sweet_spot_pct", label: "Sweet Spot %", shortLabel: "SS%", leagueAvg: 33, format: (v) => `${v.toFixed(0)}%`, isPercent: true },
];

const SCATTER_LEAGUE_AVG_EV = 88.5;

function EvScatterPlot({
  leaders,
  isMobile,
}: {
  leaders: ExitVeloLeader[];
  isMobile: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [yAxis, setYAxis] = useState<ScatterYAxis>("hard_hit_pct");
  const svgRef = useRef<SVGSVGElement>(null);

  const yOpt = SCATTER_Y_OPTIONS.find((o) => o.value === yAxis)!;
  const getYVal = useCallback((l: ExitVeloLeader) => l[yAxis], [yAxis]);

  const W = isMobile ? 360 : 720;
  const H = isMobile ? 320 : 480;
  const PAD = { top: 24, right: 24, bottom: 44, left: 54 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const { minEV, maxEV, minY, maxY } = useMemo(() => {
    if (leaders.length === 0) return { minEV: 82, maxEV: 98, minY: 0, maxY: 60 };
    const evs = leaders.map((l) => l.avg_exit_velo);
    const yVals = leaders.map(getYVal);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);
    const yPad = Math.max((yMax - yMin) * 0.12, 3);
    const evPad = Math.max((Math.max(...evs) - Math.min(...evs)) * 0.05, 1.5);
    return {
      minEV: Math.floor((Math.min(...evs) - evPad) * 10) / 10,
      maxEV: Math.ceil((Math.max(...evs) + evPad) * 10) / 10,
      minY: Math.max(0, Math.floor((yMin - yPad) * 10) / 10),
      maxY: Math.ceil((yMax + yPad) * 10) / 10,
    };
  }, [leaders, getYVal]);

  const scaleX = useCallback(
    (ev: number) => PAD.left + ((ev - minEV) / (maxEV - minEV)) * plotW,
    [minEV, maxEV, plotW]
  );
  const scaleY = useCallback(
    (val: number) => PAD.top + plotH - ((val - minY) / (maxY - minY)) * plotH,
    [minY, maxY, plotH]
  );

  const crossX = scaleX(SCATTER_LEAGUE_AVG_EV);
  const crossY = scaleY(yOpt.leagueAvg);
  const crossYInBounds = yOpt.leagueAvg >= minY && yOpt.leagueAvg <= maxY;

  const maxHR = useMemo(() => Math.max(1, ...leaders.map((l) => l.home_runs)), [leaders]);

  const getDotRadius = (hr: number) => {
    const base = isMobile ? 4 : 5;
    const scale = isMobile ? 6 : 8;
    return base + (hr / maxHR) * scale;
  };

  const getDotColor = (leader: ExitVeloLeader) => {
    if (leader.xslg >= 0.550) return "#10b981";
    if (leader.xslg >= 0.450) return "#22c55e";
    if (leader.xslg >= 0.350) return "#f59e0b";
    return "#6b7280";
  };

  const quadrantLabels = {
    topLeft: `Low EV / High ${yOpt.shortLabel}`,
    topRight: "Elite Contact",
    bottomLeft: "Weak Contact",
    bottomRight: `High EV / Low ${yOpt.shortLabel}`,
  };

  const activeId = hoveredId ?? selectedId;
  const activeLeader = activeId != null ? leaders.find((l) => l.player_id === activeId) : null;
  const selectedLeader = selectedId != null ? leaders.find((l) => l.player_id === selectedId) : null;


  return (
    <div className="relative">
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Y-Axis:</span>
        <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-md p-0.5">
          {SCATTER_Y_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setYAxis(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                yAxis === opt.value
                  ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>

      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoveredId(null)}
        onClick={(e) => {
          // Click on background deselects
          if ((e.target as SVGElement).tagName === "svg" || (e.target as SVGElement).tagName === "rect" || (e.target as SVGElement).tagName === "line") {
            setSelectedId(null);
          }
        }}
      >
        {/* Background quadrants */}
        {crossYInBounds && (
          <>
            <rect x={PAD.left} y={PAD.top} width={Math.max(0, crossX - PAD.left)} height={Math.max(0, crossY - PAD.top)} fill="rgba(239,68,68,0.04)" />
            <rect x={crossX} y={PAD.top} width={Math.max(0, PAD.left + plotW - crossX)} height={Math.max(0, crossY - PAD.top)} fill="rgba(16,185,129,0.06)" />
            <rect x={PAD.left} y={crossY} width={Math.max(0, crossX - PAD.left)} height={Math.max(0, PAD.top + plotH - crossY)} fill="rgba(239,68,68,0.02)" />
            <rect x={crossX} y={crossY} width={Math.max(0, PAD.left + plotW - crossX)} height={Math.max(0, PAD.top + plotH - crossY)} fill="rgba(245,158,11,0.04)" />
          </>
        )}

        {/* Quadrant labels */}
        <text x={PAD.left + 6} y={PAD.top + 14} className="fill-neutral-400 dark:fill-neutral-500" fontSize={isMobile ? 8 : 10} fontWeight={600}>{quadrantLabels.topLeft}</text>
        <text x={PAD.left + plotW - 6} y={PAD.top + 14} className="fill-emerald-500/70" fontSize={isMobile ? 8 : 10} fontWeight={600} textAnchor="end">{quadrantLabels.topRight}</text>
        <text x={PAD.left + 6} y={PAD.top + plotH - 6} className="fill-red-400/50" fontSize={isMobile ? 8 : 10} fontWeight={600}>{quadrantLabels.bottomLeft}</text>
        <text x={PAD.left + plotW - 6} y={PAD.top + plotH - 6} className="fill-amber-500/70" fontSize={isMobile ? 8 : 10} fontWeight={600} textAnchor="end">{quadrantLabels.bottomRight}</text>

        {/* Crosshairs */}
        <line x1={crossX} y1={PAD.top} x2={crossX} y2={PAD.top + plotH} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} strokeDasharray="4 3" />
        {crossYInBounds && (
          <line x1={PAD.left} y1={crossY} x2={PAD.left + plotW} y2={crossY} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} strokeDasharray="4 3" />
        )}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth={1} />

        {/* X-axis ticks */}
        {Array.from({ length: Math.min(8, Math.round(maxEV - minEV) + 1) }, (_, i) => {
          const val = minEV + Math.round((i / 7) * (maxEV - minEV));
          const x = scaleX(val);
          return (
            <g key={`xt-${i}`}>
              <line x1={x} y1={PAD.top + plotH} x2={x} y2={PAD.top + plotH + 4} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} />
              <text x={x} y={PAD.top + plotH + 16} textAnchor="middle" className="fill-neutral-400 dark:fill-neutral-500" fontSize={10}>{val}</text>
            </g>
          );
        })}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" className="fill-neutral-500 dark:fill-neutral-400" fontSize={11} fontWeight={600}>Avg Exit Velocity (mph)</text>

        {/* Y-axis ticks */}
        {Array.from({ length: 6 }, (_, i) => {
          const val = minY + (i / 5) * (maxY - minY);
          const y = scaleY(val);
          return (
            <g key={`yt-${i}`}>
              <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-neutral-400 dark:fill-neutral-500" fontSize={10}>{yOpt.format(val)}</text>
            </g>
          );
        })}
        <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" className="fill-neutral-500 dark:fill-neutral-400" fontSize={11} fontWeight={600} transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>{yOpt.label}</text>

        {/* Dots — render non-active first, active on top */}
        {leaders.map((l) => {
          const cx = scaleX(l.avg_exit_velo);
          const cy = scaleY(getYVal(l));
          const r = getDotRadius(l.home_runs);
          const isActive = activeId === l.player_id;
          const isSelected = selectedId === l.player_id;
          if (isActive) return null; // Render active dot last (on top)

          return (
            <circle
              key={l.player_id}
              cx={cx}
              cy={cy}
              r={r}
              fill={getDotColor(l)}
              fillOpacity={0.7}
              stroke="transparent"
              strokeWidth={0}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredId(l.player_id)}
              onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === l.player_id ? null : l.player_id); }}
              onTouchStart={() => setSelectedId(selectedId === l.player_id ? null : l.player_id)}
            />
          );
        })}
        {/* Active dot rendered last = on top */}
        {activeLeader && (() => {
          const l = activeLeader;
          const cx = scaleX(l.avg_exit_velo);
          const cy = scaleY(getYVal(l));
          const r = getDotRadius(l.home_runs);
          return (
            <g>
              <circle cx={cx} cy={cy} r={r + 3} fill={getDotColor(l)} fillOpacity={0.95} stroke="white" strokeWidth={2.5} className="cursor-pointer"
                onMouseEnter={() => setHoveredId(l.player_id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === l.player_id ? null : l.player_id); }}
              />
              <text x={cx} y={cy - r - 6} textAnchor="middle" className="fill-neutral-900 dark:fill-white" fontSize={10} fontWeight={700}>
                {l.player_name.split(" ").pop()}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Tooltip card */}
      {activeLeader && (
        <div className="absolute top-4 right-4 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg p-3 min-w-[200px] max-w-[260px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg" style={{ background: activeLeader.primary_color || "#6b7280" }}>
              <img src={getMlbHeadshotUrl(activeLeader.player_id, "small")} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <div>
              <p className="font-bold text-sm text-neutral-900 dark:text-white">{activeLeader.player_name}</p>
              <p className="text-[11px] text-neutral-500">{activeLeader.team_abbr} &bull; {activeLeader.position}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between"><span className="text-neutral-500">Avg EV</span><span className={cn("font-bold tabular-nums", getEvColor(activeLeader.avg_exit_velo))}>{activeLeader.avg_exit_velo.toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Barrel%</span><span className={cn("font-bold tabular-nums", getBarrelColor(activeLeader.barrel_pct))}>{activeLeader.barrel_pct.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">HH%</span><span className={cn("font-bold tabular-nums", getHardHitColor(activeLeader.hard_hit_pct))}>{activeLeader.hard_hit_pct.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">SS%</span><span className="font-bold tabular-nums">{activeLeader.sweet_spot_pct.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">xSLG</span><span className={cn("font-bold tabular-nums", getSlgColor(activeLeader.xslg))}>{activeLeader.xslg.toFixed(3)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">SLG</span><span className={cn("font-bold tabular-nums", getSlgColor(activeLeader.actual_slg))}>{activeLeader.actual_slg.toFixed(3)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">HR</span><span className={cn("font-bold tabular-nums", activeLeader.home_runs > 0 ? "text-emerald-500" : "")}>{activeLeader.home_runs}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Avg LA</span><span className="font-bold tabular-nums">{activeLeader.avg_launch_angle.toFixed(1)}&deg;</span></div>
          </div>
          {!selectedId && (
            <p className="text-[10px] text-neutral-400 mt-2 text-center">Click dot to see batted balls</p>
          )}
        </div>
      )}

      {/* Selected player batted ball detail */}
      {selectedLeader && (
        <div className="mt-3 border border-brand/20 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
          <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md" style={{ background: selectedLeader.primary_color || "#6b7280" }}>
                <img src={getMlbHeadshotUrl(selectedLeader.player_id, "small")} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">{selectedLeader.player_name}</span>
              <span className="text-[10px] text-neutral-400">Last {(selectedLeader.recent_batted_balls ?? []).length} Batted Balls</span>
            </div>
            <button onClick={() => setSelectedId(null)} className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
          <BattedBallExpansion balls={(selectedLeader.recent_batted_balls ?? [])} isMobile={isMobile} />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-400" /> Dot size = HR count
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Color = xSLG
        </span>
        <span>Click dot for detail</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function MlbExitVelocity() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDateState] = useState(() => searchParams.get("date") || getETDate(0));
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);
  const [sampleSize, setSampleSize] = useState(15);
  const [pitcherHand, setPitcherHand] = useState<string>("");
  const [pitchType, setPitchType] = useState<string>("");
  const [matchupSplit, setMatchupSplit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("avg_ev");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<"table" | "scatter">("table");
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(null);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();
  const isGated = !isLoadingAccess && !hasAccess;

  const { leaders, meta, isLoading } = useMlbExitVelocity({
    date: selectedDate,
    sample: sampleSize,
    limit: 200,
    pitcherHand: pitcherHand || undefined,
    pitchType: pitchType || undefined,
    matchupSplit,
  });

  const resolvedDate = meta?.date ?? selectedDate;
  const isFallbackDate = meta && meta.date !== selectedDate;

  const hasActiveFilters = pitcherHand !== "" || pitchType !== "" || matchupSplit;

  // Filter by search
  const filteredLeaders = useMemo(() => {
    if (!searchQuery.trim()) return leaders;
    const q = searchQuery.toLowerCase();
    return leaders.filter(
      (l) =>
        l.player_name.toLowerCase().includes(q) ||
        l.team_abbr.toLowerCase().includes(q) ||
        l.team_name.toLowerCase().includes(q)
    );
  }, [leaders, searchQuery]);

  // Sort
  const sortedLeaders = useMemo(() => {
    return [...filteredLeaders].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "rank": case "avg_ev": aVal = a.avg_exit_velo; bVal = b.avg_exit_velo; break;
        case "player": aVal = a.player_name; bVal = b.player_name; break;
        case "max_ev": aVal = a.max_exit_velo; bVal = b.max_exit_velo; break;
        case "barrel_pct": aVal = a.barrel_pct; bVal = b.barrel_pct; break;
        case "hard_hit_pct": aVal = a.hard_hit_pct; bVal = b.hard_hit_pct; break;
        case "sweet_spot": aVal = a.sweet_spot_pct; bVal = b.sweet_spot_pct; break;
        case "avg_la": aVal = a.avg_launch_angle; bVal = b.avg_launch_angle; break;
        case "avg_distance": aVal = a.avg_distance; bVal = b.avg_distance; break;
        case "hits": aVal = a.hits; bVal = b.hits; break;
        case "home_runs": aVal = a.home_runs; bVal = b.home_runs; break;
        case "xbh": aVal = a.xbh; bVal = b.xbh; break;
        case "xslg": aVal = a.xslg; bVal = b.xslg; break;
        case "actual_slg": aVal = a.actual_slg; bVal = b.actual_slg; break;
        case "slg_diff": aVal = a.slg_diff; bVal = b.slg_diff; break;
        case "trend": aVal = a.ev_vs_season; bVal = b.ev_vs_season; break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      const numA = typeof aVal === "number" ? aVal : 0;
      const numB = typeof bVal === "number" ? bVal : 0;
      return sortDirection === "desc" ? numB - numA : numA - numB;
    });
  }, [filteredLeaders, sortField, sortDirection]);

  const displayLeaders = isGated ? sortedLeaders.slice(0, FREE_MAX_ROWS) : sortedLeaders;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div data-tour="ev-filter-bar" className="overflow-hidden">
        <SheetFilterBar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          right={
            <>
              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === "table"
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                  title="Table view"
                >
                  <Table className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("scatter")}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === "scatter"
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                  title="Scatter plot: EV vs Barrel Rate"
                >
                  <ScatterChartIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search..." />
              {hasActiveFilters && (
                <button
                  onClick={() => { setPitcherHand(""); setPitchType(""); setMatchupSplit(false); }}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Reset filters"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <FilterCount count={leaders.length} label="players" />
            </>
          }
          legend={
            <>
              <span className="font-medium text-neutral-500">EV:</span>
              <span><strong className="text-emerald-600 dark:text-emerald-400">93+</strong> Elite</span>
              <span><strong className="text-green-600 dark:text-green-400">90+</strong> Strong</span>
              <span><strong className="text-amber-500">88+</strong> Above Avg</span>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" />LD</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70" />FB</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/70" />GB</span>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <span>HH% = 95+ mph</span>
              <span>SS% = 8-32&deg; LA</span>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <span>+Diff = unlucky</span>
              <span>-Diff = lucky</span>
            </>
          }
          mobileControls={
            <>
              <FilterSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search player..." />
              <div className="flex items-center gap-2 w-full">
                <SegmentedControl
                  fullWidth
                  value={String(sampleSize)}
                  onChange={(v) => setSampleSize(Number(v) as 10 | 15 | 25 | 50)}
                  options={SAMPLE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
                />
                <SegmentedControl
                  value={pitcherHand}
                  onChange={setPitcherHand}
                  options={[
                    { label: "All", value: "" },
                    { label: "LHP", value: "L" },
                    { label: "RHP", value: "R" },
                  ]}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMatchupSplit(!matchupSplit);
                    if (!matchupSplit) setPitcherHand("");
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    matchupSplit
                      ? "bg-brand/10 text-brand border border-brand/30"
                      : "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500"
                  )}
                >
                  vs Matchup
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setPitcherHand(""); setPitchType(""); setMatchupSplit(false); }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 bg-neutral-100 dark:bg-neutral-800/60 transition-colors"
                    title="Reset filters"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          }
        >
          <SegmentedControl
            value={String(sampleSize)}
            onChange={(v) => setSampleSize(Number(v) as 10 | 15 | 25 | 50)}
            options={SAMPLE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
          />
          <FilterDivider />
          <SegmentedControl
            value={pitcherHand}
            onChange={setPitcherHand}
            options={[
              { label: "All", value: "" },
              { label: "vs LHP", value: "L" },
              { label: "vs RHP", value: "R" },
            ]}
          />
          <Tooltip content="Show each batter's splits vs the hand of their opposing pitcher today" side="bottom">
            <button
              onClick={() => {
                setMatchupSplit(!matchupSplit);
                if (!matchupSplit) setPitcherHand("");
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-help",
                matchupSplit
                  ? "bg-brand/10 text-brand border border-brand/30"
                  : "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              vs Matchup
            </button>
          </Tooltip>
          <FilterDivider />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/30 rounded-lg px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors outline-none">
              {pitchType ? (PITCH_TYPE_LABELS[pitchType] ?? pitchType) : "All Pitches"}
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px] p-1">
              <DropdownMenuItem
                onClick={() => setPitchType("")}
                className={cn("text-xs", !pitchType && "font-semibold text-brand")}
              >
                All Pitches
              </DropdownMenuItem>
              {(meta?.available_pitch_types ?? []).map((pt) => (
                <DropdownMenuItem
                  key={pt}
                  onClick={() => setPitchType(pt)}
                  className={cn("text-xs", pitchType === pt && "font-semibold text-brand")}
                >
                  {PITCH_TYPE_LABELS[pt] ?? pt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SheetFilterBar>

        {/* Active filter pills + fallback date */}
        {(hasActiveFilters || isFallbackDate) && !isLoading && (
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-t border-neutral-200/40 dark:border-neutral-700/20 bg-neutral-50/50 dark:bg-neutral-800/20">
            {matchupSplit && (
              <button
                onClick={() => setMatchupSplit(false)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[11px] font-semibold hover:bg-brand/20 transition-colors"
              >
                vs Matchup Splits
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {pitcherHand && (
              <button
                onClick={() => setPitcherHand("")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[11px] font-semibold hover:bg-brand/20 transition-colors"
              >
                {pitcherHand === "L" ? "vs LHP" : "vs RHP"}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {pitchType && (
              <button
                onClick={() => setPitchType("")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[11px] font-semibold hover:bg-brand/20 transition-colors"
              >
                {PITCH_TYPE_LABELS[pitchType] ?? pitchType}
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {isFallbackDate && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                No data for {formatLongDate(selectedDate)} — showing <strong>{formatLongDate(resolvedDate)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Table / Cards / Scatter ────────────────────────────────────── */}
      <div data-tour="ev-table" className="relative">
        {viewMode === "scatter" && !isLoading && sortedLeaders.length > 0 ? (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden p-4">
            <div className="max-w-5xl mx-auto">
              <EvScatterPlot leaders={displayLeaders} isMobile={!!isMobile} />
            </div>
          </div>
        ) : isMobile && !isLoading && sortedLeaders.length > 0 ? (
          <div className="space-y-3 pt-3">
            {displayLeaders.map((leader, idx) => {
              const isExpanded = expandedPlayerId === leader.player_id;
              return (
                <div key={`${leader.player_id}-${idx}`}>
                  <div onClick={() => setExpandedPlayerId(isExpanded ? null : leader.player_id)} className="cursor-pointer">
                    <MobileEvCard leader={leader} rank={idx + 1} />
                  </div>
                  {isExpanded && (
                    <div className="mt-1 rounded-xl border border-brand/20 overflow-hidden bg-white dark:bg-neutral-900">
                      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/50">
                        <span className="text-xs font-semibold text-neutral-500">
                          Last {((leader.recent_batted_balls ?? []) ?? []).length} Batted Balls
                        </span>
                      </div>
                      <BattedBallExpansion balls={(leader.recent_batted_balls ?? [])} isMobile={true} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 bg-gradient-to-b from-transparent to-neutral-50/50 dark:to-neutral-950/50">
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand/30 border-t-brand" />
                    <Chart className="absolute inset-0 m-auto h-5 w-5 text-brand/60" />
                  </div>
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mt-4">Crunching advanced data...</p>
                </div>
              </div>
            ) : sortedLeaders.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center max-w-sm">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No exit velocity data</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {searchQuery ? "No players match your search." : "No advanced data available for this date."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[400px]">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-neutral-50/95 dark:bg-neutral-800/90 backdrop-blur-sm">
                      <th className="h-10 px-3 w-10 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        #
                      </th>
                      <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[180px] bg-neutral-50/95 dark:bg-neutral-800/95">
                        <button onClick={() => handleSort("player")} className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                          Player <SortIcon field="player" currentField={sortField} direction={sortDirection} />
                        </button>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[100px] bg-neutral-50/95 dark:bg-neutral-800/95">
                        <button onClick={() => handleSort("avg_ev")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                          Avg EV <SortIcon field="avg_ev" currentField={sortField} direction={sortDirection} />
                        </button>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <button onClick={() => handleSort("max_ev")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                          Max <SortIcon field="max_ev" currentField={sortField} direction={sortDirection} />
                        </button>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Barrel Rate: Optimal EV + launch angle combo" side="top">
                          <button onClick={() => handleSort("barrel_pct")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            Brl% <SortIcon field="barrel_pct" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Hard Hit Rate: Balls hit 95+ mph" side="top">
                          <button onClick={() => handleSort("hard_hit_pct")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            HH% <SortIcon field="hard_hit_pct" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Sweet Spot: Launch angle 8-32 degrees" side="top">
                          <button onClick={() => handleSort("sweet_spot")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            SS% <SortIcon field="sweet_spot" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Average Launch Angle (degrees)" side="top">
                          <button onClick={() => handleSort("avg_la")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            Avg LA <SortIcon field="avg_la" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Expected Slugging based on EV + Launch Angle" side="top">
                          <button onClick={() => handleSort("xslg")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            xSLG <SortIcon field="xslg" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Actual Slugging from batted ball outcomes" side="top">
                          <button onClick={() => handleSort("actual_slg")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            SLG <SortIcon field="actual_slg" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="xSLG minus actual SLG: positive = unlucky, negative = lucky" side="top">
                          <button onClick={() => handleSort("slg_diff")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            Diff <SortIcon field="slg_diff" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="Avg / Max batted ball distance (ft)" side="top">
                          <button onClick={() => handleSort("avg_distance")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help">
                            Avg. Dist <SortIcon field="avg_distance" currentField={sortField} direction={sortDirection} />
                          </button>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <Tooltip content="H / HR / XBH in sample" side="top">
                          <span className="cursor-help">Results</span>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[110px] bg-neutral-50/95 dark:bg-neutral-800/95">
                        <Tooltip content="LD / FB / GB split" side="top">
                          <span className="cursor-help">Trajectory</span>
                        </Tooltip>
                      </th>
                      <th className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40">
                        <button onClick={() => handleSort("trend")} className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
                          Trend <SortIcon field="trend" currentField={sortField} direction={sortDirection} />
                        </button>
                      </th>
                      <th className="h-10 w-8 border-b border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/80 dark:bg-neutral-800/40" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                    {displayLeaders.map((leader, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-50/50 dark:bg-neutral-800/20";
                      const rank = idx + 1;
                      const isExpanded = expandedPlayerId === leader.player_id;

                      return (
                        <React.Fragment key={`${leader.player_id}-${idx}`}>
                        <tr
                          className={cn(rowBg, "group hover:bg-neutral-50/80 dark:hover:bg-neutral-800/20 transition-all duration-150 cursor-pointer", isExpanded && "bg-sky-50/40 dark:bg-sky-500/[0.04]")}
                          onClick={() => setExpandedPlayerId(isExpanded ? null : leader.player_id)}
                        >
                          {/* Rank */}
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold tabular-nums",
                                rank <= 3
                                  ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                                  : rank <= 10
                                    ? "bg-brand/10 text-brand"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                              )}
                            >
                              {rank}
                            </span>
                          </td>

                          {/* Player */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg transition-transform duration-150 group-hover:scale-[1.03]"
                                style={{
                                  background:
                                    leader.primary_color && leader.secondary_color
                                      ? `linear-gradient(180deg, ${leader.primary_color} 0%, ${leader.primary_color} 55%, ${leader.secondary_color} 100%)`
                                      : leader.primary_color || "#6b7280",
                                }}
                              >
                                <img src={getMlbHeadshotUrl(leader.player_id, "small")} alt={leader.player_name} className="h-full w-full object-cover" loading="lazy" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">{leader.player_name}</span>
                                  <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
                                    {leader.batting_hand === "L" ? "LHB" : leader.batting_hand === "S" ? "SHB" : "RHB"}
                                  </span>
                                  {matchupSplit && leader.opposing_pitcher_hand && (
                                    <Tooltip content={`Showing splits vs ${leader.opposing_pitcher_hand === "L" ? "left" : "right"}-handed pitching`} side="top">
                                      <span className={cn(
                                        "text-[9px] font-bold px-1 py-0.5 rounded cursor-help",
                                        leader.opposing_pitcher_hand === "L"
                                          ? "bg-orange-500/10 text-orange-500"
                                          : "bg-blue-500/10 text-blue-500"
                                      )}>
                                        vs {leader.opposing_pitcher_hand}HP
                                      </span>
                                    </Tooltip>
                                  )}
                                  {!matchupSplit && pitcherHand && (
                                    <span className={cn(
                                      "text-[9px] font-bold px-1 py-0.5 rounded",
                                      pitcherHand === "L"
                                        ? "bg-orange-500/10 text-orange-500"
                                        : "bg-blue-500/10 text-blue-500"
                                    )}>
                                      vs {pitcherHand}HP
                                    </span>
                                  )}
                                  {leader.ev_trend === "hot" && <Flame className="w-3 h-3 text-red-500" />}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                                  <img src={`/team-logos/mlb/${leader.team_abbr.toUpperCase()}.svg`} alt={leader.team_abbr} className="h-3.5 w-3.5 object-contain" />
                                  <span>{leader.position}</span>
                                  <span className="text-neutral-300 dark:text-neutral-600">&bull;</span>
                                  <span>
                                    {leader.home_away === "H" ? "vs" : "@"} {leader.opponent_team_abbr}
                                    {leader.opposing_pitcher && (
                                      <span className="text-neutral-400">
                                        {" "}({leader.opposing_pitcher.split(" ").pop()}
                                        {leader.opposing_pitcher_hand && <span className="text-neutral-400">, {leader.opposing_pitcher_hand}HP</span>})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Avg EV */}
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn("text-sm font-bold tabular-nums", getEvColor(leader.avg_exit_velo))}>
                                {leader.avg_exit_velo.toFixed(1)}
                              </span>
                              <EvMeter value={leader.avg_exit_velo} />
                              <span className="text-[10px] text-neutral-400 tabular-nums">
                                Szn {leader.season_avg_ev?.toFixed(1) ?? "—"} &bull; {leader.total_batted_balls} BB
                              </span>
                            </div>
                          </td>

                          {/* Max EV */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-semibold tabular-nums", getEvColor(leader.max_exit_velo))}>
                              {leader.max_exit_velo.toFixed(1)}
                            </span>
                          </td>

                          {/* Barrel % */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className={cn("text-sm font-bold tabular-nums", getBarrelColor(leader.barrel_pct))}>
                                {leader.barrel_pct.toFixed(1)}%
                              </span>
                              <span className="text-[10px] text-neutral-400 tabular-nums">{leader.barrels} brl</span>
                            </div>
                          </td>

                          {/* Hard Hit % */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-bold tabular-nums", getHardHitColor(leader.hard_hit_pct))}>
                              {leader.hard_hit_pct.toFixed(1)}%
                            </span>
                          </td>

                          {/* Sweet Spot % */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn(
                              "text-sm font-semibold tabular-nums",
                              leader.sweet_spot_pct >= 40 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-600 dark:text-neutral-400"
                            )}>
                              {leader.sweet_spot_pct.toFixed(1)}%
                            </span>
                          </td>

                          {/* Avg LA */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-semibold tabular-nums", getLaColor(leader.avg_launch_angle))}>
                              {leader.avg_launch_angle.toFixed(1)}&deg;
                            </span>
                          </td>

                          {/* xSLG */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-bold tabular-nums", getSlgColor(leader.xslg))}>
                              {leader.xslg.toFixed(3)}
                            </span>
                          </td>

                          {/* Actual SLG */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-semibold tabular-nums", getSlgColor(leader.actual_slg))}>
                              {leader.actual_slg.toFixed(3)}
                            </span>
                          </td>

                          {/* SLG Diff */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("text-sm font-semibold tabular-nums", getSlgDiffColor(leader.slg_diff))}>
                              {leader.slg_diff >= 0 ? "+" : ""}{leader.slg_diff.toFixed(3)}
                            </span>
                          </td>

                          {/* Distance */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{leader.avg_distance}ft</span>
                              <span className="text-[10px] text-neutral-400 tabular-nums">max {leader.max_distance}ft</span>
                            </div>
                          </td>

                          {/* Results */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-center gap-1.5 text-xs tabular-nums">
                              <span className="font-bold text-neutral-900 dark:text-white">{leader.hits}H</span>
                              <span className="text-neutral-300 dark:text-neutral-600">/</span>
                              <span className={cn("font-bold", leader.home_runs > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400")}>{leader.home_runs}HR</span>
                              <span className="text-neutral-300 dark:text-neutral-600">/</span>
                              <span className={cn("font-bold", leader.xbh > 0 ? "text-green-600 dark:text-green-400" : "text-neutral-400")}>{leader.xbh}XBH</span>
                            </div>
                          </td>

                          {/* Trajectory */}
                          <td className="px-3 py-2.5">
                            <div className="flex h-3 rounded-sm overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                              {leader.line_drive_pct > 0 && (
                                <Tooltip content={`LD ${leader.line_drive_pct.toFixed(1)}%`} side="top">
                                  <div className="h-full bg-emerald-500/80 cursor-help" style={{ width: `${leader.line_drive_pct}%` }} />
                                </Tooltip>
                              )}
                              {leader.fly_ball_pct > 0 && (
                                <Tooltip content={`FB ${leader.fly_ball_pct.toFixed(1)}%`} side="top">
                                  <div className="h-full bg-blue-500/80 cursor-help" style={{ width: `${leader.fly_ball_pct}%` }} />
                                </Tooltip>
                              )}
                              {leader.ground_ball_pct > 0 && (
                                <Tooltip content={`GB ${leader.ground_ball_pct.toFixed(1)}%`} side="top">
                                  <div className="h-full bg-amber-500/80 cursor-help" style={{ width: `${leader.ground_ball_pct}%` }} />
                                </Tooltip>
                              )}
                            </div>
                          </td>

                          {/* Trend */}
                          <td className="px-3 py-2.5">
                            <div className="flex justify-center">
                              <TrendBadge trend={leader.ev_trend} diff={leader.ev_vs_season} />
                            </div>
                          </td>

                          {/* Expand chevron */}
                          <td className="px-1 py-2.5 text-center">
                            <ChevronRight className={cn("w-4 h-4 text-neutral-400 transition-transform duration-200", isExpanded && "rotate-90 text-brand")} />
                          </td>
                        </tr>

                        {/* Expansion row */}
                        {isExpanded && (
                          <tr className="bg-neutral-50/50 dark:bg-neutral-800/20">
                            <td colSpan={16} className="p-0">
                              <div className="border-t border-b border-neutral-200/40 dark:border-neutral-700/20 bg-white/50 dark:bg-neutral-900/50">
                                <div className="px-4 py-2 border-b border-neutral-200/40 dark:border-neutral-700/20">
                                  <span className="text-xs font-semibold text-neutral-500">
                                    Last {((leader.recent_batted_balls ?? []) ?? []).length} Batted Balls
                                  </span>
                                </div>
                                <BattedBallExpansion balls={(leader.recent_batted_balls ?? [])} isMobile={false} />
                              </div>
                            </td>
                          </tr>
                        )}
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
        {isGated && sortedLeaders.length > FREE_MAX_ROWS && (
          <div className="relative">
            <div className="absolute inset-x-0 -top-24 h-24 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none" />
            <div className="px-4 py-8 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-b-2xl">
              <div className="max-w-lg mx-auto text-center">
                <Lock className="w-8 h-8 text-brand mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  Unlock Full Exit Velocity Data
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-5">
                  See all {meta?.total_players_with_data ?? sortedLeaders.length} players with advanced data, barrel rates, trends, and contact quality.
                </p>
                <ButtonLink
                  href={UPGRADE_URL}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/25"
                >
                  Upgrade Now
                  <ArrowRight className="w-4 h-4" />
                </ButtonLink>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

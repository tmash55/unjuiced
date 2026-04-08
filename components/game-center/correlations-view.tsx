"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePropStacks, useLineupChain, usePitcherImpact, useTeamScoring } from "@/hooks/use-mlb-correlation-sections";
import type { PropStack } from "@/app/api/mlb/correlations/prop-stacks/route";
import type { LineupChainLink } from "@/app/api/mlb/correlations/lineup-chain/route";
import type { PitcherImpactRow } from "@/app/api/mlb/correlations/pitcher-impact/route";
import type { TeamScoringRow } from "@/app/api/mlb/correlations/team-scoring/route";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Heart,
  Zap,
  Users,
  TrendingUp,
  BarChart3,
  Link2,
  ArrowRight,
  Star,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const MARKET_LABELS: Record<string, string> = {
  hits: "Hits", hr: "HR", tb: "TB", rbi: "RBI", runs: "Runs", sb: "SB",
  total_bases: "TB", stolen_bases: "SB", home_runs: "HR",
  pitcher_k: "Ks", pitcher_h: "Hits Allowed", pitcher_er: "ER",
  strikeouts: "Ks", earned_runs: "ER", hits_allowed: "Hits Allowed",
};

const MARKET_FILTERS = [
  { value: "all", label: "All" },
  { value: "hits", label: "Hits" },
  { value: "hr", label: "HR" },
  { value: "rbi", label: "RBI" },
  { value: "tb", label: "TB" },
  { value: "runs", label: "Runs" },
  { value: "sb", label: "SB" },
];

function marketLabel(m: string): string { return MARKET_LABELS[m] ?? m; }

const SUFFIXES = new Set(["Jr.", "Jr", "Sr.", "Sr", "II", "III", "IV", "V"]);
/** Get last name, handling suffixes like "Victor Scott II" → "Scott II" */
function lastName(full: string): string {
  const parts = full.trim().split(" ");
  if (parts.length <= 1) return full;
  // If last part is a suffix, take the part before it + suffix
  if (parts.length >= 3 && SUFFIXES.has(parts[parts.length - 1])) {
    return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1];
}

// ── Confidence Badge ─────────────────────────────────────────────────────────

const TIERS: Record<string, { color: string; bg: string }> = {
  S: { color: "text-emerald-400", bg: "bg-emerald-500/15" },
  A: { color: "text-blue-400", bg: "bg-blue-500/15" },
  B: { color: "text-neutral-400", bg: "bg-neutral-500/10" },
  C: { color: "text-neutral-500", bg: "bg-neutral-500/8" },
};

function TierBadge({ tier }: { tier: string }) {
  const t = TIERS[tier] ?? TIERS.C;
  return <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full", t.bg, t.color)}>{tier}</span>;
}

function barColor(pct: number): string {
  if (pct >= 60) return "bg-emerald-500";
  if (pct >= 50) return "bg-teal-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-neutral-500";
}

function pctColor(pct: number): string {
  if (pct >= 60) return "text-emerald-400";
  if (pct >= 50) return "text-teal-400";
  if (pct >= 40) return "text-amber-400";
  return "text-neutral-400";
}

// ── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  collapsed,
  onToggle,
  count,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 py-3 group transition-colors",
        onToggle && "cursor-pointer hover:opacity-80"
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{title}</h3>
          {count != null && count > 0 && (
            <span className="text-[10px] font-medium text-neutral-400 tabular-nums">{count}</span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {onToggle && (
        <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", !collapsed && "rotate-180")} />
      )}
    </button>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-white dark:bg-neutral-900 p-4 animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="h-2.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full mb-3" />
      <div className="h-2 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
    </div>
  );
}

// ── Prop Stack Card ──────────────────────────────────────────────────────────

function PropStackCard({ stack, rank, onAddToParlay }: { stack: PropStack; rank: number; onAddToParlay?: (stack: PropStack) => void }) {
  const [expanded, setExpanded] = useState(false);
  const pct = stack.co_occurrence_pct;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden transition-all group/card",
        pct >= 60 ? "border-emerald-500/30" : pct >= 50 ? "border-teal-500/20" : "border-neutral-200/40 dark:border-neutral-800/40"
      )}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        {/* Top section: percentage hero + players */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            {/* Big percentage — the hero number */}
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
              pct >= 60 ? "bg-emerald-500/10" : pct >= 50 ? "bg-teal-500/10" : "bg-neutral-100 dark:bg-neutral-800/60"
            )}>
              <span className={cn("text-xl font-black tabular-nums", pctColor(pct))}>
                {pct.toFixed(0)}
                <span className="text-xs">%</span>
              </span>
            </div>

            {/* Players + props */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Player A */}
              <div className="flex items-center gap-2">
                <Image
                  src={getMlbHeadshotUrl(stack.player_a_id, "tiny")}
                  alt="" width={24} height={24}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                  unoptimized
                />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  {lastName(stack.player_a_name)}
                </span>
                <span className="text-[10px] font-medium text-brand shrink-0">
                  {stack.threshold_a}+ {marketLabel(stack.market_a)}
                </span>
              </div>
              {/* Player B */}
              <div className="flex items-center gap-2">
                <Image
                  src={getMlbHeadshotUrl(stack.player_b_id, "tiny")}
                  alt="" width={24} height={24}
                  className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                  unoptimized
                />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  {lastName(stack.player_b_name)}
                </span>
                <span className="text-[10px] font-medium text-brand shrink-0">
                  {stack.threshold_b}+ {marketLabel(stack.market_b)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar: progress + meta */}
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden mb-2">
            <div
              className={cn("h-full rounded-full transition-all", barColor(pct))}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span className="tabular-nums">{stack.games_together} shared games</span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-400 transition-transform", expanded && "rotate-180")} />
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-neutral-100 dark:border-neutral-800/40">
          <div className="mt-3 space-y-1.5 text-[11px] text-neutral-500">
            <p>
              When <span className="font-semibold text-neutral-200">{lastName(stack.player_a_name)}</span> gets {stack.threshold_a}+ {marketLabel(stack.market_a)},{" "}
              <span className="font-semibold text-neutral-200">{lastName(stack.player_b_name)}</span> gets {stack.threshold_b}+ {marketLabel(stack.market_b)} in{" "}
              <span className={cn("font-bold", pctColor(pct))}>{pct.toFixed(1)}%</span> of those games
            </p>
            <p>
              Both hit: <span className="font-semibold text-neutral-300">{stack.games_both_hit}</span> of <span className="font-semibold text-neutral-300">{stack.games_together}</span> games
              {stack.games_a_hit > 0 && (
                <span> · {lastName(stack.player_a_name)} hit alone: {stack.games_a_hit - stack.games_both_hit}</span>
              )}
            </p>
          </div>
          {onAddToParlay && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToParlay(stack); }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
            >
              <Heart className="w-3.5 h-3.5" />
              Add to Parlay
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lineup Flow ──────────────────────────────────────────────────────────────

// Shared pair aggregation for lineup flow
function useLineupPairs(chain: LineupChainLink[]) {
  return useMemo(() => {
    const map = new Map<string, { link: LineupChainLink; onbaseRbi?: number; hitRun?: number }>();
    for (const l of chain) {
      const key = `${l.player_a_slot}-${l.player_b_slot}`;
      if (!map.has(key)) map.set(key, { link: l });
      const e = map.get(key)!;
      if (l.correlation_type === "a_onbase_b_rbi") e.onbaseRbi = l.co_occurrence_pct;
      else if (l.correlation_type === "a_hit_b_run") e.hitRun = l.co_occurrence_pct;
    }
    return Array.from(map.values()).sort((a, b) => a.link.player_a_slot - b.link.player_a_slot);
  }, [chain]);
}

function LineupFlowSection({ chain, isMobile }: { chain: LineupChainLink[]; isMobile: boolean }) {
  const pairs = useLineupPairs(chain);
  if (pairs.length === 0) return null;

  // Build unique player list in batting order
  const players = useMemo(() => {
    const map = new Map<number, { id: number; name: string; slot: number }>();
    for (const p of pairs) {
      if (!map.has(p.link.player_a_slot)) map.set(p.link.player_a_slot, { id: p.link.player_a_id, name: p.link.player_a_name, slot: p.link.player_a_slot });
      if (!map.has(p.link.player_b_slot)) map.set(p.link.player_b_slot, { id: p.link.player_b_id, name: p.link.player_b_name, slot: p.link.player_b_slot });
    }
    return [...map.values()].sort((a, b) => a.slot - b.slot);
  }, [pairs]);

  // Map pairs by slot for quick lookup
  const pairBySlot = useMemo(() => {
    const map = new Map<number, typeof pairs[0]>();
    for (const p of pairs) map.set(p.link.player_a_slot, p);
    return map;
  }, [pairs]);

  return (
    <div className="rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/40">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Batting Order Chain</span>
        </div>
        {/* Dynamic example from real data */}
        {(() => {
          const bestOb = pairs.reduce<typeof pairs[0] | null>((best, p) => (!best || (p.onbaseRbi ?? 0) > (best.onbaseRbi ?? 0)) ? p : best, null);
          const bestHr = pairs.reduce<typeof pairs[0] | null>((best, p) => (!best || (p.hitRun ?? 0) > (best.hitRun ?? 0)) ? p : best, null);
          if (!bestOb && !bestHr) return null;
          return (
            <div className="space-y-1 text-[10px] text-neutral-500">
              {bestOb && bestOb.onbaseRbi != null && (
                <p>
                  <span className="font-bold text-neutral-400">OB→RBI</span>{" "}
                  When <span className="font-semibold text-neutral-300">{lastName(bestOb.link.player_a_name)}</span> reaches base,{" "}
                  <span className="font-semibold text-neutral-300">{lastName(bestOb.link.player_b_name)}</span> drives in a run{" "}
                  <span className={cn("font-bold", pctColor(bestOb.onbaseRbi))}>{bestOb.onbaseRbi.toFixed(0)}%</span> of the time
                </p>
              )}
              {bestHr && bestHr.hitRun != null && (
                <p>
                  <span className="font-bold text-neutral-400">Hit→Run</span>{" "}
                  When <span className="font-semibold text-neutral-300">{lastName(bestHr.link.player_a_name)}</span> gets a hit,{" "}
                  <span className="font-semibold text-neutral-300">{lastName(bestHr.link.player_b_name)}</span> scores a run{" "}
                  <span className={cn("font-bold", pctColor(bestHr.hitRun))}>{bestHr.hitRun.toFixed(0)}%</span> of the time
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {players.map((player, i) => {
        const pair = pairBySlot.get(player.slot);
        const bestPct = pair ? Math.max(pair.onbaseRbi ?? 0, pair.hitRun ?? 0) : 0;
        const isLast = i === players.length - 1;

        return (
          <div key={player.slot}>
            {/* Player row */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              {/* Slot number */}
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                player.slot <= 3 ? "bg-brand/10 text-brand" : player.slot <= 6 ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500" : "bg-neutral-50 dark:bg-neutral-800/50 text-neutral-400"
              )}>
                {player.slot}
              </span>

              {/* Headshot */}
              <Image
                src={getMlbHeadshotUrl(player.id, "tiny")}
                alt="" width={28} height={28}
                className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                unoptimized
              />

              {/* Name */}
              <span className="text-xs font-semibold text-neutral-900 dark:text-white flex-1 min-w-0 truncate">
                {isMobile ? lastName(player.name) : player.name}
              </span>
            </div>

            {/* Connection bar between this player and next (including 9→1 wrap) */}
            {pair && (
              <div className={cn(
                "flex items-center gap-3 px-4 py-1 ml-2.5 border-l-2 border-dashed",
                isLast ? "border-brand/40" : "border-neutral-200 dark:border-neutral-700"
              )}>
                {/* Connecting line visual */}
                <div className="w-5 shrink-0" />
                <div className="flex-1 flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden shrink-0">
                    <div
                      className={cn("h-full rounded-full", barColor(bestPct))}
                      style={{ width: `${Math.min(bestPct, 100)}%` }}
                    />
                  </div>
                  {/* Stats */}
                  <div className="space-y-0.5 text-[10px]">
                    {pair.onbaseRbi != null && (
                      <p className="text-neutral-500">
                        When <span className="font-semibold text-neutral-300">{lastName(pair.link.player_a_name)}</span> reaches base,{" "}
                        <span className="font-semibold text-neutral-300">{lastName(pair.link.player_b_name)}</span> drives in a run{" "}
                        <span className={cn("font-bold", pctColor(pair.onbaseRbi))}>{pair.onbaseRbi.toFixed(0)}%</span> of the time
                      </p>
                    )}
                    {pair.hitRun != null && (
                      <p className="text-neutral-500">
                        When <span className="font-semibold text-neutral-300">{lastName(pair.link.player_a_name)}</span> gets a hit,{" "}
                        <span className="font-semibold text-neutral-300">{lastName(pair.link.player_b_name)}</span> scores a run{" "}
                        <span className={cn("font-bold", pctColor(pair.hitRun))}>{pair.hitRun.toFixed(0)}%</span> of the time
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-neutral-400 tabular-nums">{pair.link.games_together} shared games</span>
                      {isLast && <span className="text-[9px] font-semibold text-brand">↩ back to #1</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pitcher Impact Card ──────────────────────────────────────────────────────

const PI_TYPE_ORDER = ["strikeouts", "earned_runs", "innings_pitched"];
const PI_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  strikeouts: { label: "Strikeouts", icon: "K" },
  earned_runs: { label: "Earned Runs", icon: "ER" },
  innings_pitched: { label: "Innings Pitched", icon: "IP" },
};

function formatThreshold(type: string, val: string | number): string {
  if (type === "earned_runs") return `${val} ER`;
  if (type === "innings_pitched") return `${val}+ IP`;
  return `${val}+ K`;
}

function PitcherImpactCard({ pitcherName, rows }: { pitcherName: string; rows: PitcherImpactRow[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, PitcherImpactRow[]>();
    for (const r of rows) {
      if (!map.has(r.threshold_type)) map.set(r.threshold_type, []);
      map.get(r.threshold_type)!.push(r);
    }
    return map;
  }, [rows]);

  const bestStat = useMemo(() => {
    let best: PitcherImpactRow | null = null;
    for (const r of rows) {
      if ((r.win_pct ?? 0) >= 70 && (r.pct ?? 0) >= 25) {
        if (!best || (r.win_pct ?? 0) > (best.win_pct ?? 0)) best = r;
      }
    }
    return best;
  }, [rows]);

  const orderedTypes = PI_TYPE_ORDER.filter((t) => grouped.has(t));

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/40">
        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{pitcherName}</h4>
      </div>
      <div className="p-4 space-y-5">
        {orderedTypes.map((type) => {
          const typeRows = grouped.get(type) ?? [];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  {PI_TYPE_LABELS[type]?.icon ?? type.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {PI_TYPE_LABELS[type]?.label ?? type}
                </span>
              </div>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_70px_80px_70px] gap-x-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 px-2">
                <span>Threshold</span>
                <span className="text-right">Frequency</span>
                <span className="text-right">Team Win %</span>
                <span className="text-right">Opp Runs</span>
              </div>
              {/* Rows */}
              <div className="space-y-0.5">
                {typeRows.map((r, ri) => {
                  const winPct = r.win_pct ?? 0;
                  const isBest = r === bestStat;
                  return (
                    <div
                      key={`${type}-${r.threshold_value}-${ri}`}
                      className={cn(
                        "grid grid-cols-[1fr_70px_80px_70px] gap-x-2 items-center px-2 py-1.5 rounded-lg text-xs",
                        isBest ? "bg-emerald-500/8 ring-1 ring-emerald-500/20" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                      )}
                    >
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {formatThreshold(type, r.threshold_value)}
                        {isBest && <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline ml-1" />}
                      </span>
                      <span className="text-right text-neutral-500 tabular-nums">
                        {r.pct != null ? `${Number(r.pct).toFixed(0)}%` : "—"}
                      </span>
                      <span className={cn(
                        "text-right font-bold tabular-nums",
                        winPct >= 70 ? "text-emerald-500" : winPct >= 50 ? "text-amber-500" : "text-red-500"
                      )}>
                        {r.win_pct != null ? `${Number(r.win_pct).toFixed(0)}%` : "—"}
                      </span>
                      <span className="text-right text-neutral-500 tabular-nums">
                        {r.avg_team_runs != null ? Number(r.avg_team_runs).toFixed(1) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {bestStat && (
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/20">
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
            <Zap className="w-3 h-3 text-amber-400 inline mr-1" />
            When {pitcherName} {bestStat.threshold_type === "earned_runs" ? "allows" : "records"} {formatThreshold(bestStat.threshold_type, bestStat.threshold_value)}, his team wins{" "}
            <span className="font-bold text-emerald-500">{bestStat.win_pct != null ? Number(bestStat.win_pct).toFixed(0) : "?"}%</span> of the time
            ({bestStat.games_count ?? "?"} of {bestStat.total_games ?? "?"} starts).
          </p>
        </div>
      )}
    </div>
  );
}

// ── Team Scoring Table ───────────────────────────────────────────────────────

// Preferred column order for team scoring (most useful first)
const CONDITION_ORDER = ["team_wins", "team_scores_5+", "team_scores_7+", "team_loses"];
const CONDITION_LABELS: Record<string, { header: string; subheader: string }> = {
  team_wins: { header: "Team Wins", subheader: "Gets hit when team wins" },
  team_loses: { header: "Team Loses", subheader: "Gets hit when team loses" },
  "team_scores_5+": { header: "5+ Runs", subheader: "Gets hit when 5+ runs scored" },
  "team_scores_7+": { header: "7+ Runs", subheader: "Gets hit when 7+ runs scored" },
};

function TeamScoringSection({ rows, teamName }: { rows: TeamScoringRow[]; teamName: string }) {
  if (rows.length === 0) return null;

  // Group by condition
  const conditions = useMemo(() => {
    const map = new Map<string, TeamScoringRow[]>();
    for (const r of rows) {
      if (!map.has(r.condition)) map.set(r.condition, []);
      map.get(r.condition)!.push(r);
    }
    return map;
  }, [rows]);

  // Order columns by preference, only include conditions that exist in data
  const conditionKeys = useMemo(() => {
    const available = new Set(conditions.keys());
    const ordered = CONDITION_ORDER.filter((k) => available.has(k));
    // Add any remaining conditions not in our preferred order
    for (const k of available) {
      if (!ordered.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [conditions]);

  // Build player list, sorted by "team_wins" hit rate descending
  const sortedPlayers = useMemo(() => {
    const playerMap = new Map<number, { name: string; rates: Record<string, number | null> }>();
    for (const r of rows) {
      if (!playerMap.has(r.player_id)) {
        playerMap.set(r.player_id, { name: r.player_name, rates: {} });
      }
      playerMap.get(r.player_id)!.rates[r.condition] = r.hit_pct_in_condition;
    }
    return [...playerMap.entries()]
      .sort((a, b) => (b[1].rates["team_wins"] ?? b[1].rates[conditionKeys[0]] ?? 0) - (a[1].rates["team_wins"] ?? a[1].rates[conditionKeys[0]] ?? 0));
  }, [rows, conditionKeys]);

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/40">
        <span className="text-[10px] text-neutral-500">Player hit rate (1+ hit) in games matching each condition</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-200/60 dark:border-neutral-800/40">
              <th className="text-left px-3 py-2 sticky left-0 bg-white dark:bg-neutral-900 z-[5]">
                <span className="font-bold text-neutral-500">Player</span>
              </th>
              {conditionKeys.map((k) => {
                const label = CONDITION_LABELS[k] ?? { header: k, subheader: "" };
                return (
                  <th key={k} className="text-center px-3 py-2 whitespace-nowrap">
                    <div className="font-bold text-neutral-500">{label.header}</div>
                    <div className="text-[9px] font-normal text-neutral-400">{label.subheader}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(([playerId, { name, rates }]) => (
              <tr key={playerId} className="border-b border-neutral-100/50 dark:border-neutral-800/30 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                <td className="px-3 py-2 font-semibold text-neutral-900 dark:text-white sticky left-0 bg-white dark:bg-neutral-900 z-[5] whitespace-nowrap">{name}</td>
                {conditionKeys.map((k) => {
                  const val = rates[k];
                  const row = conditions.get(k)?.find((r) => r.player_id === playerId);
                  const smallSample = row && (row.games_matching ?? 0) < 5;
                  return (
                    <td key={k} className="text-center px-3 py-2">
                      {val != null ? (
                        <span className={cn("font-bold tabular-nums", val >= 70 ? "text-emerald-500" : val >= 50 ? "text-amber-500" : "text-neutral-500")}>
                          {Number(val).toFixed(0)}%
                          {smallSample && <span className="text-[8px] text-neutral-400 font-normal ml-0.5">sm</span>}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Auto-generated insight */}
      {(() => {
        // Find the top player in the highest-value condition (5+ runs or team wins)
        const bestCondition = conditionKeys.find(k => k.includes("scores_5") || k.includes("5_plus")) || conditionKeys[0];
        const bestPlayer = bestCondition ? sortedPlayers.find(([, p]) => (p.rates[bestCondition] ?? 0) >= 70) : null;
        if (!bestPlayer || !bestCondition) return null;
        const condLabel = CONDITION_LABELS[bestCondition]?.header ?? bestCondition;
        return (
          <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/20">
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
              <Zap className="w-3 h-3 text-amber-400 inline mr-1" />
              When {teamName} {condLabel.toLowerCase()}, <span className="font-bold text-neutral-900 dark:text-white">{bestPlayer[1].name}</span> gets a hit{" "}
              <span className="font-bold text-emerald-500">{Number(bestPlayer[1].rates[bestCondition]).toFixed(0)}%</span> of the time.
              Stack their hit prop with team total over.
            </p>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CorrelationsView({
  gameId,
  gameTeams,
  awayTeamId,
  homeTeamId,
  awayPitcherId,
  homePitcherId,
  awayPitcherName,
  homePitcherName,
}: {
  gameId: number;
  gameTeams?: string[];
  awayTeamId?: number | null;
  homeTeamId?: number | null;
  awayPitcherId?: number | null;
  homePitcherId?: number | null;
  awayPitcherName?: string | null;
  homePitcherName?: string | null;
  pitcherHand?: string | null;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Separate team filters per section
  const [stacksTeam, setStacksTeam] = useState<"both" | "away" | "home">("both");
  const [lineupTeam, setLineupTeam] = useState<"away" | "home">("away");
  const [scoringTeam, setScoringTeam] = useState<"away" | "home">("away");
  const [marketFilter, setMarketFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"pct" | "games">("pct");
  const [showAll, setShowAll] = useState(false);

  // Collapsible sections
  const [showLineup, setShowLineup] = useState(true);
  const [showPitcher, setShowPitcher] = useState(false);
  const [showTeamScoring, setShowTeamScoring] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────

  // First fetch "both" to get team IDs, then use them for filtered queries
  const { data: bothData } = usePropStacks(gameId, null);
  const resolvedAwayTeamId = awayTeamId ?? bothData?.away_team_id ?? null;
  const resolvedHomeTeamId = homeTeamId ?? bothData?.home_team_id ?? null;

  const stacksTeamId = stacksTeam === "away" ? resolvedAwayTeamId : stacksTeam === "home" ? resolvedHomeTeamId : null;
  const { data: propStacksData, isLoading: stacksLoading } = usePropStacks(gameId, stacksTeamId);
  const propStacks = propStacksData?.stacks;

  const lineupTeamId = lineupTeam === "home" ? resolvedHomeTeamId : resolvedAwayTeamId;
  const { data: lineupChain, isLoading: chainLoading } = useLineupChain(gameId, lineupTeamId ?? null);

  const { data: awayPitcherImpact } = usePitcherImpact(
    { pitcherId: awayPitcherId, gameId: gameId, side: "away" },
    showPitcher
  );
  const { data: homePitcherImpact } = usePitcherImpact(
    { pitcherId: homePitcherId, gameId: gameId, side: "home" },
    showPitcher
  );

  const scoringTeamId = scoringTeam === "home" ? resolvedHomeTeamId : resolvedAwayTeamId;
  const { data: teamScoring } = useTeamScoring(scoringTeamId ?? null, 2026, showTeamScoring);

  // ── Filter & sort prop stacks ──────────────────────────────────────────

  const filteredStacks = useMemo(() => {
    let stacks = propStacks ?? [];

    if (marketFilter !== "all") {
      stacks = stacks.filter(
        (s) => s.market_a === marketFilter || s.market_b === marketFilter
      );
    }

    if (sortBy === "pct") {
      stacks = [...stacks].sort((a, b) => b.co_occurrence_pct - a.co_occurrence_pct);
    } else {
      stacks = [...stacks].sort((a, b) => b.games_together - a.games_together);
    }

    return stacks;
  }, [propStacks, marketFilter, sortBy]);

  const displayStacks = showAll ? filteredStacks : filteredStacks.slice(0, 12);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Section 1: Top Prop Stacks (Hero) ────────────────────────────── */}
      <div>
        <SectionHeader icon={Zap} title="Top Prop Stacks" subtitle="Highest-correlation prop combos for this game" count={filteredStacks.length} />

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SegmentedControl
            value={stacksTeam}
            onChange={(v) => setStacksTeam(v as typeof stacksTeam)}
            options={[
              { label: gameTeams?.[0] ?? "Away", value: "away" },
              { label: gameTeams?.[1] ?? "Home", value: "home" },
              { label: "Both", value: "both" },
            ]}
          />
          <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {MARKET_FILTERS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMarketFilter(m.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                  marketFilter === m.value
                    ? "bg-brand text-white"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <SegmentedControl
            value={sortBy}
            onChange={(v) => setSortBy(v as "pct" | "games")}
            options={[
              { label: "Best %", value: "pct" },
              { label: "Most Games", value: "games" },
            ]}
          />
        </div>

        {/* Cards */}
        {stacksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredStacks.length === 0 ? (
          <div className="rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-50 dark:bg-neutral-900 p-8 text-center">
            <span className="text-2xl mb-2 block">🤷</span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">No strong prop stacks found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              No prop combinations above 40% co-occurrence for this lineup. Try the other team or check the Lineup Flow below.
            </p>
            {stacksTeam !== "both" && (
              <button
                onClick={() => setStacksTeam(stacksTeam === "away" ? "home" : "away")}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
              >
                Switch to {stacksTeam === "away" ? (gameTeams?.[1] ?? "Home") : (gameTeams?.[0] ?? "Away")} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayStacks.map((stack, i) => (
                <PropStackCard key={`${stack.player_a_id}-${stack.player_b_id}-${stack.market_a}-${stack.market_b}-${i}`} stack={stack} rank={i + 1} />
              ))}
            </div>
            {filteredStacks.length > 12 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-3 w-full py-2 text-xs font-semibold text-brand hover:underline"
              >
                Show All ({filteredStacks.length})
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Section 2: Lineup Flow ───────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={Link2}
          title="Lineup Flow"
          subtitle="Batting order dependency chain — when one player performs, how it impacts the next"
          collapsed={!showLineup}
          onToggle={() => setShowLineup(!showLineup)}
          count={lineupChain?.length}
        />

        {showLineup && (
          <div className="mt-2">
            {/* Team toggle for lineup */}
            <div className="mb-3">
              <SegmentedControl
                value={lineupTeam}
                onChange={(v) => setLineupTeam(v as "away" | "home")}
                options={[
                  { label: gameTeams?.[0] ?? "Away", value: "away" },
                  { label: gameTeams?.[1] ?? "Home", value: "home" },
                ]}
              />
            </div>
            {chainLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              </div>
            ) : !lineupChain || lineupChain.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">No lineup chain data available for this team.</p>
            ) : (
              <LineupFlowSection chain={lineupChain} isMobile={isMobile} />
            )}
          </div>
        )}
      </div>

      {/* ── Section 4: Pitcher Impact ────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={BarChart3}
          title="Pitcher Impact"
          subtitle="What happens to game outcomes at different pitcher performance thresholds"
          collapsed={!showPitcher}
          onToggle={() => setShowPitcher(!showPitcher)}
        />

        {showPitcher && (
          <div className={cn("mt-2 grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            {awayPitcherImpact && awayPitcherImpact.length > 0 && (
              <PitcherImpactCard pitcherName={awayPitcherName || "Away Pitcher"} rows={awayPitcherImpact} />
            )}
            {homePitcherImpact && homePitcherImpact.length > 0 && (
              <PitcherImpactCard pitcherName={homePitcherName || "Home Pitcher"} rows={homePitcherImpact} />
            )}
            {(!awayPitcherImpact || awayPitcherImpact.length === 0) && (!homePitcherImpact || homePitcherImpact.length === 0) && (
              <p className="text-xs text-neutral-500 text-center py-6 col-span-2">No pitcher impact data available.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Section 5: Team Scoring ──────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={TrendingUp}
          title="Team Scoring"
          subtitle="Which players drive team success — hit rates when the team wins or scores big"
          collapsed={!showTeamScoring}
          onToggle={() => setShowTeamScoring(!showTeamScoring)}
        />

        {showTeamScoring && (
          <div className="mt-2">
            <div className="mb-3">
              <SegmentedControl
                value={scoringTeam}
                onChange={(v) => setScoringTeam(v as "away" | "home")}
                options={[
                  { label: gameTeams?.[0] ?? "Away", value: "away" },
                  { label: gameTeams?.[1] ?? "Home", value: "home" },
                ]}
              />
            </div>
            {teamScoring && teamScoring.length > 0 ? (
              <TeamScoringSection rows={teamScoring} teamName={scoringTeam === "home" ? (gameTeams?.[1] ?? "Home") : (gameTeams?.[0] ?? "Away")} />
            ) : (
              <p className="text-xs text-neutral-500 text-center py-6">No team scoring data available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

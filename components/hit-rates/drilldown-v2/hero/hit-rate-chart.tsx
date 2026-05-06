"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { formatMarketLabel } from "@/lib/data/markets";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { getMarketStatValue } from "../shared/hit-rate-utils";
import { getGameStatRows } from "../shared/game-tooltip-stats";
import { Tile } from "../shared/tile";

export type ChartSplit = "all" | "home" | "away" | "win" | "loss";
export type ChartWindow = 10 | 20 | 40 | 100;

interface HitRateChartProps {
  games: BoxScoreGame[];
  market: string;
  line: number;
  sport: "nba" | "wnba";
  isCustomLine?: boolean;
  isLoading?: boolean;
  /** Active split filter (Home/Away/Win/Loss/All). */
  split: ChartSplit;
  onSplitChange: (split: ChartSplit) => void;
  /** Number of games to show in the chart window. */
  windowSize: ChartWindow;
  onWindowChange: (size: ChartWindow) => void;
  /** Optional upcoming game info — renders a dotted placeholder bar at the right. */
  upcomingGameDate?: string | null;
  upcomingOpponentAbbr?: string | null;
  upcomingHomeAway?: string | null;
}

const CHART_HEIGHT = 200;

const SPLIT_OPTIONS: { value: ChartSplit; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
];

const WINDOW_OPTIONS: { value: ChartWindow; label: string }[] = [
  { value: 10, label: "L10" },
  { value: 20, label: "L20" },
  { value: 40, label: "L40" },
  { value: 100, label: "All" },
];

// Bar widths scale with item count so a 10-game window doesn't look anemic and
// a 100-game window doesn't get crushed.
function getBarWidth(itemCount: number): number {
  if (itemCount <= 10) return 36;
  if (itemCount <= 20) return 28;
  if (itemCount <= 40) return 20;
  return 14;
}

function getDateYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

// Premium hero chart — fixed-width bars, horizontal scroll, season boundary
// dividers, and a dotted upcoming-game placeholder at the right edge.
export function HitRateChart({
  games,
  market,
  line,
  sport,
  isCustomLine,
  isLoading,
  split,
  onSplitChange,
  windowSize,
  onWindowChange,
  upcomingGameDate,
  upcomingOpponentAbbr,
  upcomingHomeAway,
}: HitRateChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter by split, then take the most recent N (oldest-first for left→right reading).
  const chartGames = useMemo(() => {
    const filtered = games.filter((g) => {
      if (!g || !g.date) return false;
      if (split === "home" && g.homeAway !== "H") return false;
      if (split === "away" && g.homeAway !== "A") return false;
      if (split === "win" && g.result !== "W") return false;
      if (split === "loss" && g.result !== "L") return false;
      return true;
    });
    return [...filtered]
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .slice(-windowSize);
  }, [games, split, windowSize]);

  // Detect a real upcoming game beyond the last historical game.
  const upcomingSlot = useMemo(() => {
    if (!upcomingGameDate || chartGames.length === 0) return null;
    const latest = chartGames[chartGames.length - 1].date ?? "";
    if (upcomingGameDate <= latest) return null;
    return {
      date: upcomingGameDate,
      opponentAbbr: upcomingOpponentAbbr ?? null,
      homeAway: upcomingHomeAway ?? null,
    };
  }, [upcomingGameDate, upcomingOpponentAbbr, upcomingHomeAway, chartGames]);

  // Detect every year transition for season-boundary dividers (handy for H2H
  // filters where many games could span seasons).
  type SeasonBoundary = { afterIndex: number; previousYear: number; nextYear: number };
  const seasonBoundaries: SeasonBoundary[] = useMemo(() => {
    const boundaries: SeasonBoundary[] = [];
    for (let i = 1; i < chartGames.length; i++) {
      const prev = getDateYear(chartGames[i - 1].date);
      const curr = getDateYear(chartGames[i].date);
      if (prev && curr && prev !== curr) {
        boundaries.push({ afterIndex: i - 1, previousYear: prev, nextYear: curr });
      }
    }
    if (upcomingSlot) {
      const last = getDateYear(chartGames[chartGames.length - 1]?.date ?? null);
      const upcoming = getDateYear(upcomingSlot.date);
      if (last && upcoming && last !== upcoming) {
        boundaries.push({
          afterIndex: chartGames.length - 1,
          previousYear: last,
          nextYear: upcoming,
        });
      }
    }
    return boundaries;
  }, [chartGames, upcomingSlot]);

  const values = chartGames.map((g) => getMarketStatValue(g, market));
  const hits = values.filter((v) => v >= line).length;
  const hitRate = values.length > 0 ? Math.round((hits / values.length) * 100) : 0;

  // Y-axis cap: enough headroom that even the tallest bar leaves room for its
  // value label above the bar top. Using max * 1.18 (vs old p90 * 1.1) so no
  // bar can cover a label.
  const maxBarValue = values.length > 0 ? Math.max(...values) : 1;
  const maxValue = Math.max(line * 1.4, maxBarValue * 1.18, 1);
  const linePercent = Math.min(94, Math.max(4, (line / maxValue) * 100));

  // Track sizing — fixed widths (v1 style) make spacing predictable + scrollable.
  const itemCount = chartGames.length + (upcomingSlot ? 1 : 0);
  const barWidth = getBarWidth(itemCount);
  const gapPx = 6;
  const trackWidth = itemCount > 0 ? itemCount * barWidth + (itemCount - 1) * gapPx : 0;

  // Auto-scroll to the right on mount + when item count or window changes,
  // so the most recent games are always in view first.
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    requestAnimationFrame(() => {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      el.scrollLeft = overflows ? el.scrollWidth : 0;
    });
  }, [itemCount, barWidth, windowSize]);

  return (
    <Tile
      padded={false}
      label={
        <span className="inline-flex items-center gap-2">
          <span>Recent Performance</span>
          <span className="text-[10px] font-medium normal-case tracking-normal text-neutral-400 dark:text-neutral-500">
            Last {chartGames.length} · {formatMarketLabel(market)}
          </span>
          {isCustomLine && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20">
              <span className="h-1 w-1 animate-pulse rounded-full bg-brand" />
              What-if
            </span>
          )}
        </span>
      }
      headerRight={
        <div className="flex items-center gap-3">
          {/* Window size filter */}
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
            {WINDOW_OPTIONS.map((opt) => {
              const active = opt.value === windowSize;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onWindowChange(opt.value)}
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-all",
                    active
                      ? "bg-brand text-neutral-950 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {/* Hit rate readout */}
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-base font-black leading-none tabular-nums",
                hitRate >= 70
                  ? "text-emerald-500 dark:text-emerald-400"
                  : hitRate >= 50
                  ? "text-neutral-700 dark:text-neutral-200"
                  : "text-rose-500 dark:text-rose-400"
              )}
            >
              {chartGames.length > 0 ? `${hitRate}%` : "—"}
            </span>
            {chartGames.length > 0 && (
              <span className="text-[10px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
                {hits}/{chartGames.length}
              </span>
            )}
          </div>
        </div>
      }
    >
      {/* Chart area */}
      <div className="relative px-3 pt-7 sm:px-4">
        {/* Threshold line + label — stays anchored regardless of horizontal scroll */}
        {chartGames.length > 0 && (
          <div className="pointer-events-none absolute inset-x-3 z-20 sm:inset-x-4" style={{ top: `calc(28px + ${100 - linePercent}% * ${CHART_HEIGHT / 100} / 1)`, height: 0 }} />
        )}

        {isLoading && chartGames.length === 0 ? (
          <ChartSkeleton />
        ) : chartGames.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div
            ref={scrollRef}
            className="overflow-x-auto pb-1 scrollbar-thin"
          >
            {/* Outer track grows beyond container only when content overflows.
                Inner mx-auto centers the bars when there's empty horizontal space. */}
            <div className="w-max min-w-full">
              <div className="relative mx-auto" style={{ width: Math.max(trackWidth, 0) }}>
              {/* Chart frame */}
              <div className="relative" style={{ height: CHART_HEIGHT }}>
                {/* Threshold dashed line spans the full track */}
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-brand/55"
                  style={{ bottom: `${linePercent}%` }}
                >
                  <span className="absolute -right-0.5 -top-[7px] text-[10px] font-black leading-none tabular-nums text-brand">
                    {formatLine(line)}
                  </span>
                </div>

                {/* Season boundaries — vertical dividers + year label tab */}
                {seasonBoundaries.map((b) => {
                  // Boundary sits in the gap AFTER index `afterIndex`, before the next item.
                  const x = (b.afterIndex + 1) * (barWidth + gapPx) - gapPx / 2;
                  return (
                    <div
                      key={`${b.previousYear}-${b.nextYear}-${b.afterIndex}`}
                      className="pointer-events-none absolute inset-y-0 z-[5]"
                      style={{ left: x }}
                    >
                      <div className="absolute inset-y-0 -left-px w-px bg-neutral-300/60 dark:bg-neutral-600/50" />
                      <div className="absolute inset-y-0 -left-6 w-12 bg-gradient-to-r from-transparent via-neutral-300/[0.15] to-transparent dark:via-white/[0.06]" />
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-neutral-200/80 bg-white/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-neutral-500 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/95 dark:text-neutral-400">
                        {b.nextYear}
                      </div>
                    </div>
                  );
                })}

                {/* Bars track */}
                <div
                  className="absolute inset-0 flex items-end justify-start"
                  style={{ gap: gapPx }}
                >
                  {chartGames.map((game, idx) => {
                    const value = values[idx];
                    const isHit = value >= line;
                    const heightPx = Math.max(4, (value / maxValue) * CHART_HEIGHT);
                    const date = new Date(`${game.date}T00:00:00`);
                    const tooltipDate = Number.isNaN(date.getTime())
                      ? game.date
                      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const opponentLabel = game.opponentAbbr || "OPP";
                    const margin = value - line;

                    return (
                      <Tooltip
                        key={`${game.gameId}-${idx}`}
                        side="top"
                        content={
                          <div className="min-w-[230px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-xl border border-neutral-200/70 bg-white px-0 py-0 shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900">
                            {/* Header */}
                            <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 px-3.5 py-2.5 dark:border-neutral-800/60">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                                {game.opponentAbbr && (
                                  <img
                                    src={getTeamLogoUrl(game.opponentAbbr, sport)}
                                    alt={game.opponentAbbr}
                                    className="h-4 w-4 object-contain"
                                  />
                                )}
                                <span className="tabular-nums">{tooltipDate}</span>
                                <span className="text-neutral-400 dark:text-neutral-500">
                                  {game.homeAway === "H" ? "vs" : "@"}
                                </span>
                                <span className="font-black">{opponentLabel}</span>
                              </div>
                              {game.result && (
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider tabular-nums ring-1",
                                    game.result === "W"
                                      ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400"
                                      : "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-400"
                                  )}
                                >
                                  {game.result} {Math.abs(game.margin) > 0
                                    ? `${game.result === "W" ? "+" : ""}${game.margin}`
                                    : `${game.teamScore}-${game.opponentScore}`}
                                </span>
                              )}
                            </div>

                            {/* Hero stat + margin */}
                            <div className="flex items-end justify-between gap-3 px-3.5 pt-3 pb-2">
                              <div className="flex items-baseline gap-1.5">
                                <span
                                  className={cn(
                                    "text-3xl font-black leading-none tabular-nums tracking-tight",
                                    isHit
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {value}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                                  {formatMarketLabel(market)}
                                </span>
                              </div>
                              <div className="flex flex-col items-end leading-tight">
                                <span
                                  className={cn(
                                    "text-[11px] font-black tabular-nums",
                                    isHit
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {margin >= 0 ? "+" : ""}
                                  {Number.isInteger(margin) ? margin : margin.toFixed(1)}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                  vs {formatLine(line)}
                                </span>
                              </div>
                            </div>

                            {/* Market-specific stats */}
                            <div className="px-3.5 pb-3">
                              {getGameStatRows(game, market)}
                            </div>
                          </div>
                        }
                      >
                        <div
                          className="group/bar flex h-full shrink-0 flex-col items-center justify-end"
                          style={{ width: barWidth }}
                        >
                          {/* Stat-total label that sits just above the bar top */}
                          <span
                            className={cn(
                              "mb-0.5 text-[9px] font-black tabular-nums leading-none transition-colors",
                              isHit
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {Number.isInteger(value) ? value : value.toFixed(1)}
                          </span>
                          <div
                            className={cn(
                              "w-full rounded-t-[3px] transition-all duration-200 ease-out",
                              "shadow-[0_0_0_1px_rgba(0,0,0,0.04)_inset,0_-1px_0_rgba(255,255,255,0.18)_inset]",
                              "group-hover/bar:brightness-110 group-hover/bar:-translate-y-0.5",
                              isHit
                                ? "bg-emerald-500/90 dark:bg-emerald-400/90"
                                : "bg-rose-500/80 dark:bg-rose-500/80"
                            )}
                            style={{
                              height: heightPx,
                              animation: `bar-rise 360ms ${idx * 12}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) backwards`,
                            }}
                          />
                        </div>
                      </Tooltip>
                    );
                  })}

                  {/* Upcoming game placeholder — dotted bar with question mark */}
                  {upcomingSlot && (
                    <Tooltip
                      side="top"
                      content={
                        <div className="px-3 py-2 text-[11px]">
                          <div className="font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                            Upcoming
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-200">
                            <span className="tabular-nums">
                              {upcomingSlot.date.slice(5).replace("-", "/")}
                            </span>
                            <span className="text-neutral-400 dark:text-neutral-500">
                              {upcomingSlot.homeAway === "H" ? "vs" : "@"}
                            </span>
                            <span>{upcomingSlot.opponentAbbr ?? "OPP"}</span>
                          </div>
                        </div>
                      }
                    >
                      <div
                        className="flex h-full shrink-0 items-end justify-center"
                        style={{ width: barWidth }}
                      >
                        <div
                          className="flex w-full flex-col items-center justify-end rounded-t-[3px] border border-dashed border-brand/40 bg-brand/5"
                          style={{
                            height: Math.max((line / maxValue) * CHART_HEIGHT, 32),
                          }}
                        >
                          <HelpCircle
                            className="h-3.5 w-3.5 text-brand/70"
                            style={{ marginBottom: 4 }}
                          />
                        </div>
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* X-axis: opponent logos + dates aligned with bars */}
              <div className="mt-1.5 flex items-start" style={{ gap: gapPx }}>
                {chartGames.map((game, idx) => (
                  <div
                    key={`${game.gameId}-axis-${idx}`}
                    className="flex shrink-0 flex-col items-center"
                    style={{ width: barWidth }}
                  >
                    <div className="flex h-4 items-center justify-center">
                      {game.opponentAbbr ? (
                        <img
                          src={getTeamLogoUrl(game.opponentAbbr, sport)}
                          alt={game.opponentAbbr}
                          className="h-3.5 w-3.5 object-contain opacity-80"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-neutral-400">—</span>
                      )}
                    </div>
                    <span className="text-[9px] font-medium tabular-nums leading-none text-neutral-400 dark:text-neutral-500">
                      {formatBarDate(game.date)}
                    </span>
                  </div>
                ))}
                {upcomingSlot && (
                  <div
                    className="flex shrink-0 flex-col items-center"
                    style={{ width: barWidth }}
                  >
                    <div className="flex h-4 items-center justify-center">
                      {upcomingSlot.opponentAbbr ? (
                        <img
                          src={getTeamLogoUrl(upcomingSlot.opponentAbbr, sport)}
                          alt={upcomingSlot.opponentAbbr}
                          className="h-3.5 w-3.5 object-contain opacity-90"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-brand">?</span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold tabular-nums leading-none text-brand">
                      Next
                    </span>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Splits chips */}
      <div className="mt-2 flex items-center gap-1 border-t border-neutral-200/50 px-3 py-2 dark:border-neutral-800/50 sm:px-4">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
          Splits
        </span>
        {SPLIT_OPTIONS.map((opt) => {
          const active = opt.value === split;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSplitChange(opt.value)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-bold transition-all duration-150",
                active
                  ? "bg-brand text-neutral-950 shadow-sm shadow-brand/25"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes bar-rise {
          from {
            height: 0;
            opacity: 0;
          }
        }
      `}</style>
    </Tile>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="relative flex w-full items-end justify-between"
      style={{ height: CHART_HEIGHT, gap: 6 }}
    >
      {Array.from({ length: 20 }).map((_, idx) => (
        <div key={idx} className="flex h-full min-w-0 flex-1 items-end justify-center">
          <div
            className="w-full max-w-[28px] animate-pulse rounded-t-[3px] bg-neutral-200/70 dark:bg-neutral-800/70"
            style={{ height: 24 + ((idx * 19) % 90) }}
          />
        </div>
      ))}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div
      className="flex w-full items-center justify-center text-sm font-medium text-neutral-400 dark:text-neutral-500"
      style={{ height: CHART_HEIGHT }}
    >
      No recent games available.
    </div>
  );
}

function formatLine(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatBarDate(date: string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

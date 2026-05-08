"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { PlayerHeadshot } from "@/components/player-headshot";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { formatMarketLabel } from "@/lib/data/markets";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import type { GameWithInjuries, PlayerOutInfo } from "@/hooks/use-injury-context";
import { getMarketStatValue } from "../shared/hit-rate-utils";
import { getGameStatRows } from "../shared/game-tooltip-stats";
import {
  getQuickFilters,
  getInlineQuickFilters,
  resolveQuickFilter,
  METRIC_FILTERS,
  DVP_RANK_CONFIG,
  metricFilterId,
  parseMetricFilterId,
  type PlayTypeDefenseQuickFilter,
} from "../shared/quick-filters";
import { Tile } from "../shared/tile";
import { FiltersDrawer } from "./filters-drawer";
import { ChartSettingsPopover } from "./chart-settings-popover";
import { MetricRangePopover } from "./metric-range-popover";
import { useChartPreferences } from "@/hooks/use-chart-preferences";

// Maps the short-form inline-chip prefix (e.g. "minutes" from "minutes30")
// onto the corresponding METRIC_FILTERS key. Anything in this map will
// render as a popover-trigger instead of a single-toggle chip.
const INLINE_CHIP_TO_METRIC_KEY: Record<string, string> = {
  minutes: "minutes",
  fga: "fga",
  threePtA: "fg3a",
  rebChances: "potentialReb",
  potAst: "potentialAssists",
};

function getMetricKeyFromInlineChipId(id: string): string | null {
  const match = id.match(/^([a-zA-Z]+)\d+(?:\.\d+)?$/);
  if (!match) return null;
  return INLINE_CHIP_TO_METRIC_KEY[match[1]] ?? null;
}

export type ChartSplit =
  | "all"
  | "home"
  | "away"
  | "win"
  | "loss"
  | "winBy10"
  | "lossBy10"
  | "reg"
  | "playoffs";
export type ChartRange = "l5" | "l10" | "l20" | "szn" | "h2h";

export interface ChartHitRateSegment {
  range: ChartRange;
  label: string;
  pct: number | null;
  sample: number | null;
}

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
  /** Active range — merged hit-rate window + opponent filter. */
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  /** Hit-rate readouts (one per range button). Source of truth for the
      percentage shown on each chip in the header. */
  hitRateSegments: ChartHitRateSegment[];
  /** Used by the H2H range to filter bars to games vs the current opponent. */
  opponentTeamId?: number | null;
  /** Per-game injury context (gameId → teammates_out + opponents_out). Drives
   *  the "Teammates Out" section in the bar tooltip AND the with/without
   *  teammate filtering on bars. */
  gameInjuriesByGameId?: Map<string, GameWithInjuries>;
  /** Season-aggregate avgs per teammate (player_id → PlayerOutInfo). Used to
   *  rank the tooltip's "Teammates Out" section by impact when the per-game
   *  records don't embed avgs (NBA path). */
  playerAvgsById?: Map<number, PlayerOutInfo>;
  /** Roster With/Without filters. Player-team filters read teammates_out;
   *  opponent filters read opponents_out. When active, only games matching
   *  ALL filters render. */
  teammateFilters?: Array<{ playerId: string; mode: "with" | "without"; isOpponent?: boolean }>;
  /** Active quick-filter chip ids (market-aware). All active chips compose
   *  with AND alongside split + range + teammate filters. */
  quickFilters?: Set<string>;
  onQuickFilterToggle?: (id: string) => void;
  onQuickFiltersClear?: () => void;
  /** Replace the entire active set in one shot (used by smart presets). */
  onQuickFiltersSet?: (ids: Set<string>) => void;
  /** Opp team_id → DvP rank for the player's position on the active market.
   *  When present, defense-tier quick filters (Top N D / Bottom N D) render. */
  dvpRankByOpponent?: Map<number, number>;
  /** League team count — scales the DvP tier cutoffs (NBA 30, WNBA 13). */
  dvpTotalTeams?: number;
  /** Opp team_id → pace rank (lower = faster). Powers the per-game pace
   *  overlay tier dots when the user enables that chart setting. */
  paceRankByOpponent?: Map<number, number>;
  /** NBA play-type defense ranks by opponent. Powers v1-style play-type
   *  defense filters inside the v2 drawer. */
  playTypeDefenseFilters?: PlayTypeDefenseQuickFilter[];
  /** Tonight's game date (YYYY-MM-DD) — drives the contextual day-of-week
   *  and days-rest chips surfaced inline. */
  tonightDate?: string | null;
  /** Tonight's spread for the player's team — drives whether Close or
   *  Blowout is the contextual inline chip. */
  tonightSpread?: number | null;
  /** Tonight's opponent team_id. Drives whether the inline DvP chip
   *  upgrades to the sharper Top 5 / Bottom 5 tier when the matchup is
   *  in the extreme. */
  tonightOpponentTeamId?: number | null;
  /** Unified list of every active filter (split, quick filters, custom line,
   *  teammate with/without). Rendered as a single removable-chip row under
   *  the chart header so the user can see and clear all filters in one spot. */
  activeFilterChips?: Array<{ id: string; label: string; onRemove: () => void }>;
  onClearAllFilters?: () => void;
  /** When provided, the threshold dashed line becomes draggable — drag updates
   *  the active line in 0.5 increments. Same callback the LineStepper uses. */
  onLineChange?: (value: number) => void;
  /** When provided, double-clicking the threshold resets to the default line.
   *  Up/Down arrows nudge by 0.5 when the threshold has focus. */
  onLineReset?: () => void;
  /** Optional player command bar rendered as the card's top row — keeps the
   *  player + market + line + odds visually attached to the chart they describe. */
  topSlot?: React.ReactNode;
  /** Optional upcoming game info — renders a dotted placeholder bar at the right. */
  upcomingGameDate?: string | null;
  upcomingOpponentAbbr?: string | null;
  upcomingHomeAway?: string | null;
}

const CHART_HEIGHT = 280;

export const SPLIT_OPTIONS: { value: ChartSplit; label: string }[] = [
  { value: "all", label: "All" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "winBy10", label: "Win 10+" },
  { value: "lossBy10", label: "Loss 10+" },
  { value: "reg", label: "Reg" },
  { value: "playoffs", label: "Playoffs" },
];

// Maps a range to the slice size for L-windows. SZN takes everything we have;
// H2H is filter-driven (opponent), not slice-driven.
const RANGE_SLICE: Record<ChartRange, number> = {
  l5: 5,
  l10: 10,
  l20: 20,
  szn: 200,
  h2h: 200,
};

const normalizeInjuryGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

// Min bar width keeps bars legible at high counts (with the chart scrolling
// once the track exceeds the container). The MAX is dynamic — it scales with
// item count so a 3-game H2H view doesn't look like 56px bars marooned in the
// middle of a wide chart, while a 20-game view still hits its tight cap and
// fills edge-to-edge.
const BAR_MIN_WIDTH = 12;
const BAR_GAP = 6;

function gapForCount(itemCount: number): number {
  if (itemCount >= 20) return 4;
  if (itemCount >= 15) return 5;
  return BAR_GAP;
}

// Cap scales inversely with item count. Few bars → wider cap so the cluster
// feels substantial; many bars → tighter cap so they still fit cleanly. The
// caps are intentionally generous so wider viewports actually use the room
// (otherwise L20 would stop at 56-72px and leave dead space at 1500px+).
function maxBarWidthForCount(itemCount: number): number {
  if (itemCount <= 5) return 140;
  if (itemCount <= 10) return 104;
  if (itemCount <= 15) return 92;
  if (itemCount <= 22) return 112;
  return 88;
}

// Pick an optimal bar width given how much horizontal room we have. Returns
// the cap at low counts (so the track fills up to the cap and then gets
// centered), shrinks toward BAR_MIN_WIDTH as count grows. When the optimum
// drops below MIN we let the track exceed the container and rely on
// horizontal scrolling instead of crushing bars further. Sub-pixel widths
// are accepted in the unclamped middle range so the track lands exactly
// edge-to-edge rather than leaving 5-15px of slack from integer rounding.
function pickBarWidth(itemCount: number, containerWidth: number): number {
  if (itemCount <= 0) return 28;
  if (containerWidth <= 0) return 28; // pre-measure default
  const cap = maxBarWidthForCount(itemCount);
  const totalGap = (itemCount - 1) * gapForCount(itemCount);
  const optimal = (containerWidth - totalGap) / itemCount;
  if (optimal > cap) return cap;
  if (optimal < BAR_MIN_WIDTH) return BAR_MIN_WIDTH;
  // Tiny epsilon prevents sub-pixel rounding from pushing the track 1px past
  // the container, which would trigger a horizontal scrollbar.
  return optimal - 0.25;
}

// Sport-aware season detection. NBA seasons span Oct → Jun across two
// calendar years (label "24-25"); WNBA seasons run May → Oct entirely
// within a single calendar year (label "2025"). The cutoff for NBA falls
// between July and August — anything in months 8–12 is the START of a
// season, months 1–7 are its tail.
function getSeasonInfo(
  dateStr: string | null | undefined,
  sport: "nba" | "wnba"
): { id: string; label: string } | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (sport === "wnba") {
    return { id: String(year), label: String(year) };
  }
  const seasonStartYear = month >= 8 ? year : year - 1;
  const startSuffix = String(seasonStartYear).slice(-2);
  const endSuffix = String(seasonStartYear + 1).slice(-2);
  return { id: String(seasonStartYear), label: `${startSuffix}-${endSuffix}` };
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
  range,
  onRangeChange,
  hitRateSegments,
  opponentTeamId,
  gameInjuriesByGameId,
  playerAvgsById,
  teammateFilters,
  quickFilters,
  onQuickFilterToggle,
  onQuickFiltersClear,
  onQuickFiltersSet,
  dvpRankByOpponent,
  dvpTotalTeams,
  paceRankByOpponent,
  playTypeDefenseFilters,
  tonightDate,
  tonightSpread,
  tonightOpponentTeamId,
  activeFilterChips,
  onClearAllFilters,
  onLineChange,
  onLineReset,
  topSlot,
  upcomingGameDate,
  upcomingOpponentAbbr,
  upcomingHomeAway,
}: HitRateChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Index of the bar currently being hovered — drives the crosshair + pinned
  // pills across the main panel and margin strip.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // Sticky-tooltip handoff: when the cursor leaves a bar we wait a beat
  // before clearing the hovered index. If the cursor moves into the portaled
  // tooltip during that grace period, its mouseEnter cancels the timer so
  // the tooltip stays open and the user can scroll its content (needed for
  // tall tooltips that get capped on small screens).
  const hoverClearTimerRef = useRef<number | null>(null);
  const cancelHoverClear = () => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  };
  const scheduleHoverClear = (idx: number) => {
    cancelHoverClear();
    hoverClearTimerRef.current = window.setTimeout(() => {
      hoverClearTimerRef.current = null;
      setHoveredIndex((prev) => (prev === idx ? null : prev));
    }, 120);
  };
  useEffect(() => () => cancelHoverClear(), []);
  // Per-user chart settings (Confidence Band / DvP / Pace overlays + Potential
  // / Average display toggles). Read from user_preferences via the prefs
  // context. Saved optimistically when toggled. `hidePotential` derives from
  // !showPotential to preserve the existing variable name downstream.
  const { settings: chartSettings } = useChartPreferences();
  const hidePotential = !chartSettings.showPotential;
  // Container width drives responsive bar sizing. ResizeObserver keeps it in
  // sync as the layout / viewport changes (e.g. roster rail collapses on
  // smaller widths, tab switches).
  const [containerWidth, setContainerWidth] = useState(0);
  // Portal anchor — viewport-relative coords for the hover card. Computed
  // from the inner track's bounding rect on hover/scroll/resize so the card
  // sits over the hovered bar regardless of page scroll. Portaled to body
  // so the Tile's overflow-hidden doesn't clip it. `placement` flips top/
  // bottom based on available room — same idea as Radix collision avoidance.
  const innerTrackRef = useRef<HTMLDivElement>(null);
  const [hoverAnchor, setHoverAnchor] = useState<
    | { left: number; top: number; placement: "above" | "below" }
    | null
  >(null);
  // Filter by range + split + roster filters, then take the most recent N
  // (oldest-first for left→right reading). Player-team filters use
  // teammates_out; opponent-team filters use opponents_out.
  const quickFilterCtx = useMemo(
    () => ({
      market,
      upcomingHomeAway,
      recentGames: games,
      dvpRankByOpponent,
      totalTeams: dvpTotalTeams,
      tonightDate,
      tonightSpread,
      tonightOpponentTeamId,
      playTypeDefenseFilters,
    }),
    [
      market,
      upcomingHomeAway,
      games,
      dvpRankByOpponent,
      dvpTotalTeams,
      tonightDate,
      tonightSpread,
      tonightOpponentTeamId,
      playTypeDefenseFilters,
    ]
  );
  const availableQuickFilters = useMemo(
    () => getQuickFilters(quickFilterCtx),
    [quickFilterCtx]
  );
  // Inline row shows only the contextual subset; the popover lists all.
  const inlineQuickFilters = useMemo(
    () => getInlineQuickFilters(availableQuickFilters, quickFilterCtx),
    [availableQuickFilters, quickFilterCtx]
  );
  const activeQuickFilters = useMemo(
    () =>
      [...(quickFilters ?? new Set<string>())]
        .map((id) => resolveQuickFilter(id, availableQuickFilters, quickFilterCtx))
        .filter((qf): qf is NonNullable<typeof qf> => qf !== null),
    [availableQuickFilters, quickFilters, quickFilterCtx]
  );

  const chartGames = useMemo(() => {
    const activeFilters = teammateFilters ?? [];
    const filtered = games.filter((g) => {
      if (!g || !g.date) return false;
      if (range === "h2h" && opponentTeamId != null && g.opponentTeamId !== opponentTeamId) return false;
      if (split === "home" && g.homeAway !== "H") return false;
      if (split === "away" && g.homeAway !== "A") return false;
      if (split === "win" && g.result !== "W") return false;
      if (split === "loss" && g.result !== "L") return false;
      if (split === "winBy10" && (g.result !== "W" || g.margin < 10)) return false;
      if (split === "lossBy10" && (g.result !== "L" || g.margin > -10)) return false;
      if (split === "reg" && !isRegularSeasonType(g.seasonType)) return false;
      if (split === "playoffs" && !isPlayoffSeasonType(g.seasonType)) return false;
      // Market-aware quick filters compose with AND.
      for (const qf of activeQuickFilters) {
        if (!qf.predicate(g)) return false;
      }
      if (activeFilters.length > 0) {
        const inj =
          gameInjuriesByGameId?.get(g.gameId) ??
          gameInjuriesByGameId?.get(normalizeInjuryGameId(g.gameId));
        // No injury context for this game → can't satisfy a filter, drop it.
        if (!inj) return false;
        for (const f of activeFilters) {
          const outList = f.isOpponent ? inj.opponents_out : inj.teammates_out;
          const outIds = new Set(outList.map((t) => String(t.player_id)));
          const wasOut = outIds.has(f.playerId);
          if (f.mode === "without" && !wasOut) return false;
          if (f.mode === "with" && wasOut) return false;
        }
      }
      return true;
    });
    return [...filtered]
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .slice(-RANGE_SLICE[range]);
  }, [games, split, range, opponentTeamId, teammateFilters, gameInjuriesByGameId, activeQuickFilters]);

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

  // Group consecutive games into season ranges. Sport-aware: NBA seasons run
  // Oct → Jun and span two calendar years (label "24-25"); WNBA seasons run
  // May → Oct within a single year (label "2025"). Each range carries its own
  // label and start/end indices so we can render a centered chip per range
  // and a divider line between ranges (without a separate boundaries pass).
  type SeasonRange = {
    seasonId: string;
    label: string;
    startIndex: number;
    endIndex: number;
  };
  const seasonRanges: SeasonRange[] = useMemo(() => {
    const ranges: SeasonRange[] = [];
    const append = (info: { id: string; label: string } | null, index: number) => {
      if (!info) return;
      const last = ranges[ranges.length - 1];
      if (!last || last.seasonId !== info.id) {
        ranges.push({ seasonId: info.id, label: info.label, startIndex: index, endIndex: index });
      } else {
        last.endIndex = index;
      }
    };
    chartGames.forEach((g, i) => append(getSeasonInfo(g.date, sport), i));
    if (upcomingSlot) {
      append(getSeasonInfo(upcomingSlot.date, sport), chartGames.length);
    }
    return ranges;
  }, [chartGames, upcomingSlot, sport]);

  const values = chartGames.map((g) => getMarketStatValue(g, market));
  // For markets with a "potential" denominator (rebounds → potential rebounds,
  // assists → potential assists), every bar gets a ghost behind it showing
  // the opportunity. For markets without a meaningful potential it returns
  // null and the chart renders single-bar mode. The user can also explicitly
  // hide the ghosts via the header toggle.
  const supportsPotential = marketSupportsPotential(market);
  const potentials = chartGames.map((g) => getPotentialValue(g, market));
  const hasAnyPotential =
    !hidePotential && supportsPotential && potentials.some((p) => p != null && p > 0);

  // Y-axis cap: enough headroom that even the tallest bar leaves room for its
  // value label above the bar top. When potential bars exist they're often
  // taller than actuals — include them in the max so ghosts don't get clipped.
  const maxBarValue = values.length > 0 ? Math.max(...values) : 1;
  const maxPotentialValue = hasAnyPotential
    ? Math.max(...potentials.filter((p): p is number => p != null && p > 0))
    : 0;
  const maxObserved = Math.max(maxBarValue, maxPotentialValue);
  const maxValue = Math.max(line * 1.4, maxObserved * 1.18, 1);
  const linePercent = Math.min(94, Math.max(4, (line / maxValue) * 100));

  // Average of the visible bars — drives the muted neutral horizontal line
  // and the right-edge "AVG X.X" pill. Skipped when there's no data so we
  // don't render a useless 0-line under empty bars.
  const averageValue =
    values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;

  // Confidence band stats — median ± 1σ across visible values, clamped to
  // [0, maxValue]. Used by the band overlay to show "typical range" so the
  // user can spot games that fall outside their normal band at a glance.
  const confidenceBand = useMemo(() => {
    if (values.length < 4) return null; // too small for a meaningful band
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    const lower = Math.max(0, median - std);
    const upper = Math.min(maxValue, median + std);
    return { lower, upper, median };
  }, [values, maxValue]);
  const averagePercent =
    averageValue !== null
      ? Math.min(96, Math.max(2, (averageValue / maxValue) * 100))
      : null;

  // Track sizing — bar width is responsive to the container so L5/L10 bars get
  // wider with the track centered, L20 nearly fills side-to-side, and very
  // high counts hit MIN and scroll horizontally.
  const itemCount = chartGames.length + (upcomingSlot ? 1 : 0);
  const barWidth = pickBarWidth(itemCount, containerWidth);
  const gapPx = gapForCount(itemCount);
  const trackWidth = itemCount > 0 ? itemCount * barWidth + (itemCount - 1) * gapPx : 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth || el.getBoundingClientRect().width || 0;
      setContainerWidth(width);
    };

    measure();
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemCount]);

  // Recompute hover anchor whenever the hovered bar changes — and re-track on
  // page scroll/resize so the portaled card stays glued to its bar. Picks
  // above-vs-below placement based on available viewport space, and clamps
  // the horizontal anchor so the card never spills past the viewport edges.
  useEffect(() => {
    if (hoveredIndex === null) {
      setHoverAnchor(null);
      return;
    }
    const update = () => {
      const el = innerTrackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const CARD_HALF_WIDTH = 140;
      const EDGE_PAD = 12;
      const GUTTER = 8; // gap between bar edge and card

      // Vertical: pick the side with more room (above vs below the chart).
      // The card itself stays overflow-visible; the compact tooltip layout is
      // preferable to an internal scrollbar over the chart.
      const roomAbove = Math.max(0, rect.top - EDGE_PAD - GUTTER);
      const roomBelow = Math.max(0, viewportHeight - rect.bottom - EDGE_PAD - GUTTER);
      const placement: "above" | "below" = roomAbove >= roomBelow ? "above" : "below";
      const top =
        placement === "above"
          ? rect.top + window.scrollY - GUTTER
          : rect.bottom + window.scrollY + GUTTER;

      // Horizontal: anchor at the bar's center, then clamp so the card stays
      // on screen even when hovering a bar near a viewport edge.
      const rawLeft =
        rect.left + window.scrollX + hoveredIndex * (barWidth + gapPx) + barWidth / 2;
      const minLeft = CARD_HALF_WIDTH + EDGE_PAD + window.scrollX;
      const maxLeft = viewportWidth - CARD_HALF_WIDTH - EDGE_PAD + window.scrollX;
      const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));

      setHoverAnchor({ left, top, placement });
    };
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", update);
    };
  }, [hoveredIndex, barWidth]);
  // Sparsify x-axis labels at high counts so logos + dates don't crowd. Tuned
  // so we land near ~20 visible labels regardless of total bar count.
  const axisStride =
    chartGames.length <= 20 ? 1 : chartGames.length <= 40 ? 2 : chartGames.length <= 60 ? 3 : 5;

  // 5 evenly-spaced y-axis ticks (0%, 25%, 50%, 75%, 100% of maxValue). Drives
  // both the left-side tick labels and the horizontal grid lines.
  const yTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((p) => ({
      value: maxValue * p,
      percent: p * 100,
    }));
  }, [maxValue]);

  // Global keyboard shortcuts — work anywhere on the page (no focus required)
  // because typical bettors don't want to mouse over the chart first. Skipped
  // when the user is typing in an input or holds a non-shift modifier so we
  // don't fight browser/app shortcuts. Uses a ref for `line` so the effect
  // doesn't re-attach on every line change.
  const lineRef = useRef(line);
  lineRef.current = line;
  useEffect(() => {
    if (!onLineChange) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const current = lineRef.current;
      const big = e.shiftKey ? 1 : 0.5;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onLineChange(Math.max(0.5, current + big));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onLineChange(Math.max(0.5, current - big));
      } else if ((e.key === "r" || e.key === "R" || e.key === "Backspace") && onLineReset) {
        e.preventDefault();
        onLineReset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onLineChange, onLineReset]);

  // Drag-to-adjust on the threshold. Captures maxValue at drag start so a
  // self-rescaling y-axis (line affects maxValue) doesn't make the cursor jump.
  // Snaps to 0.5 increments — same step as the LineStepper.
  const handleThresholdMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLineChange) return;
    e.preventDefault();
    // preventDefault on mousedown also blocks the browser's default focus, so
    // we apply it manually — otherwise the threshold can never receive focus
    // by clicking, and the arrow-key nudges silently no-op.
    e.currentTarget.focus();
    const startY = e.clientY;
    const startLine = line;
    const capturedMax = maxValue;
    const handleMove = (ev: MouseEvent) => {
      const deltaY = startY - ev.clientY; // up = positive value delta
      const deltaVal = (deltaY / CHART_HEIGHT) * capturedMax;
      const next = Math.max(0.5, Math.round((startLine + deltaVal) * 2) / 2);
      onLineChange(next);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // Auto-scroll to the right on mount + when item count or window changes,
  // so the most recent games are always in view first.
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    requestAnimationFrame(() => {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      el.scrollLeft = overflows ? el.scrollWidth : 0;
    });
  }, [itemCount, barWidth, range]);

  return (
    <Tile
      padded={false}
      topSlot={topSlot}
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
        <div className="flex flex-wrap items-center gap-1">
          {hitRateSegments.map((seg) => {
            const active = seg.range === range;
            const tone = rangeButtonTone(seg.pct);
            return (
              <button
                key={seg.range}
                type="button"
                onClick={() => onRangeChange(seg.range)}
                className={cn(
                  "inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold tabular-nums transition-all",
                  active
                    ? cn("ring-1 ring-brand/40", tone.bgActive, tone.borderActive, tone.textActive)
                    : cn("border-transparent", tone.text, tone.bgHover)
                )}
              >
                <span className="uppercase tracking-[0.16em] opacity-70">{seg.label}</span>
                <span className="text-[12px] leading-none tracking-tight">
                  {seg.pct != null ? `${Math.round(seg.pct)}%` : "—"}
                </span>
                {seg.pct != null && seg.sample != null && seg.sample > 0 && (
                  <span className="text-[9px] opacity-60">
                    {Math.round((seg.pct / 100) * seg.sample)}/{seg.sample}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      }
    >
      {/* Active filters strip — every applied filter (split, quick chips,
          custom line, with/without teammates) shows here as a removable
          chip so the user can manage them in one spot. */}
      {activeFilterChips && activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200/60 px-3 py-2 dark:border-neutral-800/60 sm:px-4">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
            Active
          </span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="group inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand ring-1 ring-brand/20 transition-colors hover:bg-brand/15"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3 opacity-70 group-hover:opacity-100" />
            </button>
          ))}
          {onClearAllFilters && activeFilterChips.length > 1 && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="ml-auto text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 transition-colors hover:text-brand dark:text-neutral-500"
            >
              Clear All
            </button>
          )}
        </div>
      )}
      {/* Chart area */}
      <div className="relative pl-8 pr-2 pt-7 sm:pl-9 sm:pr-3">
        {/* Grid background — y-axis ticks + horizontal grid lines. Sits BEHIND
            the bars (z-[1]) so the rules read as a backdrop, not slicing
            across the columns. */}
        {chartGames.length > 0 && (
          <div
            className="pointer-events-none absolute left-8 right-2 top-7 z-[1] sm:left-9 sm:right-3"
            style={{ height: CHART_HEIGHT }}
          >
            {yTicks.map((t) => (
              <div
                key={`grid-${t.percent}`}
                className={cn(
                  "absolute inset-x-0 h-px",
                  t.percent === 0
                    ? "bg-neutral-200/60 dark:bg-neutral-700/60"
                    : "bg-neutral-200/30 dark:bg-neutral-800/45"
                )}
                style={{ bottom: `${t.percent}%` }}
              />
            ))}
            {yTicks.map((t) => (
              <span
                key={`tick-${t.percent}`}
                className="absolute -translate-y-1/2 text-[9px] font-medium tabular-nums text-neutral-400 dark:text-neutral-500"
                style={{ left: -28, bottom: `${t.percent}%` }}
              >
                {Math.round(t.value)}
              </span>
            ))}
          </div>
        )}

        {/* Average line — muted neutral dashed rule + right-edge "AVG X.X"
            pill. Sits in the same layer as the threshold but at z-[15] so the
            cyan threshold renders on top when the two are close. */}
        {chartSettings.showAverage && chartGames.length > 0 && averagePercent !== null && averageValue !== null && (
          <div
            className="pointer-events-none absolute left-8 right-2 top-7 z-[15] sm:left-9 sm:right-3"
            style={{ height: CHART_HEIGHT }}
          >
            <div
              className="absolute inset-x-0 border-t border-dashed border-neutral-400/55 dark:border-neutral-500/45"
              style={{ bottom: `${averagePercent}%` }}
            >
              <span className="absolute -right-1 -top-[10px] inline-flex items-center rounded-md bg-neutral-200/70 px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums text-neutral-600 ring-1 ring-neutral-300/60 backdrop-blur-sm dark:bg-neutral-700/60 dark:text-neutral-200 dark:ring-neutral-600/60">
                AVG {Number.isInteger(averageValue) ? averageValue : averageValue.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Threshold layer — IN FRONT of bars (z-[20]) so the dashed line and
            its right-edge pill sit on top. Wider hit area centered on the
            visible line keeps dragging forgiving without thickening the line. */}
        {chartGames.length > 0 && (
          <div
            className="pointer-events-none absolute left-8 right-2 top-7 z-[20] sm:left-9 sm:right-3"
            style={{ height: CHART_HEIGHT }}
          >
            <div
              className={cn(
                "group pointer-events-auto absolute inset-x-0 outline-none",
                onLineChange ? "cursor-ns-resize" : ""
              )}
              style={{ bottom: `calc(${linePercent}% - 6px)`, height: 12 }}
              onMouseDown={handleThresholdMouseDown}
              onDoubleClick={onLineReset}
              role={onLineChange ? "slider" : undefined}
              aria-label={
                onLineChange
                  ? "Drag to adjust line. Arrow keys nudge, R resets, double-click to reset."
                  : undefined
              }
              aria-valuenow={line}
            >
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-brand/70 transition-colors group-hover:border-brand group-focus-visible:border-brand" />
              {onLineChange && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-[2px] rounded-full bg-brand/10 px-1.5 py-1 opacity-0 ring-1 ring-brand/30 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:bg-brand/20 group-focus-visible:ring-brand/60">
                  <span className="block h-[1.5px] w-3 rounded-sm bg-brand/80" />
                  <span className="block h-[1.5px] w-3 rounded-sm bg-brand/80" />
                </div>
              )}
              <span className="pointer-events-none absolute -right-1 top-1/2 inline-flex -translate-y-1/2 items-center rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums text-brand ring-1 ring-brand/40 backdrop-blur-sm dark:bg-brand/20">
                {formatLine(line)}
              </span>
            </div>
          </div>
        )}

        {isLoading && chartGames.length === 0 ? (
          <ChartSkeleton />
        ) : chartGames.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div
            ref={scrollRef}
            className="relative z-[10] overflow-x-auto pb-1 scrollbar-thin"
          >
            {/* Outer track grows beyond container only when content overflows.
                Inner mx-auto centers the bars when there's empty horizontal space. */}
            <div className="w-max min-w-full">
              <div ref={innerTrackRef} className="relative mx-auto" style={{ width: Math.max(trackWidth, 0) }}>
              {/* Hover card is portaled to body below — see HoverCardPortal. */}
              {/* Chart frame */}
              <div className="relative" style={{ height: CHART_HEIGHT }}>
                {/* Threshold + y-axis + grid live in the outer background frame
                    so they span the full chart panel width regardless of how
                    many bars are in view. Bars overlay them via this scroll
                    container. */}

                {/* Season range chips — one centered chip per season, sitting
                    above its bar group. Pills + dividers between adjacent
                    ranges replace the old single-tab-on-divider treatment. */}
                {seasonRanges.map((r, i) => {
                  const startX = r.startIndex * (barWidth + gapPx);
                  const endX = (r.endIndex + 1) * (barWidth + gapPx) - gapPx;
                  const isFirst = i === 0;
                  return (
                    <React.Fragment key={`${r.seasonId}-${r.startIndex}`}>
                      {!isFirst && (
                        <div
                          className="pointer-events-none absolute inset-y-0 z-[5]"
                          style={{ left: startX - gapPx / 2 }}
                          aria-hidden
                        >
                          <div className="absolute inset-y-0 -left-px w-px bg-neutral-300/60 dark:bg-neutral-600/50" />
                          <div className="absolute inset-y-0 -left-6 w-12 bg-gradient-to-r from-transparent via-neutral-300/[0.15] to-transparent dark:via-white/[0.06]" />
                        </div>
                      )}
                      {/* Season label — anchored at the START of each range
                          (right next to its leading divider, or to the left
                          edge for the first range) so the chart reads like a
                          timeline. Suppressed when the range is too narrow
                          to host the label cleanly. */}
                      {endX - startX >= 60 && (
                        <div
                          className="pointer-events-none absolute top-1 z-[5] whitespace-nowrap rounded-md border border-neutral-200 bg-white/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-600 shadow-sm backdrop-blur-sm dark:border-neutral-700/80 dark:bg-neutral-900/85 dark:text-neutral-300"
                          style={{ left: isFirst ? 4 : startX + 6 }}
                        >
                          {r.label} Season
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* OVERLAY: Confidence Band — horizontal brand-cyan band
                    spanning the chart, vertical bounds are median ± 1σ of
                    visible values. Sits behind the bars (z-[1]) so the bars
                    still pop. Only renders when the user has the toggle on
                    and we have enough samples. */}
                {chartSettings.showConfidenceBand && confidenceBand && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[1] bg-brand/15 ring-1 ring-brand/20"
                    style={{
                      bottom: `${(confidenceBand.lower / maxValue) * 100}%`,
                      height: `${
                        ((confidenceBand.upper - confidenceBand.lower) /
                          maxValue) *
                        100
                      }%`,
                    }}
                    aria-hidden
                  >
                    <div className="absolute -top-px left-0 right-0 h-px bg-brand/40" />
                    <div className="absolute -bottom-px left-0 right-0 h-px bg-brand/40" />
                  </div>
                )}

                {/* OVERLAY LINES: DvP + Pace as line charts threaded through
                    the bars. Each line sits at z-[14] (above bars at z-0,
                    below threshold at z-[20]) so it reads as a true overlay
                    without burying the bar values. Both share a single SVG
                    layer for one paint. */}
                {(chartSettings.showDvpOverlay || chartSettings.showPaceOverlay) &&
                  chartGames.length > 0 && (
                    // viewBox uses REAL pixel dimensions (matches the chart's
                    // actual width × CHART_HEIGHT) so circles stay round and
                    // dots land exactly on bar centers. The previous
                    // preserveAspectRatio="none" + 0..100 viewBox stretched
                    // the dots into vertical ovals.
                    <svg
                      className="pointer-events-none absolute inset-0 z-[14]"
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${Math.max(1, trackWidth)} ${CHART_HEIGHT}`}
                      // Default preserveAspectRatio = xMidYMid meet — preserves
                      // the aspect ratio so circles stay round. The inner
                      // track explicitly sizes to trackWidth × CHART_HEIGHT
                      // so the viewBox matches the rendered area; no scaling.
                    >
                      {chartSettings.showDvpOverlay && dvpRankByOpponent && (
                        <RankLineOverlay
                          games={chartGames}
                          rankMap={dvpRankByOpponent}
                          totalTeams={dvpTotalTeams ?? 30}
                          barWidth={barWidth}
                          gapPx={gapPx}
                          chartHeight={CHART_HEIGHT}
                          stroke="rgb(245 158 11 / 0.95)"
                          dotFill="rgb(245 158 11)"
                          label="DvP"
                          // Invert so soft D (high rank, e.g. #29) sits at
                          // the TOP of the chart and tough D (low rank, #1)
                          // at the bottom. Reads as "high = good matchup"
                          // matching how bars work.
                          inverted
                        />
                      )}
                      {chartSettings.showPaceOverlay && paceRankByOpponent && (
                        <RankLineOverlay
                          games={chartGames}
                          rankMap={paceRankByOpponent}
                          totalTeams={dvpTotalTeams ?? 30}
                          barWidth={barWidth}
                          gapPx={gapPx}
                          chartHeight={CHART_HEIGHT}
                          stroke="rgb(59 130 246 / 0.95)"
                          dotFill="rgb(59 130 246)"
                          label="Pace"
                          dashed
                        />
                      )}
                    </svg>
                  )}

                {/* Bars track */}
                <div
                  className="absolute inset-0 flex items-end justify-start"
                  style={{ gap: gapPx }}
                >
                  {chartGames.map((game, idx) => (
                    <BarColumn
                      key={`${game.gameId}-${idx}`}
                      value={values[idx]}
                      potential={potentials[idx]}
                      line={line}
                      maxValue={maxValue}
                      chartHeight={CHART_HEIGHT}
                      barWidth={barWidth}
                      hasAnyPotential={hasAnyPotential}
                      animationDelay={idx * 12}
                      showValueLabel={range !== "szn"}
                      onMouseEnter={() => {
                        cancelHoverClear();
                        setHoveredIndex(idx);
                      }}
                      onMouseLeave={() => scheduleHoverClear(idx)}
                    />
                  ))}

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

              {/* X-axis: text-only opponent + date (props.cash style).
                  Format: "@OKC" for road games, "OKC" (no prefix) for home.
                  Sparsified at high counts; first + last always visible. */}
              <div className="mt-1.5 flex items-start" style={{ gap: gapPx }}>
                {chartGames.map((game, idx) => {
                  const showLabel =
                    idx === 0 ||
                    idx === chartGames.length - 1 ||
                    idx % axisStride === 0;
                  const opp = game.opponentAbbr || "OPP";
                  const venuePrefix = game.homeAway === "A" ? "@" : "";
                  return (
                    <div
                      key={`${game.gameId}-axis-${idx}`}
                      className="flex shrink-0 flex-col items-center"
                      style={{ width: barWidth }}
                    >
                      {showLabel ? (
                        <>
                          <span className="text-[10px] font-bold leading-none text-neutral-500 dark:text-neutral-400">
                            <span className="text-neutral-400 dark:text-neutral-500">{venuePrefix}</span>
                            {opp}
                          </span>
                          <span className="mt-0.5 text-[9px] font-medium tabular-nums leading-none text-neutral-400 dark:text-neutral-500">
                            {formatBarDate(game.date)}
                          </span>
                        </>
                      ) : (
                        <div className="h-4" aria-hidden />
                      )}
                    </div>
                  );
                })}
                {upcomingSlot && (
                  <div
                    className="flex shrink-0 flex-col items-center"
                    style={{ width: barWidth }}
                  >
                    <span className="text-[10px] font-bold leading-none text-brand">
                      <span className="text-brand/70">
                        {upcomingSlot.homeAway === "A" ? "@" : ""}
                      </span>
                      {upcomingSlot.opponentAbbr ?? "OPP"}
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold tabular-nums leading-none text-brand">
                      Next
                    </span>
                  </div>
                )}
              </div>

              {/* Overlay legend — only shown when at least one context
                  overlay is enabled. Tells the user what the lines mean
                  without forcing them to remember the popover swatches. */}
              {(chartSettings.showConfidenceBand ||
                chartSettings.showDvpOverlay ||
                chartSettings.showPaceOverlay) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                  {chartSettings.showConfidenceBand && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-3.5 rounded-sm bg-brand/30 ring-1 ring-brand/50" />
                      <span>Confidence band</span>
                      <span className="text-neutral-400 dark:text-neutral-600">
                        (median ± 1σ)
                      </span>
                    </span>
                  )}
                  {chartSettings.showDvpOverlay && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative h-0.5 w-5 rounded-full bg-amber-500/90" />
                      <span>DvP rank</span>
                      <span className="text-neutral-400 dark:text-neutral-600">
                        (high = soft D)
                      </span>
                    </span>
                  )}
                  {chartSettings.showPaceOverlay && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="relative h-0.5 w-5 rounded-full bg-blue-500/90"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 6px)",
                          color: "rgb(59 130 246 / 0.9)",
                          background: "transparent",
                        }}
                      />
                      <span>Pace rank</span>
                      <span className="text-neutral-400 dark:text-neutral-600">
                        (#1 fastest)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Splits chips */}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-neutral-200/50 px-3 py-2 dark:border-neutral-800/50 sm:px-4">
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

      {/* Quick filters — market-aware chips. Cap pinned to upcoming game's
          venue (Home/Away). Right-aligned "+ Filters" stub for the future
          drawer that hosts the heavier overlay filters. */}
      {inlineQuickFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-neutral-200/50 px-3 py-2 dark:border-neutral-800/50 sm:px-4">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
            Quick
          </span>
          {(() => {
            // Pre-process: collapse all dvp tier chips (dvpTopFive, dvpTough,
            // dvpAvg, dvpWeak, dvpBottomFive) into a single "DEF" popover
            // entry. Without this we'd render five chips for what the user
            // can express as a single rank range.
            const dvpChips: Array<typeof inlineQuickFilters[number]> = [];
            const remainingChips: typeof inlineQuickFilters = [];
            for (const qf of inlineQuickFilters) {
              if (qf.id.startsWith("dvp")) dvpChips.push(qf);
              else remainingChips.push(qf);
            }
            const showDvpRange = dvpChips.length > 0 && !!dvpRankByOpponent && dvpRankByOpponent.size > 0;
            return (
              <>
                {showDvpRange && (() => {
                  // Active range comes from any `metric:dvpRank:*` chip in
                  // the current filter set. Legacy dvp tier chip ids
                  // (dvpTopFive etc.) just dim the trigger to show "active"
                  // without trying to back-translate cutoffs into a range.
                  const ids = [...(quickFilters ?? new Set<string>())];
                  let activeRange: { min: number; max: number | null } | null = null;
                  let legacyActive = false;
                  for (const id of ids) {
                    const parsed = parseMetricFilterId(id);
                    if (parsed && parsed.key === "dvpRank") {
                      activeRange = { min: parsed.min, max: parsed.max };
                      break;
                    }
                    if (id.startsWith("dvp")) legacyActive = true;
                  }
                  return (
                    <MetricRangePopover
                      config={DVP_RANK_CONFIG}
                      recentGames={games}
                      activeRange={activeRange}
                      active={activeRange !== null || legacyActive}
                      getValueOverride={(g) =>
                        dvpRankByOpponent?.get(g.opponentTeamId) ?? null
                      }
                      minOverride={1}
                      maxOverride={dvpTotalTeams}
                      onChange={(range) => {
                        const next = new Set(quickFilters ?? new Set<string>());
                        // Drop any existing dvp filter — both metric:dvpRank:*
                        // and the legacy tier chips — so a fresh range
                        // doesn't double up with old presets.
                        for (const id of [...next]) {
                          const parsed = parseMetricFilterId(id);
                          if (parsed && parsed.key === "dvpRank") next.delete(id);
                          if (id.startsWith("dvp")) next.delete(id);
                        }
                        if (range) {
                          next.add(metricFilterId("dvpRank", range.min, range.max));
                        }
                        onQuickFiltersSet?.(next);
                      }}
                    />
                  );
                })()}
                {remainingChips.map((qf) => {
            // Threshold-style chips (minutes30, fga15, threePtA5, etc.) get
            // upgraded to a popover trigger with slider + numeric inputs +
            // quick-pill thresholds. Other chips (venue, gameflow, etc.)
            // stay as plain toggle buttons since they're already binary.
            const metricKey = getMetricKeyFromInlineChipId(qf.id);
            const metricConfig = metricKey
              ? METRIC_FILTERS.find((c) => c.key === metricKey)
              : null;
            if (metricConfig) {
              // Resolve the active range (if any) for this metric from the
              // current quickFilters set — could be a `metric:KEY:range:...`
              // or `metric:KEY:gte:...` id, OR the legacy short-form (e.g.,
              // `minutes30`). All three cases collapse to {min, max} here.
              let activeRange: { min: number; max: number | null } | null = null;
              const ids = [...(quickFilters ?? new Set<string>())];
              for (const id of ids) {
                const parsed = parseMetricFilterId(id);
                if (parsed && parsed.key === metricKey) {
                  activeRange = { min: parsed.min, max: parsed.max };
                  break;
                }
                const legacy = id.match(/^([a-zA-Z]+)(\d+(?:\.\d+)?)$/);
                if (
                  legacy &&
                  INLINE_CHIP_TO_METRIC_KEY[legacy[1]] === metricKey
                ) {
                  activeRange = { min: Number(legacy[2]), max: null };
                  break;
                }
              }
              const isActive = activeRange !== null;
              return (
                <MetricRangePopover
                  key={qf.id}
                  config={metricConfig}
                  recentGames={games}
                  activeRange={activeRange}
                  active={isActive}
                  onChange={(range) => {
                    // Replace any existing chip for this metric (legacy or
                    // metric:* form) with the new range. Reuse the same
                    // toggle hook by clearing first then adding.
                    const next = new Set(quickFilters ?? new Set<string>());
                    for (const id of [...next]) {
                      const parsed = parseMetricFilterId(id);
                      if (parsed && parsed.key === metricKey) next.delete(id);
                      const legacy = id.match(/^([a-zA-Z]+)\d+(?:\.\d+)?$/);
                      if (
                        legacy &&
                        INLINE_CHIP_TO_METRIC_KEY[legacy[1]] === metricKey
                      )
                        next.delete(id);
                    }
                    if (range) {
                      next.add(metricFilterId(metricConfig.key, range.min, range.max));
                    }
                    onQuickFiltersSet?.(next);
                  }}
                />
              );
            }

            const active = quickFilters?.has(qf.id) ?? false;
            return (
              <button
                key={qf.id}
                type="button"
                onClick={() => onQuickFilterToggle?.(qf.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-bold transition-all duration-150",
                  active
                    ? "bg-brand text-neutral-950 shadow-sm shadow-brand/25"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
                )}
              >
                {qf.label}
              </button>
            );
          })}
              </>
            );
          })()}
          {(quickFilters?.size ?? 0) > 0 && onQuickFiltersClear && (
            <button
              type="button"
              onClick={onQuickFiltersClear}
              className="ml-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 transition-colors hover:text-brand dark:text-neutral-500"
            >
              Clear
            </button>
          )}
          {/* Right-side cluster: chart settings (gear) + filters trigger.
              Settings was buried up in headerRight; pairing it with Filters
              here puts both "modify the chart's display" controls in the
              same spot. */}
          <div className="ml-auto inline-flex items-center gap-1.5">
            <ChartSettingsPopover />
            <FiltersDrawer
            market={market}
            upcomingHomeAway={upcomingHomeAway}
            recentGames={games}
            dvpRankByOpponent={dvpRankByOpponent}
            totalTeams={dvpTotalTeams}
            playTypeDefenseFilters={playTypeDefenseFilters}
            active={quickFilters ?? new Set()}
            onToggle={(id) => onQuickFilterToggle?.(id)}
            onClearAll={() => onQuickFiltersClear?.()}
            onApplyPreset={(ids) => onQuickFiltersSet?.(ids)}
            trigger={
              // When filters are active, the trigger flips from a quiet
              // "+ Filters" outline to a brand-cyan filled chip with the
              // count baked in — gives users a constant readout of how
              // many filters are applied without re-opening the panel.
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors",
                  (quickFilters?.size ?? 0) > 0
                    ? "border-brand/45 bg-brand/15 text-brand hover:bg-brand/25"
                    : "border-neutral-200 text-neutral-600 hover:border-brand/40 hover:text-brand dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-brand",
                )}
              >
                {(quickFilters?.size ?? 0) > 0 ? (
                  <>
                    <SlidersHorizontal className="h-3 w-3" />
                    Filters · {quickFilters!.size}
                  </>
                ) : (
                  <>+ Filters</>
                )}
              </button>
            }
          />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bar-rise {
          from {
            height: 0;
            opacity: 0;
          }
        }
      `}</style>
      {/* Global keyframes for the line overlay draw-in. styled-jsx scopes
          everything by default, but SVG-rendered children can fall outside
          that scope; using global ensures the keyframes resolve everywhere
          they're referenced. */}
      <style jsx global>{`
        @keyframes rankline-draw {
          from {
            stroke-dashoffset: 1;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes rankline-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>

      {/* Hover card — portaled to document.body so it isn't clipped by the
          Tile's overflow-hidden. Position is the bar's screen-space center,
          page-scroll-aware. Placement flips above ↔ below based on available
          room, and the horizontal anchor is clamped so it never overruns the
          viewport. Smooth left/top transitions slide the card between bars
          instead of fade-cycling on each move. */}
      {hoverAnchor &&
        hoveredIndex !== null &&
        hoveredIndex < chartGames.length &&
        typeof window !== "undefined" &&
        createPortal(
          // pointer-events-auto + a sticky-handoff: when the cursor leaves a
          // bar we don't immediately clear hoveredIndex (a 120ms timer does).
          // If the cursor enters this tooltip during that window, we cancel
          // the timer so the tooltip stays open. Leaving the tooltip clears
          // immediately.
          <div
            className="pointer-events-auto absolute z-[100] overflow-visible transition-[left,top] duration-150 ease-out"
            style={{
              left: hoverAnchor.left,
              top: hoverAnchor.top,
              transform:
                hoverAnchor.placement === "above"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
            }}
            onMouseEnter={cancelHoverClear}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {(() => {
              const hg = chartGames[hoveredIndex];
              // Per-game DvP / Pace ranks — only fed into the tooltip when
              // the corresponding overlay setting is on, so the matchup
              // context row stays hidden when those overlays aren't in use.
              const dvpRank =
                chartSettings.showDvpOverlay && hg.opponentTeamId != null
                  ? (dvpRankByOpponent?.get(hg.opponentTeamId) ?? null)
                  : null;
              const paceRank =
                chartSettings.showPaceOverlay && hg.opponentTeamId != null
                  ? (paceRankByOpponent?.get(hg.opponentTeamId) ?? null)
                  : null;
              return renderBarTooltip({
                game: hg,
                value: values[hoveredIndex],
                potential: potentials[hoveredIndex],
                line,
                market,
                sport,
                injuries:
                  gameInjuriesByGameId?.get(hg.gameId) ??
                  gameInjuriesByGameId?.get(normalizeInjuryGameId(hg.gameId)) ??
                  null,
                playerAvgsById,
                dvpRank,
                paceRank,
                totalTeams: dvpTotalTeams ?? 30,
              });
            })()}
          </div>,
          document.body
        )}
    </Tile>
  );
}

// Single bar column. Composes a ghost "potential" bar (full-width, gray, in
// back) and the colored "actual" bar (narrower, in front) when potential data
// is available for the active market. When it isn't, falls back to a single
// full-width colored bar — same look the chart had before this overlay landed.
//
// Labels live INSIDE their bar elements (absolute bottom-full) so they ride
// the bar's height + opacity animation. If they were absolute-positioned at
// the column level instead, they'd appear at their final spots while the bars
// rose from zero — which read as broken on first load.
interface BarColumnProps {
  value: number;
  potential: number | null;
  line: number;
  maxValue: number;
  chartHeight: number;
  barWidth: number;
  hasAnyPotential: boolean;
  animationDelay: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  // Hide the per-bar numeric label. Season view stuffs 30+ bars into the same
  // strip and the labels become illegible noise; tooltip still shows the value.
  showValueLabel?: boolean;
}

function BarColumn({
  value,
  potential,
  line,
  maxValue,
  chartHeight,
  barWidth,
  hasAnyPotential,
  animationDelay,
  onMouseEnter,
  onMouseLeave,
  showValueLabel = true,
}: BarColumnProps) {
  const isHit = value >= line;
  const heightPx = Math.max(4, (value / maxValue) * chartHeight);
  const showGhost = hasAnyPotential && potential != null && potential > 0;
  const ghostHeightPx = showGhost ? Math.max(4, (potential! / maxValue) * chartHeight) : 0;
  // Slim the actual bar whenever the chart is in "potential mode" — keeps bar
  // widths consistent across all columns even when a game is missing potential.
  // Wider ratio (0.78) so the colored bar reads as the primary value with the
  // ghost framing it, instead of the ghost dominating.
  const actualWidth = hasAnyPotential ? Math.max(barWidth * 0.78, 8) : barWidth;
  // When the potential and actual labels would visually merge, push the
  // potential one a bit higher via extra bottom margin (its bar is the parent
  // it rides — the offset is applied to the LABEL, not the ghost height).
  const labelGap = ghostHeightPx - heightPx;
  const ghostLabelExtra = labelGap < 14 ? 14 - labelGap : 0;

  const animation = `bar-rise 360ms ${animationDelay}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) backwards`;

  return (
    <div
      className="group/bar relative h-full shrink-0"
      style={{ width: barWidth }}
    >
      {/* Ghost (potential) — anchored center, sits behind the actual bar.
          Its label is a CHILD positioned at bottom-full, so the label rides
          the ghost's height animation instead of jumping in pre-positioned.
          Hover handlers live on the bar geometry (here + the colored bar
          below), not the column wrapper, so the tooltip only fires when the
          cursor is actually over a bar — not the empty chart bg above it. */}
      {showGhost && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[3px] bg-neutral-300/45 ring-1 ring-inset ring-neutral-300/30 dark:bg-neutral-700/40 dark:ring-neutral-600/25"
          style={{ width: barWidth, height: ghostHeightPx, animation }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <span
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium tabular-nums leading-none text-neutral-400 dark:text-neutral-500"
            style={{ marginBottom: 2 + ghostLabelExtra }}
          >
            {showValueLabel ? potential : null}
          </span>
        </div>
      )}

      {/* Actual colored bar — narrower when a ghost is present. Same nesting
          pattern: label is a child so it rides the bar's animation. */}
      <div
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[3px] transition-all duration-200 ease-out",
          "shadow-[0_-1px_0_rgba(255,255,255,0.22)_inset]",
          "group-hover/bar:brightness-110 group-hover/bar:-translate-y-0.5",
          isHit
            ? "bg-gradient-to-t from-emerald-600/70 to-emerald-400 dark:from-emerald-500/55 dark:to-emerald-400"
            : "bg-gradient-to-t from-red-600/70 to-red-400 dark:from-red-500/55 dark:to-red-400"
        )}
        style={{ width: actualWidth, height: heightPx, animation }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {showValueLabel && (
          <span
            className={cn(
              "pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-black tabular-nums leading-none",
              // Hide when potential overlay is on — the ghost label above
              // already conveys the magnitude and stacking two labels gets noisy.
              // Above the bar in tiny when the bar is too short to host the
              // label inside; otherwise inside-the-bar in white for max contrast.
              heightPx < 22
                ? "bottom-full mb-0.5 text-[9px] " +
                  (isHit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400")
                : "top-1.5 text-[12px] text-neutral-900 [text-shadow:_0_1px_2px_rgba(255,255,255,0.45)] dark:text-white dark:[text-shadow:_0_1px_2px_rgba(0,0,0,0.35)]"
            )}
          >
            {Number.isInteger(value) ? value : value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// Rich hover card — opponent + result header, hero stat, optional potential
// row with conversion %, market-specific stats, then a "Teammates Out"
// section when historical injury context exists. Designed for fast scan:
// who/when at the top, the answer in the middle, supporting context below.
function renderBarTooltip({
  game,
  value,
  potential,
  line,
  market,
  sport,
  injuries,
  playerAvgsById,
  dvpRank,
  paceRank,
  totalTeams,
}: {
  game: BoxScoreGame;
  value: number;
  potential: number | null;
  line: number;
  market: string;
  sport: "nba" | "wnba";
  injuries: GameWithInjuries | null;
  playerAvgsById?: Map<number, PlayerOutInfo>;
  // Per-game opponent context — only set when the corresponding overlay is
  // enabled. Renders a small "Matchup Context" row at the bottom of the
  // tooltip with rank + tier label.
  dvpRank?: number | null;
  paceRank?: number | null;
  totalTeams?: number;
}) {
  const isHit = value >= line;
  const margin = value - line;
  const date = new Date(`${game.date}T00:00:00`);
  const tooltipDate = Number.isNaN(date.getTime())
    ? game.date
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const opponentLabel = game.opponentAbbr || "OPP";
  const showPotential = potential != null && potential > 0;
  const conversionPct =
    showPotential && potential! > 0 ? Math.round((value / potential!) * 100) : null;

  return (
    <div className="w-[300px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900">
      {/* Header — opponent, date, result */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 px-3 py-2 dark:border-neutral-800/60">
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
                : "bg-red-500/15 text-red-600 ring-red-500/25 dark:text-red-400"
            )}
          >
            {game.result}{" "}
            {Math.abs(game.margin) > 0
              ? `${game.result === "W" ? "+" : ""}${game.margin}`
              : `${game.teamScore}-${game.opponentScore}`}
          </span>
        )}
      </div>

      {/* Hero — actual value + market label, margin vs line */}
      <div className="flex items-end justify-between gap-3 px-3 pt-2.5 pb-1.5">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-2xl font-black leading-none tabular-nums tracking-tight sm:text-3xl",
              isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
              isHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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

      {/* Potential context — only when the active market has it. Label and
          value pair on the left ("POTENTIAL  26"), conversion % anchored right. */}
      {showPotential && (
        <div className="px-3 pb-1.5">
          <div className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-2.5 py-1 dark:bg-neutral-800/60">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black tabular-nums text-neutral-700 dark:text-neutral-200">
                {potential}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                Potential
              </span>
            </div>
            {conversionPct !== null && (
              <span className="text-[10px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
                {conversionPct}% converted
              </span>
            )}
          </div>
        </div>
      )}

      {/* Per-market stats — minutes, usage, rebounds breakdown, etc. */}
      <div className="px-3 pb-2.5">{getGameStatRows(game, market)}</div>

      {/* Matchup context strip — DvP / Pace ranks for this game. Sits
          between the per-market stats and Teammates Out as supporting
          context. Single inline row (label + #rank + tier) keeps the block
          compact instead of large card-style cells. */}
      {(typeof dvpRank === "number" || typeof paceRank === "number") &&
        typeof totalTeams === "number" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-200/40 px-3 py-1.5 text-[11px] dark:border-neutral-800/40">
            {typeof dvpRank === "number" && (
              <RankInline
                label="Opp DvP"
                rank={dvpRank}
                totalTeams={totalTeams}
                kind="dvp"
              />
            )}
            {typeof paceRank === "number" && (
              <RankInline
                label="Opp Pace"
                rank={paceRank}
                totalTeams={totalTeams}
                kind="pace"
              />
            )}
          </div>
        )}

      {/* Teammates Out — top 3 by season avg for this stat. Avg gets a tier
          color (gold/orange/neutral) so the eye spots the impact rotation
          changes immediately. */}
      {injuries && injuries.teammates_out && injuries.teammates_out.length > 0 && (
        <TeammatesOutSection
          teammates={injuries.teammates_out}
          market={market}
          sport={sport}
          playerAvgsById={playerAvgsById}
        />
      )}
    </div>
  );
}

// Compact "teammates out" footer for the bar tooltip. Picks the avg field
// matching the active market (assists market → avg_ast, rebounds → avg_reb,
// etc.) and color-codes the chip based on impact magnitude.
function TeammatesOutSection({
  teammates,
  market,
  sport,
  playerAvgsById,
}: {
  teammates: GameWithInjuries["teammates_out"];
  market: string;
  sport: "nba" | "wnba";
  playerAvgsById?: Map<number, PlayerOutInfo>;
}) {
  // Get per-stat avg, preferring the embedded WNBA per-game value but
  // falling back to the season-wide PlayerOutInfo from playersOutForFilter
  // (NBA path doesn't embed avgs per-game). Without this fallback the list
  // sorts alphabetically because every avg ends up null.
  const pickAvg = (t: GameWithInjuries["teammates_out"][number]): number | null => {
    const seasonAvg = playerAvgsById?.get(t.player_id);
    const ptsAvg = t.avg_pts ?? seasonAvg?.avg_pts ?? null;
    const rebAvg = t.avg_reb ?? seasonAvg?.avg_reb ?? null;
    const astAvg = t.avg_ast ?? seasonAvg?.avg_ast ?? null;

    // Combo markets first so substring matches don't trip over each other.
    if (market === "player_points_rebounds_assists") {
      const p = ptsAvg ?? 0;
      const r = rebAvg ?? 0;
      const a = astAvg ?? 0;
      const sum = p + r + a;
      return sum > 0 ? sum : null;
    }
    if (market === "player_rebounds_assists") {
      const r = rebAvg ?? 0;
      const a = astAvg ?? 0;
      const sum = r + a;
      return sum > 0 ? sum : null;
    }
    if (market === "player_points_assists") {
      const p = ptsAvg ?? 0;
      const a = astAvg ?? 0;
      const sum = p + a;
      return sum > 0 ? sum : null;
    }
    if (market === "player_points_rebounds") {
      const p = ptsAvg ?? 0;
      const r = rebAvg ?? 0;
      const sum = p + r;
      return sum > 0 ? sum : null;
    }
    if (market === "player_assists") return astAvg;
    if (market === "player_rebounds") return rebAvg;
    // Default (points / threes / steals / blocks / turnovers / blk+stl): use
    // PPG as the impact proxy since those niche stats don't have per-player
    // avgs in the available payload.
    return ptsAvg;
  };

  const sorted = [...teammates]
    .map((t) => ({ ...t, _avg: pickAvg(t) }))
    .sort((a, b) => {
      if (a._avg !== null && b._avg !== null) return b._avg - a._avg;
      if (a._avg !== null) return -1;
      if (b._avg !== null) return 1;
      return a.name.localeCompare(b.name);
    });
  const top = sorted.slice(0, 3);
  const more = sorted.length - top.length;

  const avgTone = (avg: number | null) => {
    if (avg === null) return "text-neutral-400 dark:text-neutral-500";
    if (avg >= 15) return "text-amber-500 dark:text-amber-400";
    if (avg >= 8) return "text-orange-500 dark:text-orange-400";
    return "text-neutral-400 dark:text-neutral-500";
  };

  return (
    <div className="border-t border-neutral-200/60 bg-neutral-50/60 px-3 py-2 dark:border-neutral-800/60 dark:bg-neutral-950/40">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
          Teammates Out
        </span>
        {more > 0 && (
          <span className="text-[10px] font-bold tabular-nums text-amber-500 dark:text-amber-400">
            +{more} more
          </span>
        )}
      </div>
      <div className="space-y-1">
        {top.map((t) => (
          <div key={t.player_id} className="flex items-center gap-2">
            <div className="h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full bg-neutral-200 ring-1 ring-neutral-200/60 dark:bg-neutral-800 dark:ring-white/10">
              <PlayerHeadshot
                sport={sport}
                nbaPlayerId={t.nba_player_id ?? t.player_id}
                name={t.name}
                size="small"
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-neutral-700 dark:text-neutral-200">
                {t.name}
              </span>
              {t._avg !== null && (
                <span className={cn("text-[11px] font-bold tabular-nums", avgTone(t._avg))}>
                  {t._avg.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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

// The DB ships season_type as full strings like "Regular Season",
// "East First Round", "West Conf. Semifinals", "Emirates NBA Cup", etc.
// The split filter previously compared against lowercase short forms
// ("regular" / "playoffs") which never matched anything, so toggling the
// chip dropped every game. These helpers cover the full vocabulary.
function isPlayoffSeasonType(seasonType: string | undefined | null): boolean {
  if (!seasonType) return false;
  const lower = seasonType.toLowerCase();
  return /\b(playoffs?|postseason|round|conf\.?|finals?|play-in)\b/.test(lower);
}
function isRegularSeasonType(seasonType: string | undefined | null): boolean {
  if (!seasonType) return false;
  const lower = seasonType.toLowerCase();
  if (isPlayoffSeasonType(seasonType)) return false;
  if (lower === "preseason") return false;
  // Cup / international showcase / Rivals Week games count as regular for
  // stat purposes — they're regular-season slate games dressed up.
  return true;
}

// Range-button tier coloring — same thresholds as the hit-rate table so the
// chart header chips read with the same color language. Hover classes embed
// the `hover:` prefix as literals so Tailwind JIT picks them up.
function rangeButtonTone(value: number | null) {
  if (value === null || value === undefined) {
    return {
      text: "text-neutral-400 dark:text-neutral-500",
      textActive: "text-neutral-500 dark:text-neutral-400",
      bgActive: "bg-neutral-100 dark:bg-neutral-800/60",
      bgHover: "hover:bg-neutral-100/80 dark:hover:bg-neutral-800/40",
      borderActive: "border-neutral-200 dark:border-neutral-700",
    };
  }
  if (value >= 75) {
    return {
      text: "text-emerald-600 dark:text-emerald-300",
      textActive: "text-emerald-800 dark:text-white",
      bgActive: "bg-emerald-100 dark:bg-emerald-500/40",
      bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-500/20",
      borderActive: "border-emerald-500/30 dark:border-emerald-400/30",
    };
  }
  if (value >= 60) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      textActive: "text-emerald-700 dark:text-emerald-200",
      bgActive: "bg-emerald-50 dark:bg-emerald-500/20",
      bgHover: "hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10",
      borderActive: "border-emerald-500/20 dark:border-emerald-400/20",
    };
  }
  if (value >= 50) {
    return {
      text: "text-neutral-500 dark:text-neutral-300",
      textActive: "text-neutral-700 dark:text-neutral-100",
      bgActive: "bg-neutral-100 dark:bg-neutral-500/15",
      bgHover: "hover:bg-neutral-100/60 dark:hover:bg-neutral-700/30",
      borderActive: "border-neutral-300/50 dark:border-neutral-600/40",
    };
  }
  if (value >= 35) {
    return {
      text: "text-red-500 dark:text-red-300",
      textActive: "text-red-600 dark:text-red-200",
      bgActive: "bg-red-50 dark:bg-red-500/20",
      bgHover: "hover:bg-red-50/60 dark:hover:bg-red-500/10",
      borderActive: "border-red-500/20 dark:border-red-400/20",
    };
  }
  return {
    text: "text-red-600 dark:text-red-300",
    textActive: "text-red-800 dark:text-white",
    bgActive: "bg-red-100 dark:bg-red-500/40",
    bgHover: "hover:bg-red-50 dark:hover:bg-red-500/20",
    borderActive: "border-red-500/30 dark:border-red-400/30",
  };
}

// Maps a market to its "opportunity" stat — the ghost bar that frames the
// actual value. Assists → potential assists, rebounds → potential rebounds,
// threes → 3-point attempts. Combo markets only get a ghost when EVERY
// component has a tracked potential: rebounds + assists qualifies, points
// does not (no "potential points" stat exists), so PRA/PA/PR fall through.
function getPotentialValue(game: BoxScoreGame, market: string): number | null {
  if (market === "player_assists") {
    return game.potentialAssists ?? null;
  }
  if (market === "player_rebounds") {
    return game.potentialReb ?? null;
  }
  if (market === "player_threes_made") {
    return game.fg3a ?? null;
  }
  if (market === "player_rebounds_assists") {
    if (game.potentialReb == null && game.potentialAssists == null) return null;
    return (game.potentialReb ?? 0) + (game.potentialAssists ?? 0);
  }
  return null;
}

// Whether a market has an opportunity stat at all — drives whether the toggle
// chip is rendered in the chart header.
function marketSupportsPotential(market: string): boolean {
  return (
    market === "player_assists" ||
    market === "player_rebounds" ||
    market === "player_threes_made" ||
    market === "player_rebounds_assists"
  );
}

function formatBarDate(date: string | null | undefined): string {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

// Per-game rank line drawn through the chart frame. ViewBox is real pixel
// dimensions (chartWidth × chartHeight), so positions land precisely on bar
// centers and the geometry doesn't stretch. We use foreignObject for the
// dots so the circles render as real DOM circles (CSS-sized) rather than
// SVG circles that would scale with the viewBox aspect.
// Inline single-row matchup-context entry. Quieter than the old card-style
// `RankInline` — a tiny tone dot + label + rank + tier all on one baseline.
// Used at the bottom of the bar tooltip, between the per-market stats and
// Teammates Out, so it reads as supporting context rather than a hero stat.
// Color encodes whether the matchup is favorable for the OVER bet: green =
// good (soft D / fast pace), red = bad (tough D / slow pace), neutral = mid.
function RankInline({
  label,
  rank,
  totalTeams,
  kind,
}: {
  label: string;
  rank: number;
  totalTeams: number;
  kind: "dvp" | "pace";
}) {
  const toughMax = Math.max(1, Math.ceil(totalTeams / 3));
  const easyMin = totalTeams - toughMax + 1;
  let tier: string;
  let tone: "good" | "bad" | "mid";
  if (kind === "dvp") {
    // DvP: rank 1 = toughest D (bad for OVER), rank N = softest (good).
    if (rank <= toughMax) {
      tier = "Tough";
      tone = "bad";
    } else if (rank >= easyMin) {
      tier = "Soft";
      tone = "good";
    } else {
      tier = "Mid";
      tone = "mid";
    }
  } else {
    // Pace: rank 1 = fastest (more possessions = good for OVER).
    if (rank <= toughMax) {
      tier = "Fast";
      tone = "good";
    } else if (rank >= easyMin) {
      tier = "Slow";
      tone = "bad";
    } else {
      tier = "Mid";
      tone = "mid";
    }
  }
  const dotClass =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "bad"
        ? "bg-red-500"
        : "bg-neutral-400 dark:bg-neutral-500";
  const valueClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : "text-neutral-500 dark:text-neutral-400";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn("h-1.5 w-1.5 rounded-full self-center", dotClass)}
        aria-hidden
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className={cn("font-black tabular-nums", valueClass)}>#{rank}</span>
      <span className={cn("text-[10px] font-black uppercase tracking-[0.1em]", valueClass)}>
        {tier}
      </span>
    </span>
  );
}

function RankLineOverlay({
  games,
  rankMap,
  totalTeams,
  barWidth,
  gapPx,
  chartHeight,
  stroke,
  dotFill,
  label,
  dashed,
  inverted,
}: {
  games: Array<{ gameId: string | number; opponentTeamId?: number | null }>;
  rankMap: Map<number, number>;
  totalTeams: number;
  barWidth: number;
  gapPx: number;
  chartHeight: number;
  stroke: string;
  dotFill: string;
  label: string;
  dashed?: boolean;
  // When true, rank #1 maps to the BOTTOM of the chart and rank totalTeams
  // to the TOP. Useful for DvP — "favorable matchup" then sits high on the
  // chart, matching the bars' "high = good" convention. Pace stays default
  // (rank #1 = fastest at the top, since fast = favorable too).
  inverted?: boolean;
}) {
  // Map rank → y in chart pixels. With margins so dots don't collide with
  // the bar tops or baseline labels.
  const yMargin = 10;
  const yRange = Math.max(1, chartHeight - yMargin * 2);
  const points: Array<{ x: number; y: number; rank: number }> = [];
  games.forEach((game, idx) => {
    if (game.opponentTeamId == null) return;
    const rank = rankMap.get(game.opponentTeamId);
    if (rank == null) return;
    // Center of this game's bar column in pixels.
    const x = idx * (barWidth + gapPx) + barWidth / 2;
    const t = (rank - 1) / Math.max(1, totalTeams - 1); // 0..1
    const y = inverted
      ? yMargin + (1 - t) * yRange // rank 1 → bottom, rank N → top
      : yMargin + t * yRange; // rank 1 → top, rank N → bottom
    points.push({ x, y, rank });
  });
  if (points.length === 0) return null;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  return (
    <g aria-label={`${label} rank trend`}>
      {/* Solid lines use stroke-dasharray draw-in. Dashed (Pace) lines
          can't animate dasharray cleanly, so they fade in via group
          opacity instead. Both reach full state at the same beat as the
          bars-rise animation (~360ms) so the chart settles in sync. */}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "5 3" : "1"}
        pathLength={dashed ? undefined : 1}
        vectorEffect="non-scaling-stroke"
        style={
          dashed
            ? {
                opacity: 0,
                animation:
                  "rankline-fade 480ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 80ms forwards",
              }
            : {
                strokeDashoffset: 1,
                animation:
                  "rankline-draw 600ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 80ms forwards",
              }
        }
      />
      {/* Dots fade in alongside the line — quiet ease, no scale or
          overshoot. The earlier scale-pop felt too playful for a context
          overlay and the per-dot stagger looked busy on the dashed pace
          line in particular. */}
      {points.map((p) => (
        <circle
          key={`${label}-${p.x}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={dotFill}
          stroke="rgb(15 17 21)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{
            opacity: 0,
            animation:
              "rankline-fade 360ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 200ms forwards",
          }}
        />
      ))}
    </g>
  );
}

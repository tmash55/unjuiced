"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Search,
  Shield,
  Sliders,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/popover";
import { Tooltip } from "@/components/tooltip";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import {
  METRIC_FILTERS,
  DVP_RANK_CONFIG,
  MARGIN_CONFIG,
  getQuickFilters,
  metricFilterId,
  parseMetricFilterId,
  type MetricFilterCategory,
  type MetricFilterConfig,
  type PlayTypeDefenseQuickFilter,
  type QuickFilter,
} from "../shared/quick-filters";

// Drawer-side mapping from canonical metric key back to the legacy
// short-form chip prefix (e.g. "minutes" → "minutes30" / "fga" → "fga15").
// Used when the volume/defense sliders apply a range so we also clear any
// stale tier chips for the same metric in the active filter set.
const METRIC_KEY_TO_LEGACY_PREFIX: Record<string, string> = {
  minutes: "minutes",
  fga: "fga",
  fg3a: "threePtA",
  potentialReb: "rebChances",
  potentialAssists: "potAst",
};

// Volume tab pulls these specific keys from METRIC_FILTERS — minutes drives
// opportunity, fga/fg3a drive shooting volume, potentialReb/potentialAssists
// drive playmaking volume.
const VOLUME_METRIC_KEYS = [
  "minutes",
  "fga",
  "fg3a",
  "potentialReb",
  "potentialAssists",
];

type FilterCategoryId =
  | "defense"
  | "volume"
  | "ranges"
  | "gameflow"
  | "schedule";

interface CategoryDef {
  id: FilterCategoryId;
  label: string;
  icon: React.ElementType;
  hint: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "defense",
    label: "Defense",
    icon: Shield,
    hint: "Opponent rank vs position & play type",
  },
  {
    id: "volume",
    label: "Volume",
    icon: TrendingUp,
    hint: "Player-relative shot / usage / minutes thresholds",
  },
  {
    id: "ranges",
    label: "Stat Ranges",
    icon: Sliders,
    hint: "Drag-range sliders for any stat",
  },
  {
    id: "gameflow",
    label: "Game Flow",
    icon: Activity,
    hint: "Close games and blowouts",
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: Calendar,
    hint: "Venue, rest, day of week",
  },
];

interface FiltersDrawerProps {
  market: string;
  upcomingHomeAway: string | null | undefined;
  recentGames: BoxScoreGame[];
  dvpRankByOpponent?: Map<number, number>;
  totalTeams?: number;
  playTypeDefenseFilters?: PlayTypeDefenseQuickFilter[];
  active: Set<string>;
  onToggle: (id: string) => void;
  onClearAll: () => void;
  onApplyPreset: (ids: Set<string>) => void;
  trigger: React.ReactNode;
}

interface SmartPreset {
  id: string;
  label: string;
  description: string;
  build: (filters: QuickFilter[]) => Set<string>;
}

// Conflict-group resolver: returns a stable "group" name for filter ids
// that should be mutually exclusive. Used when merging a preset on top of
// existing filters — we keep current filters AND add the preset's, but
// drop any existing filter whose group is being overwritten by the preset.
// Returns null for filter ids that can stack freely.
function conflictGroup(id: string): string | null {
  if (id.startsWith("venue")) return "venue";
  if (id.startsWith("dvp")) return "dvp";
  if (id === "closeGame" || id === "wonBy15" || id === "lostBy15") return "gameflow";
  if (id === "b2b" || id === "rest2plus" || id === "rest3plus") return "rest";
  if (id.startsWith("dow")) return "dow";
  // Threshold filters — id format is `<stat><N>`. Each stat allows only one
  // active threshold so applying minutes30 should override minutes36.
  if (id.startsWith("minutes")) return "minutes";
  if (id.startsWith("fga")) return "fga";
  if (id.startsWith("threePtA")) return "threePtA";
  if (id.startsWith("potAst")) return "potAst";
  if (id.startsWith("rebChances")) return "rebChances";
  if (/^ast\d/.test(id)) return "ast";
  // playType:<type>:<tier> — pre-existing exclusive helper handles within
  // a play type, but cross-preset we still want one tier per play type.
  if (id.startsWith("playType:")) {
    // Group by everything up to the last segment so different tiers of the
    // same play type are exclusive (e.g. playType:spotUp:tough vs :favorable).
    const lastColon = id.lastIndexOf(":");
    return lastColon > 0 ? id.slice(0, lastColon) : id;
  }
  return null;
}

// Merge a preset's filter ids on top of the user's currently-active set:
// keep all non-conflicting active filters, drop any that share a conflict
// group with the preset, then add the preset's ids. Lets users layer e.g.
// `Close (≤5)` with `Favorable Spot` instead of having the preset wipe
// their existing chips.
function mergeWithPreset(
  current: Set<string>,
  presetIds: Set<string>,
): Set<string> {
  const next = new Set(current);
  const overriddenGroups = new Set<string>();
  for (const id of presetIds) {
    const g = conflictGroup(id);
    if (g) overriddenGroups.add(g);
  }
  for (const existing of [...next]) {
    const g = conflictGroup(existing);
    if (g && overriddenGroups.has(g)) next.delete(existing);
  }
  for (const id of presetIds) next.add(id);
  return next;
}

function buildPresets(filters: QuickFilter[]): SmartPreset[] {
  const byPrefix = (prefix: string) => filters.find((f) => f.id.startsWith(prefix))?.id;

  const minutes = byPrefix("minutes");
  const fga = byPrefix("fga");
  const threePtA = byPrefix("threePtA");
  const potAst = byPrefix("potAst");
  const rebChances = byPrefix("rebChances");
  const venueHome = byPrefix("venueHome");
  const venueAway = byPrefix("venueAway");
  const dvpTough = byPrefix("dvpTough");
  const dvpWeak = byPrefix("dvpWeak");
  const dvpAvg = byPrefix("dvpAvg");
  const restAdv = filters.find((f) => f.id === "rest2plus")?.id;
  const closeGame = filters.find((f) => f.id === "closeGame")?.id;
  const blowout = filters.find((f) => f.id === "blowout")?.id;
  const b2b = filters.find((f) => f.id === "b2b")?.id;

  const venueId = venueHome ?? venueAway;
  const presets: SmartPreset[] = [];

  if (dvpWeak || venueId || minutes) {
    presets.push({
      id: "favorable",
      label: "Favorable Spot",
      description: "Soft D + tonight's venue + starter min",
      build: () => {
        const ids = new Set<string>();
        if (dvpWeak) ids.add(dvpWeak);
        if (venueId) ids.add(venueId);
        if (minutes) ids.add(minutes);
        return ids;
      },
    });
  }

  if (dvpTough) {
    presets.push({
      id: "tough",
      label: "Tough Matchup",
      description: "Top-tier defense vs this stat",
      build: () => new Set([dvpTough!]),
    });
  }

  const volumeId = fga ?? threePtA ?? potAst ?? rebChances;
  if (volumeId && minutes) {
    presets.push({
      id: "heavy-volume",
      label: "Heavy Volume",
      description: "Above-avg shot/usage + starter min",
      build: () => new Set([volumeId, minutes!]),
    });
  }

  if (venueId && dvpAvg) {
    presets.push({
      id: "similar-spot",
      label: "Similar to Tonight",
      description: "Same venue, average D",
      build: () => new Set([venueId, dvpAvg]),
    });
  }

  if (restAdv && minutes) {
    presets.push({
      id: "rested",
      label: "Well Rested",
      description: "2+ days rest + starter min",
      build: () => new Set([restAdv, minutes]),
    });
  }

  if (b2b) {
    presets.push({
      id: "tired",
      label: "Back-to-Back",
      description: "Fatigue games (1-day rest)",
      build: () => new Set([b2b]),
    });
  }

  if (closeGame) {
    presets.push({
      id: "close",
      label: "Close Games",
      description: "Final margin within 5",
      build: () => new Set([closeGame]),
    });
  }

  if (blowout) {
    presets.push({
      id: "blowoutPreset",
      label: "Blowouts",
      description: "Final margin 15+ (garbage time)",
      build: () => new Set([blowout]),
    });
  }

  return presets;
}

export function FiltersDrawer({
  market,
  upcomingHomeAway,
  recentGames,
  dvpRankByOpponent,
  totalTeams,
  playTypeDefenseFilters,
  active,
  onToggle,
  onClearAll,
  onApplyPreset,
  trigger,
}: FiltersDrawerProps) {
  const [open, setOpen] = useState(false);

  const filters = useMemo(
    () =>
      getQuickFilters({
        market,
        upcomingHomeAway,
        recentGames,
        dvpRankByOpponent,
        totalTeams,
        playTypeDefenseFilters,
      }),
    [
      market,
      upcomingHomeAway,
      recentGames,
      dvpRankByOpponent,
      totalTeams,
      playTypeDefenseFilters,
    ]
  );

  const presets = useMemo(() => buildPresets(filters), [filters]);

  const metricRows = useMemo(
    () =>
      METRIC_FILTERS.map((config) => {
        const values = recentGames
          .map((game) => config.getValue(game))
          .filter((value): value is number => {
            return value !== null && value !== undefined && Number.isFinite(value);
          });
        if (values.length === 0) return null;
        const min = Math.floor(Math.min(...values));
        const max = Math.ceil(Math.max(...values));
        if (max <= 0 || max <= min) return null;
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        return { config, min, max, avg, games: values.length };
      }).filter((row): row is NonNullable<typeof row> => row !== null),
    [recentGames]
  );

  const metricRowsByCategory = useMemo(() => {
    const grouped = new Map<MetricFilterCategory, typeof metricRows>();
    for (const row of metricRows) {
      const rows = grouped.get(row.config.category) ?? [];
      rows.push(row);
      grouped.set(row.config.category, rows);
    }
    return grouped;
  }, [metricRows]);

  const activeMetricRange = (
    key: string
  ): { min: number; max: number | null } | null => {
    for (const id of active) {
      const parsed = parseMetricFilterId(id);
      if (parsed?.key === key) return { min: parsed.min, max: parsed.max };
    }
    return null;
  };

  const setMetricRange = (
    key: string,
    range: { min: number; max: number } | null
  ) => {
    const next = new Set(
      [...active].filter((id) => parseMetricFilterId(id)?.key !== key)
    );
    if (range !== null) next.add(metricFilterId(key, range.min, range.max));
    onApplyPreset(next);
  };

  const setExclusivePrefixFilter = (prefix: string, id: string) => {
    const next = new Set([...active].filter((activeId) => !activeId.startsWith(prefix)));
    if (!active.has(id)) next.add(id);
    onApplyPreset(next);
  };

  const playTypeGroups = useMemo(() => {
    if (!playTypeDefenseFilters?.length) return [];
    return playTypeDefenseFilters
      .map((source) => {
        const prefix = `playType:${encodeURIComponent(source.playType)}:`;
        const items = filters.filter((filter) => filter.id.startsWith(prefix));
        return { source, prefix, items };
      })
      .filter((group) => group.items.length > 0);
  }, [filters, playTypeDefenseFilters]);

  // Bucket each filter into one of the 5 user-facing categories. The chip
  // panel renders one category at a time; the left rail shows per-category
  // active counts and lets the user jump between them.
  const filtersByCategory = useMemo(() => {
    const buckets: Record<FilterCategoryId, QuickFilter[]> = {
      defense: [],
      volume: [],
      ranges: [], // sliders only — no chips
      gameflow: [],
      schedule: [],
    };
    for (const f of filters) {
      if (f.id.startsWith("dvp") || f.id.startsWith("playType:")) {
        buckets.defense.push(f);
      } else if (
        f.id.startsWith("fga") ||
        f.id.startsWith("threePtA") ||
        f.id.startsWith("potAst") ||
        f.id.startsWith("rebChances") ||
        f.id.startsWith("ast") ||
        f.id.startsWith("minutes")
      ) {
        buckets.volume.push(f);
      } else if (
        f.id === "closeGame" ||
        f.id === "wonBy15" ||
        f.id === "lostBy15"
      ) {
        buckets.gameflow.push(f);
      } else if (
        f.id.startsWith("venue") ||
        f.id === "b2b" ||
        f.id === "rest2plus" ||
        f.id === "rest3plus" ||
        f.id.startsWith("dow")
      ) {
        buckets.schedule.push(f);
      }
    }
    return buckets;
  }, [filters]);

  // Per-category active count for the left-rail badges. Slider/range filters
  // (parseMetricFilterId returns truthy) live entirely in `ranges`.
  const activeCountByCategory = useMemo(() => {
    const counts: Record<FilterCategoryId, number> = {
      defense: 0,
      volume: 0,
      ranges: 0,
      gameflow: 0,
      schedule: 0,
    };
    for (const id of active) {
      if (parseMetricFilterId(id)) {
        counts.ranges++;
        continue;
      }
      if (id.startsWith("dvp") || id.startsWith("playType:")) {
        counts.defense++;
      } else if (
        id.startsWith("fga") ||
        id.startsWith("threePtA") ||
        id.startsWith("potAst") ||
        id.startsWith("rebChances") ||
        id.startsWith("ast") ||
        id.startsWith("minutes")
      ) {
        counts.volume++;
      } else if (id === "closeGame" || id === "wonBy15" || id === "lostBy15") {
        counts.gameflow++;
      } else if (
        id.startsWith("venue") ||
        id === "b2b" ||
        id === "rest2plus" ||
        id === "rest3plus" ||
        id.startsWith("dow")
      ) {
        counts.schedule++;
      }
    }
    return counts;
  }, [active]);

  // Active category in the left rail. Default to defense (highest research
  // value); persists across opens so users don't lose their place.
  const [activeCategory, setActiveCategory] =
    useState<FilterCategoryId>("defense");
  const [searchQuery, setSearchQuery] = useState("");

  // Search filter applied across chips/sliders/presets — finds anything by
  // label. When non-empty it overrides the category nav so users see results
  // from EVERY category that match.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesQuery = (label: string) =>
    !normalizedQuery || label.toLowerCase().includes(normalizedQuery);

  // Filter chips for the active category, narrowed by search if active.
  const visibleChips = useMemo(() => {
    if (normalizedQuery) {
      return filters.filter((f) => matchesQuery(f.label));
    }
    return filtersByCategory[activeCategory];
    // matchesQuery is referenced here too but only when normalizedQuery is set,
    // and it's a stable closure over normalizedQuery so adding to deps would
    // reflect that — useMemo dependency list is intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, filters, filtersByCategory, normalizedQuery]);

  const visiblePresets = useMemo(() => {
    if (!normalizedQuery) return presets;
    return presets.filter((p) => matchesQuery(p.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets, normalizedQuery]);

  const content = (
    <div className="flex h-[540px] w-[680px] max-w-[95vw] flex-col">
      {/* HEADER — search input + close. Title removed; the trigger button
          already says "Filters" and the search bar is the primary action. */}
      <div className="flex items-center gap-2 border-b border-neutral-200/60 px-3 py-2.5 dark:border-neutral-800/60">
        <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search filters…"
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-200 dark:placeholder:text-neutral-500"
        />
        {active.size > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black tabular-nums text-neutral-950">
            {active.size}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-white"
          aria-label="Close filters"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* SMART PRESETS strip — horizontal scroll of one-click preset pills.
          Always visible above the two-pane body; clicking a preset writes its
          underlying filter ids in one shot. Hidden when search has 0 hits. */}
      {visiblePresets.length > 0 && (
        <div className="border-b border-neutral-200/60 bg-neutral-50/40 px-3 py-2 dark:border-neutral-800/60 dark:bg-neutral-950/30">
          <div className="mb-1.5">
            <span className="text-[9.5px] font-black tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
              Presets
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visiblePresets.map((preset) => {
              // Resolve the exact filter labels (with thresholds) that this
              // preset will apply, so the tooltip shows the user concrete
              // values like "30+ Min" / "Home" / "Bottom 10 D" instead of a
              // hand-wave description.
              const ids = Array.from(preset.build(filters));
              const appliedLabels = ids
                .map((id) => filters.find((f) => f.id === id)?.label)
                .filter((label): label is string => typeof label === "string");
              return (
                <Tooltip
                  key={preset.id}
                  side="top"
                  content={
                    <div className="max-w-[260px] px-3 py-2">
                      <div className="text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400">
                        Applies {appliedLabels.length} filter
                        {appliedLabels.length === 1 ? "" : "s"}
                      </div>
                      <ul className="mt-1.5 space-y-1 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                        {appliedLabels.map((label, i) => (
                          <li key={`${ids[i]}-${i}`} className="flex items-baseline gap-1.5">
                            <span className="text-brand">·</span>
                            <span>{label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      onApplyPreset(mergeWithPreset(active, preset.build(filters)))
                    }
                    className="rounded-md border border-neutral-200/70 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-brand/40 dark:hover:bg-brand/10"
                  >
                    {preset.label}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* TWO-PANE BODY — left rail nav (180px) + right content pane (1fr).
          When search is active we hide the rail and stretch results to full
          width since results may span multiple categories. */}
      <div className="flex flex-1 min-h-0">
        {!normalizedQuery && (
          <nav className="w-[200px] shrink-0 overflow-y-auto border-r border-neutral-200/60 bg-neutral-50/50 py-1.5 dark:border-neutral-800/60 dark:bg-neutral-950/40">
            {CATEGORIES.map((cat) => {
              const count = activeCountByCategory[cat.id];
              const isActive = activeCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[12px] font-bold transition-colors",
                    isActive
                      ? "border-brand bg-brand/[0.08] text-brand dark:bg-brand/10"
                      : "border-transparent text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/40 dark:hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{cat.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[9px] font-black tabular-nums",
                        isActive
                          ? "bg-brand text-neutral-950"
                          : "bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Search results — flat chip list across all categories. Replaces
            the per-category panels when there's a search query. */}
        {normalizedQuery && (
          <section>
            <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
              {visibleChips.length} match{visibleChips.length === 1 ? "" : "es"}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {visibleChips.map((f) => (
                <FilterChip
                  key={f.id}
                  label={f.label}
                  isActive={active.has(f.id)}
                  onClick={() => onToggle(f.id)}
                />
              ))}
            </div>
            {visibleChips.length === 0 && visiblePresets.length === 0 && (
              <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-[11px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                No filters match "{searchQuery}".
              </div>
            )}
          </section>
        )}

        {/* DEFENSE — DvP chips + Defense vs Play Type segmented controls */}
        {!normalizedQuery && activeCategory === "defense" && (
          <div className="space-y-4">
            {dvpRankByOpponent && dvpRankByOpponent.size > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                  Defense vs Position
                </h3>
                {(() => {
                  // DvP rank slider — collapsed in place of the old tier
                  // chips. Bounds are 1..totalTeams (fixed by league size);
                  // avg is the mean rank across the player's recent
                  // opponents, useful as a "you've played a tough/soft
                  // schedule" reference.
                  const total = totalTeams ?? 30;
                  const ranks = recentGames
                    .map((g) => dvpRankByOpponent.get(g.opponentTeamId) ?? null)
                    .filter((r): r is number => r != null);
                  const avg =
                    ranks.length > 0
                      ? ranks.reduce((a, b) => a + b, 0) / ranks.length
                      : total / 2;
                  return (
                    <MetricSliderRow
                      config={DVP_RANK_CONFIG}
                      min={1}
                      max={total}
                      avg={avg}
                      games={ranks.length}
                      activeRange={activeMetricRange("dvpRank")}
                      onChange={(range) => {
                        const next = new Set(active);
                        // Clear any existing dvp tier chip OR existing
                        // dvpRank range so a fresh selection doesn't
                        // double-count.
                        for (const id of [...next]) {
                          const parsed = parseMetricFilterId(id);
                          if (parsed?.key === "dvpRank") next.delete(id);
                          if (
                            id.startsWith("dvp") &&
                            !id.startsWith("metric:")
                          )
                            next.delete(id);
                        }
                        if (range) {
                          next.add(metricFilterId("dvpRank", range.min, range.max));
                        }
                        onApplyPreset(next);
                      }}
                    />
                  );
                })()}
              </section>
            )}
            {playTypeGroups.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                  <Shield className="h-3 w-3 text-brand" />
                  Defense vs Play Type
                </h3>
                <div className="space-y-1.5">
                  {playTypeGroups.map((group) => (
                    <div
                      key={group.source.playType}
                      className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/50 px-2.5 py-2 dark:border-neutral-800/70 dark:bg-neutral-950/30"
                    >
                      <span className="min-w-0 truncate text-[11px] font-black text-neutral-700 dark:text-neutral-200">
                        {group.source.label}
                      </span>
                      <div className="flex shrink-0 overflow-hidden rounded-md border border-neutral-200/70 dark:border-neutral-800/70">
                        {group.items.map((item) => {
                          const isActive = active.has(item.id);
                          const tier = item.id.endsWith(":tough")
                            ? "1-10"
                            : item.id.endsWith(":favorable")
                              ? "21-30"
                              : "11-20";
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setExclusivePrefixFilter(group.prefix, item.id)}
                              className={cn(
                                "px-2 py-1 text-[9px] font-black tracking-[0.08em] uppercase transition-colors",
                                isActive
                                  ? "bg-brand text-neutral-950"
                                  : "bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                              )}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {filtersByCategory.defense.length === 0 && playTypeGroups.length === 0 && (
              <EmptyHint>No defense filters available for this market.</EmptyHint>
            )}
          </div>
        )}

        {/* VOLUME — sliders for Min / FGA / 3PA / Pot AST / Reb Chances.
            Each slider's bounds come from the player's actual recent games
            so the user can pick e.g. "32-44 minutes" or "8-12 FGA" with
            real grain instead of toggling fixed thresholds. */}
        {!normalizedQuery && activeCategory === "volume" && (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                Volume Sliders
              </h3>
              <p className="mb-2 text-[10.5px] leading-snug text-neutral-500 dark:text-neutral-500">
                Drag either side or type an exact range. Bounds reflect this
                player's recent extents — not a league constant.
              </p>
              {(() => {
                const volumeRows = metricRows.filter((row) =>
                  VOLUME_METRIC_KEYS.includes(row.config.key),
                );
                if (volumeRows.length === 0) {
                  return (
                    <EmptyHint>
                      No volume metrics available for this player yet.
                    </EmptyHint>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    {volumeRows.map((row) => (
                      <MetricSliderRow
                        key={row.config.key}
                        config={row.config}
                        min={row.min}
                        max={row.max}
                        avg={row.avg}
                        games={row.games}
                        activeRange={activeMetricRange(row.config.key)}
                        onChange={(range) => {
                          const next = new Set(active);
                          // Clear any existing range filter for this metric
                          // and any legacy short-form chip (e.g. minutes32,
                          // fga15) for the same metric — both forms could
                          // be present from saved filter sets.
                          const legacyPrefix =
                            METRIC_KEY_TO_LEGACY_PREFIX[row.config.key];
                          for (const id of [...next]) {
                            const parsed = parseMetricFilterId(id);
                            if (parsed?.key === row.config.key) next.delete(id);
                            if (legacyPrefix) {
                              const m = id.match(/^([a-zA-Z]+)\d+(?:\.\d+)?$/);
                              if (m && m[1] === legacyPrefix) next.delete(id);
                            }
                          }
                          if (range) {
                            next.add(
                              metricFilterId(row.config.key, range.min, range.max),
                            );
                          }
                          onApplyPreset(next);
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* STAT RANGES — sliders grouped by sub-category */}
        {!normalizedQuery && activeCategory === "ranges" && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                Stat Ranges
              </h3>
              <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
                Drag either side or type an exact range
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["opportunity", "Opportunity"],
                  ["shooting", "Shooting"],
                  ["rebounding", "Rebounding"],
                  ["scoring", "Scoring"],
                  ["discipline", "Discipline"],
                ] as Array<[MetricFilterCategory, string]>
              ).map(([category, label]) => {
                const rows = metricRowsByCategory.get(category) ?? [];
                if (rows.length === 0) return null;
                return (
                  <div
                    key={category}
                    className="rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-2 dark:border-neutral-800/70 dark:bg-neutral-950/30"
                  >
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <span className="text-[9px] font-black tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
                        {label}
                      </span>
                      <span className="text-[9px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
                        {rows.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {rows.map((row) => (
                        <MetricSliderRow
                          key={row.config.key}
                          config={row.config}
                          min={row.min}
                          max={row.max}
                          avg={row.avg}
                        games={row.games}
                        activeRange={activeMetricRange(row.config.key)}
                        onChange={(range) =>
                          setMetricRange(row.config.key, range)
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-dashed border-neutral-200/80 px-3 py-2 dark:border-neutral-800/80">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-black text-neutral-500 dark:text-neutral-400">
                    Points in Paint
                  </div>
                  <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
                    Not in the per-game box-score payload yet
                  </div>
                </div>
                <span className="rounded-md bg-neutral-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400 dark:bg-neutral-800/70 dark:text-neutral-500">
                  Data needed
                </span>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* GAME FLOW — Close / Won by 15+ / Lost by 15+ chips + a margin
            slider for arbitrary win/loss ranges (e.g. "lose by 5-15"). */}
        {!normalizedQuery && activeCategory === "gameflow" && (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                Quick Picks
              </h3>
              {filtersByCategory.gameflow.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {filtersByCategory.gameflow.map((f) => (
                    <FilterChip
                      key={f.id}
                      label={f.label}
                      isActive={active.has(f.id)}
                      onClick={() => onToggle(f.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyHint>No game flow chips available.</EmptyHint>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                Margin Range
              </h3>
              <p className="mb-2 text-[10.5px] leading-snug text-neutral-500 dark:text-neutral-500">
                Negative = loss by N, positive = win by N. Pick a band like
                "−5 to +5" for tight games or "−40 to −15" for blowout
                losses.
              </p>
              {(() => {
                const margins = recentGames
                  .map((g) => g.margin)
                  .filter((m): m is number => typeof m === "number" && Number.isFinite(m));
                if (margins.length === 0) {
                  return (
                    <EmptyHint>No game margins available yet.</EmptyHint>
                  );
                }
                const lo = Math.floor(Math.min(...margins) / 5) * 5;
                const hi = Math.ceil(Math.max(...margins) / 5) * 5;
                const avg =
                  margins.reduce((a, b) => a + b, 0) / margins.length;
                return (
                  <MetricSliderRow
                    config={MARGIN_CONFIG}
                    min={lo}
                    max={hi}
                    avg={avg}
                    games={margins.length}
                    activeRange={activeMetricRange("margin")}
                    onChange={(range) => {
                      const next = new Set(active);
                      for (const id of [...next]) {
                        if (parseMetricFilterId(id)?.key === "margin")
                          next.delete(id);
                      }
                      if (range) {
                        next.add(metricFilterId("margin", range.min, range.max));
                      }
                      onApplyPreset(next);
                    }}
                  />
                );
              })()}
            </section>
          </div>
        )}

        {/* SCHEDULE — Venue + Rest + Day of Week, grouped subsections */}
        {!normalizedQuery && activeCategory === "schedule" && (
          <div className="space-y-4">
            {filtersByCategory.schedule.filter((f) => f.id.startsWith("venue")).length > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                  Venue
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {filtersByCategory.schedule
                    .filter((f) => f.id.startsWith("venue"))
                    .map((f) => (
                      <FilterChip
                        key={f.id}
                        label={f.label}
                        isActive={active.has(f.id)}
                        onClick={() => onToggle(f.id)}
                      />
                    ))}
                </div>
              </section>
            )}
            {filtersByCategory.schedule.filter(
              (f) => f.id === "b2b" || f.id === "rest2plus" || f.id === "rest3plus",
            ).length > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                  Rest
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {filtersByCategory.schedule
                    .filter(
                      (f) =>
                        f.id === "b2b" || f.id === "rest2plus" || f.id === "rest3plus",
                    )
                    .map((f) => (
                      <FilterChip
                        key={f.id}
                        label={f.label}
                        isActive={active.has(f.id)}
                        onClick={() => onToggle(f.id)}
                      />
                    ))}
                </div>
              </section>
            )}
            {filtersByCategory.schedule.filter((f) => f.id.startsWith("dow")).length > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
                  Day of Week
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {filtersByCategory.schedule
                    .filter((f) => f.id.startsWith("dow"))
                    .map((f) => (
                      <FilterChip
                        key={f.id}
                        label={f.label}
                        isActive={active.has(f.id)}
                        onClick={() => onToggle(f.id)}
                      />
                    ))}
                </div>
              </section>
            )}
            {filtersByCategory.schedule.length === 0 && (
              <EmptyHint>No schedule filters available.</EmptyHint>
            )}
          </div>
        )}
        </div>
      </div>

      {/* STICKY FOOTER — Reset on left, Done on right with active count baked
          into the CTA so users see the consequence of closing. */}
      <div className="flex items-center justify-between gap-2 border-t border-neutral-200/60 bg-neutral-50/40 px-3 py-2.5 dark:border-neutral-800/60 dark:bg-neutral-950/30">
        <button
          type="button"
          onClick={onClearAll}
          disabled={active.size === 0}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors",
            active.size === 0
              ? "cursor-not-allowed text-neutral-400 dark:text-neutral-600"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white",
          )}
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md bg-brand px-3 py-1.5 text-[11px] font-black text-neutral-950 transition-colors hover:bg-brand/90"
        >
          {active.size > 0 ? `Done · ${active.size}` : "Done"}
        </button>
      </div>
      <style jsx global>{`
        .range-thumb::-webkit-slider-runnable-track {
          height: 0;
          background: transparent;
        }
        .range-thumb::-moz-range-track {
          height: 0;
          background: transparent;
        }
        .range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgb(10 10 10);
          background: var(--brand, #38bdf8);
          box-shadow: 0 0 0 1px rgb(255 255 255 / 0.16);
          pointer-events: auto;
        }
        .range-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgb(10 10 10);
          background: var(--brand, #38bdf8);
          box-shadow: 0 0 0 1px rgb(255 255 255 / 0.16);
          pointer-events: auto;
        }
      `}</style>
    </div>
  );

  return (
    <Popover
      openPopover={open}
      setOpenPopover={setOpen}
      side="bottom"
      align="end"
      sideOffset={6}
      content={content}
      popoverContentClassName="rounded-xl border border-neutral-200/70 bg-white shadow-2xl dark:border-neutral-700/60 dark:bg-neutral-900 z-50 overflow-hidden"
    >
      {trigger}
    </Popover>
  );
}

// Single chip — extracted so the same look applies to every chip group
// across the panel. Active = brand-cyan filled, inactive = quiet outline.
function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
        isActive
          ? "border-brand/45 bg-brand text-neutral-950 shadow-sm shadow-brand/25"
          : "border-neutral-200/70 bg-neutral-50/60 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800/70 dark:bg-neutral-900/40 dark:text-neutral-200 dark:hover:border-neutral-700",
      )}
    >
      {label}
      {isActive && <X className="h-3 w-3 opacity-70" />}
    </button>
  );
}

// Empty-state for category sections that have no filters available for the
// active market (e.g., Defense vs Play Type for WNBA).
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
      {children}
    </div>
  );
}

function MetricSliderRow({
  config,
  min,
  max,
  avg,
  games,
  activeRange,
  onChange,
}: {
  config: MetricFilterConfig;
  min: number;
  max: number;
  avg: number;
  games: number;
  activeRange: { min: number; max: number | null } | null;
  onChange: (range: { min: number; max: number } | null) => void;
}) {
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  const selectedMin = clamp(activeRange?.min ?? min);
  const selectedMax = clamp(activeRange?.max ?? max);
  const isActive = activeRange !== null && (selectedMin > min || selectedMax < max);
  const span = Math.max(config.step, max - min);
  const leftPct = ((selectedMin - min) / span) * 100;
  const rightPct = ((selectedMax - min) / span) * 100;
  const display = (input: number) =>
    config.isPercentage ? `${Math.round(input)}%` : String(Math.round(input));
  const normalizeInput = (value: string, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed);
  };
  const commitRange = (nextMin: number, nextMax: number) => {
    const orderedMin = Math.min(nextMin, nextMax);
    const orderedMax = Math.max(nextMin, nextMax);
    if (orderedMin <= min && orderedMax >= max) {
      onChange(null);
      return;
    }
    onChange({ min: orderedMin, max: orderedMax });
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 transition-colors",
        isActive
          ? "border-brand/45 bg-brand/10"
          : "border-neutral-200/70 bg-white dark:border-neutral-800/70 dark:bg-neutral-900/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-black text-neutral-800 dark:text-neutral-100">
            {config.label}
          </div>
          <div className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500">
            Avg {display(avg)} • {games} games
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums",
              isActive
                ? "bg-brand text-neutral-950"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300"
            )}
          >
            {display(selectedMin)}-{display(selectedMax)}
          </span>
          {isActive && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
              aria-label={`Clear ${config.label} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[52px_1fr_52px] items-center gap-2">
        <input
          type="number"
          min={min}
          max={selectedMax}
          step={config.step}
          value={Math.round(selectedMin)}
          onChange={(event) =>
            commitRange(normalizeInput(event.target.value, selectedMin), selectedMax)
          }
          className="h-7 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-[10px] font-black tabular-nums text-neutral-700 outline-none transition-colors focus:border-brand/60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          aria-label={`${config.label} minimum input`}
        />
        <div className="relative h-7">
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
            style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={config.step}
            value={selectedMin}
            onChange={(event) =>
              commitRange(
                Math.min(Number(event.target.value), selectedMax - config.step),
                selectedMax
              )
            }
            className="range-thumb pointer-events-none absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent"
            aria-label={`${config.label} minimum`}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={config.step}
            value={selectedMax}
            onChange={(event) =>
              commitRange(
                selectedMin,
                Math.max(Number(event.target.value), selectedMin + config.step)
              )
            }
            className="range-thumb pointer-events-none absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent"
            aria-label={`${config.label} maximum`}
          />
        </div>
        <input
          type="number"
          min={selectedMin}
          max={max}
          step={config.step}
          value={Math.round(selectedMax)}
          onChange={(event) =>
            commitRange(selectedMin, normalizeInput(event.target.value, selectedMax))
          }
          className="h-7 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-[10px] font-black tabular-nums text-neutral-700 outline-none transition-colors focus:border-brand/60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          aria-label={`${config.label} maximum input`}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] font-bold tabular-nums text-neutral-400 dark:text-neutral-500">
        <span>{display(min)}</span>
        <span>{config.shortLabel}</span>
        <span>{display(max)}</span>
      </div>
    </div>
  );
}

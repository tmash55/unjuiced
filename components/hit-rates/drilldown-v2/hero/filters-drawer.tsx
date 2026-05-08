"use client";

import React, { useMemo, useState } from "react";
import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/popover";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { getQuickFilters, type QuickFilter } from "../shared/quick-filters";

interface FiltersDrawerProps {
  market: string;
  upcomingHomeAway: string | null | undefined;
  recentGames: BoxScoreGame[];
  dvpRankByOpponent?: Map<number, number>;
  totalTeams?: number;
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
      }),
    [market, upcomingHomeAway, recentGames, dvpRankByOpponent, totalTeams]
  );

  const presets = useMemo(() => buildPresets(filters), [filters]);

  // Group filters into sections. Order matters — defense first since that's
  // usually the most-asked question, then game flow / fatigue, then volume.
  const sections = useMemo(() => {
    const matches = (prefixes: string[]) =>
      filters.filter((f) => prefixes.some((p) => f.id.startsWith(p)));

    return [
      { title: "Defense vs Position", items: matches(["dvp"]) },
      { title: "Venue", items: matches(["venue"]) },
      {
        title: "Game Flow",
        items: filters.filter((f) => f.id === "closeGame" || f.id === "blowout"),
      },
      {
        title: "Rest / Schedule",
        items: filters.filter(
          (f) => f.id === "b2b" || f.id === "rest2plus" || f.id === "rest3plus"
        ),
      },
      {
        title: "Day of Week",
        items: filters.filter((f) => f.id === "weekend" || f.id === "weekday"),
      },
      {
        title: "Volume",
        items: matches(["fga", "threePtA", "potAst", "rebChances", "ast"]),
      },
      { title: "Minutes", items: matches(["minutes"]) },
    ].filter((s) => s.items.length > 0);
  }, [filters]);

  const content = (
    <div className="flex w-[560px] max-w-[92vw] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-800/60">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-black text-neutral-900 dark:text-white">
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand" />
            Filters
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
            Smart presets pull from this player's averages and tonight's matchup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-white"
          aria-label="Close filters"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[380px] overflow-y-auto px-4 py-3">
        {presets.length > 0 && (
          <section className="mb-4">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                Smart Presets
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onApplyPreset(preset.build(filters));
                  }}
                  className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-2.5 py-1.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 dark:border-neutral-800/70 dark:bg-neutral-900/40 dark:hover:border-brand/40 dark:hover:bg-brand/10"
                >
                  <div className="text-[11px] font-black text-neutral-900 dark:text-white">
                    {preset.label}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {sections.map((section) => (
          <section key={section.title} className="mb-3 last:mb-0">
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {section.title}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {section.items.map((f) => {
                const isActive = active.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onToggle(f.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                      isActive
                        ? "border-brand/45 bg-brand text-neutral-950 shadow-sm shadow-brand/25"
                        : "border-neutral-200/70 bg-neutral-50/60 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800/70 dark:bg-neutral-900/40 dark:text-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    {f.label}
                    {isActive && <X className="h-3 w-3 opacity-70" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {filters.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-[11px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
            No filters available for this market yet.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-200/60 px-4 py-2.5 dark:border-neutral-800/60">
        <span className="text-[11px] font-bold tabular-nums text-neutral-500 dark:text-neutral-400">
          {active.size} active
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={active.size === 0}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
            active.size === 0
              ? "cursor-not-allowed text-neutral-400 dark:text-neutral-600"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 dark:hover:text-white"
          )}
        >
          Clear all
        </button>
      </div>
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

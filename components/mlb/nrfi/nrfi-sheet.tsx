"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useNrfiGames } from "@/hooks/use-nrfi-games";
import { cn } from "@/lib/utils";
import { GameCardV2 } from "./game-card-v2";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { DateNav } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, CheckCircle, XCircle, TrendingUp } from "lucide-react";

type SortOption = "best-grade" | "best-odds" | "game-time";
type FilterOption = "all" | "nrfi" | "yrfi";
type SeasonOption = "2025" | "2023-2025";

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function MlbNrfiSheet() {
  const [sort, setSort] = useState<SortOption>("best-grade");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [season, setSeason] = useState<SeasonOption>("2025");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDateState] = useState<string>(() => searchParams.get("date") || getTodayET());
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);

  const { games, meta, isLoading, isFetching, error } = useNrfiGames({
    date: selectedDate,
    seasons: season,
  });

  // Available dates for date nav
  const availableDates = useMemo(() => meta?.availableDates ?? [], [meta]);

  // Filter
  const filtered = useMemo(() => {
    if (filter === "nrfi") return games.filter((g) => ["strong_nrfi", "nrfi", "lean_nrfi"].includes(g.lean));
    if (filter === "yrfi") return games.filter((g) => ["strong_yrfi", "yrfi", "lean_yrfi"].includes(g.lean));
    return games;
  }, [games, filter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "best-grade") arr.sort((a, b) => b.gradeScore - a.gradeScore);
    else if (sort === "best-odds") {
      arr.sort((a, b) => {
        const aOdds = parseFloat(a.bestNrfiOdds) || -999;
        const bOdds = parseFloat(b.bestNrfiOdds) || -999;
        return bOdds - aOdds;
      });
    } else {
      arr.sort((a, b) => a.gameTime.localeCompare(b.gameTime));
    }
    return arr;
  }, [filtered, sort]);

  // Summary stats
  const nrfiCount = games.filter((g) => ["strong_nrfi", "nrfi", "lean_nrfi"].includes(g.lean)).length;
  const yrfiCount = games.filter((g) => ["strong_yrfi", "yrfi", "lean_yrfi"].includes(g.lean)).length;
  const resolvedCount = games.filter((g) => g.nrfiResult != null).length;
  const nrfiHits = games.filter((g) => g.nrfiResult === true).length;

  return (
    <div className="space-y-0">
      {/* Controls bar */}
      <div className="rounded-xl bg-neutral-50/80 dark:bg-neutral-950/40 border border-neutral-200/60 dark:border-neutral-800/60 overflow-visible mb-4">
        {/* Top row: date + summary */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200/40 dark:border-neutral-800/30">
          <DateNav
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            availableDates={availableDates}
          />
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-neutral-500">{games.length} games</span>
            <span className="flex items-center gap-1 text-emerald-500 font-semibold">
              <CheckCircle className="w-3 h-3" /> {nrfiCount} NRFI
            </span>
            <span className="flex items-center gap-1 text-red-500 font-semibold">
              <XCircle className="w-3 h-3" /> {yrfiCount} YRFI
            </span>
            {resolvedCount > 0 && (
              <span className="text-neutral-400">
                Record: {nrfiHits}/{resolvedCount}
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: filter + sort + season */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as FilterOption)}
            options={[
              { label: "All", value: "all" },
              { label: "NRFI", value: "nrfi" },
              { label: "YRFI", value: "yrfi" },
            ]}
          />
          <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
          <SegmentedControl
            value={sort}
            onChange={(v) => setSort(v as SortOption)}
            options={[
              { label: "Best Grade", value: "best-grade" },
              { label: "Best Odds", value: "best-odds" },
              { label: "Game Time", value: "game-time" },
            ]}
          />
          <div className="flex-1" />
          <SegmentedControl
            value={season}
            onChange={(v) => setSeason(v as SeasonOption)}
            options={[
              { label: "2025", value: "2025" },
              { label: "Combined", value: "2023-2025" },
            ]}
          />
        </div>
      </div>

      {/* Game cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
            <p className="text-sm text-neutral-500 mt-3">Loading NRFI slate...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-red-500">{error.message}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-sm font-bold text-neutral-900 dark:text-white">No games match your filter</p>
            <p className="text-xs text-neutral-500 mt-1">
              {filter !== "all" ? "Try switching to 'All' to see all games." : "No games scheduled for this date."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((game) => (
            <GameCardV2
              key={game.gameId}
              game={game}
              expanded={expandedGameId === game.gameId}
              onToggle={() => setExpandedGameId(expandedGameId === game.gameId ? null : game.gameId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

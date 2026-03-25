"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useNrfiGames } from "@/hooks/use-nrfi-games";
import { useMlbGameDates } from "@/hooks/use-mlb-game-dates";
import { getLeanColor, type GameCard } from "@/lib/nrfi-data";
import { GameCard as GameCardComponent } from "./game-card";
import { StickyControlBar } from "./sticky-control-bar";
import { SummaryStrip } from "./summary-strip";
import { Loader2 } from "lucide-react";

type SortOption = "game-time" | "best-grade";
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
  const availableDates = useMlbGameDates();

  // Auto-advance to first available date if no games on selected date
  useEffect(() => {
    if (!isLoading && games.length === 0 && availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      const nextDate = availableDates.find((d) => d >= selectedDate) ?? availableDates[0];
      setSelectedDate(nextDate);
    }
  }, [isLoading, games.length, availableDates, selectedDate]);

  // Filter games
  const filteredGames = useMemo(() => {
    let result = [...games];

    if (filter === "nrfi") {
      result = result.filter(
        (g) => getLeanColor(g.lean) === "green"
      );
    } else if (filter === "yrfi") {
      result = result.filter(
        (g) => getLeanColor(g.lean) === "red"
      );
    }

    // Sort
    if (sort === "best-grade") {
      result.sort((a, b) => b.gradeScore - a.gradeScore);
    }
    // "game-time" is already the default order from the API

    return result;
  }, [games, filter, sort]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!meta) return null;
    const nrfiGames = games.filter((g) => getLeanColor(g.lean) === "green");
    const yrfiGames = games.filter((g) => getLeanColor(g.lean) === "red");
    const bestNrfi = nrfiGames.length > 0
      ? nrfiGames.reduce((best, g) => g.gradeScore > best.gradeScore ? g : best)
      : null;
    const bestYrfi = yrfiGames.length > 0
      ? yrfiGames.reduce((worst, g) => g.gradeScore < worst.gradeScore ? g : worst)
      : null;

    // A-grade NRFI record from graded games with results
    const aGradeNrfi = games.filter(
      (g) => g.grade.startsWith("A") && getLeanColor(g.lean) === "green" && g.nrfiResult != null
    );
    const aGradeHits = aGradeNrfi.filter((g) => g.nrfiResult === true).length;

    return {
      nrfiLeansAB: nrfiGames.filter((g) => g.grade.startsWith("A") || g.grade.startsWith("B")).length,
      yrfiLeansAB: yrfiGames.filter((g) => g.grade.startsWith("A") || g.grade.startsWith("B")).length,
      bestNrfiPrice: bestNrfi?.bestNrfiOdds ?? "-",
      strongestYrfi: bestYrfi
        ? `${bestYrfi.awayTricode}@${bestYrfi.homeTricode}`
        : "-",
      aGradeNrfiRecord: aGradeNrfi.length > 0 ? `${aGradeHits}-${aGradeNrfi.length}` : "-",
      aGradeNrfiPct: aGradeNrfi.length > 0
        ? `${((aGradeHits / aGradeNrfi.length) * 100).toFixed(0)}%`
        : "-",
    };
  }, [games, meta]);

  const handleExpand = useCallback((gameId: number) => {
    setExpandedGameId(gameId);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedGameId(null);
  }, []);

  const lastUpdated = meta?.lastUpdated
    ? new Date(meta.lastUpdated).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
    : "-";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading NRFI data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-sm text-neutral-500">
        <p className="font-semibold text-red-500 mb-1">Failed to load NRFI data</p>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <StickyControlBar
        sort={sort}
        filter={filter}
        season={season}
        selectedDate={selectedDate}
        onSortChange={setSort}
        onFilterChange={setFilter}
        onSeasonChange={setSeason}
        onDateChange={setSelectedDate}
        lastUpdated={lastUpdated}
      />

      {summaryStats && (
        <SummaryStrip
          nrfiLeansAB={summaryStats.nrfiLeansAB}
          yrfiLeansAB={summaryStats.yrfiLeansAB}
          bestNrfiPrice={summaryStats.bestNrfiPrice}
          strongestYrfi={summaryStats.strongestYrfi}
          aGradeNrfiRecord={summaryStats.aGradeNrfiRecord}
          aGradeNrfiPct={summaryStats.aGradeNrfiPct}
        />
      )}

      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {isFetching && games.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            <span className="ml-2 text-sm text-neutral-500">Loading games...</span>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-500">
            {games.length === 0
              ? "No games scheduled for this date"
              : `No ${filter === "nrfi" ? "NRFI" : "YRFI"} leans found — try "All Games"`}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {filteredGames.map((game) => (
              <GameCardComponent
                key={game.gameId}
                game={game}
                isExpanded={expandedGameId === game.gameId}
                onExpand={() => handleExpand(game.gameId)}
                onCollapse={handleCollapse}
                className={expandedGameId === game.gameId ? "lg:col-span-3" : ""}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

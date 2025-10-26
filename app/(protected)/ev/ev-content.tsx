"use client";

import { useEffect, useState, useMemo } from "react";
import { useIsPro } from "@/hooks/use-entitlements";
import { useSSE } from "@/hooks/use-sse";
import { EVRow } from "@/lib/ev-schema";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { LoadingState } from "@/components/common/loading-state";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVTable } from "@/components/ev/ev-table";

const SPORTS = [
  { id: "all", name: "All Sports" },
  { id: "nfl", name: "NFL" },
  { id: "nba", name: "NBA" },
  { id: "nhl", name: "NHL" },
  { id: "mlb", name: "MLB" },
  { id: "ncaaf", name: "NCAAF" },
];

export default function EVContent() {
  const { isPro, isLoading: isPlanLoading } = useIsPro();
  const [data, setData] = useState<EVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"pregame" | "live">("pregame");
  const [selectedSport, setSelectedSport] = useState("all");
  const [auto, setAuto] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/ev/feed?scope=${scope}&limit=500`);
      const result = await response.json();
      setData(result.rows || []);
    } catch (error) {
      console.error("[EV] Failed to fetch data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [scope]);

  // SSE for Pro users with auto-refresh enabled
  const { lastMessage } = useSSE(`/api/sse/ev?scope=${scope}`, {
    enabled: isPro && auto,
    onMessage: async (message) => {
      // Refresh data when we get an update
      await fetchData();
    },
  });

  // Filter by sport
  const filteredData = useMemo(() => {
    if (selectedSport === "all") return data;
    return data.filter((row) => row.sport === selectedSport);
  }, [data, selectedSport]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const avgEV = total > 0
      ? filteredData.reduce((sum, row) => sum + row.rollup.best_case, 0) / total
      : 0;
    const maxEV = total > 0
      ? Math.max(...filteredData.map((row) => row.rollup.best_case))
      : 0;

    return { total, avgEV, maxEV };
  }, [filteredData]);

  if (isPlanLoading || loading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <ToolHeading>Positive EV</ToolHeading>
        <ToolSubheading>
          Find positive expected value betting opportunities with the best odds across all sportsbooks.
        </ToolSubheading>
      </div>

      {/* Stats */}
      <div className="mb-6 flex items-center gap-6">
        <div className="text-center">
          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Opportunities
          </div>
          <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div className="text-center">
          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Avg EV
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +{stats.avgEV.toFixed(2)}%
          </div>
        </div>
        <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div className="text-center">
          <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Max EV
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +{stats.maxEV.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Scope Toggle */}
        <div className="mode-toggle">
          <button
            type="button"
            onClick={() => setScope("pregame")}
            className={cn(scope === "pregame" && "active")}
          >
            Pre-Game
          </button>
          <button
            type="button"
            disabled={!isPro}
            onClick={() => isPro && setScope("live")}
            className={cn(scope === "live" && isPro && "active")}
          >
            Live
            {!isPro && <span className="ml-1 text-xs opacity-60">Pro</span>}
          </button>
        </div>

        {/* Auto Refresh Toggle (Pro only) */}
        {isPro && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand dark:border-neutral-600"
              />
              Auto Refresh
            </label>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
        <div className="sticky top-14 z-30 mt-6 mb-6">
          <FiltersBar useDots={true}>
            <FiltersBarSection align="left">
              {/* Sport Filter */}
              <div className="flex items-center gap-2">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => setSelectedSport(sport.id)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      selectedSport === sport.id
                        ? "bg-brand text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    )}
                  >
                    {sport.name}
                  </button>
                ))}
              </div>
            </FiltersBarSection>

            <FiltersBarSection align="right">
              {/* Manual Refresh Button */}
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="refresh-btn flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-all"
                title="Refresh opportunities"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </button>
            </FiltersBarSection>
          </FiltersBar>
        </div>
      </div>

      {/* Free User Notice */}
      {!isPro && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Limited EV Access
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Free users can only see opportunities with EV up to 3%. Upgrade to Pro to unlock all high-value edges and live updates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <EVTable data={filteredData} isPro={isPro} />
    </div>
  );
}


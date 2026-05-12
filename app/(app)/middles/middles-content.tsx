"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { AutoToggle } from "@/components/arbs/auto-toggle";
import { MiddlesTable } from "@/components/middles/middles-table";
import {
  AppPageLayout,
  ModeToggle,
  PageStatsBar,
} from "@/components/layout/app-page-layout";
import { LoadingState } from "@/components/common/loading-state";
import { useHasEliteAccess } from "@/hooks/use-entitlements";
import { useMiddlesView } from "@/hooks/use-middles-view";
import type { MiddleMode } from "@/lib/middles-schema";
import { cn } from "@/lib/utils";

const DEFAULT_LEAGUES = ["nba", "wnba"];

function pctFromBps(value?: number): string {
  const pct = Number(value || 0) / 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}`;
}

function FilterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function NumberFilter({
  label,
  value,
  onChange,
  min,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="h-7 w-16 rounded border border-neutral-200 bg-white px-2 text-right font-mono text-xs text-neutral-900 transition outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      />
    </label>
  );
}

export default function MiddlesContent() {
  const { hasAccess: hasLiveMiddles } = useHasEliteAccess();
  const [auto, setAuto] = useState(false);
  const [mode, setMode] = useState<"prematch" | "live">("prematch");
  const [search, setSearch] = useState("");
  const [selectedLeagues, setSelectedLeagues] =
    useState<string[]>(DEFAULT_LEAGUES);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [minGap, setMinGap] = useState(0);
  const [minMiddlePct, setMinMiddlePct] = useState(0);
  const [maxMissLossPct, setMaxMissLossPct] = useState(5);
  const [hideRegional, setHideRegional] = useState(false);

  useEffect(() => {
    if (!hasLiveMiddles) {
      setAuto(false);
      setMode("prematch");
    }
  }, [hasLiveMiddles]);

  const redisMode: MiddleMode = mode === "live" ? "live" : "pregame";
  const {
    rows,
    ids,
    allRows,
    loading,
    refreshing,
    error,
    counts,
    changes,
    added,
    availableMarkets,
    refresh,
    hasActiveFilters,
  } = useMiddlesView({
    auto,
    mode: redisMode,
    limit: 1000,
    search,
    selectedBooks,
    selectedLeagues,
    selectedMarkets,
    minGap,
    minMiddlePct,
    maxMissLossPct,
    hideRegional,
  });

  const availableBooks = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((row) => {
      if (row.o?.bk) set.add(row.o.bk);
      if (row.u?.bk) set.add(row.u.bk);
    });
    return Array.from(set).sort();
  }, [allRows]);

  const bestMiddle = useMemo(
    () =>
      rows.length ? Math.max(...rows.map((row) => row.middle_bps || 0)) : 0,
    [rows],
  );
  const worstMiss = useMemo(
    () =>
      rows.length ? Math.min(...rows.map((row) => row.worst_case_bps || 0)) : 0,
    [rows],
  );

  const currentCount = counts
    ? mode === "live"
      ? counts.live
      : counts.pregame
    : rows.length;

  const resetFilters = () => {
    setSearch("");
    setSelectedLeagues(DEFAULT_LEAGUES);
    setSelectedBooks([]);
    setSelectedMarkets([]);
    setMinGap(0);
    setMinMiddlePct(0);
    setMaxMissLossPct(5);
    setHideRegional(false);
  };

  const contextBar = (
    <FilterShell>
      <ModeToggle
        mode={mode}
        onModeChange={setMode}
        counts={counts || undefined}
        liveDisabled={!hasLiveMiddles}
        liveDisabledReason="Elite"
      />

      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player, event, market, or book"
          className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pr-3 pl-9 text-sm text-neutral-900 transition outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-600 dark:focus:bg-neutral-950"
        />
      </div>

      <select
        value={selectedLeagues.join(",")}
        onChange={(event) =>
          setSelectedLeagues(
            event.target.value ? event.target.value.split(",") : [],
          )
        }
        className="h-10 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <option value="">All leagues</option>
        <option value="nba,wnba">NBA + WNBA</option>
        <option value="nba">NBA</option>
        <option value="wnba">WNBA</option>
      </select>

      <select
        value={selectedMarkets[0] || ""}
        onChange={(event) =>
          setSelectedMarkets(event.target.value ? [event.target.value] : [])
        }
        className="h-10 max-w-[180px] rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <option value="">All markets</option>
        {availableMarkets.map((market) => (
          <option key={market} value={market}>
            {market.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <select
        value={selectedBooks[0] || ""}
        onChange={(event) =>
          setSelectedBooks(event.target.value ? [event.target.value] : [])
        }
        className="h-10 max-w-[170px] rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <option value="">All books</option>
        {availableBooks.map((book) => (
          <option key={book} value={book}>
            {book.replace(/[-_]/g, " ")}
          </option>
        ))}
      </select>

      <NumberFilter
        label="Min gap"
        value={minGap}
        min={0}
        onChange={setMinGap}
      />
      <NumberFilter
        label="Middle payout"
        value={minMiddlePct}
        min={0}
        onChange={setMinMiddlePct}
      />
      <NumberFilter
        label="Max miss loss"
        value={maxMissLossPct}
        min={0}
        onChange={setMaxMissLossPct}
      />

      <label className="flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={hideRegional}
          onChange={(event) => setHideRegional(event.target.checked)}
          className="h-4 w-4 accent-neutral-900 dark:accent-white"
        />
        Hide regional
      </label>

      <button
        type="button"
        onClick={resetFilters}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900",
          hasActiveFilters &&
            "border-neutral-300 text-neutral-900 dark:border-neutral-700 dark:text-white",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Reset
      </button>

      <button
        type="button"
        onClick={() => void refresh()}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98] dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        Refresh
      </button>
    </FilterShell>
  );

  return (
    <AppPageLayout
      title="Middles"
      subtitle="Find line gaps where both sides can win if the result lands inside the middle."
      headerActions={
        <AutoToggle
          enabled={auto}
          setEnabled={setAuto}
          pro={hasLiveMiddles}
          connected={auto && !error}
        />
      }
      statsBar={
        <PageStatsBar
          stats={[
            {
              label: "Opportunities",
              value: currentCount,
              hasFilter: hasActiveFilters,
            },
            {
              label: "Best middle hit",
              value: pctFromBps(bestMiddle),
              suffix: "%",
              color: "success",
            },
            {
              label: "Worst miss",
              value: pctFromBps(worstMiss),
              suffix: "%",
              color: worstMiss < 0 ? "warning" : "default",
            },
          ]}
        />
      }
      contextBar={contextBar}
      stickyContextBar
    >
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Middles feed could not refresh: {error}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <MiddlesTable rows={rows} ids={ids} changes={changes} added={added} />
      )}
    </AppPageLayout>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useMlbWeatherReport } from "@/hooks/use-mlb-weather-report";
import { LivingStadiumCard } from "@/components/cheat-sheet/mlb/living-stadium-card";

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

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

export function MlbWeatherReport() {
  const [selectedDate, setSelectedDate] = useState(getETDate(0));
  const { rows, isLoading, error, isFetching } = useMlbWeatherReport(selectedDate);

  const summary = useMemo(() => {
    const strongOver = rows.filter((r) => r.totalImpact === "strong_over").length;
    const leanOver = rows.filter((r) => r.totalImpact === "lean_over").length;
    const strongUnder = rows.filter((r) => r.totalImpact === "strong_under").length;
    const leanUnder = rows.filter((r) => r.totalImpact === "lean_under").length;
    const weatherAlerts = rows.filter((r) => !!r.weatherAlert).length;
    const avgWind =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + Number(r.windSpeedMph || 0), 0) / rows.length
        : 0;
    const noGeometryCount = rows.filter((r) => !r.stadiumGeometry?.outfieldOuter?.length).length;

    return {
      strongOver,
      leanOver,
      strongUnder,
      leanUnder,
      weatherAlerts,
      avgWind,
      noGeometryCount,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">MLB Weather Impact Report</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Venue weather, wind direction, and projected HR/total impact by game.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="weather-date" className="text-xs font-medium text-neutral-500">Date</label>
            <input
              id="weather-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-500">Over Lean</p>
          <p className="text-xl font-bold text-emerald-500">{summary.strongOver + summary.leanOver}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-500">Under Lean</p>
          <p className="text-xl font-bold text-red-500">{summary.strongUnder + summary.leanUnder}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-500">Alerts</p>
          <p className="text-xl font-bold text-amber-500">{summary.weatherAlerts}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-500">Avg Wind</p>
          <p className="text-xl font-bold text-neutral-900 dark:text-white">{formatNumber(summary.avgWind, 1)} mph</p>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p className="text-xs text-neutral-500">Games</p>
          <p className="text-xl font-bold text-neutral-900 dark:text-white">{rows.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-sm text-neutral-500">Loading weather report...</div>
        ) : error ? (
          <div className="p-8 text-sm text-red-500">{error.message || "Failed to load weather report"}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-neutral-500">No weather report rows for this date.</div>
        ) : (
          <div className="p-3 md:p-4 space-y-4">
            {summary.noGeometryCount > 0 && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs md:text-sm text-amber-700 dark:text-amber-300">
                No stadium geometry loaded yet for {summary.noGeometryCount} game{summary.noGeometryCount === 1 ? "" : "s"}. Those cards use a generic ballpark shape temporarily.
              </div>
            )}

            <div className="space-y-4">
              {rows.map((row) => (
                <LivingStadiumCard key={`${row.gameId}-${row.gameDate}`} row={row} />
              ))}
            </div>
          </div>
        )}

        {isFetching && !isLoading && (
          <div className="px-3 py-2 text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800">
            Refreshing weather data...
          </div>
        )}
      </div>
    </div>
  );
}

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

function formatLongDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

export function MlbWeatherReport() {
  const [selectedDate, setSelectedDate] = useState(getETDate(0));
  const { rows, isLoading, error, isFetching } = useMlbWeatherReport(selectedDate);

  const summary = useMemo(() => {
    const weatherAlerts = rows.filter((r) => !!r.weatherAlert).length;
    const highImpactSpots = rows.filter((r) => Math.abs(Number(r.hrImpactScore ?? 0)) >= 2).length;
    const windyGames = rows.filter((r) => Number(r.windSpeedMph ?? 0) >= 12).length;
    const roofControlled = rows.filter((r) => {
      const roof = (r.roofType || "").toLowerCase();
      return roof.includes("retract") || roof.includes("dome");
    }).length;
    const avgWind =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + Number(r.windSpeedMph || 0), 0) / rows.length
        : 0;
    const noGeometryCount = rows.filter((r) => !r.stadiumGeometry?.outfieldOuter?.length).length;

    return {
      weatherAlerts,
      highImpactSpots,
      windyGames,
      roofControlled,
      avgWind,
      noGeometryCount,
    };
  }, [rows]);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/90 dark:from-neutral-900 dark:to-[#0a0f1c] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-neutral-500 dark:text-neutral-400">
              Weather Intelligence
            </p>
            <h2 className="mt-1 text-xl md:text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
              Daily MLB Slate Outlook
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              Game-level wind, conditions, and ballpark context to spot where totals and HR environments can shift.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white/80 dark:bg-neutral-900/70 px-3 py-2">
            <label htmlFor="weather-date" className="text-[11px] uppercase tracking-[0.1em] font-semibold text-neutral-500 dark:text-neutral-400">
              Date
            </label>
            <input
              id="weather-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm font-medium"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3">
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/75 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Games</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/75 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">High Impact</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums">{summary.highImpactSpots}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/75 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Alerts</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{summary.weatherAlerts}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/75 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Avg Wind</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums">
              {formatNumber(summary.avgWind, 1)}
              <span className="ml-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">mph</span>
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/75 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">Roof Control</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-white tabular-nums">{summary.roofControlled}</p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{summary.windyGames} windy games</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-neutral-500 dark:text-neutral-400">Game Breakdown</p>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">Per-game weather and park impact cards</p>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            {formatLongDate(selectedDate)}
          </div>
        </div>

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
            Refreshing live weather and park context...
          </div>
        )}
      </div>
    </div>
  );
}

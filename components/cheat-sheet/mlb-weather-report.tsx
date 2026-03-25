"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { SheetFilterBar, FilterCount, SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { useMlbGameDates } from "@/hooks/use-mlb-game-dates";
import { cn } from "@/lib/utils";
import { useMlbWeatherReport } from "@/hooks/use-mlb-weather-report";
import type { MlbWeatherReportRow } from "@/hooks/use-mlb-weather-report";
import { HREnvironmentDetail } from "@/components/cheat-sheet/mlb/hr-environment-detail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  computeEnvScore,
  getScoreBadgeColor,
  getScoreTier,
} from "@/components/cheat-sheet/mlb/env-score";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "-";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

type SortKey = "envScore" | "gameTime" | "parkFactor" | "windImpact";

function sortRows(rows: MlbWeatherReportRow[], sortKey: SortKey): (MlbWeatherReportRow & { envScore: number })[] {
  const enriched = rows.map((row) => ({ ...row, envScore: computeEnvScore(row) }));

  switch (sortKey) {
    case "envScore":
      return enriched.sort((a, b) => b.envScore - a.envScore);
    case "gameTime":
      return enriched.sort((a, b) => (a.gameDatetime ?? "").localeCompare(b.gameDatetime ?? ""));
    case "parkFactor":
      return enriched.sort((a, b) => (b.ballparkFactors?.hr?.overall ?? 100) - (a.ballparkFactors?.hr?.overall ?? 100));
    case "windImpact":
      return enriched.sort((a, b) => windFavScore(b) - windFavScore(a));
    default:
      return enriched;
  }
}

function windFavScore(row: MlbWeatherReportRow): number {
  const label = (row.windLabel ?? "").toLowerCase();
  const speed = row.windSpeedMph ?? 0;
  let base = 0;
  if (label.includes("out")) base = 1;
  else if (label.includes("in")) base = -1;
  return base * speed;
}

function windSummary(row: MlbWeatherReportRow): string {
  const speed = row.windSpeedMph;
  if (speed == null || speed < 1) return "Calm";
  const label = row.windLabel ?? "";
  const short = label
    .replace(/\bblowing\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${Math.round(speed)} mph ${short}`;
}

// ── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "envScore", label: "Env Score" },
  { key: "gameTime", label: "Game Time" },
  { key: "parkFactor", label: "Park Factor" },
  { key: "windImpact", label: "Wind Impact" },
];

// ── Game List Row ───────────────────────────────────────────────────────────

interface GameRowProps {
  row: MlbWeatherReportRow & { envScore: number };
  selected: boolean;
  onClick: () => void;
}

function GameRow({ row, selected, onClick }: GameRowProps) {
  const score = row.envScore;
  const badgeColor = getScoreBadgeColor(score);
  const awayAbbr = row.awayTeamAbbr || "Away";
  const homeAbbr = row.homeTeamAbbr || "Home";
  const time = getETTime(row.gameDatetime);
  const temp = row.temperatureF != null ? Math.round(row.temperatureF) : null;
  const precip = row.precipProbability != null ? Math.round(row.precipProbability) : null;
  const windSpeed = row.windSpeedMph != null ? Math.round(row.windSpeedMph) : null;
  const isRoof = row.roofType === "retractable" || row.roofType === "dome";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 transition-all duration-150",
        selected
          ? "bg-brand/5 dark:bg-brand/10"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
      )}
    >
      {/* Row 1: Score + Matchup + Time */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="shrink-0 inline-flex items-center justify-center text-[11px] font-bold tabular-nums rounded-md px-1.5 py-0.5 min-w-[28px]"
          style={{ color: badgeColor, backgroundColor: `${badgeColor}14`, border: `1px solid ${badgeColor}30` }}
        >
          {score}
        </span>

        <div className="flex items-center gap-1.5 min-w-0">
          {row.awayTeamAbbr && (
            <img
              src={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
              alt={awayAbbr}
              className="h-4 w-4 object-contain shrink-0"
            />
          )}
          <span className="font-semibold text-xs text-neutral-900 dark:text-white">
            {awayAbbr} @ {homeAbbr}
          </span>
          {row.homeTeamAbbr && (
            <img
              src={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
              alt={homeAbbr}
              className="h-4 w-4 object-contain shrink-0"
            />
          )}
        </div>

        <span className="ml-auto text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0">
          {time}
        </span>
      </div>

      {/* Row 2: Venue */}
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mb-2 pl-[38px]">
        {row.venueName ?? "Unknown"}
        {isRoof && <span className="ml-1 text-[9px] font-medium text-sky-500">ROOF</span>}
      </p>

      {/* Row 3: Weather stats — temp / precip / wind inline */}
      <div className="flex items-center gap-3 pl-[38px]">
        {temp != null && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums">{temp}°</span>
            <span className="text-[9px] text-neutral-400 uppercase">F</span>
          </div>
        )}
        {precip != null && (
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-[11px] font-bold tabular-nums",
              precip >= 30 ? "text-sky-500" : "text-neutral-900 dark:text-white"
            )}>{precip}%</span>
            <span className="text-[9px] text-neutral-400 uppercase">precip</span>
          </div>
        )}
        {windSpeed != null && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums">{windSpeed}</span>
            <span className="text-[9px] text-neutral-400 uppercase">mph</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MlbWeatherReport() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDateState] = useState(() => searchParams.get("date") || getETDate(0));
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);
  const [sortKey, setSortKey] = useState<SortKey>("envScore");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const { rows, isLoading, error, isFetching } = useMlbWeatherReport(selectedDate);
  const availableDates = useMlbGameDates();

  // Auto-advance to first available date with games
  useEffect(() => {
    if (isLoading || rows.length > 0 || availableDates.length === 0) return;
    if (!availableDates.includes(selectedDate)) {
      const nextDate = availableDates.find((d) => d >= selectedDate) ?? availableDates[0];
      setSelectedDate(nextDate);
    }
  }, [isLoading, rows.length, availableDates, selectedDate]);

  const sortedRows = useMemo(() => sortRows(rows, sortKey), [rows, sortKey]);
  const activeSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  // Auto-select highest-scored game on load or when date/sort changes
  useEffect(() => {
    if (sortedRows.length > 0) {
      if (selectedGameId && sortedRows.some((r) => r.gameId === selectedGameId)) return;
      const best = sortedRows.reduce((max, r) => r.envScore > max.envScore ? r : max);
      setSelectedGameId(best.gameId);
    } else {
      setSelectedGameId(null);
    }
  }, [sortedRows, selectedGameId]);

  const selectedRow = useMemo(
    () => sortedRows.find((r) => r.gameId === selectedGameId) ?? null,
    [sortedRows, selectedGameId]
  );

  const highImpactCount = useMemo(
    () => sortedRows.filter((r) => r.envScore >= 70).length,
    [sortedRows]
  );

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <SheetFilterBar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        right={
          <>
            {highImpactCount > 0 && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                {highImpactCount} high-impact
              </span>
            )}
            <FilterCount count={sortedRows.length} label={sortedRows.length === 1 ? "game" : "games"} />
          </>
        }
      >
        <SegmentedControl
          value={sortKey}
          onChange={setSortKey}
          options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.key }))}
        />
      </SheetFilterBar>

      {/* Loading/Error states */}
      {isLoading ? (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center text-sm text-neutral-500">
          Loading weather report...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-neutral-900 p-8 text-center text-sm text-red-600 dark:text-red-400">
          {error.message || "Failed to load weather report"}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center">
          <p className="text-sm text-neutral-500">No games found for {formatLongDate(selectedDate)}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">Try selecting a different date.</p>
        </div>
      ) : (
        <>
          {/* Two-panel layout */}
          <div className="flex flex-col xl:flex-row gap-3">
            {/* Left panel: Game list */}
            <div className="xl:w-[35%] w-full rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 flex flex-col overflow-hidden">
              {/* List header with date + game count */}
              <div className="px-3 py-2.5 border-b border-neutral-200/60 dark:border-neutral-700/30 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 dark:text-neutral-500">
                  {formatLongDate(selectedDate)}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                  <span>{sortedRows.length} games</span>
                  {highImpactCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{highImpactCount} high-impact</span>
                  )}
                </div>
              </div>

              {/* Scrollable game list */}
              <div className="overflow-y-auto xl:max-h-[calc(100vh-280px)] max-h-[420px] divide-y divide-neutral-100 dark:divide-neutral-800/30">
                {sortedRows.map((row) => (
                  <GameRow
                    key={row.gameId}
                    row={row}
                    selected={row.gameId === selectedGameId}
                    onClick={() => setSelectedGameId(row.gameId)}
                  />
                ))}
              </div>
            </div>

            {/* Right panel: Detail */}
            <div className="xl:w-[65%] w-full rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
              <div className="overflow-y-auto xl:max-h-[calc(100vh-280px)]">
                {selectedRow ? (
                  <HREnvironmentDetail row={selectedRow} date={selectedDate} />
                ) : (
                  <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
                    Select a game to view details
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Refreshing indicator */}
          {isFetching && !isLoading && (
            <div className="text-xs text-neutral-500 text-center">
              Refreshing live data...
            </div>
          )}
        </>
      )}
    </div>
  );
}

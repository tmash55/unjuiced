"use client";

import { useMemo, useState, useEffect } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { MlbDateNav } from "@/components/cheat-sheet/mlb-date-nav";
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
  const temp = row.temperatureF != null ? `${Math.round(row.temperatureF)}°F` : "--";
  const wind = windSummary(row);

  const awayColor = row.awayTeamPrimaryColor ?? "#64748b";
  const homeColor = row.homeTeamPrimaryColor ?? "#64748b";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 border-l-[3px] transition-all duration-150",
        selected
          ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/[0.06]"
          : "border-l-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/40 hover:border-l-neutral-300 dark:hover:border-l-neutral-600"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Score badge */}
        <span
          className="shrink-0 inline-flex items-center justify-center text-[11px] font-bold tabular-nums rounded-md px-1.5 py-0.5 min-w-[28px]"
          style={{ color: badgeColor, backgroundColor: `${badgeColor}14`, border: `1px solid ${badgeColor}30` }}
        >
          {score}
        </span>

        {/* Matchup with logos */}
        <div className="flex items-center gap-1 shrink-0">
          {row.awayTeamAbbr ? (
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${awayColor}18`, border: `1px solid ${awayColor}30` }}
            >
              <img
                src={`/team-logos/mlb/${row.awayTeamAbbr.toUpperCase()}.svg`}
                alt={awayAbbr}
                className="h-4 w-4 object-contain"
              />
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-neutral-900 dark:text-white">{awayAbbr}</span>
          )}
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">@</span>
          {row.homeTeamAbbr ? (
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${homeColor}18`, border: `1px solid ${homeColor}30` }}
            >
              <img
                src={`/team-logos/mlb/${row.homeTeamAbbr.toUpperCase()}.svg`}
                alt={homeAbbr}
                className="h-4 w-4 object-contain"
              />
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-neutral-900 dark:text-white">{homeAbbr}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Team names + high impact */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[12px] text-neutral-900 dark:text-white truncate">
              {awayAbbr} @ {homeAbbr}
            </span>
            {score >= 70 && (
              <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">⚡</span>
            )}
          </div>

          {/* Venue + time */}
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
            {row.venueName ?? "Unknown"} · {time} ET
          </p>

          {/* Weather summary */}
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
            {temp} · {wind}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MlbWeatherReport() {
  const [selectedDate, setSelectedDate] = useState(getETDate(0));
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
      {/* Controls bar — date nav + sort + stats */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <MlbDateNav
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
            <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800/60 shrink-0" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums font-mono">
              {sortedRows.length} game{sortedRows.length !== 1 ? "s" : ""}
            </span>
            {highImpactCount > 0 && (
              <>
                <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800/60 shrink-0" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {highImpactCount} high-impact
                </span>
              </>
            )}
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                  "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300",
                  "border border-neutral-200 dark:border-neutral-700/30",
                  "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
                )}
              >
                <ArrowUpDown className="h-3 w-3 text-neutral-400" />
                <span>{activeSortLabel}</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className="flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  {sortKey === opt.key && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
              {/* List header */}
              <div className="px-3 py-2.5 border-b border-neutral-200/60 dark:border-neutral-700/30">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-neutral-400 dark:text-neutral-500">
                  {formatLongDate(selectedDate)}
                </p>
              </div>

              {/* Scrollable game list */}
              <div className="overflow-y-auto xl:max-h-[calc(100vh-280px)] max-h-[360px] divide-y divide-neutral-100 dark:divide-neutral-800/30">
                {sortedRows.map((row) => (
                  <GameRow
                    key={row.gameId}
                    row={row}
                    selected={row.gameId === selectedGameId}
                    onClick={() => setSelectedGameId(row.gameId)}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-neutral-200/60 dark:border-neutral-700/30 mt-auto">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {sortedRows.length} game{sortedRows.length !== 1 ? "s" : ""} today
                  {highImpactCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 ml-1.5">· {highImpactCount} high-impact</span>
                  )}
                </p>
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

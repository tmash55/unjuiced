"use client";

import React, { useState, useMemo, useCallback } from "react";
import { TrendingUp, ChevronUp, ChevronDown, ChevronsUpDown, Info, HeartPulse } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdown } from "@/components/hit-rates/odds-dropdown";
import { MiniSparkline, MiniHitIndicator } from "@/components/hit-rates/mini-sparkline";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { useHitRateOdds, type LineOdds } from "@/hooks/use-hit-rate-odds";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { getTeamLogoUrl, getStandardAbbreviation } from "@/lib/data/team-mappings";

// Map of combo market keys to their full descriptions (only abbreviated combos need tooltips)
const COMBO_MARKET_DESCRIPTIONS: Record<string, string> = {
  "player_points_rebounds_assists": "Points + Rebounds + Assists",
  "player_points_rebounds": "Points + Rebounds",
  "player_points_assists": "Points + Assists",
  "player_rebounds_assists": "Rebounds + Assists",
};

// Check if a market is a combo market that needs a tooltip
const getMarketTooltip = (market: string): string | null => {
  return COMBO_MARKET_DESCRIPTIONS[market] || null;
};

type SortField = "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct";
type SortDirection = "asc" | "desc";

interface HitRateTableProps {
  rows: HitRateProfile[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: HitRateProfile) => void;
}

const formatPercentage = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

const hitRateBadgeClass = (value: number | null) => {
  if (value === null || value === undefined) {
    return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  }
  if (value >= 70) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (value >= 60) {
    return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300";
  }
  if (value >= 50) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
};

const formatDate = (value: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Convert ET time string (e.g., "7:00 pm ET") to user's local timezone
const formatGameTime = (gameStatus: string | null, gameDate: string | null) => {
  if (!gameStatus) return "TBD";
  
  // Check if it's a final score or other non-time status
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;
  
  // Try to parse time like "7:00 pm ET" or "7:00 PM ET"
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  // Create a date object in ET (Eastern Time)
  // ET is UTC-5 (EST) or UTC-4 (EDT)
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  
  // Format in user's local timezone
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatSpread = (spread: number | null) => {
  if (spread === null || spread === undefined) return "—";
  return spread > 0 ? `+${spread}` : spread.toString();
};

// Get color class for average vs line comparison
const getAvgColorClass = (avg: number | null, line: number | null) => {
  if (avg === null || line === null) return "text-neutral-700 dark:text-neutral-300";
  if (avg > line) return "text-emerald-600 dark:text-emerald-400"; // Green - over the line
  if (avg < line) return "text-red-500 dark:text-red-400"; // Red - under the line
  return "text-neutral-700 dark:text-neutral-300"; // Neutral - exactly at the line
};

const formatPosition = (position: string | null) => {
  if (!position) return "—";
  // If it's exactly 2 letters and not "PF", split with a slash
  if (position.length === 2 && position !== "PF") {
    return `${position[0]}/${position[1]}`;
  }
  return position;
};

const getStatusBorderClass = (status: string | null) => {
  // All players get the same neutral border - no colored borders
  return "border border-neutral-200 dark:border-neutral-700";
};

const isPlayerOut = (status: string | null) => status === "out";

// Get injury icon color class based on status
const getInjuryIconColorClass = (status: string | null): string => {
  if (!status || status === "active" || status === "available") return "";
  if (status === "questionable" || status === "game_time_decision") return "text-amber-500";
  if (status === "doubtful") return "text-orange-500";
  if (status === "out") return "text-red-500";
  if (status === "probable") return "text-neutral-400";
  return "";
};

// Check if player has an injury status worth showing
const hasInjuryStatus = (status: string | null): boolean => {
  if (!status) return false;
  return status !== "active" && status !== "available";
};

// Column definitions for sortable headers
const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
  { key: "line", label: "Prop" },
  { key: "l5Avg", label: "L5 Avg" },
  { key: "l10Avg", label: "L10 Avg" },
  { key: "seasonAvg", label: "25/26 Avg" },
  { key: "streak", label: "Streak" },
  { key: "l5Pct", label: "L5" },
  { key: "l10Pct", label: "L10" },
  { key: "l20Pct", label: "L20" },
  { key: "seasonPct", label: "25/26" },
];

const getSortValue = (row: HitRateProfile, field: SortField): number | null => {
  switch (field) {
    case "line": return row.line;
    case "l5Avg": return row.last5Avg;
    case "l10Avg": return row.last10Avg;
    case "seasonAvg": return row.seasonAvg;
    case "streak": return row.hitStreak;
    case "l5Pct": return row.last5Pct;
    case "l10Pct": return row.last10Pct;
    case "l20Pct": return row.last20Pct;
    case "seasonPct": return row.seasonPct;
    default: return null;
  }
};

export function HitRateTable({ rows, loading, error, onRowClick }: HitRateTableProps) {
  const [sortField, setSortField] = useState<SortField | null>("l10Pct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // New field, default to descending (highest first)
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField]);

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      
      // Handle nulls - push them to the end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      const diff = aVal - bVal;
      return sortDirection === "asc" ? diff : -diff;
    });
  }, [rows, sortField, sortDirection]);

  // Fetch odds for all rows in one batch
  // Pass playerId and market for proper SID resolution when lines change
  // Progressive odds loading - first 50 rows load immediately, rest in background
  const { getOdds, isLoading: oddsLoading, loadedCount, totalCount } = useHitRateOdds({
    rows: rows.map((r) => ({ 
      oddsSelectionId: r.oddsSelectionId, 
      playerId: r.playerId,
      market: r.market,
      line: r.line 
    })),
    enabled: rows.length > 0,
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent mb-4" />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading hit rates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
        <p className="font-semibold">Unable to load hit rates</p>
        <p className="text-sm mt-1 opacity-80">{error}</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-neutral-900 dark:text-white mb-2">No hit rates available</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Check back closer to tip-off or adjust your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full text-sm table-fixed">
        <colgroup><col style={{ width: 240 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 70 }} /><col style={{ width: 80 }} /><col style={{ width: 140 }} /><col style={{ width: 80 }} /></colgroup>
        <thead className="table-header-gradient sticky top-0 z-10">
          <tr>
            {/* Non-sortable columns */}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              Player
            </th>
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              Matchup
            </th>
            
            {/* Sortable: Prop (line) */}
            <th
              onClick={() => handleSort("line")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                Prop
                <SortIcon field="line" />
              </div>
            </th>
            
            {/* Sortable: L5 Avg */}
            <th
              onClick={() => handleSort("l5Avg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L5 Avg
                <SortIcon field="l5Avg" />
              </div>
            </th>
            
            {/* Sortable: L10 Avg */}
            <th
              onClick={() => handleSort("l10Avg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L10 Avg
                <SortIcon field="l10Avg" />
              </div>
            </th>
            
            {/* Sortable: 25/26 Avg (Season Avg) */}
            <th
              onClick={() => handleSort("seasonAvg")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                25/26 Avg
                <SortIcon field="seasonAvg" />
              </div>
            </th>
            
            {/* Non-sortable: Odds */}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
              Odds
            </th>
            
            {/* Sortable: Streak */}
            <th
              onClick={() => handleSort("streak")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                Streak
                <SortIcon field="streak" />
              </div>
            </th>
            
            {/* Sortable: L20 % */}
            <th
              onClick={() => handleSort("l20Pct")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L20
                <SortIcon field="l20Pct" />
              </div>
            </th>
            
            {/* Sortable: L10 / L5 Combined */}
            <th
              onClick={() => handleSort("l10Pct")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                L10 / L5
                <SortIcon field="l10Pct" />
              </div>
            </th>
            
            {/* Sortable: 25/26 % (Season %) */}
            <th
              onClick={() => handleSort("seasonPct")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1">
                25/26
                <SortIcon field="seasonPct" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const opponent = row.opponentTeamAbbr ?? row.opponentTeamName ?? "Opponent";
            const matchup = row.teamAbbr ? `${row.teamAbbr} vs ${opponent}` : opponent;
            const isHighConfidence = (row.last10Pct ?? 0) >= 70;

            return (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-neutral-100 dark:border-neutral-800 transition-all duration-150 group cursor-pointer",
                  idx % 2 === 0 ? "table-row-even" : "table-row-odd",
                  "hover:bg-brand/5 dark:hover:bg-brand/10 hover:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]",
                  isHighConfidence && "shadow-[inset_0_1px_0_rgba(16,185,129,0.2)]"
                )}
              >
                {/* Player Column: Headshot + Name + Position/Jersey */}
                <td className="px-3 py-4">
                  <div className={cn(
                    "flex items-center gap-3",
                    isPlayerOut(row.injuryStatus) && "opacity-50"
                  )}>
                    {(() => {
                      const hasInjury = row.injuryStatus && row.injuryStatus !== "active" && row.injuryStatus !== "available";
                      const injuryTooltip = hasInjury
                        ? `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                        : "";
                      
                      const headshotElement = (
                        <div 
                          className={cn(
                            "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm transition-transform duration-150 group-hover:scale-[1.03]",
                            hasInjury && "cursor-pointer",
                            getStatusBorderClass(row.injuryStatus)
                          )}
                          style={{ 
                            background: row.primaryColor && row.secondaryColor 
                              ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                              : row.primaryColor || undefined 
                          }}
                        >
                          <PlayerHeadshot
                            nbaPlayerId={row.playerId}
                            name={row.playerName}
                            size="small"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      );

                      return hasInjury ? (
                        <Tooltip content={injuryTooltip} side="right">
                          {headshotElement}
                        </Tooltip>
                      ) : (
                        headshotElement
                      );
                    })()}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">
                          {row.playerName}
                        </span>
                        {hasInjuryStatus(row.injuryStatus) && (
                          <Tooltip 
                            content={`${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`}
                            side="top"
                          >
                            <HeartPulse className={cn(
                              "h-4 w-4 cursor-help",
                              getInjuryIconColorClass(row.injuryStatus)
                            )} />
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                        {row.teamAbbr && (
                          <img
                            src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                            alt={row.teamAbbr}
                            className="h-4 w-4 object-contain"
                          />
                        )}
                        <span>{formatPosition(row.position)}</span>
                        <span className="text-neutral-300 dark:text-neutral-600">•</span>
                        <span>#{row.jerseyNumber ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Matchup Column */}
                <td className="px-3 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {/* vs / @ */}
                    <span className="text-xs text-neutral-400 font-medium">
                      {row.homeAway === "H" ? "vs" : "@"}
                    </span>
                    
                    {/* Opponent Logo */}
                    {row.opponentTeamAbbr && (
                      <img
                        src={`/team-logos/nba/${row.opponentTeamAbbr.toUpperCase()}.svg`}
                        alt={row.opponentTeamAbbr}
                        className="h-7 w-7 object-contain"
                      />
                    )}
                  </div>
                </td>

                {/* Prop Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                    {row.line !== null && (
                      <span className="font-semibold text-neutral-900 dark:text-white">{row.line}+</span>
                    )}
                    {formatMarketLabel(row.market)}
                    {getMarketTooltip(row.market) && (
                      <Tooltip content={getMarketTooltip(row.market)!}>
                        <Info className="h-3 w-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 cursor-help" />
                      </Tooltip>
                    )}
                  </span>
                </td>

                {/* L5 Avg Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn("text-sm font-medium", getAvgColorClass(row.last5Avg, row.line))}>
                    {row.last5Avg !== null ? row.last5Avg.toFixed(1) : "—"}
                  </span>
                </td>

                {/* L10 Avg Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn("text-sm font-medium", getAvgColorClass(row.last10Avg, row.line))}>
                    {row.last10Avg !== null ? row.last10Avg.toFixed(1) : "—"}
                  </span>
                </td>

                {/* 25/26 Avg (Season Avg) Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <span className={cn("text-sm font-medium", getAvgColorClass(row.seasonAvg, row.line))}>
                    {row.seasonAvg !== null ? row.seasonAvg.toFixed(1) : "—"}
                  </span>
                </td>

                {/* Odds Column */}
                <td className="px-3 py-4 align-middle text-center">
                  <OddsDropdown 
                    odds={getOdds(row.oddsSelectionId)} 
                    loading={oddsLoading} 
                  />
                </td>

                {/* Streak Column */}
                <td className="px-3 py-4 align-middle text-center">
                  {row.hitStreak !== null && row.hitStreak !== undefined ? (
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {row.hitStreak}
                    </span>
                  ) : (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">—</span>
                  )}
                </td>

                {/* L20 % */}
                <td className="px-3 py-4 align-middle text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold",
                      hitRateBadgeClass(row.last20Pct)
                    )}
                  >
                    {formatPercentage(row.last20Pct)}
                  </span>
                </td>

                {/* L10 / L5 Combined with full 10-game sparkline */}
                <td className="px-3 py-4 align-middle text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Full 10-game sparkline - oldest on left, newest on right */}
                    <MiniSparkline 
                      gameLogs={row.gameLogs as any} 
                      line={row.line} 
                      count={10} 
                      className="h-5"
                    />
                    {/* Both percentages below */}
                    <div className="flex items-center gap-2 text-[10px] font-medium">
                      <span className={cn(
                        row.last10Pct !== null && row.last10Pct >= 70 
                          ? "text-emerald-600 dark:text-emerald-400" 
                          : row.last10Pct !== null && row.last10Pct >= 50
                            ? "text-neutral-600 dark:text-neutral-400"
                            : "text-red-500 dark:text-red-400"
                      )}>
                        L10: {formatPercentage(row.last10Pct)}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-600">|</span>
                      <span className={cn(
                        row.last5Pct !== null && row.last5Pct >= 70 
                          ? "text-emerald-600 dark:text-emerald-400" 
                          : row.last5Pct !== null && row.last5Pct >= 50
                            ? "text-neutral-600 dark:text-neutral-400"
                            : "text-red-500 dark:text-red-400"
                      )}>
                        L5: {formatPercentage(row.last5Pct)}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Season % */}
                <td className="px-3 py-4 align-middle text-center">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold",
                      hitRateBadgeClass(row.seasonPct)
                    )}
                  >
                    {formatPercentage(row.seasonPct)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


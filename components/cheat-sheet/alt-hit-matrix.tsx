"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { 
  useAltHitMatrix, 
  AltHitMatrixRow, 
  getHitRateColor, 
  getHitRateTextColor,
  ALT_MATRIX_MARKETS,
  TIME_WINDOW_OPTIONS,
  AltHitMatrixTimeWindow 
} from "@/hooks/use-alt-hit-matrix";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Loader2, ChevronDown, HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

interface AltHitMatrixProps {
  sport?: string;
  className?: string;
}

export function AltHitMatrix({ sport = "nba", className }: AltHitMatrixProps) {
  const [selectedMarket, setSelectedMarket] = useState("player_points");
  const [timeWindow, setTimeWindow] = useState<AltHitMatrixTimeWindow>("last_10");
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);
  
  // Get today's date in ET
  const todayET = useMemo(() => {
    const now = new Date();
    const etOptions: Intl.DateTimeFormatOptions = { 
      timeZone: 'America/New_York', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    };
    return now.toLocaleDateString('en-CA', etOptions);
  }, []);

  const { rows, lineOffsets, isLoading, error } = useAltHitMatrix({
    market: selectedMarket,
    gameDate: todayET,
    timeWindow,
  });

  const selectedMarketLabel = ALT_MATRIX_MARKETS.find(m => m.value === selectedMarket)?.label || "Points";

  // Get column headers based on first row's data
  const columnHeaders = useMemo(() => {
    if (rows.length === 0 || !lineOffsets.length) return [];
    return lineOffsets.map(offset => ({
      offset,
      label: offset === 0 ? "Line" : `+${offset}`,
    }));
  }, [rows, lineOffsets]);

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900", className)}>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span className="text-sm text-neutral-500">Loading hit rate matrix...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-6", className)}>
        <p className="text-sm text-red-500">Failed to load alt hit matrix</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-900 overflow-hidden shadow-sm", className)}>
      {/* Header with Filters */}
      <div className="px-4 py-3 border-b border-neutral-200/60 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50 to-transparent dark:from-neutral-800/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Info */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Alt Hit Matrix
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Find optimal alternate lines across all players
              </p>
            </div>
            <Tooltip 
              content={
                <div className="text-xs max-w-[250px]">
                  <p className="font-semibold mb-1">How to read this matrix</p>
                  <p>Each cell shows the hit rate % if the line was X points higher. Green = high hit rate, Red = low.</p>
                  <p className="mt-1">Example: A cell showing "80%" in the "+5" column means the player has hit that line (current +5) 80% of the time.</p>
                </div>
              }
              side="bottom"
            >
              <button className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <HelpCircle className="h-4 w-4 text-neutral-400" />
              </button>
            </Tooltip>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            {/* Market Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMarketDropdown(!showMarketDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700",
                  "hover:bg-neutral-50 dark:hover:bg-neutral-750"
                )}
              >
                {selectedMarketLabel}
                <ChevronDown className={cn(
                  "h-4 w-4 text-neutral-400 transition-transform",
                  showMarketDropdown && "rotate-180"
                )} />
              </button>

              {showMarketDropdown && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                  {ALT_MATRIX_MARKETS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setSelectedMarket(m.value);
                        setShowMarketDropdown(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        selectedMarket === m.value
                          ? "bg-brand/10 text-brand font-semibold"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time Window Toggle */}
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg">
              {TIME_WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTimeWindow(opt.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                    timeWindow === opt.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {opt.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-neutral-500 dark:text-neutral-400">
          No data available for today's games
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-neutral-100/70 dark:bg-neutral-800/70 sticky top-0 z-10">
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="sticky left-0 z-20 bg-neutral-100 dark:bg-neutral-800 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Player
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-[70px]">
                  Line
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-[60px]">
                  Matchup
                </th>
                {columnHeaders.map((col) => (
                  <th 
                    key={col.offset} 
                    className={cn(
                      "px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider w-[55px]",
                      col.offset === 0 
                        ? "text-brand bg-brand/5" 
                        : "text-neutral-500"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <AltHitMatrixTableRow 
                  key={`${row.playerId}-${row.market}`} 
                  row={row} 
                  isEven={idx % 2 === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/30">
        <div className="flex items-center justify-center gap-4 text-[10px]">
          <span className="text-neutral-500 font-medium">Hit Rate:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-emerald-600" />
            <span className="text-neutral-600 dark:text-neutral-400">80%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-emerald-400" />
            <span className="text-neutral-600 dark:text-neutral-400">60%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-amber-400" />
            <span className="text-neutral-600 dark:text-neutral-400">50%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-400" />
            <span className="text-neutral-600 dark:text-neutral-400">40%+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-neutral-600 dark:text-neutral-400">&lt;40%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AltHitMatrixTableRow({ row, isEven }: { row: AltHitMatrixRow; isEven: boolean }) {
  return (
    <tr className={cn(
      "border-b border-neutral-100/50 dark:border-neutral-800/50 transition-colors",
      isEven 
        ? "bg-white dark:bg-neutral-900" 
        : "bg-neutral-50/50 dark:bg-neutral-800/20",
      "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40"
    )}>
      {/* Player */}
      <td className="sticky left-0 z-10 px-4 py-3 bg-inherit">
        <div className="flex items-center gap-3">
          <div 
            className="h-14 w-14 rounded-xl overflow-hidden shrink-0 shadow-sm transition-transform duration-150 hover:scale-[1.03]"
            style={{
              background: row.primaryColor 
                ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor || row.primaryColor} 100%)`
                : '#374151'
            }}
          >
            <PlayerHeadshot
              nbaPlayerId={row.playerId}
              name={row.playerName}
              size="small"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-neutral-900 dark:text-white truncate leading-tight">
              {row.playerName}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
              {row.teamAbbr && (
                <img
                  src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                  alt={row.teamAbbr}
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{row.position}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Current Line */}
      <td className="px-3 py-2 text-center">
        <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums">
          {row.line}+
        </span>
      </td>

      {/* Matchup */}
      <td className="px-3 py-2 text-center">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          {row.homeAway === "H" ? "vs" : "@"} {row.opponentAbbr}
        </span>
      </td>

      {/* Hit Rate Cells */}
      {row.hitRates.map((hr) => (
        <td key={hr.offset} className="px-1 py-1.5 text-center">
          <div 
            className={cn(
              "mx-auto w-12 py-1.5 rounded-md text-xs font-bold tabular-nums transition-all",
              getHitRateColor(hr.hitRate),
              getHitRateTextColor(hr.hitRate),
              hr.offset === 0 && "ring-2 ring-brand/50"
            )}
          >
            {hr.hitRate !== null ? (
              <Tooltip 
                content={
                  <span className="text-xs">
                    {hr.hits}/{hr.games} games at {hr.line}+
                  </span>
                }
                side="top"
              >
                <span className="cursor-help">{hr.hitRate}%</span>
              </Tooltip>
            ) : (
              "—"
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}


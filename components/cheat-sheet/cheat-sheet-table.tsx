"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp, 
  Flame, 
  HeartPulse,
  ArrowDown,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { Heart } from "@/components/icons/heart";
import { 
  CheatSheetRow, 
  getGradeColor, 
  getMarketLabel,
  OddsData
} from "@/hooks/use-cheat-sheet";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { OddsDropdownCell } from "./odds-dropdown-cell";

interface CheatSheetTableProps {
  rows: CheatSheetRow[];
  isLoading?: boolean;
  oddsData?: Record<string, OddsData>;
  isLoadingOdds?: boolean;
  timeWindow?: string;
  onRowClick?: (row: CheatSheetRow) => void;
  onGlossaryOpen?: () => void;
  hideNoOdds?: boolean;
}

type SortField = 
  | "confidence" 
  | "hitRate" 
  | "avgStat" 
  | "dvpRank" 
  | "odds" 
  | "line"
  | "player";

// Get time window label for column header
function getTimeWindowLabel(timeWindow?: string): string {
  switch (timeWindow) {
    case "last_5_pct": return "L5";
    case "last_10_pct": return "L10";
    case "last_20_pct": return "L20";
    case "season_pct": return "Season";
    default: return "L10";
  }
}

type SortDirection = "asc" | "desc";

// Market short labels
const MARKET_SHORT_LABELS: Record<string, string> = {
  player_points: "PTS",
  player_rebounds: "REB",
  player_assists: "AST",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  player_threes_made: "3PM",
  player_steals: "STL",
  player_blocks: "BLK",
  player_blocks_steals: "BLK+STL",
  player_turnovers: "TO",
};

// Position label mapping
const POSITION_LABELS: Record<string, string> = {
  "PG": "Point Guard",
  "SG": "Shooting Guard",
  "SF": "Small Forward",
  "PF": "Power Forward",
  "C": "Center",
  "G": "Guard",
  "F": "Forward",
  "G-F": "Guard-Forward",
  "F-G": "Forward-Guard",
  "F-C": "Forward-Center",
  "C-F": "Center-Forward",
};

// Check if player has injury status
const hasInjuryStatus = (status: string | null | undefined): boolean => {
  return !!status && status !== "active" && status !== "available";
};

// Get injury icon color class
const getInjuryIconColor = (status: string | null | undefined): string => {
  if (!status) return "text-neutral-400";
  const s = status.toLowerCase();
  if (s === "out" || s === "injured") return "text-red-500";
  if (s === "doubtful") return "text-orange-500";
  if (s === "questionable") return "text-yellow-500";
  if (s === "probable" || s === "day-to-day") return "text-green-500";
  return "text-neutral-400";
};

// Get headshot border color based on injury status
const getStatusBorderClass = (status: string | null | undefined): string => {
  if (!status || status === "active" || status === "available") return "";
  const s = status.toLowerCase();
  if (s === "out" || s === "injured") return "ring-2 ring-red-500/50";
  if (s === "doubtful") return "ring-2 ring-orange-500/50";
  if (s === "questionable") return "ring-2 ring-yellow-500/50";
  if (s === "probable" || s === "day-to-day") return "ring-2 ring-green-500/50";
  return "";
};

// Check if G-League assignment
const isGLeagueAssignment = (notes: string | null | undefined): boolean => {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return lower.includes("g league") || lower.includes("g-league") || lower.includes("gleague");
};

// Trend icons
function TrendIcon({ trend }: { trend: CheatSheetRow["trend"] }) {
  switch (trend) {
    case "hot":
      return <Flame className="w-3.5 h-3.5 text-red-500" />;
    case "improving":
      return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
    case "declining":
      return <TrendingDown className="w-3.5 h-3.5 text-orange-500" />;
    case "cold":
      return <div className="text-blue-500 text-xs">❄️</div>;
    default:
      return <Minus className="w-3.5 h-3.5 text-neutral-400" />;
  }
}

// DvP rank badge - simplified with tooltip
function DvpBadge({ rank, position }: { rank: number | null; position?: string }) {
  if (rank === null) return <span className="text-neutral-400">—</span>;
  
  const getColor = () => {
    if (rank >= 21) return "text-emerald-500"; // Easy matchup (rank 21-30)
    if (rank >= 11) return "text-yellow-500";  // Neutral matchup (rank 11-20)
    return "text-red-500";                      // Tough matchup (rank 1-10)
  };

  const getBgColor = () => {
    if (rank >= 21) return "bg-emerald-500/10";
    if (rank >= 11) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const getLabel = () => {
    if (rank >= 21) return "Easy";
    if (rank >= 11) return "Neutral";
    return "Tough";
  };

  const tooltipText = `${getLabel()} matchup${position ? ` vs ${position}` : ""}`;

  return (
    <Tooltip content={tooltipText} side="top">
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg cursor-help",
        getBgColor()
      )}>
        <span className={cn("text-sm font-bold tabular-nums", getColor())}>
          {rank}
        </span>
      </div>
    </Tooltip>
  );
}

// Confidence badge - letter grade with score
function ConfidenceBadge({ grade, score }: { 
  grade: CheatSheetRow["confidenceGrade"]; 
  score: number;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-bold", getGradeColor(grade))}>
      <span>{grade}</span>
      <span className="opacity-70 text-xs">({Math.round(score)})</span>
    </div>
  );
}

// Hit rate display - shows selected time window only
function HitRateDisplay({ 
  l5, 
  l10, 
  l20, 
  season,
  timeWindow 
}: { 
  l5: number; 
  l10: number; 
  l20: number; 
  season: number;
  timeWindow?: string;
}) {
  const getColor = (value: number) => {
    if (value >= 0.85) return "text-emerald-600 dark:text-emerald-500";
    if (value >= 0.75) return "text-green-600 dark:text-green-500";
    if (value >= 0.65) return "text-yellow-600 dark:text-yellow-500";
    return "text-red-600 dark:text-red-500";
  };

  // Get the relevant hit rate and game count based on time window
  const getHitRateData = () => {
    switch (timeWindow) {
      case "last_5_pct":
        return { pct: l5, games: 5 };
      case "last_10_pct":
        return { pct: l10, games: 10 };
      case "last_20_pct":
        return { pct: l20, games: 20 };
      case "season_pct":
        return { pct: season, games: null }; // No fixed game count for season
      default:
        return { pct: l10, games: 10 }; // Default to L10
    }
  };

  const { pct, games } = getHitRateData();
  const hits = games ? Math.round(pct * games) : null;
  const pctDisplay = Math.round(pct * 100);

  return (
    <div className="flex flex-col items-center">
      {hits !== null && games !== null ? (
        <>
          <span className={cn("text-sm font-bold tabular-nums", getColor(pct))}>
            {hits}/{games}
          </span>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {pctDisplay}%
          </span>
        </>
      ) : (
        <span className={cn("text-sm font-bold tabular-nums", getColor(pct))}>
          {pctDisplay}%
        </span>
      )}
    </div>
  );
}

// Sort icon
function SortIcon({ field, currentField, direction }: { 
  field: SortField; 
  currentField: SortField; 
  direction: SortDirection;
}) {
  if (field !== currentField) {
    return <ChevronDown className="w-3 h-3 text-neutral-300" />;
  }
  return direction === "desc" 
    ? <ChevronDown className="w-3 h-3 text-brand" />
    : <ChevronUp className="w-3 h-3 text-brand" />;
}

export function CheatSheetTable({ rows, isLoading, oddsData, isLoadingOdds, timeWindow, onRowClick, onGlossaryOpen, hideNoOdds = true }: CheatSheetTableProps) {
  // Helper to get live odds for a row
  const getLiveOdds = (row: CheatSheetRow) => {
    if (!oddsData || !row.oddsSelectionId) return null;
    return oddsData[row.oddsSelectionId] || null;
  };

  const [sortField, setSortField] = useState<SortField>("hitRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  // const [expandedRow, setExpandedRow] = useState<number | null>(null); // Reserved for SGP feature

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Helper to check if a row has live odds in Redis
  const hasLiveOdds = (row: CheatSheetRow): boolean => {
    if (!oddsData || !row.oddsSelectionId) return false;
    const odds = oddsData[row.oddsSelectionId];
    // Check if odds object exists AND has actual betting odds (bestOver or bestUnder)
    return odds !== null && 
           odds !== undefined && 
           (odds.bestOver !== null || odds.bestUnder !== null);
  };

  const sortedRows = useMemo(() => {
    // First filter out rows without odds if hideNoOdds is true
    let filteredRows = rows;
    if (hideNoOdds && oddsData) {
      filteredRows = rows.filter(row => hasLiveOdds(row));
    }

    return [...filteredRows].sort((a, b) => {
      // Push rows without live odds to the bottom (for when hideNoOdds is false)
      if (!hideNoOdds) {
        const aHasOdds = hasLiveOdds(a);
        const bHasOdds = hasLiveOdds(b);
        if (aHasOdds && !bHasOdds) return -1;
        if (!aHasOdds && bHasOdds) return 1;
      }

      // Then sort by selected field
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "confidence":
          aVal = a.confidenceScore;
          bVal = b.confidenceScore;
          break;
        case "hitRate":
          aVal = a.hitRate;
          bVal = b.hitRate;
          break;
        case "avgStat":
          aVal = a.avgStat ?? 0;
          bVal = b.avgStat ?? 0;
          break;
        case "dvpRank":
          aVal = a.dvpRank ?? 31;
          bVal = b.dvpRank ?? 31;
          break;
        case "odds":
          // Sort by best over American odds from live data (higher is better: +200 > +100 > -100 > -200)
          const aOdds = oddsData?.[a.oddsSelectionId ?? ""];
          const bOdds = oddsData?.[b.oddsSelectionId ?? ""];
          aVal = aOdds?.bestOver?.price ?? -9999;
          bVal = bOdds?.bestOver?.price ?? -9999;
          break;
        case "line":
          aVal = a.line;
          bVal = b.line;
          break;
        case "player":
          aVal = a.playerName;
          bVal = b.playerName;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "desc" 
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }

      // At this point, both values should be numbers
      const numA = typeof aVal === "number" ? aVal : 0;
      const numB = typeof bVal === "number" ? bVal : 0;
      return sortDirection === "desc" ? numB - numA : numA - numB;
    });
  }, [rows, sortField, sortDirection, oddsData, hideNoOdds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <p className="text-lg font-medium">No props match your filters</p>
        <p className="text-sm mt-1">Try adjusting your filters to see more results</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scrollable Table Container */}
      <div className="overflow-auto max-h-[calc(100vh-200px)] min-h-[500px]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-50 dark:bg-neutral-800/80">
            <th className="h-10 px-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[200px] bg-neutral-50 dark:bg-neutral-800/80">
              <button 
                onClick={() => handleSort("player")}
                className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                Player <SortIcon field="player" currentField={sortField} direction={sortDirection} />
              </button>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[100px] bg-neutral-50 dark:bg-neutral-800/80">
              <button 
                onClick={() => handleSort("line")}
                className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                Prop <SortIcon field="line" currentField={sortField} direction={sortDirection} />
              </button>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[80px] bg-neutral-50 dark:bg-neutral-800/80">
              <button 
                onClick={() => handleSort("hitRate")}
                className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                Hit Rate <SortIcon field="hitRate" currentField={sortField} direction={sortDirection} />
              </button>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[90px] bg-neutral-50 dark:bg-neutral-800/80">
              <Tooltip content="Average over selected time window with edge (difference from line)" side="top">
                <button 
                  onClick={() => handleSort("avgStat")}
                  className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-help"
                >
                  {getTimeWindowLabel(timeWindow)} Avg <SortIcon field="avgStat" currentField={sortField} direction={sortDirection} />
                </button>
              </Tooltip>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[80px] bg-neutral-50 dark:bg-neutral-800/80">
              <button 
                onClick={() => handleSort("dvpRank")}
                className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                DvP <SortIcon field="dvpRank" currentField={sortField} direction={sortDirection} />
              </button>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[120px] bg-neutral-50 dark:bg-neutral-800/80">
              <div className="w-full flex items-center justify-center gap-1">
                <button 
                  onClick={() => handleSort("confidence")}
                  className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                >
                  Confidence <SortIcon field="confidence" currentField={sortField} direction={sortDirection} />
                </button>
              </div>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 min-w-[100px] bg-neutral-50 dark:bg-neutral-800/80">
              <button 
                onClick={() => handleSort("odds")}
                className="w-full flex items-center justify-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                Odds <SortIcon field="odds" currentField={sortField} direction={sortDirection} />
              </button>
            </th>
            <th className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 w-16 bg-neutral-50 dark:bg-neutral-800/80">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const rowBg = idx % 2 === 0 ? 'table-row-even' : 'table-row-odd';
            return (
            <tr 
              key={`${row.playerId}-${row.market}-${row.line}-${idx}`}
              className={cn(rowBg, "group hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors cursor-pointer")}
              onClick={() => onRowClick?.(row)}
            >
              {/* Player Column */}
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  {/* Player headshot with team color gradient */}
                  {(() => {
                    const hasInjury = hasInjuryStatus(row.injuryStatus);
                    const isGLeague = isGLeagueAssignment(row.injuryNotes);
                    const injuryTooltip = hasInjury
                      ? isGLeague
                        ? `G League${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                        : `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                      : "";

                    const headshotElement = (
                      <div 
                        className={cn(
                          "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-sm",
                          hasInjury && "cursor-pointer",
                          getStatusBorderClass(row.injuryStatus)
                        )}
                        style={{ 
                          background: row.primaryColor && row.secondaryColor 
                            ? `linear-gradient(180deg, ${row.primaryColor} 0%, ${row.primaryColor} 55%, ${row.secondaryColor} 100%)`
                            : row.primaryColor || "#6b7280"
                        }}
                      >
                        <PlayerHeadshot
                          nbaPlayerId={row.playerId}
                          name={row.playerName}
                          size="tiny"
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
                  
                  <div className="min-w-0">
                    {/* Player name with injury icon */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">
                        {row.playerName}
                      </span>
                      {/* Hot streak indicator */}
                      {row.hitStreak >= 5 && (
                        <Tooltip content={`${row.hitStreak} game hit streak 🔥`} side="top">
                          <Flame className="w-3.5 h-3.5 text-orange-500 cursor-help" />
                        </Tooltip>
                      )}
                      {/* B2B indicator */}
                      {row.isBackToBack && (
                        <Tooltip content="Back-to-back game" side="top">
                          <span className="text-[9px] font-bold bg-orange-500/10 text-orange-500 px-1 py-0.5 rounded cursor-help">B2B</span>
                        </Tooltip>
                      )}
                      {/* Injury icon */}
                      {hasInjuryStatus(row.injuryStatus) && (() => {
                        const isGLeague = isGLeagueAssignment(row.injuryNotes);
                        return (
                          <Tooltip 
                            content={isGLeague 
                              ? `G League${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                              : `${row.injuryStatus!.charAt(0).toUpperCase() + row.injuryStatus!.slice(1)}${row.injuryNotes ? ` - ${row.injuryNotes}` : ""}`
                            }
                            side="top"
                          >
                            {isGLeague ? (
                              <ArrowDown className="h-4 w-4 cursor-help text-blue-500" />
                            ) : (
                              <HeartPulse className={cn(
                                "h-4 w-4 cursor-help",
                                getInjuryIconColor(row.injuryStatus)
                              )} />
                            )}
                          </Tooltip>
                        );
                      })()}
                    </div>
                    
                    {/* Team logo, position, matchup */}
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                      {row.teamAbbr && (
                        <img
                          src={`/team-logos/nba/${row.teamAbbr.toUpperCase()}.svg`}
                          alt={row.teamAbbr}
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <Tooltip content={POSITION_LABELS[row.playerPosition] || row.playerPosition} side="top">
                        <span className="cursor-help">{row.playerPosition}</span>
                      </Tooltip>
                      <span className="text-neutral-300 dark:text-neutral-600">•</span>
                      <span>
                        {row.homeAway?.toUpperCase() === "H" ? "vs" : "@"} {row.opponentAbbr}
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              {/* Prop Column */}
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                    <span className="font-semibold text-neutral-900 dark:text-white">{row.line}+</span>
                    {MARKET_SHORT_LABELS[row.market] || row.market}
                  </span>
                </div>
              </td>

              {/* Hit Rates Column */}
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <HitRateDisplay 
                    l5={row.last5Pct} 
                    l10={row.last10Pct} 
                    l20={row.last20Pct} 
                    season={row.seasonPct}
                    timeWindow={timeWindow}
                  />
                </div>
              </td>

              {/* Average + Edge Column */}
              <td className="px-3 py-2 text-center">
                <div className="flex flex-col items-center">
                  <span className="font-medium text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {row.avgStat?.toFixed(1) ?? "—"}
                  </span>
                  {(() => {
                    const edge = row.edge ?? (row.avgStat != null ? row.avgStat - row.line : null);
                    if (edge == null) return null;
                    const isPositive = edge >= 0;
                    return (
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                      )}>
                        {isPositive ? "+" : ""}{edge.toFixed(1)}
                      </span>
                    );
                  })()}
                </div>
              </td>

              {/* DvP Column */}
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <DvpBadge rank={row.dvpRank} position={row.playerPosition} />
                </div>
              </td>

              {/* Confidence Column */}
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <ConfidenceBadge 
                    grade={row.confidenceGrade} 
                    score={row.confidenceScore}
                  />
                </div>
              </td>

              {/* Odds Column - Live from Redis with Dropdown */}
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <OddsDropdownCell 
                    odds={getLiveOdds(row)} 
                    line={row.line}
                    isLive={getLiveOdds(row)?.live}
                  />
                </div>
              </td>

              {/* Action Column */}
              <td className="px-2 py-2">
                <div className="flex justify-center">
                  <Tooltip content="Favorites coming soon" side="left">
                    <button
                      disabled
                      className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 opacity-50 cursor-not-allowed hover:opacity-70 transition-opacity"
                    >
                      <Heart className="w-4 h-4 text-neutral-400" />
                    </button>
                  </Tooltip>
                </div>
              </td>
            </tr>
          );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


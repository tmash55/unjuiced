import { useState, useMemo, useEffect } from "react";
import { DvpTeamRanking } from "@/hooks/use-dvp-rankings";
import { cn } from "@/lib/utils";
import { DvpViewMode } from "./dvp-filters";
import { ArrowUp, ArrowDown, Minus, ChevronsUpDown, ChevronUp, ChevronDown, Info } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export type SortDirection = "asc" | "desc";
export type SortField = keyof DvpTeamRanking;

interface DvpTableProps {
  data: DvpTeamRanking[];
  viewMode: DvpViewMode;
  isLoading: boolean;
  onTeamClick: (teamId: number) => void;
}

// Helper: Format number
const fmt = (val: number | null, decimals = 1) => 
  val === null ? "—" : val.toFixed(decimals);

// Helper: Format percent
const fmtPct = (val: number | null) => 
  val === null ? "—" : `${(val * 100).toFixed(1)}%`;

// Helper: Get cell background color based on rank
const getRankBg = (rank: number | null) => {
  if (rank === null) return "";
  if (rank <= 5) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold"; 
  if (rank <= 10) return "bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400"; 
  if (rank >= 26) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold"; 
  if (rank >= 21) return "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400"; 
  return "text-neutral-600 dark:text-neutral-400"; 
};

// Helper: Get trend color/icon
const getTrend = (current: number | null, l5: number | null, inverse = false) => {
  if (current === null || l5 === null) return null;
  const diff = l5 - current;
  const pctDiff = (diff / current) * 100;
  
  if (Math.abs(pctDiff) < 5) return <Minus className="w-3 h-3 text-neutral-400" />;
  
  if (diff > 0) {
    return inverse 
      ? <ArrowDown className="w-3 h-3 text-emerald-500" /> 
      : <ArrowUp className="w-3 h-3 text-red-500" />; 
  }
  
  return inverse
    ? <ArrowUp className="w-3 h-3 text-red-500" />
    : <ArrowDown className="w-3 h-3 text-emerald-500" />;
};

// Default sort fields per view mode
const DEFAULT_SORTS: Record<DvpViewMode, SortField> = {
  basic: "ptsAvg",
  advanced: "fgPct",
  combo: "praAvg",
  trends: "l5PtsAvg",
};

export function DvpTable({ data, viewMode, isLoading, onTeamClick }: DvpTableProps) {
  // Store sort state for each view mode independently
  const [sortState, setSortState] = useState<Record<DvpViewMode, { field: SortField; direction: SortDirection }>>({
    basic: { field: "ptsAvg", direction: "desc" },
    advanced: { field: "fgPct", direction: "desc" },
    combo: { field: "praAvg", direction: "desc" },
    trends: { field: "l5PtsAvg", direction: "desc" },
  });

  // Get current sort based on active view mode
  const { field: sortField, direction: sortDirection } = sortState[viewMode];

  const handleSort = (field: SortField) => {
    setSortState(prev => {
      const currentSort = prev[viewMode];
      const isSameField = currentSort.field === field;
      
      let newDirection: SortDirection = "desc";
      if (isSameField) {
        newDirection = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        // Default sort direction logic:
        // Ranks: asc (1 is best/worst depending on context)
        // Stats: desc (highest first)
        if (field.toLowerCase().includes("rank")) {
          newDirection = "asc";
        } else {
          newDirection = "desc";
        }
      }

      return {
        ...prev,
        [viewMode]: { field, direction: newDirection }
      };
    });
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      // String sorting (for teamAbbr)
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [data, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3 text-brand" />
      : <ChevronDown className="h-3 w-3 text-brand" />;
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const renderHeaderCell = (label: string, field: SortField, tooltip?: string, className?: string) => (
    <th
      onClick={() => handleSort(field)}
      className={cn(
        "h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors group",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        <div className="flex items-center gap-1">
          {label}
          {tooltip && (
            <Tooltip content={tooltip}>
              <Info className="h-3 w-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300" />
            </Tooltip>
          )}
        </div>
        <SortIcon field={field} />
      </div>
    </th>
  );

  const renderColumns = (team: DvpTeamRanking) => {
    switch (viewMode) {
      case "basic":
        return (
          <>
            <td className={cn("px-3 py-4 text-center text-sm font-medium", getRankBg(team.ptsRank))}>{fmt(team.ptsAvg)}</td>
            <td className={cn("px-3 py-4 text-center text-sm font-medium", getRankBg(team.rebRank))}>{fmt(team.rebAvg)}</td>
            <td className={cn("px-3 py-4 text-center text-sm font-medium", getRankBg(team.astRank))}>{fmt(team.astAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.fg3mAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.stlAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.blkAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.tovAvg)}</td>
          </>
        );
      case "advanced":
        return (
          <>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmtPct(team.fgPct)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmtPct(team.fg3Pct)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.minutesAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-mono text-neutral-400">—</td>
            <td className="px-3 py-4 text-center text-sm font-mono text-neutral-400">—</td>
          </>
        );
      case "combo":
        return (
          <>
            <td className={cn("px-3 py-4 text-center text-sm font-bold border-r border-neutral-100 dark:border-neutral-800", getRankBg(team.praRank))}>{fmt(team.praAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.prAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.paAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.raAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmt(team.bsAvg)}</td>
            <td className="px-3 py-4 text-center text-sm font-medium text-neutral-900 dark:text-white">{fmtPct(team.dd2Pct)}</td>
          </>
        );
      case "trends":
        return (
          <>
            <td className="px-3 py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-white">
                {fmt(team.l5PtsAvg)}
                {getTrend(team.ptsAvg, team.l5PtsAvg)}
              </div>
            </td>
            <td className="px-3 py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-white">
                {fmt(team.l5RebAvg)}
                {getTrend(team.rebAvg, team.l5RebAvg)}
              </div>
            </td>
            <td className="px-3 py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-white">
                {fmt(team.l5AstAvg)}
                {getTrend(team.astAvg, team.l5AstAvg)}
              </div>
            </td>
            <td className="px-3 py-4 text-center bg-neutral-50/50 dark:bg-neutral-800/20">
              <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-white">
                {fmt(team.l5PraAvg)}
                {getTrend(team.praAvg, team.l5PraAvg)}
              </div>
            </td>
            <td className="px-3 py-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-900 dark:text-white">
                {fmt(team.l5Fg3mAvg)}
                {getTrend(team.fg3mAvg, team.l5Fg3mAvg)}
              </div>
            </td>
          </>
        );
    }
  };

  const renderHeaders = () => {
    switch (viewMode) {
      case "basic":
        return (
          <>
            {renderHeaderCell("PTS", "ptsAvg")}
            {renderHeaderCell("REB", "rebAvg")}
            {renderHeaderCell("AST", "astAvg")}
            {renderHeaderCell("3PM", "fg3mAvg")}
            {renderHeaderCell("STL", "stlAvg")}
            {renderHeaderCell("BLK", "blkAvg")}
            {renderHeaderCell("TO", "tovAvg")}
          </>
        );
      case "advanced":
        return (
          <>
            {renderHeaderCell("FG%", "fgPct")}
            {renderHeaderCell("3P%", "fg3Pct")}
            {renderHeaderCell("MIN", "minutesAvg")}
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">USG%</th>
            <th className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">DEFRTG</th>
          </>
        );
      case "combo":
        return (
          <>
            {renderHeaderCell("PRA", "praAvg", "Points + Rebounds + Assists", "text-brand border-r border-neutral-200 dark:border-neutral-800")}
            {renderHeaderCell("P+R", "prAvg", "Points + Rebounds")}
            {renderHeaderCell("P+A", "paAvg", "Points + Assists")}
            {renderHeaderCell("R+A", "raAvg", "Rebounds + Assists")}
            {renderHeaderCell("BLK+STL", "bsAvg", "Blocks + Steals (Stocks)")}
            {renderHeaderCell("DD%", "dd2Pct", "Double-Double Allowed %")}
          </>
        );
      case "trends":
        return (
          <>
            {renderHeaderCell("L5 PTS", "l5PtsAvg", "Last 5 Games Points Allowed")}
            {renderHeaderCell("L5 REB", "l5RebAvg", "Last 5 Games Rebounds Allowed")}
            {renderHeaderCell("L5 AST", "l5AstAvg", "Last 5 Games Assists Allowed")}
            {renderHeaderCell("L5 PRA", "l5PraAvg", "Last 5 Games PRA Allowed", "text-brand bg-neutral-50 dark:bg-neutral-900")}
            {renderHeaderCell("L5 3PM", "l5Fg3mAvg", "Last 5 Games 3PM Allowed")}
          </>
        );
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {/* Fixed Team Column */}
            <th className="sticky left-0 z-20 h-12 w-[240px] px-4 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
              <div 
                className="flex items-center gap-1.5 cursor-pointer group"
                onClick={() => handleSort("teamAbbr")}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">Team</span>
                <SortIcon field="teamAbbr" />
              </div>
            </th>
            {/* GP Column */}
            {renderHeaderCell("GP", "games", undefined, "w-16")}
            {/* Dynamic Columns */}
            {renderHeaders()}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {sortedData.map((team) => (
            <tr 
              key={team.teamId}
              onClick={() => onTeamClick(team.teamId)}
              className="group hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-all cursor-pointer"
            >
              {/* Fixed Team Column */}
              <td className="sticky left-0 z-10 w-[240px] px-4 py-3 bg-white dark:bg-neutral-900 group-hover:bg-neutral-50/80 dark:group-hover:bg-neutral-800/50 border-r border-neutral-100 dark:border-neutral-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 shrink-0 flex items-center justify-center rounded bg-neutral-100 dark:bg-neutral-800">
                    <img 
                      src={`/team-logos/nba/${team.teamAbbr}.svg`}
                      alt={team.teamAbbr}
                      className="h-6 w-6 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-neutral-900 dark:text-white truncate leading-none">{team.teamName}</span>
                  </div>
                </div>
              </td>

              {/* Games Played */}
              <td className="px-3 py-4 text-center text-sm font-medium text-neutral-500 tabular-nums">
                {team.games}
              </td>

              {/* Dynamic Stats */}
              {renderColumns(team)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

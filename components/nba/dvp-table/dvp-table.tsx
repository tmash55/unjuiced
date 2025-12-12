import { useState, useMemo } from "react";
import { DvpTeamRanking, DvpSampleSize } from "@/hooks/use-dvp-rankings";
import { cn } from "@/lib/utils";
import { DvpViewMode, TrendCompareBaseline, TrendStat } from "./dvp-filters";
import { ChevronsUpDown, ChevronUp, ChevronDown, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export type SortDirection = "asc" | "desc";
export type SortField = keyof DvpTeamRanking;
export type DvpDisplayMode = "values" | "ranks";

interface DvpTableProps {
  data: DvpTeamRanking[];
  viewMode: DvpViewMode;
  sampleSize: DvpSampleSize;
  displayMode: DvpDisplayMode;
  trendBaseline: TrendCompareBaseline;
  trendStat: TrendStat;
  isLoading: boolean;
  onTeamClick: (teamId: number) => void;
}

// Helper: Format number
const fmt = (val: number | null | undefined, decimals = 1) => 
  val == null ? "—" : val.toFixed(decimals);

// Helper: Format percent
const fmtPct = (val: number | null | undefined) => {
  if (val == null) return "—";
  const pctVal = val > 1 ? val : val * 100;
  return `${pctVal.toFixed(1)}%`;
};

// Helper: Format rank display
const fmtRank = (rank: number | null | undefined) => 
  rank == null ? "—" : `#${rank}`;

// Helper: Format delta with sign
const fmtDelta = (delta: number | null | undefined) => {
  if (delta == null) return "—";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
};

// Helper: Get cell background color based on rank
const getRankBg = (rank: number | null | undefined) => {
  if (rank == null) return "";
  if (rank <= 5) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold"; 
  if (rank <= 10) return "bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400"; 
  if (rank >= 26) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold"; 
  if (rank >= 21) return "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400"; 
  return "text-neutral-600 dark:text-neutral-400"; 
};

// Helper: Get delta color classes
const getDeltaClasses = (delta: number | null | undefined) => {
  if (delta == null) return "text-neutral-400";
  if (delta >= 2) return "text-emerald-600 dark:text-emerald-400 font-bold";
  if (delta >= 0.5) return "text-emerald-500 dark:text-emerald-500";
  if (delta <= -2) return "text-red-600 dark:text-red-400 font-bold";
  if (delta <= -0.5) return "text-red-500 dark:text-red-500";
  return "text-neutral-500 dark:text-neutral-400";
};

// Get the field name based on sample size
const getSampleField = (baseName: string, sampleSize: DvpSampleSize): keyof DvpTeamRanking => {
  if (sampleSize === "season") return baseName as keyof DvpTeamRanking;
  const base = baseName.replace("Avg", "");
  return `${sampleSize}${base.charAt(0).toUpperCase()}${base.slice(1)}Avg` as keyof DvpTeamRanking;
};

// Get the rank field name based on sample size
const getSampleRankField = (baseRankName: string, sampleSize: DvpSampleSize): keyof DvpTeamRanking => {
  if (sampleSize === "season") return baseRankName as keyof DvpTeamRanking;
  // Convert "ptsRank" -> "l5PtsRank", "rebRank" -> "l5RebRank", etc.
  const base = baseRankName.replace("Rank", "");
  return `${sampleSize}${base.charAt(0).toUpperCase()}${base.slice(1)}Rank` as keyof DvpTeamRanking;
};

// Get stat field names for trends
const getStatFields = (stat: TrendStat) => {
  // Handle special cases for field naming
  const fieldMap: Record<TrendStat, { base: string; cap: string }> = {
    pts: { base: "pts", cap: "Pts" },
    reb: { base: "reb", cap: "Reb" },
    ast: { base: "ast", cap: "Ast" },
    pra: { base: "pra", cap: "Pra" },
    fg3m: { base: "fg3m", cap: "Fg3m" },
    stl: { base: "stl", cap: "Stl" },
    blk: { base: "blk", cap: "Blk" },
    tov: { base: "tov", cap: "Tov" },
    pr: { base: "pr", cap: "Pr" },
    pa: { base: "pa", cap: "Pa" },
    ra: { base: "ra", cap: "Ra" },
    bs: { base: "bs", cap: "Bs" },
    fga: { base: "fga", cap: "Fga" },
    fg3a: { base: "fg3a", cap: "Fg3a" },
    fta: { base: "fta", cap: "Fta" },
    minutes: { base: "minutes", cap: "Minutes" },
  };
  
  const { base, cap } = fieldMap[stat];
  
  return {
    season: `${base}Avg` as keyof DvpTeamRanking,
    seasonRank: `${base}Rank` as keyof DvpTeamRanking,
    l20: `l20${cap}Avg` as keyof DvpTeamRanking,
    l20Rank: `l20${cap}Rank` as keyof DvpTeamRanking,
    l15: `l15${cap}Avg` as keyof DvpTeamRanking,
    l15Rank: `l15${cap}Rank` as keyof DvpTeamRanking,
    l10: `l10${cap}Avg` as keyof DvpTeamRanking,
    l10Rank: `l10${cap}Rank` as keyof DvpTeamRanking,
    l5: `l5${cap}Avg` as keyof DvpTeamRanking,
    l5Rank: `l5${cap}Rank` as keyof DvpTeamRanking,
  };
};

export function DvpTable({ data, viewMode, sampleSize, displayMode, trendBaseline, trendStat, isLoading, onTeamClick }: DvpTableProps) {
  // Store sort state for each view mode independently
  // For trends, we use a special "delta" sort that computes L5 - Season
  const [sortState, setSortState] = useState<Record<DvpViewMode, { field: SortField | "delta"; direction: SortDirection }>>({
    basic: { field: "ptsAvg", direction: "desc" },
    advanced: { field: "fgPct", direction: "desc" },
    trends: { field: "delta", direction: "desc" }, // Default to delta (L5 vs Season)
  });

  // Update sort field when trendStat changes
  const statFields = getStatFields(trendStat);

  // Get current sort based on active view mode
  const { field: sortField, direction: sortDirection } = sortState[viewMode];

  const handleSort = (field: SortField | "delta") => {
    setSortState(prev => {
      const currentSort = prev[viewMode];
      const isSameField = currentSort.field === field;
      
      let newDirection: SortDirection = "desc";
      if (isSameField) {
        newDirection = currentSort.direction === "asc" ? "desc" : "asc";
      } else {
        if (typeof field === "string" && field.toLowerCase().includes("rank")) {
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

  // Get the value with sample size awareness
  const getValue = (team: DvpTeamRanking, field: string): number | null => {
    if (viewMode === "trends") {
      return team[field as keyof DvpTeamRanking] as number | null;
    }
    
    if (sampleSize !== "season" && (viewMode === "basic" || viewMode === "advanced")) {
      const sampleField = getSampleField(field, sampleSize);
      const value = team[sampleField];
      if (value !== undefined) return value as number | null;
    }
    
    return team[field as keyof DvpTeamRanking] as number | null;
  };

  const sortedData = useMemo(() => {
    // Handle special delta sorting for trends view
    if (viewMode === "trends" && sortField === "delta") {
      return [...data].sort((a, b) => {
        const seasonFieldA = a[statFields.season] as number | null;
        const l5FieldA = a[statFields.l5] as number | null;
        const seasonFieldB = b[statFields.season] as number | null;
        const l5FieldB = b[statFields.l5] as number | null;
        
        const deltaA = seasonFieldA !== null && l5FieldA !== null ? l5FieldA - seasonFieldA : null;
        const deltaB = seasonFieldB !== null && l5FieldB !== null ? l5FieldB - seasonFieldB : null;
        
        if (deltaA === null && deltaB === null) return 0;
        if (deltaA === null) return 1;
        if (deltaB === null) return -1;
        
        return sortDirection === "asc" ? deltaA - deltaB : deltaB - deltaA;
      });
    }

    let effectiveSortField = sortField as SortField;
    // Fields that don't have L5/L10/L15/L20 sample versions - always use season values
    const seasonOnlyFields = [
      "orebAvg", "drebAvg", "fgaAvg", "fg3aAvg", "fgPct", "fg3Pct", "ftPct", "ftaAvg"
    ];
    if (sampleSize !== "season" && (viewMode === "basic" || viewMode === "advanced")) {
      const baseField = sortField as string;
      if (
        baseField.endsWith("Avg") && 
        !baseField.startsWith("l5") && 
        !baseField.startsWith("l10") && 
        !baseField.startsWith("l15") && 
        !baseField.startsWith("l20") &&
        !seasonOnlyFields.includes(baseField)
      ) {
        effectiveSortField = getSampleField(baseField, sampleSize);
      }
    }

    return [...data].sort((a, b) => {
      const aVal = a[effectiveSortField];
      const bVal = b[effectiveSortField];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [data, sortField, sortDirection, sampleSize, viewMode, statFields]);

  const SortIcon = ({ field }: { field: SortField | "delta" }) => {
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
        "h-10 md:h-12 px-1.5 md:px-3 text-center text-[10px] md:text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors group",
        className
      )}
    >
      <div className="flex items-center justify-center gap-0.5 md:gap-1.5">
        <div className="flex items-center gap-0.5 md:gap-1">
          <span className="whitespace-nowrap">{label}</span>
          {tooltip && (
            <Tooltip content={tooltip}>
              <Info className="h-2.5 w-2.5 md:h-3 md:w-3 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hidden md:block" />
            </Tooltip>
          )}
        </div>
        <SortIcon field={field} />
      </div>
    </th>
  );

  // Base cell class for responsive padding
  const cellClass = "px-1.5 md:px-3 py-2 md:py-4 text-center text-xs md:text-sm font-medium tabular-nums";

  // Fields that don't have L5/L10/L15/L20 sample versions - always use season values
  const seasonOnlyRankFields = [
    "orebRank", "drebRank", "fgaRank", "fg3aRank", "fgPctRank", "fg3PctRank", "ftPctRank", "ftaRank"
  ];

  // Helper to get rank value based on sample size
  const getRank = (team: DvpTeamRanking, baseRankField: string): number | null | undefined => {
    // Skip sample-size conversion for fields that don't have it
    if (seasonOnlyRankFields.includes(baseRankField) || sampleSize === "season") {
      return team[baseRankField as keyof DvpTeamRanking] as number | null | undefined;
    }
    const rankField = getSampleRankField(baseRankField, sampleSize);
    const rankValue = team[rankField] as number | null | undefined;
    // Fallback to season rank if sample rank doesn't exist
    if (rankValue === undefined) {
      return team[baseRankField as keyof DvpTeamRanking] as number | null | undefined;
    }
    return rankValue;
  };

  const renderColumns = (team: DvpTeamRanking) => {
    const showRanks = displayMode === "ranks";
    
    switch (viewMode) {
      case "basic":
        return (
          <>
            <td className={cn(cellClass, getRankBg(getRank(team, "ptsRank")))}>
              {showRanks ? fmtRank(getRank(team, "ptsRank")) : fmt(getValue(team, "ptsAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "rebRank")))}>
              {showRanks ? fmtRank(getRank(team, "rebRank")) : fmt(getValue(team, "rebAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "astRank")))}>
              {showRanks ? fmtRank(getRank(team, "astRank")) : fmt(getValue(team, "astAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "fg3mRank")))}>
              {showRanks ? fmtRank(getRank(team, "fg3mRank")) : fmt(getValue(team, "fg3mAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "ftaRank")))}>
              {showRanks ? fmtRank(getRank(team, "ftaRank")) : fmt(getValue(team, "ftaAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "stlRank")))}>
              {showRanks ? fmtRank(getRank(team, "stlRank")) : fmt(getValue(team, "stlAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "blkRank")))}>
              {showRanks ? fmtRank(getRank(team, "blkRank")) : fmt(getValue(team, "blkAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "tovRank")))}>
              {showRanks ? fmtRank(getRank(team, "tovRank")) : fmt(getValue(team, "tovAvg"))}
            </td>
          </>
        );
      case "advanced":
        return (
          <>
            {/* Shooting stats - season rank only (no L5/L10/L15/L20 ranks available) */}
            <td className={cn(cellClass, getRankBg(team.fgPctRank))}>
              {showRanks ? fmtRank(team.fgPctRank) : fmtPct(team.fgPct)}
            </td>
            <td className={cn(cellClass, getRankBg(team.fgaRank))}>
              {showRanks ? fmtRank(team.fgaRank) : fmt(team.fgaAvg)}
            </td>
            <td className={cn(cellClass, getRankBg(team.fg3PctRank))}>
              {showRanks ? fmtRank(team.fg3PctRank) : fmtPct(team.fg3Pct)}
            </td>
            <td className={cn(cellClass, getRankBg(team.fg3aRank))}>
              {showRanks ? fmtRank(team.fg3aRank) : fmt(team.fg3aAvg)}
            </td>
            <td className={cn(cellClass, getRankBg(team.orebRank))}>
              {showRanks ? fmtRank(team.orebRank) : fmt(team.orebAvg)}
            </td>
            <td className={cn(cellClass, getRankBg(team.drebRank))}>
              {showRanks ? fmtRank(team.drebRank) : fmt(team.drebAvg)}
            </td>
            {/* Combo stats - use sample-size-aware ranks */}
            <td className={cn(cellClass, getRankBg(getRank(team, "praRank")))}>
              {showRanks ? fmtRank(getRank(team, "praRank")) : fmt(getValue(team, "praAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "prRank")))}>
              {showRanks ? fmtRank(getRank(team, "prRank")) : fmt(getValue(team, "prAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "paRank")))}>
              {showRanks ? fmtRank(getRank(team, "paRank")) : fmt(getValue(team, "paAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "raRank")))}>
              {showRanks ? fmtRank(getRank(team, "raRank")) : fmt(getValue(team, "raAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(getRank(team, "bsRank")))}>
              {showRanks ? fmtRank(getRank(team, "bsRank")) : fmt(getValue(team, "bsAvg"))}
            </td>
            <td className={cn(cellClass, getRankBg(team.dd2PctRank))}>
              {showRanks ? fmtRank(team.dd2PctRank) : fmtPct(team.dd2Pct)}
            </td>
          </>
        );
      case "trends": {
        const seasonVal = team[statFields.season] as number | null;
        const seasonRank = team[statFields.seasonRank] as number | null;
        const l20Val = team[statFields.l20] as number | null;
        const l20Rank = team[statFields.l20Rank] as number | null;
        const l15Val = team[statFields.l15] as number | null;
        const l15Rank = team[statFields.l15Rank] as number | null;
        const l10Val = team[statFields.l10] as number | null;
        const l10Rank = team[statFields.l10Rank] as number | null;
        const l5Val = team[statFields.l5] as number | null;
        const l5Rank = team[statFields.l5Rank] as number | null;
        
        // Calculate delta based on display mode
        // For averages: L5 - Season (positive = allowing more = defense worse = good for player)
        // For ranks: L5 - Season (positive = higher rank = weaker defense = good for player)
        const deltaAvg = seasonVal !== null && l5Val !== null ? l5Val - seasonVal : null;
        const deltaRank = seasonRank !== null && l5Rank !== null ? l5Rank - seasonRank : null;
        const delta = showRanks ? deltaRank : deltaAvg;
        
        // Trend icon - for both avg and rank, positive delta = good (green), negative = bad (red)
        const getTrendIcon = () => {
          if (delta === null) return null;
          const threshold = showRanks ? 2 : 1; // Use different threshold for ranks
          if (delta >= threshold) return <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-500" />;
          if (delta <= -threshold) return <TrendingDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-red-500" />;
          return <Minus className="w-3 h-3 md:w-3.5 md:h-3.5 text-neutral-400" />;
        };
        
        // Get delta background color
        const getDeltaBg = (d: number | null) => {
          if (d === null) return "";
          const strongThreshold = showRanks ? 5 : 3;
          const weakThreshold = showRanks ? 2 : 1;
          if (d >= strongThreshold) return "bg-emerald-100 dark:bg-emerald-900/30";
          if (d >= weakThreshold) return "bg-emerald-50 dark:bg-emerald-900/15";
          if (d <= -strongThreshold) return "bg-red-100 dark:bg-red-900/30";
          if (d <= -weakThreshold) return "bg-red-50 dark:bg-red-900/15";
          return "";
        };
        
        // Format delta - show integer for ranks, decimal for averages
        const formatDelta = (d: number | null) => {
          if (d === null) return "—";
          const sign = d >= 0 ? "+" : "";
          return showRanks ? `${sign}${d}` : `${sign}${d.toFixed(1)}`;
        };
        
        return (
          <>
            {/* Season */}
            <td className={cn(cellClass, getRankBg(seasonRank))}>
              {showRanks ? fmtRank(seasonRank) : fmt(seasonVal)}
            </td>
            
            {/* L20 */}
            <td className={cn(cellClass, getRankBg(showRanks ? l20Rank : seasonRank))}>
              {showRanks ? fmtRank(l20Rank) : fmt(l20Val)}
            </td>
            
            {/* L15 */}
            <td className={cn(cellClass, getRankBg(showRanks ? l15Rank : seasonRank))}>
              {showRanks ? fmtRank(l15Rank) : fmt(l15Val)}
            </td>
            
            {/* L10 */}
            <td className={cn(cellClass, getRankBg(showRanks ? l10Rank : seasonRank))}>
              {showRanks ? fmtRank(l10Rank) : fmt(l10Val)}
            </td>
            
            {/* L5 */}
            <td className={cn(cellClass, "font-bold", getRankBg(showRanks ? l5Rank : seasonRank))}>
              {showRanks ? fmtRank(l5Rank) : fmt(l5Val)}
            </td>
            
            {/* Delta with trend icon */}
            <td className={cn("px-1.5 md:px-3 py-2 md:py-4", getDeltaBg(delta))}>
              <div className="flex items-center justify-center gap-1 md:gap-1.5">
                {getTrendIcon()}
                <span className={cn("text-xs md:text-sm font-bold tabular-nums", getDeltaClasses(delta))}>
                  {formatDelta(delta)}
                </span>
              </div>
            </td>
          </>
        );
      }
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
            {renderHeaderCell("FTA", "ftaAvg", "Free Throw Attempts Allowed")}
            {renderHeaderCell("STL", "stlAvg")}
            {renderHeaderCell("BLK", "blkAvg")}
            {renderHeaderCell("TO", "tovAvg")}
          </>
        );
      case "advanced":
        return (
          <>
            {renderHeaderCell("FG%", "fgPct", "Field Goal % Allowed")}
            {renderHeaderCell("FGA", "fgaAvg", "Field Goal Attempts Allowed")}
            {renderHeaderCell("3P%", "fg3Pct", "3-Point % Allowed")}
            {renderHeaderCell("3PA", "fg3aAvg", "3-Point Attempts Allowed")}
            {renderHeaderCell("OREB", "orebAvg", "Offensive Rebounds Allowed")}
            {renderHeaderCell("DREB", "drebAvg", "Defensive Rebounds Allowed")}
            {renderHeaderCell("PRA", "praAvg", "Points + Rebounds + Assists")}
            {renderHeaderCell("P+R", "prAvg", "Points + Rebounds")}
            {renderHeaderCell("P+A", "paAvg", "Points + Assists")}
            {renderHeaderCell("R+A", "raAvg", "Rebounds + Assists")}
            {renderHeaderCell("BLK+STL", "bsAvg", "Blocks + Steals")}
            {renderHeaderCell("DD%", "dd2Pct", "Double-Double Allowed %")}
          </>
        );
      case "trends":
        return (
          <>
            {renderHeaderCell("Season", statFields.season, "Full season average")}
            {renderHeaderCell("L20", statFields.l20, "Last 20 games average")}
            {renderHeaderCell("L15", statFields.l15, "Last 15 games average")}
            {renderHeaderCell("L10", statFields.l10, "Last 10 games average")}
            {renderHeaderCell("L5", statFields.l5, "Last 5 games average")}
            <th 
              onClick={() => handleSort("delta")}
              className="h-12 px-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 select-none transition-colors"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Tooltip content="Difference between L5 and Season average. Positive = defense getting worse (good for overs)">
                  <span className="cursor-help">Δ L5 vs SZN</span>
                </Tooltip>
                <SortIcon field="delta" />
              </div>
            </th>
          </>
        );
    }
  };

  return (
    <div className="w-full overflow-auto max-h-[70vh] md:max-h-[70vh]">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr className="shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            <th className="sticky left-0 z-20 h-10 md:h-12 w-[120px] md:w-[200px] px-2 md:px-4 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
              <div 
                className="flex items-center gap-1 cursor-pointer group"
                onClick={() => handleSort("teamAbbr")}
              >
                <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">Team</span>
                <SortIcon field="teamAbbr" />
              </div>
            </th>
            {renderHeaderCell("GP", "games", undefined, "w-10 md:w-16")}
            {renderHeaders()}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {sortedData.map((team) => (
            <tr 
              key={team.teamId}
              onClick={() => onTeamClick(team.teamId)}
              className="group hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-all cursor-pointer active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              <td className="sticky left-0 z-10 w-[120px] md:w-[200px] px-2 md:px-4 py-2 md:py-3 bg-white dark:bg-neutral-900 group-hover:bg-neutral-50/80 dark:group-hover:bg-neutral-800/50 border-r border-neutral-200 dark:border-neutral-700 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-all">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="relative h-6 w-6 md:h-8 md:w-8 shrink-0 flex items-center justify-center">
                    <img 
                      src={`/team-logos/nba/${team.teamAbbr}.svg`}
                      alt={team.teamAbbr}
                      className="h-5 w-5 md:h-7 md:w-7 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    {/* Show abbreviation on mobile, full name on desktop */}
                    <span className="font-bold text-xs md:text-sm text-neutral-900 dark:text-white truncate leading-none md:hidden">{team.teamAbbr}</span>
                    <span className="font-bold text-sm text-neutral-900 dark:text-white truncate leading-none hidden md:block">{team.teamName}</span>
                  </div>
                </div>
              </td>

              <td className="px-1.5 md:px-3 py-2 md:py-4 text-center text-xs md:text-sm font-medium text-neutral-500 tabular-nums">
                {team.games}
              </td>

              {renderColumns(team)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

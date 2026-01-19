"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, HeartPulse, TrendingUp, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { 
  useAvailableTeammates, 
  useTeammateOutStats,
  getStatBoostColor,
  getHitRateColor,
  AvailableTeammate,
  TeammateOutStats 
} from "@/hooks/use-injury-impact";
import { formatMarketLabel } from "@/lib/data/markets";

interface InjuryImpactCardProps {
  playerId: number;
  market: string;
  line: number;
  teamId: number;
  className?: string;
}

// Get injury status color
const getInjuryStatusColor = (status: string | null) => {
  if (!status) return "text-neutral-400";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-neutral-400";
};

// Get injury badge styling
const getInjuryBadgeClass = (status: string | null) => {
  if (!status) return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  const s = status.toLowerCase();
  if (s === "out") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (s === "questionable" || s === "gtd" || s === "game time decision") 
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s === "probable") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
};

// Format boost value with + sign
const formatBoost = (value: number | null | undefined, decimals = 1) => {
  if (value === null || value === undefined) return "—";
  const formatted = value.toFixed(decimals);
  return value > 0 ? `+${formatted}` : formatted;
};

// Teammate Impact Card (shown when expanded)
function TeammateImpactDetail({
  teammate,
  stats,
  isLoading,
  market,
}: {
  teammate: AvailableTeammate;
  stats: TeammateOutStats | null;
  isLoading: boolean;
  market: string;
}) {
  const statusLabel = teammate.currentInjuryStatus?.toUpperCase() || "INJURED";
  
  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800/50 overflow-hidden">
      {/* Teammate Header */}
      <div className="flex items-center gap-3 p-3 border-b border-neutral-100 dark:border-neutral-700/50">
        <PlayerHeadshot
          nbaPlayerId={teammate.teammateId}
          name={teammate.teammateName}
          size="small"
          className="ring-2 ring-neutral-200 dark:ring-neutral-700"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
              {teammate.teammateName}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
              getInjuryBadgeClass(teammate.currentInjuryStatus)
            )}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <span>{teammate.teammatePosition}</span>
            <span>·</span>
            <span>{teammate.avgMinutes.toFixed(0)} min/g</span>
            <span>·</span>
            <span>{teammate.avgPts.toFixed(1)} pts</span>
          </div>
        </div>
      </div>
      
      {/* Stats When Out */}
      <div className="p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-neutral-300 border-t-brand rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              When {teammate.teammateName.split(" ").pop()} is out:
            </p>
            
            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Usage Boost */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500">Usage</p>
                  <p className={cn("text-sm font-bold", getStatBoostColor(stats.usageBoost))}>
                    {formatBoost(stats.usageBoost)}%
                  </p>
                </div>
              </div>
              
              {/* Minutes Boost */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500">Minutes</p>
                  <p className={cn("text-sm font-bold", getStatBoostColor(stats.minutesBoost))}>
                    {formatBoost(stats.minutesBoost)}
                  </p>
                </div>
              </div>
              
              {/* Stat Boost (market-specific) */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500">{formatMarketLabel(market)}</p>
                  <p className={cn("text-sm font-bold", getStatBoostColor(stats.statBoost))}>
                    {formatBoost(stats.statBoost)}
                  </p>
                </div>
              </div>
              
              {/* Hit Rate */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <Target className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[9px] text-neutral-500">Hit Rate</p>
                  <p className={cn("text-sm font-bold", getHitRateColor(stats.hitRate))}>
                    {stats.hitRate !== null ? `${Math.round(stats.hitRate)}%` : "—"}
                    <span className="text-[10px] font-normal text-neutral-400 ml-1">
                      ({stats.hits}/{stats.games})
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Average comparison */}
            <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/50 text-[11px] text-neutral-500">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {stats.avgStat.toFixed(1)}
              </span>
              {" avg vs "}
              <span className="text-neutral-400">
                {stats.avgStatOverall.toFixed(1)} overall
              </span>
              {" · "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {stats.avgMinutes.toFixed(0)}
              </span>
              {" min vs "}
              <span className="text-neutral-400">
                {stats.avgMinutesOverall.toFixed(0)} overall
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400 text-center py-2">
            No historical data available
          </p>
        )}
      </div>
    </div>
  );
}

export function InjuryImpactCard({
  playerId,
  market,
  line,
  teamId,
  className,
}: InjuryImpactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTeammateId, setSelectedTeammateId] = useState<number | null>(null);
  
  // Fetch available teammates
  const { teammates, isLoading: teammatesLoading } = useAvailableTeammates(
    playerId,
    market,
    true
  );
  
  // Filter to only show injured/GTD teammates
  const injuredTeammates = useMemo(() => {
    return teammates.filter(t => t.isCurrentlyInjured);
  }, [teammates]);
  
  // Select first injured teammate by default when data loads
  React.useEffect(() => {
    if (injuredTeammates.length > 0 && selectedTeammateId === null) {
      setSelectedTeammateId(injuredTeammates[0].teammateId);
    }
  }, [injuredTeammates, selectedTeammateId]);
  
  // Fetch stats for selected teammate
  const { stats, isLoading: statsLoading } = useTeammateOutStats({
    playerId,
    teammateIds: selectedTeammateId ? [selectedTeammateId] : [],
    market,
    line,
    enabled: isExpanded && selectedTeammateId !== null,
  });
  
  // Calculate summary for collapsed view
  const summary = useMemo(() => {
    const outCount = injuredTeammates.filter(t => 
      t.currentInjuryStatus?.toLowerCase() === "out"
    ).length;
    const gtdCount = injuredTeammates.filter(t => {
      const s = t.currentInjuryStatus?.toLowerCase();
      return s === "questionable" || s === "gtd" || s === "game time decision";
    }).length;
    
    const names = injuredTeammates.slice(0, 2).map(t => {
      const lastName = t.teammateName.split(" ").pop();
      return `${lastName} (${t.currentInjuryStatus?.toUpperCase() || "OUT"})`;
    });
    
    return { outCount, gtdCount, names, total: injuredTeammates.length };
  }, [injuredTeammates]);
  
  // Don't render if no injured teammates
  if (!teammatesLoading && injuredTeammates.length === 0) {
    return null;
  }
  
  const selectedTeammate = injuredTeammates.find(t => t.teammateId === selectedTeammateId);
  
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5",
        className
      )}
    >
      {/* Header - Clickable */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left relative overflow-hidden group"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-red-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-red-900/10 group-hover:from-neutral-50 dark:group-hover:from-neutral-700/80 transition-colors" />
        
        {/* Content */}
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500 shadow-sm shadow-red-500/30" />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <HeartPulse className="h-4 w-4 text-red-500" />
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    Injury Impact
                  </h2>
                  {summary.total > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                      {summary.total}
                    </span>
                  )}
                </div>
                
                {/* Summary when collapsed */}
                {teammatesLoading ? (
                  <p className="text-xs text-neutral-400 mt-0.5">Loading...</p>
                ) : summary.total > 0 ? (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-neutral-500">
                      {summary.names.join(" · ")}
                      {summary.total > 2 && ` +${summary.total - 2} more`}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            
            {/* Collapse/Expand Indicator */}
            <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-all">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
          </div>
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Teammate Selector Tabs */}
          {injuredTeammates.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {injuredTeammates.map((teammate) => {
                const isSelected = teammate.teammateId === selectedTeammateId;
                return (
                  <button
                    key={teammate.teammateId}
                    type="button"
                    onClick={() => setSelectedTeammateId(teammate.teammateId)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap transition-all",
                      isSelected
                        ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
                        : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    )}
                  >
                    <PlayerHeadshot
                      nbaPlayerId={teammate.teammateId}
                      name={teammate.teammateName}
                      size="tiny"
                    />
                    <div className="text-left">
                      <p className={cn(
                        "text-xs font-semibold",
                        isSelected ? "text-red-700 dark:text-red-300" : "text-neutral-700 dark:text-neutral-300"
                      )}>
                        {teammate.teammateName.split(" ").pop()}
                      </p>
                      <p className={cn(
                        "text-[9px]",
                        getInjuryStatusColor(teammate.currentInjuryStatus)
                      )}>
                        {teammate.currentInjuryStatus?.toUpperCase() || "OUT"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Selected Teammate Details */}
          {selectedTeammate && (
            <TeammateImpactDetail
              teammate={selectedTeammate}
              stats={stats}
              isLoading={statsLoading}
              market={market}
            />
          )}
        </div>
      )}
    </div>
  );
}

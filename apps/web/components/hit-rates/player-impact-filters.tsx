"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  usePlayersOutForFilter,
  usePlayerGamesWithInjuries,
  calculateGameAverages,
  filterGamesByPlayerAvailability,
  PlayerOutInfo,
  GameWithInjuries,
} from "@/hooks/use-injury-context";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { HeartPulse, TrendingUp, TrendingDown, Minus, Users, UserX, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/tooltip";

// Filter selection for a player
export type ImpactFilterMode = "with" | "without" | null;

export interface ImpactFilter {
  playerId: number;
  playerName: string;
  isTeammate: boolean;
  mode: ImpactFilterMode;
}

interface PlayerImpactFiltersProps {
  playerId: number | null;
  teamId: number | null;
  season?: string;
  filters: ImpactFilter[];
  onFiltersChange: (filters: ImpactFilter[]) => void;
  className?: string;
}

// Stat comparison display
function StatComparison({
  label,
  withValue,
  withoutValue,
  market,
}: {
  label: string;
  withValue: number;
  withoutValue: number;
  market?: string;
}) {
  const diff = withoutValue - withValue;
  const isPositive = diff > 0;
  const isNeutral = Math.abs(diff) < 0.5;

  // Highlight if this is the current market
  const isCurrentMarket = market === label.toLowerCase();

  return (
    <div className={cn(
      "flex items-center justify-between py-1.5 px-2 rounded",
      isCurrentMarket && "bg-brand/5"
    )}>
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-neutral-900 dark:text-white w-10 text-right">
          {withValue.toFixed(1)}
        </span>
        <span className="text-neutral-300 dark:text-neutral-600">→</span>
        <span className={cn(
          "text-xs font-semibold w-10 text-right",
          isNeutral && "text-neutral-500",
          !isNeutral && isPositive && "text-emerald-600 dark:text-emerald-400",
          !isNeutral && !isPositive && "text-red-600 dark:text-red-400"
        )}>
          {withoutValue.toFixed(1)}
        </span>
        {!isNeutral && (
          <span className={cn(
            "text-[10px] font-medium w-12 text-right",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {isPositive ? "+" : ""}{diff.toFixed(1)}
          </span>
        )}
        {isNeutral && (
          <span className="text-[10px] font-medium w-12 text-right text-neutral-400">
            —
          </span>
        )}
      </div>
    </div>
  );
}

// Individual player row in the filter list
function PlayerFilterRow({
  player,
  isTeammate,
  filter,
  onFilterChange,
  games,
  expanded,
  onToggleExpand,
}: {
  player: PlayerOutInfo;
  isTeammate: boolean;
  filter: ImpactFilter | undefined;
  onFilterChange: (playerId: number, isTeammate: boolean, mode: ImpactFilterMode) => void;
  games: GameWithInjuries[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const isWithChecked = filter?.mode === "with";
  const isWithoutChecked = filter?.mode === "without";

  // Calculate comparison stats when filter is active
  const comparisonStats = useMemo(() => {
    if (!isWithoutChecked || games.length === 0) return null;

    const gamesWithPlayer = filterGamesByPlayerAvailability(games, player.player_id, "with", isTeammate);
    const gamesWithoutPlayer = filterGamesByPlayerAvailability(games, player.player_id, "without", isTeammate);

    if (gamesWithPlayer.length === 0 || gamesWithoutPlayer.length === 0) return null;

    return {
      with: calculateGameAverages(gamesWithPlayer),
      without: calculateGameAverages(gamesWithoutPlayer),
    };
  }, [games, player.player_id, isTeammate, isWithoutChecked]);

  const handleWithChange = (checked: boolean) => {
    onFilterChange(player.player_id, isTeammate, checked ? "with" : null);
  };

  const handleWithoutChange = (checked: boolean) => {
    onFilterChange(player.player_id, isTeammate, checked ? "without" : null);
  };

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0">
      {/* Main Row */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 transition-colors",
          "hover:bg-neutral-50 dark:hover:bg-neutral-700/30",
          (isWithChecked || isWithoutChecked) && "bg-neutral-50 dark:bg-neutral-700/20"
        )}
      >
        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400 w-6">
              {player.position || "—"}
            </span>
            <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
              {player.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 font-medium">
              {player.games_out} {player.games_out === 1 ? "game" : "games"} out
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-neutral-500">
              {player.avg_pts?.toFixed(1) ?? "0.0"} PPG
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-[10px] text-neutral-500">
              {player.avg_reb?.toFixed(1) ?? "0.0"} RPG
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-[10px] text-neutral-500">
              {player.avg_ast?.toFixed(1) ?? "0.0"} APG
            </span>
          </div>
        </div>

        {/* With/Without Checkboxes */}
        <div className="flex items-center gap-4">
          {/* With Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={isWithChecked}
              onCheckedChange={handleWithChange}
              className={cn(
                "h-4 w-4",
                isWithChecked && "border-emerald-500 bg-emerald-500 text-white"
              )}
            />
            <span className={cn(
              "text-xs font-medium",
              isWithChecked ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500"
            )}>
              With
            </span>
          </label>

          {/* Without Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={isWithoutChecked}
              onCheckedChange={handleWithoutChange}
              className={cn(
                "h-4 w-4",
                isWithoutChecked && "border-red-500 bg-red-500 text-white"
              )}
            />
            <span className={cn(
              "text-xs font-medium",
              isWithoutChecked ? "text-red-600 dark:text-red-400" : "text-neutral-500"
            )}>
              W/O
            </span>
          </label>

          {/* Expand Button (only show when comparison is available) */}
          {comparisonStats && (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-neutral-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Comparison Stats */}
      {expanded && comparisonStats && (
        <div className="px-3 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Your Stats: With {player.name} → Without
            </span>
            <span className="text-[10px] text-neutral-500">
              ({comparisonStats.with.gamesPlayed}g → {comparisonStats.without.gamesPlayed}g)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <StatComparison
              label="PTS"
              withValue={comparisonStats.with.avgPts}
              withoutValue={comparisonStats.without.avgPts}
            />
            <StatComparison
              label="REB"
              withValue={comparisonStats.with.avgReb}
              withoutValue={comparisonStats.without.avgReb}
            />
            <StatComparison
              label="AST"
              withValue={comparisonStats.with.avgAst}
              withoutValue={comparisonStats.without.avgAst}
            />
            <StatComparison
              label="PRA"
              withValue={comparisonStats.with.avgPra}
              withoutValue={comparisonStats.without.avgPra}
            />
            <StatComparison
              label="3PM"
              withValue={comparisonStats.with.avgFg3m}
              withoutValue={comparisonStats.without.avgFg3m}
            />
            <StatComparison
              label="MIN"
              withValue={comparisonStats.with.avgMinutes}
              withoutValue={comparisonStats.without.avgMinutes}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Section for teammates or opponents
function PlayerSection({
  title,
  icon: Icon,
  players,
  isTeammate,
  filters,
  onFilterChange,
  games,
  expandedPlayerId,
  onToggleExpand,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  players: PlayerOutInfo[];
  isTeammate: boolean;
  filters: ImpactFilter[];
  onFilterChange: (playerId: number, isTeammate: boolean, mode: ImpactFilterMode) => void;
  games: GameWithInjuries[];
  expandedPlayerId: number | null;
  onToggleExpand: (playerId: number) => void;
}) {
  if (players.length === 0) {
    return (
      <div className="flex-1">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50">
          <Icon className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-4 text-neutral-500 dark:text-neutral-400">
          <span className="text-sm">No players were out during games</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30">
        <Icon className="h-4 w-4 text-neutral-500" />
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">
          {title}
        </span>
        <span className="text-xs text-neutral-500 ml-auto">
          {players.length} player{players.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Player List */}
      <div>
        {players.map((player) => (
          <PlayerFilterRow
            key={player.player_id}
            player={player}
            isTeammate={isTeammate}
            filter={filters.find(
              (f) => f.playerId === player.player_id && f.isTeammate === isTeammate
            )}
            onFilterChange={onFilterChange}
            games={games}
            expanded={expandedPlayerId === player.player_id}
            onToggleExpand={() => onToggleExpand(player.player_id)}
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerImpactFilters({
  playerId,
  teamId,
  season = "2025-26",
  filters,
  onFiltersChange,
  className,
}: PlayerImpactFiltersProps) {
  const [expandedPlayerId, setExpandedPlayerId] = React.useState<number | null>(null);

  // Fetch players who were out during this player's games
  const {
    teammatesOut,
    opponentsOut,
    isLoading: playersLoading,
  } = usePlayersOutForFilter({
    playerId,
    season,
    enabled: !!playerId,
  });

  // Fetch games with injury context (for comparison stats)
  const { games, isLoading: gamesLoading } = usePlayerGamesWithInjuries({
    playerId,
    season,
    enabled: !!playerId,
  });

  const handleFilterChange = (
    targetPlayerId: number,
    isTeammate: boolean,
    mode: ImpactFilterMode
  ) => {
    const players = isTeammate ? teammatesOut : opponentsOut;
    const player = players.find((p) => p.player_id === targetPlayerId);
    if (!player) return;

    if (mode === null) {
      // Remove filter
      onFiltersChange(
        filters.filter(
          (f) => !(f.playerId === targetPlayerId && f.isTeammate === isTeammate)
        )
      );
      // Collapse if this was expanded
      if (expandedPlayerId === targetPlayerId) {
        setExpandedPlayerId(null);
      }
    } else {
      // Add or update filter
      const existing = filters.find(
        (f) => f.playerId === targetPlayerId && f.isTeammate === isTeammate
      );
      if (existing) {
        onFiltersChange(
          filters.map((f) =>
            f.playerId === targetPlayerId && f.isTeammate === isTeammate
              ? { ...f, mode }
              : f
          )
        );
      } else {
        onFiltersChange([
          ...filters,
          {
            playerId: targetPlayerId,
            playerName: player.name,
            isTeammate,
            mode,
          },
        ]);
      }
    }
  };

  const handleToggleExpand = (targetPlayerId: number) => {
    setExpandedPlayerId(
      expandedPlayerId === targetPlayerId ? null : targetPlayerId
    );
  };

  // Count active filters
  const activeFilterCount = filters.filter((f) => f.mode !== null).length;

  const isLoading = playersLoading || gamesLoading;

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-5 w-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading injury data...</span>
          </div>
        </div>
      </div>
    );
  }

  // If no players were out, show a simple message
  if (teammatesOut.length === 0 && opponentsOut.length === 0) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center gap-2 text-neutral-500">
          <Users className="h-4 w-4" />
          <span className="text-sm">No players were out during this player's games this season</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              Player Impact Filters
            </span>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
              </span>
              <button
                onClick={() => {
                  onFiltersChange([]);
                  setExpandedPlayerId(null);
                }}
                className="text-xs text-brand hover:text-brand/80 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          See how this player performs when teammates or opponents are out. Select "W/O" to filter game logs.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex divide-x divide-neutral-200 dark:divide-neutral-700">
        {/* Teammates */}
        <PlayerSection
          title="Teammates Out"
          icon={Users}
          players={teammatesOut}
          isTeammate={true}
          filters={filters}
          onFilterChange={handleFilterChange}
          games={games}
          expandedPlayerId={expandedPlayerId}
          onToggleExpand={handleToggleExpand}
        />

        {/* Opponents */}
        <PlayerSection
          title="Opponents Out"
          icon={UserX}
          players={opponentsOut}
          isTeammate={false}
          filters={filters}
          onFilterChange={handleFilterChange}
          games={games}
          expandedPlayerId={expandedPlayerId}
          onToggleExpand={handleToggleExpand}
        />
      </div>
    </div>
  );
}


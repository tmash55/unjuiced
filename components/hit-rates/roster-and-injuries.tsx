"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";
import { HeartPulse, ChevronDown, ChevronUp, ArrowDown } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export type InjuryFilterMode = "with" | "without" | null;

export interface InjuryFilter {
  playerId: number;
  playerName: string;
  teamId: number;
  mode: InjuryFilterMode;
}

interface RosterAndInjuriesProps {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  currentPlayerId?: number | null;
  season?: string;
  filters: InjuryFilter[];
  onFiltersChange: (filters: InjuryFilter[]) => void;
  className?: string;
}

const getInjuryColor = (status: string | null) => {
  if (!status) return "text-neutral-400";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision")
    return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-neutral-400";
};

const capitalizeStatus = (status: string | null) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

function TeamRosterSection({
  teamAbbr,
  teamName,
  players,
  teamId,
  currentPlayerId,
  filters,
  onFilterChange,
  isPlayerTeam,
}: {
  teamAbbr: string;
  teamName: string;
  players: TeamRosterPlayer[];
  teamId: number;
  currentPlayerId?: number | null;
  filters: InjuryFilter[];
  onFilterChange: (playerId: number, mode: InjuryFilterMode) => void;
  isPlayerTeam: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  // Sort helper
  const sortByMinutes = (a: TeamRosterPlayer, b: TeamRosterPlayer) => {
    return (b.avgMinutes || 0) - (a.avgMinutes || 0);
  };

  // Categorize players
  const activeRotation: TeamRosterPlayer[] = [];
  const bench: TeamRosterPlayer[] = [];

  players.forEach((player) => {
    const isOut = player.injuryStatus?.toLowerCase() === "out";
    const avgMins = player.avgMinutes || 0;

    // Players in active rotation (top 8 by minutes, or injured starters)
    if (!isOut && avgMins >= 15) {
      activeRotation.push(player);
    } else if (isOut && avgMins >= 15) {
      // Keep injured rotation players in rotation section
      activeRotation.push(player);
    } else {
      bench.push(player);
    }
  });

  activeRotation.sort(sortByMinutes);
  bench.sort(sortByMinutes);

  return (
    <div className="flex-1 min-w-0">
      {/* Team Header - Compact */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />
        
        {/* Content */}
        <div className="relative flex items-center justify-between px-3 py-2.5 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center gap-2">
            {/* Team Logo - Smaller */}
            <div className="h-7 w-7 rounded-full bg-white dark:bg-neutral-900 p-1 shadow ring-1 ring-neutral-200/50 dark:ring-neutral-700/50">
              <img
                src={`/team-logos/nba/${teamAbbr.toUpperCase()}.svg`}
                alt={teamAbbr}
                className="h-full w-full object-contain"
              />
            </div>
            
            {/* Team Info */}
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">
                {teamName}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                  {activeRotation.length} rot
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                  {bench.length} bench
                </span>
              </div>
            </div>
          </div>
          
          {/* Collapse Button */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md bg-neutral-100 dark:bg-neutral-700/50 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all active:scale-95"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-4">
          {/* Active Rotation */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
                Rotation ({activeRotation.length})
              </h4>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
            </div>
            <div className="space-y-1.5">
              {activeRotation.map((player) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  isCurrentPlayer={player.playerId === currentPlayerId}
                  filter={filters.find((f) => f.playerId === player.playerId)}
                  onFilterChange={onFilterChange}
                />
              ))}
            </div>
          </div>

          {/* Bench */}
          {bench.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
                  Bench ({bench.length})
                </h4>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
              </div>
              <div className="space-y-1.5">
                {bench.map((player) => (
                  <PlayerRow
                    key={player.playerId}
                    player={player}
                    isCurrentPlayer={player.playerId === currentPlayerId}
                    filter={filters.find((f) => f.playerId === player.playerId)}
                    onFilterChange={onFilterChange}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  isCurrentPlayer,
  filter,
  onFilterChange,
}: {
  player: TeamRosterPlayer;
  isCurrentPlayer: boolean;
  filter?: InjuryFilter;
  onFilterChange: (playerId: number, mode: InjuryFilterMode) => void;
}) {
  const hasInjury = player.injuryStatus && 
    !["active", "available"].includes(player.injuryStatus.toLowerCase());
  
  // Check if player is in G League
  const isGLeague = player.injuryNotes?.toLowerCase().includes("g league") || 
                    player.injuryNotes?.toLowerCase().includes("g-league") ||
                    player.injuryNotes?.toLowerCase().includes("gleague");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 p-2 rounded-lg transition-all duration-200",
        isCurrentPlayer
          ? "bg-neutral-100 dark:bg-neutral-800/50 opacity-60"
          : "bg-gradient-to-br from-white via-neutral-50/50 to-white dark:from-neutral-800/40 dark:via-neutral-800/20 dark:to-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 hover:shadow-sm hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      {/* Avatar - Smaller */}
      <div className="relative shrink-0">
        <div className={cn(
          "h-8 w-8 rounded-full overflow-hidden ring-1 transition-all",
          isCurrentPlayer 
            ? "ring-neutral-300 dark:ring-neutral-600 opacity-50" 
            : "ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-300 dark:group-hover:ring-neutral-600"
        )}>
          <div className="h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-800">
            <PlayerHeadshot
              nbaPlayerId={player.playerId}
              name={player.name}
              size="tiny"
              className="h-full w-full object-cover scale-150 translate-y-0.5"
            />
          </div>
        </div>
        {hasInjury && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-neutral-900 ring-1 ring-white dark:ring-neutral-900 flex items-center justify-center">
            {isGLeague ? (
              <ArrowDown className="h-2 w-2 text-blue-500" />
            ) : (
              <HeartPulse className={cn("h-2 w-2", getInjuryColor(player.injuryStatus))} />
            )}
          </div>
        )}
      </div>

      {/* Info - More Compact */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-xs font-semibold truncate",
            isCurrentPlayer 
              ? "text-neutral-400 dark:text-neutral-500" 
              : "text-neutral-900 dark:text-white"
          )}>
            {player.name}
          </span>
          {isCurrentPlayer && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-bold uppercase shrink-0">
              Current
            </span>
          )}
        </div>
        
        {/* Stats - Inline, Smaller */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {player.position}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">•</span>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {(player.avgMinutes || 0).toFixed(0)}m
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">•</span>
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
            {(player.avgPoints || 0).toFixed(1)}p
          </span>
          {hasInjury && (
            <Tooltip content={`${capitalizeStatus(player.injuryStatus)} - ${player.injuryNotes || "No details"}`} side="top">
              <span className={cn(
                "text-[9px] font-semibold uppercase cursor-help",
                isGLeague ? "text-blue-500" : getInjuryColor(player.injuryStatus)
              )}>
                {isGLeague ? "GL" : capitalizeStatus(player.injuryStatus).slice(0, 3)}
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Filter Buttons - Smaller, Disabled for current player */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => !isCurrentPlayer && onFilterChange(player.playerId, filter?.mode === "with" ? null : "with")}
          disabled={isCurrentPlayer}
          className={cn(
            "px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-all duration-200",
            isCurrentPlayer
              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
              : filter?.mode === "with"
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 active:scale-95"
                : "bg-neutral-100 dark:bg-neutral-700/50 text-neutral-500 dark:text-neutral-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95"
          )}
        >
          W
        </button>
        <button
          type="button"
          onClick={() => !isCurrentPlayer && onFilterChange(player.playerId, filter?.mode === "without" ? null : "without")}
          disabled={isCurrentPlayer}
          className={cn(
            "px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-all duration-200",
            isCurrentPlayer
              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
              : filter?.mode === "without"
                ? "bg-red-500 text-white shadow-sm shadow-red-500/30 active:scale-95"
                : "bg-neutral-100 dark:bg-neutral-700/50 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 active:scale-95"
          )}
        >
          W/O
        </button>
      </div>
    </div>
  );
}

export function RosterAndInjuries({
  playerTeamId,
  opponentTeamId,
  currentPlayerId,
  season,
  filters,
  onFiltersChange,
  className,
}: RosterAndInjuriesProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  
  const { playerTeam, opponentTeam, isLoading } = useGameRosters({
    playerTeamId,
    opponentTeamId,
    season,
    enabled: !!playerTeamId || !!opponentTeamId,
  });
  
  // Check for errors from either team
  const error = playerTeam.error || opponentTeam.error;

  const handleFilterChange = (playerId: number, mode: InjuryFilterMode) => {
    const allPlayers = [...playerTeam.players, ...opponentTeam.players];
    const player = allPlayers.find((p) => p.playerId === playerId);
    if (!player) return;

    const teamId = playerTeam.players.some((p) => p.playerId === playerId)
      ? playerTeam.teamId
      : opponentTeam.teamId;

    if (mode === null) {
      onFiltersChange(filters.filter((f) => f.playerId !== playerId));
    } else {
      const existing = filters.find((f) => f.playerId === playerId);
      if (existing) {
        onFiltersChange(
          filters.map((f) =>
            f.playerId === playerId ? { ...f, mode } : f
          )
        );
      } else {
        onFiltersChange([
          ...filters,
          {
            playerId,
            playerName: player.name,
            teamId: teamId!,
            mode,
          },
        ]);
      }
    }
  };

  const activeFilterCount = filters.filter((f) => f.mode !== null).length;

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800",
          className
        )}
      >
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading rosters...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 p-6",
          className
        )}
      >
        <p className="text-sm text-red-500">Failed to load roster data</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5",
        className
      )}
    >
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-orange-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-orange-900/10" />
        
        {/* Content */}
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-600 shadow-sm shadow-orange-500/30" />
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Team Rosters & Injuries
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Filter games by player availability
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 dark:bg-brand/20 ring-1 ring-brand/20 shadow-sm">
                  <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-xs text-brand font-bold uppercase tracking-wide">
                    {activeFilterCount} Active
                  </span>
                </div>
              )}
              
              {/* Collapse/Expand Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all active:scale-95"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout - Collapsible */}
      {!isCollapsed && (
        <div className="flex gap-6 p-4">
          {/* Player's Team */}
          {playerTeam.teamId && (
            <TeamRosterSection
              teamAbbr={playerTeam.teamAbbr}
              teamName={playerTeam.teamName}
              players={playerTeam.players}
              teamId={playerTeam.teamId}
              currentPlayerId={currentPlayerId}
              filters={filters}
              onFilterChange={handleFilterChange}
              isPlayerTeam={true}
            />
          )}

          {/* Divider */}
          {playerTeam.teamId && opponentTeam.teamId && (
            <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
          )}

          {/* Opponent Team */}
          {opponentTeam.teamId && (
            <TeamRosterSection
              teamAbbr={opponentTeam.teamAbbr}
              teamName={opponentTeam.teamName}
              players={opponentTeam.players}
              teamId={opponentTeam.teamId}
              currentPlayerId={currentPlayerId}
              filters={filters}
              onFilterChange={handleFilterChange}
              isPlayerTeam={false}
            />
          )}
        </div>
      )}
    </div>
  );
}


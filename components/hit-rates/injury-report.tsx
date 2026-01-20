"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { HeartPulse, UserCheck, UserX, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/tooltip";

// Filter selection for a player: "with" means include games they played, "without" means exclude
export type InjuryFilterMode = "with" | "without" | null;

export interface InjuryFilter {
  playerId: number;
  playerName: string;
  teamId: number | null;
  mode: InjuryFilterMode;
}

interface InjuryReportProps {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  currentPlayerId?: number | null;
  season?: string;
  filters: InjuryFilter[];
  onFiltersChange: (filters: InjuryFilter[]) => void;
  className?: string;
}

const getInjuryColor = (status: string | null) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return null;
};

const getInjuryBgColor = (status: string | null) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "out") return "bg-red-500/10";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "bg-amber-500/10";
  if (s === "probable") return "bg-emerald-500/10";
  return null;
};

const getInjuryPriority = (status: string | null): number => {
  if (!status) return 99;
  const s = status.toLowerCase();
  if (s === "out") return 1;
  if (s === "doubtful") return 2;
  if (s === "questionable" || s === "gtd" || s === "game time decision") return 3;
  if (s === "probable") return 4;
  return 99;
};

function InjuredPlayerRow({
  player,
  teamId,
  filter,
  onFilterChange,
  isCurrentPlayer,
}: {
  player: TeamRosterPlayer;
  teamId: number;
  filter: InjuryFilter | undefined;
  onFilterChange: (playerId: number, mode: InjuryFilterMode) => void;
  isCurrentPlayer: boolean;
}) {
  const injuryColor = getInjuryColor(player.injuryStatus);
  const injuryBgColor = getInjuryBgColor(player.injuryStatus);
  const isWithChecked = filter?.mode === "with";
  const isWithoutChecked = filter?.mode === "without";

  const handleWithChange = (checked: boolean) => {
    onFilterChange(player.playerId, checked ? "with" : null);
  };

  const handleWithoutChange = (checked: boolean) => {
    onFilterChange(player.playerId, checked ? "without" : null);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        isCurrentPlayer && "opacity-50 pointer-events-none",
        injuryBgColor,
        !isCurrentPlayer && "hover:bg-neutral-50 dark:hover:bg-neutral-700/30"
      )}
    >
      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-400 w-6">
            {player.position}
          </span>
          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {player.name}
          </span>
          <Tooltip
            content={`${player.injuryStatus}${player.injuryNotes ? ` - ${player.injuryNotes}` : ""}`}
            side="top"
          >
            <HeartPulse className={cn("h-3.5 w-3.5 shrink-0", injuryColor)} />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-neutral-500">
            {player.avgMinutes?.toFixed(0) ?? "0"} MPG
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">•</span>
          <span className="text-[10px] text-neutral-500">
            {player.avgPoints?.toFixed(1) ?? "0.0"} PPG
          </span>
        </div>
      </div>

      {/* With/Without Checkboxes */}
      {!isCurrentPlayer && (
        <div className="flex items-center gap-4">
          {/* With Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer group">
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
          <label className="flex items-center gap-1.5 cursor-pointer group">
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
        </div>
      )}
    </div>
  );
}

function TeamInjurySection({
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
  // Filter to only injured players and sort by injury priority
  const injuredPlayers = useMemo(() => {
    return players
      .filter((p) => {
        const status = p.injuryStatus?.toLowerCase();
        return status && !["available", "active"].includes(status);
      })
      .sort((a, b) => getInjuryPriority(a.injuryStatus) - getInjuryPriority(b.injuryStatus));
  }, [players]);

  if (injuredPlayers.length === 0) {
    return (
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <img
            src={getTeamLogoUrl(teamAbbr, "nba")}
            alt={teamAbbr}
            className="h-6 w-6 object-contain"
          />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
            {teamAbbr}
          </span>
          {isPlayerTeam && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
              Team
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-4 text-neutral-500 dark:text-neutral-400">
          <UserCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-sm">All players healthy</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Team Header */}
      <div className="flex items-center gap-2 mb-3">
        <img
          src={getTeamLogoUrl(teamAbbr, "nba")}
          alt={teamAbbr}
          className="h-6 w-6 object-contain"
        />
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">
          {teamAbbr}
        </span>
        {isPlayerTeam && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
            Team
          </span>
        )}
        <span className="text-xs text-neutral-500 ml-auto">
          {injuredPlayers.length} injured
        </span>
      </div>

      {/* Injured Players List */}
      <div className="space-y-1">
        {injuredPlayers.map((player) => (
          <InjuredPlayerRow
            key={player.playerId}
            player={player}
            teamId={teamId}
            filter={filters.find((f) => f.playerId === player.playerId)}
            onFilterChange={onFilterChange}
            isCurrentPlayer={player.playerId === currentPlayerId}
          />
        ))}
      </div>
    </div>
  );
}

export function InjuryReport({
  playerTeamId,
  opponentTeamId,
  currentPlayerId,
  season,
  filters,
  onFiltersChange,
  className,
}: InjuryReportProps) {
  const { playerTeam, opponentTeam, isLoading } = useGameRosters({
    playerTeamId,
    opponentTeamId,
    season,
    enabled: !!playerTeamId || !!opponentTeamId,
  });

  const handleFilterChange = (playerId: number, mode: InjuryFilterMode) => {
    // Find the player to get their name and team
    const allPlayers = [...playerTeam.players, ...opponentTeam.players];
    const player = allPlayers.find((p) => p.playerId === playerId);
    if (!player) return;

    const teamId = playerTeam.players.some((p) => p.playerId === playerId)
      ? playerTeam.teamId
      : opponentTeam.teamId;

    if (mode === null) {
      // Remove filter
      onFiltersChange(filters.filter((f) => f.playerId !== playerId));
    } else {
      // Add or update filter
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

  // Count active filters
  const activeFilterCount = filters.filter((f) => f.mode !== null).length;

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-5 w-5 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading injuries...</span>
          </div>
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
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              Injury Report
            </span>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
              </span>
              <button
                onClick={() => onFiltersChange([])}
                className="text-xs text-brand hover:text-brand/80 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Filter game logs by player availability. Select "With" to see games they played, "W/O" for games they missed.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="p-4">
        <div className="flex gap-6">
          {/* Player's Team */}
          {playerTeam.teamId && (
            <TeamInjurySection
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
            <TeamInjurySection
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
      </div>
    </div>
  );
}


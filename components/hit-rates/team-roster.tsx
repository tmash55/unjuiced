"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Tooltip } from "@/components/tooltip";
import { Users, AlertCircle, HeartPulse } from "lucide-react";

interface TeamRosterProps {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  currentPlayerId?: number | null;
  season?: string;
  className?: string;
}

const getInjuryColor = (status: string | null) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  if (s === "available" || s === "active") return null;
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

export function TeamRoster({
  playerTeamId,
  opponentTeamId,
  currentPlayerId,
  season,
  className,
}: TeamRosterProps) {
  const { playerTeam, opponentTeam, isLoading } = useGameRosters({
    playerTeamId,
    opponentTeamId,
    season,
    enabled: !!playerTeamId || !!opponentTeamId,
  });

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading rosters...</span>
          </div>
        </div>
      </div>
    );
  }

  const hasPlayerTeam = playerTeam.players.length > 0;
  const hasOpponentTeam = opponentTeam.players.length > 0;

  if (!hasPlayerTeam && !hasOpponentTeam) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800", className)}>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No roster data available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Game Rosters & Injuries
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-700">
        {/* Player's Team */}
        {hasPlayerTeam && (
          <TeamRosterSection
            teamAbbr={playerTeam.teamAbbr}
            teamName={playerTeam.teamName}
            players={playerTeam.players}
            currentPlayerId={currentPlayerId}
            label="Player's Team"
          />
        )}

        {/* Opponent Team */}
        {hasOpponentTeam && (
          <TeamRosterSection
            teamAbbr={opponentTeam.teamAbbr}
            teamName={opponentTeam.teamName}
            players={opponentTeam.players}
            label="Opponent"
          />
        )}
      </div>
    </div>
  );
}

function TeamRosterSection({
  teamAbbr,
  teamName,
  players,
  currentPlayerId,
  label,
}: {
  teamAbbr: string;
  teamName: string;
  players: TeamRosterPlayer[];
  currentPlayerId?: number | null;
  label: string;
}) {
  // Split into starters (top 5 by minutes) and bench
  const starters = players.slice(0, 5);
  const bench = players.slice(5);
  
  // Count injuries
  const injuredCount = players.filter(
    (p) => p.injuryStatus && !["available", "active"].includes(p.injuryStatus.toLowerCase())
  ).length;

  return (
    <div className="p-4">
      {/* Team Header */}
      <div className="flex items-center gap-3 mb-4">
        <img
          src={getTeamLogoUrl(teamAbbr, "nba")}
          alt={teamAbbr}
          className="w-8 h-8 object-contain"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {teamName}
          </p>
        </div>
        {injuredCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {injuredCount} injured
            </span>
          </div>
        )}
      </div>

      {/* Starters */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 font-semibold">
          Starters
        </p>
        <div className="space-y-1">
          {starters.map((player) => (
            <PlayerRow
              key={player.playerId}
              player={player}
              isCurrentPlayer={player.playerId === currentPlayerId}
            />
          ))}
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 font-semibold">
            Bench
          </p>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {bench.map((player) => (
              <PlayerRow
                key={player.playerId}
                player={player}
                isCurrentPlayer={player.playerId === currentPlayerId}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  isCurrentPlayer,
  compact,
}: {
  player: TeamRosterPlayer;
  isCurrentPlayer?: boolean;
  compact?: boolean;
}) {
  const injuryColor = getInjuryColor(player.injuryStatus);
  const injuryBgColor = getInjuryBgColor(player.injuryStatus);
  const isInjured = injuryColor !== null;
  const isOut = player.injuryStatus?.toLowerCase() === "out";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
        isCurrentPlayer && "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/30",
        !isCurrentPlayer && "hover:bg-neutral-50 dark:hover:bg-neutral-700/30",
        isOut && "opacity-50",
        injuryBgColor && !isCurrentPlayer && injuryBgColor
      )}
    >
      {/* Position */}
      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 w-5 shrink-0">
        {player.position}
      </span>

      {/* Name */}
      <span
        className={cn(
          "text-xs font-medium flex-1 truncate",
          isCurrentPlayer
            ? "text-blue-700 dark:text-blue-300"
            : "text-neutral-900 dark:text-white"
        )}
      >
        {player.name}
        {player.jerseyNumber !== null && (
          <span className="text-neutral-400 dark:text-neutral-500 ml-1">
            #{player.jerseyNumber}
          </span>
        )}
      </span>

      {/* Injury Status */}
      {isInjured && (
        <Tooltip
          content={`${player.injuryStatus ? player.injuryStatus.charAt(0).toUpperCase() + player.injuryStatus.slice(1).toLowerCase() : ''}${player.injuryNotes ? ` - ${player.injuryNotes}` : ""}`}
          side="left"
        >
          <div className="flex items-center gap-1 shrink-0">
            <HeartPulse className={cn("h-3 w-3", injuryColor)} />
            {!compact && (
              <span className={cn("text-[10px] font-medium uppercase", injuryColor)}>
                {player.injuryStatus?.slice(0, 3)}
              </span>
            )}
          </div>
        </Tooltip>
      )}

      {/* Stats (only for non-compact) */}
      {!compact && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {player.avgMinutes.toFixed(0)}m
          </span>
          <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
            {player.avgPoints.toFixed(1)}p
          </span>
        </div>
      )}
    </div>
  );
}


"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { Tooltip } from "@/components/tooltip";
import { InjuryReportTooltipContent } from "./injury-report-tooltip";
import { Users, AlertCircle, HeartPulse } from "lucide-react";

interface TeamRosterProps {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  currentPlayerId?: number | null;
  season?: string;
  className?: string;
  sport?: "nba" | "wnba";
}

const getInjuryColor = (status: string | null) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision")
    return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  if (s === "available" || s === "active") return null;
  return null;
};

const getInjuryBgColor = (status: string | null) => {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "out") return "bg-red-500/10";
  if (s === "questionable" || s === "gtd" || s === "game time decision")
    return "bg-amber-500/10";
  if (s === "probable") return "bg-emerald-500/10";
  return null;
};

export function TeamRoster({
  playerTeamId,
  opponentTeamId,
  currentPlayerId,
  season,
  className,
  sport = "nba",
}: TeamRosterProps) {
  const { playerTeam, opponentTeam, isLoading } = useGameRosters({
    playerTeamId,
    opponentTeamId,
    sport,
    season,
    enabled: !!playerTeamId || !!opponentTeamId,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800",
          className,
        )}
      >
        <div className="flex h-48 items-center justify-center">
          <div className="flex animate-pulse flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
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
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800",
          className,
        )}
      >
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No roster data available
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-lg ring-1 ring-black/5 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:ring-white/5",
        className,
      )}
    >
      {/* Header - Premium Design */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-purple-50/20 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-purple-900/10" />
        <div className="relative border-b border-neutral-200/60 px-5 py-4 dark:border-neutral-700/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-violet-600 shadow-sm shadow-purple-500/30" />
            <div>
              <h3 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                Game Rosters & Injuries
              </h3>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Active roster information
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-neutral-200 md:grid-cols-2 md:divide-x md:divide-y-0 dark:divide-neutral-700">
        {/* Player's Team */}
        {hasPlayerTeam && (
          <TeamRosterSection
            teamAbbr={playerTeam.teamAbbr}
            teamName={playerTeam.teamName}
            players={playerTeam.players}
            currentPlayerId={currentPlayerId}
            label="Player's Team"
            sport={sport}
          />
        )}

        {/* Opponent Team */}
        {hasOpponentTeam && (
          <TeamRosterSection
            teamAbbr={opponentTeam.teamAbbr}
            teamName={opponentTeam.teamName}
            players={opponentTeam.players}
            label="Opponent"
            sport={sport}
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
  sport = "nba",
}: {
  teamAbbr: string;
  teamName: string;
  players: TeamRosterPlayer[];
  currentPlayerId?: number | null;
  label: string;
  sport?: "nba" | "wnba";
}) {
  // Split into starters (top 5 by minutes) and bench
  const starters = players.slice(0, 5);
  const bench = players.slice(5);

  // Count injuries
  const injuredCount = players.filter(
    (p) =>
      p.injuryStatus &&
      !["available", "active"].includes(p.injuryStatus.toLowerCase()),
  ).length;

  return (
    <div className="p-4">
      {/* Team Header */}
      <div className="mb-4 flex items-center gap-3">
        <img
          src={getTeamLogoUrl(teamAbbr, sport)}
          alt={teamAbbr}
          className="h-8 w-8 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            {label}
          </p>
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
            {teamName}
          </p>
        </div>
        {injuredCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/30">
            <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {injuredCount} injured
            </span>
          </div>
        )}
      </div>

      {/* Starters */}
      <div className="mb-3">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
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
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
            Bench
          </p>
          <div className="max-h-[200px] space-y-1 overflow-y-auto">
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
        "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
        isCurrentPlayer &&
          "bg-blue-50 ring-1 ring-blue-500/30 dark:bg-blue-900/20",
        !isCurrentPlayer && "hover:bg-neutral-50 dark:hover:bg-neutral-700/30",
        isOut && "opacity-50",
        injuryBgColor && !isCurrentPlayer && injuryBgColor,
      )}
    >
      {/* Position */}
      <span className="w-5 shrink-0 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
        {player.position}
      </span>

      {/* Name */}
      <span
        className={cn(
          "flex-1 truncate text-xs font-medium",
          isCurrentPlayer
            ? "text-blue-700 dark:text-blue-300"
            : "text-neutral-900 dark:text-white",
        )}
      >
        {player.name}
        {player.jerseyNumber !== null && (
          <span className="ml-1 text-neutral-400 dark:text-neutral-500">
            #{player.jerseyNumber}
          </span>
        )}
      </span>

      {/* Injury Status */}
      {isInjured && (
        <Tooltip
          content={
            <InjuryReportTooltipContent
              playerName={player.name}
              status={player.injuryStatus}
              notes={player.injuryNotes}
              updatedAt={player.injuryUpdatedAt}
              returnDate={player.injuryReturnDate}
              source={player.injurySource}
              rawStatus={player.injuryRawStatus}
            />
          }
          side="left"
          contentClassName="p-0"
        >
          <div className="flex shrink-0 items-center gap-1">
            <HeartPulse className={cn("h-3 w-3", injuryColor)} />
            {!compact && (
              <span
                className={cn("text-[10px] font-medium uppercase", injuryColor)}
              >
                {player.injuryStatus?.slice(0, 3)}
              </span>
            )}
          </div>
        </Tooltip>
      )}

      {/* Stats (only for non-compact) */}
      {!compact && (
        <div className="flex shrink-0 items-center gap-2">
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

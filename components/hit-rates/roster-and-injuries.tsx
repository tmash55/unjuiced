"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { useGameRosters, TeamRosterPlayer } from "@/hooks/use-team-roster";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { HeartPulse, ChevronDown, ChevronUp, ArrowDown } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import {
  InjuryReportTooltipContent,
  isGLeagueAssignment,
} from "./injury-report-tooltip";

export type InjuryFilterMode = "with" | "without" | null;

export interface InjuryFilter {
  playerId: number;
  playerName: string;
  teamId: number | null;
  mode: InjuryFilterMode;
}

interface RosterAndInjuriesProps {
  playerTeamId: number | null;
  opponentTeamId: number | null;
  currentPlayerId?: number | null;
  season?: string;
  filters: InjuryFilter[];
  onFiltersChange: (filters: InjuryFilter[]) => void;
  onSeasonChange?: (season: string) => void;
  className?: string;
  sport?: "nba" | "wnba";
}

const WNBA_ROSTER_SEASONS = ["2026", "2025", "2024"] as const;

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
  sport = "nba",
}: {
  teamAbbr: string;
  teamName: string;
  players: TeamRosterPlayer[];
  teamId: number;
  currentPlayerId?: number | null;
  filters: InjuryFilter[];
  onFilterChange: (playerId: number, mode: InjuryFilterMode) => void;
  isPlayerTeam: boolean;
  sport?: "nba" | "wnba";
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
    <div className="min-w-0 flex-1">
      {/* Team Header - Compact */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-800/50 dark:via-neutral-800/30 dark:to-neutral-800/50" />

        {/* Content */}
        <div className="relative flex items-center justify-between border-b border-neutral-200/60 px-3 py-2.5 dark:border-neutral-700/60">
          <div className="flex items-center gap-2">
            {/* Team Logo - Smaller */}
            <div className="h-7 w-7 rounded-full bg-white p-1 shadow ring-1 ring-neutral-200/50 dark:bg-neutral-900 dark:ring-neutral-700/50">
              <img
                src={getTeamLogoUrl(teamAbbr, sport)}
                alt={teamAbbr}
                className="h-full w-full object-contain"
              />
            </div>

            {/* Team Info */}
            <div>
              <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                {teamName}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
                  {activeRotation.length} rot
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">
                  •
                </span>
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
            className="rounded-md bg-neutral-100 p-1.5 transition-all hover:bg-neutral-200 active:scale-95 dark:bg-neutral-700/50 dark:hover:bg-neutral-700"
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
        <div className="space-y-4 p-3">
          {/* Active Rotation */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
              <h4 className="px-1 text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
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
                  sport={sport}
                />
              ))}
            </div>
          </div>

          {/* Bench */}
          {bench.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-200 to-transparent dark:via-neutral-700" />
                <h4 className="px-1 text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
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
                    sport={sport}
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
  sport = "nba",
}: {
  player: TeamRosterPlayer;
  isCurrentPlayer: boolean;
  filter?: InjuryFilter;
  onFilterChange: (playerId: number, mode: InjuryFilterMode) => void;
  sport?: "nba" | "wnba";
}) {
  const hasInjury =
    player.injuryStatus &&
    !["active", "available"].includes(player.injuryStatus.toLowerCase());

  // Check if player is in G League
  const isGLeague = isGLeagueAssignment(player.injuryNotes);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg p-2 transition-all duration-200",
        isCurrentPlayer
          ? "bg-neutral-100 opacity-60 dark:bg-neutral-800/50"
          : "border border-neutral-200/60 bg-gradient-to-br from-white via-neutral-50/50 to-white hover:border-neutral-300 hover:shadow-sm dark:border-neutral-700/60 dark:from-neutral-800/40 dark:via-neutral-800/20 dark:to-neutral-800/40 dark:hover:border-neutral-600",
      )}
    >
      {/* Avatar - Smaller */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "h-8 w-8 overflow-hidden rounded-full ring-1 transition-all",
            isCurrentPlayer
              ? "opacity-50 ring-neutral-300 dark:ring-neutral-600"
              : "ring-neutral-200 group-hover:ring-neutral-300 dark:ring-neutral-700 dark:group-hover:ring-neutral-600",
          )}
        >
          <div className="h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-800">
            <PlayerHeadshot
              nbaPlayerId={
                player.nbaPlayerId ?? (sport === "nba" ? player.playerId : null)
              }
              name={player.name}
              size="tiny"
              sport={sport}
              className="h-full w-full translate-y-0.5 scale-150 object-cover"
            />
          </div>
        </div>
        {hasInjury && (
          <div className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-1 ring-white dark:bg-neutral-900 dark:ring-neutral-900">
            {isGLeague ? (
              <ArrowDown className="h-2 w-2 text-blue-500" />
            ) : (
              <HeartPulse
                className={cn("h-2 w-2", getInjuryColor(player.injuryStatus))}
              />
            )}
          </div>
        )}
      </div>

      {/* Info - More Compact */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-xs font-semibold",
              isCurrentPlayer
                ? "text-neutral-400 dark:text-neutral-500"
                : "text-neutral-900 dark:text-white",
            )}
          >
            {player.name}
          </span>
          {isCurrentPlayer && (
            <span className="shrink-0 rounded bg-neutral-200 px-1 py-0.5 text-[8px] font-bold text-neutral-500 uppercase dark:bg-neutral-700 dark:text-neutral-400">
              Current
            </span>
          )}
        </div>

        {/* Stats - Inline, Smaller */}
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {player.position}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            •
          </span>
          <span className="text-[10px] text-neutral-500 tabular-nums dark:text-neutral-400">
            {(player.avgMinutes || 0).toFixed(0)}m
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            •
          </span>
          <span className="text-[10px] text-neutral-500 tabular-nums dark:text-neutral-400">
            {(player.avgPoints || 0).toFixed(1)}p
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            •
          </span>
          <span className="text-[10px] text-neutral-500 tabular-nums dark:text-neutral-400">
            {player.gamesPlayed || 0}gp
          </span>
          {hasInjury && (
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
              side="top"
              contentClassName="p-0"
            >
              <span
                className={cn(
                  "cursor-help text-[9px] font-semibold uppercase",
                  isGLeague
                    ? "text-blue-500"
                    : getInjuryColor(player.injuryStatus),
                )}
              >
                {isGLeague
                  ? "GL"
                  : capitalizeStatus(player.injuryStatus).slice(0, 3)}
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Filter Buttons - Smaller, Disabled for current player */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() =>
            !isCurrentPlayer &&
            onFilterChange(
              player.playerId,
              filter?.mode === "with" ? null : "with",
            )
          }
          disabled={isCurrentPlayer}
          className={cn(
            "rounded px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition-all duration-200",
            isCurrentPlayer
              ? "cursor-not-allowed bg-neutral-100 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-600"
              : filter?.mode === "with"
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 active:scale-95"
                : "bg-neutral-100 text-neutral-500 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 dark:bg-neutral-700/50 dark:text-neutral-400 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400",
          )}
        >
          W
        </button>
        <button
          type="button"
          onClick={() =>
            !isCurrentPlayer &&
            onFilterChange(
              player.playerId,
              filter?.mode === "without" ? null : "without",
            )
          }
          disabled={isCurrentPlayer}
          className={cn(
            "rounded px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition-all duration-200",
            isCurrentPlayer
              ? "cursor-not-allowed bg-neutral-100 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-600"
              : filter?.mode === "without"
                ? "bg-red-500 text-white shadow-sm shadow-red-500/30 active:scale-95"
                : "bg-neutral-100 text-neutral-500 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:bg-neutral-700/50 dark:text-neutral-400 dark:hover:bg-red-950/30 dark:hover:text-red-400",
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
  onSeasonChange,
  className,
  sport = "nba",
}: RosterAndInjuriesProps) {
  // Default to collapsed for a cleaner reading flow
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const rosterSeason = season ?? "2026";
  const showSeasonControl = sport === "wnba" && !!onSeasonChange;

  const { playerTeam, opponentTeam, isLoading } = useGameRosters({
    playerTeamId,
    opponentTeamId,
    sport,
    season,
    enabled: !!playerTeamId || !!opponentTeamId,
  });

  // Calculate injury summary for collapsed view
  const injurySummary = React.useMemo(() => {
    const allPlayers = [...playerTeam.players, ...opponentTeam.players];
    const outPlayers = allPlayers.filter(
      (p) => p.injuryStatus?.toLowerCase() === "out",
    );
    const gtdPlayers = allPlayers.filter((p) => {
      const s = p.injuryStatus?.toLowerCase();
      return s === "questionable" || s === "gtd" || s === "game time decision";
    });
    const probablePlayers = allPlayers.filter(
      (p) => p.injuryStatus?.toLowerCase() === "probable",
    );

    // Get starters (players with high minutes) who are out
    const startersOut = outPlayers.filter((p) => (p.avgMinutes || 0) >= 20);
    const keyOutNames = startersOut
      .slice(0, 3)
      .map((p) => p.name.split(" ").pop());

    return {
      totalInjured:
        outPlayers.length + gtdPlayers.length + probablePlayers.length,
      outCount: outPlayers.length,
      gtdCount: gtdPlayers.length,
      probableCount: probablePlayers.length,
      startersOutCount: startersOut.length,
      keyNames: keyOutNames,
    };
  }, [playerTeam.players, opponentTeam.players]);

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
          filters.map((f) => (f.playerId === playerId ? { ...f, mode } : f)),
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

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800",
          className,
        )}
      >
        <p className="text-sm text-red-500">Failed to load roster data</p>
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
      {/* Header - Clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="group relative w-full overflow-hidden text-left"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50/50 to-orange-50/20 transition-colors group-hover:from-neutral-50 dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-orange-900/10 dark:group-hover:from-neutral-700/80" />

        {/* Content */}
        <div className="relative border-b border-neutral-200/60 px-5 py-4 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-amber-600 shadow-sm shadow-orange-500/30" />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                    Rosters & Injuries
                  </h2>
                  {injurySummary.totalInjured > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                      {injurySummary.totalInjured}
                    </span>
                  )}
                </div>

                {/* Summary when collapsed */}
                {isCollapsed ? (
                  <div className="mt-0.5 flex items-center gap-2">
                    {injurySummary.outCount > 0 && (
                      <span className="text-xs font-medium text-red-500">
                        {injurySummary.startersOutCount > 0
                          ? `${injurySummary.startersOutCount} starter${injurySummary.startersOutCount > 1 ? "s" : ""} OUT`
                          : `${injurySummary.outCount} OUT`}
                      </span>
                    )}
                    {injurySummary.gtdCount > 0 && (
                      <>
                        <span className="text-neutral-300 dark:text-neutral-600">
                          ·
                        </span>
                        <span className="text-xs font-medium text-amber-500">
                          {injurySummary.gtdCount} GTD
                        </span>
                      </>
                    )}
                    {injurySummary.keyNames.length > 0 && (
                      <>
                        <span className="text-neutral-300 dark:text-neutral-600">
                          ·
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {injurySummary.keyNames.join(", ")}
                        </span>
                      </>
                    )}
                    {injurySummary.totalInjured === 0 && (
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        All players healthy
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Filter games by player availability
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <div className="bg-brand/10 dark:bg-brand/20 ring-brand/20 flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm ring-1">
                  <div className="bg-brand h-2 w-2 animate-pulse rounded-full" />
                  <span className="text-brand text-xs font-bold tracking-wide uppercase">
                    {activeFilterCount} Active
                  </span>
                </div>
              )}

              {/* Collapse/Expand Indicator */}
              <div className="rounded-lg bg-neutral-100 p-2 transition-all group-hover:bg-neutral-200 dark:bg-neutral-700/50 dark:group-hover:bg-neutral-700">
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {showSeasonControl && (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 bg-neutral-50/80 px-5 py-2.5 dark:border-neutral-700/60 dark:bg-neutral-900/30">
          <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            Roster Season
          </span>
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            {WNBA_ROSTER_SEASONS.map((seasonOption) => {
              const isSelected = rosterSeason === seasonOption;

              return (
                <button
                  key={seasonOption}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSeasonChange?.(seasonOption)}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-bold tabular-nums transition-colors",
                    isSelected
                      ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white",
                  )}
                >
                  {seasonOption}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              sport={sport}
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
              sport={sport}
            />
          )}
        </div>
      )}
    </div>
  );
}

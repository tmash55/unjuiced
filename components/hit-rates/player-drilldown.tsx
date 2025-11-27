"use client";

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PlayerHeadshot } from "@/components/player-headshot";
import { HitRateProfile } from "@/lib/hit-rates-schema";
import { cn } from "@/lib/utils";
import { formatMarketLabel } from "@/lib/data/markets";
import { AlternateLinesMatrix } from "./alternate-lines-matrix";
import { PositionVsTeam } from "./position-vs-team";
import { GameLogChart } from "./game-log-chart";
import { TeamRoster } from "./team-roster";
import { BoxScoreTable } from "./box-score-table";

type GameCountFilter = 5 | 10 | 20 | "season";

interface PlayerDrilldownProps {
  profile: HitRateProfile;
  onBack: () => void;
}

// Format percentage with color class
const getPctColor = (value: number | null) => {
  if (value === null) return "text-neutral-500";
  if (value >= 70) return "text-emerald-500";
  if (value >= 50) return "text-amber-500";
  return "text-red-500";
};

export function PlayerDrilldown({ profile, onBack }: PlayerDrilldownProps) {
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);

  // Get total available games
  const totalGamesAvailable = (profile.gameLogs as any[] | null)?.length ?? 0;

  // Filter game logs based on selected count
  const filteredGameLogs = React.useMemo(() => {
    if (!profile.gameLogs) return null;
    const logs = profile.gameLogs as any[];
    if (gameCount === "season") return logs;
    return logs.slice(0, gameCount);
  }, [profile.gameLogs, gameCount]);

  return (
    <div className="h-full overflow-auto">
      {/* ═══════════════════════════════════════════════════════════════════
          MINIMAL PLAYER HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-6">
        {/* Left: Back + Player Info */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Player Headshot */}
          <div 
            className="h-12 w-12 rounded-xl overflow-hidden shadow-sm"
            style={{ 
              background: profile.primaryColor && profile.secondaryColor 
                ? `linear-gradient(180deg, ${profile.primaryColor} 0%, ${profile.secondaryColor} 100%)`
                : profile.primaryColor || '#374151'
            }}
          >
            <PlayerHeadshot
              nbaPlayerId={profile.playerId}
              name={profile.playerName}
              size="small"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Name & Position */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
                {profile.playerName}
              </h1>
              <span className="text-sm text-neutral-400">
                {profile.position} | {profile.teamAbbr}
              </span>
            </div>
            {/* Matchup */}
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span>{profile.homeAway === "H" ? "vs" : "@"}</span>
              {profile.opponentTeamAbbr && (
                <img
                  src={`/team-logos/nba/${profile.opponentTeamAbbr.toUpperCase()}.svg`}
                  alt={profile.opponentTeamAbbr}
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{profile.opponentTeamAbbr}</span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <span>{profile.gameStatus}</span>
            </div>
          </div>
        </div>

        {/* Right: Prop Line + Hit Rates */}
        <div className="flex items-center gap-6">
          {/* Hit Rate Pills */}
          <div className="flex items-center gap-1.5">
            {[
              { label: "25/26", value: profile.seasonPct },
              { label: "L20", value: profile.last20Pct },
              { label: "L10", value: profile.last10Pct },
              { label: "L5", value: profile.last5Pct },
            ].map((stat) => (
              <div 
                key={stat.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800"
              >
                <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                  {stat.label}
                </span>
                <span className={cn("text-xs font-bold", getPctColor(stat.value))}>
                  {stat.value !== null ? `${stat.value.toFixed(0)}%` : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Current Prop */}
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2"
            style={{ 
              borderColor: profile.primaryColor || '#6366f1',
              background: `${profile.primaryColor || '#6366f1'}10`
            }}
          >
            <span className="text-xl font-black text-neutral-900 dark:text-white">
              {profile.line}+
            </span>
            <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              {formatMarketLabel(profile.market)}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - BAR CHART (Coming Next)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900 p-6">
        {/* Chart Header with filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              Game Log
            </h2>
            {/* Game Count Filter */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
              {([5, 10, 20, "season"] as GameCountFilter[]).map((count) => {
                const numericCount = count === "season" ? totalGamesAvailable : count;
                const isDisabled = numericCount > totalGamesAvailable;
                const displayCount = count === "season" 
                  ? `All (${totalGamesAvailable})` 
                  : `L${count}`;
                
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => !isDisabled && setGameCount(count)}
                    disabled={isDisabled}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                      gameCount === count
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : isDisabled
                          ? "text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
                          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                    )}
                  >
                    {displayCount}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Season Avg indicator */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-500">Szn Avg:</span>
            <span className="font-bold text-neutral-900 dark:text-white">
              {profile.seasonAvg?.toFixed(1) ?? "—"}
            </span>
          </div>
        </div>

        {/* Bar Chart */}
        <GameLogChart
          gameLogs={filteredGameLogs}
          line={profile.line}
          seasonAvg={profile.seasonAvg}
          teamPrimaryColor={profile.primaryColor}
          market={profile.market}
        />

        {/* Filter Pills (placeholder) */}
        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 flex-wrap">
            {["Home", "Away", "Win", "Loss", "vs East", "vs West"].map((filter) => (
              <button
                key={filter}
                type="button"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ALTERNATE LINES & POSITION VS TEAM (Side by Side)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alternate Lines Matrix */}
        <AlternateLinesMatrix
          sid={profile.oddsSelectionId}
          playerId={profile.playerId}
          market={profile.market}
          currentLine={profile.line}
        />

        {/* Position vs Team */}
        <PositionVsTeam
          position={profile.position}
          opponentTeamId={profile.opponentTeamId}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          market={profile.market}
          currentLine={profile.line}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOX SCORE TABLE (Full Game Log)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <BoxScoreTable
          playerId={profile.playerId}
          market={profile.market}
          currentLine={profile.line}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TEAM ROSTERS & INJURIES
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mt-6">
        <TeamRoster
          playerTeamId={profile.teamId}
          opponentTeamId={profile.opponentTeamId}
          currentPlayerId={profile.playerId}
        />
      </div>
    </div>
  );
}

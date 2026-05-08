"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import {
  GamesFilterDropdown,
  normalizeGameId,
} from "@/components/hit-rates/games-filter-dropdown";
import { InjuryReportTooltipContent } from "@/components/hit-rates/injury-report-tooltip";
import { PlayerHeadshot } from "@/components/player-headshot";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { cn } from "@/lib/utils";

interface PlayerSwitcherStripProps {
  backHref: string;
  sport: "nba" | "wnba";
  players: HitRateProfile[];
  games: React.ComponentProps<typeof GamesFilterDropdown>["games"];
  activePlayerId: number;
  activeProfile?: HitRateProfile;
  selectedGameId: string | null;
  onGameSelect: (gameId: string | null) => void;
  onPlayerSelect: (profile: HitRateProfile) => void;
  isLoading?: boolean;
}

export const PlayerSwitcherStrip = React.memo(function PlayerSwitcherStrip({
  backHref,
  sport,
  players,
  games,
  activePlayerId,
  activeProfile,
  selectedGameId,
  onGameSelect,
  onPlayerSelect,
  isLoading,
}: PlayerSwitcherStripProps) {
  const [query, setQuery] = useState("");

  const visiblePlayers = useMemo(() => {
    const normalizedGameId = selectedGameId
      ? normalizeGameId(selectedGameId)
      : null;
    const normalizedQuery = query.trim().toLowerCase();
    const seen = new Set<number>();

    return players
      .filter((player) => {
        if (
          normalizedGameId &&
          normalizeGameId(player.gameId) !== normalizedGameId
        )
          return false;
        if (
          normalizedQuery &&
          !player.playerName.toLowerCase().includes(normalizedQuery)
        )
          return false;
        if (seen.has(player.playerId)) return false;
        seen.add(player.playerId);
        return true;
      })
      .sort((a, b) => {
        const activeDelta =
          Number(b.playerId === activePlayerId) -
          Number(a.playerId === activePlayerId);
        if (activeDelta !== 0) return activeDelta;
        return (b.last10Pct ?? -1) - (a.last10Pct ?? -1);
      })
      .slice(0, 36);
  }, [activePlayerId, players, query, selectedGameId]);

  return (
    <div className="flex items-center gap-2 py-2">
      <Tooltip content="Back to Hit Rates" side="bottom">
        <Link
          href={backHref}
          aria-label="Back to Hit Rates"
          className="hover:border-brand/40 hover:text-brand dark:hover:text-brand inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 transition-colors dark:border-neutral-800/80 dark:bg-neutral-900 dark:text-neutral-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Tooltip>

      <label className="focus-within:border-brand/45 focus-within:ring-brand/10 hidden h-8 w-[210px] shrink-0 items-center gap-2 rounded-md border border-neutral-200/80 bg-white px-2.5 text-[12px] text-neutral-500 transition-colors focus-within:ring-2 sm:flex dark:border-neutral-800/80 dark:bg-neutral-900 dark:text-neutral-500">
        <Search className="h-3.5 w-3.5" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players..."
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-200 dark:placeholder:text-neutral-500"
        />
        <kbd className="ml-2 rounded border border-neutral-200 bg-neutral-50 px-1 text-[10px] font-bold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
          /
        </kbd>
      </label>

      <GamesFilterDropdown
        sport={sport}
        games={games}
        singleSelect
        selectedGameId={selectedGameId}
        onGameSelect={onGameSelect}
        compact
        className="h-8 max-w-[180px] bg-white dark:bg-neutral-900"
      />

      <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
        <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="hidden h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-neutral-200/80 bg-neutral-50/40 px-2.5 md:inline-flex dark:border-neutral-800/80 dark:bg-neutral-900/40"
                aria-hidden="true"
              >
                <span className="h-5 w-5 rounded-full bg-neutral-200/60 dark:bg-neutral-800/80" />
                <span className="h-2.5 w-14 rounded bg-neutral-200/60 dark:bg-neutral-800/80" />
              </div>
            ))
          ) : visiblePlayers.length > 0 ? (
            visiblePlayers.map((player) => {
              const injuryDot = getInjuryDot(player.injuryStatus);
              const reportPlayer =
                player.playerId === activePlayerId && activeProfile
                  ? {
                      ...player,
                      injuryStatus:
                        activeProfile.injuryStatus ?? player.injuryStatus,
                      injuryNotes:
                        activeProfile.injuryNotes ?? player.injuryNotes,
                      injuryUpdatedAt:
                        activeProfile.injuryUpdatedAt ?? player.injuryUpdatedAt,
                      injuryReturnDate:
                        activeProfile.injuryReturnDate ??
                        player.injuryReturnDate,
                      injurySource:
                        activeProfile.injurySource ?? player.injurySource,
                      injuryRawStatus:
                        activeProfile.injuryRawStatus ?? player.injuryRawStatus,
                    }
                  : player;
              const pill = (
                <button
                  key={`${player.playerId}-${player.market}-${player.gameId ?? "all"}`}
                  type="button"
                  onClick={() => onPlayerSelect(player)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2 pr-2.5 text-left transition-all active:scale-[0.98]",
                    player.playerId === activePlayerId
                      ? "border-brand/45 bg-brand/10 text-brand hover:bg-brand/15 dark:hover:bg-brand/20"
                      : [
                          // Light mode: white pill, neutral-50 hover surface
                          "border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
                          // Dark mode: needs its own hover bg + readable text
                          // (hover:bg-neutral-50 was bleeding through and
                          // washing out the white-on-white text).
                          "dark:border-neutral-800/80 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/70 dark:hover:text-white",
                        ],
                  )}
                >
                  <span className="relative h-5 w-5 shrink-0">
                    <span className="block h-5 w-5 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                      <PlayerHeadshot
                        nbaPlayerId={player.nbaPlayerId ?? player.playerId}
                        sport={sport}
                        name={player.playerName}
                        size="tiny"
                        className="h-full w-full"
                      />
                    </span>
                    {injuryDot && (
                      <span
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ring-[1.5px]",
                          injuryDot.bg,
                          // Ring color matches the pill background so the dot
                          // reads as a clean badge, not a smudge on the avatar.
                          player.playerId === activePlayerId
                            ? "ring-[#0f1115] dark:ring-[#0f1115]"
                            : "ring-white dark:ring-neutral-900",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="max-w-[132px] truncate text-[11px] font-black">
                    {player.playerName}
                  </span>
                </button>
              );
              return injuryDot ? (
                <Tooltip
                  key={`${player.playerId}-${player.market}-${player.gameId ?? "all"}`}
                  content={
                    <InjuryReportTooltipContent
                      playerName={player.playerName}
                      status={reportPlayer.injuryStatus}
                      notes={reportPlayer.injuryNotes}
                      updatedAt={reportPlayer.injuryUpdatedAt}
                      returnDate={reportPlayer.injuryReturnDate}
                      source={reportPlayer.injurySource}
                      rawStatus={reportPlayer.injuryRawStatus}
                    />
                  }
                  side="bottom"
                  contentClassName="p-0"
                >
                  {pill}
                </Tooltip>
              ) : (
                pill
              );
            })
          ) : (
            <div className="hidden h-8 items-center rounded-full border border-dashed border-neutral-200/80 px-3 text-[11px] font-bold text-neutral-400 md:inline-flex dark:border-neutral-800/80 dark:text-neutral-500">
              No players for this filter
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Status → dot color + readable label. Returns null for active/available/null
// so the avatar stays clean for healthy players.
function getInjuryDot(
  status: string | null,
): { bg: string; label: string } | null {
  const s = (status ?? "").toLowerCase();
  if (s === "out") return { bg: "bg-red-500 dark:bg-red-400", label: "Out" };
  if (s === "doubtful")
    return { bg: "bg-red-400 dark:bg-red-300", label: "Doubtful" };
  if (s === "questionable" || s === "gtd" || s === "game time decision") {
    return {
      bg: "bg-amber-500 dark:bg-amber-400",
      label: "Game-time decision",
    };
  }
  if (s === "probable")
    return { bg: "bg-emerald-500 dark:bg-emerald-400", label: "Probable" };
  return null;
}

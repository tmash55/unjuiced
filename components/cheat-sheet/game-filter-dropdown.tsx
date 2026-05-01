"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { MlbGame } from "@/hooks/use-mlb-games";

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  if (parts.length <= 1) return name;

  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
  const last = parts[parts.length - 1];
  if (suffixes.has(last.toLowerCase()) && parts.length > 2) {
    return `${parts[parts.length - 2]} ${last}`;
  }

  return last;
}

function getGameStatusLabel(game: MlbGame): string {
  const status = game.game_status || "TBD";
  if (status.toLowerCase().includes("final")) {
    return game.final_inning && game.final_inning > 9 ? `F/${game.final_inning}` : "Final";
  }

  const live = game.live;
  if (live?.current_inning != null) {
    const half = live.current_inning_half === "top" ? "T" : live.current_inning_half === "bottom" ? "B" : "";
    return `${half}${live.current_inning}`;
  }

  if (status.toLowerCase().includes("progress")) return "Live";
  return status;
}

function isGameLive(game: MlbGame): boolean {
  const status = (game.game_status || "").toLowerCase();
  return Boolean(game.live?.current_inning != null || status.includes("progress"));
}

function getDoubleheaderLabel(game: MlbGame): string | null {
  const isDoubleheader = game.doubleheader && game.doubleheader !== "N";
  if (!isDoubleheader || !game.game_num) return null;
  return `G${game.game_num}`;
}

export function GameFilterDropdown({
  games,
  selectedGame,
  onSelect,
}: {
  games: MlbGame[];
  selectedGame: string;
  onSelect: (gameId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visibleGames = games.filter((g) => {
    const status = (g.game_status || "").toLowerCase();
    return !status.includes("postponed") && !status.includes("cancelled");
  });

  const selectedGameData = selectedGame === "all"
    ? null
    : visibleGames.find((g) => String(g.game_id) === selectedGame);

  return (
    <div className={cn("relative", open && "z-50")} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
          "bg-neutral-100 dark:bg-neutral-800/60 hover:bg-neutral-200 dark:hover:bg-neutral-700/60",
          open && "ring-1 ring-brand/30"
        )}
      >
        {selectedGameData ? (
          <>
            <img src={`/team-logos/mlb/${selectedGameData.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
            <span className="text-neutral-700 dark:text-neutral-300">
              {selectedGameData.away_team_tricode} @ {selectedGameData.home_team_tricode}
            </span>
            <img src={`/team-logos/mlb/${selectedGameData.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain" alt="" />
          </>
        ) : (
          <span className="text-neutral-500">All Games</span>
        )}
        <ChevronDown className={cn("w-3 h-3 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/50 shadow-2xl overflow-hidden">
          {/* All Games option */}
          <button
            onClick={() => { onSelect("all"); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold transition-colors border-b border-neutral-100 dark:border-neutral-800/50",
              selectedGame === "all"
                ? "bg-brand/5 dark:bg-brand/10 text-brand"
                : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            )}
          >
            All Games
            {selectedGame === "all" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />}
          </button>

          {/* Game list */}
          <div className="max-h-[400px] overflow-y-auto">
            {visibleGames.map((g) => {
              const id = String(g.game_id);
              const isSelected = id === selectedGame;
              const isFinal = (g.game_status || "").toLowerCase().includes("final");
              const isLive = isGameLive(g);
              const showScore = isFinal || isLive;
              const statusLabel = getGameStatusLabel(g);
              const doubleheaderLabel = getDoubleheaderLabel(g);
              const awayWon = isFinal && g.away_team_score != null && g.home_team_score != null && g.away_team_score > g.home_team_score;
              const homeWon = isFinal && g.away_team_score != null && g.home_team_score != null && g.home_team_score > g.away_team_score;
              return (
                <button
                  key={g.game_id}
                  onClick={() => { onSelect(id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                    isSelected
                      ? "bg-brand/5 dark:bg-brand/10"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Away team row */}
                    <div className="flex items-center gap-1.5">
                      <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className={cn("w-4 h-4 object-contain shrink-0", isFinal && !awayWon && "opacity-60")} alt="" />
                      <span className={cn(
                        "w-8 text-[11px] font-bold",
                        awayWon ? "text-emerald-600 dark:text-emerald-300" : isFinal ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-900 dark:text-white"
                      )}>
                        {g.away_team_tricode}
                      </span>
                      <span className={cn("truncate text-[10px]", isFinal && !awayWon ? "text-neutral-600/70 dark:text-neutral-600" : "text-neutral-500")}>{lastNameOnly(g.away_probable_pitcher)}</span>
                      {showScore && <span className={cn(
                        "ml-auto text-[11px] font-bold tabular-nums shrink-0",
                        awayWon ? "text-emerald-600 dark:text-emerald-300" : isFinal ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-900 dark:text-white"
                      )}>{g.away_team_score ?? "-"}</span>}
                    </div>
                    {/* Home team row */}
                    <div className="flex items-center gap-1.5">
                      <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className={cn("w-4 h-4 object-contain shrink-0", isFinal && !homeWon && "opacity-60")} alt="" />
                      <span className={cn(
                        "w-8 text-[11px] font-bold",
                        homeWon ? "text-emerald-600 dark:text-emerald-300" : isFinal ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-900 dark:text-white"
                      )}>
                        {g.home_team_tricode}
                      </span>
                      <span className={cn("truncate text-[10px]", isFinal && !homeWon ? "text-neutral-600/70 dark:text-neutral-600" : "text-neutral-500")}>{lastNameOnly(g.home_probable_pitcher)}</span>
                      {showScore && <span className={cn(
                        "ml-auto text-[11px] font-bold tabular-nums shrink-0",
                        homeWon ? "text-emerald-600 dark:text-emerald-300" : isFinal ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-900 dark:text-white"
                      )}>{g.home_team_score ?? "-"}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                    {doubleheaderLabel && (
                      <span className="rounded bg-neutral-200/80 px-1 py-0.5 text-[8px] font-black leading-none text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {doubleheaderLabel}
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px] tabular-nums whitespace-nowrap",
                      isLive
                        ? "font-bold text-emerald-600 dark:text-emerald-400"
                        : isFinal
                        ? "font-semibold text-neutral-600 dark:text-neutral-300"
                        : "text-neutral-500"
                    )}>
                      {statusLabel}
                    </span>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

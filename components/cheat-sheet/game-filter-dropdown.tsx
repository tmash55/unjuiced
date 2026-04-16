"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { MlbGame } from "@/hooks/use-mlb-games";

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
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
                      <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white w-8">{g.away_team_tricode}</span>
                      <span className="text-[10px] text-neutral-500 truncate">{lastNameOnly(g.away_probable_pitcher)}</span>
                      {isFinal && <span className="ml-auto text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums shrink-0">{g.away_team_score}</span>}
                    </div>
                    {/* Home team row */}
                    <div className="flex items-center gap-1.5">
                      <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white w-8">{g.home_team_tricode}</span>
                      <span className="text-[10px] text-neutral-500 truncate">{lastNameOnly(g.home_probable_pitcher)}</span>
                      {isFinal && <span className="ml-auto text-[11px] font-bold text-neutral-900 dark:text-white tabular-nums shrink-0">{g.home_team_score}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                    {!isFinal && (
                      <span className="text-[10px] text-neutral-500 tabular-nums whitespace-nowrap">{g.game_status}</span>
                    )}
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

"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MlbGame } from "@/hooks/use-mlb-games";
import { ChevronDown } from "lucide-react";

function lastNameOnly(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "";
  if (pf >= 110) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (pf >= 103) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (pf <= 90) return "text-[#FC1414] dark:text-[#F87171]";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-500";
}

function hrImpactColor(score: number | null): string {
  if (score == null) return "";
  if (score >= 7) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (score >= 4) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (score <= -4) return "text-[#FC1414] dark:text-[#F87171]";
  return "text-neutral-500";
}

function getDateLabel(gameDate: string): string {
  const d = new Date(gameDate + "T12:00:00");
  const fmtET = (dt: Date) => dt.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const todayET = fmtET(new Date());
  const tomorrowDt = new Date();
  tomorrowDt.setDate(tomorrowDt.getDate() + 1);
  const tomorrowET = fmtET(tomorrowDt);
  if (gameDate === todayET) return "Today";
  if (gameDate === tomorrowET) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── GameChip (desktop) ─────────────────────────────────────────────────────

function GameChip({
  game,
  selected,
  onClick,
}: {
  game: MlbGame;
  selected: boolean;
  onClick: () => void;
}) {
  const w = game.weather;
  const isRetractable = w?.roof_type === "retractable" || w?.roof_type === "dome";

  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 w-[148px] rounded-lg border-2 px-2.5 py-1.5 text-center transition-all",
        selected
          ? "border-brand bg-brand/5 dark:bg-brand/10"
          : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 opacity-60 hover:opacity-100"
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        <img
          src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
          alt={game.away_team_tricode}
          className="h-4 w-4 object-contain shrink-0"
          loading="lazy"
        />
        <span className="text-[11px] font-bold text-neutral-900 dark:text-white">
          {game.away_team_tricode} @ {game.home_team_tricode}
        </span>
        <img
          src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
          alt={game.home_team_tricode}
          className="h-4 w-4 object-contain shrink-0"
          loading="lazy"
        />
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500 truncate">
        {lastNameOnly(game.away_probable_pitcher)} vs {lastNameOnly(game.home_probable_pitcher)}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
        <span className="text-neutral-400 tabular-nums">{game.game_status}</span>
        {game.park_factor != null && (
          <span className={cn("font-semibold tabular-nums", parkFactorColor(game.park_factor))}>
            PF {game.park_factor}
          </span>
        )}
        {isRetractable ? (
          <span className="text-neutral-400">Dome</span>
        ) : w && w.hr_impact_score != null ? (
          <span className={cn("font-medium tabular-nums", hrImpactColor(w.hr_impact_score))}>
            {w.hr_impact_score > 0 ? "+" : ""}{w.hr_impact_score}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ── Desktop Game Strip ──────────────────────────────────────────────────────

function DesktopGameStrip({
  games,
  selectedGameId,
  onSelect,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div data-tour="game-bar" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-2 py-2">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-0.5 px-0.5">
        {(() => {
          let lastDate = "";
          return games.map((g) => {
            const showDateHeader = g.game_date !== lastDate;
            lastDate = g.game_date;
            const dateLabel = getDateLabel(g.game_date);
            return (
              <React.Fragment key={g.game_id}>
                {showDateHeader && (
                  <div className="shrink-0 flex items-center px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 whitespace-nowrap">{dateLabel}</span>
                  </div>
                )}
                <GameChip
                  game={g}
                  selected={Number(g.game_id) === selectedGameId}
                  onClick={() => onSelect(Number(g.game_id))}
                />
              </React.Fragment>
            );
          });
        })()}
      </div>
    </div>
  );
}

// ── Mobile Game Selector ────────────────────────────────────────────────────

function MobileGameSelector({
  games,
  selectedGameId,
  onSelect,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = games.find((g) => Number(g.game_id) === selectedGameId);

  return (
    <div data-tour="game-bar" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-2 min-w-0">
            <img src={`/team-logos/mlb/${selected.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {selected.away_team_tricode} @ {selected.home_team_tricode}
            </span>
            <span className="text-[11px] text-neutral-400 shrink-0">
              {lastNameOnly(selected.away_probable_pitcher)} vs {lastNameOnly(selected.home_probable_pitcher)}
            </span>
            <img src={`/team-logos/mlb/${selected.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
          </div>
        ) : (
          <span className="text-sm text-neutral-500">Select a game</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-neutral-400 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800/50 max-h-[280px] overflow-y-auto">
          {(() => {
            let lastDate = "";
            return games.map((g) => {
              const isSelected = Number(g.game_id) === selectedGameId;
              const showDateHeader = g.game_date !== lastDate;
              lastDate = g.game_date;
              return (
                <React.Fragment key={g.game_id}>
                  {showDateHeader && (
                    <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800/50">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{getDateLabel(g.game_date)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { onSelect(Number(g.game_id)); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-neutral-100/50 dark:border-neutral-800/30 transition-colors",
                      isSelected
                        ? "bg-brand/5 dark:bg-brand/10"
                        : "active:bg-neutral-50 dark:active:bg-neutral-800/50"
                    )}
                  >
                    <img src={`/team-logos/mlb/${g.away_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" loading="lazy" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                        {g.away_team_tricode} @ {g.home_team_tricode}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate">
                        {lastNameOnly(g.away_probable_pitcher)} vs {lastNameOnly(g.home_probable_pitcher)}
                      </div>
                    </div>
                    <img src={`/team-logos/mlb/${g.home_team_tricode.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" loading="lazy" />
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-neutral-400 tabular-nums">{g.game_status}</span>
                      {g.park_factor != null && (
                        <span className={cn("font-semibold tabular-nums", parkFactorColor(g.park_factor))}>
                          PF {g.park_factor}
                        </span>
                      )}
                    </div>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
                  </button>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// ── Exported Component ──────────────────────────────────────────────────────

export function GameSelector({
  games,
  selectedGameId,
  onSelect,
  isMobile,
}: {
  games: MlbGame[];
  selectedGameId: number | null;
  onSelect: (id: number) => void;
  isMobile: boolean;
}) {
  // Filter out finished games
  const activeGames = useMemo(
    () =>
      games.filter((g) => {
        const status = (g.game_status || "").toLowerCase();
        return !status.includes("final") && !status.includes("postponed") && !status.includes("cancelled");
      }),
    [games]
  );

  if (activeGames.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center">
        <p className="text-sm text-neutral-500">
          {games.length > 0 ? "All games have finished" : "No games scheduled today"}
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileGameSelector
        games={activeGames}
        selectedGameId={selectedGameId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <DesktopGameStrip
      games={activeGames}
      selectedGameId={selectedGameId}
      onSelect={onSelect}
    />
  );
}

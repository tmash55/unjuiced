"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MlbGame } from "@/hooks/use-mlb-games";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { ChevronRight, Thermometer, Wind, CloudSun } from "lucide-react";

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(normalizeSportsbookId(bookId));
  return sb?.image?.square ?? sb?.image?.light ?? null;
}

function isGameFinal(status: string): boolean {
  return status.toLowerCase().includes("final");
}

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "text-neutral-500";
  if (pf >= 110) return "text-[#16A34A] dark:text-[#4ADE80]";
  if (pf >= 103) return "text-[#CA8A04] dark:text-[#FACC15]";
  if (pf <= 90) return "text-[#FC1414] dark:text-[#F87171]";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-500";
}

function windImpactColor(impact: string | null): string {
  if (!impact) return "";
  if (impact === "Blowing Out") return "text-emerald-600 dark:text-emerald-400";
  if (impact === "Blowing In") return "text-red-500 dark:text-red-400";
  return "";
}

function windImpactLabel(impact: string | null, label: string | null): string {
  if (impact === "Blowing Out") return "Out";
  if (impact === "Blowing In") return "In";
  return label?.split(" ").pop() || "";
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
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Single Game Card ────────────────────────────────────────────────────────

function ScoreboardCard({
  game,
  onClick,
  isMobile,
}: {
  game: MlbGame;
  onClick: () => void;
  isMobile: boolean;
}) {
  const w = game.weather;
  const odds = game.odds;
  const gameStatus = game.game_status || "TBD";
  const isFinal = isGameFinal(gameStatus);
  const fdLogo = getBookLogo("fanduel");
  const isRetractable = w?.roof_type === "retractable" || w?.roof_type === "dome";

  if (isMobile) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-all active:bg-neutral-50 dark:active:bg-neutral-800/50"
      >
        <div className="px-3 py-3">
          {/* Teams row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <img
                src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
                className="w-8 h-8 object-contain shrink-0"
                alt=""
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-neutral-900 dark:text-white">{game.away_team_name}</div>
                <div className="text-[10px] text-neutral-500 truncate">
                  {game.away_team_record && <span className="text-neutral-400">({game.away_team_record}) </span>}
                  {game.away_probable_pitcher || "TBD"}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center px-3 shrink-0">
              {isFinal ? (
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.away_team_score ?? 0}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Final</span>
                  <span className="text-base font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.home_team_score ?? 0}</span>
                </div>
              ) : (
                <span className="text-base font-extrabold text-neutral-900 dark:text-white tabular-nums">{gameStatus}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-row-reverse">
              <img
                src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
                className="w-8 h-8 object-contain shrink-0"
                alt=""
              />
              <div className="min-w-0 text-right">
                <div className="text-sm font-bold text-neutral-900 dark:text-white">{game.home_team_name}</div>
                <div className="text-[10px] text-neutral-500 truncate">
                  {game.home_probable_pitcher || "TBD"}
                  {game.home_team_record && <span className="text-neutral-400"> ({game.home_team_record})</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Info strip */}
          <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-neutral-500 flex-wrap">
            {odds?.away_ml && odds?.home_ml && (
              <span className="font-mono tabular-nums">
                {odds.away_ml} / {odds.home_ml}
              </span>
            )}
            {odds?.total != null && (
              <span className="font-mono tabular-nums">O/U {odds.total}</span>
            )}
            {w?.temperature_f != null && !isRetractable && (
              <span>{w.temperature_f}°F</span>
            )}
            {game.park_factor != null && (
              <span className={cn("font-bold", parkFactorColor(game.park_factor))}>PF {game.park_factor}</span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Desktop card
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden hover:border-brand/40 dark:hover:border-brand/30 hover:shadow-md hover:shadow-brand/5 transition-all group"
    >
      <div className="px-5 py-4">
        <div className="flex items-center">
          {/* Away team */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
              className="w-10 h-10 object-contain shrink-0"
              alt={game.away_team_tricode}
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-sm font-bold text-neutral-900 dark:text-white leading-tight truncate">{game.away_team_name}</span>
                {game.away_team_record && (
                  <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">({game.away_team_record})</span>
                )}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{game.away_probable_pitcher || "TBD"}</div>
            </div>
            {odds?.away_ml && (
              <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 tabular-nums ml-auto shrink-0">{odds.away_ml}</span>
            )}
          </div>

          {/* Center divider + time/score */}
          <div className="flex flex-col items-center px-6 shrink-0">
            {isFinal ? (
              <div className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.away_team_score ?? 0}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Final</span>
                <span className="text-lg font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.home_team_score ?? 0}</span>
              </div>
            ) : (
              <span className="text-lg font-extrabold text-neutral-900 dark:text-white tabular-nums tracking-tight">{gameStatus}</span>
            )}
            {odds?.total != null && !isFinal && (
              <div className="flex items-center gap-1 mt-1">
                {fdLogo && <img src={fdLogo} alt="" className="h-3 w-3 rounded object-contain opacity-40" />}
                <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                  O/U <span className="font-bold text-neutral-600 dark:text-neutral-300">{odds.total}</span>
                </span>
              </div>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-3 min-w-0 flex-1 flex-row-reverse">
            <img
              src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
              className="w-10 h-10 object-contain shrink-0"
              alt={game.home_team_tricode}
            />
            <div className="min-w-0 text-right">
              <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                {game.home_team_record && (
                  <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">({game.home_team_record})</span>
                )}
                <span className="text-sm font-bold text-neutral-900 dark:text-white leading-tight truncate">{game.home_team_name}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{game.home_probable_pitcher || "TBD"}</div>
            </div>
            {odds?.home_ml && (
              <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 tabular-nums mr-auto shrink-0">{odds.home_ml}</span>
            )}
          </div>

          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-neutral-300 dark:text-neutral-600 shrink-0 ml-4 group-hover:text-brand transition-colors" />
        </div>
      </div>

      {/* Bottom info strip */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/10">
        <div className="flex items-center gap-4 text-[11px] text-neutral-500">
          {w?.venue_name && (
            <span className="text-neutral-400">{w.venue_name}</span>
          )}
          {game.park_factor != null && (
            <span className={cn("font-bold tabular-nums", parkFactorColor(game.park_factor))}>
              PF {game.park_factor}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500">
          {w?.temperature_f != null && !isRetractable && (
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-neutral-400" />
              <span className="font-medium">{w.temperature_f}°F</span>
            </span>
          )}
          {w?.wind_speed_mph != null && w.wind_speed_mph > 0 && !isRetractable && (
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-neutral-400" />
              <span className="font-medium">{w.wind_speed_mph} mph</span>
              {w.wind_impact && (
                <span className={cn("font-bold", windImpactColor(w.wind_impact))}>
                  {windImpactLabel(w.wind_impact, w.wind_label)}
                </span>
              )}
            </span>
          )}
          {isRetractable && (
            <span className="flex items-center gap-1">
              <CloudSun className="w-3 h-3 text-neutral-400" />
              <span className="font-medium">{w?.roof_type === "dome" ? "Dome" : "Retractable"}</span>
            </span>
          )}
          {w?.hr_impact_score != null && !isRetractable && (
            <span className={cn(
              "font-bold tabular-nums",
              (w.hr_impact_score ?? 0) >= 4 ? "text-[#16A34A] dark:text-[#4ADE80]" :
              (w.hr_impact_score ?? 0) <= -4 ? "text-[#FC1414] dark:text-[#F87171]" :
              "text-neutral-500"
            )}>
              HR {(w.hr_impact_score ?? 0) > 0 ? "+" : ""}{w.hr_impact_score}
            </span>
          )}
          {(odds?.away_total != null || odds?.home_total != null) && (
            <span className="font-mono tabular-nums text-neutral-400">
              TT{" "}
              <span className="font-medium text-neutral-600 dark:text-neutral-300">{odds?.away_total ?? "-"}</span>
              <span className="mx-0.5">/</span>
              <span className="font-medium text-neutral-600 dark:text-neutral-300">{odds?.home_total ?? "-"}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Exported Scoreboard ─────────────────────────────────────────────────────

export function GameScoreboard({
  games,
  onSelectGame,
  isMobile,
}: {
  games: MlbGame[];
  onSelectGame: (gameId: number) => void;
  isMobile: boolean;
}) {
  // Filter out cancelled/postponed but keep finals
  const visibleGames = useMemo(() =>
    games.filter((g) => {
      const status = (g.game_status || "").toLowerCase();
      return !status.includes("postponed") && !status.includes("cancelled");
    }),
    [games]
  );

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; games: MlbGame[] }[] = [];
    let currentDate = "";
    for (const g of visibleGames) {
      if (g.game_date !== currentDate) {
        currentDate = g.game_date;
        groups.push({ date: g.game_date, label: getDateLabel(g.game_date), games: [] });
      }
      groups[groups.length - 1].games.push(g);
    }
    return groups;
  }, [visibleGames]);

  if (visibleGames.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-12 text-center">
        <p className="text-sm text-neutral-500">
          {games.length > 0 ? "All games have finished" : "No games scheduled today"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.date}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{group.label}</h3>
            <span className="text-xs text-neutral-400 tabular-nums">{group.games.length} game{group.games.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Game cards */}
          <div className={cn(
            "grid gap-2",
            isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
          )}>
            {group.games.map((g) => (
              <ScoreboardCard
                key={g.game_id}
                game={g}
                onClick={() => onSelectGame(Number(g.game_id))}
                isMobile={isMobile}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

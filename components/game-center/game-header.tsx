"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { MlbGame } from "@/hooks/use-mlb-games";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { BasesDiamond } from "@/components/game-center/bases-diamond";
import { Thermometer, Wind, CloudSun } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(normalizeSportsbookId(bookId));
  return sb?.image?.square ?? sb?.image?.light ?? null;
}

function isGameFinal(status: string): boolean {
  return status.toLowerCase().includes("final");
}

function parkFactorColor(pf: number | null): string {
  if (pf == null) return "text-neutral-500";
  if (pf >= 110) return "text-emerald-500 dark:text-emerald-400";
  if (pf >= 103) return "text-amber-500 dark:text-amber-400";
  if (pf <= 90) return "text-red-500 dark:text-red-400";
  if (pf <= 97) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-500";
}

function windImpactColor(impact: string | null): string {
  if (!impact) return "text-neutral-500 dark:text-neutral-400";
  if (impact === "Blowing Out") return "text-emerald-600 dark:text-emerald-400";
  if (impact === "Blowing In") return "text-red-500 dark:text-red-400";
  return "text-neutral-500 dark:text-neutral-400";
}

function windImpactLabel(impact: string | null, label: string | null): string {
  if (impact === "Blowing Out") return "Out";
  if (impact === "Blowing In") return "In";
  return label?.split(" ").pop() || "";
}

// ── Live State Sub-Components ──────────────────────────────────────────────

function InningIndicator({ inning, half }: { inning: number; half: "top" | "bottom" | null }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-emerald-400 font-bold leading-none">
        {half === "top" ? "▲" : "▼"}
      </span>
      <span className="text-sm font-extrabold text-emerald-400 tabular-nums leading-none">{inning}</span>
    </div>
  );
}

function OutsIndicator({ outs }: { outs: number }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[7px] h-[7px] rounded-full border",
            i < outs
              ? "bg-amber-400 border-amber-500"
              : "border-neutral-400 dark:border-neutral-600 bg-transparent"
          )}
        />
      ))}
    </div>
  );
}

function CountDisplay({ balls, strikes }: { balls: number; strikes: number }) {
  return (
    <div className="flex items-center gap-1 tabular-nums">
      <span className="text-[9px] font-bold text-emerald-400 w-2.5 text-center">{balls}</span>
      <span className="text-[9px] text-neutral-500">-</span>
      <span className="text-[9px] font-bold text-amber-400 w-2.5 text-center">{strikes}</span>
    </div>
  );
}

// ── Live State Panel ───────────────────────────────────────────────────────

function LiveStatePanel({ game, compact = false }: { game: MlbGame; compact?: boolean }) {
  const live = game.live;
  if (!live || live.current_inning == null) return null;

  const runners = live.runners_on_base ?? { first: false, second: false, third: false };

  if (compact) {
    // Mobile: horizontal compact strip
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-3">
          <InningIndicator inning={live.current_inning} half={live.current_inning_half} />
          <BasesDiamond runners={runners} size="sm" />
          <div className="flex flex-col items-center gap-0.5">
            <CountDisplay balls={live.current_balls ?? 0} strikes={live.current_strikes ?? 0} />
            <OutsIndicator outs={live.current_outs ?? 0} />
          </div>
        </div>
        {live.current_batter_name && (
          <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
            AB: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{live.current_batter_name.split(" ").pop()}</span>
          </span>
        )}
      </div>
    );
  }

  // Desktop: vertical stack
  return (
    <div className="flex flex-col items-center gap-2">
      <InningIndicator inning={live.current_inning} half={live.current_inning_half} />
      <div className="flex items-center gap-3">
        <BasesDiamond runners={runners} size="md" />
        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700/50" />
        <div className="flex flex-col items-center gap-1">
          <CountDisplay balls={live.current_balls ?? 0} strikes={live.current_strikes ?? 0} />
          <OutsIndicator outs={live.current_outs ?? 0} />
        </div>
      </div>
      {live.current_batter_name && (
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
          AB: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{live.current_batter_name.split(" ").pop()}</span>
        </span>
      )}
    </div>
  );
}

// ── Weather & Info Strip ───────────────────────────────────────────────────

function InfoStrip({ game }: { game: MlbGame }) {
  const w = game.weather;
  const isRetractable = w?.roof_type === "retractable" || w?.roof_type === "dome";
  if (!w && game.park_factor == null) return null;

  return (
    <div className="flex items-center justify-center gap-5 px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/10 flex-wrap">
      {w?.temperature_f != null && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <Thermometer className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-900 dark:text-white tabular-nums">{w.temperature_f}°F</span>
        </div>
      )}
      {w?.wind_speed_mph != null && w.wind_speed_mph > 0 && !isRetractable && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <Wind className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-medium tabular-nums">{w.wind_speed_mph} mph</span>
          {w.wind_impact && (
            <span className={cn("font-bold", windImpactColor(w.wind_impact))}>
              {windImpactLabel(w.wind_impact, w.wind_label)}
            </span>
          )}
        </div>
      )}
      {isRetractable && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <CloudSun className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-medium">{w?.roof_type === "dome" ? "Dome" : "Retractable"}</span>
        </div>
      )}
      {game.park_factor != null && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400 font-medium">PF</span>
          <span className={cn("font-bold tabular-nums", parkFactorColor(game.park_factor))}>
            {game.park_factor}
          </span>
        </div>
      )}
      {w?.hr_impact_score != null && !isRetractable && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400 font-medium">HR Impact</span>
          <span className={cn(
            "font-bold tabular-nums",
            w.hr_impact_score >= 4 ? "text-emerald-500 dark:text-emerald-400" :
            w.hr_impact_score <= -4 ? "text-red-500 dark:text-red-400" :
            "text-neutral-500"
          )}>
            {w.hr_impact_score > 0 ? "+" : ""}{w.hr_impact_score}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Desktop Header ─────────────────────────────────────────────────────────

function DesktopGameHeader({ game }: { game: MlbGame }) {
  const w = game.weather;
  const odds = game.odds;
  const live = game.live;
  const gameStatus = game.game_status || "TBD";
  const isFinal = isGameFinal(gameStatus);
  const isLive = gameStatus.toLowerCase().includes("progress");
  const hasScore = game.away_team_score != null && game.home_team_score != null && (isFinal || isLive);
  const fdLogo = getBookLogo("fanduel");

  const awayPitcherDisplay = isLive && live?.current_pitcher_name && live.current_inning_half === "bottom"
    ? live.current_pitcher_name
    : (game.away_probable_pitcher || "TBD");
  const homePitcherDisplay = isLive && live?.current_pitcher_name && live.current_inning_half === "top"
    ? live.current_pitcher_name
    : (game.home_probable_pitcher || "TBD");

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      {/* Main scoreboard */}
      <div className="relative px-6 py-5">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-50 via-transparent to-neutral-50 dark:from-neutral-800/20 dark:via-transparent dark:to-neutral-800/20 pointer-events-none" />

        <div className="relative flex items-center justify-between">
          {/* Away team */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <img
              src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
              className="w-14 h-14 object-contain shrink-0"
              alt={game.away_team_tricode}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                  {game.away_team_name}
                </span>
                {game.away_team_record && (
                  <span className="text-xs text-neutral-400 tabular-nums">({game.away_team_record})</span>
                )}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{awayPitcherDisplay}</div>
              {odds?.away_ml && (
                <div className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300 mt-0.5 tabular-nums">
                  {odds.away_ml}
                </div>
              )}
            </div>
          </div>

          {/* Center: scoreboard */}
          <div className="flex flex-col items-center gap-1.5 px-4 shrink-0 min-w-[140px]">
            {hasScore ? (
              <>
                <div className="flex items-center gap-5">
                  <span className="text-3xl font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.away_team_score ?? 0}</span>
                  <div className="flex flex-col items-center">
                    {isLive ? (
                      <>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1">Live</span>
                        <LiveStatePanel game={game} />
                      </>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Final</span>
                    )}
                  </div>
                  <span className="text-3xl font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.home_team_score ?? 0}</span>
                </div>
              </>
            ) : (
              <div className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {gameStatus}
              </div>
            )}
            {w?.venue_name && (
              <div className="text-[10px] text-neutral-400 whitespace-nowrap">{w.venue_name}</div>
            )}
            {/* Odds */}
            {odds && (
              <div className="flex items-center gap-3 mt-0.5">
                {fdLogo && (
                  <img src={fdLogo} alt="" className="h-4 w-4 rounded object-contain opacity-50" />
                )}
                {odds.total != null && (
                  <span className="text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                    O/U <span className="font-bold text-neutral-900 dark:text-white">{odds.total}</span>
                  </span>
                )}
                {(odds.away_total != null || odds.home_total != null) && (
                  <span className="text-xs font-mono tabular-nums text-neutral-500">
                    TT{" "}
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{odds.away_total ?? "-"}</span>
                    <span className="text-neutral-300 dark:text-neutral-600 mx-0.5">/</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{odds.home_total ?? "-"}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-4 min-w-0 flex-1 flex-row-reverse">
            <img
              src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
              className="w-14 h-14 object-contain shrink-0"
              alt={game.home_team_tricode}
            />
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-2">
                {game.home_team_record && (
                  <span className="text-xs text-neutral-400 tabular-nums">({game.home_team_record})</span>
                )}
                <span className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                  {game.home_team_name}
                </span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{homePitcherDisplay}</div>
              {odds?.home_ml && (
                <div className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300 mt-0.5 tabular-nums">
                  {odds.home_ml}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weather & park strip */}
      <InfoStrip game={game} />
    </div>
  );
}

// ── Mobile Header ──────────────────────────────────────────────────────────

function MobileGameHeader({ game }: { game: MlbGame }) {
  const w = game.weather;
  const odds = game.odds;
  const live = game.live;
  const gameStatus = game.game_status || "TBD";
  const isFinal = isGameFinal(gameStatus);
  const isLive = gameStatus.toLowerCase().includes("progress");
  const hasScore = game.away_team_score != null && game.home_team_score != null && (isFinal || isLive);
  const fdLogo = getBookLogo("fanduel");
  const isRetractable = w?.roof_type === "retractable" || w?.roof_type === "dome";

  const awayPitcherDisplay = isLive && live?.current_pitcher_name && live.current_inning_half === "bottom"
    ? live.current_pitcher_name
    : (game.away_probable_pitcher || "TBD");
  const homePitcherDisplay = isLive && live?.current_pitcher_name && live.current_inning_half === "top"
    ? live.current_pitcher_name
    : (game.home_probable_pitcher || "TBD");

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
      {/* Matchup */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Away */}
          <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
            <img
              src={`/team-logos/mlb/${game.away_team_tricode.toUpperCase()}.svg`}
              className="w-12 h-12 object-contain"
              alt={game.away_team_tricode}
            />
            <span className="text-sm font-bold text-neutral-900 dark:text-white">{game.away_team_tricode}</span>
            <span className="text-[10px] text-neutral-500 truncate max-w-[100px] text-center">
              {awayPitcherDisplay}
            </span>
            {odds?.away_ml && (
              <span className="text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                {odds.away_ml}
              </span>
            )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-1.5 px-3 shrink-0 min-w-[80px]">
            {hasScore ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.away_team_score ?? 0}</span>
                  <div className="flex flex-col items-center">
                    <span className={cn("text-[9px] font-black uppercase tracking-wider", isLive ? "text-emerald-400" : "text-neutral-400")}>
                      {isLive ? "Live" : "Final"}
                    </span>
                  </div>
                  <span className="text-2xl font-extrabold text-neutral-900 dark:text-white tabular-nums">{game.home_team_score ?? 0}</span>
                </div>
                {isLive && <LiveStatePanel game={game} compact />}
              </>
            ) : (
              <div className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                {gameStatus}
              </div>
            )}
            {odds?.total != null && (
              <div className="flex items-center gap-1 mt-0.5">
                {fdLogo && (
                  <img src={fdLogo} alt="" className="h-3 w-3 rounded object-contain opacity-50" />
                )}
                <span className="text-[10px] font-mono tabular-nums text-neutral-500">
                  O/U <span className="font-bold text-neutral-900 dark:text-white">{odds.total}</span>
                </span>
              </div>
            )}
          </div>

          {/* Home */}
          <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
            <img
              src={`/team-logos/mlb/${game.home_team_tricode.toUpperCase()}.svg`}
              className="w-12 h-12 object-contain"
              alt={game.home_team_tricode}
            />
            <span className="text-sm font-bold text-neutral-900 dark:text-white">{game.home_team_tricode}</span>
            <span className="text-[10px] text-neutral-500 truncate max-w-[100px] text-center">
              {homePitcherDisplay}
            </span>
            {odds?.home_ml && (
              <span className="text-[11px] font-mono font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                {odds.home_ml}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      {(w || game.park_factor != null) && (
        <div className="flex items-center justify-center gap-4 px-3 py-2 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/10 flex-wrap">
          {w?.venue_name && (
            <span className="text-[10px] text-neutral-400">{w.venue_name}</span>
          )}
          {w?.temperature_f != null && (
            <span className="text-[10px] font-semibold text-neutral-900 dark:text-white tabular-nums">{w.temperature_f}°F</span>
          )}
          {w?.wind_speed_mph != null && w.wind_speed_mph > 0 && !isRetractable && (
            <span className="text-[10px] text-neutral-500">
              {w.wind_speed_mph}mph{" "}
              <span className={cn("font-bold", windImpactColor(w.wind_impact))}>
                {windImpactLabel(w.wind_impact, w.wind_label)}
              </span>
            </span>
          )}
          {isRetractable && (
            <span className="text-[10px] text-neutral-500 font-medium">
              {w?.roof_type === "dome" ? "Dome" : "Retractable"}
            </span>
          )}
          {game.park_factor != null && (
            <span className={cn("text-[10px] font-bold tabular-nums", parkFactorColor(game.park_factor))}>
              PF {game.park_factor}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Exported Component ──────────────────────────────────────────────────────

export function GameHeader({
  game,
  isMobile,
}: {
  game: MlbGame;
  isMobile: boolean;
}) {
  if (isMobile) return <MobileGameHeader game={game} />;
  return <DesktopGameHeader game={game} />;
}

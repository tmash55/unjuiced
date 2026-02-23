"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { GameLogChart } from "@/components/hit-rates/game-log-chart";
import { BoxScoreTable } from "@/components/hit-rates/box-score-table";
import {
  MarketSelectorStrip,
  type MarketHitRateData,
} from "@/components/hit-rates/player-drilldown";
import { DEFAULT_FILTERS } from "@/components/hit-rates/chart-filters";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useMlbPlayerGameLogs } from "@/hooks/use-mlb-player-game-logs";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

const MLB_MARKET_ORDER = [
  "player_hits",
  "player_home_runs",
  "player_runs_scored",
  "player_rbi",
  "player_total_bases",
  "pitcher_strikeouts",
] as const;

const POSITION_LABELS: Record<string, string> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First Base",
  "2B": "Second Base",
  "3B": "Third Base",
  SS: "Shortstop",
  OF: "Outfield",
  DH: "Designated Hitter",
};

interface MlbPlayerDrilldownProps {
  profile: HitRateProfile;
  allPlayerProfiles?: HitRateProfile[];
  onBack: () => void;
  onMarketChange?: (market: string) => void;
}

type QuickFilterKey =
  | "home"
  | "away"
  | "win"
  | "loss"
  | "wonBy10"
  | "lostBy10"
  | "primetime"
  | "dvpTough"
  | "dvpAverage"
  | "dvpWeak";

function getInjuryIconColor(status: string | null): string {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500";
}

function formatAvg(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(1);
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

function formatBattingAverage(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = value > 1 ? value / 1000 : value;
  if (!Number.isFinite(normalized) || normalized < 0) return null;
  return normalized.toFixed(3).replace(/^0/, "");
}

function toOrdinal(value: number): string {
  const abs = Math.abs(value);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (abs % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function getCurrentEtYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
    }).format(new Date())
  );
}

function getMlbMarketValue(game: BoxScoreGame, market: string): number {
  switch (market) {
    case "player_hits":
      return game.mlbHits ?? 0;
    case "player_home_runs":
      return game.mlbHomeRuns ?? 0;
    case "player_runs_scored":
      return game.mlbRunsScored ?? 0;
    case "player_rbi":
      return game.mlbRbi ?? 0;
    case "player_total_bases":
      return game.mlbTotalBases ?? 0;
    case "pitcher_strikeouts":
      return game.mlbPitcherStrikeouts ?? 0;
    default:
      return 0;
  }
}

export function MlbPlayerDrilldown({
  profile,
  allPlayerProfiles,
  onBack,
  onMarketChange,
}: MlbPlayerDrilldownProps) {
  const sortedMarkets = useMemo(() => {
    const source = allPlayerProfiles && allPlayerProfiles.length > 0 ? allPlayerProfiles : [profile];
    const unique = new Map<string, HitRateProfile>();

    for (const item of source) {
      if (!unique.has(item.market)) {
        unique.set(item.market, item);
      }
    }

    return Array.from(unique.values()).sort((a, b) => {
      const ai = MLB_MARKET_ORDER.indexOf(a.market as (typeof MLB_MARKET_ORDER)[number]);
      const bi = MLB_MARKET_ORDER.indexOf(b.market as (typeof MLB_MARKET_ORDER)[number]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [allPlayerProfiles, profile]);

  const [selectedMarket, setSelectedMarket] = useState(profile.market);
  const activeProfile =
    sortedMarkets.find((item) => item.market === selectedMarket) ?? sortedMarkets[0] ?? profile;

  const [line, setLine] = useState<number | null>(activeProfile.line);
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedMarket(profile.market);
  }, [profile.market]);

  useEffect(() => {
    setLine(activeProfile.line);
    setQuickFilters(new Set());
  }, [activeProfile.id, activeProfile.line]);

  const querySeason = activeProfile.gameDate
    ? Number(activeProfile.gameDate.slice(0, 4))
    : getCurrentEtYear();

  const { entries, games, isLoading, error } = useMlbPlayerGameLogs({
    playerId: activeProfile.playerId,
    market: activeProfile.market,
    season: querySeason,
    limit: 60,
    enabled: !!activeProfile.playerId,
  });

  const filteredGames = useMemo(() => {
    if (quickFilters.size === 0) return games;

    return games.filter((game) => {
      const margin = game.margin ?? game.teamScore - game.opponentScore;
      if (quickFilters.has("home") && game.homeAway !== "H") return false;
      if (quickFilters.has("away") && game.homeAway !== "A") return false;
      if (quickFilters.has("win") && game.result !== "W") return false;
      if (quickFilters.has("loss") && game.result !== "L") return false;
      if (quickFilters.has("wonBy10") && (game.result !== "W" || margin < 10)) return false;
      if (quickFilters.has("lostBy10") && (game.result !== "L" || Math.abs(margin) < 10)) return false;
      return true;
    });
  }, [games, quickFilters]);

  const hitRateAtLine = useMemo(() => {
    if (line === null || filteredGames.length === 0) return null;
    const hits = filteredGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
    return Math.round((hits / filteredGames.length) * 100);
  }, [filteredGames, activeProfile.market, line]);

  const recentAvg = useMemo(() => {
    if (filteredGames.length === 0) return null;
    const last10 = filteredGames.slice(0, 10);
    const total = last10.reduce((sum, game) => sum + getMlbMarketValue(game, activeProfile.market), 0);
    return total / last10.length;
  }, [filteredGames, activeProfile.market]);

  const lineDelta = useMemo(() => {
    if (line === null || activeProfile.seasonAvg === null) return null;
    return activeProfile.seasonAvg - line;
  }, [activeProfile.seasonAvg, line]);

  const marketHitRates = useMemo<Map<string, MarketHitRateData>>(() => {
    const map = new Map<string, MarketHitRateData>();
    if (line === null || filteredGames.length === 0) {
      return map;
    }
    const hits = filteredGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
    map.set(activeProfile.market, {
      hitRate: Math.round((hits / filteredGames.length) * 100),
      hits,
      total: filteredGames.length,
      expectedTotal: games.length,
    });
    return map;
  }, [activeProfile.market, filteredGames, games.length, line]);

  const emptyInjuryFilters = useMemo(() => [], []);
  const emptyPlayTypeFilters = useMemo(() => [], []);
  const emptyShotZoneFilters = useMemo(() => [], []);

  const hasInjuryStatus =
    !!activeProfile.injuryStatus &&
    activeProfile.injuryStatus.toLowerCase() !== "available" &&
    activeProfile.injuryStatus.toLowerCase() !== "active";

  const positionLabel = activeProfile.position
    ? POSITION_LABELS[activeProfile.position] || activeProfile.position
    : "Position N/A";
  const derivedBattingHandFromLogs =
    entries.find((entry) => entry.battingHand && ["L", "R", "S"].includes(entry.battingHand))?.battingHand ?? null;
  const battingHand =
    (activeProfile.battingHand && ["L", "R", "S"].includes(activeProfile.battingHand)
      ? activeProfile.battingHand
      : null) ?? derivedBattingHandFromLogs;
  const derivedSeasonBattingAvgFromLogs = useMemo(() => {
    const totals = games.reduce(
      (acc, game) => {
        acc.hits += Number(game.mlbHits ?? 0);
        acc.atBats += Number(game.mlbAtBats ?? 0);
        return acc;
      },
      { hits: 0, atBats: 0 }
    );
    if (totals.atBats <= 0) return null;
    return totals.hits / totals.atBats;
  }, [games]);
  const seasonBattingAvg = formatBattingAverage(activeProfile.seasonBattingAvg ?? derivedSeasonBattingAvgFromLogs);
  const derivedLineupPositionFromLogs =
    entries.find((entry) => typeof entry.lineupPosition === "number" && entry.lineupPosition > 0)?.lineupPosition ?? null;
  const lineupPosition =
    (typeof activeProfile.lineupPosition === "number" && activeProfile.lineupPosition > 0
      ? activeProfile.lineupPosition
      : null) ?? derivedLineupPositionFromLogs;
  const lineupLabel = lineupPosition ? `Batting ${toOrdinal(lineupPosition)}` : null;

  const handleMarketSelect = (market: string) => {
    setSelectedMarket(market);
    onMarketChange?.(market);
  };

  const toggleQuickFilter = (key: QuickFilterKey) => {
    setQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-40 -mx-3 px-3 pb-4 pt-1 bg-gradient-to-b from-white via-white to-white/95 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-950/95 backdrop-blur-xl">
        <div
          className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5"
          style={{
            background: activeProfile.primaryColor
              ? `linear-gradient(135deg, ${activeProfile.primaryColor}15 0%, ${activeProfile.primaryColor}05 40%, transparent 70%)`
              : undefined,
          }}
        >
          <div className="flex items-stretch">
            <div className="flex-1 flex items-center gap-5 p-5 bg-gradient-to-r from-white/60 via-white/40 to-transparent dark:from-neutral-900/60 dark:via-neutral-900/40 dark:to-transparent">
              <button
                type="button"
                onClick={onBack}
                className="p-2.5 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-white/80 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 shrink-0 backdrop-blur-sm"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div
                className="h-20 w-20 rounded-2xl overflow-hidden shadow-xl shrink-0 ring-2 ring-white dark:ring-neutral-700 transition-transform hover:scale-105"
                style={{
                  background: activeProfile.primaryColor && activeProfile.secondaryColor
                    ? `linear-gradient(180deg, ${activeProfile.primaryColor} 0%, ${activeProfile.secondaryColor} 100%)`
                    : activeProfile.primaryColor || "#374151",
                }}
              >
                <PlayerHeadshot
                  nbaPlayerId={activeProfile.playerId}
                  mlbPlayerId={activeProfile.playerId}
                  sport="mlb"
                  name={activeProfile.playerName}
                  size="small"
                  className="h-full w-full object-cover"
                  priority
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-white leading-tight tracking-tight">
                    {activeProfile.playerName}
                  </h1>
                  {hasInjuryStatus && (
                    <HeartPulse
                      className={cn("h-5 w-5", getInjuryIconColor(activeProfile.injuryStatus))}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {activeProfile.teamAbbr && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50">
                      <img
                        src={`/team-logos/mlb/${activeProfile.teamAbbr.toUpperCase()}.svg`}
                        alt={activeProfile.teamAbbr}
                        className="h-4 w-4 object-contain"
                      />
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">
                        {activeProfile.teamAbbr}
                      </span>
                    </div>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 font-semibold text-neutral-600 dark:text-neutral-400">
                    {positionLabel}
                  </span>
                  {battingHand && (
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 font-semibold text-neutral-600 dark:text-neutral-400">
                      Bats {battingHand}
                    </span>
                  )}
                  {seasonBattingAvg && (
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 font-semibold text-neutral-600 dark:text-neutral-400">
                      AVG {seasonBattingAvg}
                    </span>
                  )}
                  <span className="font-medium text-neutral-400">#{activeProfile.jerseyNumber ?? "-"}</span>
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">Next</span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                      {activeProfile.homeAway === "H" ? "vs" : "@"}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      {activeProfile.opponentTeamAbbr || "OPP"}
                    </span>
                    <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">•</span>
                    <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                      {activeProfile.gameStatus || "TBD"}
                    </span>
                    {lineupLabel && (
                      <>
                        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">•</span>
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {lineupLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pl-6 pr-5 py-4 border-l border-neutral-200/60 dark:border-neutral-800/60 bg-gradient-to-l from-white/40 to-transparent dark:from-neutral-900/40 dark:to-transparent min-w-[300px]">
              <div className="rounded-xl px-3 py-2.5 text-white shadow-md" style={{ backgroundColor: activeProfile.primaryColor || "#0EA5E9" }}>
                <p className="text-[10px] uppercase tracking-wide text-white/80">Prop</p>
                <p className="text-sm font-bold truncate">{line ?? "-"}+ {formatMarketLabel(activeProfile.market)}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 min-w-[92px]">
                  <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">O</span>
                  <span className="text-sm font-bold tabular-nums text-neutral-500 dark:text-neutral-400">—</span>
                </div>
                <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 min-w-[92px]">
                  <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">U</span>
                  <span className="text-sm font-bold tabular-nums text-neutral-500 dark:text-neutral-400">—</span>
                </div>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Odds coming soon</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-neutral-500">L10</p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{formatPct(activeProfile.last10Pct)}</p>
                </div>
                <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-neutral-500">Szn Avg</p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{formatAvg(activeProfile.seasonAvg)}</p>
                </div>
                <div className="rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-neutral-500">vs Line</p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{formatSigned(lineDelta)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {sortedMarkets.length > 1 && (
          <MarketSelectorStrip
            sortedMarkets={sortedMarkets}
            selectedMarket={selectedMarket}
            setSelectedMarket={handleMarketSelect}
            marketHitRates={marketHitRates}
            customLine={line}
            quickFilters={quickFilters}
            chartFilters={DEFAULT_FILTERS}
            injuryFilters={emptyInjuryFilters}
            playTypeFilters={emptyPlayTypeFilters}
            shotZoneFilters={emptyShotZoneFilters}
            onClearAllFilters={() => setQuickFilters(new Set())}
            onRemoveQuickFilter={(filter) => {
              setQuickFilters((prev) => {
                const next = new Set(prev);
                next.delete(filter);
                return next;
              });
            }}
            onRemoveInjuryFilter={() => {}}
            onRemovePlayTypeFilter={() => {}}
            onRemoveShotZoneFilter={() => {}}
            filteredGamesCount={filteredGames.length}
            totalGamesCount={games.length}
          />
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-medium">Adjustable Line</span>
          <span className="text-neutral-400">•</span>
          <span>
            Current: <span className="font-semibold text-neutral-900 dark:text-white">{line ?? "-"}</span>
          </span>
          {hitRateAtLine !== null && (
            <>
              <span className="text-neutral-400">•</span>
              <span>
                Hit Rate: <span className="font-semibold text-neutral-900 dark:text-white">{hitRateAtLine}%</span>
              </span>
            </>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-300">
            {error.message || "Failed to load MLB game logs"}
          </div>
        ) : (
          <GameLogChart
            games={filteredGames}
            line={line}
            market={activeProfile.market}
            sport="mlb"
            onLineChange={setLine}
            quickFilters={quickFilters}
            onQuickFilterToggle={toggleQuickFilter}
            onQuickFiltersClear={() => setQuickFilters(new Set())}
            className="min-h-[340px]"
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-neutral-500">Sample</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">{filteredGames.length}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-neutral-500">L10 Avg</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">{formatAvg(recentAvg)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-neutral-500">Season Hit %</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">{formatPct(activeProfile.seasonPct)}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <div className="text-xs text-neutral-500">Market</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{formatMarketLabel(activeProfile.market)}</div>
        </div>
      </div>

      <BoxScoreTable
        sport="mlb"
        playerId={activeProfile.playerId}
        market={activeProfile.market}
        currentLine={line}
        prefetchedGames={games}
      />

      {isLoading && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">Refreshing game logs...</p>
      )}
    </div>
  );
}

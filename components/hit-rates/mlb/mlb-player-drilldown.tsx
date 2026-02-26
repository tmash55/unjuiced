"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { GameLogChart } from "@/components/hit-rates/game-log-chart";
import { BoxScoreTable } from "@/components/hit-rates/box-score-table";
import { ShareChartButton } from "@/components/hit-rates/share-chart-button";
import { DrilldownChartSection } from "@/components/hit-rates/drilldown-chart-section";
import {
  type HeaderGameCountFilter,
} from "@/components/hit-rates/header-hit-rate-strip";
import {
  DrilldownHeaderRightPanel,
  type HeaderOddsCardConfig,
} from "@/components/hit-rates/header-right-panel";
import {
  MarketSelectorStrip,
  type MarketHitRateData,
} from "@/components/hit-rates/player-drilldown";
import { DEFAULT_FILTERS } from "@/components/hit-rates/chart-filters";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useMlbPlayerGameLogs } from "@/hooks/use-mlb-player-game-logs";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import { getMlbSectionOrder, resolveMlbPlayerType } from "@/components/hit-rates/mlb/drilldown-sections";
import { MlbBatterSectionsSkeleton } from "@/components/hit-rates/mlb/mlb-batter-sections-skeleton";
import { MlbSprayChart } from "@/components/hit-rates/mlb/mlb-spray-chart";

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

type GameCountFilter = HeaderGameCountFilter;

function getInjuryIconColor(status: string | null): string {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500";
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
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
  const chartCaptureRef = useRef<HTMLDivElement>(null);
  const [isCapturingChart, setIsCapturingChart] = useState(false);

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
  const playerType = useMemo(() => resolveMlbPlayerType(activeProfile.market), [activeProfile.market]);
  const sectionOrder = useMemo(() => getMlbSectionOrder(playerType), [playerType]);
  const showChartSection = sectionOrder.includes("chart");
  const showMatchupContextSection = sectionOrder.includes("matchupContext");
  const showAdvancedSection = sectionOrder.includes("advancedProfile");
  const showRollingWindowsSection = sectionOrder.includes("rollingWindows");
  const showOddsComparisonSection = sectionOrder.includes("oddsComparison");
  const showBoxScoreSection = sectionOrder.includes("boxScore");
  const showSprayChartSection = sectionOrder.includes("sprayChart");

  const [line, setLine] = useState<number | null>(activeProfile.line);
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [gameCount, setGameCount] = useState<GameCountFilter>(10);

  useEffect(() => {
    setSelectedMarket(profile.market);
  }, [profile.market]);

  useEffect(() => {
    setLine(activeProfile.line);
    setQuickFilters(new Set());
    setGameCount(10);
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

  const applyQuickFilters = (sourceGames: BoxScoreGame[]) => {
    if (quickFilters.size === 0) return sourceGames;

    return sourceGames.filter((game) => {
      const margin = game.margin ?? game.teamScore - game.opponentScore;
      if (quickFilters.has("home") && game.homeAway !== "H") return false;
      if (quickFilters.has("away") && game.homeAway !== "A") return false;
      if (quickFilters.has("win") && game.result !== "W") return false;
      if (quickFilters.has("loss") && game.result !== "L") return false;
      if (quickFilters.has("wonBy10") && (game.result !== "W" || margin < 10)) return false;
      if (quickFilters.has("lostBy10") && (game.result !== "L" || Math.abs(margin) < 10)) return false;
      return true;
    });
  };

  const applyGameCountFilter = (sourceGames: BoxScoreGame[]) => {
    let result = sourceGames;

    if (gameCount === "h2h" && activeProfile.opponentTeamAbbr) {
      result = result.filter((game) => game.opponentAbbr === activeProfile.opponentTeamAbbr);
    }

    if (gameCount !== "season" && gameCount !== "h2h") {
      result = result.slice(0, gameCount);
    }

    return result;
  };

  const filteredGames = useMemo(() => {
    const afterQuickFilters = applyQuickFilters(games);
    return applyGameCountFilter(afterQuickFilters);
  }, [games, quickFilters, gameCount, activeProfile.opponentTeamAbbr]);

  const hitRateAtLine = useMemo(() => {
    if (line === null || filteredGames.length === 0) return null;
    const hits = filteredGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
    return Math.round((hits / filteredGames.length) * 100);
  }, [filteredGames, activeProfile.market, line]);

  const chartAverage = useMemo(() => {
    if (filteredGames.length === 0) return null;
    const total = filteredGames.reduce((sum, game) => sum + getMlbMarketValue(game, activeProfile.market), 0);
    return total / filteredGames.length;
  }, [filteredGames, activeProfile.market]);

  const chartHits = useMemo(() => {
    if (line === null || filteredGames.length === 0) return 0;
    return filteredGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
  }, [filteredGames, activeProfile.market, line]);

  const dynamicHitRates = useMemo(() => {
    if (games.length === 0 || line === null) {
      return {
        l5: activeProfile.last5Pct,
        l10: activeProfile.last10Pct,
        l20: activeProfile.last20Pct,
        season: activeProfile.seasonPct,
        h2h: activeProfile.h2hPct,
      };
    }

    if (activeProfile.line === line) {
      return {
        l5: activeProfile.last5Pct,
        l10: activeProfile.last10Pct,
        l20: activeProfile.last20Pct,
        season: activeProfile.seasonPct,
        h2h: activeProfile.h2hPct,
      };
    }

    const calculateHitRate = (sourceGames: BoxScoreGame[]) => {
      if (sourceGames.length === 0) return null;
      const hits = sourceGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
      return Math.round((hits / sourceGames.length) * 100);
    };

    const sortedGames = [...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const h2hGames = activeProfile.opponentTeamAbbr
      ? sortedGames.filter((game) => game.opponentAbbr === activeProfile.opponentTeamAbbr)
      : [];

    return {
      l5: calculateHitRate(sortedGames.slice(0, 5)),
      l10: calculateHitRate(sortedGames.slice(0, 10)),
      l20: calculateHitRate(sortedGames.slice(0, 20)),
      season: calculateHitRate(sortedGames),
      h2h: calculateHitRate(h2hGames),
    };
  }, [
    games,
    line,
    activeProfile.line,
    activeProfile.last5Pct,
    activeProfile.last10Pct,
    activeProfile.last20Pct,
    activeProfile.seasonPct,
    activeProfile.h2hPct,
    activeProfile.market,
    activeProfile.opponentTeamAbbr,
  ]);

  const marketHitRates = useMemo<Map<string, MarketHitRateData>>(() => {
    const map = new Map<string, MarketHitRateData>();
    const expectedTotal =
      gameCount === "season"
        ? games.length
        : gameCount === "h2h"
          ? games.filter((game) => game.opponentAbbr === activeProfile.opponentTeamAbbr).length
          : Math.min(gameCount, games.length);

    if (line === null || filteredGames.length === 0) {
      map.set(activeProfile.market, {
        hitRate: null,
        hits: 0,
        total: filteredGames.length,
        expectedTotal,
      });
      return map;
    }

    const hits = filteredGames.filter((game) => getMlbMarketValue(game, activeProfile.market) >= line).length;
    map.set(activeProfile.market, {
      hitRate: Math.round((hits / filteredGames.length) * 100),
      hits,
      total: filteredGames.length,
      expectedTotal,
    });
    return map;
  }, [activeProfile.market, filteredGames, games, gameCount, activeProfile.opponentTeamAbbr, line]);

  const headerOddsCards = useMemo<[HeaderOddsCardConfig, HeaderOddsCardConfig]>(
    () => [
      {
        sideLabel: "O",
        priceText: null,
      },
      {
        sideLabel: "U",
        priceText: null,
      },
    ],
    []
  );

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
  const matchupGameId = useMemo(() => {
    if (!activeProfile.gameId) return null;
    const parsed = Number(activeProfile.gameId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [activeProfile.gameId]);

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
    <div>
      <div ref={chartCaptureRef}>
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
                data-hide-on-capture
                className={cn(
                  "p-2.5 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-white/80 dark:hover:text-white dark:hover:bg-neutral-800/80 transition-all hover:scale-105 active:scale-95 shrink-0 backdrop-blur-sm",
                  isCapturingChart && "opacity-0"
                )}
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

            <DrilldownHeaderRightPanel
              primaryColor={activeProfile.primaryColor}
              lineText={`${line !== null ? `${line}+` : "-"} ${formatMarketLabel(activeProfile.market)}`}
              oddsCards={headerOddsCards}
              stripItems={[
                { label: "L5", value: dynamicHitRates.l5, count: 5 },
                { label: "L10", value: dynamicHitRates.l10, count: 10 },
                { label: "L20", value: dynamicHitRates.l20, count: 20 },
                { label: "SZN", value: dynamicHitRates.season, count: "season" },
                { label: "H2H", value: dynamicHitRates.h2h, count: "h2h" },
              ]}
              selectedStrip={gameCount}
              onSelectStrip={(count) => setGameCount(count as GameCountFilter)}
            />
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
        {showChartSection && (
          <DrilldownChartSection
            gameCount={gameCount}
            onGameCountChange={(count) => setGameCount(count as GameCountFilter)}
            totalGamesAvailable={games.length}
            chartStats={{
              hitRate: hitRateAtLine,
              hits: chartHits,
              total: filteredGames.length,
              avg: chartAverage,
            }}
            activeLine={line}
            rightActions={
              <ShareChartButton
                targetRef={chartCaptureRef}
                playerName={activeProfile.playerName}
                market={activeProfile.market}
                compact
                onCaptureStart={() => setIsCapturingChart(true)}
                onCaptureEnd={() => setIsCapturingChart(false)}
                gameRange={
                  gameCount === "season"
                    ? "Season"
                    : gameCount === "h2h"
                      ? `vs ${activeProfile.opponentTeamAbbr || "OPP"}`
                      : `L${gameCount}`
                }
                stats={{
                  hitRate: hitRateAtLine,
                  avg: chartAverage,
                  gamesCount: filteredGames.length,
                  line,
                }}
                activeFilters={Array.from(quickFilters).map((filter) => ({
                  type: "quick" as const,
                  label:
                    filter === "home"
                      ? "Home"
                      : filter === "away"
                        ? "Away"
                        : filter === "win"
                          ? "Wins"
                          : filter === "loss"
                            ? "Losses"
                            : filter === "wonBy10"
                              ? "Won 10+"
                              : filter === "lostBy10"
                                ? "Lost 10+"
                                : filter,
                }))}
              />
            }
          >
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
                className={cn("min-h-[340px]", isCapturingChart && "pointer-events-none")}
              />
            )}
          </DrilldownChartSection>
        )}
      </div>

      {(showMatchupContextSection || showAdvancedSection || showRollingWindowsSection || showOddsComparisonSection) && (
        <MlbBatterSectionsSkeleton
          playerId={activeProfile.playerId}
          gameId={matchupGameId}
          market={activeProfile.market}
          battingHand={battingHand}
        />
      )}

      {showSprayChartSection && (
        <div className="mt-6">
          <MlbSprayChart
            playerId={activeProfile.playerId}
            gameId={matchupGameId}
            battingHand={battingHand}
          />
        </div>
      )}

      {showBoxScoreSection && (
        <div className={cn(showChartSection ? "mt-6" : "")}>
          <BoxScoreTable
            sport="mlb"
            playerId={activeProfile.playerId}
            market={activeProfile.market}
            currentLine={line}
            prefetchedGames={games}
          />
        </div>
      )}

      {isLoading && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 px-1">Refreshing game logs...</p>
      )}
    </div>
  );
}

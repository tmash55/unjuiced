"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Crosshair,
  Handshake,
  Info,
  ListOrdered,
  Lock,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import type { TeamRosterPlayer } from "@/hooks/use-team-roster";
import type { LineupPlayer, TeamLineup } from "@/hooks/use-lineup";
import type { TeammateFilter } from "../hero/roster-rail";
import type { ChartRange } from "../hero/hit-rate-chart";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { useQuery } from "@tanstack/react-query";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { InlineLineMovementCard } from "@/components/line-history/inline-line-movement-card";
import { LineHistoryDialog } from "@/components/opportunities/line-history-dialog";
import type { LineHistoryContext } from "@/lib/odds/line-history";
import {
  usePlayerCorrelations,
  type TeammateCorrelation,
} from "@/hooks/use-player-correlations";
import {
  useShotZoneMatchup,
  mapZoneToId,
  type ShotZone,
} from "@/hooks/use-shot-zone-matchup";
import {
  usePlayTypeMatchup,
  type PlayTypeData,
} from "@/hooks/use-play-type-matchup";
import type { LineOdds } from "@/hooks/use-hit-rate-odds";
import { useTeamDefenseRanks } from "@/hooks/use-team-defense-ranks";
import {
  usePositionVsTeam,
  type PositionVsTeamPlayer,
} from "@/hooks/use-position-vs-team";
import {
  useDoubleDoubleSheet,
  type DoubleDoubleBestPrice,
  type DoubleDoubleSheetRow,
} from "@/hooks/use-double-double-sheet";
import {
  useTripleDoubleSheet,
  type TripleDoubleBestPrice,
  type TripleDoubleSheetRow,
} from "@/hooks/use-triple-double-sheet";

type DrilldownTabId =
  | "overview"
  | "roster"
  | "correlations"
  | "shooting"
  | "play-types"
  | "matchup"
  | "odds"
  | "game-log";

interface DrilldownTabsProps {
  profile: HitRateProfile;
  profiles: HitRateProfile[];
  sport: "nba" | "wnba";
  games: BoxScoreGame[];
  rosterPlayers: TeamRosterPlayer[];
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
  isLoadingGames?: boolean;
  isLoadingRoster?: boolean;
  // Lineup feed for tonight's matchup — drives the Starter / Bench tag and
  // Confirmed / Projected status badges in the Roster tab.
  lineupByPlayerId?: Map<number, LineupPlayer>;
  teamLineup?: TeamLineup | null;
  isLoadingLineup?: boolean;
  activeLine?: number | null;
  onLineSelect?: (line: number) => void;
  odds?: LineOdds | null;
  isOddsLoading?: boolean;
  chartRange?: ChartRange;
}

const TABS: Array<{
  id: DrilldownTabId;
  label: string;
  eyebrow: string;
  icon: React.ElementType;
}> = [
  { id: "matchup", label: "Matchup", eyebrow: "Context", icon: Shield },
  { id: "roster", label: "Roster", eyebrow: "Rotation", icon: Users },
  {
    id: "correlations",
    label: "Correlations",
    eyebrow: "Team",
    icon: Handshake,
  },
  { id: "shooting", label: "Zones", eyebrow: "Shooting", icon: Crosshair },
  { id: "play-types", label: "Play Type", eyebrow: "Usage", icon: Activity },
  { id: "odds", label: "Odds", eyebrow: "Books", icon: BadgeDollarSign },
  { id: "game-log", label: "Logs", eyebrow: "History", icon: ListOrdered },
];

const MARKET_LABELS: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes_made: "3-Pointers",
  player_points_rebounds_assists: "Pts+Reb+Ast",
  player_points_assists: "Pts+Ast",
  player_points_rebounds: "Pts+Reb",
  player_rebounds_assists: "Reb+Ast",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_blocks_steals: "Blk+Stl",
  player_double_double: "Double Double",
  player_triple_double: "Triple Double",
};

export function DrilldownTabs({
  profile,
  profiles,
  sport,
  games,
  rosterPlayers,
  teammateFilters,
  onTeammateFilterToggle,
  isLoadingGames = false,
  isLoadingRoster = false,
  lineupByPlayerId,
  teamLineup,
  isLoadingLineup = false,
  activeLine,
  onLineSelect,
  odds = null,
  isOddsLoading = false,
  chartRange = "l20",
}: DrilldownTabsProps) {
  const [activeTab, setActiveTab] = useState<DrilldownTabId>("matchup");
  const recentGames = useMemo(() => games.slice(0, 5), [games]);
  const marketLabel = MARKET_LABELS[profile.market] ?? profile.market;

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm ring-1 ring-black/[0.03] dark:border-neutral-800/70 dark:bg-neutral-900/60 dark:ring-white/[0.03]">
      <div className="border-b border-neutral-200/60 px-3 pt-3 dark:border-neutral-800/60">
        <div className="flex items-start justify-end">
          <div className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800/70 dark:bg-neutral-950/50">
            <span className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-400">
              {sport.toUpperCase()}
            </span>
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-xs font-bold text-neutral-700 tabular-nums dark:text-neutral-300">
              {profile.line ?? "—"}+ {marketLabel}
            </span>
          </div>
        </div>

        <div className="scrollbar-hide -mt-8 flex gap-1 overflow-x-auto pr-44 pb-3 max-lg:mt-3 max-lg:pr-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group relative flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.98]",
                  isActive
                    ? "border-brand/45 bg-brand/10 text-brand shadow-sm"
                    : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-900",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    isActive
                      ? "border-brand/30 bg-brand/15"
                      : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">
                    {tab.label}
                  </span>
                  <span className="block truncate text-[10px] font-bold tracking-[0.12em] uppercase opacity-60">
                    {tab.eyebrow}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[260px] p-4 sm:p-5">
        <TabPreview
          activeTab={activeTab}
          profile={profile}
          profiles={profiles}
          sport={sport}
          games={games}
          recentGames={recentGames}
          rosterPlayers={rosterPlayers}
          teammateFilters={teammateFilters}
          onTeammateFilterToggle={onTeammateFilterToggle}
          isLoadingGames={isLoadingGames}
          isLoadingRoster={isLoadingRoster}
          lineupByPlayerId={lineupByPlayerId}
          teamLineup={teamLineup ?? null}
          isLoadingLineup={isLoadingLineup}
          activeLine={activeLine ?? profile.line}
          onLineSelect={onLineSelect}
          odds={odds}
          isOddsLoading={isOddsLoading}
          chartRange={chartRange}
        />
      </div>
    </section>
  );
}

function TabPreview({
  activeTab,
  profile,
  profiles,
  sport,
  games,
  recentGames,
  rosterPlayers,
  teammateFilters,
  onTeammateFilterToggle,
  isLoadingGames,
  isLoadingRoster,
  lineupByPlayerId,
  teamLineup,
  isLoadingLineup,
  activeLine,
  onLineSelect,
  odds,
  isOddsLoading,
  chartRange,
}: {
  activeTab: DrilldownTabId;
  profile: HitRateProfile;
  profiles: HitRateProfile[];
  sport: "nba" | "wnba";
  games: BoxScoreGame[];
  recentGames: BoxScoreGame[];
  rosterPlayers: TeamRosterPlayer[];
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
  isLoadingGames: boolean;
  isLoadingRoster: boolean;
  lineupByPlayerId?: Map<number, LineupPlayer>;
  teamLineup: TeamLineup | null;
  isLoadingLineup: boolean;
  activeLine: number | null;
  onLineSelect?: (line: number) => void;
  odds: LineOdds | null;
  isOddsLoading: boolean;
  chartRange: ChartRange;
}) {
  if (activeTab === "overview") {
    return (
      <OverviewPanel
        profile={profile}
        profiles={profiles}
        sport={sport}
        recentGames={recentGames}
      />
    );
  }

  if (activeTab === "matchup") {
    return (
      <MatchupPanel profile={profile} sport={sport} activeLine={activeLine} />
    );
  }

  if (activeTab === "roster") {
    return (
      <RosterPanel
        rosterPlayers={rosterPlayers}
        market={profile.market}
        teammateFilters={teammateFilters}
        onTeammateFilterToggle={onTeammateFilterToggle}
        isLoadingRoster={isLoadingRoster}
        lineupByPlayerId={lineupByPlayerId}
        teamLineup={teamLineup}
        isLoadingLineup={isLoadingLineup}
        teamAbbr={profile.teamAbbr ?? null}
        sport={sport}
      />
    );
  }

  if (activeTab === "game-log") {
    return (
      <GameLogPanel
        profile={profile}
        sport={sport}
        games={games}
        line={activeLine}
        isLoading={isLoadingGames}
      />
    );
  }

  if (activeTab === "correlations") {
    return (
      <CorrelationsPanel
        profile={profile}
        sport={sport}
        line={activeLine}
        chartRange={chartRange}
      />
    );
  }

  if (activeTab === "shooting") {
    return <ShootingPanel profile={profile} sport={sport} />;
  }

  if (activeTab === "play-types") {
    return <PlayTypePanel profile={profile} sport={sport} />;
  }

  if (activeTab === "odds") {
    return (
      <OddsPanel
        profile={profile}
        sport={sport}
        activeLine={activeLine}
        onLineSelect={onLineSelect}
        odds={odds}
        isLoading={isOddsLoading}
      />
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-3">
      <PreviewMetric
        label={activeTab === "odds" ? "Best Over" : "Current Line"}
        value={
          activeTab === "odds"
            ? formatOdds(profile.bestOdds?.price ?? null)
            : `${profile.line ?? "—"}+`
        }
        accent
      />
      <PreviewMetric
        label="L10"
        value={
          profile.last10Pct !== null && profile.last10Pct !== undefined
            ? `${profile.last10Pct}%`
            : "—"
        }
      />
      <PreviewMetric
        label="Season"
        value={
          profile.seasonPct !== null && profile.seasonPct !== undefined
            ? `${profile.seasonPct}%`
            : "—"
        }
      />

      <div className="md:col-span-3">
        <PreviewHeader
          title={getPreviewTitle(activeTab)}
          kicker="Panel scaffold"
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr]">
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4 dark:border-neutral-800/70 dark:bg-neutral-950/35">
            <div className="flex h-36 items-end gap-2">
              {[42, 68, 54, 82, 48, 74, 61, 88, 57].map((height, index) => (
                <div
                  key={index}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      index % 3 === 1
                        ? "bg-brand"
                        : "bg-neutral-300 dark:bg-neutral-700",
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <SignalLine label="Primary" value={profile.playerName} />
            <SignalLine
              label="Context"
              value={`${profile.teamAbbr} ${profile.position ?? ""}`}
            />
            <SignalLine
              label="Matchup"
              value={`${isProfileHome(profile.homeAway) ? "vs" : "@"} ${profile.opponentTeamAbbr ?? "—"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const TOTAL_TEAMS_BY_SPORT: Record<"nba" | "wnba", number> = {
  nba: 30,
  wnba: 13,
};
type MatchupTier = "elite" | "strong" | "neutral" | "bad" | "worst";
type CorrelationMarket =
  | "points"
  | "rebounds"
  | "assists"
  | "threes"
  | "steals"
  | "blocks"
  | "pra"
  | "pointsRebounds"
  | "pointsAssists"
  | "reboundsAssists"
  | "blocksSteals";

const CORRELATION_MARKETS: Array<{
  key: CorrelationMarket;
  label: string;
  dbMarket: string;
}> = [
  { key: "points", label: "PTS", dbMarket: "player_points" },
  { key: "rebounds", label: "REB", dbMarket: "player_rebounds" },
  { key: "assists", label: "AST", dbMarket: "player_assists" },
  { key: "threes", label: "3PM", dbMarket: "player_threes_made" },
  { key: "steals", label: "STL", dbMarket: "player_steals" },
  { key: "blocks", label: "BLK", dbMarket: "player_blocks" },
  { key: "pra", label: "PRA", dbMarket: "player_points_rebounds_assists" },
  { key: "pointsRebounds", label: "PR", dbMarket: "player_points_rebounds" },
  { key: "pointsAssists", label: "PA", dbMarket: "player_points_assists" },
  { key: "reboundsAssists", label: "RA", dbMarket: "player_rebounds_assists" },
  { key: "blocksSteals", label: "BS", dbMarket: "player_blocks_steals" },
];

function CorrelationsPanel({
  profile,
  sport,
  line,
  chartRange,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  line: number | null;
  chartRange: ChartRange;
}) {
  const defaultMarket = marketToCorrelationMarket(profile.market);
  const correlationWindow = getCorrelationWindow(chartRange);
  const anchorMarketLabel = MARKET_LABELS[profile.market] ?? profile.market;
  const anchorPhrase = `${getLastName(profile.playerName)} gets ${formatDecimal(line)}+ ${anchorMarketLabel}`;
  const [selectedMarket, setSelectedMarket] =
    useState<CorrelationMarket>(defaultMarket);
  useEffect(() => {
    setSelectedMarket(defaultMarket);
  }, [defaultMarket]);
  const { teammateCorrelations, anchorPerformance, isLoading, error } =
    usePlayerCorrelations({
      playerId: profile.playerId,
      market: profile.market,
      line,
      sport,
      gameId: profile.gameId,
      lastNGames: correlationWindow.lastNGames,
      enabled: !!profile.playerId && !!profile.market && line !== null,
    });

  const ranked = useMemo(() => {
    return teammateCorrelations
      .map((teammate) => {
        const hitRate = teammate[selectedMarket]?.hitRateWhenAnchorHits ?? null;
        return { teammate, hitRate };
      })
      .filter(
        ({ hitRate }) => hitRate && hitRate.games > 0 && hitRate.pct !== null,
      )
      .sort((a, b) => {
        const pctDiff = (b.hitRate?.pct ?? -1) - (a.hitRate?.pct ?? -1);
        if (pctDiff !== 0) return pctDiff;
        return (b.hitRate?.games ?? 0) - (a.hitRate?.games ?? 0);
      })
      .slice(0, 9);
  }, [teammateCorrelations, selectedMarket]);

  return (
    <div>
      <PreviewHeader
        title={`When ${anchorPhrase}`}
        kicker={`Correlations • ${correlationWindow.label}`}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {CORRELATION_MARKETS.map((market) => (
          <button
            key={market.key}
            type="button"
            onClick={() => setSelectedMarket(market.key)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[10px] font-black tracking-[0.12em] uppercase transition-all active:scale-[0.98]",
              selectedMarket === market.key
                ? "border-brand/40 bg-brand/15 text-brand"
                : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:text-neutral-900 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:text-white",
            )}
          >
            {market.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
          <div className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
            Anchor Result • {correlationWindow.label}
          </div>
          <div className="mt-2 text-lg font-black text-neutral-950 tabular-nums dark:text-white">
            {anchorPerformance?.hitRate !== null &&
            anchorPerformance?.hitRate !== undefined
              ? `${anchorPerformance.hitRate}%`
              : "—"}
          </div>
          <div className="mt-1 text-xs font-bold text-neutral-500 dark:text-neutral-500">
            {anchorPerformance
              ? `${profile.playerName} hit ${formatDecimal(line)}+ ${anchorMarketLabel} in ${anchorPerformance.timesHit}/${anchorPerformance.gamesAnalyzed} games.`
              : `${profile.playerName} ${formatDecimal(line)}+ ${anchorMarketLabel}`}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniStat label="Hit" value={anchorPerformance?.timesHit ?? null} />
            <MiniStat
              label="Games"
              value={anchorPerformance?.gamesAnalyzed ?? null}
            />
          </div>
          <div className="mt-3 rounded-lg border border-neutral-200/70 bg-white/45 px-2.5 py-2 text-[10px] leading-4 font-bold text-neutral-500 dark:border-neutral-800/70 dark:bg-neutral-900/35 dark:text-neutral-500">
            Teammate samples only include eligible shared games where the
            teammate has a valid stat line in this window.
          </div>
          {correlationWindow.note && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-4 font-bold text-amber-700 dark:text-amber-300">
              {correlationWindow.note}
            </div>
          )}
        </div>

        <div className="min-h-[260px]">
          {isLoading ? (
            <SkeletonCards count={6} />
          ) : error ? (
            <EmptyPreview label="Correlation data could not be loaded." />
          ) : ranked.length === 0 ? (
            <EmptyPreview label="No teammate correlations for this market yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ranked.map(({ teammate, hitRate }) => (
                <CorrelationCard
                  key={teammate.playerId}
                  teammate={teammate}
                  hitRate={hitRate}
                  selectedMarket={selectedMarket}
                  sport={sport}
                  anchorPhrase={anchorPhrase}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CorrelationCard({
  teammate,
  hitRate,
  selectedMarket,
  sport,
  anchorPhrase,
}: {
  teammate: TeammateCorrelation;
  hitRate:
    | TeammateCorrelation[CorrelationMarket]["hitRateWhenAnchorHits"]
    | null;
  selectedMarket: CorrelationMarket;
  sport: "nba" | "wnba";
  anchorPhrase: string;
}) {
  const pct = hitRate?.pct ?? null;
  const tone = getHitRateTone(pct);
  const recentDots = teammate.gameLogs
    .filter((game) => game.anchorHit)
    .slice(0, 7)
    .map((game) => {
      const stat = getCorrelationGameStat(game.stats, selectedMarket);
      const line = hitRate?.lineUsed ?? 0.5;
      return stat >= line;
    });

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white/50 p-3 dark:border-neutral-800/70 dark:bg-neutral-900/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerHeadshot
            nbaPlayerId={teammate.nbaPlayerId ?? teammate.playerId}
            sport={sport}
            name={teammate.playerName}
            size="small"
            className="h-10 w-10 rounded-xl border border-neutral-200/70 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950"
          />
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-neutral-950 dark:text-white">
              {teammate.playerName}
            </div>
            <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
              {teammate.position} • {formatDecimal(teammate.minutesAvg)} min/g
            </div>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[9px] font-black tracking-[0.12em] uppercase",
            tone.badge,
          )}
        >
          {tone.label}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className={cn("text-3xl font-black tabular-nums", tone.text)}>
            {pct !== null ? `${pct}%` : "—"}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-neutral-500 dark:text-neutral-500">
            when {anchorPhrase}
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-neutral-400 dark:text-neutral-600">
            {getLastName(teammate.playerName)} hit{" "}
            {formatDecimal(hitRate?.lineUsed)}+{" "}
            {CORRELATION_MARKETS.find((m) => m.key === selectedMarket)?.label}
          </div>
        </div>
        <div className="text-right text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          <div>
            {hitRate?.timesHit ?? 0}/{hitRate?.games ?? 0}
          </div>
          <div>eligible</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {recentDots.map((hit, index) => (
          <span
            key={index}
            className={cn(
              "h-2 w-2 rounded-full",
              hit ? "bg-emerald-500" : "bg-red-500",
            )}
          />
        ))}
      </div>
    </div>
  );
}

type ShotMapView = "player" | "edge" | "defense";

export function ShootingPanel({
  profile,
  sport,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
}) {
  const [season, setSeason] = useState(sport === "wnba" ? "2025" : "2025-26");
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ShotMapView>("player");
  const [infoOpen, setInfoOpen] = useState(false);
  const { data, isLoading, error } = useShotZoneMatchup({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId,
    sport,
    season,
    enabled: !!profile.playerId && !!profile.opponentTeamId,
  });
  const zones = useMemo(
    () =>
      [...(data?.zones ?? [])].sort(
        (a, b) => b.player_pct_of_total - a.player_pct_of_total,
      ),
    [data?.zones],
  );
  const totalTeams = data?.summary?.total_teams ?? TOTAL_TEAMS_BY_SPORT[sport];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeasonToggle sport={sport} season={season} onSeasonChange={setSeason} />
        {/* View mode toggle (Player / Edge / Defense) — three angles on the
            same court, props.cash style. State threaded into the SVG which
            switches its labels + arrow direction per mode. */}
        <div className="flex items-center gap-2">
          <div className="flex w-fit rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
            <MiniToggle
              active={viewMode === "player"}
              onClick={() => setViewMode("player")}
            >
              Player
            </MiniToggle>
            <MiniToggle
              active={viewMode === "edge"}
              onClick={() => setViewMode("edge")}
            >
              Edge
            </MiniToggle>
            <MiniToggle
              active={viewMode === "defense"}
              onClick={() => setViewMode("defense")}
            >
              Defense
            </MiniToggle>
          </div>
          <Tooltip
            side="bottom"
            content={
              <div className="max-w-[280px] space-y-3 px-3 py-3">
                <div>
                  <div className="text-[11px] font-black text-neutral-950 dark:text-white">
                    Shot Map
                  </div>
                  <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                    Where the player scores, how well they shoot from each
                    spot, and how the opponent grades defending it.
                  </p>
                </div>
                <div>
                  <div className="mb-1 text-[9px] font-black tracking-[0.16em] uppercase text-brand">
                    Trend
                  </div>
                  <div className="space-y-0.5 text-[10.5px]">
                    <div className="flex items-center gap-1.5">
                      <TrendArrow tier="soft" />
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Soft
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        — favorable
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendArrow tier="neutral" />
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Mid
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        — neutral
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendArrow tier="tough" />
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Tough
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400">
                        — hard matchup
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[9px] font-black tracking-[0.16em] uppercase text-brand">
                    Views
                  </div>
                  <div className="space-y-1 text-[10.5px] text-neutral-500 dark:text-neutral-400">
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Player
                      </span>{" "}
                      — % of points scored from each zone, with FG%.
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Edge
                      </span>{" "}
                      — combines player FG% with how soft the defense
                      grades. Higher = better matchup (0.0–1.0).
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        Defense
                      </span>{" "}
                      — opponent's league rank for points allowed in this
                      zone.
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <button
              type="button"
              aria-label="What is the shot map?"
              className="grid h-7 w-7 place-items-center rounded-md border border-neutral-200/80 text-neutral-500 transition-colors hover:border-brand/45 hover:text-brand dark:border-neutral-800/80 dark:text-neutral-400"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <SkeletonRows rows={6} />
        </div>
      ) : error ? (
        <EmptyPreview label="Shooting zone data could not be loaded." />
      ) : zones.length === 0 ? (
        <EmptyPreview label="No shooting zone data available yet." />
      ) : (
        // Court is hero (1fr) with a 360px right column holding a compressed
        // Favorable Usage strip on top + the zone bars below. Below xl we
        // hide the court (no room) and stack the strip + bars.
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]">
          <div className="hidden xl:block">
            <CourtZonesView
              zones={zones}
              totalTeams={totalTeams}
              hoveredZoneId={hoveredZoneId}
              onHoverZone={setHoveredZoneId}
              opponentTeamAbbr={profile.opponentTeamAbbr ?? null}
              viewMode={viewMode}
            />
          </div>
          <div className="flex flex-col gap-3">
            {/* Compressed Favorable Usage — single horizontal strip vs the
                old multi-row card. Carries the same 4 datapoints in a
                quarter the height. */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800/70 dark:bg-neutral-950/35">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {data?.summary?.favorable_pct_of_points?.toFixed(0) ?? "—"}%
                </span>
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-neutral-500 dark:text-neutral-500">
                  Favorable
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
                <span className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {data?.summary?.favorable_zones ?? "—"}
                  </span>
                  <span className="uppercase tracking-[0.12em]">Good</span>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {data?.summary?.neutral_zones ?? "—"}
                  </span>
                  <span className="uppercase tracking-[0.12em]">Mid</span>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-red-600 dark:text-red-400">
                    {data?.summary?.tough_zones ?? "—"}
                  </span>
                  <span className="uppercase tracking-[0.12em]">Hard</span>
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
              <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {zones.map((zone) => (
                  <ZoneRow
                    key={zone.zone}
                    zone={zone}
                    totalTeams={totalTeams}
                    isHovered={hoveredZoneId === mapZoneToId(zone.zone)}
                    onHover={() => setHoveredZoneId(mapZoneToId(zone.zone))}
                    onLeave={() =>
                      setHoveredZoneId((prev) =>
                        prev === mapZoneToId(zone.zone) ? null : prev,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {infoOpen && (
        <ShotMapInfoModal onClose={() => setInfoOpen(false)} />
      )}
    </div>
  );
}

function ZoneRow({
  zone,
  totalTeams,
  isHovered,
  onHover,
  onLeave,
}: {
  zone: ShotZone;
  totalTeams: number;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const tone = getDefenseRankTone(zone.opponent_def_rank, totalTeams);
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-3 border-l-2 px-3 py-2.5 text-xs transition-colors",
        // More noticeable hover — solid brand-cyan left border + tinted bg
        // so the active row reads as the focused one even at a glance.
        isHovered
          ? "border-brand bg-brand/15 dark:bg-brand/20"
          : "border-transparent bg-white/40 hover:bg-neutral-50/60 dark:bg-neutral-900/20 dark:hover:bg-neutral-900/40",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-black text-neutral-950 dark:text-white">
            {zone.display_name}
          </span>
          <span className="font-black text-neutral-700 tabular-nums dark:text-neutral-300">
            {zone.player_pct_of_total.toFixed(0)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <span
            className={cn("block h-full rounded-full transition-all", tone.bar)}
            style={{ width: `${Math.min(100, zone.player_pct_of_total)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] font-bold text-neutral-500 tabular-nums dark:text-neutral-500">
          {Math.round(zone.player_fg_pct * 100)}% FG
        </div>
      </div>
      <div className="text-center">
        <div className={cn("font-black tabular-nums", tone.text)}>
          {zone.opponent_def_rank ? `#${zone.opponent_def_rank}` : "—"}
        </div>
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          def rank
        </div>
      </div>
      <span
        className={cn(
          "rounded-md px-2 py-1 text-center text-[9px] font-black tracking-[0.12em] uppercase",
          tone.badge,
        )}
      >
        {tone.label}
      </span>
    </div>
  );
}

// Half-court visualization with colored shot zones. Each zone is filled
// with the active def-rank tier color (red tough / amber neutral / emerald
// soft) at low opacity, with court lines kept subtle so the color reads as
// the dominant signal. Synced hover with the bar list — hovering a zone
// raises its opacity and rings it with the brand accent.
function CourtZonesView({
  zones,
  totalTeams,
  hoveredZoneId,
  onHoverZone,
  opponentTeamAbbr,
  viewMode,
}: {
  zones: ShotZone[];
  totalTeams: number;
  hoveredZoneId: string | null;
  onHoverZone: (id: string | null) => void;
  opponentTeamAbbr: string | null;
  viewMode: ShotMapView;
}) {
  // Lookup: zoneId → { tone, metrics... } for fast O(1) access during render.
  // We compute every metric up front so view-mode switching is just a
  // re-read, no recompute.
  const zoneById = useMemo(() => {
    const map = new Map<
      string,
      {
        tone: ReturnType<typeof getDefenseRankTone>;
        pct: number;
        fgPct: number;
        defRank: number | null;
        edge: number | null;
      }
    >();
    for (const z of zones) {
      const id = mapZoneToId(z.zone);
      const tone = getDefenseRankTone(z.opponent_def_rank, totalTeams);
      // Edge score (0–1): combines player FG% in this zone with how soft
      // the opponent's defense is. Higher = better matchup. Mirrors the
      // props.cash "Edge" idea — one decimal that captures the punchline.
      const defSoftness =
        z.opponent_def_rank != null && totalTeams > 0
          ? (totalTeams - z.opponent_def_rank + 1) / totalTeams
          : null;
      const edge =
        defSoftness !== null && Number.isFinite(z.player_fg_pct)
          ? (z.player_fg_pct + defSoftness) / 2
          : null;
      map.set(id, {
        tone,
        pct: z.player_pct_of_total,
        fgPct: Math.round(z.player_fg_pct * 100),
        defRank: z.opponent_def_rank,
        edge,
      });
    }
    return map;
  }, [zones, totalTeams]);

  // Color-at-rest, fade-others-on-hover. The court reads as a colorful
  // shot map by default (tier-tinted fills at high enough opacity to
  // actually pop in dark mode). When the user hovers a zone, that zone
  // brightens further AND the other zones desaturate to neutral gray.
  const anyHovered = hoveredZoneId !== null;
  const fillFor = (id: string, isHovered: boolean) => {
    const label = zoneById.get(id)?.tone.label ?? "No Data";
    if (isHovered) {
      if (label === "Tough") return "rgb(239 68 68 / 0.75)";
      if (label === "Soft") return "rgb(16 185 129 / 0.75)";
      if (label === "Neutral") return "rgb(245 158 11 / 0.75)";
      return "rgb(115 115 115 / 0.45)";
    }
    if (anyHovered) {
      // Non-hovered zones strip their tier color and drop to a quiet gray
      // so the focused zone is the only colorful thing on the court.
      return "rgb(115 115 115 / 0.10)";
    }
    // Resting state — vibrant tier colors. 0.45 opacity reads as a clear
    // tinted shape over both the light and dark court backgrounds; 0.20
    // looked muddy/brown over dark mode's neutral-900 base.
    if (label === "Tough") return "rgb(239 68 68 / 0.45)";
    if (label === "Soft") return "rgb(16 185 129 / 0.45)";
    if (label === "Neutral") return "rgb(245 158 11 / 0.45)";
    return "rgb(115 115 115 / 0.10)";
  };

  // Per-view label format — props.cash style. Player = % of points,
  // Edge = 0.42 decimal, Defense = #13 rank.
  const labelFor = (id: string): string | null => {
    const entry = zoneById.get(id);
    if (!entry) return null;
    if (viewMode === "player") {
      if (entry.pct < 4) return null;
      return `${entry.pct.toFixed(0)}%`;
    }
    if (viewMode === "edge") {
      if (entry.edge === null) return null;
      // Decimal with leading dot stripped (".42" not "0.42") — matches
      // props.cash "stat sheet" feel.
      const v = entry.edge.toFixed(2);
      return v.startsWith("0") ? v.slice(1) : v;
    }
    // defense
    if (entry.defRank === null) return null;
    return `#${entry.defRank}`;
  };

  // Subline under the main number. Player = "47% FG", Edge = nothing
  // (already a single decimal), Defense = "23.4 / g" (allowed per game).
  const sublineFor = (id: string): string | null => {
    const entry = zoneById.get(id);
    if (!entry) return null;
    if (viewMode === "player") {
      return Number.isFinite(entry.fgPct) ? `${entry.fgPct}% FG` : null;
    }
    return null;
  };

  const ZONE_DEFS: Array<{
    id: string;
    path: string;
    labelX: number;
    labelY: number;
  }> = [
    {
      id: "aboveBreak3",
      path:
        "M 0 139 L 0 340 L 500 340 L 500 139 L 470 139 A 238 238 0 0 1 30 139 Z",
      labelX: 250,
      labelY: 305,
    },
    {
      id: "corner3Left",
      path: "M 0 5 L 30 5 L 30 139 L 0 139 Z",
      // Corner-3 strips are only 30px wide. A 3-char label like "14%" is
      // ~30px at fontSize 18 and would clip past the left SVG edge if
      // anchored at the middle of the strip. Use start-anchor pinned to
      // x=4 so the label hugs the left baseline cleanly. The arrow is
      // rendered AFTER the label in `arrowOffset`, sitting just past it.
      labelX: 4,
      labelY: 80,
    },
    {
      id: "corner3Right",
      path: "M 470 5 L 500 5 L 500 139 L 470 139 Z",
      // Mirror the corner3Left treatment — end-anchor at x=496 so the text
      // hugs the right edge without clipping. (See helper logic below for
      // anchor + arrow placement based on labelX position.)
      labelX: 496,
      labelY: 80,
    },
    {
      id: "midRange",
      // Two side wedges + bottom of free-throw ring merged into one path.
      path:
        "M 30 5 L 30 139 A 238 238 0 0 0 170 272 L 170 5 Z " +
        "M 470 5 L 470 139 A 238 238 0 0 1 330 272 L 330 5 Z " +
        "M 170 195 L 170 272 A 238 238 0 0 0 330 272 L 330 195 Z",
      // Anchor in the LEFT-side wedge so it doesn't collide with the
      // above-break-3 label (which sits below the 3-pt arc apex around
      // x=250). The right wedge stays unlabeled — same zone, one read.
      labelX: 100,
      labelY: 100,
    },
    {
      id: "paint",
      path:
        "M 170 5 L 170 195 L 330 195 L 330 5 L 290 5 A 40 40 0 0 1 210 5 Z",
      labelX: 250,
      labelY: 110,
    },
    {
      id: "rim",
      path: "M 210 5 A 40 40 0 0 0 290 5 Z",
      labelX: 250,
      labelY: 32,
    },
  ];

  // View-aware subtitle so the user always knows what the numbers mean.
  const subtitle =
    viewMode === "player"
      ? "% of points · player FG%"
      : viewMode === "edge"
        ? "Combined edge score (0–1) · player vs defense"
        : `${opponentTeamAbbr ?? "OPP"} defensive rank by zone`;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4 dark:border-neutral-800/70 dark:bg-neutral-950/35">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-black text-neutral-950 dark:text-white">
            Shot Map vs {opponentTeamAbbr ?? "OPP"}
          </div>
          <div className="mt-0.5 text-[9.5px] font-bold tracking-[0.14em] text-neutral-400 uppercase dark:text-neutral-500">
            {subtitle}
          </div>
        </div>
        {/* Trend arrow legend — one-glance decoder for ▲/●/▼ on each zone.
            Same emerald/amber/red palette as everywhere else. */}
        <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.12em] uppercase">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendArrow tier="soft" />
            Soft
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <TrendArrow tier="neutral" />
            Mid
          </span>
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <TrendArrow tier="tough" />
            Tough
          </span>
        </div>
      </div>
      <svg
        viewBox="0 0 500 340"
        // Cap court size so it doesn't dominate the tab on wide screens —
        // viewBox aspect (500:340) holds, so capping width also caps height.
        className="mx-auto h-auto w-full max-w-[560px]"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => onHoverZone(null)}
      >
        {/* Court background — subtle so the zone tints read as primary signal. */}
        <rect
          x="0"
          y="0"
          width="500"
          height="340"
          className="fill-neutral-100 dark:fill-neutral-900"
        />

        {/* Zone fills (clickable hit areas). Stroke is suppressed on the
            mid-range zone because its multi-sub-path geometry traces two
            internal walls between the paint corners and the 3-pt arc that
            looked like stray lines on hover. The bright tier-color fill at
            0.75 opacity is enough hover signal on its own there. */}
        {ZONE_DEFS.map((z) => {
          const hovered = hoveredZoneId === z.id;
          const showStroke = hovered && z.id !== "midRange";
          return (
            <path
              key={z.id}
              d={z.path}
              fill={fillFor(z.id, hovered)}
              stroke={showStroke ? "rgb(34 211 238 / 0.75)" : "transparent"}
              strokeWidth={showStroke ? 2.5 : 0}
              className="cursor-pointer transition-all"
              onMouseEnter={() => onHoverZone(z.id)}
            />
          );
        })}

        {/* Court lines — neutral white in dark mode, neutral-400 in light. */}
        <g
          className="stroke-neutral-400/70 dark:stroke-white/40"
          fill="none"
          strokeWidth={1.5}
        >
          {/* Baseline */}
          <line x1="0" y1="5" x2="500" y2="5" />
          {/* 3-point arc */}
          <path d="M 30 5 L 30 139 A 238 238 0 0 0 470 139 L 470 5" />
          {/* Paint outline */}
          <rect x="170" y="5" width="160" height="190" />
          {/* Free throw circle (bottom half) */}
          <path d="M 170 195 A 60 60 0 0 0 330 195" />
          {/* Free throw circle (top half — dashed) */}
          <path
            d="M 170 195 A 60 60 0 0 1 330 195"
            strokeDasharray="6 4"
            opacity={0.5}
          />
          {/* Restricted area arc */}
          <path d="M 210 5 A 40 40 0 0 0 290 5" />
        </g>

        {/* Basket — backboard line on the baseline + a small rim ring
            hanging just below it. Placed in front of the zone fills so the
            basket reads cleanly even when the RA zone is brightly tinted. */}
        <g className="stroke-brand fill-none">
          <line
            x1="226"
            y1="5"
            x2="274"
            y2="5"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx="250" cy="14" r="6" strokeWidth={2} />
        </g>

        {/* Zone labels — view-aware label (% / edge decimal / def rank) with
            a trend arrow next to the value. Arrow color comes from the
            def-rank tier so it tracks the matchup signal regardless of
            which view is active. Subline (FG%) only shown in Player view.
            Corner zones use start/end anchors to avoid clipping past the
            SVG edge — see helper math below. */}
        {ZONE_DEFS.map((z) => {
          const entry = zoneById.get(z.id);
          const label = labelFor(z.id);
          if (!entry || !label) return null;
          const isRim = z.id === "rim";
          const subline = sublineFor(z.id);
          const showSub = !isRim && subline !== null;
          const tier =
            entry.tone.label === "Tough"
              ? ("tough" as const)
              : entry.tone.label === "Soft"
                ? ("soft" as const)
                : ("neutral" as const);
          // Approx label-text width for placing the arrow. The 0.62
          // multiplier is intentionally conservative — the previous 0.55
          // underestimated and the arrow rendered on top of the % sign.
          const fontSize = isRim ? 11 : 18;
          const labelWidth = label.length * fontSize * 0.62;
          // Pick anchor + arrow position based on where the label sits.
          // Far-left → start-anchor (text grows rightward), far-right →
          // end-anchor (text grows leftward), everything else → center.
          const anchor: "start" | "middle" | "end" =
            z.labelX < 30 ? "start" : z.labelX > 470 ? "end" : "middle";
          // Generous arrow gap — bumped from 6 → 10 (8 for rim) so the
          // arrow has clear breathing room from the % symbol.
          const arrowGap = isRim ? 6 : 10;
          const arrowCx =
            anchor === "start"
              ? z.labelX + labelWidth + arrowGap
              : anchor === "end"
                ? z.labelX - labelWidth - arrowGap
                : z.labelX + labelWidth / 2 + arrowGap + 3;
          return (
            <g
              key={`${z.id}-label`}
              className="pointer-events-none fill-neutral-900 dark:fill-white"
            >
              <text
                x={z.labelX}
                y={showSub ? z.labelY - 6 : z.labelY}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={fontSize}
                fontWeight={900}
                style={{ letterSpacing: "-0.02em" }}
              >
                {label}
              </text>
              {/* Trend arrow next to the label — color-coded by tier */}
              <SvgTrendArrow
                cx={arrowCx}
                cy={showSub ? z.labelY - 6 : z.labelY}
                tier={tier}
                size={isRim ? 5 : 8}
              />
              {showSub && subline && (
                <text
                  x={z.labelX}
                  y={z.labelY + 11}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={700}
                  className="fill-neutral-500 dark:fill-neutral-400"
                  style={{ letterSpacing: "0.02em" }}
                >
                  {subline}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// HTML trend arrow for the legend strip at the top of the court card.
function TrendArrow({ tier }: { tier: "soft" | "neutral" | "tough" }) {
  if (tier === "soft") return <span className="text-emerald-500">▲</span>;
  if (tier === "tough") return <span className="text-red-500">▼</span>;
  return <span className="text-neutral-400 dark:text-neutral-500">●</span>;
}

// SVG trend arrow rendered next to each zone label on the court. Triangles
// point UP for soft (good for player), DOWN for tough (bad), dot for
// neutral. Color tracks the tier so the signal is the same as the legend.
function SvgTrendArrow({
  cx,
  cy,
  tier,
  size,
}: {
  cx: number;
  cy: number;
  tier: "soft" | "neutral" | "tough";
  size: number;
}) {
  if (tier === "neutral") {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={size * 0.45}
        className="fill-neutral-400 dark:fill-neutral-500"
      />
    );
  }
  // Up triangle for soft, down triangle for tough. Both centered on (cx, cy).
  const half = size / 2;
  const points =
    tier === "soft"
      ? `${cx},${cy - half} ${cx - half},${cy + half} ${cx + half},${cy + half}`
      : `${cx - half},${cy - half} ${cx + half},${cy - half} ${cx},${cy + half}`;
  return (
    <polygon
      points={points}
      className={
        tier === "soft"
          ? "fill-emerald-500"
          : "fill-red-500"
      }
    />
  );
}

// Info modal explaining what the shot map shows + how to read each view.
// Closes on backdrop click or Esc; matches the props.cash educational
// pattern so newer users aren't lost staring at decimals.
function ShotMapInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-black text-neutral-900 dark:text-white">
          Shot Map
        </div>
        <p className="mt-1 text-xs leading-5 font-medium text-neutral-500 dark:text-neutral-400">
          Where the player scores, how well they shoot from each spot, and
          how the opponent grades defending it.
        </p>

        <div className="mt-4">
          <div className="mb-2 text-[10px] font-black tracking-[0.16em] uppercase text-emerald-600 dark:text-emerald-400">
            Trend Indicators
          </div>
          <div className="space-y-2 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-950/50">
            <div className="flex items-center gap-2">
              <TrendArrow tier="soft" />
              <span className="font-bold text-neutral-900 dark:text-white">
                Soft
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                — favorable matchup
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendArrow tier="neutral" />
              <span className="font-bold text-neutral-900 dark:text-white">
                Mid
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                — neutral matchup
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendArrow tier="tough" />
              <span className="font-bold text-neutral-900 dark:text-white">
                Tough
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                — hard matchup
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[10px] font-black tracking-[0.16em] uppercase text-emerald-600 dark:text-emerald-400">
            Views
          </div>
          <div className="space-y-2 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-950/50">
            <div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Player
              </span>
              <span className="ml-2 text-neutral-600 dark:text-neutral-300">
                % of points scored from each zone, with player's FG%.
              </span>
            </div>
            <div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Edge
              </span>
              <span className="ml-2 text-neutral-600 dark:text-neutral-300">
                Combines player FG% with how soft the defense grades. Higher
                = better matchup (0.0–1.0).
              </span>
            </div>
            <div>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Defense
              </span>
              <span className="ml-2 text-neutral-600 dark:text-neutral-300">
                Opponent's league rank for points allowed in this zone.
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-black text-neutral-950 transition-colors hover:bg-emerald-400"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function PlayTypePanel({
  profile,
  sport,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
}) {
  const { data, isLoading, error } = usePlayTypeMatchup({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId,
    enabled: sport === "nba" && !!profile.playerId && !!profile.opponentTeamId,
  });
  const playTypes = useMemo(
    () =>
      [...(data?.play_types ?? [])].sort(
        (a, b) =>
          b.player_pct_of_total - a.player_pct_of_total ||
          b.player_ppg - a.player_ppg,
      ),
    [data?.play_types],
  );
  const topPlayType = playTypes[0] ?? null;
  const favorableShare = data?.summary?.favorable_pct_of_points ?? null;

  if (sport === "wnba") {
    return (
      <div>
        <PreviewHeader title="Play Type Analysis" kicker="Usage split" />
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300/80 bg-neutral-50/60 p-8 text-center dark:border-neutral-800 dark:bg-neutral-950/35">
          <BarChart3 className="text-brand mx-auto h-7 w-7" />
          <div className="mt-3 text-sm font-black text-neutral-950 dark:text-white">
            WNBA play types are coming soon
          </div>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 font-bold text-neutral-500 dark:text-neutral-500">
            We have the tab structure ready; this will populate when WNBA
            play-type scoring and defensive splits are available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PreviewHeader
        title="Play Type Analysis"
        kicker="Sorted by % of scoring"
      />
      {isLoading ? (
        <div className="mt-4">
          <SkeletonRows rows={6} />
        </div>
      ) : error ? (
        <EmptyPreview label="Play type data could not be loaded." />
      ) : playTypes.length === 0 ? (
        <EmptyPreview label="No play type data available yet." />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
              <div className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
                Primary Action
              </div>
              <div className="mt-2 text-lg font-black text-neutral-950 dark:text-white">
                {topPlayType?.display_name ?? "—"}
              </div>
              <div className="mt-1 text-xs leading-5 font-bold text-neutral-500 dark:text-neutral-500">
                {topPlayType
                  ? `${topPlayType.player_pct_of_total.toFixed(0)}% of scoring • ${topPlayType.player_ppg.toFixed(1)} PPG`
                  : "No dominant play type found."}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat
                  label="PPP"
                  value={topPlayType ? topPlayType.player_ppp.toFixed(2) : "—"}
                />
                <MiniStat
                  label="Opp Rank"
                  value={
                    topPlayType?.opponent_def_rank
                      ? `#${topPlayType.opponent_def_rank}`
                      : "—"
                  }
                />
                <MiniStat
                  label="Good Share"
                  value={
                    favorableShare !== null
                      ? `${favorableShare.toFixed(0)}%`
                      : "—"
                  }
                />
                <MiniStat label="Types" value={playTypes.length} />
              </div>
            </div>

            <div className="border-brand/20 bg-brand/[0.06] dark:bg-brand/[0.08] rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <span className="border-brand/25 bg-brand/10 text-brand flex h-6 w-6 items-center justify-center rounded-lg border">
                  <Info className="h-3.5 w-3.5" />
                </span>
                <div className="text-brand text-[10px] font-black tracking-[0.16em] uppercase">
                  PPP
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 font-bold text-neutral-600 dark:text-neutral-400">
                Points per possession. It shows how efficiently a player scores
                when a possession ends in that play type.
              </p>
              <p className="mt-2 text-[11px] leading-5 font-bold text-neutral-500 dark:text-neutral-500">
                High scoring share shows volume. High PPP shows quality. A
                strong over gets more interesting when both the player is
                efficient and the opponent allows soft PPP on that action.
              </p>
            </div>
          </aside>

          <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
            <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {playTypes.map((playType, index) => (
                <PlayTypeRow
                  key={playType.play_type}
                  playType={playType}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayTypeRow({
  playType,
  index,
}: {
  playType: PlayTypeData;
  index: number;
}) {
  const tone = getDefenseRankTone(playType.opponent_def_rank, 30);
  const efficiency = getPppTone(playType.player_ppp);
  const share = Math.max(0, Math.min(100, playType.player_pct_of_total));

  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_84px_88px_82px] items-center gap-3 bg-white/40 px-3 py-3 text-xs max-lg:grid-cols-[28px_minmax(0,1fr)_72px] dark:bg-neutral-900/20">
      <div className="text-center text-[10px] font-black text-neutral-500 tabular-nums dark:text-neutral-500">
        {index + 1}
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-black text-neutral-950 dark:text-white">
            {playType.display_name}
          </div>
          <div className="hidden text-[10px] font-black text-neutral-700 tabular-nums sm:block dark:text-neutral-300">
            {playType.player_pct_of_total.toFixed(0)}%
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <span
            className={cn("block h-full rounded-full", tone.bar)}
            style={{ width: `${share}%` }}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          <span>{playType.player_ppg.toFixed(1)} PPG</span>
          <span>{playType.player_possessions.toFixed(0)} poss</span>
          <span>{Math.round(playType.player_fg_pct * 100)}% FG</span>
        </div>
      </div>

      <div className="text-right">
        <div className={cn("font-black tabular-nums", efficiency.text)}>
          {playType.player_ppp.toFixed(2)}
        </div>
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          PPP • {efficiency.label}
        </div>
      </div>

      <div className="text-right max-lg:hidden">
        <div className={cn("font-black tabular-nums", tone.text)}>
          {playType.opponent_def_rank ? `#${playType.opponent_def_rank}` : "—"}
        </div>
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {playType.opponent_ppp_allowed != null
            ? `${playType.opponent_ppp_allowed.toFixed(2)} allowed`
            : "Opp rank"}
        </div>
      </div>

      <span
        className={cn(
          "rounded-md px-2 py-1 text-center text-[9px] font-black tracking-[0.12em] uppercase max-lg:hidden",
          tone.badge,
        )}
      >
        {tone.label}
      </span>
    </div>
  );
}

function getPppTone(ppp: number | null | undefined) {
  if (ppp == null || !Number.isFinite(ppp)) {
    return {
      label: "Unknown",
      text: "text-neutral-500 dark:text-neutral-400",
      badge: "bg-neutral-500/10 text-neutral-500",
    };
  }

  if (ppp >= 1.15) {
    return {
      label: "Elite",
      text: "text-emerald-500 dark:text-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }

  if (ppp >= 1) {
    return {
      label: "Efficient",
      text: "text-brand",
      badge: "bg-brand/10 text-brand",
    };
  }

  if (ppp >= 0.9) {
    return {
      label: "Fine",
      text: "text-amber-500 dark:text-amber-400",
      badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };
  }

  return {
    label: "Low",
    text: "text-red-500 dark:text-red-400",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
}

export function OddsPanel({
  profile,
  sport,
  activeLine,
  onLineSelect,
  odds,
  isLoading,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  activeLine: number | null;
  onLineSelect?: (line: number) => void;
  odds: LineOdds | null;
  isLoading: boolean;
}) {
  const rawLines = odds?.allLines?.length ? odds.allLines : [];
  // Pull the comprehensive line list directly from the same v2 endpoint the
  // odds-screen tool uses. The drilldown's `useAlternateLines` route is built
  // on a precomputed `linesidx` ZSET that can lag/be incomplete, so it
  // sometimes drops lines that exist in the source-of-truth per-book odds
  // blobs. This fetch backfills those missing lines so the table mirrors what
  // a user would see on the main Odds Screen.
  const v2PlayerKey = useMemo(() => {
    if (!profile.playerName) return null;
    return profile.playerName.toLowerCase().replace(/\s+/g, "_");
  }, [profile.playerName]);
  const v2AlternatesQuery = useQuery<{
    all_lines?: Array<{
      ln: number;
      books?: Record<string, {
        over?: { price: number; u?: string | null; m?: string | null };
        under?: { price: number; u?: string | null; m?: string | null };
      }>;
      best?: {
        over?: { bk: string; price: number };
        under?: { bk: string; price: number };
      };
    }>;
  }>({
    queryKey: ["odds-tab-v2-alts", sport, profile.eventId, profile.market, v2PlayerKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        sport,
        eventId: profile.eventId!,
        market: profile.market,
        player: v2PlayerKey!,
      });
      const res = await fetch(`/api/v2/props/alternates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load alternates");
      return res.json();
    },
    enabled: !!profile.eventId && !!profile.market && !!v2PlayerKey,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const mergedRawLines = useMemo(() => {
    const v2Entries = v2AlternatesQuery.data?.all_lines ?? [];
    if (v2Entries.length === 0) return rawLines;
    const v2Mapped = v2Entries.map((entry) => ({
      line: entry.ln,
      bestOver: entry.best?.over
        ? {
            book: entry.best.over.bk,
            price: entry.best.over.price,
            url: null as string | null,
            mobileUrl: null as string | null,
          }
        : null,
      bestUnder: entry.best?.under
        ? {
            book: entry.best.under.bk,
            price: entry.best.under.price,
            url: null as string | null,
            mobileUrl: null as string | null,
          }
        : null,
      books: Object.fromEntries(
        Object.entries(entry.books ?? {}).map(([book, sides]) => [
          book,
          {
            over: sides.over
              ? { price: sides.over.price, url: sides.over.u ?? null, mobileUrl: sides.over.m ?? null }
              : undefined,
            under: sides.under
              ? { price: sides.under.price, url: sides.under.u ?? null, mobileUrl: sides.under.m ?? null }
              : undefined,
          },
        ]),
      ),
    }));
    // v2 wins for lines present in both — its book coverage is more complete.
    // Keep any rawLines that v2 doesn't have so we don't regress.
    const byLine = new Map<number, (typeof rawLines)[number]>();
    for (const line of rawLines) byLine.set(line.line, line);
    for (const v2 of v2Mapped) byLine.set(v2.line, v2 as (typeof rawLines)[number]);
    return Array.from(byLine.values()).sort((a, b) => a.line - b.line);
  }, [rawLines, v2AlternatesQuery.data]);
  const [selectedSide, setSelectedSide] = useState<"over" | "under">("over");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [oddsSubTab, setOddsSubTab] = useState<"lines" | "movement">("lines");
  const [lineHistoryContext, setLineHistoryContext] =
    useState<LineHistoryContext | null>(null);
  // Collapse upstream book aliases that resolve to the same display book
  // (e.g., "fanduel-yourway" + "fanduelyourway" → "fanduelyourway"). Without
  // this, the table renders two columns with identical headers because
  // bookColumns keys on the raw upstream id while the BookHeader name comes
  // from the normalized id.
  const lines = useMemo(() => {
    return mergedRawLines.map((line) => {
      const merged: typeof line.books = {};
      for (const [book, sides] of Object.entries(line.books ?? {})) {
        const canonical = normalizeSportsbookId(book);
        const existing = merged[canonical];
        if (!existing) {
          merged[canonical] = sides;
          continue;
        }
        merged[canonical] = {
          over: pickBetterOdds(existing.over, sides.over),
          under: pickBetterOdds(existing.under, sides.under),
        };
      }
      return {
        ...line,
        books: merged,
        bestOver: line.bestOver
          ? { ...line.bestOver, book: normalizeSportsbookId(line.bestOver.book) }
          : line.bestOver,
        bestUnder: line.bestUnder
          ? { ...line.bestUnder, book: normalizeSportsbookId(line.bestUnder.book) }
          : line.bestUnder,
      };
    });
  }, [mergedRawLines]);
  const activeLineOdds =
    activeLine !== null
      ? (lines.find((line) => Math.abs(line.line - activeLine) < 0.001) ?? null)
      : null;
  const isDefaultLine =
    profile.line !== null &&
    activeLine !== null &&
    Math.abs(profile.line - activeLine) < 0.001;
  const activeBestOver =
    activeLineOdds?.bestOver ??
    (isDefaultLine ? (odds?.bestOver ?? profile.bestOdds) : null);
  const activeBestUnder =
    activeLineOdds?.bestUnder ?? (isDefaultLine ? odds?.bestUnder : null);
  const activeBooks = activeLineOdds?.books ?? {};
  // Stable column order — sort by how many lines each book has odds for, then
  // by display name as a tiebreak. Intentionally NOT keyed on the currently
  // selected line, otherwise picking a different line row in the table would
  // reshuffle every column and the user loses their place.
  const bookColumns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) {
      for (const [book, sides] of Object.entries(line.books ?? {})) {
        if (sides.over || sides.under) {
          counts.set(book, (counts.get(book) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort(([bookA, countA], [bookB, countB]) => {
        if (countA !== countB) return countB - countA;
        return getBookDisplayName(bookA).localeCompare(getBookDisplayName(bookB));
      })
      .map(([book]) => book);
  }, [lines]);

  useEffect(() => {
    if (bookColumns.length === 0) {
      setSelectedBookId(null);
      return;
    }
    setSelectedBookId((current) => {
      if (current && bookColumns.includes(current)) return current;
      return activeBestOver?.book ?? activeBestUnder?.book ?? bookColumns[0];
    });
  }, [activeBestOver?.book, activeBestUnder?.book, bookColumns]);

  const selectedLineBook =
    selectedBookId && activeLineOdds
      ? (activeLineOdds.books[selectedBookId] ?? null)
      : null;
  const selectedPrice =
    selectedSide === "over"
      ? (selectedLineBook?.over?.price ?? null)
      : (selectedLineBook?.under?.price ?? null);
  const selectedBest =
    selectedSide === "over" ? activeBestOver : activeBestUnder;
  const isDoubleDoubleMarket = profile.market === "player_double_double";
  const isTripleDoubleMarket = profile.market === "player_triple_double";
  const isSingleLineOddsMarket =
    isDoubleDoubleMarket || isTripleDoubleMarket;
  const doubleDoubleSheet = useDoubleDoubleSheet({
    enabled: isDoubleDoubleMarket,
  });
  const tripleDoubleSheet = useTripleDoubleSheet({
    enabled: isTripleDoubleMarket,
  });
  const sgpComparison = useMemo(
    () =>
      resolveSgpBuildComparison({
        profile,
        isDoubleDoubleMarket,
        isTripleDoubleMarket,
        doubleDoubleRows: doubleDoubleSheet.data?.data?.rows ?? [],
        tripleDoubleRows: tripleDoubleSheet.data?.data?.rows ?? [],
      }),
    [
      profile,
      isDoubleDoubleMarket,
      isTripleDoubleMarket,
      doubleDoubleSheet.data?.data?.rows,
      tripleDoubleSheet.data?.data?.rows,
    ],
  );
  const currentPricesByBook = useMemo(() => {
    const prices: Record<string, number> = {};
    if (!activeLineOdds) return prices;
    for (const [book, sides] of Object.entries(activeLineOdds.books ?? {})) {
      const price =
        selectedSide === "over" ? sides.over?.price : sides.under?.price;
      if (typeof price === "number") prices[book] = price;
    }
    return prices;
  }, [activeLineOdds, selectedSide]);

  const oddIdsByBook = useMemo(() => {
    const ids: Record<string, string> = {};
    if (!activeLineOdds) return ids;
    for (const [book, sides] of Object.entries(activeLineOdds.books ?? {})) {
      const oddId =
        selectedSide === "over" ? sides.over?.oddId : sides.under?.oddId;
      if (oddId) ids[book] = oddId;
    }
    return ids;
  }, [activeLineOdds, selectedSide]);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <PreviewHeader title="Odds Board" kicker="Books, lines, movement" />
        <div className="flex w-fit rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
          <MiniToggle active={selectedSide === "over"} onClick={() => setSelectedSide("over")}>
            {isSingleLineOddsMarket ? "Yes" : "Over"}
          </MiniToggle>
          <MiniToggle active={selectedSide === "under"} onClick={() => setSelectedSide("under")}>
            {isSingleLineOddsMarket ? "No" : "Under"}
          </MiniToggle>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {/* Best Current — compact horizontal banner. Was a sidebar card, now
            a single-row strip so the table below gets the full width. */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200/70 bg-gradient-to-br from-neutral-50 via-white/50 to-neutral-50/70 px-3 py-2.5 shadow-sm ring-1 ring-black/[0.02] dark:border-neutral-800/70 dark:from-neutral-950/50 dark:via-neutral-900/40 dark:to-neutral-950/60 dark:ring-white/[0.03]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
              Best at
            </span>
            <span className="text-sm font-black text-neutral-950 dark:text-white">
              {formatDecimal(activeLine)}+ {MARKET_LABELS[profile.market] ?? "Line"}
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black tracking-[0.14em] text-emerald-600 uppercase dark:text-emerald-400">
              Live
            </span>
          </div>
          <div className="flex flex-1 flex-wrap items-stretch gap-2 sm:justify-end">
            <OddsBookLine
              label={isSingleLineOddsMarket ? "Yes" : "Over"}
              entry={activeBestOver}
            />
            <OddsBookLine
              label={isSingleLineOddsMarket ? "No" : "Under"}
              entry={activeBestUnder}
            />
          </div>
        </div>

        {/* Sub-tabs — split the long alt-lines table from the line-movement
            card so each gets full vertical space when active. The toggle sits
            right under the Best Current banner so the user always knows
            which view they're in. */}
        <div className="flex w-fit rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
          <MiniToggle
            active={oddsSubTab === "lines"}
            onClick={() => setOddsSubTab("lines")}
          >
            All Lines
          </MiniToggle>
          <MiniToggle
            active={oddsSubTab === "movement"}
            onClick={() => setOddsSubTab("movement")}
          >
            Movement
          </MiniToggle>
        </div>

        {oddsSubTab === "lines" && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          {isLoading ? (
            <SkeletonRows rows={7} />
          ) : lines.length === 0 ? (
            <EmptyPreview label="No alternate lines available for this prop." />
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[920px] border-separate border-spacing-0 text-xs">
                <thead className="sticky top-0 z-[2]">
                  <tr>
                    <th
                      className={cn(
                        "sticky left-0 z-[3] w-[108px] px-3 py-2.5 text-left",
                        "border-b border-r-2 border-b-neutral-200 border-r-neutral-200 dark:border-b-neutral-800 dark:border-r-neutral-700",
                        "bg-gradient-to-r from-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:to-neutral-800/60",
                        "text-[11px] font-semibold tracking-wider text-neutral-600 uppercase dark:text-neutral-400",
                      )}
                    >
                      Line
                    </th>
                    {bookColumns.map((book) => (
                      <th
                        key={book}
                        className={cn(
                          "min-w-[96px] px-1.5 py-1.5 text-center align-middle",
                          "border-b border-r border-neutral-200 last:border-r-0 dark:border-neutral-800",
                          selectedBookId === book
                            ? "bg-brand/10"
                            : "bg-gradient-to-r from-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:to-neutral-800/60",
                        )}
                      >
                        <BookHeader
                          book={book}
                          active={selectedBookId === book}
                          onClick={() => setSelectedBookId(book)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, rowIdx) => {
                    const isActive =
                      activeLine !== null &&
                      Math.abs(line.line - activeLine) < 0.001;
                    // Fully opaque row colors so the sticky LINE column doesn't
                    // bleed through when the user scrolls horizontally. Was using
                    // semi-transparent neutrals (`/60`, `/40`) which made the
                    // sticky `bg-inherit` cell see-through.
                    const rowBg = isActive
                      ? "bg-brand/15 dark:bg-brand/20"
                      : rowIdx % 2 === 0
                        ? "bg-white dark:bg-neutral-900"
                        : "bg-neutral-50 dark:bg-neutral-950";
                    return (
                      <tr
                        key={line.line}
                        className={cn(rowBg, "transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-[1] px-3 py-1.5",
                            "border-b border-r-2 border-b-neutral-200 border-r-neutral-200 dark:border-b-neutral-800 dark:border-r-neutral-700",
                            "bg-inherit",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onLineSelect?.(line.line)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors",
                              isActive
                                ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                                : "text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800",
                            )}
                          >
                            <span className="text-[13px] font-bold tabular-nums">
                              {formatDecimal(line.line)}+
                            </span>
                            {isActive && (
                              <span className="text-[9px] font-bold tracking-[0.12em] uppercase">
                                Live
                              </span>
                            )}
                          </button>
                        </td>
                        {bookColumns.map((book) => {
                          const sides = line.books?.[book] ?? {};
                          const over = sides.over ?? null;
                          const under = sides.under ?? null;
                          const isBookCol = selectedBookId === book;
                          return (
                            <td
                              key={`${line.line}-${book}`}
                              className={cn(
                                "px-1 py-1 text-center align-middle",
                                "border-b border-r border-neutral-100 last:border-r-0 dark:border-neutral-800/60",
                                isBookCol && "bg-brand/[0.06]",
                              )}
                            >
                              <OddsMatrixCell
                                over={over}
                                under={under}
                                selectedSide={selectedSide}
                                isBookSelected={isBookCol && isActive}
                                isBestOver={
                                  !!over &&
                                  line.bestOver?.book === book &&
                                  line.bestOver.price === over.price
                                }
                                isBestUnder={
                                  !!under &&
                                  line.bestUnder?.book === book &&
                                  line.bestUnder.price === under.price
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {oddsSubTab === "lines" && isSingleLineOddsMarket && (
          <div className="rounded-xl border border-neutral-200/70 bg-gradient-to-br from-neutral-50 via-white/50 to-neutral-50/70 p-3 shadow-sm ring-1 ring-black/[0.02] dark:border-neutral-800/70 dark:from-neutral-950/50 dark:via-neutral-900/40 dark:to-neutral-950/60 dark:ring-white/[0.03]">
            <SgpBuildComparison
              comparison={sgpComparison}
              isLoading={
                isDoubleDoubleMarket
                  ? doubleDoubleSheet.isLoading
                  : tripleDoubleSheet.isLoading
              }
              market={profile.market}
            />
          </div>
        )}

        {oddsSubTab === "movement" && (
        /* Line Movement — its own sub-tab. Renders the full inline card
           which already has its own LINE MOVEMENT header. */
        <InlineLineMovementCard
          sport={sport}
          eventId={profile.eventId}
          market={profile.market}
          marketDisplay={MARKET_LABELS[profile.market] ?? profile.market}
          playerName={profile.playerName}
          team={profile.teamAbbr}
          activeLine={activeLine}
          lines={lines.map((line) => line.line)}
          selectedBookId={selectedBookId}
          selectedSide={selectedSide}
          selectedPrice={selectedPrice}
          bestPrice={selectedBest?.price ?? null}
          bookIds={bookColumns}
          selectionMode={isSingleLineOddsMarket ? "yes-no" : "over-under"}
          currentPricesByBook={currentPricesByBook}
          oddIdsByBook={oddIdsByBook}
          onBookChange={setSelectedBookId}
          onLineChange={(line) => onLineSelect?.(line)}
          onSideChange={setSelectedSide}
          onOpenFull={setLineHistoryContext}
        />
        )}
      </div>
      <LineHistoryDialog
        open={!!lineHistoryContext}
        onOpenChange={(open) => {
          if (!open) setLineHistoryContext(null);
        }}
        context={lineHistoryContext}
      />
    </div>
  );
}

function GameLogPanel({
  profile,
  sport,
  games,
  line,
  isLoading,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  games: BoxScoreGame[];
  line: number | null;
  isLoading: boolean;
}) {
  const [selectedWnbaSeason, setSelectedWnbaSeason] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setSelectedWnbaSeason(null);
  }, [profile.playerId, sport]);

  const wnbaSeasonCounts = useMemo(() => {
    if (sport !== "wnba") return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const game of games) {
      const season = getWnbaSeasonFromDate(game.date);
      if (!season) continue;
      counts.set(season, (counts.get(season) ?? 0) + 1);
    }
    return counts;
  }, [games, sport]);

  const defaultWnbaSeason =
    (wnbaSeasonCounts.get("2026") ?? 0) > 0
      ? "2026"
      : (wnbaSeasonCounts.get("2025") ?? 0) > 0
        ? "2025"
        : "2026";
  const activeWnbaSeason =
    sport === "wnba" ? (selectedWnbaSeason ?? defaultWnbaSeason) : null;
  const shownGames = useMemo(() => {
    if (sport !== "wnba" || !activeWnbaSeason) return games;
    return games.filter(
      (game) => getWnbaSeasonFromDate(game.date) === activeWnbaSeason,
    );
  }, [activeWnbaSeason, games, sport]);
  const propLabel = MARKET_LABELS[profile.market] ?? "PROP";
  const isBinaryMarket =
    profile.market === "player_double_double" ||
    profile.market === "player_triple_double";
  const logKicker =
    sport === "wnba"
      ? `${activeWnbaSeason} season · ${shownGames.length} games · prop ${propLabel}${
          line !== null ? ` ${formatDecimal(line)}+` : ""
        }`
      : `Season · ${shownGames.length || 0} games · prop ${propLabel}${
          line !== null ? ` ${formatDecimal(line)}+` : ""
        }`;

  // Per-stat averages across the visible games — drives the AVG footer row.
  // Mirrors what ESPN / NBA.com surface at the bottom of a player game log.
  const avg = useMemo(() => {
    if (shownGames.length === 0) return null;
    const n = shownGames.length;
    const sum = (key: keyof BoxScoreGame) =>
      shownGames.reduce((acc, g) => acc + (Number(g[key]) || 0), 0);
    return {
      games: n,
      min: sum("minutes") / n,
      pts: sum("pts") / n,
      reb: sum("reb") / n,
      ast: sum("ast") / n,
      fg3m: sum("fg3m") / n,
      stl: sum("stl") / n,
      blk: sum("blk") / n,
      tov: sum("tov") / n,
      fgm: sum("fgm") / n,
      fga: sum("fga") / n,
      fg3a: sum("fg3a") / n,
      ftm: sum("ftm") / n,
      fta: sum("fta") / n,
      prop:
        shownGames.reduce(
          (acc, g) => acc + (Number(getMarketStat(g, profile.market)) || 0),
          0,
        ) / n,
    };
  }, [shownGames, profile.market]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PreviewHeader title="Game Log" kicker={logKicker} />
        {sport === "wnba" && (
          <div className="flex rounded-lg border border-neutral-200/80 bg-neutral-100/70 p-0.5 dark:border-neutral-800/80 dark:bg-neutral-950/50">
            {["2026", "2025"].map((season) => {
              const active = activeWnbaSeason === season;
              const count = wnbaSeasonCounts.get(season) ?? 0;
              return (
                <button
                  key={season}
                  type="button"
                  onClick={() => setSelectedWnbaSeason(season)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-black tracking-[0.12em] uppercase transition-colors",
                    active
                      ? "bg-brand text-neutral-950 shadow-sm dark:text-neutral-950"
                      : "text-neutral-500 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100",
                  )}
                >
                  <span>{season}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] tabular-nums",
                      active
                        ? "bg-neutral-950/10 text-neutral-950"
                        : "bg-neutral-200/80 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {isLoading ? (
          <SkeletonRows rows={10} />
        ) : shownGames.length === 0 ? (
          <EmptyPreview
            label={
              sport === "wnba"
                ? `No ${activeWnbaSeason} game log rows for this player yet.`
                : "Game log rows will appear here."
            }
          />
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[940px] border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-gradient-to-r from-neutral-50 to-neutral-100/60 text-[10px] font-semibold tracking-wider text-neutral-600 uppercase dark:from-neutral-900 dark:to-neutral-800/60 dark:text-neutral-400">
                  <GameLogHeader sticky>Date</GameLogHeader>
                  <GameLogHeader>Matchup</GameLogHeader>
                  <GameLogHeader align="center">W/L</GameLogHeader>
                  <GameLogHeader align="right">Min</GameLogHeader>
                  <GameLogHeader align="right" highlight>
                    {propLabel}
                  </GameLogHeader>
                  <GameLogHeader align="right">FG</GameLogHeader>
                  <GameLogHeader align="right">3PT</GameLogHeader>
                  <GameLogHeader align="right">FT</GameLogHeader>
                  <GameLogHeader align="right">Reb</GameLogHeader>
                  <GameLogHeader align="right">Ast</GameLogHeader>
                  <GameLogHeader align="right">Stl</GameLogHeader>
                  <GameLogHeader align="right">Blk</GameLogHeader>
                  <GameLogHeader align="right">TO</GameLogHeader>
                  <GameLogHeader align="right">Pts</GameLogHeader>
                </tr>
              </thead>
              <tbody>
                {shownGames.map((game, idx) => {
                  const stat = getMarketStat(game, profile.market);
                  const hit =
                    line !== null && stat !== null ? stat >= line : null;
                  // Opaque zebra colors so the sticky DATE column stays a solid
                  // surface during horizontal scroll.
                  const rowBg =
                    idx % 2 === 0
                      ? "bg-white dark:bg-neutral-900"
                      : "bg-neutral-50 dark:bg-neutral-950";
                  return (
                    <tr
                      key={`${game.gameId}-${game.date}`}
                      className={cn(
                        rowBg,
                        "transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
                      )}
                    >
                      <GameLogCell sticky align="left">
                        <span className="text-[11px] font-bold text-neutral-700 tabular-nums dark:text-neutral-300">
                          {formatDate(game.date)}
                        </span>
                      </GameLogCell>
                      <GameLogCell align="left">
                        <MatchupCellInline
                          sport={sport}
                          opponentAbbr={game.opponentAbbr}
                          homeAway={game.homeAway}
                        />
                      </GameLogCell>
                      <GameLogCell align="center">
                        <ResultPill
                          result={game.result}
                          teamScore={game.teamScore}
                          opponentScore={game.opponentScore}
                        />
                      </GameLogCell>
                      <GameLogCell align="right">
                        {formatMinutes(game.minutes)}
                      </GameLogCell>
                      <GameLogCell align="right" highlight>
                        <PropValue
                          value={stat}
                          hit={hit}
                          binary={isBinaryMarket}
                        />
                      </GameLogCell>
                      <GameLogCell align="right">
                        <Splits made={game.fgm} att={game.fga} />
                      </GameLogCell>
                      <GameLogCell align="right">
                        <Splits made={game.fg3m} att={game.fg3a} />
                      </GameLogCell>
                      <GameLogCell align="right">
                        <Splits made={game.ftm} att={game.fta} />
                      </GameLogCell>
                      <GameLogCell align="right">{game.reb}</GameLogCell>
                      <GameLogCell align="right">{game.ast}</GameLogCell>
                      <GameLogCell align="right">{game.stl}</GameLogCell>
                      <GameLogCell align="right">{game.blk}</GameLogCell>
                      <GameLogCell align="right">{game.tov}</GameLogCell>
                      <GameLogCell align="right" emphasized>
                        {game.pts}
                      </GameLogCell>
                    </tr>
                  );
                })}
              </tbody>
              {avg && (
                <tfoot className="sticky bottom-0 z-[1]">
                  <tr className="bg-neutral-100/95 text-[10px] font-black tracking-[0.14em] text-neutral-700 uppercase backdrop-blur dark:bg-neutral-900/95 dark:text-neutral-300">
                    <GameLogCell sticky align="left" footer>
                      Avg
                    </GameLogCell>
                    <GameLogCell align="left" footer>
                      <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                        {avg.games} GP
                      </span>
                    </GameLogCell>
                    <GameLogCell align="center" footer>
                      —
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.min.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer highlight>
                      {isBinaryMarket
                        ? `${(avg.prop * 100).toFixed(0)}%`
                        : avg.prop.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.fgm.toFixed(1)}-{avg.fga.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.fg3m.toFixed(1)}-{avg.fg3a.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.ftm.toFixed(1)}-{avg.fta.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.reb.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.ast.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.stl.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.blk.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer>
                      {avg.tov.toFixed(1)}
                    </GameLogCell>
                    <GameLogCell align="right" footer emphasized>
                      {avg.pts.toFixed(1)}
                    </GameLogCell>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Game-log table primitives ─────────────────────────────────────────────
// Header / cell wrappers that share the ESPN-style grid structure
// (border-separate, sticky DATE column, gradient header, zebra rows).

function GameLogHeader({
  children,
  align = "left",
  sticky,
  highlight,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  highlight?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-2 py-2 whitespace-nowrap",
        "border-b border-r border-neutral-200 last:border-r-0 dark:border-neutral-800",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
        sticky &&
          "sticky left-0 z-[3] border-r-2 border-r-neutral-200 dark:border-r-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:to-neutral-800/60",
        highlight && "text-brand",
      )}
    >
      {children}
    </th>
  );
}

function GameLogCell({
  children,
  align = "left",
  sticky,
  highlight,
  emphasized,
  footer,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  highlight?: boolean;
  emphasized?: boolean;
  footer?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2 whitespace-nowrap tabular-nums",
        footer ? "py-2 font-black" : "py-1.5 font-medium text-neutral-700 dark:text-neutral-200",
        "border-b border-r border-neutral-100 last:border-r-0 dark:border-neutral-800/60",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
        sticky && "sticky left-0 z-[1] border-r-2 border-r-neutral-200 bg-inherit dark:border-r-neutral-700",
        highlight && !footer && "bg-brand/[0.04]",
        emphasized && !footer && "font-black text-neutral-900 dark:text-white",
      )}
    >
      {children}
    </td>
  );
}

function MatchupCellInline({
  sport,
  opponentAbbr,
  homeAway,
}: {
  sport: "nba" | "wnba";
  opponentAbbr: string;
  homeAway: "H" | "A";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
        {homeAway === "H" ? "vs" : "@"}
      </span>
      <img
        src={getTeamLogoUrl(opponentAbbr, sport)}
        alt={opponentAbbr}
        className="h-4 w-4 object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="text-[11px] font-bold text-neutral-900 dark:text-white">
        {opponentAbbr}
      </span>
    </span>
  );
}

function ResultPill({
  result,
  teamScore,
  opponentScore,
}: {
  result: "W" | "L";
  teamScore: number;
  opponentScore: number;
}) {
  const isWin = result === "W";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums",
        isWin
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
      )}
      title={`${result} ${teamScore}-${opponentScore}`}
    >
      <span>{result}</span>
      <span className="font-medium opacity-70">
        {teamScore}-{opponentScore}
      </span>
    </span>
  );
}

function PropValue({
  value,
  hit,
  binary,
}: {
  value: number | null;
  hit: boolean | null;
  binary: boolean;
}) {
  if (value === null) {
    return <span className="text-neutral-400">—</span>;
  }
  const display = binary ? (value ? "✓" : "—") : String(value);
  return (
    <span
      className={cn(
        "inline-block min-w-[28px] rounded px-1.5 py-0.5 text-[12px] font-black tabular-nums",
        hit === true &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        hit === false && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
        hit === null && "text-neutral-700 dark:text-neutral-200",
      )}
    >
      {display}
    </span>
  );
}

function Splits({ made, att }: { made: number; att: number }) {
  if (!att) return <span className="text-neutral-400">—</span>;
  return (
    <span className="tabular-nums">
      {made}
      <span className="text-neutral-400">-</span>
      {att}
    </span>
  );
}

function formatMinutes(min: number) {
  if (!min) return "—";
  return Number.isInteger(min) ? String(min) : min.toFixed(1);
}

function OverviewPanel({
  profile,
  profiles,
  sport,
  recentGames,
}: {
  profile: HitRateProfile;
  profiles: HitRateProfile[];
  sport: "nba" | "wnba";
  recentGames: BoxScoreGame[];
}) {
  const overviewMarkets = [
    { market: "player_points", label: "PTS" },
    { market: "player_rebounds", label: "REB" },
    { market: "player_assists", label: "AST" },
    { market: "player_threes_made", label: "3PM" },
  ];
  const total = TOTAL_TEAMS_BY_SPORT[sport];
  const defTier = getMatchupTier(profile.matchupRank, total);
  const paceRank = profile.paceContext?.opponentRecent.l5Rank ?? null;
  const paceTier =
    paceRank !== null ? getMatchupTier(total - paceRank + 1, total) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <PreviewHeader title="Stat Overview" kicker="Market form" />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {overviewMarkets.map(({ market, label }) => {
            const row = profiles.find((p) => p.market === market);
            const delta =
              row?.last10Avg != null && row?.seasonAvg != null
                ? row.last10Avg - row.seasonAvg
                : null;
            return (
              <div
                key={market}
                className={cn(
                  "rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35",
                  market === profile.market && "border-brand/35 bg-brand/10",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
                    {label}
                  </span>
                  {delta !== null && (
                    <span
                      className={cn(
                        "text-[10px] font-black tabular-nums",
                        delta >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xl font-black text-neutral-950 tabular-nums dark:text-white">
                  {row?.last10Avg != null ? row.last10Avg.toFixed(1) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <ContextPanel
          label="Defense Rank"
          value={profile.matchupRank !== null ? `#${profile.matchupRank}` : "—"}
          badge={defTierLabel(defTier)}
          tone={defTier}
        />
        <ContextPanel
          label="Opponent Pace"
          value={paceRank !== null ? `#${paceRank}` : "—"}
          badge={paceTierLabel(paceTier)}
          tone={paceTier}
        />
        <ContextPanel
          label="Recent Sample"
          value={recentGames.length > 0 ? `${recentGames.length}` : "—"}
          badge="Loaded"
          tone="neutral"
        />
      </div>
    </div>
  );
}

function RosterPanel({
  rosterPlayers,
  market,
  teammateFilters,
  onTeammateFilterToggle,
  isLoadingRoster,
  lineupByPlayerId,
  teamLineup,
  isLoadingLineup,
  teamAbbr,
  sport,
}: {
  rosterPlayers: TeamRosterPlayer[];
  market: string;
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
  isLoadingRoster: boolean;
  lineupByPlayerId?: Map<number, LineupPlayer>;
  teamLineup?: TeamLineup | null;
  isLoadingLineup?: boolean;
  teamAbbr?: string | null;
  sport: "nba" | "wnba";
}) {
  // Column-based sort. Null = use the default per-section ordering (starters
  // by lineup_slot, bench by market stat). Clicking any column header sets
  // the field; clicking it again flips direction.
  const [sortField, setSortField] = useState<RosterSortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const handleColumnSort = (field: RosterSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Numeric stat columns default to descending (bigger first); text
      // columns default to ascending (A→Z reads naturally).
      setSortDir(
        field === "player" || field === "role" ? "asc" : "desc",
      );
    }
  };

  const hasLineup = !!lineupByPlayerId && lineupByPlayerId.size > 0;
  const sortColumnKey = sortColumnForMarket(market);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
        {hasLineup && teamLineup && (
          <LineupStatusStrip
            lineup={teamLineup}
            teamAbbr={teamAbbr ?? teamLineup.teamAbbr}
          />
        )}
        {isLoadingRoster ? (
          <SkeletonRows rows={7} />
        ) : rosterPlayers.length === 0 ? (
          <EmptyPreview label="Roster rows will appear here." />
        ) : (
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse text-xs">
              <thead className="sticky top-0 z-[1] bg-neutral-100/95 backdrop-blur dark:bg-neutral-950/95">
                <tr className="border-b border-neutral-200/70 text-[10px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:border-neutral-800/70 dark:text-neutral-500">
                  <SortHeader
                    field="player"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    align="left"
                  >
                    Player
                  </SortHeader>
                  <SortHeader
                    field="role"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                  >
                    Role
                  </SortHeader>
                  <SortHeader
                    field="min"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "min"}
                  >
                    Min/g
                  </SortHeader>
                  <SortHeader
                    field="pts"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "pts"}
                  >
                    PTS
                  </SortHeader>
                  <SortHeader
                    field="reb"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "reb"}
                  >
                    REB
                  </SortHeader>
                  <SortHeader
                    field="ast"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "ast"}
                  >
                    AST
                  </SortHeader>
                  <SortHeader
                    field="threes"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "threes"}
                  >
                    3PM
                  </SortHeader>
                  <SortHeader
                    field="pra"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                    marketHighlight={sortColumnKey === "pra"}
                  >
                    PRA
                  </SortHeader>
                  <SortHeader
                    field="usg"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                  >
                    USG%
                  </SortHeader>
                  <SortHeader
                    field="gp"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleColumnSort}
                  >
                    GP
                  </SortHeader>
                  <th className="px-3 py-2 text-center">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {(() => {
                  // Partition into Starters / Bench / Out so the table reads
                  // as three labeled sections (mirrors baseball slate-insights
                  // pattern). Out includes both lineup feed "may_not_play" and
                  // any player whose injury_status is OUT/Doubtful — they're
                  // the ones bettors most need to see segregated.
                  const starters: TeamRosterPlayer[] = [];
                  const bench: TeamRosterPlayer[] = [];
                  const out: TeamRosterPlayer[] = [];
                  for (const p of rosterPlayers) {
                    const lineup = lineupByPlayerId?.get(p.playerId);
                    const inj = (p.injuryStatus ?? "").toLowerCase();
                    // Only confirmed Out belongs in the OUT section. Q/D
                    // (questionable / doubtful) players still play often
                    // enough that they belong in their actual rotation slot —
                    // the inline Q/D glyph next to the name flags the risk.
                    const isOut = inj === "out";
                    if (isOut) out.push(p);
                    else if (lineup?.isStarter) starters.push(p);
                    else bench.push(p);
                  }

                  // Per-section sort. If a column header has been clicked,
                  // honor that field/dir for every section. Otherwise fall
                  // back to per-section defaults (starters by lineup_slot,
                  // others by the active market stat).
                  const sortPlayersForSection = (
                    arr: TeamRosterPlayer[],
                    section: "starters" | "bench" | "out",
                  ): TeamRosterPlayer[] => {
                    const sorted = [...arr];
                    if (sortField) {
                      const dirMul = sortDir === "asc" ? 1 : -1;
                      sorted.sort((a, b) => {
                        const av = getRosterSortValue(
                          a,
                          sortField,
                          lineupByPlayerId?.get(a.playerId),
                        );
                        const bv = getRosterSortValue(
                          b,
                          sortField,
                          lineupByPlayerId?.get(b.playerId),
                        );
                        if (typeof av === "string" && typeof bv === "string") {
                          return av.localeCompare(bv) * dirMul;
                        }
                        return ((av as number) - (bv as number)) * dirMul;
                      });
                    } else if (section === "starters" && hasLineup) {
                      sorted.sort((a, b) => {
                        const sa =
                          lineupByPlayerId?.get(a.playerId)?.lineupSlot ?? 99;
                        const sb =
                          lineupByPlayerId?.get(b.playerId)?.lineupSlot ?? 99;
                        return sa - sb;
                      });
                    } else {
                      sorted.sort(
                        (a, b) =>
                          pickRosterStatForMarket(b, market) -
                          pickRosterStatForMarket(a, market),
                      );
                    }
                    return sorted;
                  };

                  const sortedStarters = sortPlayersForSection(
                    starters,
                    "starters",
                  );
                  const sortedBench = sortPlayersForSection(bench, "bench");
                  const sortedOut = sortPlayersForSection(out, "out");

                  // When no lineup feed is present everyone falls into "bench"
                  // by the partition above. Skip the section header in that
                  // case so the table looks identical to its pre-lineup form.
                  const showSections =
                    hasLineup &&
                    (sortedStarters.length > 0 || sortedOut.length > 0);
                  const sections: Array<{
                    key: string;
                    label: string | null;
                    players: TeamRosterPlayer[];
                  }> = showSections
                    ? [
                        {
                          key: "starters",
                          label: "Starters",
                          players: sortedStarters,
                        },
                        {
                          key: "bench",
                          label: "Bench",
                          players: sortedBench,
                        },
                        { key: "out", label: "Out", players: sortedOut },
                      ]
                    : [
                        {
                          key: "all",
                          label: null,
                          players: sortPlayersForSection(
                            rosterPlayers,
                            "bench",
                          ),
                        },
                      ];

                  let runningIndex = 0;
                  return sections
                    .filter((s) => s.players.length > 0)
                    .map((section) => (
                      <React.Fragment key={section.key}>
                        {section.label && (
                          <tr className="bg-neutral-50/50 dark:bg-neutral-900/40">
                            <td
                              colSpan={12}
                              className="px-3 py-1.5 text-[9px] font-black tracking-[0.18em] text-neutral-400 uppercase dark:text-neutral-500"
                            >
                              <div className="flex items-center gap-2">
                                <span>{section.label}</span>
                                <span className="rounded-full bg-neutral-200/80 px-1.5 py-px text-[9px] font-bold text-neutral-500 tabular-nums dark:bg-neutral-800/80 dark:text-neutral-400">
                                  {section.players.length}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        {section.players.map((player, sectionIdx) => {
                          const playerId = String(player.playerId);
                          const withActive = teammateFilters.some(
                            (f) => f.playerId === playerId && f.mode === "with",
                          );
                          const withoutActive = teammateFilters.some(
                            (f) =>
                              f.playerId === playerId && f.mode === "without",
                          );
                          const lineupEntry = lineupByPlayerId?.get(
                            player.playerId,
                          );
                          const role = getRoleTagFromLineup(
                            player,
                            runningIndex++,
                            lineupEntry,
                          );
                          // Zebra stripe — alternates within each section so
                          // the eye groups starters/bench/out independently.
                          const stripe =
                            sectionIdx % 2 === 0
                              ? "bg-white/30 dark:bg-neutral-900/15"
                              : "bg-neutral-50/60 dark:bg-neutral-900/40";
                          return (
                            <tr key={player.playerId} className={stripe}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
                                    <PlayerHeadshot
                                      sport={sport}
                                      nbaPlayerId={
                                        player.nbaPlayerId ?? player.playerId
                                      }
                                      name={player.name}
                                      size="tiny"
                                      className="h-full w-full"
                                    />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate font-black text-neutral-900 dark:text-white">
                                        {player.name}
                                      </span>
                                      <InjuryGlyph
                                        status={player.injuryStatus}
                                        notes={player.injuryNotes ?? null}
                                      />
                                    </div>
                                    <div className="mt-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                                      {player.position || "—"}{" "}
                                      {player.jerseyNumber
                                        ? `#${player.jerseyNumber}`
                                        : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={cn(
                                    "inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase",
                                    role.className,
                                  )}
                                >
                                  {role.label}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="mx-auto flex max-w-[128px] items-center justify-center gap-2">
                                  <span className="w-9 text-right font-black text-neutral-950 tabular-nums dark:text-white">
                                    {formatDecimal(player.avgMinutes)}
                                  </span>
                                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                                    <span
                                      className="bg-brand block h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, (player.avgMinutes / 40) * 100)}%`,
                                      }}
                                    />
                                  </span>
                                </div>
                              </td>
                              <RosterNumber value={player.avgPoints} />
                              <RosterNumber value={player.avgRebounds} />
                              <RosterNumber value={player.avgAssists} />
                              <RosterNumber value={player.avgThrees} />
                              <RosterNumber value={player.avgPra} />
                              <RosterNumber
                                value={formatUsagePercent(player.avgUsage)}
                                suffix="%"
                              />
                              <td className="px-3 py-2 text-center font-black text-neutral-700 tabular-nums dark:text-neutral-300">
                                {player.gamesPlayed}
                              </td>
                              <td className="px-3 py-2">
                                <div className="mx-auto flex w-fit items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                                  <MiniToggle
                                    active={withActive}
                                    onClick={() =>
                                      onTeammateFilterToggle({
                                        playerId,
                                        mode: "with",
                                      })
                                    }
                                  >
                                    With
                                  </MiniToggle>
                                  <MiniToggle
                                    active={withoutActive}
                                    onClick={() =>
                                      onTeammateFilterToggle({
                                        playerId,
                                        mode: "without",
                                      })
                                    }
                                  >
                                    W/O
                                  </MiniToggle>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Role tag — distinct from `getStartLikelihood` (which talks about
// "high/mix/bench" for the Trends viz). The Overview table needs the more
// literal Starter / Rotation / Fringe / Bench language users asked for.
function getRoleTag(
  player: TeamRosterPlayer,
  rotationIndex: number,
): { label: string; className: string } {
  const minutes = player.avgMinutes ?? 0;
  if (rotationIndex < 5 && minutes >= 26) {
    return { label: "Starter", className: "bg-brand/15 text-brand" };
  }
  if (minutes >= 18) {
    return {
      label: "Rotation",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (minutes >= 8) {
    return {
      label: "Fringe",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Bench",
    className:
      "bg-neutral-200/70 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400",
  };
}

// Lineup-aware role tag. Prefers the live lineup feed (Starter / Bench /
// May Not Play) when present, falls back to the minutes heuristic otherwise.
function getRoleTagFromLineup(
  player: TeamRosterPlayer,
  rotationIndex: number,
  lineup: LineupPlayer | undefined,
): { label: string; className: string } {
  if (lineup) {
    if (lineup.isStarter) {
      return { label: "Starter", className: "bg-brand/15 text-brand" };
    }
    // Non-starter → just "Bench". The inline Q/D injury glyph next to the
    // player name carries the questionable/doubtful risk signal; a redundant
    // "May Sit" pill on the same row was visual noise.
    return {
      label: "Bench",
      className:
        "bg-neutral-200/70 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400",
    };
  }
  return getRoleTag(player, rotationIndex);
}

// Small badge that mirrors the baseball slate-insights LineupBadge — emerald
// for confirmed lineups, amber for projected/expected.
function LineupStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "confirmed") {
    return (
      <span className="inline-flex w-fit rounded bg-emerald-500/15 px-1 py-px text-[8px] font-bold tracking-tight text-emerald-600 uppercase dark:text-emerald-400">
        Confirmed
      </span>
    );
  }
  if (s === "expected") {
    return (
      <span className="inline-flex w-fit rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold tracking-tight text-amber-600 uppercase dark:text-amber-400">
        Projected
      </span>
    );
  }
  return null;
}

// Compact status strip that lives INSIDE the roster table card (no separate
// boxed banner). Mirrors the baseball slate-insights pattern: tiny colored
// dot + label + meta in one quiet line. Sort toggle right-aligned.
function LineupStatusStrip({
  lineup,
  teamAbbr,
}: {
  lineup: TeamLineup;
  teamAbbr: string | null;
}) {
  const isConfirmed = lineup.overallStatus === "confirmed";
  const updatedAt = isConfirmed
    ? (lineup.confirmedAt ?? lineup.sourceUpdatedAt)
    : lineup.sourceUpdatedAt;
  const updatedAgo = updatedAt ? formatTimeAgo(updatedAt) : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200/60 bg-neutral-50/40 px-3 py-2 text-[11px] dark:border-neutral-800/60 dark:bg-neutral-900/30">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isConfirmed ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      <span
        className={cn(
          "font-bold",
          isConfirmed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400",
        )}
      >
        {isConfirmed ? "Confirmed" : "Projected"}
      </span>
      <span className="text-neutral-500 dark:text-neutral-500">
        · {teamAbbr ?? lineup.teamAbbr}
      </span>
      {updatedAgo && (
        <span className="text-neutral-400 dark:text-neutral-600">
          · updated {updatedAgo}
        </span>
      )}
      {lineup.source && (
        <span className="text-neutral-400 dark:text-neutral-600">
          · {lineup.source}
        </span>
      )}
    </div>
  );
}

// Sort field for the roster Overview table. Maps 1:1 to the columns the user
// can click; null in the panel state means "use per-section default order".
type RosterSortField =
  | "player"
  | "role"
  | "min"
  | "usg"
  | "pts"
  | "reb"
  | "ast"
  | "threes"
  | "pra"
  | "gp";

function getRosterSortValue(
  p: TeamRosterPlayer,
  field: RosterSortField,
  lineup: LineupPlayer | undefined,
): number | string {
  switch (field) {
    case "player":
      return p.name.toLowerCase();
    case "role": {
      // Lineup-aware tier ordering: Starter (0) → Bench (1) → MaySit (2);
      // falls back to a minutes-based proxy when no feed.
      if (lineup?.isStarter) return 0;
      if (lineup?.lineupStatus === "may_not_play") return 2;
      if (lineup) return 1;
      const min = p.avgMinutes ?? 0;
      if (min >= 26) return 0;
      if (min >= 18) return 1;
      return 2;
    }
    case "min":
      return p.avgMinutes ?? -Infinity;
    case "usg":
      return p.avgUsage ?? -Infinity;
    case "pts":
      return p.avgPoints ?? -Infinity;
    case "reb":
      return p.avgRebounds ?? -Infinity;
    case "ast":
      return p.avgAssists ?? -Infinity;
    case "threes":
      return p.avgThrees ?? -Infinity;
    case "pra":
      return p.avgPra ?? -Infinity;
    case "gp":
      return p.gamesPlayed ?? -Infinity;
  }
}

// Clickable column header. Shows a chevron when active; clicking the active
// column flips direction, clicking any other column sets it (with a sensible
// default direction per type — desc for stats, asc for text).
function SortHeader({
  field,
  current,
  dir,
  onSort,
  align = "center",
  marketHighlight = false,
  children,
}: {
  field: RosterSortField;
  current: RosterSortField | null;
  dir: "asc" | "desc";
  onSort: (f: RosterSortField) => void;
  align?: "left" | "right" | "center";
  marketHighlight?: boolean;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <th
      className={cn(
        "px-3 py-2 select-none",
        align === "right"
          ? "text-right"
          : align === "left"
            ? "text-left"
            : "text-center",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors",
          align === "right" && "ml-auto",
          align === "center" && "mx-auto",
          isActive
            ? "text-brand"
            : marketHighlight
              ? "text-brand/70 hover:text-brand"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200",
        )}
      >
        {children}
        <SortChevron active={isActive} dir={dir} />
      </button>
    </th>
  );
}

function SortChevron({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <svg
      viewBox="0 0 8 4"
      width={8}
      height={4}
      className={cn(
        "transition-transform",
        active ? "opacity-100" : "opacity-0",
        dir === "asc" ? "rotate-180" : "",
      )}
      aria-hidden="true"
    >
      <path d="M0 0 L8 0 L4 4 Z" fill="currentColor" />
    </svg>
  );
}

function formatTimeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// Phase 1 placeholder for Lineup Impact view — wires up the empty-state copy
// and the entry-point UX so users learn how to trigger it. Phase 2 will
// replace the body with delta cards driven by the injury-impact/stats RPC.
function LineupImpactPlaceholder({
  basisPlayerName,
  basisMode,
  roster,
  teammateFilters,
  onTeammateFilterToggle,
}: {
  basisPlayerName: string | null;
  basisMode: "with" | "without" | null;
  roster: TeamRosterPlayer[];
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
}) {
  // No filter active → show entry-point CTA + the top minutes guys as quick
  // "Set as basis" buttons so users don't have to leave the tab to pick one.
  if (!basisPlayerName) {
    const candidates = roster.slice(0, 6);
    return (
      <div className="space-y-4 px-4 py-5">
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-5 text-center dark:border-neutral-800 dark:bg-neutral-900/30">
          <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400 uppercase dark:text-neutral-500">
            Lineup Impact
          </div>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-snug font-medium text-neutral-600 dark:text-neutral-300">
            Pick a teammate to remove from the lineup. We'll show how everyone
            else's minutes, usage and scoring shift in games where they were
            out.
          </p>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-black tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
            Try one
          </div>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((p) => (
              <button
                key={p.playerId}
                type="button"
                onClick={() =>
                  onTeammateFilterToggle({
                    playerId: String(p.playerId),
                    mode: "without",
                  })
                }
                className="hover:border-brand/45 hover:text-brand dark:hover:text-brand rounded-md border border-neutral-200/70 bg-white px-2.5 py-1 text-[11px] font-black text-neutral-700 transition-colors dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-200"
              >
                Without {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter active → Phase 2 will render delta cards here. For now show what
  // we *will* compute so the user understands the contract.
  const fields = [
    "Minutes",
    "Usage %",
    "Points",
    "Rebounds",
    "Assists",
    "FGA",
    "3PA",
    "Potential AST",
  ];
  return (
    <div className="space-y-4 px-4 py-5">
      <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-500/5">
        <div className="text-[10px] font-black tracking-[0.16em] text-amber-700 uppercase dark:text-amber-300">
          {basisMode === "with" ? "On-floor basis" : "Off-floor basis"}
        </div>
        <p className="mt-1 text-[12px] leading-snug font-bold text-neutral-700 dark:text-neutral-200">
          Showing the games where{" "}
          <span className="text-brand">{basisPlayerName}</span> was{" "}
          {basisMode === "with" ? "ACTIVE" : "OUT"}. Per-player deltas (Δ vs
          season) wire up next — the data is ready in the injury-impact RPC.
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200/70 bg-white/40 p-4 dark:border-neutral-800/70 dark:bg-neutral-900/25">
        <div className="text-[10px] font-black tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
          Coming next
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {fields.map((f) => (
            <div
              key={f}
              className="rounded-md border border-neutral-200/60 bg-neutral-50/60 px-2 py-1.5 text-[11px] font-bold text-neutral-600 dark:border-neutral-800/60 dark:bg-neutral-900/35 dark:text-neutral-300"
            >
              Δ {f}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug font-medium text-neutral-500 dark:text-neutral-400">
          Each row will show direction (▲/▼), magnitude, and a small-sample
          warning when n &lt; 5.
        </p>
      </div>
      {teammateFilters.length > 1 && (
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {teammateFilters.length} teammate filters active — Impact view uses
          the first one as basis.
        </div>
      )}
    </div>
  );
}

export function MatchupPanel({
  profile,
  sport,
  activeLine,
  stacked = false,
  gateSimilarPlayers = false,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  activeLine: number | null;
  /** When true, render the two cards (Defense vs Position + Similar Players)
   *  one above the other instead of side-by-side. Used by the quick-view modal
   *  where the dialog isn't wide enough for the dual-column layout. */
  stacked?: boolean;
  /** When true, blur the Similar Players card with its own pro upsell overlay.
   *  Defense vs Position stays free. Used by the WNBA quick-view modal where
   *  Defense vs Position is the free-tier carrot and Similar Players is the
   *  pro-tier reward. */
  gateSimilarPlayers?: boolean;
}) {
  const [wnbaSeason, setWnbaSeason] = useState<"2025" | "2026">("2025");
  const [gameLimit, setGameLimit] = useState(20);
  const [minMinutes, setMinMinutes] = useState(15);
  const normalizedPosition = normalizePositionForSport(profile.position, sport);
  const selectedSeason = sport === "wnba" ? wnbaSeason : undefined;
  const line = activeLine ?? profile.line;

  const defenseQuery = useTeamDefenseRanks({
    opponentTeamId: profile.opponentTeamId,
    sport,
    season: selectedSeason,
    enabled: !!profile.opponentTeamId,
  });
  const positionQuery = usePositionVsTeam({
    position: normalizedPosition,
    opponentTeamId: profile.opponentTeamId,
    market: profile.market,
    sport,
    season: selectedSeason,
    limit: gameLimit,
    minMinutes,
    enabled:
      !!normalizedPosition && !!profile.opponentTeamId && !!profile.market,
  });

  const totalTeams =
    defenseQuery.meta?.totalTeams ?? TOTAL_TEAMS_BY_SPORT[sport];
  const activeDefense = normalizedPosition
    ? (defenseQuery.positions[normalizedPosition]?.[profile.market] ?? null)
    : null;
  const defTone = getDefenseRankTone(
    activeDefense?.rank ?? profile.matchupRank,
    totalTeams,
  );
  const paceRank = profile.paceContext?.opponentRecent.l5Rank ?? null;
  const paceTier =
    paceRank !== null
      ? getMatchupTier(totalTeams - paceRank + 1, totalTeams)
      : null;
  const positionsToShow =
    sport === "wnba" ? ["G", "F", "C"] : ["PG", "SG", "SF", "PF", "C"];
  const hasDefenseData = positionsToShow.some(
    (pos) => !!defenseQuery.positions[pos],
  );

  return (
    <div>
      {/* WNBA season toggle floats top-right when relevant. NBA matchup needs
          no header chrome — the in-card panel headers + the page-wide tab
          eyebrow already say what view we're on. */}
      {sport === "wnba" && (
        <div className="mb-3 flex justify-end">
          <div className="flex rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
            {(["2025", "2026"] as const).map((season) => (
              <MiniToggle
                key={season}
                active={wnbaSeason === season}
                onClick={() => setWnbaSeason(season)}
              >
                {season}
              </MiniToggle>
            ))}
          </div>
        </div>
      )}

      <div className={cn("grid gap-3", stacked ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(430px,0.9fr)_minmax(620px,1.1fr)]")}>
        <DefenseGridPanel
          positions={defenseQuery.positions}
          positionsToShow={positionsToShow}
          currentPosition={normalizedPosition}
          activeMarket={profile.market}
          totalTeams={totalTeams}
          isLoading={defenseQuery.isLoading}
          isFetching={defenseQuery.isFetching}
          hasDefenseData={hasDefenseData}
          opponentTeamAbbr={profile.opponentTeamAbbr}
          sport={sport}
          season={selectedSeason}
          activeDefense={{
            rank: activeDefense?.rank ?? profile.matchupRank,
            avgAllowed: activeDefense?.avgAllowed ?? profile.matchupAvgAllowed,
            label: defTone.label,
            tone: toneToMatchupTier(defTone.label),
          }}
          pace={{
            rank: paceRank,
            label: paceTierLabel(paceTier),
            value: profile.paceContext?.opponentRecent.l5 ?? null,
            tone: paceTier,
          }}
        />
        <div className="relative min-w-0">
          {gateSimilarPlayers && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/85 p-6 text-center backdrop-blur-md dark:bg-neutral-950/85">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-3 text-base font-bold text-neutral-900 dark:text-white">
                Recent Players vs {profile.opponentTeamAbbr ?? "Opponent"}
              </h3>
              <p className="mt-1 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
                See every player at this position who hit the same prop against this defense.
              </p>
              <a
                href="/pricing"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-shadow hover:shadow-lg"
              >
                <Lock className="h-3.5 w-3.5" />
                Upgrade for full matchup
              </a>
            </div>
          )}
          <div className={cn(gateSimilarPlayers && "pointer-events-none select-none blur-[2px]")}>
            <SimilarPositionPanel
              players={positionQuery.players}
              isLoading={positionQuery.isLoading}
              isFetching={positionQuery.isFetching}
              position={normalizedPosition}
              opponentTeamAbbr={profile.opponentTeamAbbr}
              market={profile.market}
              line={line}
              sport={sport}
              gameLimit={gameLimit}
              minMinutes={minMinutes}
              onGameLimitChange={setGameLimit}
              onMinMinutesChange={setMinMinutes}
              avgStat={positionQuery.avgStat}
              overHitRate={positionQuery.overHitRate}
              totalGames={positionQuery.totalGames}
              playerCount={positionQuery.playerCount}
              hasExpansionEmptyState={
                sport === "wnba" &&
                wnbaSeason === "2025" &&
                positionQuery.players.length === 0
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFENSE_MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes_made",
  "player_steals",
  "player_blocks",
  "player_points_rebounds_assists",
];

function SimilarPositionPanel({
  players,
  isLoading,
  isFetching,
  position,
  opponentTeamAbbr,
  market,
  line,
  sport,
  gameLimit,
  minMinutes,
  onGameLimitChange,
  onMinMinutesChange,
  avgStat,
  overHitRate,
  totalGames,
  playerCount,
  hasExpansionEmptyState,
}: {
  players: PositionVsTeamPlayer[];
  isLoading: boolean;
  isFetching: boolean;
  position: string | null;
  opponentTeamAbbr: string | null;
  market: string;
  line: number | null;
  sport: "nba" | "wnba";
  gameLimit: number;
  minMinutes: number;
  onGameLimitChange: (limit: number) => void;
  onMinMinutesChange: (minutes: number) => void;
  avgStat: number;
  overHitRate: number | null;
  totalGames: number;
  playerCount: number;
  hasExpansionEmptyState: boolean;
}) {
  const statLabel = MARKET_LABELS[market] ?? market;
  const nativeStatField = nativeStatFieldForMarket(market);
  const playersWithLines = useMemo(
    () =>
      players.filter(
        (player) =>
          player.closingLine !== null &&
          player.closingLine !== undefined &&
          Number.isFinite(player.closingLine),
      ),
    [players],
  );
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
      <div className="flex flex-col gap-3 border-b border-neutral-200/70 bg-neutral-50/70 px-3 py-3 xl:flex-row xl:items-center xl:justify-between dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <div>
          <div className="text-xs font-black text-neutral-950 dark:text-white">
            Similar {position ?? "Position"} Players vs{" "}
            {opponentTeamAbbr ?? "OPP"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
            <span>{statLabel}</span>
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span>{totalGames || 0} games</span>
            <span>{playerCount || 0} players</span>
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-neutral-800 dark:text-neutral-200">
              Avg {avgStat ? avgStat.toFixed(1) : "—"}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Over {overHitRate !== null ? `${overHitRate}%` : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={gameLimit}
            options={[10, 20, 50]}
            formatter={(value) => `L${value}`}
            onChange={onGameLimitChange}
          />
          <SegmentedControl
            value={minMinutes}
            options={[0, 15, 20, 30]}
            formatter={(value) => `${value}+ Min`}
            onChange={onMinMinutesChange}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={7} />
      ) : playersWithLines.length === 0 ? (
        <EmptyPreview
          label={
            hasExpansionEmptyState
              ? "No prior-season similar-position matchup history for this opponent."
              : "No similar-position matchup games with lines found for these filters."
          }
        />
      ) : (
        <div className="relative max-h-[500px] overflow-auto">
          {isFetching && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/65 backdrop-blur-sm dark:bg-neutral-950/60">
              <span className="text-xs font-black text-neutral-500 dark:text-neutral-400">
                Updating matchup sample...
              </span>
            </div>
          )}
          <table className="w-full min-w-0 border-collapse text-[11px] sm:min-w-[780px] sm:text-xs">
            <thead className="sticky top-0 z-[1] bg-neutral-100/95 text-[10px] font-black tracking-[0.14em] text-neutral-500 uppercase backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
              <tr>
                <th className="px-1.5 py-2 text-left sm:px-3">Date</th>
                <th className="hidden px-1.5 py-2 text-left sm:table-cell sm:px-3">Score</th>
                <th className="px-1.5 py-2 text-left sm:px-3">Player</th>
                <th className="hidden px-1.5 py-2 text-center sm:table-cell sm:px-3">Min</th>
                <th className="px-1.5 py-2 text-center sm:px-3">Line</th>
                {/* Only show the standalone stat column when the active market
                    can't piggyback on PTS/REB/AST (e.g., 3PM, STL, BLK, PRA).
                    Avoids the "Points + PTS" duplicate the user flagged. */}
                {!nativeStatField && (
                  <th className="px-1.5 py-2 text-center sm:px-3">{statLabel}</th>
                )}
                <th
                  className={cn(
                    "px-1.5 py-2 text-center sm:px-3",
                    nativeStatField === "pts" && "text-brand",
                  )}
                >
                  PTS
                </th>
                <th
                  className={cn(
                    "hidden px-1.5 py-2 text-center sm:table-cell sm:px-3",
                    nativeStatField === "reb" && "text-brand",
                  )}
                >
                  REB
                </th>
                <th
                  className={cn(
                    "hidden px-1.5 py-2 text-center sm:table-cell sm:px-3",
                    nativeStatField === "ast" && "text-brand",
                  )}
                >
                  AST
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {playersWithLines.map((player, index) => (
                <SimilarPlayerRow
                  key={`${player.gameDate}-${player.playerId}-${index}`}
                  player={player}
                  line={line}
                  sport={sport}
                  nativeStatField={nativeStatField}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SimilarPlayerRow({
  player,
  line,
  sport,
  nativeStatField,
}: {
  player: PositionVsTeamPlayer;
  line: number | null;
  sport: "nba" | "wnba";
  nativeStatField: "pts" | "reb" | "ast" | null;
}) {
  const hitCurrentLine = line !== null ? player.stat >= line : null;
  // The matching native column (PTS/REB/AST) becomes the rich cell with the
  // hit-colored stat AND a same-color diff vs the active line so users can
  // read "by how much" without a misleading bar. When no native column
  // matches the active market (3PM, STL, BLK, PRA, etc.), this rich cell
  // lives in the standalone {statLabel} column instead.
  const diff = line !== null ? player.stat - line : null;
  const colorClass =
    hitCurrentLine === null
      ? "text-neutral-950 dark:text-white"
      : hitCurrentLine
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-500 dark:text-red-400";
  const renderRichCell = () => (
    <div className="mx-auto inline-flex items-baseline gap-1.5">
      <span className={cn("font-black tabular-nums", colorClass)}>
        {formatDecimal(player.stat)}
      </span>
      {diff !== null && (
        <span
          className={cn("text-[10px] font-bold tabular-nums opacity-70", colorClass)}
        >
          {diff > 0 ? "+" : ""}
          {formatDecimal(diff)}
        </span>
      )}
    </div>
  );
  const plainCell = (value: number) => (
    <span className="font-black text-neutral-700 tabular-nums dark:text-neutral-300">
      {value}
    </span>
  );

  return (
    <tr className="bg-white/40 dark:bg-neutral-900/20">
      <td className="px-1.5 py-2 font-bold text-neutral-500 tabular-nums sm:px-3 dark:text-neutral-500">
        {formatWeekdayDate(player.gameDate)}
      </td>
      <td className="hidden px-1.5 py-2 sm:table-cell sm:px-3">
        <GameScoreCell player={player} />
      </td>
      <td className="px-1.5 py-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          {player.teamAbbr && (
            <img
              src={getTeamLogoUrl(player.teamAbbr, sport)}
              alt={player.teamAbbr}
              className="h-5 w-5 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-black text-neutral-950 dark:text-white">
              {player.playerName}
            </div>
            <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
              {player.position}
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-1.5 py-2 text-center font-black text-neutral-700 tabular-nums sm:table-cell sm:px-3 dark:text-neutral-300">
        {Math.floor(player.minutes)}
      </td>
      <td className="px-1.5 py-2 text-center font-black text-neutral-500 tabular-nums sm:px-3 dark:text-neutral-500">
        {formatDecimal(player.closingLine)}
      </td>
      {!nativeStatField && (
        <td className="px-1.5 py-2 text-center sm:px-3">{renderRichCell()}</td>
      )}
      <td className="px-1.5 py-2 text-center sm:px-3">
        {nativeStatField === "pts" ? renderRichCell() : plainCell(player.pts)}
      </td>
      <td className="hidden px-1.5 py-2 text-center sm:table-cell sm:px-3">
        {nativeStatField === "reb" ? renderRichCell() : plainCell(player.reb)}
      </td>
      <td className="hidden px-1.5 py-2 text-center sm:table-cell sm:px-3">
        {nativeStatField === "ast" ? renderRichCell() : plainCell(player.ast)}
      </td>
    </tr>
  );
}

function GameScoreCell({ player }: { player: PositionVsTeamPlayer }) {
  const hasScore = player.teamScore !== null && player.opponentScore !== null;
  if (!hasScore) {
    return (
      <span className="text-[11px] font-black text-neutral-400 tabular-nums dark:text-neutral-600">
        —
      </span>
    );
  }

  const won = player.result === "W";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] uppercase",
          won
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-red-500/15 text-red-600 dark:text-red-400",
        )}
      >
        {player.result ?? "—"}
      </span>
      <span className="text-[11px] font-black text-neutral-800 tabular-nums dark:text-neutral-200">
        {player.teamScore}-{player.opponentScore}
      </span>
    </div>
  );
}

function DefenseGridPanel({
  positions,
  positionsToShow,
  currentPosition,
  activeMarket,
  totalTeams,
  isLoading,
  isFetching,
  hasDefenseData,
  opponentTeamAbbr,
  sport,
  season,
  activeDefense,
  pace,
}: {
  positions: Record<
    string,
    Record<string, { rank: number | null; avgAllowed: number | null }>
  >;
  positionsToShow: string[];
  currentPosition: string | null;
  activeMarket: string;
  totalTeams: number;
  isLoading: boolean;
  isFetching: boolean;
  hasDefenseData: boolean;
  opponentTeamAbbr: string | null;
  sport: "nba" | "wnba";
  season?: string;
  activeDefense: {
    rank: number | null;
    avgAllowed: number | null;
    label: string;
    tone: MatchupTier | null;
  };
  pace: {
    rank: number | null;
    label: string;
    value: number | null;
    tone: MatchupTier | null;
  };
}) {
  const rankBuckets = getRankBuckets(totalTeams);
  const activeTone = getToneClass(activeDefense.tone);
  const paceTone = getToneClass(pace.tone);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
      <div className="flex flex-col gap-3 border-b border-neutral-200/70 bg-neutral-50/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <div>
          <div className="text-xs font-black text-neutral-950 dark:text-white">
            Defense vs Position
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
            <span>{opponentTeamAbbr ?? "OPP"} ranks by stat allowed</span>
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className={activeTone.text}>
              Active DvP{" "}
              {activeDefense.rank !== null ? `#${activeDefense.rank}` : "—"}
            </span>
            {activeDefense.avgAllowed !== null && (
              <span>{activeDefense.avgAllowed.toFixed(1)} allowed/g</span>
            )}
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className={paceTone.text}>
              Pace {pace.rank !== null ? `#${pace.rank}` : "—"}
            </span>
            {pace.value !== null && (
              <span>{pace.value.toFixed(1)} poss / 48</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {opponentTeamAbbr && (
            <img
              src={getTeamLogoUrl(opponentTeamAbbr, sport)}
              alt={opponentTeamAbbr}
              className="h-5 w-5 object-contain"
            />
          )}
          <span>
            {season ?? "Season"} • {totalTeams} teams
          </span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase",
              activeTone.badge,
            )}
          >
            {activeDefense.label}
          </span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={7} />
      ) : !hasDefenseData ? (
        <EmptyPreview label="No defense-vs-position grid is available for this opponent and season." />
      ) : (
        <div className="relative max-h-[500px] overflow-auto">
          {isFetching && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/65 backdrop-blur-sm dark:bg-neutral-950/60">
              <span className="text-xs font-black text-neutral-500 dark:text-neutral-400">
                Updating defense ranks...
              </span>
            </div>
          )}
          <table className="w-full min-w-0 border-collapse text-[11px] sm:min-w-[560px] sm:text-xs">
            <thead className="sticky top-0 z-[1] bg-neutral-100/95 text-[10px] font-black tracking-[0.14em] text-neutral-500 uppercase backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
              <tr>
                <th className="px-1.5 py-2 text-left sm:px-3">Stat</th>
                {positionsToShow.map((position) => (
                  <th
                    key={position}
                    className={cn(
                      "px-1.5 py-2 text-center sm:px-3",
                      position === currentPosition && "text-brand",
                    )}
                  >
                    {position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {DEFENSE_MARKETS.map((market) => (
                <tr
                  key={market}
                  className={cn(
                    "bg-white/40 dark:bg-neutral-900/20",
                    market === activeMarket &&
                      "bg-brand/[0.07] dark:bg-brand/[0.09]",
                  )}
                >
                  <td className="px-1.5 py-2 sm:px-3">
                    <div className="font-black text-neutral-950 dark:text-white">
                      {MARKET_LABELS[market] ?? market}
                    </div>
                  </td>
                  {positionsToShow.map((position) => {
                    const data = positions[position]?.[market] ?? {
                      rank: null,
                      avgAllowed: null,
                    };
                    const tone = getDefenseRankTone(data.rank, totalTeams);
                    return (
                      <td
                        key={position}
                        className={cn(
                          "px-1.5 py-2 text-center sm:px-3",
                          position === currentPosition && "bg-brand/[0.08]",
                        )}
                      >
                        <div
                          className={cn("font-black tabular-nums", tone.text)}
                        >
                          {data.rank ? `#${data.rank}` : "—"}
                        </div>
                        <div className="text-[10px] font-bold text-neutral-500 tabular-nums dark:text-neutral-500">
                          {data.avgAllowed != null
                            ? data.avgAllowed.toFixed(1)
                            : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 bg-neutral-50/70 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          Lower rank is tougher; higher rank is softer.
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black tracking-[0.12em] uppercase">
          <span className="rounded-md bg-red-500/15 px-2 py-1 text-red-600 dark:text-red-400">
            Tough 1-{rankBuckets.toughMax}
          </span>
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-600 dark:text-amber-400">
            Mid {rankBuckets.toughMax + 1}-{rankBuckets.neutralMax}
          </span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-600 dark:text-emerald-400">
            Soft {rankBuckets.neutralMax + 1}-{rankBuckets.total}
          </span>
        </div>
      </div>
    </div>
  );
}

function RosterTrendsView({
  players,
  market,
  teammateFilters,
  onTeammateFilterToggle,
}: {
  players: TeamRosterPlayer[];
  market: string;
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
}) {
  const topPlayers = players.slice(0, 10);
  const benchMinutes = players
    .slice(10)
    .reduce((sum, player) => sum + (player.avgMinutes ?? 0), 0);
  const maxMinutes = Math.max(
    1,
    ...topPlayers.map((player) => player.avgMinutes ?? 0),
    benchMinutes,
  );
  const activePlayers = players.filter(
    (player) => statusTone(player.injuryStatus).label === "ACTIVE",
  ).length;
  const likelyStarters = players.filter(
    (player, index) => getStartLikelihood(player, index).tier !== "bench",
  ).length;

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="max-h-[390px] overflow-auto p-3">
        <div className="space-y-2">
          {topPlayers.map((player, index) => {
            const start = getStartLikelihood(player, index);
            const tone = statusTone(player.injuryStatus);
            const impact = pickRosterStatForMarket(player, market);
            const playerId = String(player.playerId);
            const withActive = teammateFilters.some(
              (f) => f.playerId === playerId && f.mode === "with",
            );
            const withoutActive = teammateFilters.some(
              (f) => f.playerId === playerId && f.mode === "without",
            );
            return (
              <div
                key={player.playerId}
                className="grid grid-cols-[minmax(116px,1fr)_minmax(160px,1.3fr)_72px_94px] items-center gap-3 rounded-xl border border-neutral-200/60 bg-white/45 px-3 py-2.5 text-xs dark:border-neutral-800/70 dark:bg-neutral-900/25"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-neutral-950 dark:text-white">
                    {player.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                    <span>{player.position || "—"}</span>
                    {player.jerseyNumber ? (
                      <span>#{player.jerseyNumber}</span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-sm px-1 py-0.5 text-[8px] tracking-[0.12em] uppercase",
                        tone.className,
                      )}
                    >
                      {tone.label}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                    <span>Minutes Role</span>
                    <span className="font-black text-neutral-900 tabular-nums dark:text-white">
                      {formatDecimal(player.avgMinutes)} min/g
                    </span>
                  </div>
                  <div className="grid h-5 grid-cols-10 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                    {Array.from({ length: 10 }).map((_, segment) => {
                      const filled =
                        ((segment + 1) / 10) * maxMinutes <=
                        (player.avgMinutes ?? 0);
                      return (
                        <span
                          key={segment}
                          className={cn(
                            "border-r border-neutral-950/10 last:border-r-0 dark:border-white/10",
                            filled ? start.bar : "bg-transparent",
                          )}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn("font-black tabular-nums", start.text)}>
                    {start.label}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                    start proxy
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <div className="mr-1 hidden text-right text-[10px] font-bold text-neutral-500 xl:block dark:text-neutral-500">
                    <span className="block font-black text-neutral-800 tabular-nums dark:text-neutral-200">
                      {formatDecimal(impact)}
                    </span>
                    <span>{sortColumnLabel(market)}</span>
                  </div>
                  <div className="flex w-fit items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                    <MiniToggle
                      active={withActive}
                      onClick={() =>
                        onTeammateFilterToggle({ playerId, mode: "with" })
                      }
                    >
                      With
                    </MiniToggle>
                    <MiniToggle
                      active={withoutActive}
                      onClick={() =>
                        onTeammateFilterToggle({ playerId, mode: "without" })
                      }
                    >
                      W/O
                    </MiniToggle>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="border-t border-neutral-200/70 bg-neutral-50/60 p-4 lg:border-t-0 lg:border-l dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat
            label="Active"
            value={`${activePlayers}/${players.length}`}
          />
          <MiniStat label="Starters" value={likelyStarters} />
          <MiniStat
            label="Top Min"
            value={formatDecimal(players[0]?.avgMinutes)}
          />
          <MiniStat label="Bench Min" value={formatDecimal(benchMinutes)} />
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200/70 bg-white/50 p-3 dark:border-neutral-800/70 dark:bg-neutral-900/35">
          <div className="text-[10px] font-black tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
            What This Shows
          </div>
          <div className="mt-2 space-y-2 text-[11px] leading-5 font-bold text-neutral-500 dark:text-neutral-500">
            <p>
              Minutes role is based on season average minutes from the roster
              feed.
            </p>
            <p>
              Start proxy is inferred from rotation rank and minutes, not
              official starting-lineup history.
            </p>
            <p>
              Use With/W/O here to apply the same teammate filters to the chart
              and tabs.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-neutral-200/70 bg-white/50 px-2.5 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/35">
      <div className="text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-neutral-950 tabular-nums dark:text-white">
        {value ?? "—"}
      </div>
    </div>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-xl border border-neutral-200/70 bg-neutral-100/70 dark:border-neutral-800/70 dark:bg-neutral-900/60"
        />
      ))}
    </div>
  );
}

function SeasonToggle({
  sport,
  season,
  onSeasonChange,
}: {
  sport: "nba" | "wnba";
  season: string;
  onSeasonChange: (season: string) => void;
}) {
  const options = sport === "wnba" ? ["2025", "2026"] : ["2025-26"];
  if (options.length <= 1) return null;

  return (
    <div className="mt-3 flex w-fit rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSeasonChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[10px] font-black tracking-[0.12em] uppercase transition-all active:scale-[0.98]",
            season === option
              ? "bg-brand text-neutral-950"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

// When two upstream book ids collapse to the same canonical id, we pick the
// side with the higher American price (better for the bettor) and keep its
// link metadata. Falls back to whichever side actually exists.
function pickBetterOdds<T extends { price?: number | null } | null | undefined>(
  a: T,
  b: T,
): T {
  if (!a) return b;
  if (!b) return a;
  const ap = a.price ?? -Infinity;
  const bp = b.price ?? -Infinity;
  return bp > ap ? b : a;
}

function getBookDisplayName(book: string) {
  return getSportsbookById(book)?.name ?? book;
}

function BookLogo({ book, size = 16 }: { book: string; size?: number }) {
  const sportsbook = getSportsbookById(book);
  const logo = sportsbook?.image?.light ?? null;
  if (!logo) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-sm bg-neutral-200 dark:bg-neutral-700"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <img
      src={logo}
      alt={sportsbook?.name ?? book}
      className="shrink-0 object-contain"
      style={{ height: size, width: size }}
    />
  );
}

function BookHeader({
  book,
  active,
  onClick,
}: {
  book: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-auto flex w-full items-center justify-center gap-1.5 rounded-md px-1.5 py-1 transition-colors",
        active
          ? "text-brand"
          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
      )}
      title={getBookDisplayName(book)}
    >
      <BookLogo book={book} size={14} />
      <span className="truncate text-[10px] font-bold normal-case tracking-tight">
        {getBookDisplayName(book)}
      </span>
    </button>
  );
}

function OddsMatrixCell({
  over,
  under,
  selectedSide,
  isBookSelected,
  isBestOver,
  isBestUnder,
}: {
  over?: { price: number; url: string | null; mobileUrl: string | null } | null;
  under?: { price: number; url: string | null; mobileUrl: string | null } | null;
  selectedSide: "over" | "under";
  isBookSelected: boolean;
  isBestOver: boolean;
  isBestUnder: boolean;
}) {
  // Stack O/U as two compact rows separated by a hairline. No outer border —
  // the table grid carries the structure (matches odds-screen tool's
  // borderless cell density).
  return (
    <div className="flex flex-col gap-0.5">
      <OddsCellSide
        label="O"
        odds={over}
        dim={selectedSide !== "over"}
        best={isBestOver}
        bookSelected={isBookSelected && selectedSide === "over"}
      />
      <OddsCellSide
        label="U"
        odds={under}
        dim={selectedSide !== "under"}
        best={isBestUnder}
        bookSelected={isBookSelected && selectedSide === "under"}
      />
    </div>
  );
}

function OddsCellSide({
  label,
  odds,
  dim,
  best,
  bookSelected,
}: {
  label: string;
  odds?: { price: number; url: string | null; mobileUrl: string | null } | null;
  dim: boolean;
  best: boolean;
  bookSelected: boolean;
}) {
  const hasPrice = !!odds && typeof odds.price === "number";
  const content = (
    <span
      className={cn(
        "flex items-center justify-between gap-1 rounded px-1.5 py-1 text-[11px] tabular-nums transition-colors",
        // Best price gets the strongest visual weight (subtle bg + brand text).
        best
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
          : bookSelected
            ? "bg-brand/10 text-brand"
            : hasPrice
              ? "text-neutral-700 dark:text-neutral-200"
              : "text-neutral-400 dark:text-neutral-600",
        // Off-side dims a touch so the active side reads as primary without
        // burying the alt-side info entirely.
        dim && hasPrice && !best && "opacity-65",
      )}
    >
      <span className="text-[9px] font-bold uppercase opacity-60">{label}</span>
      <span className={cn("font-bold", best && "font-black")}>
        {formatOdds(odds?.price ?? null)}
      </span>
    </span>
  );

  if (!odds?.url) return content;
  return (
    <a href={odds.url} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  );
}

function OddsBookLine({
  label,
  entry,
}: {
  label: string;
  entry: LineOdds["bestOver"] | HitRateProfile["bestOdds"] | null | undefined;
}) {
  const book = entry?.book ? getSportsbookById(entry.book) : null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-neutral-200/70 bg-white/50 px-3 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/35">
      <div>
        <div className="text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
          {label}
        </div>
        <div className="mt-0.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
          {book?.name ?? entry?.book ?? "—"}
        </div>
      </div>
      <div className="text-right text-lg font-black text-neutral-950 tabular-nums dark:text-white">
        {formatOdds(entry?.price ?? null)}
      </div>
    </div>
  );
}

type SgpBuildPrice = DoubleDoubleBestPrice | TripleDoubleBestPrice;

interface SgpBuildLeg {
  id: string;
  label: string;
  detail: string;
  price: SgpBuildPrice | null;
  source: "direct" | "sgp";
}

interface SgpBuildComparisonData {
  rowLabel: string;
  legs: SgpBuildLeg[];
}

function SgpBuildComparison({
  comparison,
  isLoading,
  market,
}: {
  comparison: SgpBuildComparisonData | null;
  isLoading: boolean;
  market: string;
}) {
  const availableLegs = comparison?.legs.filter((leg) => leg.price) ?? [];
  const bestPrice = availableLegs.length
    ? Math.max(...availableLegs.map((leg) => leg.price!.price))
    : null;
  const directLeg = availableLegs.find((leg) => leg.source === "direct");
  const bestBuildLeg = availableLegs
    .filter((leg) => leg.source === "sgp")
    .sort((a, b) => b.price!.price - a.price!.price)[0];
  const buildBeatsDirect =
    !!bestBuildLeg?.price &&
    !!directLeg?.price &&
    bestBuildLeg.price.price > directLeg.price.price;
  const marketLabel =
    market === "player_triple_double" ? "triple-double" : "double-double";

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200/70 bg-white/45 dark:border-neutral-800/70 dark:bg-neutral-900/25">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200/60 px-3 py-2.5 dark:border-neutral-800/60">
        <div>
          <div className="text-[9px] font-black tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
            Build Check
          </div>
          <div className="mt-0.5 text-xs font-black text-neutral-950 dark:text-white">
            Direct vs SGP paths
          </div>
        </div>
        {buildBeatsDirect && (
          <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[9px] font-black tracking-[0.14em] text-brand uppercase">
            Build better
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-3">
          <div className="h-10 animate-pulse rounded-lg bg-neutral-200/60 dark:bg-neutral-800/60" />
          <div className="h-10 animate-pulse rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50" />
          <div className="h-10 animate-pulse rounded-lg bg-neutral-200/40 dark:bg-neutral-800/40" />
        </div>
      ) : comparison && availableLegs.length > 0 ? (
        <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
          {comparison.legs.map((leg) => (
            <SgpBuildLegRow
              key={leg.id}
              leg={leg}
              isBest={!!leg.price && leg.price.price === bestPrice}
              beatsDirect={
                leg.source === "sgp" &&
                !!leg.price &&
                !!directLeg?.price &&
                leg.price.price > directLeg.price.price
              }
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          No SGP build quotes yet for this {marketLabel}. The direct market can
          still price above, and this comparison will fill once the sheet cache
          has the player/event build paths.
        </div>
      )}
    </div>
  );
}

function SgpBuildLegRow({
  leg,
  isBest,
  beatsDirect,
}: {
  leg: SgpBuildLeg;
  isBest: boolean;
  beatsDirect: boolean;
}) {
  const book = leg.price?.book ? getSportsbookById(leg.price.book) : null;
  const logo = book?.image?.light ?? null;
  const content = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-100/55 dark:hover:bg-neutral-800/25">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-black text-neutral-800 dark:text-neutral-100">
            {leg.label}
          </span>
          {isBest && (
            <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[8px] font-black tracking-[0.12em] text-brand uppercase">
              Best
            </span>
          )}
          {beatsDirect && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black tracking-[0.12em] text-emerald-600 uppercase dark:text-emerald-400">
              Value
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {logo && (
            <img
              src={logo}
              alt={book?.name ?? leg.price?.book ?? ""}
              className="h-3.5 w-3.5 shrink-0 object-contain"
            />
          )}
          <span className="truncate">
            {leg.price ? (book?.name ?? leg.price.book) : "No quote"}
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="truncate">{leg.detail}</span>
        </div>
      </div>
      <div
        className={cn(
          "text-right text-base font-black tabular-nums",
          leg.price
            ? "text-neutral-950 dark:text-white"
            : "text-neutral-400 dark:text-neutral-600",
          isBest && "text-brand",
        )}
      >
        {formatOdds(leg.price?.price ?? null)}
      </div>
    </div>
  );

  if (!leg.price?.link && !leg.price?.mobileLink) return content;
  return (
    <a
      href={leg.price.link ?? leg.price.mobileLink ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      {content}
    </a>
  );
}

function resolveSgpBuildComparison({
  profile,
  isDoubleDoubleMarket,
  isTripleDoubleMarket,
  doubleDoubleRows,
  tripleDoubleRows,
}: {
  profile: HitRateProfile;
  isDoubleDoubleMarket: boolean;
  isTripleDoubleMarket: boolean;
  doubleDoubleRows: DoubleDoubleSheetRow[];
  tripleDoubleRows: TripleDoubleSheetRow[];
}): SgpBuildComparisonData | null {
  if (isDoubleDoubleMarket) {
    const row = findSgpSheetRow(doubleDoubleRows, profile);
    if (!row) return null;
    return {
      rowLabel: row.player,
      legs: [
        {
          id: "dd",
          label: "Direct DD",
          detail: "Book yes/no market",
          price: row.dd,
          source: "direct",
        },
        {
          id: "sgp-pr",
          label: "Build P+R",
          detail: "10+ points + 10+ rebounds",
          price: row.sgp_pr,
          source: "sgp",
        },
        {
          id: "sgp-pa",
          label: "Build P+A",
          detail: "10+ points + 10+ assists",
          price: row.sgp_pa,
          source: "sgp",
        },
      ],
    };
  }

  if (isTripleDoubleMarket) {
    const row = findSgpSheetRow(tripleDoubleRows, profile);
    if (!row) return null;
    return {
      rowLabel: row.player,
      legs: [
        {
          id: "td",
          label: "Direct TD",
          detail: "Book yes/no market",
          price: row.td,
          source: "direct",
        },
        {
          id: "sgp-ra",
          label: "Build R+A",
          detail: "10+ rebounds + 10+ assists",
          price: row.sgp_ra,
          source: "sgp",
        },
        {
          id: "sgp-pra",
          label: "Build PRA",
          detail: "10+ points + 10+ rebounds + 10+ assists",
          price: row.sgp_pra,
          source: "sgp",
        },
      ],
    };
  }

  return null;
}

function findSgpSheetRow<T extends { eventId: string; playerId: string; player: string; team: string | null }>(
  rows: T[],
  profile: HitRateProfile,
): T | null {
  if (!rows.length) return null;
  const redisPlayerId =
    profile.selKey?.split(":")[0] ??
    profile.oddsSelectionId?.split(":")[0] ??
    null;
  const normalizedProfileName = normalizeSgpPlayerName(profile.playerName);
  const normalizedTeam = profile.teamAbbr?.toUpperCase() ?? null;

  return (
    rows.find(
      (row) =>
        row.eventId === profile.eventId &&
        redisPlayerId &&
        row.playerId === redisPlayerId,
    ) ??
    rows.find(
      (row) =>
        row.eventId === profile.eventId &&
        normalizeSgpPlayerName(row.player) === normalizedProfileName,
    ) ??
    rows.find(
      (row) =>
        normalizeSgpPlayerName(row.player) === normalizedProfileName &&
        (!normalizedTeam || row.team?.toUpperCase() === normalizedTeam),
    ) ??
    null
  );
}

function normalizeSgpPlayerName(name: string | null | undefined) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function BookOddsRow({
  book,
  over,
  under,
}: {
  book: string;
  over: number | null;
  under: number | null;
}) {
  const sportsbook = getSportsbookById(book);
  const logo = sportsbook?.image?.light ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-2 px-3 py-2 text-[11px]">
      <div className="flex min-w-0 items-center gap-2">
        {logo && (
          <img
            src={logo}
            alt={sportsbook?.name ?? book}
            className="h-4 w-4 shrink-0 object-contain"
          />
        )}
        <span className="truncate font-black text-neutral-700 dark:text-neutral-200">
          {sportsbook?.name ?? book}
        </span>
      </div>
      <span className="text-right font-black text-emerald-600 tabular-nums dark:text-emerald-400">
        {formatOdds(over)}
      </span>
      <span className="text-right font-black text-neutral-800 tabular-nums dark:text-neutral-200">
        {formatOdds(under)}
      </span>
    </div>
  );
}

function PreviewHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.18em] text-neutral-500 uppercase dark:text-neutral-500">
        {kicker}
      </div>
      <div className="mt-1 text-sm font-black text-neutral-950 dark:text-white">
        {title}
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
      <div className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-xl font-black tabular-nums",
          accent ? "text-brand" : "text-neutral-950 dark:text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SignalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800/70 dark:bg-neutral-950/35">
      <span className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </span>
      <span className="truncate text-xs font-black text-neutral-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function ContextPanel({
  label,
  value,
  badge,
  tone,
  subValue,
}: {
  label: string;
  value: string;
  badge: string;
  tone: MatchupTier | null;
  subValue?: string;
}) {
  const toneClass = getToneClass(tone);
  return (
    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold tracking-[0.16em] text-neutral-500 uppercase dark:text-neutral-500">
          {label}
        </span>
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase",
            toneClass.badge,
          )}
        >
          {badge}
        </span>
      </div>
      <div
        className={cn("mt-3 text-2xl font-black tabular-nums", toneClass.text)}
      >
        {value}
      </div>
      {subValue && (
        <div className="mt-1 text-[10px] font-bold text-neutral-500 tabular-nums dark:text-neutral-500">
          {subValue}
        </div>
      )}
    </div>
  );
}

function RosterNumber({
  value,
  suffix = "",
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  return (
    <td className="px-3 py-2 text-center font-black text-neutral-800 tabular-nums dark:text-neutral-200">
      {typeof value === "number" && Number.isFinite(value)
        ? `${formatDecimal(value)}${suffix}`
        : "—"}
    </td>
  );
}

function MiniToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase transition-all active:scale-[0.98]",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}

function SegmentedControl({
  value,
  options,
  formatter,
  onChange,
}: {
  value: number;
  options: number[];
  formatter: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
      {options.map((option) => (
        <MiniToggle
          key={option}
          active={value === option}
          onClick={() => onChange(option)}
        >
          {formatter(option)}
        </MiniToggle>
      ))}
    </div>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-3 px-3 py-2.5"
        >
          <span className="h-3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <span className="h-3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <span className="h-3 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyPreview({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-xs font-bold text-neutral-500 dark:text-neutral-500">
      {label}
    </div>
  );
}

function getPreviewTitle(tab: DrilldownTabId) {
  switch (tab) {
    case "overview":
      return "Overview";
    case "roster":
      return "Rotation table";
    case "shooting":
      return "Shot profile";
    case "play-types":
      return "Usage split";
    case "matchup":
      return "Matchup context";
    case "odds":
      return "Line board";
    case "correlations":
      return "Teammate signals";
    case "game-log":
      return "Recent Game Log";
  }
}

function getMatchupTier(
  rank: number | null,
  total: number,
): MatchupTier | null {
  if (rank === null) return null;
  const toughEliteCutoff = Math.max(1, Math.floor(total * 0.17));
  const toughCutoff = Math.ceil(total / 3);
  const favorableCutoff = total - toughCutoff + 1;
  const favorableEliteCutoff = total - toughEliteCutoff + 1;
  if (rank <= toughEliteCutoff) return "worst";
  if (rank <= toughCutoff) return "bad";
  if (rank >= favorableEliteCutoff) return "elite";
  if (rank >= favorableCutoff) return "strong";
  return "neutral";
}

function getRankBuckets(totalTeams: number) {
  const total = Math.max(totalTeams || 30, 1);
  return {
    toughMax: Math.ceil(total / 3),
    neutralMax: Math.ceil((total * 2) / 3),
    total,
  };
}

function normalizePositionForSport(
  position: string | null,
  sport: "nba" | "wnba",
) {
  const upper = (position ?? "").toUpperCase().split("-")[0];
  if (!upper) return null;
  if (sport === "wnba") {
    if (upper === "C") return "C";
    if (upper === "F" || upper === "SF" || upper === "PF") return "F";
    return "G";
  }
  return upper;
}

function toneToMatchupTier(label: string): MatchupTier | null {
  if (label === "Soft") return "strong";
  if (label === "Tough") return "bad";
  if (label === "Neutral") return "neutral";
  return null;
}

function marketToCorrelationMarket(market: string): CorrelationMarket {
  const found = CORRELATION_MARKETS.find((item) => item.dbMarket === market);
  return found?.key ?? "points";
}

function getLastName(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "Player";
}

function getCorrelationWindow(range: ChartRange): {
  label: string;
  lastNGames: number | null;
  note?: string;
} {
  switch (range) {
    case "l5":
      return { label: "L5", lastNGames: 5 };
    case "l10":
      return { label: "L10", lastNGames: 10 };
    case "l20":
      return { label: "L20", lastNGames: 20 };
    case "h2h":
      return {
        label: "SZN",
        lastNGames: null,
        note: "H2H-specific correlation windows need backend support; showing the season sample for now.",
      };
    case "szn":
    default:
      return { label: "SZN", lastNGames: null };
  }
}

function getCorrelationGameStat(
  stats: TeammateCorrelation["gameLogs"][number]["stats"],
  market: CorrelationMarket,
) {
  switch (market) {
    case "points":
      return stats.pts;
    case "rebounds":
      return stats.reb;
    case "assists":
      return stats.ast;
    case "threes":
      return stats.fg3m;
    case "steals":
      return stats.stl;
    case "blocks":
      return stats.blk;
    case "pra":
      return stats.pra;
    case "pointsRebounds":
      return stats.pr;
    case "pointsAssists":
      return stats.pa;
    case "reboundsAssists":
      return stats.ra;
    case "blocksSteals":
      return stats.bs;
  }
}

function getHitRateTone(pct: number | null) {
  if (pct === null) {
    return {
      label: "Low",
      text: "text-neutral-500 dark:text-neutral-400",
      badge: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
    };
  }
  if (pct >= 70) {
    return {
      label: "Hot",
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (pct >= 50) {
    return {
      label: "Warm",
      text: "text-amber-500 dark:text-amber-400",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Cold",
    text: "text-red-500 dark:text-red-400",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
}

function getDefenseRankTone(rank: number | null, totalTeams: number) {
  if (rank === null) {
    return {
      label: "No Data",
      text: "text-neutral-500 dark:text-neutral-400",
      badge: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
      bar: "bg-neutral-400",
    };
  }
  const toughMax = Math.ceil(totalTeams / 3);
  const easyMin = totalTeams - toughMax + 1;
  if (rank >= easyMin) {
    return {
      label: "Soft",
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    };
  }
  if (rank <= toughMax) {
    return {
      label: "Tough",
      text: "text-red-500 dark:text-red-400",
      badge: "bg-red-500/15 text-red-600 dark:text-red-400",
      bar: "bg-red-500",
    };
  }
  return {
    label: "Neutral",
    text: "text-amber-500 dark:text-amber-400",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  };
}

function defTierLabel(tier: MatchupTier | null) {
  switch (tier) {
    case "elite":
      return "Easy";
    case "strong":
      return "Favorable";
    case "bad":
      return "Hard";
    case "worst":
      return "Tough";
    case "neutral":
      return "Average";
    default:
      return "—";
  }
}

function paceTierLabel(tier: MatchupTier | null) {
  switch (tier) {
    case "elite":
      return "Fast";
    case "strong":
      return "Above Avg";
    case "bad":
      return "Slow";
    case "worst":
      return "Slowest";
    case "neutral":
      return "Average";
    default:
      return "—";
  }
}

function getToneClass(tier: MatchupTier | null) {
  switch (tier) {
    case "elite":
    case "strong":
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      };
    case "bad":
    case "worst":
      return {
        text: "text-red-500 dark:text-red-400",
        badge: "bg-red-500/15 text-red-600 dark:text-red-400",
      };
    default:
      return {
        text: "text-neutral-950 dark:text-white",
        badge: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400",
      };
  }
}

function statusTone(status: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "out")
    return {
      label: "OUT",
      className: "bg-red-500/15 text-red-600 dark:text-red-400",
    };
  if (
    normalized === "questionable" ||
    normalized === "gtd" ||
    normalized === "game time decision"
  ) {
    return {
      label: "GTD",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (normalized === "doubtful")
    return { label: "DBT", className: "bg-red-500/10 text-red-500" };
  if (normalized === "probable")
    return {
      label: "PROB",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  return {
    label: "ACTIVE",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
}

function getStartLikelihood(player: TeamRosterPlayer, rotationIndex: number) {
  const minutes = player.avgMinutes ?? 0;
  if (rotationIndex < 5 && minutes >= 24) {
    return {
      label: "High",
      tier: "starter",
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-brand",
    };
  }
  if (minutes >= 20) {
    return {
      label: "Mix",
      tier: "spot",
      text: "text-amber-500 dark:text-amber-400",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Bench",
    tier: "bench",
    text: "text-neutral-500 dark:text-neutral-400",
    bar: "bg-neutral-400 dark:bg-neutral-600",
  };
}

function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Roster usage_pct ships on a 0-1 scale (e.g. 0.267 for LeBron). Multiply by
// 100 so the table reads as proper percent — 26.7% rather than 0.3%. Rounds
// to a whole number; usage at sub-1% precision isn't actionable for bettors.
function formatUsagePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

// Inline single-letter injury indicator that sits next to the player name —
// Sleeper / ESPN style. Renders nothing for healthy players so available
// rows stay visually clean. Hovering surfaces the full status + injury notes
// in a structured tooltip (matches the rail's hover treatment).
function InjuryGlyph({
  status,
  notes,
}: {
  status: string | null;
  notes: string | null;
}) {
  const s = (status ?? "").toLowerCase();
  let letter: string | null = null;
  let label = "";
  let className = "";
  if (s === "out") {
    letter = "O";
    label = "Out";
    className = "bg-red-500/15 text-red-600 dark:text-red-400";
  } else if (s === "doubtful") {
    letter = "D";
    label = "Doubtful";
    className = "bg-red-500/10 text-red-500 dark:text-red-400";
  } else if (s === "questionable" || s === "gtd" || s === "game time decision") {
    letter = "Q";
    label = "Questionable";
    className = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  } else if (s === "probable") {
    letter = "P";
    label = "Probable";
    className = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  }
  if (!letter) return null;
  return (
    <Tooltip
      side="top"
      content={
        <div className="max-w-[260px] px-3 py-2 text-xs">
          <div className="mb-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            {label}
          </div>
          <div className="text-neutral-700 dark:text-neutral-200">
            {notes && notes.trim().length > 0
              ? notes
              : "No additional details available."}
          </div>
        </div>
      }
    >
      <span
        className={cn(
          "inline-flex h-4 min-w-[16px] cursor-help items-center justify-center rounded px-1 text-[9px] font-black tabular-nums",
          className,
        )}
        aria-label={label}
      >
        {letter}
      </span>
    </Tooltip>
  );
}

// When the active prop market lines up with one of the always-rendered
// PTS/REB/AST columns, hide the standalone {statLabel} column and render the
// rich hit/bar cell INSIDE the matching column instead. Returns null when
// the market doesn't match (3PM/STL/BLK/PRA/etc. — those keep the standalone
// column).
function nativeStatFieldForMarket(market: string): "pts" | "reb" | "ast" | null {
  switch (market) {
    case "player_points":
      return "pts";
    case "player_rebounds":
      return "reb";
    case "player_assists":
      return "ast";
    default:
      return null;
  }
}

// homeAway can ship as "H"/"A", "home"/"away", or "1"/"0". Normalize before
// comparing so labels stay aligned with the matchup header + venue chip.
function isProfileHome(homeAway: string | null | undefined): boolean {
  const v = (homeAway ?? "").toString().trim().toLowerCase();
  return v === "h" || v === "home" || v === "1" || v === "true";
}

// Maps the active market to the season-avg field that best represents a
// teammate's contribution to it. Combo markets sum their components. Falls
// back to minutes for markets without a clean per-stat (turnovers, etc.).
function pickRosterStatForMarket(
  player: TeamRosterPlayer,
  market: string,
): number {
  switch (market) {
    case "player_points":
      return player.avgPoints ?? 0;
    case "player_rebounds":
      return player.avgRebounds ?? 0;
    case "player_assists":
      return player.avgAssists ?? 0;
    case "player_threes_made":
      return player.avgThrees ?? 0;
    case "player_steals":
      return player.avgSteals ?? 0;
    case "player_blocks":
      return player.avgBlocks ?? 0;
    case "player_points_rebounds_assists":
      return player.avgPra ?? 0;
    case "player_points_assists":
      return (player.avgPoints ?? 0) + (player.avgAssists ?? 0);
    case "player_points_rebounds":
      return (player.avgPoints ?? 0) + (player.avgRebounds ?? 0);
    case "player_rebounds_assists":
      return (player.avgRebounds ?? 0) + (player.avgAssists ?? 0);
    case "player_blocks_steals":
      return (player.avgBlocks ?? 0) + (player.avgSteals ?? 0);
    default:
      return player.avgMinutes ?? 0;
  }
}

// Column-key bridge for header highlighting — maps a market to the header
// cell to brand-tint, or null when no column is the natural sort target.
function sortColumnForMarket(
  market: string,
): "min" | "pts" | "reb" | "ast" | "pra" | "threes" | null {
  switch (market) {
    case "player_points":
    case "player_points_assists":
    case "player_points_rebounds":
      return "pts";
    case "player_rebounds":
      return "reb";
    case "player_assists":
      return "ast";
    case "player_points_rebounds_assists":
      return "pra";
    case "player_rebounds_assists":
      return "reb"; // tie-broken to REB since AST is also relevant
    case "player_threes_made":
      return "threes";
    case "player_steals":
    case "player_blocks":
    case "player_blocks_steals":
      return "pts"; // closest proxy column we render
    default:
      return "min";
  }
}

function sortColumnLabel(market: string): string {
  switch (market) {
    case "player_points":
      return "PPG";
    case "player_rebounds":
      return "RPG";
    case "player_assists":
      return "APG";
    case "player_threes_made":
      return "3PM avg";
    case "player_steals":
      return "STL avg";
    case "player_blocks":
      return "BLK avg";
    case "player_points_rebounds_assists":
      return "PRA";
    case "player_points_assists":
      return "PTS + AST";
    case "player_points_rebounds":
      return "PTS + REB";
    case "player_rebounds_assists":
      return "REB + AST";
    case "player_blocks_steals":
      return "BLK + STL";
    default:
      return "minutes";
  }
}

function getMarketStat(game: BoxScoreGame, market: string) {
  switch (market) {
    case "player_points":
      return game.pts;
    case "player_rebounds":
      return game.reb;
    case "player_assists":
      return game.ast;
    case "1st_quarter_player_points":
      return game.q1Pts ?? game.pts;
    case "1st_quarter_player_rebounds":
      return game.q1Reb ?? game.reb;
    case "1st_quarter_player_assists":
      return game.q1Ast ?? game.ast;
    case "player_threes_made":
      return game.fg3m;
    case "player_steals":
      return game.stl;
    case "player_blocks":
      return game.blk;
    case "player_points_rebounds_assists":
      return game.pra ?? (game.pts ?? 0) + (game.reb ?? 0) + (game.ast ?? 0);
    case "player_points_assists":
      return game.pa ?? (game.pts ?? 0) + (game.ast ?? 0);
    case "player_points_rebounds":
      return game.pr ?? (game.pts ?? 0) + (game.reb ?? 0);
    case "player_rebounds_assists":
      return game.ra ?? (game.reb ?? 0) + (game.ast ?? 0);
    case "player_blocks_steals":
      return game.bs ?? (game.blk ?? 0) + (game.stl ?? 0);
    default:
      return null;
  }
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  const [, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function getWnbaSeasonFromDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const [, year] = date.match(/^(\d{4})-/) ?? [];
  return year ?? null;
}

function formatWeekdayDate(date: string | null | undefined) {
  if (!date) return "—";
  const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (!year || !month || !day) return date;
  const utcDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const weekday = utcDate.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${Number(month)}/${Number(day)}`;
}

function formatOdds(price: number | null) {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : String(price);
}

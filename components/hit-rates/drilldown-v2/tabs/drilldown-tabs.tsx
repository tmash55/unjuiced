"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Crosshair,
  Gauge,
  Handshake,
  Info,
  ListOrdered,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";
import type { TeamRosterPlayer } from "@/hooks/use-team-roster";
import type { TeammateFilter } from "../hero/roster-rail";
import type { ChartRange } from "../hero/hit-rate-chart";
import { PlayerHeadshot } from "@/components/player-headshot";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import {
  usePlayerCorrelations,
  type TeammateCorrelation,
} from "@/hooks/use-player-correlations";
import {
  useShotZoneMatchup,
  type ShotZone,
} from "@/hooks/use-shot-zone-matchup";
import {
  usePlayTypeMatchup,
  type PlayTypeData,
} from "@/hooks/use-play-type-matchup";
import { useHitRateOdds, type LineOdds } from "@/hooks/use-hit-rate-odds";
import { useTeamDefenseRanks } from "@/hooks/use-team-defense-ranks";
import {
  usePositionVsTeam,
  type PositionVsTeamPlayer,
} from "@/hooks/use-position-vs-team";

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
  activeLine?: number | null;
  onLineSelect?: (line: number) => void;
  chartRange?: ChartRange;
}

const TABS: Array<{
  id: DrilldownTabId;
  label: string;
  eyebrow: string;
  icon: React.ElementType;
}> = [
  { id: "overview", label: "Overview", eyebrow: "Snapshot", icon: Gauge },
  { id: "roster", label: "Roster", eyebrow: "Rotation", icon: Users },
  { id: "correlations", label: "Correlations", eyebrow: "Team", icon: Handshake },
  { id: "shooting", label: "Zones", eyebrow: "Shooting", icon: Crosshair },
  { id: "play-types", label: "Play Type", eyebrow: "Usage", icon: Activity },
  { id: "matchup", label: "Matchup", eyebrow: "Context", icon: Shield },
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
  activeLine,
  onLineSelect,
  chartRange = "l20",
}: DrilldownTabsProps) {
  const [activeTab, setActiveTab] = useState<DrilldownTabId>("roster");
  const recentGames = useMemo(() => games.slice(0, 5), [games]);
  const marketLabel = MARKET_LABELS[profile.market] ?? profile.market;

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm ring-1 ring-black/[0.03] dark:border-neutral-800/70 dark:bg-neutral-900/60 dark:ring-white/[0.03]">
      <div className="border-b border-neutral-200/60 px-3 pt-3 dark:border-neutral-800/60">
        <div className="flex items-start justify-end">
          <div className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800/70 dark:bg-neutral-950/50">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {sport.toUpperCase()}
            </span>
            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-xs font-bold tabular-nums text-neutral-700 dark:text-neutral-300">
              {profile.line ?? "—"}+ {marketLabel}
            </span>
          </div>
        </div>

        <div className="-mt-8 flex gap-1 overflow-x-auto pb-3 pr-44 scrollbar-hide max-lg:mt-3 max-lg:pr-0">
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
                    : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    isActive
                      ? "border-brand/30 bg-brand/15"
                      : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">{tab.label}</span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">
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
          activeLine={activeLine ?? profile.line}
          onLineSelect={onLineSelect}
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
  activeLine,
  onLineSelect,
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
  activeLine: number | null;
  onLineSelect?: (line: number) => void;
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
    return <MatchupPanel profile={profile} sport={sport} activeLine={activeLine} />;
  }

  if (activeTab === "roster") {
    return (
      <RosterPanel
        rosterPlayers={rosterPlayers}
        market={profile.market}
        teammateFilters={teammateFilters}
        onTeammateFilterToggle={onTeammateFilterToggle}
        isLoadingRoster={isLoadingRoster}
      />
    );
  }

  if (activeTab === "game-log") {
    return <GameLogPanel profile={profile} games={games} line={activeLine} isLoading={isLoadingGames} />;
  }

  if (activeTab === "correlations") {
    return <CorrelationsPanel profile={profile} sport={sport} line={activeLine} chartRange={chartRange} />;
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
      />
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-3">
      <PreviewMetric
        label={activeTab === "odds" ? "Best Over" : "Current Line"}
        value={activeTab === "odds" ? formatOdds(profile.bestOdds?.price ?? null) : `${profile.line ?? "—"}+`}
        accent
      />
      <PreviewMetric
        label="L10"
        value={profile.last10Pct !== null && profile.last10Pct !== undefined ? `${profile.last10Pct}%` : "—"}
      />
      <PreviewMetric
        label="Season"
        value={profile.seasonPct !== null && profile.seasonPct !== undefined ? `${profile.seasonPct}%` : "—"}
      />

      <div className="md:col-span-3">
        <PreviewHeader title={getPreviewTitle(activeTab)} kicker="Panel scaffold" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr]">
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4 dark:border-neutral-800/70 dark:bg-neutral-950/35">
            <div className="flex h-36 items-end gap-2">
              {[42, 68, 54, 82, 48, 74, 61, 88, 57].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={cn(
                      "w-full rounded-t-md",
                      index % 3 === 1 ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"
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
            <SignalLine label="Context" value={`${profile.teamAbbr} ${profile.position ?? ""}`} />
            <SignalLine label="Matchup" value={`${isProfileHome(profile.homeAway) ? "vs" : "@"} ${profile.opponentTeamAbbr ?? "—"}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TOTAL_TEAMS_BY_SPORT: Record<"nba" | "wnba", number> = { nba: 30, wnba: 13 };
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

const CORRELATION_MARKETS: Array<{ key: CorrelationMarket; label: string; dbMarket: string }> = [
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
  const [selectedMarket, setSelectedMarket] = useState<CorrelationMarket>(defaultMarket);
  useEffect(() => {
    setSelectedMarket(defaultMarket);
  }, [defaultMarket]);
  const { teammateCorrelations, anchorPerformance, isLoading, error } = usePlayerCorrelations({
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
      .filter(({ hitRate }) => hitRate && hitRate.games > 0 && hitRate.pct !== null)
      .sort((a, b) => {
        const pctDiff = (b.hitRate?.pct ?? -1) - (a.hitRate?.pct ?? -1);
        if (pctDiff !== 0) return pctDiff;
        return (b.hitRate?.games ?? 0) - (a.hitRate?.games ?? 0);
      })
      .slice(0, 9);
  }, [teammateCorrelations, selectedMarket]);

  return (
    <div>
      <PreviewHeader title={`When ${anchorPhrase}`} kicker={`Correlations • ${correlationWindow.label}`} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {CORRELATION_MARKETS.map((market) => (
          <button
            key={market.key}
            type="button"
            onClick={() => setSelectedMarket(market.key)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98]",
              selectedMarket === market.key
                ? "border-brand/40 bg-brand/15 text-brand"
                : "border-neutral-200/70 bg-neutral-50/70 text-neutral-500 hover:text-neutral-900 dark:border-neutral-800/70 dark:bg-neutral-950/35 dark:text-neutral-400 dark:hover:text-white"
            )}
          >
            {market.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
            Anchor Result • {correlationWindow.label}
          </div>
          <div className="mt-2 text-lg font-black tabular-nums text-neutral-950 dark:text-white">
            {anchorPerformance?.hitRate !== null && anchorPerformance?.hitRate !== undefined
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
            <MiniStat label="Games" value={anchorPerformance?.gamesAnalyzed ?? null} />
          </div>
          <div className="mt-3 rounded-lg border border-neutral-200/70 bg-white/45 px-2.5 py-2 text-[10px] font-bold leading-4 text-neutral-500 dark:border-neutral-800/70 dark:bg-neutral-900/35 dark:text-neutral-500">
            Teammate samples only include eligible shared games where the teammate has a valid stat line in this window.
          </div>
          {correlationWindow.note && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] font-bold leading-4 text-amber-700 dark:text-amber-300">
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
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 md:grid-cols-2">
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
  hitRate: TeammateCorrelation[CorrelationMarket]["hitRateWhenAnchorHits"] | null;
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
        <span className={cn("rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em]", tone.badge)}>
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
            {getLastName(teammate.playerName)} hit {formatDecimal(hitRate?.lineUsed)}+ {CORRELATION_MARKETS.find((m) => m.key === selectedMarket)?.label}
          </div>
        </div>
        <div className="text-right text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          <div>{hitRate?.timesHit ?? 0}/{hitRate?.games ?? 0}</div>
          <div>eligible</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {recentDots.map((hit, index) => (
          <span
            key={index}
            className={cn("h-2 w-2 rounded-full", hit ? "bg-emerald-500" : "bg-rose-500")}
          />
        ))}
      </div>
    </div>
  );
}

function ShootingPanel({ profile, sport }: { profile: HitRateProfile; sport: "nba" | "wnba" }) {
  const [season, setSeason] = useState(sport === "wnba" ? "2025" : "2025-26");
  const { data, isLoading, error } = useShotZoneMatchup({
    playerId: profile.playerId,
    opponentTeamId: profile.opponentTeamId,
    sport,
    season,
    enabled: !!profile.playerId && !!profile.opponentTeamId,
  });
  const zones = useMemo(() => [...(data?.zones ?? [])].sort((a, b) => b.player_pct_of_total - a.player_pct_of_total), [data?.zones]);
  const totalTeams = data?.summary?.total_teams ?? TOTAL_TEAMS_BY_SPORT[sport];

  return (
    <div>
      <PreviewHeader title="Shooting Zones" kicker="Shot mix and defense" />
      <SeasonToggle sport={sport} season={season} onSeasonChange={setSeason} />

      {isLoading ? (
        <div className="mt-4"><SkeletonRows rows={6} /></div>
      ) : error ? (
        <EmptyPreview label="Shooting zone data could not be loaded." />
      ) : zones.length === 0 ? (
        <EmptyPreview label="No shooting zone data available yet." />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
              Favorable Usage
            </div>
            <div className="mt-2 text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {data?.summary?.favorable_pct_of_points?.toFixed(0) ?? "—"}%
            </div>
            <div className="mt-1 text-xs font-bold text-neutral-500 dark:text-neutral-500">
              of points from zones where {profile.opponentTeamAbbr ?? "OPP"} grades soft
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat label="Good" value={data?.summary?.favorable_zones ?? null} />
              <MiniStat label="Mid" value={data?.summary?.neutral_zones ?? null} />
              <MiniStat label="Hard" value={data?.summary?.tough_zones ?? null} />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
            <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {zones.map((zone) => (
                <ZoneRow key={zone.zone} zone={zone} totalTeams={totalTeams} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZoneRow({ zone, totalTeams }: { zone: ShotZone; totalTeams: number }) {
  const tone = getDefenseRankTone(zone.opponent_def_rank, totalTeams);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_92px_78px] items-center gap-3 bg-white/40 px-3 py-3 text-xs dark:bg-neutral-900/20">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-black text-neutral-950 dark:text-white">{zone.display_name}</span>
          <span className="font-black tabular-nums text-neutral-700 dark:text-neutral-300">
            {zone.player_pct_of_total.toFixed(0)}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <span
            className={cn("block h-full rounded-full", tone.bar)}
            style={{ width: `${Math.min(100, zone.player_pct_of_total)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {zone.player_fgm}/{zone.player_fga} FG • {Math.round(zone.player_fg_pct * 100)}%
        </div>
      </div>
      <div className="text-right">
        <div className={cn("font-black tabular-nums", tone.text)}>
          {zone.opponent_def_rank ? `#${zone.opponent_def_rank}` : "—"}
        </div>
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">def rank</div>
      </div>
      <span className={cn("rounded-md px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em]", tone.badge)}>
        {tone.label}
      </span>
    </div>
  );
}

function PlayTypePanel({ profile, sport }: { profile: HitRateProfile; sport: "nba" | "wnba" }) {
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
          b.player_ppg - a.player_ppg
      ),
    [data?.play_types]
  );
  const topPlayType = playTypes[0] ?? null;
  const favorableShare = data?.summary?.favorable_pct_of_points ?? null;

  if (sport === "wnba") {
    return (
      <div>
        <PreviewHeader title="Play Type Analysis" kicker="Usage split" />
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300/80 bg-neutral-50/60 p-8 text-center dark:border-neutral-800 dark:bg-neutral-950/35">
          <BarChart3 className="mx-auto h-7 w-7 text-brand" />
          <div className="mt-3 text-sm font-black text-neutral-950 dark:text-white">
            WNBA play types are coming soon
          </div>
          <p className="mx-auto mt-1 max-w-sm text-xs font-bold leading-5 text-neutral-500 dark:text-neutral-500">
            We have the tab structure ready; this will populate when WNBA play-type scoring and defensive splits are available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PreviewHeader title="Play Type Analysis" kicker="Sorted by % of scoring" />
      {isLoading ? (
        <div className="mt-4"><SkeletonRows rows={6} /></div>
      ) : error ? (
        <EmptyPreview label="Play type data could not be loaded." />
      ) : playTypes.length === 0 ? (
        <EmptyPreview label="No play type data available yet." />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
                Primary Action
              </div>
              <div className="mt-2 text-lg font-black text-neutral-950 dark:text-white">
                {topPlayType?.display_name ?? "—"}
              </div>
              <div className="mt-1 text-xs font-bold leading-5 text-neutral-500 dark:text-neutral-500">
                {topPlayType
                  ? `${topPlayType.player_pct_of_total.toFixed(0)}% of scoring • ${topPlayType.player_ppg.toFixed(1)} PPG`
                  : "No dominant play type found."}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="PPP" value={topPlayType ? topPlayType.player_ppp.toFixed(2) : "—"} />
                <MiniStat label="Opp Rank" value={topPlayType?.opponent_def_rank ? `#${topPlayType.opponent_def_rank}` : "—"} />
                <MiniStat label="Good Share" value={favorableShare !== null ? `${favorableShare.toFixed(0)}%` : "—"} />
                <MiniStat label="Types" value={playTypes.length} />
              </div>
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand/[0.06] p-3 dark:bg-brand/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                  <Info className="h-3.5 w-3.5" />
                </span>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                  PPP
                </div>
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-neutral-600 dark:text-neutral-400">
                Points per possession. It shows how efficiently a player scores when a possession ends in that play type.
              </p>
              <p className="mt-2 text-[11px] font-bold leading-5 text-neutral-500 dark:text-neutral-500">
                High scoring share shows volume. High PPP shows quality. A strong over gets more interesting when both the player is efficient and the opponent allows soft PPP on that action.
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

function PlayTypeRow({ playType, index }: { playType: PlayTypeData; index: number }) {
  const tone = getDefenseRankTone(playType.opponent_def_rank, 30);
  const efficiency = getPppTone(playType.player_ppp);
  const share = Math.max(0, Math.min(100, playType.player_pct_of_total));

  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_84px_88px_82px] items-center gap-3 bg-white/40 px-3 py-3 text-xs dark:bg-neutral-900/20 max-lg:grid-cols-[28px_minmax(0,1fr)_72px]">
      <div className="text-center text-[10px] font-black tabular-nums text-neutral-500 dark:text-neutral-500">
        {index + 1}
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-black text-neutral-950 dark:text-white">
            {playType.display_name}
          </div>
          <div className="hidden text-[10px] font-black tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">
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
          {playType.opponent_ppp_allowed != null ? `${playType.opponent_ppp_allowed.toFixed(2)} allowed` : "Opp rank"}
        </div>
      </div>

      <span className={cn("rounded-md px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em] max-lg:hidden", tone.badge)}>
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
    text: "text-rose-500 dark:text-rose-400",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
}

function OddsPanel({
  profile,
  sport,
  activeLine,
  onLineSelect,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  activeLine: number | null;
  onLineSelect?: (line: number) => void;
}) {
  const { getOdds, isLoading } = useHitRateOdds({
    rows: [{ oddsSelectionId: profile.oddsSelectionId, line: profile.line }],
    sport,
    enabled: !!profile.oddsSelectionId,
  });
  const odds = getOdds(profile.oddsSelectionId);
  const lines = odds?.allLines?.length ? odds.allLines : [];

  return (
    <div>
      <PreviewHeader title="Odds Board" kicker="Books and alternates" />
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
            Best Current
          </div>
          <OddsBookLine label="Over" entry={odds?.bestOver ?? profile.bestOdds} />
          <OddsBookLine label="Under" entry={odds?.bestUnder ?? null} />
          <div className="mt-4 border-t border-neutral-200/70 pt-3 text-[10px] font-bold text-neutral-500 dark:border-neutral-800/70 dark:text-neutral-500">
            Active line: <span className="font-black text-neutral-900 dark:text-white">{formatDecimal(activeLine)}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
          {isLoading ? (
            <SkeletonRows rows={5} />
          ) : lines.length === 0 ? (
            <EmptyPreview label="No alternate lines available for this prop." />
          ) : (
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-neutral-100/95 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Line</th>
                    <th className="px-3 py-2 text-right">Over</th>
                    <th className="px-3 py-2 text-right">Under</th>
                    <th className="px-3 py-2 text-right">Books</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                  {lines.map((line) => {
                    const isActive = activeLine !== null && Math.abs(line.line - activeLine) < 0.001;
                    return (
                      <tr
                        key={line.line}
                        className={cn(
                          "bg-white/40 dark:bg-neutral-900/20",
                          isActive && "bg-brand/10"
                        )}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => onLineSelect?.(line.line)}
                            className={cn(
                              "rounded-md border px-2 py-1 font-black tabular-nums transition-all active:scale-[0.98]",
                              isActive
                                ? "border-brand/40 bg-brand/15 text-brand"
                                : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                            )}
                          >
                            {formatDecimal(line.line)}+
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatOdds(line.bestOver?.price ?? null)}
                        </td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-800 dark:text-neutral-200">
                          {formatOdds(line.bestUnder?.price ?? null)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
                          {Object.keys(line.books ?? {}).length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameLogPanel({
  profile,
  games,
  line,
  isLoading,
}: {
  profile: HitRateProfile;
  games: BoxScoreGame[];
  line: number | null;
  isLoading: boolean;
}) {
  const shownGames = games.slice(0, 30);
  const maxStat = Math.max(1, ...shownGames.map((game) => getMarketStat(game, profile.market) ?? 0), line ?? 0);

  return (
    <div>
      <PreviewHeader title="Game Log" kicker={`${shownGames.length || 0} games`} />
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
        {isLoading ? (
          <SkeletonRows rows={7} />
        ) : shownGames.length === 0 ? (
          <EmptyPreview label="Game log rows will appear here." />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-[860px] w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-neutral-100/95 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Opponent</th>
                  <th className="px-3 py-2 text-right">{MARKET_LABELS[profile.market] ?? "Stat"}</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">PTS</th>
                  <th className="px-3 py-2 text-right">REB</th>
                  <th className="px-3 py-2 text-right">AST</th>
                  <th className="px-3 py-2 text-right">3PM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {shownGames.map((game) => {
                  const stat = getMarketStat(game, profile.market);
                  const hit = line !== null && stat !== null ? stat >= line : null;
                  return (
                    <tr key={`${game.gameId}-${game.date}`} className="bg-white/40 dark:bg-neutral-900/20">
                      <td className="px-3 py-2 font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
                        {formatDate(game.date)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-black text-neutral-900 dark:text-white">
                          {game.homeAway === "H" ? "vs" : "@"} {game.opponentAbbr}
                        </div>
                        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                          {game.seasonType}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="ml-auto flex max-w-[160px] items-center justify-end gap-2">
                          <span className={cn("w-9 font-black tabular-nums", hit === false ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                            {stat ?? "—"}
                          </span>
                          <span className="h-2 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                            <span
                              className={cn("block h-full rounded-full", hit === false ? "bg-rose-500" : "bg-emerald-500")}
                              style={{ width: `${Math.min(100, ((stat ?? 0) / maxStat) * 100)}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-black">
                        <span className={game.result === "W" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}>
                          {game.result}
                        </span>
                        <span className="ml-1 text-neutral-500">{game.teamScore}-{game.opponentScore}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{formatDecimal(game.minutes)}</td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{game.pts}</td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{game.reb}</td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{game.ast}</td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{game.fg3m}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
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
  const paceTier = paceRank !== null ? getMatchupTier(total - paceRank + 1, total) : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <PreviewHeader title="Stat Overview" kicker="Market form" />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {overviewMarkets.map(({ market, label }) => {
            const row = profiles.find((p) => p.market === market);
            const delta = row?.last10Avg != null && row?.seasonAvg != null ? row.last10Avg - row.seasonAvg : null;
            return (
              <div
                key={market}
                className={cn(
                  "rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35",
                  market === profile.market && "border-brand/35 bg-brand/10"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
                    {label}
                  </span>
                  {delta !== null && (
                    <span
                      className={cn(
                        "text-[10px] font-black tabular-nums",
                        delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                      )}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xl font-black tabular-nums text-neutral-950 dark:text-white">
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
}: {
  rosterPlayers: TeamRosterPlayer[];
  market: string;
  teammateFilters: TeammateFilter[];
  onTeammateFilterToggle: (filter: TeammateFilter) => void;
  isLoadingRoster: boolean;
}) {
  const [view, setView] = useState<"overview" | "trends" | "impact">("overview");
  // Sort by the player's contribution to the active market so the most-
  // significant teammates (the ones whose absence actually moves the needle)
  // surface first. Falls back to minutes for markets without a clean stat.
  const sortedPlayers = useMemo(() => {
    return [...rosterPlayers].sort(
      (a, b) => pickRosterStatForMarket(b, market) - pickRosterStatForMarket(a, market)
    );
  }, [rosterPlayers, market]);

  // Which column matches the active market — used to highlight that header
  // so users see WHY the rows are ordered the way they are.
  const sortColumnKey = sortColumnForMarket(market);
  const minutesSortedPlayers = useMemo(() => {
    return [...rosterPlayers].sort((a, b) => (b.avgMinutes ?? 0) - (a.avgMinutes ?? 0));
  }, [rosterPlayers]);

  // For Lineup Impact: the deltas only make sense relative to a teammate
  // being out of the lineup. We treat any active With/Without filter as the
  // "off-floor" condition, prefer Without (since it's the more common research
  // intent), then fall back to With for the symmetrical question.
  const impactBasis = teammateFilters.find((f) => f.mode === "without") ?? teammateFilters[0] ?? null;
  const impactBasisPlayer = impactBasis
    ? rosterPlayers.find((p) => String(p.playerId) === impactBasis.playerId)
    : null;

  const headerTitle =
    view === "overview" ? "Roster Overview" : view === "trends" ? "Rotation Trends" : "Lineup Impact";
  const headerKicker =
    view === "overview"
      ? `Sorted by ${sortColumnLabel(market)}`
      : view === "trends"
      ? "Minutes, role and availability"
      : impactBasisPlayer
      ? `Deltas when ${impactBasisPlayer.name} is OFF the floor`
      : "Toggle With/Without on a player to see role shifts";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PreviewHeader title={headerTitle} kicker={headerKicker} />
        <div className="flex w-fit rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
          <MiniToggle active={view === "overview"} onClick={() => setView("overview")}>
            Overview
          </MiniToggle>
          <MiniToggle active={view === "trends"} onClick={() => setView("trends")}>
            Trends
          </MiniToggle>
          <MiniToggle active={view === "impact"} onClick={() => setView("impact")}>
            Impact
          </MiniToggle>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
        {isLoadingRoster ? (
          <SkeletonRows rows={7} />
        ) : rosterPlayers.length === 0 ? (
          <EmptyPreview label="Roster rows will appear here." />
        ) : view === "trends" ? (
          <RosterTrendsView
            players={minutesSortedPlayers}
            market={market}
            teammateFilters={teammateFilters}
            onTeammateFilterToggle={onTeammateFilterToggle}
          />
        ) : view === "impact" ? (
          <LineupImpactPlaceholder
            basisPlayerName={impactBasisPlayer?.name ?? null}
            basisMode={impactBasis?.mode ?? null}
            roster={minutesSortedPlayers}
            teammateFilters={teammateFilters}
            onTeammateFilterToggle={onTeammateFilterToggle}
          />
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="min-w-[1040px] w-full border-collapse text-xs">
              <thead className="sticky top-0 z-[1] bg-neutral-100/95 backdrop-blur dark:bg-neutral-950/95">
                <tr className="border-b border-neutral-200/70 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 dark:border-neutral-800/70 dark:text-neutral-500">
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "min" && "text-brand")}>Min/g</th>
                  <th className="px-3 py-2 text-right">Usage</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "pts" && "text-brand")}>PTS</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "reb" && "text-brand")}>REB</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "ast" && "text-brand")}>AST</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "threes" && "text-brand")}>3PM</th>
                  <th className={cn("px-3 py-2 text-right", sortColumnKey === "pra" && "text-brand")}>PRA</th>
                  <th className="px-3 py-2 text-right">GP</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {sortedPlayers.map((player, index) => {
                  const playerId = String(player.playerId);
                  const withActive = teammateFilters.some((f) => f.playerId === playerId && f.mode === "with");
                  const withoutActive = teammateFilters.some((f) => f.playerId === playerId && f.mode === "without");
                  const tone = statusTone(player.injuryStatus);
                  const role = getRoleTag(player, index);
                  return (
                    <tr key={player.playerId} className="bg-white/40 dark:bg-neutral-900/20">
                      <td className="px-3 py-2">
                        <div className="font-black text-neutral-900 dark:text-white">{player.name}</div>
                        <div className="mt-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                          {player.position || "—"} {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]",
                            role.className
                          )}
                        >
                          {role.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="ml-auto flex max-w-[128px] items-center justify-end gap-2">
                          <span className="w-9 font-black tabular-nums text-neutral-950 dark:text-white">
                            {formatDecimal(player.avgMinutes)}
                          </span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                            <span
                              className="block h-full rounded-full bg-brand"
                              style={{ width: `${Math.min(100, (player.avgMinutes / 40) * 100)}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <RosterNumber value={player.avgUsage} suffix="%" />
                      <RosterNumber value={player.avgPoints} />
                      <RosterNumber value={player.avgRebounds} />
                      <RosterNumber value={player.avgAssists} />
                      <RosterNumber value={player.avgThrees} />
                      <RosterNumber value={player.avgPra} />
                      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">
                        {player.gamesPlayed}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]", tone.className)}>
                          {tone.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="ml-auto flex w-fit items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                          <MiniToggle
                            active={withActive}
                            onClick={() => onTeammateFilterToggle({ playerId, mode: "with" })}
                          >
                            With
                          </MiniToggle>
                          <MiniToggle
                            active={withoutActive}
                            onClick={() => onTeammateFilterToggle({ playerId, mode: "without" })}
                          >
                            W/O
                          </MiniToggle>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
function getRoleTag(player: TeamRosterPlayer, rotationIndex: number): { label: string; className: string } {
  const minutes = player.avgMinutes ?? 0;
  if (rotationIndex < 5 && minutes >= 26) {
    return { label: "Starter", className: "bg-brand/15 text-brand" };
  }
  if (minutes >= 18) {
    return { label: "Rotation", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  }
  if (minutes >= 8) {
    return { label: "Fringe", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
  return { label: "Bench", className: "bg-neutral-200/70 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400" };
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
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            Lineup Impact
          </div>
          <p className="mx-auto mt-2 max-w-md text-[12px] font-medium leading-snug text-neutral-600 dark:text-neutral-300">
            Pick a teammate to remove from the lineup. We'll show how everyone
            else's minutes, usage and scoring shift in games where they were
            out.
          </p>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
            Try one
          </div>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((p) => (
              <button
                key={p.playerId}
                type="button"
                onClick={() =>
                  onTeammateFilterToggle({ playerId: String(p.playerId), mode: "without" })
                }
                className="rounded-md border border-neutral-200/70 bg-white px-2.5 py-1 text-[11px] font-black text-neutral-700 transition-colors hover:border-brand/45 hover:text-brand dark:border-neutral-800/70 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:text-brand"
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
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
          {basisMode === "with" ? "On-floor basis" : "Off-floor basis"}
        </div>
        <p className="mt-1 text-[12px] font-bold leading-snug text-neutral-700 dark:text-neutral-200">
          Showing the games where{" "}
          <span className="text-brand">{basisPlayerName}</span> was{" "}
          {basisMode === "with" ? "ACTIVE" : "OUT"}. Per-player deltas (Δ vs
          season) wire up next — the data is ready in the injury-impact RPC.
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200/70 bg-white/40 p-4 dark:border-neutral-800/70 dark:bg-neutral-900/25">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
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
        <p className="mt-3 text-[11px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
          Each row will show direction (▲/▼), magnitude, and a small-sample warning when n &lt; 5.
        </p>
      </div>
      {teammateFilters.length > 1 && (
        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {teammateFilters.length} teammate filters active — Impact view uses the first one as basis.
        </div>
      )}
    </div>
  );
}

function MatchupPanel({
  profile,
  sport,
  activeLine,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  activeLine: number | null;
}) {
  const [view, setView] = useState<"similar" | "defense">("similar");
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
    enabled: !!normalizedPosition && !!profile.opponentTeamId && !!profile.market,
  });

  const totalTeams = defenseQuery.meta?.totalTeams ?? TOTAL_TEAMS_BY_SPORT[sport];
  const activeDefense = normalizedPosition
    ? defenseQuery.positions[normalizedPosition]?.[profile.market] ?? null
    : null;
  const defTone = getDefenseRankTone(activeDefense?.rank ?? profile.matchupRank, totalTeams);
  const paceRank = profile.paceContext?.opponentRecent.l5Rank ?? null;
  const paceTier = paceRank !== null ? getMatchupTier(totalTeams - paceRank + 1, totalTeams) : null;
  const positionsToShow = sport === "wnba" ? ["G", "F", "C"] : ["PG", "SG", "SF", "PF", "C"];
  const hasDefenseData = positionsToShow.some((pos) => !!defenseQuery.positions[pos]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PreviewHeader
          title="Matchup Context"
          kicker={`${profile.opponentTeamAbbr ?? "OPP"} vs ${normalizedPosition ?? profile.position ?? "position"}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          {sport === "wnba" && (
            <div className="flex rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
              {(["2025", "2026"] as const).map((season) => (
                <MiniToggle key={season} active={wnbaSeason === season} onClick={() => setWnbaSeason(season)}>
                  {season}
                </MiniToggle>
              ))}
            </div>
          )}
          <div className="flex rounded-lg bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
            <MiniToggle active={view === "similar"} onClick={() => setView("similar")}>
              Similar
            </MiniToggle>
            <MiniToggle active={view === "defense"} onClick={() => setView("defense")}>
              Defense
            </MiniToggle>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ContextPanel
            label="Active DvP"
            value={activeDefense?.rank !== null && activeDefense?.rank !== undefined ? `#${activeDefense.rank}` : profile.matchupRank !== null ? `#${profile.matchupRank}` : "—"}
            badge={defTone.label}
            tone={toneToMatchupTier(defTone.label)}
            subValue={activeDefense?.avgAllowed != null ? `${activeDefense.avgAllowed.toFixed(1)} allowed/g` : profile.matchupAvgAllowed != null ? `${profile.matchupAvgAllowed.toFixed(1)} allowed/g` : undefined}
          />
          <ContextPanel
            label="Opponent Pace"
            value={paceRank !== null ? `#${paceRank}` : "—"}
            badge={paceTierLabel(paceTier)}
            tone={paceTier}
            subValue={profile.paceContext?.opponentRecent.l5 != null ? `${profile.paceContext.opponentRecent.l5.toFixed(1)} poss / 48` : undefined}
          />
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
              Similar Sample
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Games" value={positionQuery.totalGames} />
              <MiniStat label="Players" value={positionQuery.playerCount} />
              <MiniStat label="Avg" value={positionQuery.avgStat ? positionQuery.avgStat.toFixed(1) : "—"} />
              <MiniStat label="Over" value={positionQuery.overHitRate !== null ? `${positionQuery.overHitRate}%` : "—"} />
            </div>
          </div>
        </div>

        {view === "similar" ? (
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
            hasExpansionEmptyState={sport === "wnba" && wnbaSeason === "2025" && positionQuery.players.length === 0}
          />
        ) : (
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
          />
        )}
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
  "player_points_rebounds",
  "player_points_assists",
  "player_rebounds_assists",
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
  hasExpansionEmptyState: boolean;
}) {
  const statLabel = MARKET_LABELS[market] ?? market;
  const maxStat = Math.max(1, ...players.map((player) => player.stat), line ?? 0);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
      <div className="flex flex-col gap-3 border-b border-neutral-200/70 bg-neutral-50/70 px-3 py-3 dark:border-neutral-800/70 dark:bg-neutral-950/35 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-black text-neutral-950 dark:text-white">
            Similar {position ?? "Position"} Players vs {opponentTeamAbbr ?? "OPP"}
          </div>
          <div className="mt-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
            Recent players at this position against this defense for {statLabel}
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
      ) : players.length === 0 ? (
        <EmptyPreview
          label={
            hasExpansionEmptyState
              ? "No prior-season similar-position matchup history for this opponent."
              : "No similar-position matchup games found for these filters."
          }
        />
      ) : (
        <div className="relative max-h-[420px] overflow-auto">
          {isFetching && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/65 backdrop-blur-sm dark:bg-neutral-950/60">
              <span className="text-xs font-black text-neutral-500 dark:text-neutral-400">Updating matchup sample...</span>
            </div>
          )}
          <table className="min-w-[760px] w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[1] bg-neutral-100/95 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Player</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-right">Line</th>
                <th className="px-3 py-2 text-right">{statLabel}</th>
                <th className="px-3 py-2 text-right">PTS</th>
                <th className="px-3 py-2 text-right">REB</th>
                <th className="px-3 py-2 text-right">AST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
              {players.map((player, index) => (
                <SimilarPlayerRow
                  key={`${player.gameDate}-${player.playerId}-${index}`}
                  player={player}
                  line={line}
                  maxStat={maxStat}
                  sport={sport}
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
  maxStat,
  sport,
}: {
  player: PositionVsTeamPlayer;
  line: number | null;
  maxStat: number;
  sport: "nba" | "wnba";
}) {
  const hitCurrentLine = line !== null ? player.stat >= line : null;
  const hitClosingLine = player.hitOver;
  return (
    <tr className="bg-white/40 dark:bg-neutral-900/20">
      <td className="px-3 py-2 font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
        {formatDate(player.gameDate)}
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {player.teamAbbr && (
            <img
              src={getTeamLogoUrl(player.teamAbbr, sport)}
              alt={player.teamAbbr}
              className="h-5 w-5 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-black text-neutral-950 dark:text-white">{player.playerName}</div>
            <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">{player.position}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">
        {Math.floor(player.minutes)}
      </td>
      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-500 dark:text-neutral-500">
        {player.closingLine ?? "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="ml-auto flex max-w-[150px] items-center justify-end gap-2">
          <span
            className={cn(
              "w-9 font-black tabular-nums",
              hitCurrentLine === null
                ? "text-neutral-950 dark:text-white"
                : hitCurrentLine
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
            )}
          >
            {formatDecimal(player.stat)}
          </span>
          <span className="h-2 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <span
              className={cn(
                "block h-full rounded-full",
                hitClosingLine === false ? "bg-rose-500" : hitClosingLine === true ? "bg-emerald-500" : "bg-neutral-400"
              )}
              style={{ width: `${Math.min(100, (player.stat / maxStat) * 100)}%` }}
            />
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{player.pts}</td>
      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{player.reb}</td>
      <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-700 dark:text-neutral-300">{player.ast}</td>
    </tr>
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
}: {
  positions: Record<string, Record<string, { rank: number | null; avgAllowed: number | null }>>;
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
}) {
  const rankBuckets = getRankBuckets(totalTeams);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800/70">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200/70 bg-neutral-50/70 px-3 py-3 dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <div>
          <div className="text-xs font-black text-neutral-950 dark:text-white">
            Defense vs Position
          </div>
          <div className="mt-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
            {opponentTeamAbbr ?? "OPP"} ranks by stat allowed to each position
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
          {opponentTeamAbbr && (
            <img src={getTeamLogoUrl(opponentTeamAbbr, sport)} alt={opponentTeamAbbr} className="h-5 w-5 object-contain" />
          )}
          <span>{season ?? "Season"} • {totalTeams} teams</span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={7} />
      ) : !hasDefenseData ? (
        <EmptyPreview label="No defense-vs-position grid is available for this opponent and season." />
      ) : (
        <div className="relative max-h-[420px] overflow-auto">
          {isFetching && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center bg-white/65 backdrop-blur-sm dark:bg-neutral-950/60">
              <span className="text-xs font-black text-neutral-500 dark:text-neutral-400">Updating defense ranks...</span>
            </div>
          )}
          <table className="min-w-[780px] w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[1] bg-neutral-100/95 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Stat</th>
                {positionsToShow.map((position) => (
                  <th
                    key={position}
                    className={cn(
                      "px-3 py-2 text-center",
                      position === currentPosition && "text-brand"
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
                    market === activeMarket && "bg-brand/[0.07] dark:bg-brand/[0.09]"
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="font-black text-neutral-950 dark:text-white">
                      {MARKET_LABELS[market] ?? market}
                    </div>
                  </td>
                  {positionsToShow.map((position) => {
                    const data = positions[position]?.[market] ?? { rank: null, avgAllowed: null };
                    const tone = getDefenseRankTone(data.rank, totalTeams);
                    return (
                      <td
                        key={position}
                        className={cn(
                          "px-3 py-2 text-center",
                          position === currentPosition && "bg-brand/[0.08]"
                        )}
                      >
                        <div className={cn("font-black tabular-nums", tone.text)}>
                          {data.rank ? `#${data.rank}` : "—"}
                        </div>
                        <div className="text-[10px] font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
                          {data.avgAllowed != null ? data.avgAllowed.toFixed(1) : "—"}
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
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em]">
          <span className="rounded-md bg-rose-500/15 px-2 py-1 text-rose-600 dark:text-rose-400">Tough 1-{rankBuckets.toughMax}</span>
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-amber-600 dark:text-amber-400">Mid {rankBuckets.toughMax + 1}-{rankBuckets.neutralMax}</span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-600 dark:text-emerald-400">Soft {rankBuckets.neutralMax + 1}-{rankBuckets.total}</span>
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
  const benchMinutes = players.slice(10).reduce((sum, player) => sum + (player.avgMinutes ?? 0), 0);
  const maxMinutes = Math.max(1, ...topPlayers.map((player) => player.avgMinutes ?? 0), benchMinutes);
  const activePlayers = players.filter((player) => statusTone(player.injuryStatus).label === "ACTIVE").length;
  const likelyStarters = players.filter((player, index) => getStartLikelihood(player, index).tier !== "bench").length;

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="max-h-[390px] overflow-auto p-3">
        <div className="space-y-2">
          {topPlayers.map((player, index) => {
            const start = getStartLikelihood(player, index);
            const tone = statusTone(player.injuryStatus);
            const impact = pickRosterStatForMarket(player, market);
            const playerId = String(player.playerId);
            const withActive = teammateFilters.some((f) => f.playerId === playerId && f.mode === "with");
            const withoutActive = teammateFilters.some((f) => f.playerId === playerId && f.mode === "without");
            return (
              <div
                key={player.playerId}
                className="grid grid-cols-[minmax(116px,1fr)_minmax(160px,1.3fr)_72px_94px] items-center gap-3 rounded-xl border border-neutral-200/60 bg-white/45 px-3 py-2.5 text-xs dark:border-neutral-800/70 dark:bg-neutral-900/25"
              >
                <div className="min-w-0">
                  <div className="truncate font-black text-neutral-950 dark:text-white">{player.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                    <span>{player.position || "—"}</span>
                    {player.jerseyNumber ? <span>#{player.jerseyNumber}</span> : null}
                    <span className={cn("rounded-sm px-1 py-0.5 text-[8px] uppercase tracking-[0.12em]", tone.className)}>
                      {tone.label}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-500">
                    <span>Minutes Role</span>
                    <span className="font-black tabular-nums text-neutral-900 dark:text-white">
                      {formatDecimal(player.avgMinutes)} min/g
                    </span>
                  </div>
                  <div className="grid h-5 grid-cols-10 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                    {Array.from({ length: 10 }).map((_, segment) => {
                      const filled = ((segment + 1) / 10) * maxMinutes <= (player.avgMinutes ?? 0);
                      return (
                        <span
                          key={segment}
                          className={cn(
                            "border-r border-neutral-950/10 last:border-r-0 dark:border-white/10",
                            filled ? start.bar : "bg-transparent"
                          )}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn("font-black tabular-nums", start.text)}>{start.label}</div>
                  <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-500">start proxy</div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <div className="mr-1 hidden text-right text-[10px] font-bold text-neutral-500 dark:text-neutral-500 xl:block">
                    <span className="block font-black tabular-nums text-neutral-800 dark:text-neutral-200">
                      {formatDecimal(impact)}
                    </span>
                    <span>{sortColumnLabel(market)}</span>
                  </div>
                  <div className="flex w-fit items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                    <MiniToggle
                      active={withActive}
                      onClick={() => onTeammateFilterToggle({ playerId, mode: "with" })}
                    >
                      With
                    </MiniToggle>
                    <MiniToggle
                      active={withoutActive}
                      onClick={() => onTeammateFilterToggle({ playerId, mode: "without" })}
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

      <aside className="border-t border-neutral-200/70 bg-neutral-50/60 p-4 dark:border-neutral-800/70 dark:bg-neutral-950/35 lg:border-l lg:border-t-0">
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Active" value={`${activePlayers}/${players.length}`} />
          <MiniStat label="Starters" value={likelyStarters} />
          <MiniStat label="Top Min" value={formatDecimal(players[0]?.avgMinutes)} />
          <MiniStat label="Bench Min" value={formatDecimal(benchMinutes)} />
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200/70 bg-white/50 p-3 dark:border-neutral-800/70 dark:bg-neutral-900/35">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
            What This Shows
          </div>
          <div className="mt-2 space-y-2 text-[11px] font-bold leading-5 text-neutral-500 dark:text-neutral-500">
            <p>Minutes role is based on season average minutes from the roster feed.</p>
            <p>Start proxy is inferred from rotation rank and minutes, not official starting-lineup history.</p>
            <p>Use With/W/O here to apply the same teammate filters to the chart and tabs.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-lg border border-neutral-200/70 bg-white/50 px-2.5 py-2 dark:border-neutral-800/70 dark:bg-neutral-900/35">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black tabular-nums text-neutral-950 dark:text-white">
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
            "rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98]",
            season === option
              ? "bg-brand text-neutral-950"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          )}
        >
          {option}
        </button>
      ))}
    </div>
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
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-500">
          {label}
        </div>
        <div className="mt-0.5 text-xs font-bold text-neutral-700 dark:text-neutral-300">
          {book?.name ?? entry?.book ?? "—"}
        </div>
      </div>
      <div className="text-right text-lg font-black tabular-nums text-neutral-950 dark:text-white">
        {formatOdds(entry?.price ?? null)}
      </div>
    </div>
  );
}

function PreviewHeader({ title, kicker }: { title: string; kicker: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">
          {kicker}
        </div>
        <div className="mt-1 text-sm font-black text-neutral-950 dark:text-white">
          {title}
        </div>
      </div>
      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        Next
      </span>
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
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-xl font-black tabular-nums",
          accent ? "text-brand" : "text-neutral-950 dark:text-white"
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
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
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
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-500">
          {label}
        </span>
        <span className={cn("rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]", toneClass.badge)}>
          {badge}
        </span>
      </div>
      <div className={cn("mt-3 text-2xl font-black tabular-nums", toneClass.text)}>
        {value}
      </div>
      {subValue && (
        <div className="mt-1 text-[10px] font-bold tabular-nums text-neutral-500 dark:text-neutral-500">
          {subValue}
        </div>
      )}
    </div>
  );
}

function RosterNumber({ value, suffix = "" }: { value: number | null | undefined; suffix?: string }) {
  return (
    <td className="px-3 py-2 text-right font-black tabular-nums text-neutral-800 dark:text-neutral-200">
      {typeof value === "number" && Number.isFinite(value) ? `${formatDecimal(value)}${suffix}` : "—"}
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
        "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-all active:scale-[0.98]",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
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
        <div key={index} className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-3 px-3 py-2.5">
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

function getMatchupTier(rank: number | null, total: number): MatchupTier | null {
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

function normalizePositionForSport(position: string | null, sport: "nba" | "wnba") {
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
  market: CorrelationMarket
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
    text: "text-rose-500 dark:text-rose-400",
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
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
      text: "text-rose-500 dark:text-rose-400",
      badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      bar: "bg-rose-500",
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
        text: "text-rose-500 dark:text-rose-400",
        badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
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
  if (normalized === "out") return { label: "OUT", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
  if (normalized === "questionable" || normalized === "gtd" || normalized === "game time decision") {
    return { label: "GTD", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
  if (normalized === "doubtful") return { label: "DBT", className: "bg-rose-500/10 text-rose-500" };
  if (normalized === "probable") return { label: "PROB", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  return { label: "ACTIVE", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
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

// homeAway can ship as "H"/"A", "home"/"away", or "1"/"0". Normalize before
// comparing so labels stay aligned with the matchup header + venue chip.
function isProfileHome(homeAway: string | null | undefined): boolean {
  const v = (homeAway ?? "").toString().trim().toLowerCase();
  return v === "h" || v === "home" || v === "1" || v === "true";
}

// Maps the active market to the season-avg field that best represents a
// teammate's contribution to it. Combo markets sum their components. Falls
// back to minutes for markets without a clean per-stat (turnovers, etc.).
function pickRosterStatForMarket(player: TeamRosterPlayer, market: string): number {
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
function sortColumnForMarket(market: string): "min" | "pts" | "reb" | "ast" | "pra" | "threes" | null {
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

function formatOdds(price: number | null) {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : String(price);
}

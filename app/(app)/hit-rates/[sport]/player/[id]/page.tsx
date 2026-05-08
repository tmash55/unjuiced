"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, notFound } from "next/navigation";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { PlayerDrilldownV2 } from "@/components/hit-rates/drilldown-v2";
import { MobilePlayerDrilldown } from "@/components/hit-rates/mobile/mobile-player-drilldown";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { useNbaGames } from "@/hooks/use-nba-games";
import { useWnbaGames } from "@/hooks/use-wnba-games";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { WnbaExpansionWelcome } from "@/components/wnba/wnba-expansion-welcome";

const SUPPORTED_SPORTS = ["nba", "wnba"] as const;
type SupportedSport = (typeof SUPPORTED_SPORTS)[number];

const normalizeGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

interface PlayerProfilePageProps {
  params: Promise<{ sport: string; id: string }>;
}

export default function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase() as SupportedSport;
  if (!SUPPORTED_SPORTS.includes(sport)) {
    notFound();
  }

  const playerId = parseInt(resolvedParams.id, 10);
  const searchParams = useSearchParams();
  const router = useRouter();
  const marketParam = searchParams.get("market");
  const dateParam = searchParams.get("date");
  const useV2 = searchParams.get("v") === "2";

  const isMobile = useMediaQuery("(max-width: 767px)");

  const nbaGames = useNbaGames(sport === "nba");
  const wnbaGames = useWnbaGames(sport === "wnba");
  const activeGamesQuery = sport === "wnba" ? wnbaGames : nbaGames;
  const { primaryDate: nextGameDate, isLoading: isLoadingGames } =
    sport === "wnba" ? wnbaGames : nbaGames;
  const allGames = activeGamesQuery.games ?? [];
  const effectiveDate = dateParam || nextGameDate || undefined;

  const { rows: playerProfiles, isLoading: isLoadingProfiles, error } = useHitRateTable({
    sport,
    playerId: playerId,
    date: effectiveDate,
    enabled: !isNaN(playerId) && (!!dateParam || !isLoadingGames),
    limit: 100,
  });
  const isLoading = isLoadingProfiles || (!dateParam && isLoadingGames);

  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);
  const profile = playerProfiles.find((r) => r.market === selectedMarket) || playerProfiles[0];
  const switcherInitializedRef = useRef(false);
  const [switcherGameId, setSwitcherGameId] = useState<string | null>(null);
  const [switcherDate, setSwitcherDate] = useState<string | undefined>(effectiveDate);
  const [switcherMarket, setSwitcherMarket] = useState<string | null>(marketParam);

  useEffect(() => {
    if (!switcherDate && effectiveDate) {
      setSwitcherDate(effectiveDate);
    }
  }, [effectiveDate, switcherDate]);

  useEffect(() => {
    if (switcherInitializedRef.current || !profile) return;
    setSwitcherGameId(profile.gameId ? normalizeGameId(profile.gameId) : null);
    setSwitcherDate(profile.gameDate || effectiveDate);
    setSwitcherMarket((current) => current ?? profile.market);
    switcherInitializedRef.current = true;
  }, [effectiveDate, profile]);

  const { rows: switcherPlayers, isLoading: isLoadingSwitcherPlayers } = useHitRateTable({
    sport,
    date: switcherDate || effectiveDate,
    market: switcherMarket || profile?.market || "player_points",
    enabled: useV2 && !!(switcherDate || effectiveDate),
    limit: 600,
  });

  useEffect(() => {
    if (marketParam && marketParam !== selectedMarket) {
      setSelectedMarket(marketParam);
    }
  }, [marketParam, selectedMarket]);

  const handleMarketChange = (newMarket: string) => {
    setSelectedMarket(newMarket);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("market", newMarket);
    if (effectiveDate) {
      newSearchParams.set("date", effectiveDate);
    }
    router.replace(`/hit-rates/${sport}/player/${playerId}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  };

  const handleSwitcherGameSelect = useCallback((gameId: string | null) => {
    if (!gameId) {
      setSwitcherGameId(null);
      setSwitcherDate(effectiveDate);
      return;
    }

    const normalized = normalizeGameId(gameId);
    const selectedGame = allGames.find((game) => normalizeGameId(game.game_id) === normalized);
    setSwitcherGameId(normalized);
    setSwitcherDate(selectedGame?.game_date || effectiveDate);
  }, [allGames, effectiveDate]);

  const handleSwitcherPlayerSelect = useCallback((nextProfile: HitRateProfile) => {
    const params = new URLSearchParams();
    params.set("market", profile?.market || selectedMarket || nextProfile.market);
    params.set("v", "2");
    if (nextProfile.gameDate) params.set("date", nextProfile.gameDate);
    if (switcherGameId) params.set("gameId", switcherGameId);
    else params.delete("gameId");

    router.push(`/hit-rates/${sport}/player/${nextProfile.playerId}?${params.toString()}`);
  }, [profile?.market, router, selectedMarket, sport, switcherGameId]);

  const handleBack = () => {
    router.push(`/hit-rates/${sport}`);
  };

  const backHref = `/hit-rates/${sport}`;

  if (isNaN(playerId)) {
    return (
      <AppPageLayout title="Invalid Player ID">
        <p className="text-muted-foreground mt-4">
          The player ID provided is not valid.
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (isLoading) {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
            <div className="w-32 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>

          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="w-40 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                <div className="w-24 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-20 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse shrink-0" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4">
            <div className="w-full h-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return <DrilldownSkeleton />;
  }

  if (error) {
    return (
      <AppPageLayout title="Error Loading Player">
        <p className="text-red-600 dark:text-red-400 mt-4">
          {error.message || "Failed to load player profile"}
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (!profile || playerProfiles.length === 0) {
    return (
      <AppPageLayout title="Player Not Found">
        <p className="text-muted-foreground mt-4">
          No hit rate data found for player ID: {playerId}
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (isMobile) {
    return (
      <MobilePlayerDrilldown
        profile={profile}
        allPlayerProfiles={playerProfiles}
        onBack={handleBack}
        onMarketChange={handleMarketChange}
        sport={sport}
      />
    );
  }

  if (useV2) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        {sport === "wnba" && <WnbaExpansionWelcome />}
        <PlayerDrilldownV2
          profile={profile}
          allPlayerProfiles={playerProfiles}
          switcherPlayers={switcherPlayers}
          switcherGames={allGames}
          switcherGameId={switcherGameId}
          onSwitcherGameSelect={handleSwitcherGameSelect}
          onSwitcherPlayerSelect={handleSwitcherPlayerSelect}
          isLoadingSwitcherPlayers={isLoadingSwitcherPlayers}
          sport={sport}
          onMarketChange={handleMarketChange}
          backHref={backHref}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
      {sport === "wnba" && <WnbaExpansionWelcome />}
      <PlayerDrilldown
        profile={profile}
        allPlayerProfiles={playerProfiles}
        onMarketChange={handleMarketChange}
        onBack={handleBack}
        sport={sport}
      />
    </div>
  );
}

// Page-load skeleton for the v2 drilldown — shapes mirror the real layout
// (sticky cap, chart card with command-bar topslot, right column with
// injury rail + matchup context, bottom tabs strip) so the layout doesn't
// jump when data arrives. Uses Tailwind animate-pulse for a subtle shimmer.
function DrilldownSkeleton() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-8">
      {/* Sticky cap — switcher row + markets row */}
      <div className="border-b border-neutral-200/60 bg-white/95 backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-950/95">
        {/* Switcher: back arrow + search + game dropdown + chip row */}
        <div className="flex items-center gap-2 py-2">
          <SkelBlock className="h-8 w-8 rounded-md" />
          <SkelBlock className="hidden h-8 w-[210px] rounded-md sm:block" />
          <SkelBlock className="hidden h-8 w-[160px] rounded-md md:block" />
          <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkelBlock
                key={i}
                className="hidden h-8 w-[120px] shrink-0 rounded-full md:block"
              />
            ))}
          </div>
        </div>
        {/* Markets tabs */}
        <div className="flex items-end gap-5 overflow-hidden pb-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkelBlock key={i} className="my-2 h-3.5 w-16 rounded" />
          ))}
        </div>
      </div>

      {/* Bento grid — chart 9-col, right column 3-col with rail + matchup */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Chart card */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/60 lg:col-span-9">
          {/* Player command bar (topSlot) */}
          <div className="flex items-center gap-5 border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-800/60">
            <div className="flex flex-1 items-center gap-3">
              <SkelBlock className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkelBlock className="h-4 w-32 rounded" />
                <SkelBlock className="h-3 w-20 rounded" />
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <SkelBlock className="h-4 w-24 rounded" />
              <SkelBlock className="h-3 w-32 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <SkelBlock className="h-7 w-20 rounded-md" />
              <SkelBlock className="h-7 w-16 rounded-md" />
            </div>
          </div>
          {/* Chart header — recent perf + range chips */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 px-4 py-2 dark:border-neutral-800/60">
            <SkelBlock className="h-3 w-44 rounded" />
            <div className="hidden items-center gap-1 md:flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkelBlock key={i} className="h-6 w-16 rounded-md" />
              ))}
            </div>
          </div>
          {/* Chart bars */}
          <div className="px-4 pt-7">
            <div
              className="flex items-end justify-between gap-1.5"
              style={{ height: 280 }}
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse rounded-t-[3px] bg-neutral-200/70 dark:bg-neutral-800/70"
                  style={{
                    height: `${30 + ((i * 41) % 70)}%`,
                    animationDelay: `${i * 30}ms`,
                  }}
                />
              ))}
            </div>
            {/* X-axis row */}
            <div className="mt-1.5 flex items-start justify-between gap-1.5 pb-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <SkelBlock className="h-3.5 w-3.5 rounded-full" />
                  <SkelBlock className="h-2 w-6 rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* Splits row */}
          <div className="mt-2 flex items-center gap-1 border-t border-neutral-200/50 px-4 py-2 dark:border-neutral-800/50">
            <SkelBlock className="mr-1 h-3 w-12 rounded" />
            {Array.from({ length: 7 }).map((_, i) => (
              <SkelBlock key={i} className="h-5 w-14 rounded-md" />
            ))}
          </div>
        </div>

        {/* Right column — Injury Report + Matchup Context */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          {/* Injury Report tile */}
          <div className="flex-1 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-200/60 px-4 py-2 dark:border-neutral-800/60">
              <SkelBlock className="h-3 w-24 rounded" />
              <div className="flex items-center gap-1">
                <SkelBlock className="h-5 w-16 rounded-md" />
                <SkelBlock className="h-5 w-10 rounded-md" />
              </div>
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <SkelBlock className="h-3 w-24 rounded" />
                      <SkelBlock className="h-3 w-8 rounded" />
                    </div>
                    <SkelBlock className="h-2.5 w-10 rounded" />
                  </div>
                  <SkelBlock className="h-6 w-20 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Matchup Context tile */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between border-b border-neutral-200/60 px-4 py-2 dark:border-neutral-800/60">
              <SkelBlock className="h-3 w-28 rounded" />
              <div className="flex items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                <SkelBlock className="h-5 w-12 rounded" />
                <SkelBlock className="h-5 w-14 rounded" />
              </div>
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <SkelBlock className="h-4 w-10 rounded-sm" />
                  <SkelBlock className="ml-auto h-4 w-12 rounded" />
                  <SkelBlock className="h-4 w-12 rounded" />
                  <SkelBlock className="h-4 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tabs strip */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/60">
        <div className="border-b border-neutral-200/60 px-3 pt-3 dark:border-neutral-800/60">
          <div className="flex items-start justify-end pb-1">
            <SkelBlock className="h-7 w-32 rounded-full" />
          </div>
          <div className="-mt-8 flex gap-1 overflow-hidden pb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkelBlock key={i} className="h-12 w-[132px] shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <SkelBlock className="h-5 w-40 rounded" />
            <SkelBlock className="h-32 w-full rounded-xl" />
          </div>
          <div className="hidden space-y-2 border-l border-neutral-200/60 pl-4 lg:block dark:border-neutral-800/60">
            <SkelBlock className="h-5 w-32 rounded" />
            <SkelBlock className="h-3 w-full rounded" />
            <SkelBlock className="h-3 w-3/4 rounded" />
            <SkelBlock className="h-3 w-2/3 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkelBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-neutral-200/80 dark:bg-neutral-800/80 ${className ?? ""}`}
    />
  );
}

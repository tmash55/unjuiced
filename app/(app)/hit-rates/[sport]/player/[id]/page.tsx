"use client";

import { use, useEffect, useState } from "react";
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

const SUPPORTED_SPORTS = ["nba", "wnba"] as const;
type SupportedSport = (typeof SUPPORTED_SPORTS)[number];

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

  const isMobile = useMediaQuery("(max-width: 767px)");

  const nbaGames = useNbaGames(sport === "nba");
  const wnbaGames = useWnbaGames(sport === "wnba");
  const { primaryDate: nextGameDate, isLoading: isLoadingGames } =
    sport === "wnba" ? wnbaGames : nbaGames;
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

    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6 space-y-4">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="w-48 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              <div className="w-64 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-16 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
          <div className="w-32 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
          <div className="w-full h-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
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

  // v2 opt-in: append ?v=2 to the URL to preview the redesigned drilldown while
  // we iterate. Once parity is reached, swap the default and remove this branch.
  const useV2 = searchParams.get("v") === "2";

  if (useV2) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        <PlayerDrilldownV2
          profile={profile}
          allPlayerProfiles={playerProfiles}
          sport={sport}
          onMarketChange={handleMarketChange}
          backHref={backHref}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
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

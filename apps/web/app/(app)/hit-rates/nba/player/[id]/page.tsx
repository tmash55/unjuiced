"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { MobilePlayerDrilldown } from "@/components/hit-rates/mobile/mobile-player-drilldown";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AppPageLayout } from "@/components/layout/app-page-layout";

interface PlayerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const resolvedParams = use(params);
  const playerId = parseInt(resolvedParams.id, 10);
  const searchParams = useSearchParams();
  const router = useRouter();
  const marketParam = searchParams.get("market");
  
  // Detect mobile viewport
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Fetch all profiles for this player (all markets)
  const { rows: playerProfiles, isLoading, error } = useHitRateTable({
    playerId: playerId,
    enabled: !isNaN(playerId),
    limit: 100,
  });

  // Find the profile for the requested market, or default to first available
  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);
  const profile = playerProfiles.find((r) => r.market === selectedMarket) || playerProfiles[0];

  // Update selected market when URL changes
  useEffect(() => {
    if (marketParam && marketParam !== selectedMarket) {
      setSelectedMarket(marketParam);
    }
  }, [marketParam, selectedMarket]);

  // Update URL when market changes
  const handleMarketChange = (newMarket: string) => {
    setSelectedMarket(newMarket);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("market", newMarket);
    router.replace(`/hit-rates/nba/player/${playerId}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  };

  // Handle back navigation
  const handleBack = () => {
    router.push("/hit-rates/nba");
  };

  if (isNaN(playerId)) {
    return (
      <AppPageLayout title="Invalid Player ID">
        <p className="text-muted-foreground mt-4">
          The player ID provided is not valid.
        </p>
        <Link
          href="/hit-rates/nba"
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (isLoading) {
    // Mobile Loading State
    if (isMobile) {
      return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 space-y-4">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
            <div className="w-32 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          
          {/* Player card skeleton */}
          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="w-40 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                <div className="w-24 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            </div>
            
            {/* Market pills skeleton */}
            <div className="flex gap-2 overflow-x-auto">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-20 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse shrink-0" />
              ))}
            </div>
          </div>
          
          {/* Chart skeleton */}
          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4">
            <div className="w-full h-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    // Desktop Loading State
    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Player header skeleton */}
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

        {/* Chart skeleton */}
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
          href="/hit-rates/nba"
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
          href="/hit-rates/nba"
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  // Mobile View - Full screen player drilldown
  if (isMobile) {
    return (
      <MobilePlayerDrilldown
        profile={profile}
        allPlayerProfiles={playerProfiles}
        onBack={handleBack}
        onMarketChange={handleMarketChange}
      />
    );
  }

  // Desktop View
  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
      <PlayerDrilldown
        profile={profile}
        allPlayerProfiles={playerProfiles}
        onMarketChange={handleMarketChange}
        onBack={handleBack}
      />
    </div>
  );
}

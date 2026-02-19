"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { MlbPlayerDrilldown } from "@/components/hit-rates/mlb/mlb-player-drilldown";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { useMlbGames } from "@/hooks/use-mlb-games";

interface MlbPlayerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function MlbPlayerProfilePage({ params }: MlbPlayerProfilePageProps) {
  const resolvedParams = use(params);
  const playerId = parseInt(resolvedParams.id, 10);
  const searchParams = useSearchParams();
  const router = useRouter();
  const marketParam = searchParams.get("market");
  const dateParam = searchParams.get("date");

  const { primaryDate: nextGameDate, isLoading: isLoadingGames } = useMlbGames();
  const effectiveDate = dateParam || nextGameDate || undefined;

  const { rows: playerProfiles, isLoading: isLoadingProfiles, error } = useHitRateTable({
    sport: "mlb",
    playerId,
    date: effectiveDate,
    enabled: !Number.isNaN(playerId) && (!!dateParam || !isLoadingGames),
    limit: 100,
  });

  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);
  const profile = playerProfiles.find((r) => r.market === selectedMarket) || playerProfiles[0];
  const isLoading = isLoadingProfiles || (!dateParam && isLoadingGames);

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
    router.replace(`/hit-rates/mlb/player/${playerId}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  };

  const handleBack = () => {
    router.push("/hit-rates/mlb");
  };

  if (Number.isNaN(playerId)) {
    return (
      <AppPageLayout title="Invalid Player ID">
        <p className="text-muted-foreground mt-4">The player ID provided is not valid.</p>
        <Link href="/hit-rates/mlb" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to MLB Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="h-28 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
        <div className="h-96 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
        <div className="h-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <AppPageLayout title="Error Loading Player">
        <p className="text-red-600 dark:text-red-400 mt-4">{error.message || "Failed to load player profile"}</p>
        <Link href="/hit-rates/mlb" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to MLB Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  if (!profile || playerProfiles.length === 0) {
    return (
      <AppPageLayout title="Player Not Found">
        <p className="text-muted-foreground mt-4">No MLB hit rate data found for player ID: {playerId}</p>
        <Link href="/hit-rates/mlb" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to MLB Hit Rates
        </Link>
      </AppPageLayout>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 lg:px-6 py-4 md:py-6">
      <MlbPlayerDrilldown
        profile={profile}
        allPlayerProfiles={playerProfiles}
        onBack={handleBack}
        onMarketChange={handleMarketChange}
      />
    </div>
  );
}

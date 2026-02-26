"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { getDrilldownSportModule } from "@/components/hit-rates/drilldown/registry";
import type { EnabledDrilldownSport } from "@/components/hit-rates/drilldown/types";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbGames } from "@/hooks/use-mlb-games";
import { useNbaGames } from "@/hooks/use-nba-games";

interface PlayerDrilldownPageShellProps {
  sport: EnabledDrilldownSport;
  playerIdParam: string;
}

export function PlayerDrilldownPageShell({ sport, playerIdParam }: PlayerDrilldownPageShellProps) {
  const playerId = Number.parseInt(playerIdParam, 10);
  const searchParams = useSearchParams();
  const router = useRouter();
  const module = getDrilldownSportModule(sport);
  const marketParam = searchParams.get("market");
  const dateParam = searchParams.get("date");
  const isMobile = useMediaQuery("(max-width: 767px)");

  const nbaGames = useNbaGames(sport === "nba");
  const mlbGames = useMlbGames(sport === "mlb");
  const primaryDate = sport === "mlb" ? mlbGames.primaryDate : nbaGames.primaryDate;
  const isLoadingGames = sport === "mlb" ? mlbGames.isLoading : nbaGames.isLoading;
  const effectiveDate = dateParam || primaryDate || undefined;

  const { rows: playerProfiles, isLoading: isLoadingProfiles, error } = useHitRateTable({
    sport,
    playerId,
    date: effectiveDate,
    enabled: !Number.isNaN(playerId) && (!!dateParam || !isLoadingGames),
    limit: 100,
  });

  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);
  const profile = playerProfiles.find((row) => row.market === selectedMarket) ?? playerProfiles[0];
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
    router.replace(`/hit-rates/${sport}/player/${playerId}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  };

  const handleBack = () => {
    router.push(`/hit-rates/${sport}`);
  };

  if (Number.isNaN(playerId)) {
    return (
      <AppPageLayout title="Invalid Player ID">
        <p className="text-muted-foreground mt-4">The player ID provided is not valid.</p>
        <Link
          href={`/hit-rates/${sport}`}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {module.backLabel}
        </Link>
      </AppPageLayout>
    );
  }

  if (isLoading) {
    return module.renderLoading({ isMobile });
  }

  if (error) {
    return (
      <AppPageLayout title="Error Loading Player">
        <p className="text-red-600 dark:text-red-400 mt-4">{error.message || "Failed to load player profile"}</p>
        <Link
          href={`/hit-rates/${sport}`}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {module.backLabel}
        </Link>
      </AppPageLayout>
    );
  }

  if (!profile || playerProfiles.length === 0) {
    return (
      <AppPageLayout title="Player Not Found">
        <p className="text-muted-foreground mt-4">{module.emptyStateDescription(playerId)}</p>
        <Link
          href={`/hit-rates/${sport}`}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {module.backLabel}
        </Link>
      </AppPageLayout>
    );
  }

  return module.renderContent({
    profile,
    allPlayerProfiles: playerProfiles,
    onBack: handleBack,
    onMarketChange: handleMarketChange,
    isMobile,
  });
}

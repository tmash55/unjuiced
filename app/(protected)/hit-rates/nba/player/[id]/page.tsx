"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import { MobilePlayerDrilldown } from "@/components/hit-rates/mobile/mobile-player-drilldown";
import { GamesSidebar } from "@/components/hit-rates/games-sidebar";
import { useHitRateTable } from "@/hooks/use-hit-rate-table";
import { ToolHeading } from "@/components/common/tool-heading";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

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
    player_id: playerId,
    enabled: !isNaN(playerId),
    limit: 100, // Get all markets
  });

  // Fetch all players for the sidebar (for game navigation)
  const { rows: allPlayers } = useHitRateTable({
    enabled: !isNaN(playerId),
    limit: 10000, // Get all players for sidebar
  });

  // Sidebar collapse state - initialize from URL
  const sidebarParam = searchParams.get("sidebar");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarParam === "collapsed");

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
    const params = new URLSearchParams();
    if (isSidebarCollapsed) {
      params.set("sidebar", "collapsed");
    }
    const query = params.toString();
    router.push(`/hit-rates/nba${query ? `?${query}` : ""}`);
  };

  // Handle sidebar player selection - preserve collapse state
  const handleSidebarPlayerSelect = useCallback((player: any) => {
    const marketToUse = selectedMarket || player.market || "player_points";
    const params = new URLSearchParams({
      market: marketToUse,
      ...(isSidebarCollapsed && { sidebar: 'collapsed' }),
    });
    router.push(`/hit-rates/nba/player/${player.playerId}?${params.toString()}`);
  }, [router, selectedMarket, isSidebarCollapsed]);

  // Get selected game IDs based on current player's game
  const selectedGameIds = useMemo(() => {
    if (!profile?.gameId) return [];
    return [String(profile.gameId)];
  }, [profile]);

  // Handle sidebar toggle - update URL to persist state
  const handleToggleSidebar = useCallback(() => {
    const newCollapsedState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsedState);
    
    // Update URL with new sidebar state
    const newSearchParams = new URLSearchParams(searchParams);
    if (newCollapsedState) {
      newSearchParams.set("sidebar", "collapsed");
    } else {
      newSearchParams.delete("sidebar");
    }
    router.replace(`/hit-rates/nba/player/${playerId}?${newSearchParams.toString()}`, {
      scroll: false,
    });
  }, [isSidebarCollapsed, searchParams, router, playerId]);

  if (isNaN(playerId)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ToolHeading>Invalid Player ID</ToolHeading>
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
      </div>
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
          
          {/* Stats skeleton */}
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-neutral-900 p-3">
                <div className="w-8 h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-1" />
                <div className="w-12 h-5 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Desktop Loading State
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            <div className="w-32 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Layout skeleton with sidebar + drilldown */}
        <div className="flex gap-6 h-[calc(100vh-140px)] overflow-hidden">
          {/* Sidebar skeleton */}
          <div className={cn(
            "shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 space-y-4",
            isSidebarCollapsed ? "w-12" : "w-[20%] min-w-[260px]"
          )}>
            {!isSidebarCollapsed && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-32 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                  <div className="w-16 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                </div>
                {/* Game items */}
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                      <div className="flex-1">
                        <div className="w-full h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-1" />
                        <div className="w-3/4 h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Main content skeleton */}
          <div className="flex-1 min-w-0 overflow-y-auto space-y-6">
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

            {/* Stats grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-4">
                  <div className="w-16 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-2" />
                  <div className="w-24 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Game log skeleton */}
            <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
              <div className="w-32 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-full h-12 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ToolHeading>Error Loading Player</ToolHeading>
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
      </div>
    );
  }

  if (!profile || playerProfiles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ToolHeading>Player Not Found</ToolHeading>
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
      </div>
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
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Hit Rates</span>
        </button>
      </div>

      {/* Sidebar + Player Drilldown Layout */}
      <div className="flex gap-6 h-[calc(100vh-140px)] overflow-hidden">
        {/* Games Sidebar */}
        <GamesSidebar
          selectedGameIds={selectedGameIds}
          onToggleGame={() => {}} // No-op since we're viewing a specific player
          onSelectAll={() => {}}
          onSelectTodaysGames={() => {}}
          onClearAll={() => {}}
          selectedPlayer={profile}
          gamePlayers={allPlayers}
          onPlayerSelect={handleSidebarPlayerSelect}
          hideNoOdds={false}
          idsWithOdds={new Set()}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* Player Drilldown */}
        <div className={cn(
          "h-full flex-1 min-w-0 overflow-y-auto"
        )}>
          <PlayerDrilldown
            profile={profile}
            allPlayerProfiles={playerProfiles}
            onMarketChange={handleMarketChange}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}


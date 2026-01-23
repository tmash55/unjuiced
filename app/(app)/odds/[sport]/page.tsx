"use client";

import { use, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OddsTable } from "@/components/odds-screen/tables/odds-table";
import { OddsTableSkeleton } from "@/components/odds-screen/tables/odds-table-skeleton";
import { OddsFilters } from "@/components/odds-screen/filters/odds-filters";
import { useOddsPreferences } from "@/context/preferences-context";
import { useOddsUtility } from "../odds-utility-context";
import { fetchOddsWithNewAPI } from "@/lib/api-adapters/props-to-odds";
import { useQuery } from "@tanstack/react-query";
import { getDefaultMarket } from "@/lib/data/markets";

interface OddsPageProps {
  params: Promise<{ sport: string }>;
}

export default function OddsPage({ params }: OddsPageProps) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { preferences } = useOddsPreferences();
  
  // Get search params or defaults
  const type = (searchParams.get("type") || "game") as "game" | "player";
  const market = searchParams.get("market") || getDefaultMarket(sport);
  const scope = (searchParams.get("scope") || "pregame") as "pregame" | "live";
  
  // Connect to utility context for search and filters
  const utility = useOddsUtility();
  
  // Fetch odds data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["odds", sport, market, scope, type],
    queryFn: async () => {
      const result = await fetchOddsWithNewAPI({
        sport,
        market,
        scope,
        type,
        limit: 300,
      });
      return result.data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  
  // Extract setGames to avoid dependency on entire utility object
  const setGames = utility?.setGames;
  
  // Register games when data changes
  useEffect(() => {
    if (setGames && data) {
      // Extract unique games from data
      const games = Array.from(
        new Map(
          data
            .filter(item => item.event?.id)
            .map(item => [
              item.event.id,
              {
                id: item.event.id || "",
                eventId: item.event.id || "",
                homeTeam: item.event.homeTeam || "",
                awayTeam: item.event.awayTeam || "",
                startTime: item.event.startTime || "",
              },
            ])
        ).values()
      );
      setGames(games);
    }
  }, [data, setGames]);
  
  // Filter by search query
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!utility?.searchQuery) return data;
    
    const query = utility.searchQuery.toLowerCase();
    return data.filter(item => {
      const player = (item.entity?.name || "").toLowerCase();
      const homeTeam = (item.event?.homeTeam || "").toLowerCase();
      const awayTeam = (item.event?.awayTeam || "").toLowerCase();
      return player.includes(query) || homeTeam.includes(query) || awayTeam.includes(query);
    });
  }, [data, utility?.searchQuery]);
  
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 pb-6">
        <OddsTableSkeleton rows={12} sportsbookCount={8} />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="px-4 sm:px-6 pb-6">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-6 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">
            Failed to load odds data
          </p>
          <p className="text-sm text-red-500 dark:text-red-400/70 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="px-4 sm:px-6 pb-6">
      <OddsTable
        data={filteredData}
        loading={false}
        sport={sport}
        type={type}
        market={market}
        scope={scope}
        searchQuery={utility?.searchQuery}
        tableView={preferences.tableView}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { useHasEliteAccess } from "@/hooks/use-entitlements";
import { StatsBar } from "@/components/sharp-signals/stats-bar";
import { Filters } from "@/components/sharp-signals/filters";
import { PickCard } from "@/components/sharp-signals/pick-card";
import { PickDetailPanel } from "@/components/sharp-signals/pick-detail-panel";
import { MarketCard } from "@/components/sharp-signals/market-card";
import { MarketDetailPanel } from "@/components/sharp-signals/market-detail-panel";
import { cn } from "@/lib/utils";
import { OddsFormat } from "@/lib/odds";
import { WhaleSignal } from "@/lib/polymarket/types";
import Link from "next/link";
import useSWR from "swr";
// import { Button } from "@/components/ui/button";

type Tab = "picks" | "markets";

interface GameData {
  condition_id: string
  market_title: string
  sport: string | null
  market_type: string | null
  game_date: string | null
  game_start_time: string | null
  resolved: boolean
  consensus_outcome: string
  consensus_result: "win" | "loss" | "pending"
  flow_pct: number
  confidence: "strong" | "lean" | "split"
  total_dollars: number
  total_bets: number
  total_sharps: number
  total_whales: number
  outcomes: Array<{
    outcome: string
    total_dollars: number
    sharp_count: number
    whale_count: number
    total_bets: number
    avg_entry_price: number
    best_book: string | null
    best_book_price: string | null
    best_book_decimal: number | null
    wins: number
    losses: number
    bets: Array<{
      anon_id: string
      tier: string
      bet_size: number
      entry_price: number
      american_odds: number | null
      result: string | null
      quality_score: number | null
      created_at: string
    }>
  }>
  first_signal_at: string
  last_signal_at: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SharpSignalsPage() {
  const { hasAccess, isLoading } = useHasEliteAccess();
  const [tab, setTab] = useState<Tab>("picks");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedPick, setSelectedPick] = useState<WhaleSignal | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<GameData | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("american");

  // Fetch picks data
  const { data: picksData, error: picksError, isLoading: picksLoading } = useSWR(
    hasAccess ? `/api/polymarket/feed?limit=50&sort=score${selectedSport ? `&sport=${selectedSport}` : ""}` : null,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  // Fetch markets/games data
  const { data: marketsData, error: marketsError, isLoading: marketsLoading } = useSWR(
    hasAccess ? `/api/polymarket/games?limit=20${selectedSport ? `&sport=${selectedSport}` : ""}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <AppPageLayout title="Sharp Signals" subtitle="Real-time prediction market insider tracking">
        <div className="flex items-center justify-center py-20 text-neutral-500">Loading...</div>
      </AppPageLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppPageLayout title="Sharp Signals" subtitle="Real-time prediction market insider tracking">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-neutral-200 mb-2">Elite Feature</h2>
          <p className="text-neutral-500 mb-6 max-w-md">
            Sharp Signals gives you real-time tracking of prediction market insiders.
            Upgrade to Elite to unlock this feature.
          </p>
          <Link
            href="/pricing"
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors"
          >
            Upgrade to Elite
          </Link>
        </div>
      </AppPageLayout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "picks", label: "Picks" },
    { key: "markets", label: "Markets" },
  ];

  const picks = picksData?.signals || [];
  const markets = marketsData?.games || [];

  // Auto-select first item when data loads or tab changes
  if (tab === "picks" && picks.length > 0 && !selectedPick) {
    setSelectedPick(picks[0]);
  }
  if (tab === "markets" && markets.length > 0 && !selectedMarket) {
    setSelectedMarket(markets[0]);
  }

  // Convert markets data to MarketCard format
  const convertToMarketCard = (game: GameData) => {
    const mainOutcome = game.outcomes[0]
    const secondOutcome = game.outcomes[1]
    
    if (!mainOutcome || !secondOutcome) return null

    return {
      id: game.condition_id,
      sport: game.sport || "N/A",
      league: "", // Not in our data structure
      matchup: game.market_title,
      betType: game.market_type || "Unknown",
      time: game.game_start_time || "TBD",
      gameStartTime: game.game_start_time,
      sideA: {
        name: mainOutcome.outcome,
        price: mainOutcome.avg_entry_price * 100, // Convert to cents
        insiderCount: mainOutcome.total_bets,
        totalWagered: mainOutcome.total_dollars,
        percentOfMoney: game.flow_pct
      },
      sideB: {
        name: secondOutcome.outcome,
        price: secondOutcome.avg_entry_price * 100,
        insiderCount: secondOutcome.total_bets,
        totalWagered: secondOutcome.total_dollars,
        percentOfMoney: 100 - game.flow_pct
      },
      totalVolume: game.total_dollars,
      wagerCount: game.total_bets
    }
  }

  const marketCards = markets.map(convertToMarketCard).filter(Boolean)

  return (
    <AppPageLayout
      title="Sharp Signals"
      subtitle="Real-time prediction market insider tracking"
      headerActions={
        <div className="flex items-center gap-4">
          {/* Odds Format Toggle */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-0.5">
            <button
              className={cn(
                "h-7 px-2 text-xs rounded transition-colors",
                oddsFormat === "american" 
                  ? "bg-sky-500 text-white" 
                  : "text-neutral-400 hover:text-neutral-200"
              )}
              onClick={() => setOddsFormat("american")}
            >
              American
            </button>
            <button
              className={cn(
                "h-7 px-2 text-xs rounded transition-colors",
                oddsFormat === "cents"
                  ? "bg-sky-500 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
              onClick={() => setOddsFormat("cents")}
            >
              Implied %
            </button>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
        </div>
      }
      statsBar={<StatsBar />}
      contextBar={
        <div className="space-y-0">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-neutral-800 px-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  // Clear selections when switching tabs
                  if (t.key === "picks") {
                    setSelectedMarket(null);
                    if (picks.length > 0) setSelectedPick(picks[0]);
                  } else {
                    setSelectedPick(null);
                    if (markets.length > 0) setSelectedMarket(markets[0]);
                  }
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  tab === t.key
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <Filters
            selectedSport={selectedSport}
            onSportChange={setSelectedSport}
            counts={{
              total: tab === "picks" ? picks.length : markets.length,
              nba: tab === "picks" 
                ? picks.filter((p: WhaleSignal) => p.sport === "nba").length
                : markets.filter((m: GameData) => m.sport === "nba").length,
              nfl: tab === "picks"
                ? picks.filter((p: WhaleSignal) => p.sport === "nfl").length
                : markets.filter((m: GameData) => m.sport === "nfl").length,
              soccer: tab === "picks"
                ? picks.filter((p: WhaleSignal) => p.sport === "soccer").length
                : markets.filter((m: GameData) => m.sport === "soccer").length,
            }}
          />
        </div>
      }
    >
      <div className="flex h-full gap-6">
        {/* Left Panel - List (55% width) */}
        <div className="flex-1 min-w-0 space-y-4 overflow-y-auto max-h-screen">
          {tab === "picks" && (
            <>
              {picksLoading && <div className="text-center text-neutral-500 py-8">Loading picks...</div>}
              {picksError && <div className="text-center text-red-400 py-8">Failed to load picks</div>}
              {picks.length === 0 && !picksLoading && (
                <div className="text-center text-neutral-500 py-8">No picks found</div>
              )}
              {picks.map((pick: WhaleSignal) => (
                <PickCard
                  key={pick.id}
                  pick={pick}
                  isSelected={selectedPick?.id === pick.id}
                  onSelect={setSelectedPick}
                  oddsFormat={oddsFormat}
                />
              ))}
            </>
          )}

          {tab === "markets" && (
            <>
              {marketsLoading && <div className="text-center text-neutral-500 py-8">Loading markets...</div>}
              {marketsError && <div className="text-center text-red-400 py-8">Failed to load markets</div>}
              {marketCards.length === 0 && !marketsLoading && (
                <div className="text-center text-neutral-500 py-8">No markets found</div>
              )}
              {marketCards.map((market: any) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  isSelected={selectedMarket?.condition_id === market.id}
                  onSelect={(market: any) => {
                    const gameData = markets.find((g: GameData) => g.condition_id === market.id)
                    if (gameData) setSelectedMarket(gameData)
                  }}
                  oddsFormat={oddsFormat}
                />
              ))}
            </>
          )}
        </div>

        {/* Right Panel - Detail (45% width) */}
        <div className="w-2/5 border-l border-neutral-800 pl-6">
          {tab === "picks" && selectedPick && (
            <PickDetailPanel pick={selectedPick} oddsFormat={oddsFormat} />
          )}
          
          {tab === "markets" && selectedMarket && (
            <MarketDetailPanel game={selectedMarket} oddsFormat={oddsFormat} />
          )}
          
          {!selectedPick && !selectedMarket && (
            <div className="flex h-full items-center justify-center text-neutral-500">
              Select a {tab === "picks" ? "pick" : "market"} to view details
            </div>
          )}
        </div>
      </div>
    </AppPageLayout>
  );
}
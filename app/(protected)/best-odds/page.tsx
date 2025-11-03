"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchBestOdds } from "@/lib/best-odds-client";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { BestOddsTable } from "@/components/best-odds/best-odds-table";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw } from "lucide-react";

export default function BestOddsPage() {
  const [deals, setDeals] = useState<BestOddsDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [scope, setScope] = useState<'all' | 'pregame' | 'live'>('pregame');
  const [sortBy, setSortBy] = useState<'improvement' | 'odds'>('improvement');
  const [sportFilter, setSportFilter] = useState<'all' | 'nfl' | 'nba' | 'nhl'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [maxOdds, setMaxOdds] = useState<number | undefined>(undefined);
  const [minImprovement, setMinImprovement] = useState<number>(5);

  const loadDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchBestOdds({
        scope,
        sortBy,
        limit: 200,
        maxOdds: maxOdds,
        minImprovement: minImprovement
      });
      
      setDeals(response.deals);
    } catch (err) {
      console.error('[BestOdds] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [scope, sortBy, maxOdds, minImprovement]);

  const refresh = useCallback(async () => {
    await loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  // Filter by sport and search query client-side
  const filteredDeals = deals
    .filter(d => sportFilter === 'all' || d.sport === sportFilter)
    .filter(d => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        d.playerName?.toLowerCase().includes(query) ||
        d.team?.toLowerCase().includes(query) ||
        d.mkt?.toLowerCase().includes(query) ||
        d.homeTeam?.toLowerCase().includes(query) ||
        d.awayTeam?.toLowerCase().includes(query)
      );
    });

  const stats = {
    total: filteredDeals.length,
    nfl: deals.filter(d => d.sport === 'nfl').length,
    nba: deals.filter(d => d.sport === 'nba').length,
    nhl: deals.filter(d => d.sport === 'nhl').length,
    avgImprovement: filteredDeals.length > 0
      ? (filteredDeals.reduce((sum, d) => sum + Number(d.priceImprovement || 0), 0) / filteredDeals.length).toFixed(1)
      : '0'
  };

  return (
    <div className="container mx-auto px-4 py-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6">
        <ToolHeading>Best Odds</ToolHeading>
        <ToolSubheading>
          Find the best prices across sportsbooks • {stats.total} opportunities • {stats.avgImprovement}% avg improvement
        </ToolSubheading>
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
        <div className="sticky top-14 z-30">
          <FiltersBar useDots={true}>
            <FiltersBarSection align="left">
              {/* Search Input */}
              <div className="relative flex-1 md:flex-initial">
                <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search player or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 flex-shrink pl-10"
                />
              </div>

              {/* Sport Filter */}
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value as any)}
                className="h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="all">All Sports</option>
                <option value="nfl">NFL ({stats.nfl})</option>
                <option value="nba">NBA ({stats.nba})</option>
                <option value="nhl">NHL ({stats.nhl})</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="improvement">🎯 Best Value</option>
                <option value="odds">💰 Short Odds</option>
              </select>

              {/* Min Improvement */}
              <select
                value={minImprovement}
                onChange={(e) => setMinImprovement(parseFloat(e.target.value))}
                className="h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="0">Min Improvement</option>
                <option value="1">1%+</option>
                <option value="2">2%+</option>
                <option value="5">5%+</option>
                <option value="10">10%+</option>
                <option value="20">20%+</option>
              </select>

              {/* Max Odds */}
              {sortBy === 'odds' && (
                <select
                  value={maxOdds || ''}
                  onChange={(e) => setMaxOdds(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Max Odds</option>
                  <option value="-200">-200 or better</option>
                  <option value="-150">-150 or better</option>
                  <option value="100">Even or better</option>
                  <option value="150">+150 or better</option>
                  <option value="200">+200 or better</option>
                </select>
              )}
            </FiltersBarSection>

            <FiltersBarSection align="right">
              {/* Refresh Button */}
              <button
                onClick={async () => {
                  try { setRefreshing(true); await refresh(); } finally { setRefreshing(false); }
                }}
                disabled={refreshing}
                className="refresh-btn flex items-center justify-center h-9 w-9 rounded-lg text-sm font-medium transition-all"
                title="Refresh opportunities"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </button>
            </FiltersBarSection>
          </FiltersBar>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200">
          <p className="font-medium">Error loading best odds</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Table */}
      <BestOddsTable deals={filteredDeals} loading={loading} />
    </div>
  );
}


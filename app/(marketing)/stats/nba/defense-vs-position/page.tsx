'use client';

import { useState } from 'react';
import { Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { DvpFilters, DvpViewMode, Position, TrendCompareBaseline, TrendStat } from '@/components/nba/dvp-table/dvp-filters';
import { MobileDvpFilters } from '@/components/nba/dvp-table/mobile-dvp-filters';
import { DvpTable } from '@/components/nba/dvp-table/dvp-table';
import { useDvpRankings, DvpSampleSize } from '@/hooks/use-dvp-rankings';
import { cn } from '@/lib/utils';

export type DvpDisplayMode = "values" | "ranks";

// Stat labels for display
const STAT_LABELS: Record<TrendStat, string> = {
  pts: "Points",
  reb: "Rebounds",
  ast: "Assists",
  pra: "PRA",
  fg3m: "3PM",
  stl: "Steals",
  blk: "Blocks",
  tov: "Turnovers",
  pr: "P+R",
  pa: "P+A",
  ra: "R+A",
  bs: "BLK+STL",
  fga: "FGA",
  fg3a: "3PA",
  fta: "FTA",
  minutes: "Minutes",
};

export default function DefenseVsPositionPage() {
  const [selectedPosition, setSelectedPosition] = useState<Position>('PG');
  const [viewMode, setViewMode] = useState<DvpViewMode>('basic');
  const [sampleSize, setSampleSize] = useState<DvpSampleSize>('season');
  const [displayMode, setDisplayMode] = useState<DvpDisplayMode>('values');
  const [trendBaseline, setTrendBaseline] = useState<TrendCompareBaseline>('season');
  const [trendStat, setTrendStat] = useState<TrendStat>('pts');
  const [season, setSeason] = useState('2025-26');

  // Fetch data using our new hook
  const { teams, isLoading } = useDvpRankings({
    position: selectedPosition,
    season: season,
  });

  // Handle team click (for future drawer)
  const handleTeamClick = (teamId: number) => {
    console.log("Clicked team:", teamId);
    // TODO: Open insights drawer
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Desktop Header */}
      <div className="hidden md:block border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold tracking-tight">
                  Defense vs Position
                </h1>
              </div>
              <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">
                NBA Team Defensive Rankings by Position • Find the best matchups
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">
              Defense vs Position
            </h1>
          </div>
        </div>
      </div>

      {/* Mobile Filters - Fixed at top */}
      <div className="md:hidden sticky top-14 z-40 shadow-sm">
        <MobileDvpFilters
          position={selectedPosition}
          onPositionChange={setSelectedPosition}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sampleSize={sampleSize}
          onSampleSizeChange={setSampleSize}
          trendStat={trendStat}
          onTrendStatChange={setTrendStat}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      </div>

      {/* Desktop Main Content */}
      <div className="hidden md:block container mx-auto px-4 py-6">
        {/* Main Table Section */}
        <div className="flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          {/* Desktop Filters Bar */}
          <DvpFilters 
            position={selectedPosition}
            onPositionChange={setSelectedPosition}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sampleSize={sampleSize}
            onSampleSizeChange={setSampleSize}
            trendBaseline={trendBaseline}
            onTrendBaselineChange={setTrendBaseline}
            trendStat={trendStat}
            onTrendStatChange={setTrendStat}
            season={season}
            onSeasonChange={setSeason}
          />
          
          {/* Legend & Display Mode Bar - only for non-trends views */}
          {viewMode !== "trends" && (
            <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">Tough <span className="text-neutral-400 dark:text-neutral-500">(1-10)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-neutral-400" />
                    <span className="text-neutral-600 dark:text-neutral-400">Neutral <span className="text-neutral-400 dark:text-neutral-500">(11-20)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">Good <span className="text-neutral-400 dark:text-neutral-500">(21-30)</span></span>
                  </div>
                </div>

                {/* Display Mode Toggle */}
                <div className="flex items-center gap-1 bg-neutral-200 dark:bg-neutral-700 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("values")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                      displayMode === "values"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                    )}
                  >
                    Averages
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("ranks")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                      displayMode === "ranks"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                    )}
                  >
                    Ranks
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trends Legend Bar */}
          {viewMode === "trends" && (
            <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">Tough <span className="text-neutral-400 dark:text-neutral-500">(1-10)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-neutral-400" />
                    <span className="text-neutral-600 dark:text-neutral-400">Neutral <span className="text-neutral-400 dark:text-neutral-500">(11-20)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">Good <span className="text-neutral-400 dark:text-neutral-500">(21-30)</span></span>
                  </div>
                  <span className="text-neutral-300 dark:text-neutral-600">|</span>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">+Δ Worse</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3 text-red-500" />
                    <span className="text-neutral-600 dark:text-neutral-400">-Δ Better</span>
                  </div>
                </div>

                {/* Display Mode Toggle for Trends */}
                <div className="flex items-center gap-1 bg-neutral-200 dark:bg-neutral-700 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("values")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                      displayMode === "values"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                    )}
                  >
                    Averages
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("ranks")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                      displayMode === "ranks"
                        ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                    )}
                  >
                    Ranks
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Desktop Table Content */}
          <DvpTable 
            data={teams}
            viewMode={viewMode}
            sampleSize={sampleSize}
            displayMode={displayMode}
            trendBaseline={trendBaseline}
            trendStat={trendStat}
            isLoading={isLoading}
            onTeamClick={handleTeamClick}
          />
        </div>
      </div>

      {/* Mobile Table Content */}
      <div className="md:hidden">
        <div className="bg-white dark:bg-neutral-900">
          <DvpTable 
            data={teams}
            viewMode={viewMode}
            sampleSize={sampleSize}
            displayMode={displayMode}
            trendBaseline={trendBaseline}
            trendStat={trendStat}
            isLoading={isLoading}
            onTeamClick={handleTeamClick}
          />
        </div>
      </div>
    </div>
  );
}

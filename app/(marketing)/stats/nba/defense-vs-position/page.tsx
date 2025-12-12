'use client';

import { useState } from 'react';
import { Shield, Target, TrendingUp, Info } from 'lucide-react';
import { DvpFilters, DvpViewMode, Position } from '@/components/nba/dvp-table/dvp-filters';
import { DvpTable } from '@/components/nba/dvp-table/dvp-table';
import { useDvpRankings } from '@/hooks/use-dvp-rankings';

export default function DefenseVsPositionPage() {
  const [selectedPosition, setSelectedPosition] = useState<Position>('PG');
  const [viewMode, setViewMode] = useState<DvpViewMode>('basic');
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
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Top Section: Insights & Info Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Today's Best Matchups */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden h-full">
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-neutral-50/50 dark:bg-neutral-900">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-brand" />
                Today's Best Matchups
              </h2>
            </div>
            <div className="p-5 flex items-center justify-center min-h-[140px]">
              <div className="text-center text-neutral-400 dark:text-neutral-500">
                <p className="font-medium text-sm">No games scheduled today</p>
                <p className="text-xs mt-1">Check back later for matchups</p>
              </div>
            </div>
          </div>

          {/* Legend / Info */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden h-full">
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-neutral-50/50 dark:bg-neutral-900">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-neutral-500" />
                How to Read
              </h2>
            </div>
            <div className="p-4 grid gap-2">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">Good Matchup (21-30)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Weak Defense</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">Allows MORE stats than average. Great for Overs.</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">Tough Matchup (1-10)</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">Strong Defense</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">Allows LESS stats than average. Risky for Overs.</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="flex items-center justify-center w-2 h-2">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">Trending Up</span>
                    <span className="text-[10px] text-neutral-500 font-medium bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">L5 vs Season</span>
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">Defense is getting WORSE over last 5 games (allowing more).</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Section */}
        <div className="flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
          {/* Filters Bar */}
          <DvpFilters 
            position={selectedPosition}
            onPositionChange={setSelectedPosition}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            season={season}
            onSeasonChange={setSeason}
          />
          
          {/* Table Content */}
          <DvpTable 
            data={teams}
            viewMode={viewMode}
            isLoading={isLoading}
            onTeamClick={handleTeamClick}
          />
        </div>
      </div>
    </div>
  );
}

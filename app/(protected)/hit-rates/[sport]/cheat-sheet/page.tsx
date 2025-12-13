"use client";

import { use, useState, useMemo } from "react";
import { notFound } from "next/navigation";
import { useCheatSheet, useCheatSheetOdds, CheatSheetRow } from "@/hooks/use-cheat-sheet";
import { 
  CheatSheetFilterState,
  DEFAULT_CHEAT_SHEET_FILTERS,
  getDateFilterDates
} from "@/components/cheat-sheet/cheat-sheet-filters";
import { CheatSheetTable } from "@/components/cheat-sheet/cheat-sheet-table";
import { CheatSheetFilterBar } from "@/components/cheat-sheet/cheat-sheet-filter-bar";
import { ConfidenceGlossary } from "@/components/cheat-sheet/confidence-glossary";

const SUPPORTED_SPORTS = ["nba"] as const;

export default function CheatSheetPage({ params }: { params: Promise<{ sport: string }> }) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase();
  
  if (!SUPPORTED_SPORTS.includes(sport as typeof SUPPORTED_SPORTS[number])) {
    notFound();
  }

  const [filters, setFilters] = useState<CheatSheetFilterState>(DEFAULT_CHEAT_SHEET_FILTERS);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Fetch data with API filters
  const { data, isLoading, error } = useCheatSheet({
    timeWindow: filters.timeWindow,
    minHitRate: filters.minHitRate,
    oddsFloor: filters.oddsFloor,
    oddsCeiling: filters.oddsCeiling,
    markets: filters.markets.length > 0 ? filters.markets : undefined,
    dates: getDateFilterDates(filters.dateFilter),
  });

  // Apply client-side filters
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    
    let rows = data.rows;

    // Matchup filter
    if (filters.matchupFilter !== "all") {
      rows = rows.filter((row) => row.matchupQuality === filters.matchupFilter);
    }

    // Confidence filter
    if (filters.confidenceFilter.length > 0) {
      rows = rows.filter((row) => filters.confidenceFilter.includes(row.confidenceGrade));
    }

    // Trend filter
    if (filters.trendFilter.length > 0) {
      rows = rows.filter((row) => filters.trendFilter.includes(row.trend));
    }

    // Hide injured
    if (filters.hideInjured) {
      rows = rows.filter((row) => !row.injuryStatus || row.injuryStatus === "active");
    }

    // Hide B2B
    if (filters.hideB2B) {
      rows = rows.filter((row) => !row.isBackToBack);
    }

    return rows;
  }, [data?.rows, filters]);

  // Fetch live odds from Redis for each row
  const { data: oddsData, isLoading: isLoadingOdds } = useCheatSheetOdds(filteredRows);

  const handleRowClick = (row: CheatSheetRow) => {
    // TODO: Open player detail modal or navigate to hit rates drilldown
    console.log("Clicked row:", row);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          {/* Filter Bar - Inside Card */}
          <CheatSheetFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredRows.length}
            onGlossaryOpen={() => setIsGlossaryOpen(true)}
          />

          {/* Table with Scroll Area */}
          {error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <p className="text-lg font-medium">Failed to load data</p>
              <p className="text-sm mt-1">Please try again later</p>
            </div>
          ) : (
            <CheatSheetTable 
              rows={filteredRows}
              isLoading={isLoading}
              oddsData={oddsData}
              isLoadingOdds={isLoadingOdds}
              timeWindow={filters.timeWindow}
              onRowClick={handleRowClick}
              onGlossaryOpen={() => setIsGlossaryOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Glossary Modal */}
      <ConfidenceGlossary 
        isOpen={isGlossaryOpen} 
        onClose={() => setIsGlossaryOpen(false)} 
      />
    </div>
  );
}

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
import { MobileConfidenceGlossary } from "@/components/cheat-sheet/mobile/mobile-confidence-glossary";
import { CheatSheetNav } from "@/components/cheat-sheet/cheat-sheet-nav";
import { MobileCheatSheet } from "@/components/cheat-sheet/mobile/mobile-cheat-sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

const SUPPORTED_SPORTS = ["nba"] as const;
const SUPPORTED_SHEETS = ["hit-rates", "alt-hit-matrix", "injury-impact"] as const;

type SupportedSport = typeof SUPPORTED_SPORTS[number];
type SupportedSheet = typeof SUPPORTED_SHEETS[number];

// Sheet display names and descriptions
const SHEET_INFO: Record<SupportedSheet, { title: string; description: string }> = {
  "hit-rates": {
    title: "Hit Rate Cheat Sheet",
    description: "High-confidence props ranked by our scoring system",
  },
  "alt-hit-matrix": {
    title: "Alt Hit Matrix",
    description: "Find the best alternate lines with highest hit rates",
  },
  "injury-impact": {
    title: "Injury Impact",
    description: "Props affected by injuries and lineup changes",
  },
};

export default function CheatSheetPage({ 
  params 
}: { 
  params: Promise<{ sport: string; sheet: string }> 
}) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase() as SupportedSport;
  const sheet = resolvedParams.sheet?.toLowerCase() as SupportedSheet;
  
  // Validate sport
  if (!SUPPORTED_SPORTS.includes(sport)) {
    notFound();
  }

  // Validate sheet type
  if (!SUPPORTED_SHEETS.includes(sheet)) {
    notFound();
  }

  const sheetInfo = SHEET_INFO[sheet];

  // For now, only hit-rates is implemented
  if (sheet !== "hit-rates") {
    return <ComingSoonSheet sport={sport} sheet={sheet} sheetInfo={sheetInfo} />;
  }

  return <HitRatesCheatSheet sport={sport} sheet={sheet} />;
}

function ComingSoonSheet({ 
  sport, 
  sheet, 
  sheetInfo 
}: { 
  sport: SupportedSport; 
  sheet: SupportedSheet; 
  sheetInfo: { title: string; description: string } 
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Tab Navigation */}
      <CheatSheetNav sport={sport} currentSheet={sheet} isMobile={isMobile} />
      
      <div className={isMobile ? "px-4 py-6" : "container mx-auto px-4 py-6"}>
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <p className="text-lg font-bold text-neutral-900 dark:text-white">{sheetInfo.title}</p>
            <p className="text-sm mt-1 text-center px-4">{sheetInfo.description}</p>
            <span className="mt-4 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HitRatesCheatSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
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

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        <MobileCheatSheet
          rows={filteredRows}
          isLoading={isLoading}
          oddsData={oddsData}
          filters={filters}
          onFiltersChange={setFilters}
          onGlossaryOpen={() => setIsGlossaryOpen(true)}
          onRowClick={handleRowClick}
          sport={sport}
          currentSheet={sheet}
        />

        {/* Mobile Glossary Bottom Sheet */}
        <MobileConfidenceGlossary 
          isOpen={isGlossaryOpen} 
          onClose={() => setIsGlossaryOpen(false)} 
        />
      </>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Tab Navigation */}
      <CheatSheetNav sport={sport} currentSheet={sheet} />
      
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


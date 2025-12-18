"use client";

import { use, useState, useMemo } from "react";
import { notFound } from "next/navigation";
import { useCheatSheet, useCheatSheetOdds, CheatSheetRow } from "@/hooks/use-cheat-sheet";
import { useInjuryImpactCheatsheet, INJURY_IMPACT_MARKETS } from "@/hooks/use-injury-impact";
import { 
  CheatSheetFilterState,
  DEFAULT_CHEAT_SHEET_FILTERS,
  getDateFilterDates,
  getSmartDefaultDateFilter
} from "@/components/cheat-sheet/cheat-sheet-filters";
import { CheatSheetTable } from "@/components/cheat-sheet/cheat-sheet-table";
import { CheatSheetFilterBar } from "@/components/cheat-sheet/cheat-sheet-filter-bar";
import { ConfidenceGlossary } from "@/components/cheat-sheet/confidence-glossary";
import { MobileConfidenceGlossary } from "@/components/cheat-sheet/mobile/mobile-confidence-glossary";
import { CheatSheetNav } from "@/components/cheat-sheet/cheat-sheet-nav";
import { MobileCheatSheet } from "@/components/cheat-sheet/mobile/mobile-cheat-sheet";
import { AltHitMatrix } from "@/components/cheat-sheet/alt-hit-matrix";
import { InjuryImpactTable } from "@/components/cheat-sheet/injury-impact-table";
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

  // Route to appropriate sheet component
  if (sheet === "hit-rates") {
    return <HitRatesCheatSheet sport={sport} sheet={sheet} />;
  }
  
  if (sheet === "alt-hit-matrix") {
    return <AltHitMatrixSheet sport={sport} sheet={sheet} />;
  }
  
  if (sheet === "injury-impact") {
    return <InjuryImpactSheet sport={sport} sheet={sheet} />;
  }

  // Other sheets coming soon
  return <ComingSoonSheet sport={sport} sheet={sheet} sheetInfo={sheetInfo} />;
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

function AltHitMatrixSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Tab Navigation */}
      <CheatSheetNav sport={sport} currentSheet={sheet} isMobile={isMobile} />
      
      <div className={isMobile ? "px-2 py-4" : "container mx-auto px-4 py-6"}>
        <AltHitMatrix sport={sport} />
      </div>
    </div>
  );
}

function InjuryImpactSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  // Use smart default: "tomorrow" if all today's games have started (after 8pm ET)
  const [filters, setFilters] = useState<CheatSheetFilterState>(() => ({
    ...DEFAULT_CHEAT_SHEET_FILTERS,
    dateFilter: getSmartDefaultDateFilter(),
    markets: ["player_points"], // Default to Points for injury impact
  }));
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Fetch injury impact data
  const { rows, isLoading, error } = useInjuryImpactCheatsheet({
    dates: getDateFilterDates(filters.dateFilter),
    markets: filters.markets.length > 0 ? filters.markets : undefined,
    minGames: 2,
    minTeammateMinutes: 15,
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Tab Navigation */}
      <CheatSheetNav sport={sport} currentSheet={sheet} isMobile={isMobile} />
      
      <div className={isMobile ? "px-2 py-4" : "container mx-auto px-4 py-6"}>
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          {/* Market Filter Bar */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-2">
                Market:
              </span>
              {INJURY_IMPACT_MARKETS.slice(0, 7).map((market) => {
                const isSelected = filters.markets.includes(market.value);
                return (
                  <button
                    key={market.value}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      markets: [market.value], // Single select for injury impact
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-blue-500 text-white"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {market.label}
                  </button>
                );
              })}
              
              {/* Date filter */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-neutral-500">Date:</span>
                <select
                  value={filters.dateFilter}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateFilter: e.target.value as "today" | "tomorrow" | "all",
                  }))}
                  className="px-2 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-none"
                >
                  <option value="today">Today</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </div>
          
          <InjuryImpactTable
            rows={rows}
            isLoading={isLoading}
            filters={filters}
            onFiltersChange={setFilters}
            onGlossaryOpen={() => setIsGlossaryOpen(true)}
            sport={sport}
          />
        </div>
      </div>
    </div>
  );
}

function HitRatesCheatSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  // Use smart default: "tomorrow" if all today's games have started (after 8pm ET)
  const [filters, setFilters] = useState<CheatSheetFilterState>(() => ({
    ...DEFAULT_CHEAT_SHEET_FILTERS,
    dateFilter: getSmartDefaultDateFilter(),
  }));
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


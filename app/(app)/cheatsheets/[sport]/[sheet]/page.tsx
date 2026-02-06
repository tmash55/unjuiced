"use client";

import { use, useState, useMemo, useRef, useEffect } from "react";
import { notFound } from "next/navigation";
import { useCheatSheet, CheatSheetRow } from "@/hooks/use-cheat-sheet";
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
import { MobileCheatSheet } from "@/components/cheat-sheet/mobile/mobile-cheat-sheet";
import { MobileInjuryImpact } from "@/components/cheat-sheet/mobile/mobile-injury-impact";
import { AltHitMatrix } from "@/components/cheat-sheet/alt-hit-matrix";
import { HitRateMatrix } from "@/components/hit-rate-matrix";
import { InjuryImpactTable } from "@/components/cheat-sheet/injury-impact-table";
import { InjuryImpactGlossary } from "@/components/cheat-sheet/injury-impact-glossary";
import { DvpFilters, DvpViewMode, Position, TrendCompareBaseline, TrendStat } from "@/components/nba/dvp-table/dvp-filters";
import { DvpTable } from "@/components/nba/dvp-table/dvp-table";
import { useDvpRankings, DvpSampleSize } from "@/hooks/use-dvp-rankings";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import { Lock, ArrowRight, ChevronDown, HelpCircle, LayoutGrid, BarChart3, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Gating constants
const FREE_USER_MAX_ROWS = 7;
const UPGRADE_URL = "/pricing";

// Upgrade CTA component for gated users
function CheatSheetUpgradeCTA() {
  return (
    <div className="relative">
      {/* Gradient fade overlay */}
      <div className="absolute inset-x-0 -top-20 h-20 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none" />
      
      {/* CTA Card */}
      <div className="px-4 py-8 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-900 border-t border-neutral-200 dark:border-neutral-700">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 mb-4">
            <Lock className="w-6 h-6 text-brand" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            Unlock All Props & Filters
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            Upgrade to access all markets, unlimited props, and advanced filters to find the best betting opportunities.
          </p>
          <ButtonLink
            href={UPGRADE_URL}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/25"
          >
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

// Mobile upgrade banner for gated users
function MobileUpgradeBanner() {
  return (
    <div className="px-3 py-2 bg-gradient-to-r from-brand/10 to-purple-500/10 border-b border-brand/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-brand" />
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Showing top 7 Points props
          </span>
        </div>
        <ButtonLink
          href={UPGRADE_URL}
          className="flex items-center gap-1 px-2.5 py-1 bg-brand text-white text-xs font-semibold rounded-lg"
        >
          Upgrade
          <ArrowRight className="w-3 h-3" />
        </ButtonLink>
      </div>
    </div>
  );
}

const SUPPORTED_SPORTS = ["nba"] as const;
const SUPPORTED_SHEETS = ["hit-rates", "alt-hit-matrix", "injury-impact", "hit-rate-matrix", "dvp"] as const;

type SupportedSport = typeof SUPPORTED_SPORTS[number];
type SupportedSheet = typeof SUPPORTED_SHEETS[number];

// Sheet display names and descriptions
const SHEET_INFO: Record<SupportedSheet, { title: string; description: string }> = {
  "hit-rates": {
    title: "Hit Rate Cheat Sheet",
    description: "High-confidence props ranked by our scoring system",
  },
  "hit-rate-matrix": {
    title: "Hit Rate Matrix",
    description: "Compare hit rates across all point thresholds with live odds",
  },
  "alt-hit-matrix": {
    title: "Alt Hit Matrix",
    description: "Find the best alternate lines with highest hit rates",
  },
  "injury-impact": {
    title: "Injury Impact",
    description: "Props affected by injuries and lineup changes",
  },
  "dvp": {
    title: "Defense vs Position",
    description: "Team defensive rankings by position - Find the best matchups",
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
  
  if (sheet === "hit-rate-matrix") {
    return <HitRateMatrixSheet sport={sport} sheet={sheet} />;
  }
  
  if (sheet === "injury-impact") {
    return <InjuryImpactSheet sport={sport} sheet={sheet} />;
  }
  
  if (sheet === "dvp") {
    return <DvpSheet sport={sport} sheet={sheet} />;
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
  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
    >
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <span className="px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold">
          Coming Soon
        </span>
      </div>
    </AppPageLayout>
  );
}

function AltHitMatrixSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const sheetInfo = SHEET_INFO[sheet];

  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
    >
      <AltHitMatrix sport={sport} />
    </AppPageLayout>
  );
}

type DvpDisplayMode = "values" | "ranks";

// View mode options for DvP
const DVP_VIEW_MODES: { value: DvpViewMode; label: string; icon: React.ReactNode }[] = [
  { value: "basic", label: "Basic", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "advanced", label: "Advanced", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "trends", label: "Trends", icon: <TrendingUp className="w-4 h-4" /> },
];

function DvpSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const sheetInfo = SHEET_INFO[sheet];
  const [selectedPosition, setSelectedPosition] = useState<Position>('PG');
  const [viewMode, setViewMode] = useState<DvpViewMode>('basic');
  const [sampleSize, setSampleSize] = useState<DvpSampleSize>('season');
  const [displayMode, setDisplayMode] = useState<DvpDisplayMode>('values');
  const [trendBaseline, setTrendBaseline] = useState<TrendCompareBaseline>('season');
  const [trendStat, setTrendStat] = useState<TrendStat>('pts');
  const [season, setSeason] = useState('2025-26');

  // Fetch data using the hook
  const { teams, isLoading } = useDvpRankings({
    position: selectedPosition,
    season: season,
  });

  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Mobile View Mode Tabs - shown above filters on mobile only */}
        <div className="md:hidden flex items-center justify-center p-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {DVP_VIEW_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  viewMode === mode.value
                    ? "bg-white dark:bg-neutral-700 text-brand shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters Bar */}
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
        
        {/* Legend & Display Mode Bar */}
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
        
        {/* Table Content */}
        <DvpTable 
          data={teams}
          viewMode={viewMode}
          sampleSize={sampleSize}
          displayMode={displayMode}
          trendBaseline={trendBaseline}
          trendStat={trendStat}
          isLoading={isLoading}
          onTeamClick={(teamId) => console.log("Clicked team:", teamId)}
        />
      </div>
    </AppPageLayout>
  );
}

function HitRateMatrixSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const sheetInfo = SHEET_INFO[sheet];
  const [showHelp, setShowHelp] = useState(false);

  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="relative z-[80]">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              How It Works
            </button>
            {showHelp && (
              <div className="absolute right-0 top-full mt-2 z-[90] w-[300px] p-3 rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-2">How to read this matrix</p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Each cell shows the hit rate % for that player at the given threshold.
                  Green = high hit rate (80%+), Neutral = medium (50%+), Red = low.
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                  Click cells with odds to compare sportsbooks.
                </p>
                <button
                  onClick={() => setShowHelp(false)}
                  className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      }
    >
      <HitRateMatrix sport={sport} />
    </AppPageLayout>
  );
}

function InjuryImpactSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();
  
  // Use smart default: "tomorrow" if all today's games have started (after 8pm ET)
  const [filters, setFilters] = useState<CheatSheetFilterState>(() => ({
    ...DEFAULT_CHEAT_SHEET_FILTERS,
    dateFilter: getSmartDefaultDateFilter(),
    markets: ["player_points"], // Default to Points for injury impact
  }));
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [hideNoOdds, setHideNoOdds] = useState(true);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  
  // Player quick view modal state
  const [selectedPlayer, setSelectedPlayer] = useState<{
    nba_player_id: number;
    player_name: string;
    market: string;
    event_id: string;
    line?: number;
  } | null>(null);
  
  // Close market dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(e.target as Node)) {
        setMarketDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Gated users are locked to Points market only
  const isGated = !isLoadingAccess && !hasAccess;
  const effectiveMarkets = isGated ? ["player_points"] : filters.markets;

  // Fetch injury impact data
  const { rows: allRows, isLoading, error } = useInjuryImpactCheatsheet({
    dates: getDateFilterDates(filters.dateFilter),
    markets: effectiveMarkets.length > 0 ? effectiveMarkets : undefined,
    minGames: 2,
    minTeammateMinutes: 15,
  });

  // For gated users, filter to rows WITH odds first, then limit to 7
  const rows = useMemo(() => {
    if (!isGated) return allRows;
    
    // Filter to rows that have odds (using bestOdds from API response)
    const rowsWithOdds = allRows.filter(row => row.bestOdds !== null && row.bestOdds !== undefined);
    
    // Return top 7 rows with odds
    return rowsWithOdds.slice(0, FREE_USER_MAX_ROWS);
  }, [allRows, isGated]);

  // Count rows without odds
  const noOddsCount = useMemo(() => {
    return allRows.filter(row => row.bestOdds === null || row.bestOdds === undefined).length;
  }, [allRows]);

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        <MobileInjuryImpact
          rows={rows}
          isLoading={isLoading || isLoadingAccess}
          filters={filters}
          onFiltersChange={setFilters}
          onGlossaryOpen={() => setIsGlossaryOpen(true)}
          sport={sport}
          isGated={isGated}
        />

        {/* Mobile Glossary Bottom Sheet */}
        <InjuryImpactGlossary 
          isOpen={isGlossaryOpen} 
          onClose={() => setIsGlossaryOpen(false)} 
        />
      </>
    );
  }

  // Desktop Layout
  const sheetInfo = SHEET_INFO[sheet];
  
  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-500">
            <span className="font-bold text-neutral-900 dark:text-white">{rows.length}</span> props
          </div>
          <a
            href="https://official.nba.com/nba-injury-report-2025-26-season/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-red-500/10 to-blue-500/10 border border-red-500/20 text-neutral-600 dark:text-neutral-300 hover:from-red-500/20 hover:to-blue-500/20 hover:border-red-500/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" opacity="0.6"/>
            </svg>
            <span>Official Injury Report</span>
            <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <button
            onClick={() => setIsGlossaryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            How It Works
          </button>
        </div>
      }
      contextBar={
        <div className="flex items-center gap-4 px-4 py-2.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          {/* Date Filter */}
          {isGated ? (
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-neutral-400">
                <Lock className="w-3 h-3" />
                <span>Today</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
              {[
                { value: "today" as const, label: "Today" },
                { value: "tomorrow" as const, label: "Tomorrow" },
                { value: "all" as const, label: "All" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilters(prev => ({ ...prev, dateFilter: opt.value }))}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                    filters.dateFilter === opt.value
                      ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

          {/* Market Filter Dropdown */}
          {isGated ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-50 cursor-not-allowed">
              <Lock className="w-3 h-3" />
              <span>Points Only</span>
            </div>
          ) : (
            <div ref={marketDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  "bg-brand/10 text-brand"
                )}
              >
                <span>
                  {INJURY_IMPACT_MARKETS.find(m => m.value === filters.markets[0])?.label ?? "Points"}
                </span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", marketDropdownOpen && "rotate-180")} />
              </button>

              {marketDropdownOpen && (
                <div className="absolute left-0 top-full z-[100] mt-1 w-[180px] rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
                  <div className="flex flex-col gap-0.5">
                    {INJURY_IMPACT_MARKETS.map((market) => {
                      const isSelected = filters.markets[0] === market.value;
                      return (
                        <button
                          key={market.value}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, markets: [market.value] }));
                            setMarketDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-2.5 py-1.5 text-left text-xs font-medium rounded-md transition-colors",
                            isSelected
                              ? "bg-brand/10 text-brand"
                              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          )}
                        >
                          {market.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      }
      stickyContextBar
    >
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Grade Legend Row */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-800/10">
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-neutral-400 font-medium">Grades:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-5 h-4 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[9px]">A+</span>
                <span className="text-neutral-500">90+</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-4 rounded bg-green-500/20 text-green-600 dark:text-green-400 font-bold flex items-center justify-center text-[9px]">A</span>
                <span className="text-neutral-500">80-89</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-4 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold flex items-center justify-center text-[9px]">B+</span>
                <span className="text-neutral-500">70-79</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-4 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center text-[9px]">B</span>
                <span className="text-neutral-500">60-69</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-4 rounded bg-neutral-500/20 text-neutral-500 font-bold flex items-center justify-center text-[9px]">C</span>
                <span className="text-neutral-500">&lt;60</span>
              </span>
            </div>
          </div>
          
          {/* Hide/Show No Odds Toggle */}
          <button
            onClick={() => setHideNoOdds(!hideNoOdds)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              hideNoOdds
                ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                : "bg-brand/10 text-brand border border-brand/30"
            }`}
          >
            {hideNoOdds ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <span>Show {noOddsCount} without odds</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Hide {noOddsCount} without odds</span>
              </>
            )}
          </button>
        </div>
        
        <InjuryImpactTable
          rows={rows}
          isLoading={isLoading || isLoadingAccess}
          filters={filters}
          onFiltersChange={setFilters}
          onGlossaryOpen={() => setIsGlossaryOpen(true)}
          onPlayerClick={(row) => setSelectedPlayer({
            nba_player_id: row.playerId,
            player_name: row.playerName,
            market: row.market,
            event_id: row.eventId ?? "",
            line: row.line,
          })}
          sport={sport}
          hideNoOdds={hideNoOdds}
          onHideNoOddsChange={setHideNoOdds}
          isGated={isGated}
        />
        
        {/* Upgrade CTA for gated users */}
        {isGated && (
          <CheatSheetUpgradeCTA />
        )}
      </div>

      {/* Confidence Score Glossary Modal */}
      <InjuryImpactGlossary 
        isOpen={isGlossaryOpen} 
        onClose={() => setIsGlossaryOpen(false)} 
      />

      {/* Player Quick View Modal */}
      {selectedPlayer && (
        <PlayerQuickViewModal
          nba_player_id={selectedPlayer.nba_player_id}
          player_name={selectedPlayer.player_name}
          initial_market={selectedPlayer.market}
          initial_line={selectedPlayer.line}
          event_id={selectedPlayer.event_id}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}
    </AppPageLayout>
  );
}

function HitRatesCheatSheet({ sport, sheet }: { sport: SupportedSport; sheet: SupportedSheet }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();
  
  // Use smart default: "tomorrow" if all today's games have started (after 8pm ET)
  const [filters, setFilters] = useState<CheatSheetFilterState>(() => ({
    ...DEFAULT_CHEAT_SHEET_FILTERS,
    dateFilter: getSmartDefaultDateFilter(),
  }));
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  
  // Player quick view modal state
  const [selectedPlayer, setSelectedPlayer] = useState<{
    nba_player_id: number;
    player_name: string;
    market: string;
    event_id: string;
    line?: number;
  } | null>(null);
  
  // Gated users are locked to Points market only
  const isGated = !isLoadingAccess && !hasAccess;
  const effectiveMarkets = isGated ? ["player_points"] : filters.markets;

  // Fetch data with API filters
  const { data, isLoading, error } = useCheatSheet({
    timeWindow: filters.timeWindow,
    minHitRate: filters.minHitRate,
    oddsFloor: filters.oddsFloor,
    oddsCeiling: filters.oddsCeiling,
    markets: effectiveMarkets.length > 0 ? effectiveMarkets : undefined,
    dates: getDateFilterDates(filters.dateFilter),
  });

  // Apply client-side filters (for gated users, we'll filter after odds are loaded)
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    
    let rows = data.rows;

    // For gated users, don't apply filters - we'll limit after odds are loaded
    if (isGated) {
      return rows;
    }

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
  }, [data?.rows, filters, isGated]);

  // Best odds are now included directly in the API response (from Redis bestodds:nba:* keys)
  // No separate odds fetch needed

  // For gated users, filter to rows WITH odds first, then limit to 7
  const displayRows = useMemo(() => {
    if (!isGated) return filteredRows;
    
    // Filter to rows that have best odds
    const rowsWithOdds = filteredRows.filter(row => row.bestOdds !== null);
    
    // Return top 7 rows with odds
    return rowsWithOdds.slice(0, FREE_USER_MAX_ROWS);
  }, [filteredRows, isGated]);

  // Count rows without odds
  const noOddsCount = useMemo(() => {
    return filteredRows.filter(row => row.bestOdds === null).length;
  }, [filteredRows]);

  const handleRowClick = (row: CheatSheetRow) => {
    // TODO: Open player detail modal or navigate to hit rates drilldown
    console.log("Clicked row:", row);
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        <MobileCheatSheet
          rows={displayRows}
          isLoading={isLoading || isLoadingAccess}
          filters={filters}
          onFiltersChange={setFilters}
          onGlossaryOpen={() => setIsGlossaryOpen(true)}
          onRowClick={handleRowClick}
          sport={sport}
          currentSheet={sheet}
          isGated={isGated}
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
  const sheetInfo = SHEET_INFO[sheet];
  
  return (
    <AppPageLayout
      title={sheetInfo.title}
      subtitle={sheetInfo.description}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-500">
            <span className="font-bold text-neutral-900 dark:text-white">{displayRows.length}</span> props
          </div>
          <button
            onClick={() => setIsGlossaryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            How It Works
          </button>
        </div>
      }
      contextBar={
        <CheatSheetFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          resultCount={displayRows.length}
          onGlossaryOpen={() => setIsGlossaryOpen(true)}
          hideNoOdds={filters.hideNoOdds}
          onHideNoOddsChange={(value) => setFilters({ ...filters, hideNoOdds: value })}
          noOddsCount={noOddsCount}
          isGated={isGated}
        />
      }
      stickyContextBar
    >
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Table with Scroll Area */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <p className="text-lg font-medium">Failed to load data</p>
            <p className="text-sm mt-1">Please try again later</p>
          </div>
        ) : (
          <>
            <CheatSheetTable 
              rows={displayRows}
              isLoading={isLoading || isLoadingAccess}
              timeWindow={filters.timeWindow}
              onRowClick={handleRowClick}
              onPlayerClick={(row) => setSelectedPlayer({
                nba_player_id: row.playerId,
                player_name: row.playerName,
                market: row.market,
                event_id: row.eventId ?? "",
                line: row.line,
              })}
              onGlossaryOpen={() => setIsGlossaryOpen(true)}
              hideNoOdds={filters.hideNoOdds}
            />
            
            {/* Upgrade CTA for gated users */}
            {isGated && (
              <CheatSheetUpgradeCTA />
            )}
          </>
        )}
      </div>

      {/* Glossary Modal */}
      <ConfidenceGlossary 
        isOpen={isGlossaryOpen} 
        onClose={() => setIsGlossaryOpen(false)} 
      />

      {/* Player Quick View Modal */}
      {selectedPlayer && (
        <PlayerQuickViewModal
          nba_player_id={selectedPlayer.nba_player_id}
          player_name={selectedPlayer.player_name}
          initial_market={selectedPlayer.market}
          initial_line={selectedPlayer.line}
          event_id={selectedPlayer.event_id}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}
    </AppPageLayout>
  );
}

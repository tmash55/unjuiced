"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  Search,
  Play,
  Pause,
  Wifi,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactArbCard } from "./compact-arb-card";
import { BetCalculatorModal } from "./bet-calculator-modal";
import type { ArbRow } from "@/lib/arb-schema";
import { FiltersSheet } from "../filters-sheet";
import Lock from "@/icons/lock";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Skeleton component for loading state
function ArbCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div 
      className="bg-white dark:bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-pulse shadow-sm dark:shadow-none"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header Skeleton */}
      <div className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700/50">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Game Info */}
          <div className="flex items-center gap-1.5 flex-1">
            <div className="w-6 h-6 rounded-md bg-neutral-200 dark:bg-neutral-700/80" />
            <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-700/80 rounded" />
            <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700/60 rounded" />
          </div>
          {/* Right: ROI Badge */}
          <div className="h-6 w-14 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg" />
        </div>
        {/* Market Row */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-700/60 rounded" />
          <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-700/80 rounded" />
        </div>
      </div>

      {/* Body Skeleton - Two Sides */}
      <div className="px-3 py-2 flex items-stretch gap-2">
        {/* Bet A Skeleton */}
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800/40 rounded-lg px-2.5 py-2 border-l-2 border-neutral-300 dark:border-neutral-600">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700/80" />
            <div className="flex-1">
              <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-700/60 rounded mb-1.5" />
              <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700/80 rounded" />
            </div>
          </div>
        </div>
        {/* Bet B Skeleton */}
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800/40 rounded-lg px-2.5 py-2 border-l-2 border-neutral-300 dark:border-neutral-600">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700/80" />
            <div className="flex-1">
              <div className="h-2.5 w-12 bg-neutral-200 dark:bg-neutral-700/60 rounded mb-1.5" />
              <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700/80 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700/50 flex items-center justify-between">
        <div>
          <div className="h-2 w-8 bg-neutral-200 dark:bg-neutral-700/60 rounded mb-1" />
          <div className="h-4 w-12 bg-neutral-200 dark:bg-neutral-700/80 rounded" />
        </div>
        <div className="text-center">
          <div className="h-2 w-10 bg-neutral-200 dark:bg-neutral-700/60 rounded mb-1 mx-auto" />
          <div className="h-5 w-16 bg-emerald-100 dark:bg-emerald-500/20 rounded" />
        </div>
        <div className="h-8 w-24 bg-brand/10 rounded-lg" />
      </div>
    </div>
  );
}

// Multiple skeletons for loading
function ArbCardSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <ArbCardSkeleton key={i} delay={i * 100} />
      ))}
    </div>
  );
}

interface MobileArbsViewProps {
  rows: ArbRow[];
  changes: Map<string, { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }>;
  added?: Set<string>;
  totalBetAmount: number;
  roundBets?: boolean;
  isPro: boolean;
  isLoggedIn: boolean;
  counts: { pregame: number; live: number } | null;
  mode: "prematch" | "live";
  onModeChange: (mode: "prematch" | "live") => void;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  connected: boolean;
  autoEnabled: boolean;
  onToggleAuto: (enabled: boolean) => void;
}

export function MobileArbsView({
  rows,
  changes,
  added,
  totalBetAmount,
  roundBets = false,
  isPro,
  isLoggedIn,
  counts,
  mode,
  onModeChange,
  loading,
  onRefresh,
  refreshing,
  connected,
  autoEnabled,
  onToggleAuto,
}: MobileArbsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Calculator modal state - lifted to parent level so it persists across data refreshes
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ArbRow | null>(null);
  const [warningRow, setWarningRow] = useState<ArbRow | null>(null);
  // Keep a ref to the snapshot row so it doesn't change during modal session
  const snapshotRowRef = useRef<ArbRow | null>(null);

  // Open calculator with a specific row
  const openCalculator = (row: ArbRow) => {
    snapshotRowRef.current = row; // Capture snapshot
    setSelectedRow(row);
    setCalculatorOpen(true);
  };

  // Close calculator
  const closeCalculator = () => {
    setCalculatorOpen(false);
    // Don't clear selectedRow immediately to allow close animation
    setTimeout(() => {
      setSelectedRow(null);
      snapshotRowRef.current = null;
    }, 300);
  };

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => {
      const hay = [
        r.o?.name,
        r.u?.name,
        r.mkt,
        r.ev?.home?.name,
        r.ev?.home?.abbr,
        r.ev?.away?.name,
        r.ev?.away?.abbr,
        r.lg?.name,
        r.lg?.sport,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchQuery]);

  // Sort rows by ROI (highest to lowest)
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => (b.roi_bps ?? 0) - (a.roi_bps ?? 0));
  }, [filteredRows]);

  // Find current version of the selected row (for staleness detection)
  const currentRowVersion = useMemo(() => {
    if (!selectedRow) return null;
    return rows.find(r => r.eid === selectedRow.eid) || null;
  }, [rows, selectedRow]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Fixed Header - below layout's h-12 mobile header */}
      <div className="fixed top-12 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
        {/* Actions Row */}
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Mode Toggle - Left */}
          <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800/80 rounded-xl p-1 border border-neutral-200 dark:border-neutral-700/50">
            <button
              type="button"
              onClick={() => onModeChange('prematch')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                mode !== 'live' 
                  ? "bg-brand text-neutral-900 shadow-sm" 
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              Pre-Match ({counts?.pregame ?? 0})
            </button>
            <button
              type="button"
              onClick={() => isPro && onModeChange('live')}
              disabled={!isPro}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                mode === 'live' && isPro
                  ? "bg-brand text-neutral-900 shadow-sm" 
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white",
                !isPro && "opacity-60 cursor-not-allowed"
              )}
            >
              Live ({counts?.live ?? 0})
              {!isPro && <Lock className="w-3 h-3" />}
            </button>
          </div>

          {/* Actions - Right */}
          <div className="flex items-center gap-2">
            {/* Auto-refresh Toggle (Sharp only) - Shows connection state */}
            {isPro && (
              <button
                onClick={() => onToggleAuto(!autoEnabled)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  !autoEnabled 
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400" 
                    : connected 
                      ? "bg-emerald-600 text-white" 
                      : "bg-amber-500 text-white"
                )}
                title={
                  !autoEnabled 
                    ? "Enable auto-refresh" 
                    : connected 
                      ? "Pause auto-refresh" 
                      : "Connecting..."
                }
              >
                {!autoEnabled ? (
                  <Play className="w-4 h-4" />
                ) : connected ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Wifi className="w-4 h-4 animate-pulse" />
                )}
              </button>
            )}
            
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSearch 
                  ? "bg-brand text-neutral-900" 
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              )}
            >
              <Search className="w-4 h-4" />
            </button>
            
            {/* Refresh */}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
            
            {/* Filters */}
            <FiltersSheet pro={isPro} isLoggedIn={isLoggedIn}>
              <button className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                <Filter className="w-4 h-4" />
              </button>
            </FiltersSheet>
          </div>
        </div>

        {/* Search Input - Expandable */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players, teams, markets..."
                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-brand"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Spacer for fixed header - accounts for top-12 (48px) + header content */}
      <div className={cn("pt-[64px]", showSearch && "pt-[116px]")} />

      {/* Content */}
      <div className="px-4 pb-24 space-y-3">
        {loading && rows.length === 0 ? (
          // Loading State - Skeleton Cards
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Finding arbitrage opportunities...</p>
            </div>
            <ArbCardSkeletons />
          </div>
        ) : sortedRows.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-center font-medium">No arbitrage opportunities found</p>
            <p className="text-neutral-400 dark:text-neutral-500 text-sm text-center mt-1">
              {searchQuery ? "Try adjusting your search" : "Try adjusting your filters or check back later"}
            </p>
          </div>
        ) : (
          // Arb Cards - sorted by ROI (highest first)
          sortedRows.map((row, idx) => (
            <CompactArbCard
              key={`${row.eid}-${row.mkt}-${row.ln}-${idx}`}
              row={row}
              totalBetAmount={totalBetAmount}
              isNew={added?.has(row.eid)}
              hasChange={changes.has(row.eid)}
              onOpenCalculator={() => openCalculator(row)}
              onShowWarning={() => setWarningRow(row)}
            />
          ))
        )}
      </div>

      {/* High ROI Warning Dialog */}
      <Dialog open={!!warningRow} onOpenChange={(open) => !open && setWarningRow(null)}>
        <DialogContent className="max-w-[340px] w-[calc(100%-32px)] rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden left-1/2 -translate-x-1/2">
          {warningRow && (
            <div className="relative">
              {/* Header */}
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-amber-50 dark:bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-white">
                    High ROI Warning
                  </DialogTitle>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  This opportunity has an unusually high return of{" "}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{(warningRow.roi_bps / 100).toFixed(1)}%</span>.
                </p>
                
                <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/50">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">Before placing bets:</span>
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                      Double-check both markets and lines are correct
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                      Verify the odds are still available at both books
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                      Confirm this is not an odds error or stale line
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                      Consider if both sides are truly opposites
                    </li>
                  </ul>
                </div>
                
                <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                  Sportsbooks may void bets placed on obvious errors.
                </p>
              </div>
              
              {/* Footer */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => setWarningRow(null)}
                  className="w-full py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-medium text-neutral-900 dark:text-white transition-colors"
                >
                  I Understand
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calculator Modal - Rendered at parent level so it persists */}
      {selectedRow && (
        <BetCalculatorModal
          row={snapshotRowRef.current || selectedRow}
          currentRow={currentRowVersion}
          isOpen={calculatorOpen}
          onClose={closeCalculator}
          defaultTotal={totalBetAmount}
        />
      )}
    </div>
  );
}

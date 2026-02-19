"use client";

import React from "react";
import { HitRateTable } from "./hit-rate-table";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Chart from "@/icons/chart";

// Number of rows to show unblurred for free users
const FREE_USER_VISIBLE_ROWS = 2;
// Total rows to show (visible + blurred)
const TOTAL_PREVIEW_ROWS = 20;

// Redirect to pricing page for upgrades
const UPGRADE_URL = "/pricing";

interface GatedHitRateTableProps {
  sport?: "nba" | "mlb";
  rows: HitRateProfile[];
  loading?: boolean;
  error?: string | null;
  onRowClick?: (row: HitRateProfile) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  totalCount?: number;
  selectedMarkets: string[];
  marketOptions?: Array<{ value: string; label: string }>;
  onMarketsChange: (markets: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank" | null;
  sortDirection: "asc" | "desc";
  onSortChange: (field: "line" | "l5Avg" | "l10Avg" | "seasonAvg" | "streak" | "l5Pct" | "l10Pct" | "l20Pct" | "seasonPct" | "h2hPct" | "matchupRank", direction: "asc" | "desc") => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  initialScrollTop?: number;
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (value: boolean) => void;
  onOddsAvailabilityChange?: (idsWithOdds: Set<string>) => void;
  gamesFilter?: React.ReactNode;
}

// Elegant upgrade banner component - using brand blue color
function UpgradeBanner() {
  return (
    <div className="relative overflow-hidden">
      {/* Gradient background - using brand color (sky blue) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-brand)]/5 via-[var(--color-brand)]/10 to-[var(--color-brand)]/5 dark:from-[var(--color-brand)]/10 dark:via-[var(--color-brand)]/15 dark:to-[var(--color-brand)]/10" />
      
      {/* Subtle animated gradient accent */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.08),transparent)] animate-pulse" style={{ animationDuration: '3s' }} />
      
      <div className="relative flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Left: Message */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] shadow-sm">
            <Chart className="h-4 w-4 stroke-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              Unlock all players
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
              Full access to hit rates, matchup analysis & more
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        <ButtonLink
          href={UPGRADE_URL}
          variant="primary"
          className={cn(
            "shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all",
            "bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90",
            "hover:shadow-lg hover:-translate-y-0.5"
          )}
        >
          Unlock Now
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </div>
  );
}

// Bottom CTA for the table
function BottomCTA() {
  return (
    <div className="sticky bottom-0 flex items-center justify-center py-4 bg-gradient-to-t from-white via-white dark:from-neutral-900 dark:via-neutral-900">
      <ButtonLink
        href={UPGRADE_URL}
        variant="primary"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all",
          "hover:shadow-xl hover:-translate-y-0.5"
        )}
      >
        <Chart className="h-4 w-4 stroke-current" />
        Unlock Now
        <ArrowRight className="h-4 w-4" />
      </ButtonLink>
    </div>
  );
}

export function GatedHitRateTable({
  sport = "nba",
  rows,
  loading,
  error,
  onRowClick,
  hasMore,
  onLoadMore,
  isLoadingMore,
  totalCount,
  selectedMarkets,
  marketOptions,
  onMarketsChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  scrollRef,
  initialScrollTop,
  hideNoOdds,
  onHideNoOddsChange,
  onOddsAvailabilityChange,
  gamesFilter,
}: GatedHitRateTableProps) {
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();

  // If still loading access or user has access, show full table
  if (isLoadingAccess || hasAccess) {
    return (
      <HitRateTable
        sport={sport}
        rows={rows}
        loading={loading}
        error={error}
        onRowClick={onRowClick}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        totalCount={totalCount}
        selectedMarkets={selectedMarkets}
        marketOptions={marketOptions}
        onMarketsChange={onMarketsChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={onSortChange}
        scrollRef={scrollRef}
        initialScrollTop={initialScrollTop}
        hideNoOdds={hideNoOdds}
        onHideNoOddsChange={onHideNoOddsChange}
        onOddsAvailabilityChange={onOddsAvailabilityChange}
        gamesFilter={gamesFilter}
      />
    );
  }

  // Free user - show rows with blur after the visible ones
  const previewRows = rows.slice(0, TOTAL_PREVIEW_ROWS);
  const hiddenCount = Math.max(0, rows.length - FREE_USER_VISIBLE_ROWS);

  return (
    <HitRateTable
      sport={sport}
      rows={previewRows}
      loading={loading}
      error={error}
      onRowClick={onRowClick}
      hasMore={false}
      onLoadMore={undefined}
      isLoadingMore={false}
      totalCount={previewRows.length}
      selectedMarkets={selectedMarkets}
      marketOptions={marketOptions}
      onMarketsChange={onMarketsChange}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      sortField={sortField}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      scrollRef={scrollRef}
      initialScrollTop={initialScrollTop}
      hideNoOdds={hideNoOdds}
      onHideNoOddsChange={onHideNoOddsChange}
      onOddsAvailabilityChange={onOddsAvailabilityChange}
      gamesFilter={gamesFilter}
      upgradeBanner={
        hiddenCount > 0 ? (
          <UpgradeBanner />
        ) : undefined
      }
      blurAfterIndex={FREE_USER_VISIBLE_ROWS}
      bottomContent={
        hiddenCount > 0 ? (
          <BottomCTA />
        ) : undefined
      }
    />
  );
}

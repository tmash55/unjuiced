"use client";

import React from "react";
import { MobileHitRates } from "./mobile-hit-rates";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import type { NbaGame } from "@/hooks/use-nba-games";
import { useHasHitRateAccess } from "@/hooks/use-entitlements";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Chart from "@/icons/chart";

// Number of rows to show unblurred for free users
const FREE_USER_VISIBLE_ROWS = 2;
// Total rows to show (visible + blurred)
const TOTAL_PREVIEW_ROWS = 15;

// Redirect to pricing page for upgrades
const UPGRADE_URL = "/pricing";

interface GatedMobileHitRatesProps {
  rows: HitRateProfile[];
  games: NbaGame[];
  loading: boolean;
  error?: string | null;
  onPlayerClick: (player: HitRateProfile) => void;
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  sortField: string;
  onSortChange: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGameIds: string[];
  onGameIdsChange: (gameIds: string[]) => void;
  startedGameIds?: Set<string>;
  // Hide players without odds
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (hide: boolean) => void;
}

// Header upgrade banner - under sport tabs
function HeaderUpgradeBanner() {
  return (
    <a
      href={UPGRADE_URL}
      className={cn(
        "flex items-center justify-between gap-3 mx-0 mt-2 px-3 py-2.5 rounded-lg",
        "bg-gradient-to-r from-[var(--color-brand)]/10 via-[var(--color-brand)]/15 to-[var(--color-brand)]/10",
        "dark:from-[var(--color-brand)]/15 dark:via-[var(--color-brand)]/20 dark:to-[var(--color-brand)]/15",
        "border border-[var(--color-brand)]/20 dark:border-[var(--color-brand)]/30",
        "active:scale-[0.99] transition-all"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] shadow-sm">
          <Chart className="h-3.5 w-3.5 stroke-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-900 dark:text-white">
            Unlock all players
          </p>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Full hit rates & matchup analysis
          </p>
        </div>
      </div>
      <div className={cn(
        "shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg",
        "bg-[var(--color-brand)] text-white text-xs font-semibold shadow-sm"
      )}>
        Upgrade
        <ArrowRight className="h-3 w-3" />
      </div>
    </a>
  );
}

// Mobile upgrade CTA - sticky at bottom
function MobileUpgradeCTA() {
  return (
    <div className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
      <ButtonLink
        href={UPGRADE_URL}
        variant="primary"
        className={cn(
          "w-full justify-center rounded-xl px-6 py-3.5 text-base font-semibold shadow-lg transition-all",
          "hover:shadow-xl"
        )}
      >
        <Chart className="h-5 w-5 mr-2 stroke-current" />
        Unlock All Players
        <ArrowRight className="ml-2 h-5 w-5" />
      </ButtonLink>
    </div>
  );
}

export function GatedMobileHitRates({
  rows,
  games,
  loading,
  error,
  onPlayerClick,
  selectedMarkets,
  onMarketsChange,
  sortField,
  onSortChange,
  searchQuery,
  onSearchChange,
  selectedGameIds,
  onGameIdsChange,
  startedGameIds,
  hideNoOdds = true,
  onHideNoOddsChange,
}: GatedMobileHitRatesProps) {
  const { hasAccess, isLoading: isLoadingAccess } = useHasHitRateAccess();

  // If still loading or user has access, show full component
  if (isLoadingAccess || hasAccess) {
    return (
      <MobileHitRates
        rows={rows}
        games={games}
        loading={loading}
        error={error}
        onPlayerClick={onPlayerClick}
        selectedMarkets={selectedMarkets}
        onMarketsChange={onMarketsChange}
        sortField={sortField}
        onSortChange={onSortChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedGameIds={selectedGameIds}
        onGameIdsChange={onGameIdsChange}
        startedGameIds={startedGameIds}
        hideNoOdds={hideNoOdds}
        onHideNoOddsChange={onHideNoOddsChange}
      />
    );
  }

  // Free user - pass all rows and let MobileHitRates handle filtering
  // Then blur cards after the visible index
  return (
    <MobileHitRates
      rows={rows}
      games={games}
      loading={loading}
      error={error}
      onPlayerClick={onPlayerClick}
      selectedMarkets={selectedMarkets}
      onMarketsChange={onMarketsChange}
      sortField={sortField}
      onSortChange={onSortChange}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      selectedGameIds={selectedGameIds}
      onGameIdsChange={onGameIdsChange}
      startedGameIds={startedGameIds}
      hideNoOdds={hideNoOdds}
      onHideNoOddsChange={onHideNoOddsChange}
      blurAfterIndex={FREE_USER_VISIBLE_ROWS}
      maxRows={TOTAL_PREVIEW_ROWS}
      hideLoadMore={true}
      bottomContent={<MobileUpgradeCTA />}
      upgradeBanner={<HeaderUpgradeBanner />}
    />
  );
}

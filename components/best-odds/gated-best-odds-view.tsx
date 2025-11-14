"use client";

import React from "react";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { BestOddsTable } from "./best-odds-table";
import { BestOddsCards } from "./best-odds-cards";
import { ButtonLink } from "@/components/button-link";
import LockIcon from "@/icons/lock";
import { RefreshCw, TrendingUp, Filter, Infinity, ArrowRight } from "lucide-react";

interface GatedBestOddsViewProps {
  deals: BestOddsDeal[];
  loading: boolean;
  viewMode: 'table' | 'cards';
  isLoggedIn: boolean;
  isPro: boolean;
  premiumCount?: number;
}

export function GatedBestOddsView({
  deals,
  loading,
  viewMode,
  isLoggedIn,
  isPro,
  premiumCount = 0,
}: GatedBestOddsViewProps) {
  // Pro user: Show full data
  if (isPro) {
    if (viewMode === 'table') {
      return <BestOddsTable deals={deals} loading={loading} isPro={isPro} />;
    }
    return <BestOddsCards deals={deals} loading={loading} />;
  }

  // Non-pro: Show preview deals with messaging
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">Loading preview...</div>
      </div>
    );
  }

  const previewPerSport = 2;
  const premiumLabel = premiumCount >= 1000 ? '1k+' : `${premiumCount}`;

  return (
    <div className="space-y-4">
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-4 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-950 sm:p-5">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900/5 text-neutral-900 shadow-inner dark:bg-white/10 dark:text-white">
                <LockIcon className="h-5 w-5 text-[var(--tertiary)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {premiumLabel} Premium Edge{premiumCount === 1 ? "" : "s"} Hidden
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-200/80">
                  Free users can view {previewPerSport} edges per sport. Unlock full filters, auto-refresh, and unlimited edges — all in real-time.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-sm text-neutral-800 dark:text-neutral-100 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/80 px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
              <RefreshCw className="h-4 w-4 text-[var(--tertiary)]" />
              <div>
                <p className="font-semibold leading-none">Real-time Auto Refresh</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Stay synced with every market swing.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/80 px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
              <TrendingUp className="h-4 w-4 text-[var(--tertiary)]" />
              <div>
                <p className="font-semibold leading-none">Premium Edges (All %)</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Chase the edges that truly move bankrolls.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/80 px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
              <Filter className="h-4 w-4 text-[var(--tertiary)]" />
              <div>
                <p className="font-semibold leading-none">Advanced Filters</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Fine-tune by sport, market, book, and odds.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/80 px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
              <Infinity className="h-4 w-4 text-[var(--tertiary)]" />
              <div>
                <p className="font-semibold leading-none">Unlimited Opportunities</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-300/70">No throttle. Capture everything in one stream.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink
              href="/pricing"
              variant="outline"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--tertiary)] bg-[var(--tertiary)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--tertiary-strong)] dark:border-[var(--tertiary)] dark:bg-[var(--tertiary)]"
            >
              {isLoggedIn ? 'Upgrade to Pro' : 'Try Free'}
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <span className="text-xs text-neutral-500 dark:text-neutral-300/70">
              Unlock all edges, filters and more.
            </span>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        <BestOddsTable
          deals={deals}
          loading={false}
          isPro={false}
          isLimitedPreview
          previewPerSport={previewPerSport}
        />
      ) : (
        <BestOddsCards deals={deals} loading={false} />
      )}
    </div>
  );
}

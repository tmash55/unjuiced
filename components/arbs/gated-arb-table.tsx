"use client";

import React, { useEffect, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { ArbTableV2 } from "./arb-table-v2";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight, Loader2, RefreshCw, TrendingUp, Infinity } from "lucide-react";
import LockIcon from "@/icons/lock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPriceId } from "@/constants/billing";
import config from "@/config";

interface GatedArbTableProps {
  rows: ArbRow[];
  ids: string[];
  changes: Map<string, { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }>;
  added?: Set<string>;
  totalBetAmount?: number;
  roundBets?: boolean;
  isLoggedIn: boolean;
  isPro: boolean;
  filteredCount?: number; // Number of arbs hidden for free users
  filteredReason?: string; // Reason for filtering
  premiumTeaserArbs?: ArbRow[]; // Real premium arbs to show as blurred teasers
}

export function GatedArbTable({
  rows,
  ids,
  changes,
  added,
  totalBetAmount = 200,
  roundBets = false,
  isLoggedIn,
  isPro,
  filteredCount = 0,
  filteredReason,
  premiumTeaserArbs = [],
}: GatedArbTableProps) {
  const [hasUnusedTrial, setHasUnusedTrial] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  
  // Use real premium arbs as teaser rows (blurred for free users)
  // Show teasers if user is not pro AND we have premium arbs to show
  const teaserRows: ArbRow[] = !isPro && premiumTeaserArbs.length > 0
    ? premiumTeaserArbs.slice(0, 3).map((arb, idx) => ({
        ...arb,
        eid: `teaser-${idx + 1}`,
        _isTeaser: true,
      } as ArbRow))
    : [];
  
  // Sprinkle teaser rows throughout the table: one at top, then every 6 free rows
  const { displayRows, displayIds } = !isPro && teaserRows.length > 0 ? (() => {
    const resultRows: ArbRow[] = [];
    const resultIds: string[] = [];
    let teaserIndex = 0;
    
    // Add first teaser at the very top
    if (teaserRows.length > 0) {
      resultRows.push(teaserRows[0]);
      resultIds.push(teaserRows[0].eid);
      teaserIndex = 1;
    }
    
    rows.forEach((row, index) => {
      resultRows.push(row);
      resultIds.push(ids[index]);
      
      // Insert a teaser every 6 free rows (after positions 5, 11, 17, etc.)
      if ((index + 1) % 6 === 0 && teaserIndex < teaserRows.length) {
        resultRows.push(teaserRows[teaserIndex]);
        resultIds.push(teaserRows[teaserIndex].eid);
        teaserIndex++;
      }
    });
    
    return { displayRows: resultRows, displayIds: resultIds };
  })() : { displayRows: rows, displayIds: ids };

  // Fetch trial status for logged-in users
  useEffect(() => {
    if (isLoggedIn && !isPro) {
      const fetchTrialStatus = async () => {
        try {
          const response = await fetch("/api/me/plan", { cache: "no-store" });
          const data = await response.json();
          setHasUnusedTrial(data.trial?.trial_used === false);
        } catch (error) {
          console.error("Failed to fetch trial status:", error);
          setHasUnusedTrial(false);
        }
      };
      fetchTrialStatus();
    }
  }, [isLoggedIn, isPro]);

  // Handle trial activation via Stripe Checkout (requires card, with trial)
  const handleStartTrial = async () => {
    const priceId = getPriceId("monthly", config.stripe.plans[0]?.priceId);
    if (!priceId) {
      toast.error("Trial unavailable: missing price configuration.");
      return;
    }

    if (!isLoggedIn) {
      // Not logged in - start Checkout; backend will redirect to login preserving redirect
      const params = new URLSearchParams({
        priceId,
        mode: "subscription",
        trialDays: String(7),
      }).toString();
      window.location.href = `/billing/start?${params}`;
      return;
    }

    // Logged in - create Checkout session then redirect to Stripe
    setActivatingTrial(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          mode: "subscription",
          trialDays: 3,
        }),
      });
      if (res.status === 401) {
        const params = new URLSearchParams({
          priceId,
          mode: "subscription",
          trialDays: String(7),
        }).toString();
        window.location.assign(`/billing/start?${params}`);
        return;
      }
      const json = await res.json();
      if (json?.url) {
        window.location.assign(json.url);
        return;
      }
      toast.error("Failed to start trial checkout. Please try again.");
    } catch (error) {
      console.error("Error activating trial:", error);
      toast.error("Failed to start trial. Please try again.");
      setActivatingTrial(false);
    }
  };

  // Free users now see filtered data (ROI <= 1%, pregame only) instead of a hard gate
  // Show upgrade banner if there are filtered arbs
      return (
    <div>
      {!isPro && filteredCount > 0 && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-4 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-950 sm:p-5">

          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900/5 text-neutral-900 shadow-inner dark:bg-white/10 dark:text-white">
                  <LockIcon className="h-5 w-5 text-[var(--tertiary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {filteredCount} Premium Arb{filteredCount === 1 ? "" : "s"} Hidden
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-200/80">
                    Free users can view pregame arbs up to 1% ROI. Unlock faster refreshes, higher-value arbs, and live edges — all in real-time.
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
                  <p className="font-semibold leading-none">Premium Arbs (ROI &gt; 1%)</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Chase the edges that truly move bankrolls.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200/60 bg-white/80 px-3 py-1.5 shadow-sm dark:border-white/5 dark:bg-white/5">
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="absolute h-3 w-3 animate-ping rounded-full bg-[var(--tertiary)]/60" />
                  <span className="relative h-2 w-2 rounded-full bg-[var(--tertiary)]" />
                </span>
                <div>
                  <p className="font-semibold leading-none">Live In-Game Opportunities</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-300/70">Surface edges mid-drive, mid-possession.</p>
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
              {hasUnusedTrial ? (
                <button
                  onClick={handleStartTrial}
                  disabled={activatingTrial}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--tertiary)] bg-[var(--tertiary)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--tertiary-strong)] dark:border-[var(--tertiary)] dark:bg-[var(--tertiary)]"
                >
                  {activatingTrial ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting Trial...
                    </>
                  ) : (
                    <>
                      {isLoggedIn ? 'Upgrade to Pro' : 'Try Free'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <ButtonLink
                  href="/pricing"
                  variant="outline"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--tertiary)] bg-[var(--tertiary)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--tertiary-strong)] dark:border-[var(--tertiary)] dark:bg-[var(--tertiary)]"
                >
                  {isLoggedIn ? 'Upgrade to Pro' : 'Try Free'}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              )}

              <span className="text-xs text-neutral-500 dark:text-neutral-300/70">
                Go beyond 1% ROI — refresh and profit like a pro.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Show the actual filtered table data with teaser rows mixed in */}
    <ArbTableV2
      rows={displayRows}
      ids={displayIds}
      changes={changes}
      added={added}
      totalBetAmount={totalBetAmount}
      roundBets={roundBets}
      isPro={isPro}
    />
    </div>
  );
}


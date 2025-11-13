"use client";

import React, { useEffect, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { ArbTableV2 } from "./arb-table-v2";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight, Lock, Droplet, Loader2 } from "lucide-react";
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
}: GatedArbTableProps) {
  const [previewRows, setPreviewRows] = useState<ArbRow[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUnusedTrial, setHasUnusedTrial] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);

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
          trialDays: 7,
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
        <div className="mb-4 rounded-lg border border-[var(--tertiary)]/20 bg-gradient-to-r from-[var(--tertiary)]/5 to-[var(--tertiary-strong)]/5 p-4 dark:border-[var(--tertiary)]/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--tertiary)]/20 bg-white dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
              <Lock className="h-5 w-5 text-[var(--tertiary-strong)]" />
            </div>
            <div className="flex-1">
              <h4 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
                {filteredCount} Premium Arb{filteredCount === 1 ? '' : 's'} Hidden
              </h4>
              <p className="mb-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                {filteredReason || 'Upgrade to Pro to access all arbitrage opportunities, including live arbs and those with ROI > 1%'}
              </p>
              <div className="flex flex-wrap gap-2">
                {hasUnusedTrial ? (
                  <button
                    onClick={handleStartTrial}
                    disabled={activatingTrial}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[var(--tertiary)] to-[var(--tertiary-strong)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {activatingTrial ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        Start 7-Day Free Trial
                        <ArrowRight className="h-3 w-3" />
                      </>
                    )}
                  </button>
                ) : (
                  <ButtonLink
                    href="/pricing"
                    variant="pro"
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold"
                  >
                    Upgrade to Pro
                    <ArrowRight className="h-3 w-3" />
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Show the actual filtered table data */}
      <ArbTableV2
        rows={rows}
        ids={ids}
        changes={changes}
        added={added}
        totalBetAmount={totalBetAmount}
        roundBets={roundBets}
      />
    </div>
  );
}


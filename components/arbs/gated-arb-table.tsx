"use client";

import React, { useEffect, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { ArbTableV2 } from "./arb-table-v2";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight, Lock, Droplet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GatedArbTableProps {
  rows: ArbRow[];
  ids: string[];
  changes: Map<string, { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }>;
  added?: Set<string>;
  totalBetAmount?: number;
  roundBets?: boolean;
  isLoggedIn: boolean;
  isPro: boolean;
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

  // Handle trial activation for logged-in users
  const handleStartTrial = async () => {
    if (!isLoggedIn) {
      // Not logged in - redirect to trial activate with current path
      const currentPath = window.location.pathname;
      window.location.href = `/trial/activate?redirectTo=${encodeURIComponent(currentPath)}`;
      return;
    }

    // Logged in - activate trial and refresh
    setActivatingTrial(true);
    try {
      const response = await fetch("/api/auth/init-trial", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Trial activated! Enjoy 7 days of Pro access.");
        // Refresh the page to show Pro content
        window.location.reload();
      } else {
        toast.error(data.message || "Failed to activate trial");
        setActivatingTrial(false);
      }
    } catch (error) {
      console.error("Error activating trial:", error);
      toast.error("Failed to activate trial. Please try again.");
      setActivatingTrial(false);
    }
  };

  // Fetch preview data for non-pro users (not logged in or free plan)
  useEffect(() => {
    if (!isPro) {
      const fetchPreview = async () => {
        try {
          setLoading(true);
          const response = await fetch("/api/arbs/teaser?limit=8", { cache: "no-store" });
          const data = await response.json();
          setPreviewRows(data.rows || []);
          setPreviewIds((data.rows || []).map((_: any, i: number) => `preview-${i}`));
        } catch (error) {
          console.error("Failed to fetch preview:", error);
          setPreviewRows([]);
          setPreviewIds([]);
        } finally {
          setLoading(false);
        }
      };
      fetchPreview();
    }
  }, [isPro]);

  // Not pro (not logged in or free plan): Show blurred preview with auth gate
  if (!isPro) {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Loading preview...</div>
        </div>
      );
    }
    return (
      <div className="relative min-h-[600px] pb-24">
        {/* Blurred table preview */}
        <div className="pointer-events-none select-none blur-sm">
          <ArbTableV2
            rows={previewRows}
            ids={previewIds}
            changes={new Map()}
            added={new Set()}
            totalBetAmount={totalBetAmount}
            roundBets={roundBets}
          />
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black">
          <div className="relative z-10 mx-auto max-w-md rounded-2xl border border-[var(--tertiary)]/20 bg-white p-8 text-center shadow-xl dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
            {/* Icon with gradient glow */}
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-[var(--tertiary)]/20 via-[var(--tertiary)]/30 to-[var(--tertiary-strong)]/30 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--tertiary)]/20 bg-white shadow-sm dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
                <Droplet className="h-8 w-8 text-[var(--tertiary-strong)]" />
              </div>
            </div>

            {/* Content */}
            <h3 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              {isLoggedIn && !hasUnusedTrial 
                ? "Upgrade to Pro" 
                : "Start Your 7-Day Free Trial"
              }
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {isLoggedIn && !hasUnusedTrial
                ? "Unlock real-time arbitrage opportunities across 20+ sportsbooks with Pro access."
                : "Join thousands of bettors finding risk-free profit opportunities across 20+ sportsbooks. No credit card required."
              }
            </p>

            {/* Stats */}
            <div className="mb-6 flex items-center justify-center gap-4 rounded-lg border border-[var(--tertiary)]/20 bg-[var(--tertiary)]/5 px-4 py-3 text-xs dark:border-[var(--tertiary)]/30 dark:bg-[var(--tertiary)]/10">
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">20+</div>
                <div className="text-neutral-500 dark:text-neutral-400">Books</div>
              </div>
              <div className="h-8 w-px bg-[var(--tertiary)]/20 dark:bg-[var(--tertiary)]/30" />
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">Live</div>
                <div className="text-neutral-500 dark:text-neutral-400">Updates</div>
              </div>
              <div className="h-8 w-px bg-[var(--tertiary)]/20 dark:bg-[var(--tertiary)]/30" />
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">Real-time</div>
                <div className="text-neutral-500 dark:text-neutral-400">Odds</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              {isLoggedIn ? (
                // Logged in but free plan
                <>
                  {hasUnusedTrial ? (
                    // Show trial CTA if they haven't used it yet
                    <>
                      <button
                        onClick={handleStartTrial}
                        disabled={activatingTrial}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--tertiary)] to-[var(--tertiary-strong)] px-6 py-3 text-base font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {activatingTrial ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            Start Free — 7-Day Trial
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                      <ButtonLink
                        href="/pricing"
                        variant="outline"
                        className="w-full justify-center text-sm"
                      >
                        Or upgrade to Pro
                      </ButtonLink>
                    </>
                  ) : (
                    // Trial already used - show only upgrade
                    <ButtonLink
                      href="/pricing"
                      variant="pro"
                      className="w-full justify-center gap-2"
                    >
                      Upgrade to Pro
                      <ArrowRight className="h-4 w-4" />
                    </ButtonLink>
                  )}
                </>
              ) : (
                // Not logged in - show trial + login CTAs
                <>
                  <button
                    onClick={handleStartTrial}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--tertiary)] to-[var(--tertiary-strong)] px-6 py-3 text-base font-semibold text-white shadow-sm transition-all hover:opacity-90"
                  >
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <ButtonLink
                    href={`/login?redirectTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/arbitrage')}`}
                    variant="outline"
                    className="w-full justify-center text-sm"
                  >
                    Already have an account? Sign in
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pro user: Show full table
  return (
    <ArbTableV2
      rows={rows}
      ids={ids}
      changes={changes}
      added={added}
      totalBetAmount={totalBetAmount}
      roundBets={roundBets}
    />
  );
}


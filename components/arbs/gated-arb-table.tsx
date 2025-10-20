"use client";

import React, { useEffect, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { ArbTableV2 } from "./arb-table-v2";
import { ButtonLink } from "@/components/button-link";
import { ArrowRight, Lock, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Fetch preview data for unauthenticated users
  useEffect(() => {
    if (!isLoggedIn) {
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
  }, [isLoggedIn]);

  // Not logged in: Show blurred preview
  if (!isLoggedIn) {
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black">
          <div className="relative z-10 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            {/* Icon with gradient glow */}
            <div className="relative mx-auto mb-6 w-fit">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-sky-500/30 via-blue-500/30 to-indigo-500/30 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <Droplet className="h-8 w-8 text-brand" />
              </div>
            </div>

            {/* Content */}
            <h3 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              Start Your 7-Day Free Trial
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Join thousands of bettors finding risk-free profit opportunities across 20+ sportsbooks. 
              No credit card required.
            </p>

            {/* Stats */}
            <div className="mb-6 flex items-center justify-center gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">20+</div>
                <div className="text-neutral-500 dark:text-neutral-400">Books</div>
              </div>
              <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">Live</div>
                <div className="text-neutral-500 dark:text-neutral-400">Updates</div>
              </div>
              <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="text-center">
                <div className="font-bold text-neutral-900 dark:text-white">Real-time</div>
                <div className="text-neutral-500 dark:text-neutral-400">Odds</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <ButtonLink
                href="/register"
                variant="primary"
                className="w-full justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink
                href="/login"
                variant="outline"
                className="w-full justify-center text-sm"
              >
                Already have an account? Sign in
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in (Free or Pro): Show full table
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


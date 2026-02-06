"use client";

import React from "react";
import { FeatureHighlight } from "@/components/feature-highlight";

export function BuildSmarterBetsHighlight() {
  return (
    <FeatureHighlight
      badge="Build Smarter Bets"
      title="Turn Data Into Better Bets"
      description="Our bet tools help you build same game parlays, spot arbitrage, and maximize every opportunity."
      ctaText="Build a Bet"
      ctaHref="/parlay-builder"
      className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_70%)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_60%)]" />
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Bet Builder Preview
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              GIF placeholder
            </p>
            <p className="mt-2 text-sm text-white/60">
              Add SGP builder, arbitrage alert, and betslip preview here.
            </p>
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

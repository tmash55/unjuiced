"use client";

import React from "react";
import { FeatureHighlight } from "@/components/feature-highlight";

export function SmartEdgesHighlight() {
  return (
    <FeatureHighlight
      badge="Smart Edges"
      title="Find Smart Edges Before the Line Moves"
      description="Our Smart Edges engine scans sportsbooks in real time to surface mispriced odds, positive EV bets, and line discrepancies."
      ctaText="Explore Smart Edges"
      ctaHref="/positive-ev"
      className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_70%)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_60%)]" />
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Smart Edges Preview
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              GIF placeholder
            </p>
            <p className="mt-2 text-sm text-white/60">
              Show edge %, EV %, best book, and updated‑seconds metadata.
            </p>
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

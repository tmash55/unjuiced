"use client";

import React from "react";
import { FeatureHighlight } from "@/components/feature-highlight";

export function SmartEdgesHighlight() {
  return (
    <FeatureHighlight
      badge="Discover"
      title="Find Value Before the Line Moves"
      description="Our tools scan sportsbooks in real time to surface positive EV bets, mispriced odds, and line discrepancies across 20+ books."
      ctaText="Explore Smart Edges"
      ctaHref="/features/positive-ev"
      className="bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Smart Edges Preview
            </p>
            <p className="mt-3 text-lg font-semibold text-white/50">
              GIF placeholder
            </p>
            <p className="mt-2 text-sm text-white/30">
              Show edge %, EV %, best book, and updated-seconds metadata.
            </p>
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

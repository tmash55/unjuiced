"use client";

import React from "react";
import { FeatureHighlight } from "@/components/feature-highlight";

export function HitRatesHighlight() {
  return (
    <FeatureHighlight
      badge="Research"
      title="Hit Rates That Show the Truth"
      description="See how often props actually hit across the last 5, 10, and 20 games — with shooting zones, matchup context, and correlations built in."
      ctaText="Explore Hit Rates"
      ctaHref="/features/hit-rates"
      className="bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Hit Rates Preview
            </p>
            <p className="mt-3 text-lg font-semibold text-white/50">
              GIF placeholder
            </p>
            <p className="mt-2 text-sm text-white/30">
              Drop your Hit Rates animation here when it&apos;s ready.
            </p>
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

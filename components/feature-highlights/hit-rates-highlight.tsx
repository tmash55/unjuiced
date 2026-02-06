"use client";

import React from "react";
import { FeatureHighlight } from "@/components/feature-highlight";

export function HitRatesHighlight() {
  return (
    <FeatureHighlight
      badge="Hit Rates"
      title="Hit Rates That Show the Truth"
      description="Our Hit Rates show how often props hit across the last 5, 10, and 20 games — before you place the bet."
      ctaText="View Hit Rates"
      ctaHref="/hit-rates/nba"
      className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_70%)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),transparent_60%)]" />
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Hit Rates Preview
            </p>
            <p className="mt-3 text-lg font-semibold text-white">
              GIF placeholder
            </p>
            <p className="mt-2 text-sm text-white/60">
              Drop your Hit Rates animation here when it’s ready.
            </p>
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

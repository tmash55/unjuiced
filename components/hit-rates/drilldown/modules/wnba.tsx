"use client";

import { MobilePlayerDrilldown } from "@/components/hit-rates/mobile/mobile-player-drilldown";
import { PlayerDrilldown } from "@/components/hit-rates/player-drilldown";
import type { DrilldownSportModule } from "@/components/hit-rates/drilldown/types";

export const wnbaDrilldownModule: DrilldownSportModule = {
  sport: "wnba",
  backLabel: "WNBA Hit Rates",
  emptyStateDescription: (playerId) => `No hit rate data found for player ID: ${playerId}`,
  renderLoading: ({ isMobile }) => {
    if (isMobile) {
      return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
            <div className="w-32 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>

          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="w-40 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                <div className="w-24 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-20 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse shrink-0" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-neutral-900 p-4">
            <div className="w-full h-48 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6 space-y-4">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="w-48 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              <div className="w-64 h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-16 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
          <div className="w-32 h-6 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
          <div className="w-full h-64 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
    );
  },
  renderContent: ({ profile, allPlayerProfiles, onBack, onMarketChange, isMobile }) => {
    if (isMobile) {
      return (
        <MobilePlayerDrilldown
          profile={profile}
          allPlayerProfiles={allPlayerProfiles}
          onBack={onBack}
          onMarketChange={onMarketChange}
        />
      );
    }

    return (
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        <PlayerDrilldown
          profile={profile}
          allPlayerProfiles={allPlayerProfiles}
          onMarketChange={onMarketChange}
          onBack={onBack}
        />
      </div>
    );
  },
};

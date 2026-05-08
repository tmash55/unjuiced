"use client";

import { MlbPlayerDrilldown } from "@/components/hit-rates/mlb/mlb-player-drilldown";
import type { DrilldownSportModule } from "@/components/hit-rates/drilldown/types";

export const mlbDrilldownModule: DrilldownSportModule = {
  sport: "mlb",
  backLabel: "MLB Hit Rates",
  emptyStateDescription: (playerId) => `No MLB hit rate data found for player ID: ${playerId}`,
  renderLoading: () => (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="h-28 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
      <div className="h-96 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
      <div className="h-64 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
    </div>
  ),
  renderContent: ({ profile, allPlayerProfiles, onBack, onMarketChange }) => (
    <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 lg:px-6 py-4 md:py-6">
      <MlbPlayerDrilldown
        profile={profile}
        allPlayerProfiles={allPlayerProfiles}
        onBack={onBack}
        onMarketChange={onMarketChange}
      />
    </div>
  ),
};

"use client";

import { useCallback } from "react";
import { usePreferences } from "@/context/preferences-context";

// Per-user toggles for the player drilldown chart overlays. Schema lives in
// user_preferences.chart_settings (JSONB) so adding a new toggle here is
// code-only, no migration. Defaults baked in below.
export interface ChartSettings {
  showConfidenceBand: boolean;
  showDvpOverlay: boolean;
  showPaceOverlay: boolean;
  showPotential: boolean;
  showAverage: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  showConfidenceBand: false,
  showDvpOverlay: false,
  showPaceOverlay: false,
  showPotential: true, // Was always-on previously — preserve that default.
  showAverage: true,
};

// Thin wrapper around usePreferences so chart components don't have to know
// about the JSONB shape. Returns merged defaults + setter that does optimistic
// updates — flipping a toggle should feel instant even before the round-trip.
export function useChartPreferences() {
  const { preferences, updatePreference } = usePreferences();

  const settings: ChartSettings = {
    ...DEFAULT_CHART_SETTINGS,
    ...(preferences?.chart_settings ?? {}),
  };

  const setSetting = useCallback(
    <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) => {
      const next: ChartSettings = { ...settings, [key]: value };
      // updatePreference's second arg is `optimistic` — true means apply the
      // change to the in-memory pref immediately, then write to Supabase.
      void updatePreference("chart_settings", next, true);
    },
    [settings, updatePreference],
  );

  // Atomic reset — chaining 5 setSetting calls would race against the same
  // stale `settings` closure and only the last write would land, leaving
  // earlier toggles in their pre-reset state.
  const resetSettings = useCallback(() => {
    void updatePreference("chart_settings", DEFAULT_CHART_SETTINGS, true);
  }, [updatePreference]);

  return { settings, setSetting, resetSettings };
}

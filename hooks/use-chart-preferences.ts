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
  // Per-game stat overlays the user has flipped on (Minutes / FGA / 3PA /
  // Passes today). Persisted as an array since JSONB doesn't speak Set.
  // Read as a Set in the chart for O(1) lookups.
  metricOverlays: string[];
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  showConfidenceBand: false,
  showDvpOverlay: false,
  showPaceOverlay: false,
  showPotential: true, // Was always-on previously — preserve that default.
  showAverage: true,
  metricOverlays: [],
};

// Thin wrapper around usePreferences so chart components don't have to know
// about the JSONB shape. Returns merged defaults + setter that does optimistic
// updates — flipping a toggle should feel instant even before the round-trip.
export function useChartPreferences() {
  const { preferences, updatePreference } = usePreferences();

  const settings: ChartSettings = {
    ...DEFAULT_CHART_SETTINGS,
    ...(preferences?.chart_settings ?? {}),
    // Defensive: ensure metricOverlays is always an array even if the JSONB
    // row was written before this field existed.
    metricOverlays: Array.isArray(preferences?.chart_settings?.metricOverlays)
      ? preferences!.chart_settings!.metricOverlays
      : [],
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

  // Toggle a single metric overlay key on/off in the persisted array.
  const toggleMetricOverlay = useCallback(
    (key: string) => {
      const set = new Set(settings.metricOverlays);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      const next: ChartSettings = { ...settings, metricOverlays: [...set] };
      void updatePreference("chart_settings", next, true);
    },
    [settings, updatePreference],
  );

  // Clear all stat overlays (leaves Confidence / DvP / Pace toggles alone).
  const clearMetricOverlays = useCallback(() => {
    if (settings.metricOverlays.length === 0) return;
    const next: ChartSettings = { ...settings, metricOverlays: [] };
    void updatePreference("chart_settings", next, true);
  }, [settings, updatePreference]);

  return {
    settings,
    setSetting,
    resetSettings,
    toggleMetricOverlay,
    clearMetricOverlays,
  };
}

import type { ReactNode } from "react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

export const DRILLDOWN_SUPPORTED_SPORTS = ["nba", "mlb", "wnba"] as const;
export const DRILLDOWN_ENABLED_SPORTS = ["nba", "mlb"] as const;
export type DrilldownSport = (typeof DRILLDOWN_SUPPORTED_SPORTS)[number];
export type EnabledDrilldownSport = (typeof DRILLDOWN_ENABLED_SPORTS)[number];

export interface DrilldownLoadingProps {
  isMobile: boolean;
}

export interface DrilldownRenderProps {
  profile: HitRateProfile;
  allPlayerProfiles: HitRateProfile[];
  onBack: () => void;
  onMarketChange: (market: string) => void;
  isMobile: boolean;
}

export interface DrilldownSportModule {
  sport: DrilldownSport;
  backLabel: string;
  emptyStateDescription: (playerId: number) => string;
  renderLoading: (props: DrilldownLoadingProps) => ReactNode;
  renderContent: (props: DrilldownRenderProps) => ReactNode;
}

export function isDrilldownSport(value: string): value is EnabledDrilldownSport {
  return DRILLDOWN_ENABLED_SPORTS.includes(value as EnabledDrilldownSport);
}

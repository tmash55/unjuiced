export type HitRateSport = "nba" | "mlb" | "wnba";

export interface HitRateTableConfig {
  seasonAvgLabel: string;
  seasonPctLabel: string;
  showPreviousSeasonAvg: boolean;
  previousSeasonLabel: string;
  columnWidths: number[];
}

const HIT_RATE_TABLE_CONFIG: Record<HitRateSport, HitRateTableConfig> = {
  nba: {
    seasonAvgLabel: "25/26 Avg",
    seasonPctLabel: "25/26",
    showPreviousSeasonAvg: false,
    previousSeasonLabel: "25 SZN",
    // player, matchup, prop, recent, str, l5, l10, l20, season, h2h, defrank, pace, over, under
    columnWidths: [250, 124, 100, 230, 55, 92, 92, 92, 96, 92, 82, 68, 80, 80],
  },
  mlb: {
    seasonAvgLabel: "Season Avg",
    seasonPctLabel: "Season",
    showPreviousSeasonAvg: true,
    previousSeasonLabel: "25 SZN",
    // player, matchup, prop, recent, str, l5, l10, l20, season, h2h, defrank, pace, over, under
    columnWidths: [250, 124, 100, 230, 55, 92, 92, 92, 96, 92, 82, 68, 80, 80],
  },
  wnba: {
    seasonAvgLabel: "25 Avg",
    seasonPctLabel: "25 SZN",
    showPreviousSeasonAvg: false,
    previousSeasonLabel: "24 SZN",
    // player, matchup, prop, recent, str, l5, l10, l20, season, h2h, defrank, pace, over, under
    columnWidths: [250, 124, 100, 230, 55, 92, 92, 92, 96, 92, 82, 68, 80, 80],
  },
};

export function getHitRateTableConfig(sport: HitRateSport): HitRateTableConfig {
  return HIT_RATE_TABLE_CONFIG[sport];
}

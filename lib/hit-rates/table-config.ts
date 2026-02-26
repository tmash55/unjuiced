export type HitRateSport = "nba" | "mlb";

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
    // player, matchup, prop, l5avg, l10avg, seasonavg, str, l5, l10, l20, season, h2h, odds
    columnWidths: [250, 100, 100, 70, 70, 70, 55, 64, 64, 64, 72, 72, 120],
  },
  mlb: {
    seasonAvgLabel: "Season Avg",
    seasonPctLabel: "Season",
    showPreviousSeasonAvg: true,
    previousSeasonLabel: "25 SZN",
    // player, matchup, prop, l5avg, l10avg, seasonavg, prevseason, str, l5, l10, l20, season, h2h, odds
    columnWidths: [250, 100, 100, 70, 70, 70, 75, 55, 64, 64, 64, 72, 72, 120],
  },
};

export function getHitRateTableConfig(sport: HitRateSport): HitRateTableConfig {
  return HIT_RATE_TABLE_CONFIG[sport];
}

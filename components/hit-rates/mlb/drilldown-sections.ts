export type MlbPlayerType = "batter" | "pitcher";

export type MlbDrilldownSectionId =
  | "chart"
  | "matchupContext"
  | "advancedProfile"
  | "sprayChart"
  | "rollingWindows"
  | "oddsComparison"
  | "boxScore";

const PITCHER_MARKETS = new Set<string>([
  "pitcher_strikeouts",
  "pitcher_outs",
  "pitcher_earned_runs",
  "pitcher_hits_allowed",
  "pitcher_walks",
]);

const MLB_SECTION_ORDER: Record<MlbPlayerType, MlbDrilldownSectionId[]> = {
  // Batter-first research stack (skeletons for new data sections).
  batter: [
    "chart",
    "matchupContext",
    "advancedProfile",
    "sprayChart",
    "rollingWindows",
    "oddsComparison",
    "boxScore",
  ],
  // Pitcher stack remains lean until pitcher-specific sections are implemented.
  pitcher: ["chart", "boxScore"],
};

export function resolveMlbPlayerType(market: string | null | undefined): MlbPlayerType {
  if (!market) return "batter";
  return PITCHER_MARKETS.has(market) ? "pitcher" : "batter";
}

export function getMlbSectionOrder(playerType: MlbPlayerType): MlbDrilldownSectionId[] {
  return MLB_SECTION_ORDER[playerType] ?? MLB_SECTION_ORDER.batter;
}

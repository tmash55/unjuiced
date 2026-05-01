export const MLB_ODDS_TO_PROP_MARKET: Record<string, string> = {
  player_home_runs: "hr",
  player_hits: "hits",
  player_total_bases: "tb",
  player_rbis: "rbi",
  player_runs: "runs",
  player_hits__runs__rbis: "h_r_rbi",
  player_stolen_bases: "sb",
};

export const MLB_PROP_MARKET_LABELS: Record<string, string> = {
  hr: "HR",
  hits: "Hits",
  tb: "TB",
  rbi: "RBI",
  runs: "Runs",
  h_r_rbi: "H+R+RBI",
  sb: "SB",
};

export function getMlbPropMarketFromOddsMarket(oddsMarket?: string | null): string {
  if (!oddsMarket) return "hr";
  return MLB_ODDS_TO_PROP_MARKET[oddsMarket] ?? "hr";
}

export function getMlbPropMarketLabel(propMarket?: string | null): string {
  if (!propMarket) return "HR";
  return MLB_PROP_MARKET_LABELS[propMarket] ?? propMarket.toUpperCase();
}

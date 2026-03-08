/**
 * Shared abbreviation rules for market display names.
 * Each rule is a [pattern, replacement] pair applied in order.
 * Easy to extend for new sports / markets.
 */
const ABBREVIATIONS: [RegExp, string][] = [
  // Periods / quarters / halves
  [/\b1st Quarter\b/gi, "1Q"],
  [/\b2nd Quarter\b/gi, "2Q"],
  [/\b3rd Quarter\b/gi, "3Q"],
  [/\b4th Quarter\b/gi, "4Q"],
  [/\b1st Half\b/gi, "1H"],
  [/\b2nd Half\b/gi, "2H"],
  [/\b1st Period\b/gi, "1P"],
  [/\b2nd Period\b/gi, "2P"],
  [/\b3rd Period\b/gi, "3P"],
  [/\b1st Inning\b/gi, "1Inn"],
  [/\bFirst 5 Innings\b/gi, "F5"],

  // Common stat words
  [/\bTotal Points\b/gi, "Pts"],
  [/\bPoints\b/gi, "Pts"],
  [/\bRebounds\b/gi, "Reb"],
  [/\bAssists\b/gi, "Ast"],
  [/\bSteals\b/gi, "Stl"],
  [/\bBlocks\b/gi, "Blk"],
  [/\bTurnovers\b/gi, "TO"],
  [/\bThree Pointers Made\b/gi, "3PM"],
  [/\b3-Pointers Made\b/gi, "3PM"],
  [/\bThree Pointers\b/gi, "3PM"],
  [/\bStrikeouts\b/gi, "K"],
  [/\bHome Runs\b/gi, "HR"],
  [/\bHits Allowed\b/gi, "HA"],
  [/\bTotal Bases\b/gi, "TB"],
  [/\bRuns Batted In\b/gi, "RBI"],
  [/\bPassing Yards\b/gi, "Pass Yds"],
  [/\bRushing Yards\b/gi, "Rush Yds"],
  [/\bReceiving Yards\b/gi, "Rec Yds"],
  [/\bReceptions\b/gi, "Rec"],
  [/\bTouchdowns\b/gi, "TD"],
  [/\bInterceptions\b/gi, "INT"],
  [/\bShots on Goal\b/gi, "SOG"],
  [/\bGoals\b/gi, "G"],

  // Market type prefixes — keep last so stat abbreviations apply first
  [/\bPlayer\s+/gi, ""],
  [/\bAlternate\s+/gi, "Alt "],
];

/**
 * Shorten a market display string using abbreviation rules.
 * e.g. "1st Quarter Total Points" → "1Q Pts"
 */
export function shortenMarketDisplay(raw: string): string {
  let result = raw;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

/**
 * Humanize a raw market key into a title-case label, then abbreviate.
 * e.g. "game_total" → "Game Total", "player_points" → "Pts"
 */
export function humanizeMarketKey(market: string): string {
  const humanized = String(market || "")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return shortenMarketDisplay(humanized);
}

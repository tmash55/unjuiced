export type SportsbookEntry = { id: string; name: string };

/**
 * All active sportsbooks — synced from apps/web/lib/data/sportsbooks.ts.
 * Only books with isActive: true are included.
 * Sorted by priority (highest first), then alphabetically.
 */
export const ALL_SPORTSBOOKS: SportsbookEntry[] = [
  { id: "draftkings", name: "DraftKings" },
  { id: "fanduel", name: "FanDuel" },
  { id: "fanduelyourway", name: "FanDuel YourWay" },
  { id: "bet365", name: "Bet365" },
  { id: "betmgm", name: "BetMGM" },
  { id: "caesars", name: "Caesars" },
  { id: "fanatics", name: "Fanatics" },
  { id: "betrivers", name: "BetRivers" },
  { id: "novig", name: "Novig" },
  { id: "pinnacle", name: "Pinnacle" },
  { id: "thescore", name: "theScore" },
  { id: "bally-bet", name: "Bally Bet" },
  { id: "circa", name: "Circa" },
  { id: "polymarket", name: "Polymarket" },
  { id: "kalshi", name: "Kalshi" },
  { id: "hard-rock", name: "Hard Rock" },
  { id: "prophetx", name: "ProphetX" },
  { id: "fliff", name: "Fliff" },
  { id: "betparx", name: "BetPARX" },
  { id: "bwin", name: "bwin" },
  { id: "betonline", name: "BetOnline" },
  { id: "bovada", name: "Bovada" },
  { id: "sports-interaction", name: "Sports Interaction" },
];

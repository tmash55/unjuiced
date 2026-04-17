// Maps from common odds API team name formats to standard MLB tricode.
// Odds providers (FanDuel, DraftKings, etc.) often use full city+mascot names
// or just mascot names that don't match the MLB Stats API abbreviations.
const ODDS_TEAM_ALIASES: Record<string, string> = {
  // Full names
  "new york yankees": "NYY",
  "new york mets": "NYM",
  "boston red sox": "BOS",
  "los angeles dodgers": "LAD",
  "los angeles angels": "LAA",
  "anaheim angels": "LAA",
  "chicago cubs": "CHC",
  "chicago white sox": "CHW",
  "milwaukee brewers": "MIL",
  "atlanta braves": "ATL",
  "houston astros": "HOU",
  "philadelphia phillies": "PHI",
  "san francisco giants": "SF",
  "san diego padres": "SD",
  "toronto blue jays": "TOR",
  "texas rangers": "TEX",
  "cleveland guardians": "CLE",
  "detroit tigers": "DET",
  "minnesota twins": "MIN",
  "kansas city royals": "KC",
  "colorado rockies": "COL",
  "arizona diamondbacks": "AZ",
  "seattle mariners": "SEA",
  "tampa bay rays": "TB",
  "miami marlins": "MIA",
  "baltimore orioles": "BAL",
  "washington nationals": "WSH",
  "pittsburgh pirates": "PIT",
  "cincinnati reds": "CIN",
  "oakland athletics": "OAK",
  "athletics": "OAK",
  "st. louis cardinals": "STL",
  "st louis cardinals": "STL",
  // Mascot-only names (what FanDuel/DK commonly send)
  "yankees": "NYY",
  "mets": "NYM",
  "red sox": "BOS",
  "dodgers": "LAD",
  "angels": "LAA",
  "cubs": "CHC",
  "white sox": "CHW",
  "brewers": "MIL",
  "braves": "ATL",
  "astros": "HOU",
  "phillies": "PHI",
  "giants": "SF",
  "padres": "SD",
  "blue jays": "TOR",
  "rangers": "TEX",
  "guardians": "CLE",
  "tigers": "DET",
  "twins": "MIN",
  "royals": "KC",
  "rockies": "COL",
  "diamondbacks": "AZ",
  "d-backs": "AZ",
  "dbacks": "AZ",
  "mariners": "SEA",
  "rays": "TB",
  "marlins": "MIA",
  "orioles": "BAL",
  "nationals": "WSH",
  "pirates": "PIT",
  "reds": "CIN",
  "cardinals": "STL",
  // Tricode passthrough (odds API sometimes sends abbreviations directly)
  "nyy": "NYY",
  "nym": "NYM",
  "bos": "BOS",
  "lad": "LAD",
  "laa": "LAA",
  "chc": "CHC",
  "chw": "CHW",
  "cws": "CHW",
  "mil": "MIL",
  "atl": "ATL",
  "hou": "HOU",
  "phi": "PHI",
  "sf": "SF",
  "sd": "SD",
  "tor": "TOR",
  "tex": "TEX",
  "cle": "CLE",
  "det": "DET",
  "min": "MIN",
  "kc": "KC",
  "col": "COL",
  "ari": "AZ",
  "az": "AZ",
  "sea": "SEA",
  "tb": "TB",
  "mia": "MIA",
  "bal": "BAL",
  "wsh": "WSH",
  "pit": "PIT",
  "cin": "CIN",
  "oak": "OAK",
  "stl": "STL",
};

/**
 * Resolves an odds API team name to a standard MLB tricode, or null if unknown.
 */
export function getOddsTeamTricode(oddsName: string): string | null {
  if (!oddsName) return null;
  return ODDS_TEAM_ALIASES[oddsName.toLowerCase().trim()] ?? null;
}

/**
 * Matches an odds API team name against a game's home/away teams.
 * Returns 'home', 'away', or null if no confident match.
 *
 * Resolution order:
 * 1. Tricode lookup from ODDS_TEAM_ALIASES
 * 2. Full name substring match against game team names
 * 3. Last-word match (least reliable, used as final fallback)
 */
export function matchOddsTeamSide(
  oddsName: string,
  game: {
    home_team_name: string;
    home_team_tricode: string;
    away_team_name: string;
    away_team_tricode: string;
  },
): "home" | "away" | null {
  if (!oddsName) return null;

  const normalized = oddsName.toLowerCase().trim();

  // 1. Tricode lookup
  const tricode = ODDS_TEAM_ALIASES[normalized];
  if (tricode) {
    if (tricode === game.home_team_tricode) return "home";
    if (tricode === game.away_team_tricode) return "away";
  }

  // 2. Full name substring match
  const homeNorm = game.home_team_name.toLowerCase();
  const awayNorm = game.away_team_name.toLowerCase();

  if (homeNorm.includes(normalized) || normalized.includes(homeNorm)) return "home";
  if (awayNorm.includes(normalized) || normalized.includes(awayNorm)) return "away";

  // 3. Last-word fallback (handles "Yankees" from "New York Yankees")
  const oddsLast = normalized.split(" ").pop() ?? "";
  if (oddsLast.length >= 3) {
    if (homeNorm.split(" ").pop() === oddsLast || homeNorm.includes(oddsLast)) return "home";
    if (awayNorm.split(" ").pop() === oddsLast || awayNorm.includes(oddsLast)) return "away";
  }

  return null;
}

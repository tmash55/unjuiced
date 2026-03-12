import { mobileEnv } from "@/src/config/env";

const SPORTSBOOK_LOGO_BY_ID: Record<string, string> = {
  ballybet: "/images/sports-books/ballybet.png",
  "bally-bet": "/images/sports-books/ballybet.png",
  bet365: "/images/sports-books/bet365.png",
  betmgm: "/images/sports-books/betmgm.png",
  betonline: "/images/sports-books/betonline.png",
  betrivers: "/images/sports-books/betrivers.png",
  betparx: "/images/sports-books/betparx.png",
  bovada: "/images/sports-books/bovada.png",
  bwin: "/images/sports-books/bwin.png",
  caesars: "/images/sports-books/caesars.png",
  circa: "/images/sports-books/circa.png",
  draftkings: "/images/sports-books/draftkings.png",
  espn: "/images/sports-books/espnbet.png",
  espnbet: "/images/sports-books/espnbet.png",
  fanatics: "/images/sports-books/fanatics.png",
  fanduel: "/images/sports-books/fanduel.png",
  fanduelyourway: "/images/sports-books/fanduel_yourway.png",
  "fanduel-yourway": "/images/sports-books/fanduel_yourway.png",
  fliff: "/images/sports-books/fliff.png",
  hardrock: "/images/sports-books/hardrockbet.png",
  hardrockbet: "/images/sports-books/hardrockbet.png",
  "hard-rock": "/images/sports-books/hardrockbet.png",
  kalshi: "/images/sports-books/kalshi.png",
  novig: "/images/sports-books/novig.png",
  pinnacle: "/images/sports-books/pinnacle.png",
  polymarket: "/images/sports-books/polymarket.png",
  prophetx: "/images/sports-books/prophetx.png",
  rebet: "/images/sports-books/rebet.png",
  sportsinteraction: "/images/sports-books/sportsinteraction.png",
  "sports-interaction": "/images/sports-books/sportsinteraction.png",
  thescore: "/images/sports-books/thescore.png"
};

/** Per-sport abbreviation fixups so team abbreviations from the API match logo filenames */
const TEAM_ABBR_FIXUPS: Record<string, Record<string, string>> = {
  nba:   { was: "wsh", nop: "no", uta: "utah" },
  ncaab: { was: "wsh", nop: "no", uta: "utah" },
  nhl:   {},
  nfl:   { la: "lar", was: "wsh" },
  mlb:   { ari: "az", cws: "chw" },
  wnba:  {},
};

/**
 * Maps sport keys to the team-logos folder. NCAAB shares logos with NCAAF.
 * Logos are SVGs served from /public/team-logos/{folder}/{ABBR}.svg.
 * To add a new sport, just add an entry here.
 */
const LOGO_SPORT_FOLDER: Record<string, string> = {
  nba: "nba",
  ncaab: "ncaaf",
  nhl: "nhl",
  nfl: "nfl",
  mlb: "mlb",
  wnba: "wnba",
  ncaaf: "ncaaf",
};

function baseAssetUrl(): string {
  return mobileEnv.apiBaseUrl.replace(/\/$/, "");
}

export function normalizeSportsbookId(id: string | null | undefined): string {
  if (!id) return "";
  const raw = id.toLowerCase().trim();
  const map: Record<string, string> = {
    ballybet: "bally-bet",
    hardrock: "hard-rock",
    hardrockbet: "hard-rock",
    "hard-rock-indiana": "hard-rock",
    espnbet: "espn",
    "fanduel-yourway": "fanduelyourway",
    fanduel_yourway: "fanduelyourway",
    "betmgm-michigan": "betmgm",
    betmgm_michigan: "betmgm",
    "sports-interaction": "sports-interaction",
    fliff_us: "fliff",
    "fliff-us": "fliff",
    getfliff: "fliff"
  };
  return map[raw] ?? raw;
}

export function getSportsbookLogoUrl(bookId: string | null | undefined): string | null {
  const normalizedId = normalizeSportsbookId(bookId);
  if (!normalizedId) return null;
  const path = SPORTSBOOK_LOGO_BY_ID[normalizedId];
  if (!path) return null;
  return `${baseAssetUrl()}${path}`;
}

/**
 * Team logo SVG URL served from our web app's /public/team-logos/.
 * Use with <SvgUri> from react-native-svg (not <Image>).
 * To add a new sport, add an entry to LOGO_SPORT_FOLDER and optionally TEAM_ABBR_FIXUPS.
 */
export function getTeamLogoUrl(teamAbbr: string | null | undefined, sport: string): string | null {
  if (!teamAbbr) return null;
  const sportLower = sport.toLowerCase();
  const folder = LOGO_SPORT_FOLDER[sportLower];
  if (!folder) return null;
  const fixups = TEAM_ABBR_FIXUPS[sportLower] ?? {};
  const normalized = teamAbbr.toLowerCase().trim();
  const key = fixups[normalized] ?? normalized;
  return `${baseAssetUrl()}/team-logos/${folder}/${key.toUpperCase()}.svg`;
}

/** @deprecated Use getTeamLogoUrl(abbr, "nba") instead */
export function getNbaTeamLogoUrl(teamAbbr: string | null | undefined): string | null {
  return getTeamLogoUrl(teamAbbr, "nba");
}

/**
 * Sharp Line Presets
 * 
 * Pre-configured book blends for calculating true odds / EV
 * Users can select these or create custom blends
 */

export interface SharpPreset {
  id: string;
  name: string;
  description: string;
  books: { book: string; weight: number }[];
  // Which sports/markets this preset is recommended for
  recommended?: {
    sports?: string[];
    marketTypes?: ("props" | "game_lines" | "futures")[];
  };
  // Is this available to free users?
  tier: "free" | "pro";
}

/**
 * Default presets available to all users
 */
export const SHARP_PRESETS: SharpPreset[] = [
  // === SINGLE SHARP BOOK ===
  {
    id: "pinnacle",
    name: "Pinnacle",
    description: "Industry standard sharp book, best for international markets",
    books: [{ book: "pinnacle", weight: 1.0 }],
    recommended: {
      sports: ["nba", "nfl", "mlb", "nhl", "soccer"],
      marketTypes: ["props", "game_lines"],
    },
    tier: "free",
  },
  {
    id: "circa",
    name: "Circa Sports",
    description: "Sharp US book, especially strong on NFL",
    books: [{ book: "circa", weight: 1.0 }],
    recommended: {
      sports: ["nfl", "ncaaf", "nba"],
      marketTypes: ["game_lines"],
    },
    tier: "free",
  },

  // === MARKET AVERAGE ===
  {
    id: "average",
    name: "Market Average",
    description: "Average across all available books",
    books: [], // Empty = use average
    tier: "free",
  },

  // === BLENDED SHARP LINES ===
  {
    id: "pinnacle_circa",
    name: "Pinnacle + Circa Blend",
    description: "50/50 blend of top sharp books",
    books: [
      { book: "pinnacle", weight: 0.5 },
      { book: "circa", weight: 0.5 },
    ],
    recommended: {
      sports: ["nfl", "nba"],
      marketTypes: ["game_lines"],
    },
    tier: "pro",
  },
  {
    id: "sharp_consensus",
    name: "Sharp Consensus",
    description: "60% Pinnacle, 25% Circa, 15% BetCRIS",
    books: [
      { book: "pinnacle", weight: 0.6 },
      { book: "circa", weight: 0.25 },
      { book: "betcris", weight: 0.15 },
    ],
    recommended: {
      sports: ["nfl", "nba", "mlb"],
      marketTypes: ["game_lines"],
    },
    tier: "pro",
  },

  // === PROPS-SPECIFIC ===
  {
    id: "props_sharp",
    name: "Props Sharp Line",
    description: "Pinnacle weighted heavily for player props",
    books: [
      { book: "pinnacle", weight: 0.7 },
      { book: "fanduel", weight: 0.3 },
    ],
    recommended: {
      marketTypes: ["props"],
    },
    tier: "pro",
  },
  {
    id: "dk_fd_blend",
    name: "DraftKings + FanDuel",
    description: "Major US books blend for props comparison",
    books: [
      { book: "draftkings", weight: 0.5 },
      { book: "fanduel", weight: 0.5 },
    ],
    recommended: {
      marketTypes: ["props"],
    },
    tier: "pro",
  },

  // === SPORT-SPECIFIC ===
  {
    id: "nfl_sharp",
    name: "NFL Sharp Line",
    description: "Circa-heavy blend for NFL (Circa has best NFL limits)",
    books: [
      { book: "circa", weight: 0.6 },
      { book: "pinnacle", weight: 0.4 },
    ],
    recommended: {
      sports: ["nfl", "ncaaf"],
      marketTypes: ["game_lines"],
    },
    tier: "pro",
  },
  {
    id: "nba_sharp",
    name: "NBA Sharp Line",
    description: "Pinnacle-heavy for NBA player props",
    books: [
      { book: "pinnacle", weight: 0.65 },
      { book: "circa", weight: 0.35 },
    ],
    recommended: {
      sports: ["nba"],
    },
    tier: "pro",
  },
];

/**
 * Get preset by ID
 */
export function getPreset(id: string): SharpPreset | undefined {
  return SHARP_PRESETS.find((p) => p.id === id);
}

/**
 * Get presets for a specific sport/market type
 */
export function getRecommendedPresets(
  sport?: string,
  marketType?: "props" | "game_lines" | "futures"
): SharpPreset[] {
  return SHARP_PRESETS.filter((preset) => {
    // If no recommendations, it's universal
    if (!preset.recommended) return true;

    const { sports, marketTypes } = preset.recommended;

    // Check sport match
    if (sports && sport && !sports.includes(sport)) {
      return false;
    }

    // Check market type match
    if (marketTypes && marketType && !marketTypes.includes(marketType)) {
      return false;
    }

    return true;
  });
}

/**
 * Convert preset to blend query param format
 */
export function presetToBlendParam(preset: SharpPreset): string | null {
  if (preset.books.length === 0) return null; // "average" preset
  return preset.books.map((b) => `${b.book}:${b.weight}`).join(",");
}

/**
 * Parse blend string to books array
 */
export function parseBlendParam(
  blendStr: string
): { book: string; weight: number }[] | null {
  if (!blendStr) return null;

  const books: { book: string; weight: number }[] = [];
  const parts = blendStr.split(",");

  for (const part of parts) {
    const [book, weightStr] = part.split(":");
    const weight = parseFloat(weightStr);
    if (book && !isNaN(weight) && weight > 0 && weight <= 1) {
      books.push({ book: book.toLowerCase(), weight });
    }
  }

  // Validate weights sum to ~1.0
  const totalWeight = books.reduce((sum, b) => sum + b.weight, 0);
  if (books.length === 0 || Math.abs(totalWeight - 1) > 0.01) {
    return null;
  }

  return books;
}

/**
 * Default preset for different contexts
 */
export const DEFAULT_PRESETS = {
  // Free users default
  free: "pinnacle",
  // Pro users default
  pro: "sharp_consensus",
  // Sport-specific defaults
  nfl: "nfl_sharp",
  nba: "nba_sharp",
  props: "props_sharp",
} as const;


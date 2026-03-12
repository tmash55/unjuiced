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
  // === SHARP BOOKS ===
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
    id: "prophetx",
    name: "ProphetX",
    description: "Sharp prop pricing model",
    books: [{ book: "prophetx", weight: 1.0 }],
    recommended: { marketTypes: ["props"] },
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
  {
    id: "novig",
    name: "Novig",
    description: "Zero-vig exchange pricing",
    books: [{ book: "novig", weight: 1.0 }],
    tier: "free",
  },
  {
    id: "betonline",
    name: "BetOnline",
    description: "Offshore sharp-friendly book",
    books: [{ book: "betonline", weight: 1.0 }],
    tier: "free",
  },

  // === BLENDS ===
  {
    id: "pinnacle_circa",
    name: "Pinnacle + Circa",
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
    id: "hardrock_thescore",
    name: "Hard Rock + theScore",
    description: "Hard Rock and theScore blend",
    books: [
      { book: "hardrock", weight: 0.5 },
      { book: "thescore", weight: 0.5 },
    ],
    tier: "pro",
  },

  // === MARKET AVERAGE ===
  {
    id: "market_average",
    name: "Market Average",
    description: "Average across all available books",
    books: [],
    tier: "free",
  },

  // === MAJOR US BOOKS ===
  {
    id: "draftkings",
    name: "DraftKings",
    description: "DraftKings as reference source",
    books: [{ book: "draftkings", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "fanduel",
    name: "FanDuel",
    description: "FanDuel as reference source",
    books: [{ book: "fanduel", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "betmgm",
    name: "BetMGM",
    description: "BetMGM as reference source",
    books: [{ book: "betmgm", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "caesars",
    name: "Caesars",
    description: "Caesars as reference source",
    books: [{ book: "caesars", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "hardrock",
    name: "Hard Rock",
    description: "Hard Rock Bet as reference source",
    books: [{ book: "hardrock", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "bet365",
    name: "bet365",
    description: "bet365 as reference source",
    books: [{ book: "bet365", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "betrivers",
    name: "BetRivers",
    description: "BetRivers as reference source",
    books: [{ book: "betrivers", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "fanatics",
    name: "Fanatics",
    description: "Fanatics as reference source",
    books: [{ book: "fanatics", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "thescore",
    name: "theScore",
    description: "theScore as reference source",
    books: [{ book: "thescore", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "ballybet",
    name: "Bally Bet",
    description: "Bally Bet as reference source",
    books: [{ book: "ballybet", weight: 1.0 }],
    tier: "pro",
  },

  // === PREDICTION MARKETS ===
  {
    id: "kalshi",
    name: "Kalshi",
    description: "Prediction market exchange",
    books: [{ book: "kalshi", weight: 1.0 }],
    tier: "pro",
  },
  {
    id: "polymarket",
    name: "Polymarket",
    description: "Prediction market exchange",
    books: [{ book: "polymarket", weight: 1.0 }],
    tier: "pro",
  },

  // === CUSTOM ===
  {
    id: "custom",
    name: "Custom",
    description: "Build your own blend",
    books: [],
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
  free: "pinnacle",
  pro: "pinnacle_circa",
  nfl: "circa",
  nba: "pinnacle",
  props: "pinnacle",
} as const;


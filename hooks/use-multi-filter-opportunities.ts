/**
 * Hook for fetching opportunities with multiple filter support
 * 
 * HYBRID APPROACH:
 * - Preset Mode: Fetches a league/market-scoped broad dataset, then filters
 *   user-specific controls client-side for instant odds/search/book changes
 * - Custom Mode: Server-side filtering for custom blend calculations
 * 
 * Handles parallel API calls for multiple active custom filters,
 * merges results, and deduplicates (best edge wins).
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import {
  type Opportunity,
  type OpportunityFilters,
  type FilterConfig,
  type Sport,
  DEFAULT_FILTERS,
  parseOpportunity,
  formatAmericanOdds,
} from "@/lib/types/opportunities";
import { normalizeSportsbookId, getSportsbookById } from "@/lib/data/sportsbooks";
import {
  DEFAULT_FILTER_COLOR,
  FILTER_PRESET_EMPTY_SPORT_MARKET,
  type FilterPreset,
  parseSports,
  parseFilterPresetSportMarketKey,
  getSportIcon,
} from "@/lib/types/filter-presets";
import { type BestOddsPrefs } from "@/lib/best-odds-schema";
import { isMarketSelected } from "@/lib/utils";

const ALL_SPORTS: Sport[] = [
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaaf",
  "ncaab",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
];

const LEAGUE_TO_SPORT: Record<string, Sport> = {
  nba: "nba",
  nfl: "nfl",
  ncaaf: "ncaaf",
  ncaab: "ncaab",
  nhl: "nhl",
  mlb: "mlb",
  ncaabaseball: "ncaabaseball",
  wnba: "wnba",
  soccer_epl: "soccer_epl",
  soccer_laliga: "soccer_laliga",
  soccer_mls: "soccer_mls",
  soccer_ucl: "soccer_ucl",
  soccer_uel: "soccer_uel",
  tennis_atp: "tennis_atp",
  tennis_challenger: "tennis_challenger",
  tennis_itf_men: "tennis_itf_men",
  tennis_itf_women: "tennis_itf_women",
  tennis_utr_men: "tennis_utr_men",
  tennis_utr_women: "tennis_utr_women",
  tennis_wta: "tennis_wta",
  ufc: "ufc",
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizeSelectedSports(selectedLeagues: unknown): Sport[] {
  const selectedSports = toStringArray(selectedLeagues)
    .map((league) => LEAGUE_TO_SPORT[league.toLowerCase()])
    .filter((sport): sport is Sport => !!sport);

  if (selectedSports.length === 0) return ALL_SPORTS;

  const uniqueSports = uniqueSorted(selectedSports) as Sport[];
  return uniqueSports.length === ALL_SPORTS.length ? ALL_SPORTS : uniqueSports;
}

function buildPresetServerMarketFilter(selectedMarkets: unknown, sports: Sport[]): string[] {
  const sportSet = new Set(sports);
  const markets = toStringArray(selectedMarkets)
    .map((market) => market.toLowerCase())
    .flatMap((market) => {
      const [sport, sportMarket] = market.split(":");
      if (sportMarket) {
        return sportSet.has(sport as Sport) ? [sportMarket] : [];
      }
      return [market];
    });

  return uniqueSorted(markets);
}

function buildPresetFetchScopeKey(prefs: BestOddsPrefs): string {
  const sports = normalizeSelectedSports(prefs.selectedLeagues as unknown);
  const markets = buildPresetServerMarketFilter(prefs.selectedMarkets as unknown, sports);
  return JSON.stringify({
    sports,
    markets,
  });
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        return toStringArray(JSON.parse(trimmed));
      } catch {
        // Ignore parse errors and continue fallback parsing.
      }
    }

    if (trimmed.includes(",")) {
      return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

function toNumberRecord(value: unknown): Record<string, number[]> {
  const normalize = (raw: unknown): Record<string, number[]> => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const out: Record<string, number[]> = {};
    for (const [key, arr] of Object.entries(raw as Record<string, unknown>)) {
      if (!Array.isArray(arr)) continue;
      const nums = arr
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
      if (nums.length > 0) out[key] = nums;
    }
    return out;
  };

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return normalize(JSON.parse(trimmed));
    } catch {
      return {};
    }
  }

  return normalize(value);
}

function toNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function normalizeBlendBookId(book: string): string {
  const lower = book.toLowerCase().trim();
  const normalized = normalizeSportsbookId(lower);
  const aliases: Record<string, string> = {
    hardrock: "hard-rock",
    "hard-rock-bet": "hard-rock",
    hardrockbet: "hard-rock",
    espnbet: "espn",
    "espn-bet": "espn",
    ballybet: "bally-bet",
    bally_bet: "bally-bet",
    "bet-rivers": "betrivers",
    bet_rivers: "betrivers",
  };
  return aliases[normalized] ?? aliases[lower] ?? normalized;
}

function normalizeWeightValue(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
}

function buildBlendFromPreset(
  sharpBooks: string[],
  bookWeights: Record<string, number>
): Array<{ book: string; weight: number }> | null {
  if (sharpBooks.length === 0) return null;

  const canonicalBooks: string[] = [];
  const seenBooks = new Set<string>();
  for (const book of sharpBooks) {
    const canonical = normalizeBlendBookId(book);
    if (!canonical || seenBooks.has(canonical)) continue;
    seenBooks.add(canonical);
    canonicalBooks.push(canonical);
  }
  if (canonicalBooks.length === 0) return null;

  const normalizedWeights = new Map<string, number>();
  for (const [book, rawWeight] of Object.entries(bookWeights)) {
    const canonical = normalizeBlendBookId(book);
    const weight = normalizeWeightValue(rawWeight);
    if (weight <= 0) continue;
    normalizedWeights.set(canonical, (normalizedWeights.get(canonical) ?? 0) + weight);
  }

  let blend: Array<{ book: string; weight: number }> = [];
  if (normalizedWeights.size > 0) {
    blend = canonicalBooks
      .map((book) => ({ book, weight: normalizedWeights.get(book) ?? 0 }))
      .filter((entry) => entry.weight > 0);
  }

  // If provided weights don't map cleanly, fall back to equal weighting.
  if (blend.length === 0 || blend.length < canonicalBooks.length) {
    const equalWeight = 1 / canonicalBooks.length;
    blend = canonicalBooks.map((book) => ({ book, weight: equalWeight }));
  }

  const totalWeight = blend.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return null;

  return blend.map((entry) => ({ ...entry, weight: entry.weight / totalWeight }));
}

interface UseMultiFilterOptions {
  /**
   * Global user preferences (books to exclude, min edge, search, etc.)
   */
  prefs: BestOddsPrefs;
  /**
   * Active custom filter presets
   */
  activePresets: FilterPreset[];
  /**
   * Whether user has pro access
   */
  isPro: boolean;
  /**
   * Optional result limit override (default: 200 for Pro, 50 for free)
   */
  limit?: number;
  /**
   * Enable/disable the query
   */
  enabled?: boolean;
}

interface UseMultiFilterResult {
  // Data
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
  
  // Active filters info
  activeFilters: FilterConfig[];
  isCustomMode: boolean;
  
  // State
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  
  /** Timestamp of last successful data fetch (for freshness indicator) */
  dataUpdatedAt: number | null;
  /** Whether data is stale and being refreshed in background */
  isStale: boolean;
  /** Progressive loading: true when initial batch loaded but full batch still loading */
  isLoadingMore: boolean;
  /** Progressive loading: percentage of full data loaded (0-100) */
  loadProgress: number;
  
  // Actions
  refetch: () => Promise<void>;
  /** Prefetch data for a preset (call on hover for faster activation) */
  prefetchPreset: (preset: FilterPreset) => Promise<void>;
}

// Progressive loading configuration
const INITIAL_BATCH_SIZE = 50; // Show first 50 results fast
const FULL_BATCH_SIZE = 1500; // Then load larger batch in background
const PRESET_STALE_TIME_MS = 5_000;
const CUSTOM_STALE_TIME_MS = 45_000;

/**
 * Build filter configurations from active presets
 * 
 * HYBRID APPROACH for Preset Mode:
 * - Fetches only the selected sports/leagues so server-side top-N does not
 *   starve a selected league behind higher-edge rows from other sports.
 * - Sends explicit market selections when possible for the same reason.
 * - Keeps odds/search/book-exclusion filters client-side for instant changes.
 */
function buildFilterConfigs(
  prefs: BestOddsPrefs,
  activePresets: FilterPreset[],
  isPro: boolean,
  limit: number,
  phase: "initial" | "full" = "full"
): FilterConfig[] {
  // If no active presets, use preset mode (single filter from prefs)
  // HYBRID: Fetch broad odds, but scope sports/markets server-side.
  if (activePresets.length === 0) {
    let preset: string | null = null;
    let filterName: string;

    // Map comparison mode to preset and generate filter name
    if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
      preset = prefs.comparisonBook;
      const book = getSportsbookById(prefs.comparisonBook);
      filterName = `vs ${book?.name || prefs.comparisonBook}`;
    } else if (prefs.comparisonMode === "next_best") {
      preset = "next_best";
      filterName = "vs Next Best";
    } else {
      preset = "average";
      filterName = "vs Average";
    }

    // Use user preferences for odds range when set, otherwise use broad fallback
    const broadLimit = isPro
      ? (phase === "initial" ? Math.max(limit, 500) : Math.max(limit, FULL_BATCH_SIZE))
      : Math.max(limit, 100);
    
    // Always send broad defaults to server — odds range is filtered client-side
    // This avoids refetching when user changes odds range slider
    const safeMarketLines = toNumberRecord(prefs.marketLines as unknown);
    const fetchSports = normalizeSelectedSports(prefs.selectedLeagues as unknown);
    const serverMarkets = buildPresetServerMarketFilter(prefs.selectedMarkets as unknown, fetchSports);

    return [{
      filters: {
        ...DEFAULT_FILTERS,
        sports: fetchSports,
        preset,
        blend: null,
        limit: broadLimit, // Larger batch for client-side filtering
        minEdge: 0, // Fetch all edges, filter client-side
        minOdds: -10000, // Broad range — client-side filtering narrows
        maxOdds: 100000, // Broad range — client-side filtering narrows
        searchQuery: "", // Search is client-side
        selectedBooks: [], // Book exclusions are client-side
        selectedMarkets: serverMarkets,
        selectedLeagues: fetchSports,
        marketLines: safeMarketLines, // Market lines stay server-side (specific line filters)
        minBooksPerSide: 2,
        requireFullBlend: false,
        marketType: "all",
      },
      metadata: {
        filterId: "default",
        filterName,
        filterIcon: fetchSports.join(","),
        isCustom: false,
        filterColor: null,
      },
    }];
  }

  // Build filter configs for each active preset
  // For multi-sport presets, split into separate configs per sport for balanced results
  const configs: FilterConfig[] = [];
  
  for (const preset of activePresets) {
    const presetSports = parseSports(typeof preset.sport === "string" ? preset.sport : "");
    // Convert to lowercase for mapping (handles both "NBA" and "nba")
    const sports = presetSports
      .map(s => LEAGUE_TO_SPORT[s.toLowerCase()])
      .filter((s): s is Sport => !!s);
    
    // Build blend from preset's sharp_books and book_weights
    const presetSharpBooks = toStringArray((preset as any).sharp_books);
    const presetBookWeights = toNumberMap((preset as any).book_weights);
    const blend = buildBlendFromPreset(presetSharpBooks, presetBookWeights);

    // Use preset's custom markets if defined, otherwise use global or empty
    const presetMarkets = toStringArray((preset as any).markets);
    const parsedCompositeMarkets = presetMarkets
      .map(parseFilterPresetSportMarketKey)
      .filter((value): value is { sport: string; market: string } => value !== null);
    const hasCompositeMarkets = parsedCompositeMarkets.length > 0;
    
    // Never silently collapse custom presets to just NBA.
    // If preset sport serialization is malformed/missing, default to all sports.
    const validSports = sports.length > 0 ? sports : ALL_SPORTS;
    
    // For multi-sport presets, create separate configs per sport for balanced results
    if (validSports.length > 1) {
      // Split limit evenly across sports (with minimum of 50 per sport)
      const perSportLimit = Math.max(50, Math.floor(limit / validSports.length));
      
      console.log(`[useMultiFilter] Multi-sport preset "${preset.name}" - splitting into ${validSports.length} separate fetches (${perSportLimit} per sport)`);
      
      for (const sport of validSports) {
        const sportEntries = parsedCompositeMarkets.filter((entry) => entry.sport === sport);
        const sportMarkets = sportEntries
          .map((entry) => entry.market)
          .filter((market) => market !== FILTER_PRESET_EMPTY_SPORT_MARKET);
        const hasSportCustomization = sportEntries.length > 0;

        if (hasSportCustomization && sportMarkets.length === 0) {
          continue;
        }

        configs.push({
          filters: {
            ...DEFAULT_FILTERS,
            sports: [sport],
            preset: null,
            blend,
            limit: perSportLimit,
            minEdge: prefs.minImprovement || 0,
            minOdds: preset.min_odds ?? -500,
            maxOdds: preset.max_odds ?? 500,
            searchQuery: prefs.searchQuery || "",
            selectedBooks: prefs.selectedBooks || [],
            selectedMarkets: hasSportCustomization ? sportMarkets : (hasCompositeMarkets ? [] : presetMarkets),
            selectedLeagues: [],
            marketLines: {},
            minBooksPerSide: preset.min_books_reference || 2,
            requireFullBlend: preset.fallback_mode !== "use_fallback",
            marketType: hasCompositeMarkets ? "all" : (preset.market_type || "all"),
          },
          metadata: {
            filterId: preset.id,
            filterName: preset.name,
            filterIcon: validSports.join(","), // Keep full icon list for display
            isCustom: true,
            filterColor: preset.color || DEFAULT_FILTER_COLOR,
          },
        });
      }
    } else {
      // Single sport - create one config
      const singleSport = validSports[0];
      const sportEntries = parsedCompositeMarkets.filter((entry) => entry.sport === singleSport);
      const singleSportMarkets = sportEntries
        .map((entry) => entry.market)
        .filter((market) => market !== FILTER_PRESET_EMPTY_SPORT_MARKET);
      const hasSportCustomization = sportEntries.length > 0;

      if (hasCompositeMarkets && hasSportCustomization && singleSportMarkets.length === 0) {
        continue;
      }

      console.log(`[useMultiFilter] Building config for preset "${preset.name}":`, {
        sports: validSports,
        presetMarkets: presetMarkets.length > 0 ? presetMarkets : '(all markets)',
        marketType: preset.market_type,
        blendBooks: blend?.map(b => b.book),
      });

      configs.push({
        filters: {
          ...DEFAULT_FILTERS,
          sports: validSports,
          preset: null,
          blend,
          limit,
          minEdge: prefs.minImprovement || 0,
          minOdds: preset.min_odds ?? -500,
          maxOdds: preset.max_odds ?? 500,
          searchQuery: prefs.searchQuery || "",
          selectedBooks: prefs.selectedBooks || [],
          selectedMarkets: hasCompositeMarkets
            ? singleSportMarkets
            : presetMarkets,
          selectedLeagues: [],
          marketLines: {},
          minBooksPerSide: preset.min_books_reference || 2,
          requireFullBlend: preset.fallback_mode !== "use_fallback",
          marketType: hasCompositeMarkets ? "all" : (preset.market_type || "all"),
        },
        metadata: {
          filterId: preset.id,
          filterName: preset.name,
          filterIcon: validSports.join(","),
          isCustom: true,
          filterColor: preset.color || DEFAULT_FILTER_COLOR,
        },
      });
    }
  }
  
  return configs;
}

/**
 * Build query params from filters
 */
function buildQueryParams(filters: OpportunityFilters, isPro: boolean): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }

  const selectedMarkets = toStringArray(filters.selectedMarkets as unknown);
  if (selectedMarkets.length > 0) {
    console.log(`[useMultiFilter] Sending ${selectedMarkets.length} markets to API:`, selectedMarkets.slice(0, 5), selectedMarkets.length > 5 ? '...' : '');
    params.set("markets", selectedMarkets.join(","));
  } else {
    console.log(`[useMultiFilter] No market filter - will return all markets`);
  }

  if (filters.blend && filters.blend.length > 0) {
    params.set("blend", filters.blend.map((b) => `${b.book}:${b.weight}`).join(","));
  } else if (filters.preset) {
    params.set("preset", filters.preset);
  }

  if (filters.minEdge > 0) params.set("minEdge", String(filters.minEdge));
  if (filters.minEV !== null) params.set("minEV", String(filters.minEV));
  if (filters.requireTwoWay) params.set("requireTwoWay", "true");
  if (filters.requireFullBlend) params.set("requireFullBlend", "true");
  if (filters.marketType && filters.marketType !== "all") {
    params.set("marketType", filters.marketType);
  }
  
  // Market line filters (e.g., {"touchdowns": [0.5]} to only show "Anytime" touchdowns)
  const marketLines = toNumberRecord(filters.marketLines as unknown);
  if (Object.keys(marketLines).length > 0) {
    params.set("marketLines", JSON.stringify(marketLines));
  }
  
  params.set("minBooksPerSide", String(filters.minBooksPerSide));

  // Always send odds range (server defaults may differ)
  params.set("minOdds", String(filters.minOdds));
  params.set("maxOdds", String(filters.maxOdds));

  const sortValue = filters.sortBy === "ev_pct" ? "ev" : "edge";
  params.set("sort", sortValue);
  params.set("limit", String(filters.limit || (isPro ? 200 : 50)));

  return params;
}

/**
 * Fetch opportunities for a single filter
 * Supports AbortController for request cancellation (billion-dollar UX)
 */
async function fetchFilterOpportunities(
  config: FilterConfig,
  isPro: boolean,
  signal?: AbortSignal
): Promise<{
  opportunities: Opportunity[];
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
  config: FilterConfig;
}> {
  const params = buildQueryParams(config.filters, isPro);
  const url = `/api/v2/opportunities?${params.toString()}`;

  const response = await fetch(url, { 
    cache: "no-store",
    signal, // Support request cancellation
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
  }

  const data = await response.json();

  // Parse and tag each opportunity with filter metadata
  const opportunities = (data.opportunities || []).map((raw: Record<string, unknown>) => {
    const opp = parseOpportunity(raw);
    return {
      ...opp,
      filterId: config.metadata.filterId,
      filterName: config.metadata.filterName,
      filterIcon: config.metadata.filterIcon,
      filterColor: config.metadata.filterColor,
    };
  });

  return {
    opportunities,
    totalScanned: data.total_scanned || 0,
    totalAfterFilters: data.total_after_filters || 0,
    timingMs: data.timing_ms || 0,
    config,
  };
}

/**
 * Merge opportunities from multiple filters
 * - Deduplicates by keeping the one with best edge
 * - Preserves filter metadata for display
 */
function mergeOpportunities(
  results: Array<{
    opportunities: Opportunity[];
    config: FilterConfig;
  }>
): Opportunity[] {
  // Map by unique opportunity key
  const oppMap = new Map<string, Opportunity>();

  for (const result of results) {
    for (const opp of result.opportunities) {
      // Create unique key for deduplication
      // Key: eventId + player + market + line + side
      const key = `${opp.eventId}:${opp.player}:${opp.market}:${opp.line}:${opp.side}`;
      
      const existing = oppMap.get(key);
      
      if (!existing) {
        // First time seeing this opportunity
        oppMap.set(key, opp);
      } else {
        // Duplicate - keep the one with better edge
        const existingEdge = existing.edgePct ?? -Infinity;
        const newEdge = opp.edgePct ?? -Infinity;
        
        if (newEdge > existingEdge) {
          oppMap.set(key, opp);
        }
      }
    }
  }

  // Sort by edge descending after merging
  return Array.from(oppMap.values()).sort((a, b) => {
    const edgeA = a.edgePct ?? -Infinity;
    const edgeB = b.edgePct ?? -Infinity;
    return edgeB - edgeA;
  });
}

/**
 * Apply global filters (book exclusions, search, etc.)
 * 
 * HYBRID APPROACH: These filters run client-side where they are user-specific
 * or inexpensive to adjust without a network round-trip.
 * - Sports/markets are also scoped server-side in preset mode to avoid top-N starvation.
 * - Min/max odds
 * - Min edge
 * - Book exclusions
 * - Search
 */
function applyGlobalFilters(
  opportunities: Opportunity[],
  prefs: BestOddsPrefs,
  isCustomMode: boolean
): Opportunity[] {
  // Build set of selected sports for fast lookup
  const selectedSports = new Set<string>();
  const selectedLeagues = toStringArray(prefs.selectedLeagues as unknown);
  if (selectedLeagues.length > 0) {
    for (const league of selectedLeagues) {
      const sport = LEAGUE_TO_SPORT[league.toLowerCase()];
      if (sport) selectedSports.add(sport);
    }
  }
  const selectedBooks = toStringArray(prefs.selectedBooks as unknown);
  const selectedMarkets = toStringArray(prefs.selectedMarkets as unknown);

  const remapOpportunityForBookExclusions = (opp: Opportunity): Opportunity | null => {
    if (selectedBooks.length === 0) return opp;

    const eligibleBooks = (opp.allBooks || [])
      .filter((book) => !selectedBooks.includes(normalizeSportsbookId(book.book)))
      .sort((a, b) => {
        const decimalDiff = b.decimal - a.decimal;
        if (decimalDiff !== 0) return decimalDiff;
        return b.price - a.price;
      });

    const bestEligibleBook = eligibleBooks[0];
    if (!bestEligibleBook) return null;

    const sharpDecimal = opp.sharpDecimal;
    const edge = sharpDecimal != null ? bestEligibleBook.decimal - sharpDecimal : null;
    const edgePct =
      sharpDecimal != null && sharpDecimal > 0
        ? ((bestEligibleBook.decimal / sharpDecimal) - 1) * 100
        : null;

    if (edgePct == null || edgePct <= 0) return null;

    if (normalizeSportsbookId(bestEligibleBook.book) === normalizeSportsbookId(opp.bestBook)) {
      return opp;
    }

    const bestImplied = bestEligibleBook.decimal > 0 ? 1 / bestEligibleBook.decimal : null;
    const trueProbability = opp.trueProbability;
    const ev = trueProbability != null ? (trueProbability * bestEligibleBook.decimal) - 1 : null;
    const evPct = ev != null ? ev * 100 : null;
    const impliedEdge =
      trueProbability != null && bestImplied != null ? trueProbability - bestImplied : null;
    const kellyFraction =
      ev != null && ev > 0 && trueProbability != null && bestEligibleBook.decimal > 1
        ? Math.max(
            0,
            (((bestEligibleBook.decimal - 1) * trueProbability) - (1 - trueProbability)) /
              (bestEligibleBook.decimal - 1),
          )
        : null;

    return {
      ...opp,
      bestBook: bestEligibleBook.book,
      bestPrice: formatAmericanOdds(bestEligibleBook.price),
      bestDecimal: bestEligibleBook.decimal,
      bestLink: bestEligibleBook.link ?? null,
      bestMobileLink: bestEligibleBook.mobileLink ?? null,
      bestImplied,
      edge,
      edgePct,
      impliedEdge,
      ev,
      evPct,
      kellyFraction,
    };
  };

  return opportunities
    .map(remapOpportunityForBookExclusions)
    .filter((opp): opp is Opportunity => opp !== null)
    .filter((opp) => {
    // HYBRID: Sport filter (client-side for preset mode)
    // Only filter if user has selected specific leagues
    if (!isCustomMode && selectedSports.size > 0) {
      const oppSport = (opp.sport || "").toLowerCase();
      if (!selectedSports.has(oppSport)) return false;
    }
    
    // HYBRID: Min edge filter (client-side)
    // Skip for custom mode - custom presets handle their own filtering server-side
    if (!isCustomMode && prefs.minImprovement && prefs.minImprovement > 0) {
      if ((opp.edgePct || 0) < prefs.minImprovement) return false;
    }
    
    // HYBRID: Odds range filter (client-side)
    // Skip for custom mode - custom presets have their own min/max odds that were applied server-side
    if (!isCustomMode) {
      // Default to very permissive range if user hasn't set preferences
      const minOdds = prefs.minOdds ?? -10000;
      const maxOdds = prefs.maxOdds ?? 20000;
      const oppOdds =
        typeof opp.bestPrice === "string"
          ? Number.parseInt(opp.bestPrice, 10) || 0
          : 0;
      if (oppOdds < minOdds || oppOdds > maxOdds) return false;
    }
    
    // HYBRID: Selected markets filter (client-side)
    // Empty = all markets selected; skip in custom mode (custom models define their own markets)
    if (!isCustomMode && selectedMarkets.length > 0) {
      if (!isMarketSelected(selectedMarkets, opp.sport || "", opp.market || "")) {
        return false;
      }
    }
    
    // Search filter
    if (prefs.searchQuery) {
      const q = prefs.searchQuery.toLowerCase();
      const matches =
        (opp.player || "").toLowerCase().includes(q) ||
        (opp.homeTeam || "").toLowerCase().includes(q) ||
        (opp.awayTeam || "").toLowerCase().includes(q) ||
        (opp.market || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    // College player props filter
    if (prefs.hideCollegePlayerProps) {
      const isCollege = opp.sport === "ncaaf" || opp.sport === "ncaab";
      const isPlayerProp = opp.player && opp.player !== "" && opp.player.toLowerCase() !== "game";
      if (isCollege && isPlayerProp) return false;
    }

    return true;
  });
}

/**
 * Main hook for multi-filter opportunities
 * 
 * HYBRID APPROACH:
 * - Preset Mode: Query key changes when server-side fetch scope changes
 *   (comparison, selected sports/leagues, server-readable markets, market lines).
 *   Odds/search/book exclusions stay client-side for instant response.
 * - Custom Mode: Query key changes on preset changes (server-side blend calculations)
 */
export function useMultiFilterOpportunities({
  prefs,
  activePresets,
  isPro,
  limit,
  enabled = true,
}: UseMultiFilterOptions): UseMultiFilterResult {
  const queryClient = useQueryClient();

  const effectiveLimit = limit ?? (isPro ? 200 : 50);
  const isCustomMode = activePresets.length > 0;
  
  // PROGRESSIVE LOADING: Use smaller batch for initial fast load
  const useProgressiveLoading = effectiveLimit > INITIAL_BATCH_SIZE && isPro;
  const initialLimit = useProgressiveLoading ? INITIAL_BATCH_SIZE : effectiveLimit;
  const fullLimit = useProgressiveLoading ? Math.min(effectiveLimit, FULL_BATCH_SIZE) : effectiveLimit;

  // Build filter configs - one for initial fast load, one for full load
  const initialFilterConfigs = useMemo(
    () => buildFilterConfigs(prefs, activePresets, isPro, initialLimit, "initial"),
    [
      activePresets,
      isPro,
      initialLimit,
      prefs.comparisonMode,
      prefs.comparisonBook,
      prefs.marketLines,
      prefs.selectedLeagues,
      prefs.selectedMarkets,
    ]
  );
  
  const fullFilterConfigs = useMemo(
    () => buildFilterConfigs(prefs, activePresets, isPro, fullLimit, "full"),
    [
      activePresets,
      isPro,
      fullLimit,
      prefs.comparisonMode,
      prefs.comparisonBook,
      prefs.marketLines,
      prefs.selectedLeagues,
      prefs.selectedMarkets,
    ]
  );
  
  // For backwards compatibility, expose the full configs
  const filterConfigs = fullFilterConfigs;

  // Build query keys for both initial and full queries
  const buildQueryKey = useCallback((phase: "initial" | "full") => {
    const configs = phase === "initial" ? initialFilterConfigs : fullFilterConfigs;
    const phaseLimit = phase === "initial" ? initialLimit : fullLimit;
    if (isCustomMode) {
      return [
        "multi-filter-opportunities",
        phase,
        "custom",
        configs.map(c => JSON.stringify({
          ...c.filters,
          id: c.metadata.filterId,
        })),
        isPro,
      ];
    } else {
      return [
        "multi-filter-opportunities",
        phase,
        "preset",
        prefs.comparisonMode,
        prefs.comparisonBook || "none",
        buildPresetFetchScopeKey(prefs),
        JSON.stringify(prefs.marketLines || {}),
        phaseLimit,
        // minOdds/maxOdds removed from key — server always gets broad range,
        // client-side filtering in applyGlobalFilters handles user's preference
        isPro,
      ];
    }
  }, [
    isCustomMode,
    initialFilterConfigs,
    fullFilterConfigs,
    prefs,
    initialLimit,
    fullLimit,
    isPro,
  ]);

  const initialQueryKey = useMemo(() => buildQueryKey("initial"), [buildQueryKey]);
  const fullQueryKey = useMemo(() => buildQueryKey("full"), [buildQueryKey]);

  // PROGRESSIVE LOADING: Phase 1 - Fast initial batch
  const {
    data: initialData,
    isLoading: isLoadingInitial,
    isFetching: isFetchingInitial,
    error: initialError,
    dataUpdatedAt: initialDataUpdatedAt,
    isStale: isStaleInitial,
  } = useQuery({
    queryKey: initialQueryKey,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        initialFilterConfigs.map(config => fetchFilterOpportunities(config, isPro, signal))
      );
      const merged = mergeOpportunities(results);
      return {
        opportunities: merged,
        totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
        totalAfterFilters: merged.length,
        timingMs: Math.max(...results.map(r => r.timingMs)),
      };
    },
    staleTime: isCustomMode ? CUSTOM_STALE_TIME_MS : PRESET_STALE_TIME_MS,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: isCustomMode ? true : "always",
    placeholderData: (prev) => prev,
    retry: 3,
    enabled,
  });

  // PROGRESSIVE LOADING: Phase 2 - Full batch in background
  // Only starts AFTER initial batch is loaded
  const {
    data: fullData,
    isLoading: isLoadingFull,
    isFetching: isFetchingFull,
    error: fullError,
    refetch: fullRefetch,
    dataUpdatedAt: fullDataUpdatedAt,
    isStale: isStaleFull,
  } = useQuery({
    queryKey: fullQueryKey,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        fullFilterConfigs.map(config => fetchFilterOpportunities(config, isPro, signal))
      );
      const merged = mergeOpportunities(results);
      return {
        opportunities: merged,
        totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
        totalAfterFilters: merged.length,
        timingMs: Math.max(...results.map(r => r.timingMs)),
      };
    },
    staleTime: isCustomMode ? CUSTOM_STALE_TIME_MS : PRESET_STALE_TIME_MS,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: isCustomMode ? true : "always",
    placeholderData: (prev) => prev,
    retry: 3,
    // Only fetch full batch after initial is done (or if not using progressive loading)
    enabled: enabled && (!useProgressiveLoading || !!initialData),
  });

  // Combine data: Use full data if available, otherwise initial
  const data = fullData || initialData;
  const isLoading = isLoadingInitial;
  const isFetching = isFetchingInitial || isFetchingFull;
  const error = fullError || initialError;
  const dataUpdatedAt = fullDataUpdatedAt || initialDataUpdatedAt;
  const isStale = useProgressiveLoading ? isStaleFull : isStaleInitial;
  
  // Progressive loading state
  const isLoadingMore = useProgressiveLoading && !!initialData && isLoadingFull;
  const loadProgress = useProgressiveLoading 
    ? (fullData ? 100 : initialData ? Math.round((INITIAL_BATCH_SIZE / fullLimit) * 100) : 0)
    : 100;

  // Refetch function that refetches both queries
  const queryRefetch = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: initialQueryKey }),
      queryClient.invalidateQueries({ queryKey: fullQueryKey }),
    ]);
  }, [queryClient, initialQueryKey, fullQueryKey]);

  // OPTIMIZATION: Prefetch function for presets on hover
  const prefetchPreset = useCallback(async (preset: FilterPreset) => {
    // Build configs for this preset
    const presetConfigs = buildFilterConfigs(prefs, [preset], isPro, effectiveLimit, "full");
    const presetQueryKey = [
      "multi-filter-opportunities",
      "full",
      "custom",
      presetConfigs.map(c => JSON.stringify({
        ...c.filters,
        id: c.metadata.filterId,
      })),
      isPro,
    ];

    // Check if data is already cached and fresh
    const cachedData = queryClient.getQueryData(presetQueryKey);
    if (cachedData) return; // Already cached

    // Prefetch in background
    await queryClient.prefetchQuery({
      queryKey: presetQueryKey,
      queryFn: async () => {
        const results = await Promise.all(
          presetConfigs.map(config => fetchFilterOpportunities(config, isPro))
        );
        const merged = mergeOpportunities(results);
        return {
          opportunities: merged,
          totalScanned: results.reduce((sum, r) => sum + r.totalScanned, 0),
          totalAfterFilters: merged.length,
          timingMs: Math.max(...results.map(r => r.timingMs)),
        };
      },
      staleTime: 45_000, // Same as custom mode
    });
  }, [prefs, isPro, effectiveLimit, queryClient]);

  // HYBRID: Apply client-side filters for instant response
  // This includes sports, markets, odds, search, book exclusions
  const opportunities = useMemo(() => {
    if (!data?.opportunities) return [];
    return applyGlobalFilters(data.opportunities, prefs, isCustomMode);
  }, [data?.opportunities, prefs, isCustomMode]);

  // Sort by edge (best first)
  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => (b.edgePct || 0) - (a.edgePct || 0));
  }, [opportunities]);

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    opportunities: sortedOpportunities,
    totalScanned: data?.totalScanned || 0,
    totalAfterFilters: data?.totalAfterFilters || 0,
    timingMs: data?.timingMs || 0,
    activeFilters: filterConfigs,
    isCustomMode,
    isLoading,
    isFetching,
    error: error as Error | null,
    dataUpdatedAt: dataUpdatedAt || null,
    isStale,
    isLoadingMore,
    loadProgress,
    refetch,
    prefetchPreset,
  };
}

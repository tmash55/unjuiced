import { Redis } from "@upstash/redis";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";

// Initialize Redis client
const commandEndpoint = getRedisCommandEndpoint();
export const redis = new Redis({
  url: commandEndpoint.url || process.env.UPSTASH_REDIS_REST_URL!,
  token: commandEndpoint.token || process.env.UPSTASH_REDIS_REST_TOKEN!,
  responseEncoding: false,
});

// Cache TTL in seconds (20 minutes)
export const CACHE_TTL = 1200;

// Type for cached odds data
export interface CachedOddsData {
  lastUpdated: string;
  data: any; // Replace with your odds data type
}

interface CachedHitRateData {
  hitRateProfile: any;
  propsOdds?: Record<string, any>;
  fallback_odds?: Record<string, Record<string, {
    price: number;
    link?: string;
    sid?: string;
  }>>;
  lastUpdated: string;
}

/**
 * Normalize market names for consistent cache keys
 * This ensures that "batter_hits" and "batter_hits,batter_hits_alternate"
 * can share the same cached data
 */
export function normalizeMarkets(markets: string | string[]): string[] {
  // Convert to array if it's a string
  const marketArray =
    typeof markets === "string" ? markets.split(",") : markets;

  // Create a set of base markets (without _alternate suffix)
  const baseMarkets = new Set<string>();
  const alternateMarkets = new Set<string>();

  marketArray.forEach((market) => {
    if (market.endsWith("_alternate")) {
      const baseMarket = market.replace("_alternate", "");
      alternateMarkets.add(baseMarket);
    } else {
      baseMarkets.add(market);
    }
  });

  // Sort for consistent ordering in cache keys
  return Array.from(baseMarkets).sort();
}

/**
 * Generate cache key for odds data with normalized markets
 *
 * @param params Parameters to generate the cache key
 * @returns A cache key string
 */
export function generateOddsCacheKey({
  sport,
  eventId,
  market,
}: {
  sport: string;
  eventId?: string;
  market: string | string[];
  bookmakers?: string[]; // Kept for backward compatibility but not used
}): string {
  // Build the key without bookmakers
  let key = `odds:${sport}`;

  // Add eventId if provided
  if (eventId) {
    key += `:${eventId}`;
  }

  // Normalize and add markets
  const normalizedMarkets = normalizeMarkets(market);
  key += `:${normalizedMarkets.join("_")}`;

  return key;
}

/**
 * Check if we have a superset of the requested markets in cache
 *
 * @param requestedMarkets The markets being requested
 * @param cachedMarkets The markets we have in cache
 * @returns True if the cached markets contain all requested markets
 */
export function hasAllRequestedMarkets(
  requestedMarkets: string[],
  cachedMarkets: string[]
): boolean {
  // Normalize both sets of markets
  const normalizedRequested = normalizeMarkets(requestedMarkets);
  const normalizedCached = normalizeMarkets(cachedMarkets);

  // Check if all requested markets are in the cached markets
  return normalizedRequested.every((market) =>
    normalizedCached.includes(market)
  );
}

/**
 * Get cached data for markets, supporting partial matches
 *
 * @param sport The sport key
 * @param eventId Optional event ID
 * @param markets The markets being requested
 * @returns Cached data if available, null otherwise
 */
export async function getMarketsCachedData<T>(
  sport: string,
  eventId: string | undefined,
  markets: string[]
): Promise<T | null> {
  // Try exact match first
  const exactKey = generateOddsCacheKey({
    sport,
    eventId,
    market: markets,
  });

  const exactMatch = await getCachedData<T>(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  // If no exact match, check for superset cache keys
  // This is a simplified approach - in production you might want to
  // maintain a registry of active cache keys for more efficient lookup

  // For now, we'll just check a few common combinations
  const commonCombinations = [
    // Standard + alternate pairs
    [...markets, ...markets.map((m) => `${m}_alternate`)],
    // Just the base markets (for when alternates were requested but we have base)
    normalizeMarkets(markets),
  ];

  for (const combo of commonCombinations) {
    const comboKey = generateOddsCacheKey({
      sport,
      eventId,
      market: combo,
    });

    const comboMatch = await getCachedData<T>(comboKey);
    if (comboMatch) {
      return comboMatch;
    }
  }

  return null;
}

// Get cached odds data
export async function getCachedOdds(
  key: string
): Promise<CachedOddsData | null> {
  try {
    const data = await redis.get<CachedOddsData>(key);
    return data;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

// Set odds data in cache
export async function setCachedOdds(key: string, data: any): Promise<void> {
  try {
    const cacheData: CachedOddsData = {
      lastUpdated: new Date().toISOString(),
      data,
    };
    await redis.set(key, cacheData, { ex: CACHE_TTL });
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    await redis.set(key, data, { ex: ttl });
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis delete error:", error);
  }
}

// Helper to generate consistent cache keys
export function generateCacheKey(parts: string[]): string {
  return parts.join(":");
}

/**
 * Filters cached odds data to include only the specified sportsbooks
 *
 * @param data The complete cached data with all sportsbooks
 * @param selectedSportsbooks Array of sportsbook IDs to include
 * @returns Filtered data with only the selected sportsbooks
 */
export function filterCachedOddsBySelectedSportsbooks<
  T extends { bookmakers?: any[] }
>(data: T | T[], selectedSportsbooks: string[]): T | T[] {
  if (!data) return data;

  // Handle array of events/games
  if (Array.isArray(data)) {
    return data.map((item) =>
      filterSingleItemBookmakers(item, selectedSportsbooks)
    );
  }

  // Handle single event/game
  return filterSingleItemBookmakers(data, selectedSportsbooks);
}

/**
 * Helper function to filter bookmakers for a single item
 */
function filterSingleItemBookmakers<T extends { bookmakers?: any[] }>(
  item: T,
  selectedSportsbooks: string[]
): T {
  if (!item.bookmakers || !Array.isArray(item.bookmakers)) {
    return item;
  }

  // Create a shallow copy of the item
  const filteredItem = { ...item };

  // Filter bookmakers to only include selected ones
  filteredItem.bookmakers = item.bookmakers.filter((bookmaker) =>
    selectedSportsbooks.includes(bookmaker.key)
  );

  return filteredItem;
}


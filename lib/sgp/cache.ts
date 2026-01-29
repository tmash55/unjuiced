import { redis } from "@/lib/redis";

// =============================================================================
// TYPES
// =============================================================================

export interface SgpLeg {
  event_id: string;
  player_id?: string | null;
  market: string;
  line: number | null;
  side: string;
  sgp_tokens: Record<string, string>; // { bookId: sgpToken }
}

export interface SgpBookOdds {
  price?: string; // American odds string e.g., "+425"
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string;
}

export interface SgpQuoteCache {
  legs_hash: string;
  quotes: Record<string, SgpBookOdds>;
  cached_at: number;
  ttl_seconds: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Cache TTL in seconds (90 seconds - quotes change frequently)
export const SGP_QUOTE_CACHE_TTL = 90;

// Stale threshold - if older than this, revalidate in background
export const SGP_QUOTE_STALE_THRESHOLD = 30;

// Redis key prefix
const CACHE_KEY_PREFIX = "sgp_quote";

// =============================================================================
// HASH COMPUTATION
// =============================================================================

/**
 * Simple hash function that works in both Node.js and Edge runtime.
 * Uses djb2 algorithm - fast and produces good distribution.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer and then to hex
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, '0');
}

/**
 * Compute a stable hash for a set of legs.
 * This allows caching SGP quotes by the combination of legs.
 * 
 * The hash is deterministic regardless of leg order.
 */
export function computeLegsHash(legs: SgpLeg[]): string {
  // Normalize each leg to a canonical string representation
  const normalized = legs
    .map(leg => {
      const playerId = leg.player_id || "game";
      const line = leg.line !== null ? leg.line.toString() : "null";
      return `${leg.event_id}:${playerId}:${leg.market}:${line}:${leg.side}`;
    })
    .sort() // Sort to ensure order independence
    .join("|");
  
  // Create a hash from two parts for better uniqueness
  const hash1 = simpleHash(normalized);
  const hash2 = simpleHash(normalized.split("").reverse().join(""));
  return `${hash1}${hash2}`;
}

/**
 * Generate the Redis cache key for a legs hash
 */
export function getCacheKey(legsHash: string): string {
  return `${CACHE_KEY_PREFIX}:${legsHash}`;
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get cached SGP quotes for a legs hash
 */
export async function getCachedQuotes(legsHash: string): Promise<SgpQuoteCache | null> {
  try {
    const key = getCacheKey(legsHash);
    const cached = await redis.get<SgpQuoteCache>(key);
    
    if (!cached) return null;
    
    // Check if cache has expired
    const age = (Date.now() - cached.cached_at) / 1000;
    if (age > cached.ttl_seconds) {
      // Cache expired, delete it
      await redis.del(key);
      return null;
    }
    
    return cached;
  } catch (error) {
    console.error("[SGP Cache] Error getting cached quotes:", error);
    return null;
  }
}

/**
 * Check if cached quotes are stale (but not expired)
 */
export function isCacheStale(cache: SgpQuoteCache): boolean {
  const age = (Date.now() - cache.cached_at) / 1000;
  return age > SGP_QUOTE_STALE_THRESHOLD;
}

/**
 * Set cached SGP quotes
 */
export async function setCachedQuotes(
  legsHash: string,
  quotes: Record<string, SgpBookOdds>,
  ttl: number = SGP_QUOTE_CACHE_TTL
): Promise<void> {
  try {
    const key = getCacheKey(legsHash);
    const cache: SgpQuoteCache = {
      legs_hash: legsHash,
      quotes,
      cached_at: Date.now(),
      ttl_seconds: ttl,
    };
    
    // Set with TTL
    await redis.set(key, cache, { ex: ttl });
  } catch (error) {
    console.error("[SGP Cache] Error setting cached quotes:", error);
  }
}

/**
 * Update a single book's quote in the cache
 * Used for incremental updates during streaming
 */
export async function updateCachedQuote(
  legsHash: string,
  bookId: string,
  quote: SgpBookOdds
): Promise<void> {
  try {
    const key = getCacheKey(legsHash);
    const cached = await redis.get<SgpQuoteCache>(key);
    
    if (!cached) {
      // Create new cache with just this quote
      await setCachedQuotes(legsHash, { [bookId]: quote });
      return;
    }
    
    // Update existing cache
    cached.quotes[bookId] = quote;
    cached.cached_at = Date.now(); // Refresh timestamp
    
    // Calculate remaining TTL
    const age = (Date.now() - cached.cached_at) / 1000;
    const remainingTtl = Math.max(1, cached.ttl_seconds - age);
    
    await redis.set(key, cached, { ex: Math.ceil(remainingTtl) });
  } catch (error) {
    console.error("[SGP Cache] Error updating cached quote:", error);
  }
}

/**
 * Invalidate cached quotes for a legs hash
 */
export async function invalidateCachedQuotes(legsHash: string): Promise<void> {
  try {
    const key = getCacheKey(legsHash);
    await redis.del(key);
  } catch (error) {
    console.error("[SGP Cache] Error invalidating cached quotes:", error);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract SGP tokens from favorites data
 */
export function extractSgpTokens(
  legs: Array<{
    books_snapshot?: Record<string, { sgp?: string | null }> | null;
  }>,
  bookId: string
): string[] {
  return legs
    .map(leg => leg.books_snapshot?.[bookId]?.sgp)
    .filter((token): token is string => !!token);
}

/**
 * Get all books that have SGP tokens for all legs
 */
export function getBooksWithFullSupport(
  legs: Array<{
    books_snapshot?: Record<string, { sgp?: string | null }> | null;
  }>,
  sgpSupportingBooks: string[]
): string[] {
  return sgpSupportingBooks.filter(bookId => {
    const tokens = extractSgpTokens(legs, bookId);
    return tokens.length === legs.length;
  });
}

/**
 * Shared Odds Cache Layer
 * 
 * Central cache for odds data that can be shared across multiple API routes.
 * This prevents redundant Redis calls when multiple tools need the same odds.
 * 
 * Architecture:
 * 1. In-memory LRU cache with TTL (fastest, ~0ms)
 * 2. Falls back to Redis if memory cache misses
 * 3. Deduplication: concurrent requests for same data share one fetch
 * 
 * Usage:
 *   const cache = OddsCache.getInstance();
 *   const odds = await cache.getOddsForSport('nba');
 */

import { Redis } from "@upstash/redis";
import type { SSESelection, SSEBookSelections } from "@/lib/odds/types";

// ============================================================================
// Types
// ============================================================================

export interface CachedOddsEntry {
  data: Map<string, SSESelection>;
  timestamp: number;
  sport: string;
}

export interface OddsCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  memoryUsageMB: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Memory cache TTL (how long to keep in memory)
  MEMORY_TTL_MS: 15_000, // 15 seconds - balance freshness vs speed
  
  // Maximum entries in memory cache
  MAX_ENTRIES: 10, // One per sport typically
  
  // Redis scan settings
  SCAN_COUNT: 2000,
  MGET_CHUNK_SIZE: 500,
  
  // Request deduplication window
  DEDUP_WINDOW_MS: 5000,
};

// ============================================================================
// In-Memory LRU Cache
// ============================================================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first entry)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, value);
  }
  
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Odds Cache Singleton
// ============================================================================

export class OddsCache {
  private static instance: OddsCache | null = null;
  
  private redis: Redis;
  private memoryCache: LRUCache<string, CachedOddsEntry>;
  private inflight: Map<string, Promise<Map<string, SSESelection>>>;
  private stats = { hits: 0, misses: 0 };
  
  private constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    this.memoryCache = new LRUCache(CONFIG.MAX_ENTRIES);
    this.inflight = new Map();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): OddsCache {
    if (!OddsCache.instance) {
      OddsCache.instance = new OddsCache();
    }
    return OddsCache.instance;
  }
  
  /**
   * Get odds for a sport with automatic caching
   * 
   * @param sport - Sport key (e.g., 'nba', 'nfl')
   * @param eventIds - Optional filter to specific event IDs
   * @returns Map of odds key -> selection data
   */
  async getOddsForSport(
    sport: string,
    eventIds?: string[]
  ): Promise<Map<string, SSESelection>> {
    const cacheKey = this.buildCacheKey(sport, eventIds);
    
    // 1. Check memory cache (fastest, ~0ms)
    const cached = this.memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.MEMORY_TTL_MS) {
      this.stats.hits++;
      return cached.data;
    }
    
    // 2. Check if there's already an inflight request (deduplication)
    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      this.stats.hits++;
      return inflight;
    }
    
    // 3. Fetch from Redis
    this.stats.misses++;
    const fetchPromise = this.fetchOddsFromRedis(sport, eventIds);
    
    // Store inflight promise for deduplication
    this.inflight.set(cacheKey, fetchPromise);
    
    try {
      const data = await fetchPromise;
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        sport,
      });
      
      return data;
    } finally {
      // Clean up inflight after a short delay (allows for slight timing variations)
      setTimeout(() => {
        this.inflight.delete(cacheKey);
      }, CONFIG.DEDUP_WINDOW_MS);
    }
  }
  
  /**
   * Get odds for multiple sports efficiently
   */
  async getOddsForSports(sports: string[]): Promise<Map<string, Map<string, SSESelection>>> {
    const results = new Map<string, Map<string, SSESelection>>();
    
    // Fetch all sports in parallel
    await Promise.all(
      sports.map(async (sport) => {
        try {
          const odds = await this.getOddsForSport(sport);
          results.set(sport, odds);
        } catch (error) {
          console.error(`[OddsCache] Failed to get odds for ${sport}:`, error);
          results.set(sport, new Map());
        }
      })
    );
    
    return results;
  }
  
  /**
   * Invalidate cache for a sport (call when SSE indicates updates)
   */
  invalidate(sport: string): void {
    // Clear all cache entries for this sport
    // Since we use a simple LRU, we'd need to iterate
    // For now, just clear everything (simple and effective)
    this.memoryCache.clear();
    console.log(`[OddsCache] Invalidated cache for ${sport}`);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): OddsCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      entries: this.memoryCache.size,
      memoryUsageMB: 0, // Would need to estimate based on cached data
    };
  }
  
  /**
   * Reset cache and stats (useful for testing)
   */
  reset(): void {
    this.memoryCache.clear();
    this.inflight.clear();
    this.stats = { hits: 0, misses: 0 };
  }
  
  // ==========================================================================
  // Private Methods
  // ==========================================================================
  
  private buildCacheKey(sport: string, eventIds?: string[]): string {
    if (eventIds && eventIds.length > 0) {
      return `odds:${sport}:events:${eventIds.sort().join(",")}`;
    }
    return `odds:${sport}:all`;
  }
  
  private async fetchOddsFromRedis(
    sport: string,
    eventIds?: string[]
  ): Promise<Map<string, SSESelection>> {
    const startTime = Date.now();
    
    try {
      // Get active event IDs if not provided
      const targetEventIds = eventIds || await this.getActiveEventIds(sport);
      
      if (targetEventIds.length === 0) {
        return new Map();
      }
      
      // Get odds keys for events
      const oddsKeys = await this.getOddsKeysForEvents(sport, targetEventIds);
      
      if (oddsKeys.length === 0) {
        return new Map();
      }
      
      // Fetch all odds data
      const oddsData = await this.mgetChunked(oddsKeys);
      
      // Build the result map
      const result = new Map<string, SSESelection>();
      for (let i = 0; i < oddsKeys.length; i++) {
        const key = oddsKeys[i];
        const data = oddsData[i];
        if (data) {
          result.set(key, data as SSESelection);
        }
      }
      
      console.log(
        `[OddsCache] Fetched ${result.size} odds for ${sport} in ${Date.now() - startTime}ms`
      );
      
      return result;
    } catch (error) {
      console.error(`[OddsCache] Error fetching ${sport}:`, error);
      throw error;
    }
  }
  
  private async getActiveEventIds(sport: string): Promise<string[]> {
    try {
      const activeSet = await this.redis.smembers(`active_events:${sport}`);
      if (activeSet && activeSet.length > 0) {
        return activeSet.map(String);
      }
    } catch (error) {
      console.warn(`[OddsCache] Failed to get active events, falling back to scan:`, error);
    }
    
    // Fallback to scanning
    const eventKeys = await this.scanKeys(`events:${sport}:*`);
    return eventKeys.map((k) => k.split(":")[2]).filter(Boolean);
  }
  
  private async getOddsKeysForEvents(sport: string, eventIds: string[]): Promise<string[]> {
    const allKeys: string[] = [];
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((eventId) => this.scanKeys(`odds:${sport}:${eventId}:*`))
      );
      allKeys.push(...batchResults.flat());
    }
    
    return allKeys;
  }
  
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    let iterations = 0;
    const MAX_ITERATIONS = 50;
    
    do {
      iterations++;
      const result: [string, string[]] = await this.redis.scan(cursor, {
        match: pattern,
        count: CONFIG.SCAN_COUNT,
      });
      cursor = result[0];
      keys.push(...result[1]);
      
      if (iterations >= MAX_ITERATIONS) {
        console.warn(`[OddsCache] Hit iteration limit for pattern: ${pattern}`);
        break;
      }
    } while (cursor !== "0");
    
    return keys;
  }
  
  private async mgetChunked(keys: string[]): Promise<(unknown | null)[]> {
    if (keys.length === 0) return [];
    
    const results: (unknown | null)[] = [];
    
    for (let i = 0; i < keys.length; i += CONFIG.MGET_CHUNK_SIZE) {
      const chunk = keys.slice(i, i + CONFIG.MGET_CHUNK_SIZE);
      const chunkResults = await this.redis.mget<(unknown | null)[]>(...chunk);
      results.push(...chunkResults);
    }
    
    return results;
  }
}

// ============================================================================
// Convenience Export
// ============================================================================

/**
 * Get the shared odds cache instance
 */
export function getOddsCache(): OddsCache {
  return OddsCache.getInstance();
}

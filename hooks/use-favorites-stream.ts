"use client";

/**
 * useFavoritesStream Hook
 * 
 * Real-time SSE streaming hook for Favorites live odds updates.
 * Uses signal-based refreshing via the odds_updates pub/sub infrastructure.
 * 
 * Features:
 * - SSE connection to odds_updates channels (multi-sport)
 * - Signal-based refresh (only fetches when odds change for relevant favorites)
 * - Debounced updates to prevent request storms
 * - Change tracking for visual feedback (price up/down)
 * - Auto-refresh when favorites page is visible
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { Favorite, RefreshedOdds, RefreshOddsResponse, BookSnapshot } from "@/hooks/use-favorites";

// =============================================================================
// Types
// =============================================================================

type Direction = "up" | "down";

export interface FavoriteChange {
  priceDirection?: Direction;
  previousPrice: number | null;
  currentPrice: number | null;
  previousBook: string | null;
  currentBook: string | null;
}

export type FavoriteChangesMap = Map<string, FavoriteChange>;

// Full refreshed data for a favorite
export interface RefreshedFavoriteData {
  best: { price: number; book: string; link: string | null; sgp: string | null } | null;
  allBooks: Record<string, { price: number; link: string | null; sgp: string | null }>;
  isAvailable: boolean;
}

export type RefreshedOddsMap = Map<string, RefreshedFavoriteData | null>;

// SSE message format from odds_updates channel
interface OddsUpdateMessage {
  type: "update";
  keys: string[];
  count: number;
  timestamp?: string;
}

const FLASH_MS = 5000; // Highlight duration for changes
const DEBOUNCE_MS = 1500; // Debounce refresh requests (slightly longer than EV to be less aggressive)

// =============================================================================
// Helpers
// =============================================================================

function getDirection(prev: number | null, current: number | null): Direction | undefined {
  if (prev == null || current == null) return undefined;
  if (current > prev) return "up";
  if (current < prev) return "down";
  return undefined;
}

/**
 * Check if an odds update key is relevant to any of our favorites.
 * Key format: odds:{sport}:{eventId}:{market}:{book}
 * Favorite odds_key format: odds:{sport}:{eventId}:{market}
 */
function isRelevantUpdate(
  updateKey: string, 
  favoriteOddsKeys: Set<string>
): boolean {
  // Extract the base key (without book) from the update
  // updateKey: odds:nba:12345:player_points:fanduel
  // favoriteOddsKey: odds:nba:12345:player_points
  const parts = updateKey.split(":");
  if (parts.length < 5) return false;
  
  // Reconstruct the base key (first 4 parts)
  const baseKey = parts.slice(0, 4).join(":");
  
  return favoriteOddsKeys.has(baseKey);
}

/**
 * Extract unique sports from favorites
 */
function getSportsFromFavorites(favorites: Favorite[]): string[] {
  const sports = new Set<string>();
  for (const fav of favorites) {
    if (fav.sport) sports.add(fav.sport);
  }
  return Array.from(sports);
}

/**
 * Extract unique odds_keys from favorites for relevance checking
 */
function getOddsKeysFromFavorites(favorites: Favorite[]): Set<string> {
  const keys = new Set<string>();
  for (const fav of favorites) {
    if (fav.odds_key) keys.add(fav.odds_key);
  }
  return keys;
}

// =============================================================================
// Main Hook
// =============================================================================

export interface UseFavoritesStreamOptions {
  /** User's favorites list */
  favorites: Favorite[];
  /** Function to refresh odds from API */
  refreshOdds: (favoriteIds?: string[]) => Promise<RefreshOddsResponse>;
  /** Whether auto-refresh is enabled */
  enabled?: boolean;
}

export interface UseFavoritesStreamResult {
  /** Map of favorite ID to refreshed odds data */
  refreshedOdds: RefreshedOddsMap;
  /** Map of favorite ID to change indicators */
  changes: FavoriteChangesMap;
  /** SSE connected */
  connected: boolean;
  /** Reconnecting */
  isReconnecting: boolean;
  /** Connection failed after max retries */
  hasFailed: boolean;
  /** Last updated timestamp */
  lastUpdated: number | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Manual reconnect */
  reconnect: () => void;
  /** Whether currently refreshing */
  isRefreshing: boolean;
}

export function useFavoritesStream({
  favorites,
  refreshOdds,
  enabled = true,
}: UseFavoritesStreamOptions): UseFavoritesStreamResult {
  // State
  const [refreshedOdds, setRefreshedOdds] = useState<RefreshedOddsMap>(new Map());
  const [changes, setChanges] = useState<FavoriteChangesMap>(new Map());
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const previousOddsRef = useRef<Map<string, number | null>>(new Map());
  const previousBooksRef = useRef<Map<string, string | null>>(new Map());
  
  // Memoized derived data
  const sports = useMemo(() => getSportsFromFavorites(favorites), [favorites]);
  const oddsKeys = useMemo(() => getOddsKeysFromFavorites(favorites), [favorites]);
  
  // Build SSE URL for multi-sport subscription
  const sseUrl = useMemo(() => {
    if (sports.length === 0) return "";
    return `/api/v2/sse/props?sports=${sports.join(",")}`;
  }, [sports]);

  // Process refreshed odds and detect changes
  const processRefreshedOdds = useCallback((response: RefreshOddsResponse) => {
    const newRefreshedOdds: RefreshedOddsMap = new Map();
    const newChanges: FavoriteChangesMap = new Map();
    
    for (const item of response.refreshed || []) {
      // Build refreshed data
      if (item.is_available && item.all_books?.length > 0) {
        const allBooks: Record<string, { price: number; link: string | null; sgp: string | null }> = {};
        for (const bookOdds of item.all_books) {
          allBooks[bookOdds.book] = {
            price: bookOdds.price,
            link: bookOdds.link,
            sgp: bookOdds.sgp,
          };
        }
        
        newRefreshedOdds.set(item.favorite_id, {
          best: item.current_best_price !== null && item.current_best_book 
            ? { 
                price: item.current_best_price, 
                book: item.current_best_book,
                link: item.current_best_link,
                sgp: item.current_sgp,
              }
            : null,
          allBooks,
          isAvailable: true,
        });
      } else {
        newRefreshedOdds.set(item.favorite_id, {
          best: null,
          allBooks: {},
          isAvailable: false,
        });
      }
      
      // Detect changes
      const previousPrice = previousOddsRef.current.get(item.favorite_id) ?? null;
      const previousBook = previousBooksRef.current.get(item.favorite_id) ?? null;
      const currentPrice = item.current_best_price;
      const currentBook = item.current_best_book;
      
      // Only register change if we have a previous value and it changed
      if (previousPrice !== null && currentPrice !== null && previousPrice !== currentPrice) {
        const direction = getDirection(previousPrice, currentPrice);
        if (direction) {
          newChanges.set(item.favorite_id, {
            priceDirection: direction,
            previousPrice,
            currentPrice,
            previousBook,
            currentBook,
          });
        }
      }
      
      // Update previous refs for next comparison
      previousOddsRef.current.set(item.favorite_id, currentPrice);
      previousBooksRef.current.set(item.favorite_id, currentBook);
    }
    
    setRefreshedOdds(newRefreshedOdds);
    setLastUpdated(Date.now());
    
    // Set changes and clear after flash duration
    if (newChanges.size > 0) {
      setChanges(newChanges);
      setTimeout(() => {
        setChanges((prev) => {
          const next = new Map(prev);
          for (const id of newChanges.keys()) {
            next.delete(id);
          }
          return next;
        });
      }, FLASH_MS);
    }
  }, []);

  // Fetch fresh odds
  const fetchOdds = useCallback(async () => {
    if (favorites.length === 0) return;
    
    setIsRefreshing(true);
    try {
      const response = await refreshOdds();
      processRefreshedOdds(response);
      
      if (process.env.NODE_ENV === "development") {
        console.log(`[favorites-stream] 📊 Refreshed ${response.available}/${response.count} favorites`);
      }
    } catch (error) {
      console.error("[favorites-stream] Refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [favorites.length, refreshOdds, processRefreshedOdds]);

  // Handle SSE message - debounced refresh
  const handleSSEMessage = useCallback((message: OddsUpdateMessage) => {
    // Only process update messages
    if (message.type !== "update" || !Array.isArray(message.keys) || message.keys.length === 0) {
      return;
    }
    
    // Filter keys to see if any are relevant to our favorites
    const relevantKeys = message.keys.filter((key) => isRelevantUpdate(key, oddsKeys));
    
    if (relevantKeys.length === 0) {
      return;
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log(`[favorites-stream] 📡 ${relevantKeys.length}/${message.count} relevant updates`);
    }
    
    // Debounce the refresh to prevent request storms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchOdds();
    }, DEBOUNCE_MS);
  }, [oddsKeys, fetchOdds]);

  // Handle SSE error
  const handleSSEError = useCallback((error: Event) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[favorites-stream] SSE error:", error);
    }
  }, []);

  // SSE connection
  const sseEnabled = enabled && sseUrl !== "" && favorites.length > 0;
  
  const {
    isConnected,
    isReconnecting,
    hasFailed,
    reconnect: sseReconnect,
  } = useSSE(sseUrl, {
    enabled: sseEnabled,
    onMessage: handleSSEMessage,
    onError: handleSSEError,
  });

  // Initial fetch when favorites change or when enabled
  useEffect(() => {
    if (enabled && favorites.length > 0) {
      fetchOdds();
    }
  }, [enabled, favorites.length, fetchOdds]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchOdds();
  }, [fetchOdds]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    sseReconnect();
    // Also refresh data
    fetchOdds();
  }, [sseReconnect, fetchOdds]);

  return {
    refreshedOdds,
    changes,
    connected: sseEnabled ? isConnected : false,
    isReconnecting: sseEnabled ? isReconnecting : false,
    hasFailed: sseEnabled ? hasFailed : false,
    lastUpdated,
    refresh,
    reconnect,
    isRefreshing,
  };
}

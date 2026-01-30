"use client";

import { useCallback, useRef, useState } from "react";

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
  price?: string;
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

export interface SgpQuoteResult {
  quotes: Record<string, SgpBookOdds>;
  legsHash: string;
  fromCache: boolean;
  cacheAgeMs?: number;
  completed: string[];
  failed: string[];
  pending: string[];
  timedOut: boolean;
}

type QuoteStatus = "idle" | "loading" | "streaming" | "done" | "error";

interface UseSgpQuoteStreamOptions {
  onQuote?: (bookId: string, quote: SgpBookOdds) => void;
  onComplete?: (result: SgpQuoteResult) => void;
  onError?: (error: string) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSgpQuoteStream(options: UseSgpQuoteStreamOptions = {}) {
  const { onQuote, onComplete, onError } = options;

  const [status, setStatus] = useState<QuoteStatus>("idle");
  const [quotes, setQuotes] = useState<Record<string, SgpBookOdds>>({});
  const [legsHash, setLegsHash] = useState<string | null>(null);
  const [booksPending, setBooksPending] = useState<string[]>([]);
  const [booksCompleted, setBooksCompleted] = useState<string[]>([]);
  const [booksFailed, setBooksFailed] = useState<string[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable callback refs
  const onQuoteRef = useRef(onQuote);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onQuoteRef.current = onQuote;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  /**
   * Fetch SGP quotes for a set of legs
   */
  const fetchQuotes = useCallback(async (
    legs: SgpLeg[],
    sportsbooks?: string[],
    prefetch = false
  ): Promise<SgpQuoteResult | null> => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setStatus("loading");
    setQuotes({});
    setLegsHash(null);
    setBooksPending([]);
    setBooksCompleted([]);
    setBooksFailed([]);
    setFromCache(false);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/sse/sgp-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs, sportsbooks, prefetch }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${response.status}`;
        setError(errorMsg);
        setStatus("error");
        onErrorRef.current?.(errorMsg);
        return null;
      }

      // Check if it's a cached response (non-streaming JSON)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        
        setLegsHash(data.legs_hash);
        setQuotes(data.quotes);
        setFromCache(true);
        setBooksCompleted(Object.keys(data.quotes).filter(k => !data.quotes[k].error));
        setBooksFailed(Object.keys(data.quotes).filter(k => data.quotes[k].error));
        setStatus("done");

        const result: SgpQuoteResult = {
          quotes: data.quotes,
          legsHash: data.legs_hash,
          fromCache: true,
          cacheAgeMs: data.cache_age_ms,
          completed: Object.keys(data.quotes).filter(k => !data.quotes[k].error),
          failed: Object.keys(data.quotes).filter(k => data.quotes[k].error),
          pending: [],
          timedOut: false,
        };

        onCompleteRef.current?.(result);
        return result;
      }

      // Handle SSE streaming response
      if (!response.body) {
        throw new Error("No response body");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamedQuotes: Record<string, SgpBookOdds> = {};
      let streamedHash = "";
      const completed: string[] = [];
      const failed: string[] = [];
      let pending: string[] = [];
      let timedOut = false;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // Keep incomplete event in buffer

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          // Parse SSE event
          const lines = eventStr.split("\n");
          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            } else if (line.startsWith(":")) {
              // Comment/ping, ignore
              continue;
            }
          }

          if (!eventData) continue;

          try {
            const data = JSON.parse(eventData);

            switch (eventType) {
              case "hello":
                streamedHash = data.legs_hash;
                pending = data.books_pending || [];
                setLegsHash(data.legs_hash);
                setBooksPending(data.books_pending || []);
                
                // If there's stale cache data, populate it
                if (data.stale_cache) {
                  setQuotes(data.stale_cache);
                  Object.assign(streamedQuotes, data.stale_cache);
                }
                break;

              case "quote":
                const { book_id, ...quote } = data;
                streamedQuotes[book_id] = quote;
                setQuotes(prev => ({ ...prev, [book_id]: quote }));
                
                // Update pending/completed lists
                pending = pending.filter(b => b !== book_id);
                setBooksPending(pending);
                
                if (quote.error) {
                  failed.push(book_id);
                  setBooksFailed(prev => [...prev, book_id]);
                } else {
                  completed.push(book_id);
                  setBooksCompleted(prev => [...prev, book_id]);
                }
                
                onQuoteRef.current?.(book_id, quote);
                break;

              case "done":
                timedOut = data.timed_out || false;
                pending = data.pending || [];
                setBooksPending(pending);
                break;
            }
          } catch (parseError) {
            console.error("[SGP Stream] Failed to parse event:", parseError);
          }
        }
      }

      setStatus("done");

      const result: SgpQuoteResult = {
        quotes: streamedQuotes,
        legsHash: streamedHash,
        fromCache: false,
        completed,
        failed,
        pending,
        timedOut,
      };

      onCompleteRef.current?.(result);
      return result;

    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Request was cancelled, not an error
        setStatus("idle");
        return null;
      }

      const errorMsg = (err as Error).message || "Unknown error";
      setError(errorMsg);
      setStatus("error");
      onErrorRef.current?.(errorMsg);
      return null;
    }
  }, []);

  /**
   * Cancel any in-progress request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    cancel();
    setQuotes({});
    setLegsHash(null);
    setBooksPending([]);
    setBooksCompleted([]);
    setBooksFailed([]);
    setFromCache(false);
    setError(null);
  }, [cancel]);

  return {
    // State
    status,
    quotes,
    legsHash,
    booksPending,
    booksCompleted,
    booksFailed,
    fromCache,
    error,

    // Computed
    isLoading: status === "loading" || status === "streaming",
    isStreaming: status === "streaming",
    isDone: status === "done",
    hasError: status === "error",

    // Actions
    fetchQuotes,
    cancel,
    reset,
  };
}

// =============================================================================
// HELPER: Convert favorites to SgpLegs format
// =============================================================================

// Type for refreshed odds data (from useFavoritesStream)
interface RefreshedBookOdds {
  price: number;
  link: string | null;
  sgp: string | null;
}

export function favoritesToSgpLegs(
  favorites: Array<{
    id?: string;
    event_id: string;
    player_id?: string | null;
    market: string;
    line: number | null;
    side: string;
    books_snapshot?: Record<string, { sgp?: string | null }> | null;
  }>,
  /** Optional: Map of favorite ID to refreshed odds with live SGP tokens */
  refreshedOddsMap?: Map<string, { allBooks: Record<string, RefreshedBookOdds> } | null>
): SgpLeg[] {
  return favorites.map(fav => {
    // Start with tokens from books_snapshot
    const sgp_tokens: Record<string, string> = {};
    
    // Add tokens from saved snapshot
    if (fav.books_snapshot) {
      for (const [bookId, data] of Object.entries(fav.books_snapshot)) {
        if (data?.sgp) {
          sgp_tokens[bookId] = data.sgp;
        }
      }
    }
    
    // Override/augment with refreshed tokens if available (live data takes priority)
    if (fav.id && refreshedOddsMap) {
      const refreshedData = refreshedOddsMap.get(fav.id);
      if (refreshedData?.allBooks) {
        for (const [bookId, data] of Object.entries(refreshedData.allBooks)) {
          if (data?.sgp) {
            sgp_tokens[bookId] = data.sgp;
          }
        }
      }
    }
    
    return {
      event_id: fav.event_id,
      player_id: fav.player_id,
      market: fav.market,
      line: fav.line,
      side: fav.side,
      sgp_tokens,
    };
  });
}

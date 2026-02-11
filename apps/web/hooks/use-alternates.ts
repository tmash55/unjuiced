"use client";

import { useState, useCallback, useRef } from "react";

interface AlternateLine {
  line: number;
  books: Record<string, {
    over?: { price: number; link?: string };
    under?: { price: number; link?: string };
  }>;
}

interface AlternatesCache {
  [key: string]: {
    data: AlternateLine[];
    timestamp: number;
  };
}

const CACHE_DURATION = 60_000; // 60 seconds

export function useAlternates(sport: string) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  const cacheRef = useRef<AlternatesCache>({});

  const fetchAlternates = useCallback(
    async (sid: string): Promise<AlternateLine[]> => {
      const cacheKey = `${sport}:${sid}`;
      const now = Date.now();

      // Check cache
      const cached = cacheRef.current[cacheKey];
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        console.log(`[ALTERNATES] Cache hit for ${sid}`);
        return cached.data;
      }

      // Set loading state
      setLoading((prev) => ({ ...prev, [sid]: true }));
      setError((prev) => ({ ...prev, [sid]: null }));

      try {
        const response = await fetch(
          `/api/props/alternates?sport=${encodeURIComponent(sport)}&sid=${encodeURIComponent(sid)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch alternates: ${response.status}`);
        }

        const { alternates } = await response.json();

        // Update cache
        cacheRef.current[cacheKey] = {
          data: alternates,
          timestamp: now,
        };

        console.log(`[ALTERNATES] Fetched ${alternates.length} lines for ${sid}`);
        return alternates;
      } catch (err: any) {
        const errorMsg = err?.message || "Failed to fetch alternates";
        console.error(`[ALTERNATES] Error for ${sid}:`, errorMsg);
        setError((prev) => ({ ...prev, [sid]: errorMsg }));
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, [sid]: false }));
      }
    },
    [sport]
  );

  const clearCache = useCallback((sid?: string) => {
    if (sid) {
      const cacheKey = `${sport}:${sid}`;
      delete cacheRef.current[cacheKey];
    } else {
      cacheRef.current = {};
    }
  }, [sport]);

  const getCached = useCallback((sid: string): AlternateLine[] | null => {
    const cacheKey = `${sport}:${sid}`;
    const cached = cacheRef.current[cacheKey];
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    return null;
  }, [sport]);

  return {
    fetchAlternates,
    loading,
    error,
    clearCache,
    getCached,
  };
}




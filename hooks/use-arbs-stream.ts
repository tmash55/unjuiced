"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArbRow, fetchArbs, fetchRows } from "@/lib/arbs-client";


type Cache = Map<string, ArbRow>;
type Diff = { add: string[]; upd: string[]; del: string[]; v?: number };
type Dir = "up" | "down";
type Change = { roi?: Dir; o?: Dir; u?: Dir };
type ChangeMap = Map<string, Change>;

const FLASH_MS = 5000; // extend highlight for testing
const NEW_ROW_FADE_MS = 10000; // 10s fade

function dir(a: number | undefined, b: number | undefined): Dir | undefined {
  if (a == null || b == null) return undefined;
  if (b > a) return "up";
  if (b < a) return "down";
  return undefined;
}

export function useArbsStream({ pro, live, eventId, limit = 100 }: { pro: boolean; live: boolean; eventId?: string; limit: number }) {
  const [version, setVersion] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const cacheRef = useRef<Cache>(new Map());
  const prevRef = useRef<Cache>(new Map());
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [lastDiff, setLastDiff] = useState<Diff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<ChangeMap>(new Map());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [authExpired, setAuthExpired] = useState<boolean>(false);
  const [totalCounts, setTotalCounts] = useState<{ all: number; live: number; pregame: number } | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 10;

  // Fetch total counts from API
  const fetchTotalCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/arbs/counts');
      if (response.ok) {
        const data = await response.json();
        setTotalCounts({ all: data.all, live: data.live, pregame: data.pregame });
      }
    } catch (error) {
      console.error('Failed to fetch total counts:', error);
    }
  }, []);

  // Fetch counts on mount and when version changes
  useEffect(() => {
    fetchTotalCounts();
  }, [fetchTotalCounts, version]);

  const registerDiffs = (changedIds: string[]) => {
    if (!changedIds.length) return;
    const next = new Map<string, Change>(changes);
    const cache = cacheRef.current;
    const prev = prevRef.current;
    for (const id of changedIds) {
      const now = cache.get(id);
      const was = prev.get(id);
      if (!now || !was) continue;
      const c: Change = {};
      c.roi = dir(was.roi_bps, now.roi_bps);
      c.o = dir(was.o?.od, now.o?.od);
      c.u = dir(was.u?.od, now.u?.od);
      for (const k of Object.keys(c) as (keyof Change)[]) {
        if (!c[k]) delete c[k];
      }
      if (Object.keys(c).length) next.set(id, c);
    }
    if (next.size) {
      setChanges(next);
      setTimeout(() => {
        setChanges((cur) => {
          const clone = new Map(cur);
          for (const id of changedIds) clone.delete(id);
          return clone;
        });
      }, FLASH_MS);
    }
    for (const id of changedIds) {
      const now = cache.get(id);
      if (now) prev.set(id, now);
    }
  };

  // page loader
  const loadPage = useCallback(async (opts?: { reset?: boolean; cursor?: number }) => {
    const useCur = opts?.cursor !== undefined ? opts.cursor : (opts?.reset ? 0 : cursor);
    setLoading(true);
    try {
      const res = await fetchArbs({ v: 0, limit, cursor: useCur, event_id: eventId });
      if (!("unchanged" in res)) {
        setVersion(res.v);
        setLastUpdated(Date.now());
        const cache = cacheRef.current;
        res.rows.forEach((r, i) => cache.set(res.ids[i], r));
        setIds(res.ids);
        // If limit is undefined (pro users), there's no pagination, so hasMore is false
        // If limit is set, check if we got exactly that many results (indicates more might exist)
        setHasMore(limit !== undefined && res.ids.length === limit);
        const prev = prevRef.current;
        res.rows.forEach((r, i) => prev.set(res.ids[i], r));
        if (opts?.reset) setCursor(0);
        else if (opts?.cursor !== undefined) setCursor(opts.cursor);
      }
    } catch (e: any) {
      setError(e.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [cursor, limit, eventId]);

  // initial & filter change
  useEffect(() => {
    let cancel = false;
    (async () => {
      await loadPage({ reset: true });
    })();
    return () => { cancel = true; };
  }, [eventId, limit, loadPage]);

  const nextPage = useCallback(async () => {
    const newCursor = cursor + limit;
    await loadPage({ cursor: newCursor });
  }, [cursor, limit, loadPage]);

  const prevPage = useCallback(async () => {
    const newCursor = Math.max(0, cursor - limit);
    await loadPage({ cursor: newCursor });
  }, [cursor, limit, loadPage]);

  // SSE for pro (opt-in via live)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDebouncedRefresh = useCallback(() => {
    // Disable full table refresh to prevent flicker; rely on incremental updates
    return;
  }, []);

  useEffect(() => {
    if (!pro || !live) { 
      setConnected(false); 
      setHasFailed(false);
      retryCountRef.current = 0;
      return; 
    }
    let es: EventSource | null = null;
    let backoff = 1000;
    const maxBackoff = 15000;

    const open = () => {
      // Check if we've exceeded max retries
      if (retryCountRef.current >= maxRetries) {
        setHasFailed(true);
        setConnected(false);
        return;
      }
      
      es = new EventSource("/api/sse/arbs", { withCredentials: true } as any);
      es.onopen = () => { 
        setConnected(true); 
        setHasFailed(false);
        backoff = 1000; 
        retryCountRef.current = 0; // Reset on successful connection
      };
      es.onerror = () => {
        setConnected(false);
        try { es?.close(); } catch {}
        es = null;
        
        retryCountRef.current += 1;
        
        // Check if we've hit max retries
        if (retryCountRef.current >= maxRetries) {
          setHasFailed(true);
          return;
        }
        
        setTimeout(() => { backoff = Math.min(backoff * 2, maxBackoff); open(); }, backoff);
      };
      es.onmessage = async (ev) => {
      const idx = (ev.data as string).indexOf("{");
      const json = idx >= 0 ? (ev.data as string).slice(idx) : (ev.data as string);
      let msg: Diff & { v: number };
      try { msg = JSON.parse(json); } catch { return; }

      setVersion(v => Math.max(v, msg.v || v));
      setLastUpdated(Date.now());
      setLastDiff({ add: msg.add || [], upd: msg.upd || [], del: msg.del || [], v: msg.v });

      if (msg.del?.length) {
        const cache = cacheRef.current;
        msg.del.forEach(id => cache.delete(id));
        setIds(prev => prev.filter(id => !msg.del.includes(id)));
        const prev = prevRef.current;
        msg.del.forEach(id => prev.delete(id));
      }

      const need = [...new Set([...(msg.add||[]), ...(msg.upd||[])])];
      for (let i = 0; i < need.length; i += 500) {
        const chunk = need.slice(i, i + 500);
        let rows: Array<{ id: string; row: ArbRow | null }> = [];
        try {
          rows = await fetchRows(chunk);
        } catch (e: any) {
          if ((e?.message || "").includes("AUTH_EXPIRED")) {
            setConnected(false);
            setAuthExpired(true);
            setError("Session expired. Please reconnect.");
            // Attempt silent cookie refresh
            try {
              await fetch('/api/auth/refresh-plan?onlyIfExpLt=999999', { method: 'POST', credentials: 'include' });
              // try one immediate page load again
              await loadPage({ reset: false });
              setAuthExpired(false);
              setError(null);
              return;
            } catch {
              // fall through to show banner; user can click reconnect
              return;
            }
          }
          throw e;
        }
        const cache = cacheRef.current;
        rows.forEach(({ id, row }) => { if (row) cache.set(id, row); else cache.delete(id); });
      }
      setIds(prev => {
        const merged = new Set(prev);
        (msg.add || []).forEach(id => merged.add(id));
        return Array.from(merged);
      });

      // mark newly added for UI fade-in
      const markForHighlight = (ids: string[] | undefined) => {
        if (!ids || ids.length === 0) return;
        setAdded(prev => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
        setTimeout(() => {
          setAdded(prev => {
            const next = new Set(prev);
            for (const id of ids!) next.delete(id);
            return next;
          });
        }, 10000);
      };

      if (msg.add?.length) {
        markForHighlight(msg.add);
      }
      if (msg.upd?.length) {
        // Also highlight pure updates (including live<->pregame flips)
        markForHighlight(msg.upd);
      }

      registerDiffs(need);

      // no full refresh; incremental update only to avoid flicker
      };
    };
    open();
    return () => { try { es?.close(); } catch {} };
  }, [pro, live, scheduleDebouncedRefresh]);

  const rows = useMemo(() => ids.map(id => cacheRef.current.get(id)).filter(Boolean) as ArbRow[], [ids]);

  const refresh = useCallback(async () => {
    const res = await fetchArbs({ v: version, limit, event_id: eventId, cursor });
    if ("unchanged" in res) return false;
    setVersion(res.v);
    setLastUpdated(Date.now());
    const cache = cacheRef.current;
    res.rows.forEach((r, i) => cache.set(res.ids[i], r));
    setIds(res.ids);
    registerDiffs(res.ids);
    return true;
  }, [version, eventId, limit, cursor]);

  // When live toggles from off -> on, perform a refresh to catch up to latest v immediately
  const prevLiveRef = useRef<boolean>(live);
  useEffect(() => {
    if (pro && live && !prevLiveRef.current) {
      void refresh();
    }
    prevLiveRef.current = live;
  }, [pro, live, refresh]);

  const reconnectNow = useCallback(() => {
    try { location.reload(); } catch {}
  }, []);

  return { rows, ids, changes, added, version, loading, connected, lastDiff, error, cursor, hasMore, nextPage, prevPage, setCursor, lastUpdated, refresh, authExpired, reconnectNow, totalCounts, hasFailed };
}
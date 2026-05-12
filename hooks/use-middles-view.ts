"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMiddles,
  fetchMiddlesCounts,
  type MiddleMode,
  type MiddleRow,
} from "@/lib/middles-client";

type Dir = "up" | "down";
export type MiddleChange = { score?: Dir; o?: Dir; u?: Dir };
export type MiddleChangeMap = Map<string, MiddleChange>;

function dir(
  prev: number | undefined,
  next: number | undefined,
): Dir | undefined {
  if (prev == null || next == null) return undefined;
  if (next > prev) return "up";
  if (next < prev) return "down";
  return undefined;
}

function matchesSearch(row: MiddleRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    row.ent,
    row.mkt,
    row.sp,
    row.lg?.name,
    row.ev?.home?.abbr,
    row.ev?.home?.name,
    row.ev?.away?.abbr,
    row.ev?.away?.name,
    row.o?.bk,
    row.u?.bk,
    row.o?.name,
    row.u?.name,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function matchesBooks(row: MiddleRow, books: string[]): boolean {
  if (!books.length) return true;
  const selected = new Set(books.map((book) => book.toLowerCase()));
  return (
    selected.has(row.o?.bk?.toLowerCase()) ||
    selected.has(row.u?.bk?.toLowerCase())
  );
}

function matchesLeagues(row: MiddleRow, leagues: string[]): boolean {
  if (!leagues.length) return true;
  const selected = new Set(leagues.map((league) => league.toLowerCase()));
  return Boolean(
    selected.has(String(row.sp || "").toLowerCase()) ||
      selected.has(String(row.lg?.id || "").toLowerCase()),
  );
}

function matchesMarkets(row: MiddleRow, markets: string[]): boolean {
  if (!markets.length) return true;
  const selected = new Set(markets.map((market) => market.toLowerCase()));
  return selected.has(String(row.mkt || "").toLowerCase());
}

export function useMiddlesView({
  auto,
  eventId,
  limit = 1000,
  mode = "pregame",
  search = "",
  selectedBooks = [],
  selectedLeagues = [],
  selectedMarkets = [],
  minGap = 0,
  minMiddlePct = 0,
  maxMissLossPct = 5,
  hideRegional = false,
}: {
  auto: boolean;
  eventId?: string;
  limit?: number;
  mode?: MiddleMode;
  search?: string;
  selectedBooks?: string[];
  selectedLeagues?: string[];
  selectedMarkets?: string[];
  minGap?: number;
  minMiddlePct?: number;
  maxMissLossPct?: number;
  hideRegional?: boolean;
}) {
  const [version, setVersion] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [rowsById, setRowsById] = useState<Map<string, MiddleRow>>(new Map());
  const previousRowsRef = useRef<Map<string, MiddleRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    all: number;
    live: number;
    pregame: number;
  } | null>(null);
  const [changes, setChanges] = useState<MiddleChangeMap>(new Map());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const fetchGenRef = useRef(0);

  const registerDiffs = useCallback(
    (nextRows: Map<string, MiddleRow>, nextIds: string[]) => {
      const prev = previousRowsRef.current;
      const nextChanges = new Map<string, MiddleChange>();
      const nextAdded = new Set<string>();

      for (const id of nextIds) {
        const current = nextRows.get(id);
        const previous = prev.get(id);
        if (!current) continue;
        if (!previous) {
          nextAdded.add(id);
          continue;
        }

        const change: MiddleChange = {
          score: dir(previous.score_bps, current.score_bps),
          o: dir(previous.o?.od, current.o?.od),
          u: dir(previous.u?.od, current.u?.od),
        };
        for (const key of Object.keys(change) as Array<keyof MiddleChange>) {
          if (!change[key]) delete change[key];
        }
        if (Object.keys(change).length) nextChanges.set(id, change);
      }

      previousRowsRef.current = new Map(nextRows);

      if (nextChanges.size) {
        setChanges(nextChanges);
        setTimeout(() => setChanges(new Map()), 5000);
      }
      if (nextAdded.size) {
        setAdded(nextAdded);
        setTimeout(() => setAdded(new Set()), 10000);
      }
    },
    [],
  );

  const refreshCounts = useCallback(async () => {
    const nextCounts = await fetchMiddlesCounts();
    setCounts({
      all: nextCounts.all,
      live: nextCounts.live,
      pregame: nextCounts.pregame,
    });
    return nextCounts.v;
  }, []);

  const refresh = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setRefreshing(true);
    setError(null);

    try {
      const [payload] = await Promise.all([
        fetchMiddles({ v: 0, limit, cursor: 0, event_id: eventId, mode }),
        refreshCounts().catch(() => null),
      ]);
      if (gen !== fetchGenRef.current) return;
      if ("unchanged" in payload) return;

      const nextRows = new Map<string, MiddleRow>();
      payload.rows.forEach((row, index) =>
        nextRows.set(payload.ids[index], row),
      );
      registerDiffs(nextRows, payload.ids);
      setRowsById(nextRows);
      setIds(payload.ids);
      setVersion(payload.v);
      setLastUpdated(Date.now());
    } catch (err: any) {
      if (gen === fetchGenRef.current) setError(err?.message || "fetch failed");
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [eventId, limit, mode, refreshCounts, registerDiffs]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;

    const timer = window.setInterval(async () => {
      try {
        const nextVersion = await refreshCounts();
        if (nextVersion && nextVersion !== version) void refresh();
      } catch {
        void 0;
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [auto, refresh, refreshCounts, version]);

  const rows = useMemo(
    () => ids.map((id) => rowsById.get(id)).filter(Boolean) as MiddleRow[],
    [ids, rowsById],
  );

  const filteredPairs = useMemo(() => {
    const pairs = ids
      .map((id) => ({ id, row: rowsById.get(id) }))
      .filter((pair): pair is { id: string; row: MiddleRow } =>
        Boolean(pair.row),
      );

    return pairs.filter(({ row }) => {
      if (!matchesSearch(row, search)) return false;
      if (!matchesBooks(row, selectedBooks)) return false;
      if (!matchesLeagues(row, selectedLeagues)) return false;
      if (!matchesMarkets(row, selectedMarkets)) return false;
      if (Number(row.gap || 0) < minGap) return false;
      if (Number(row.middle_bps || 0) / 100 < minMiddlePct) return false;
      if (Number(row.worst_case_bps || 0) / 100 < -Math.abs(maxMissLossPct))
        return false;
      if (hideRegional && row.has_regional) return false;
      return true;
    });
  }, [
    hideRegional,
    ids,
    maxMissLossPct,
    minGap,
    minMiddlePct,
    rowsById,
    search,
    selectedBooks,
    selectedLeagues,
    selectedMarkets,
  ]);

  const filteredRows = useMemo(
    () => filteredPairs.map((pair) => pair.row),
    [filteredPairs],
  );
  const filteredIds = useMemo(
    () => filteredPairs.map((pair) => pair.id),
    [filteredPairs],
  );

  const availableMarkets = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.mkt) set.add(row.mkt);
    });
    return Array.from(set).sort();
  }, [rows]);

  return {
    rows: filteredRows,
    ids: filteredIds,
    allRows: rows,
    version,
    loading,
    refreshing,
    lastUpdated,
    error,
    counts,
    changes,
    added,
    availableMarkets,
    refresh,
    hasActiveFilters:
      Boolean(search.trim()) ||
      selectedBooks.length > 0 ||
      selectedLeagues.length > 0 ||
      selectedMarkets.length > 0 ||
      minGap > 0 ||
      minMiddlePct > 0 ||
      maxMissLossPct < 5 ||
      hideRegional,
  };
}

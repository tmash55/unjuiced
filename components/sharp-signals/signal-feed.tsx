"use client";

import { useState, useEffect, useCallback } from "react";
import type { WhaleSignal, FeedResponse } from "@/lib/polymarket/types";
import { SignalCard } from "./signal-card";

const SPORTS = ["all", "nba", "nhl", "mlb", "nfl", "soccer", "mma", "tennis"];
const TIERS = ["all", "S", "A", "B", "C", "FADE", "NEW"];
const PAGE_SIZE = 20;

export function SignalFeed() {
  const [signals, setSignals] = useState<WhaleSignal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [sport, setSport] = useState("all");
  const [tier, setTier] = useState("all");
  const [minStake, setMinStake] = useState(0);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (sport !== "all") params.set("sport", sport);
    if (tier !== "all") params.set("tier", tier);
    if (minStake > 0) params.set("minStake", String(minStake));

    try {
      const res = await fetch(`/api/polymarket/feed?${params}`);
      const data: FeedResponse = await res.json();
      setSignals(data.signals ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [page, sport, tier, minStake]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sport}
          onChange={(e) => { setSport(e.target.value); setPage(0); }}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Sports" : s.toUpperCase()}</option>
          ))}
        </select>

        <select
          value={tier}
          onChange={(e) => { setTier(e.target.value); setPage(0); }}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All Tiers" : `Tier ${t}`}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <label className="text-xs text-neutral-500">Min $</label>
          <input
            type="number"
            value={minStake || ""}
            onChange={(e) => { setMinStake(Number(e.target.value) || 0); setPage(0); }}
            placeholder="0"
            className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
          />
        </div>

        <span className="text-xs text-neutral-500 ml-auto">
          {total} signals
        </span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-neutral-500">Loading signals...</div>
      ) : signals.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">No signals found</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-xs rounded bg-neutral-800 text-neutral-300 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-neutral-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-xs rounded bg-neutral-800 text-neutral-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

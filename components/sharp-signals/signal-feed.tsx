"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { WhaleSignal, FeedResponse } from "@/lib/polymarket/types";
import { SignalCard } from "./signal-card";

const SPORTS = ["all", "nba", "nhl", "mlb", "nfl", "soccer", "mma", "tennis"];
const TIERS = ["all", "S", "A", "B", "C", "FADE", "NEW"];
const SORT_OPTIONS = [
  { value: "score", label: "Best Score" },
  { value: "recent", label: "Most Recent" },
  { value: "stake", label: "Largest Stake" },
];
const PAGE_SIZE = 20;

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap",
        active
          ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
          : "bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
      )}
    >
      {children}
    </button>
  );
}

export function SignalFeed() {
  const [signals, setSignals] = useState<WhaleSignal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [sport, setSport] = useState("all");
  const [tier, setTier] = useState("all");
  const [minStake, setMinStake] = useState(0);
  const [sort, setSort] = useState("score");

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sort,
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
  }, [page, sport, tier, minStake, sort]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="space-y-3">
        {/* Sport pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <SlidersHorizontal className="w-4 h-4 text-neutral-500 shrink-0" />
          {SPORTS.map((s) => (
            <PillButton
              key={s}
              active={sport === s}
              onClick={() => { setSport(s); setPage(0); }}
            >
              {s === "all" ? "All Sports" : s.toUpperCase()}
            </PillButton>
          ))}
        </div>

        {/* Tier pills + sort + min stake */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {TIERS.map((t) => (
              <PillButton
                key={t}
                active={tier === t}
                onClick={() => { setTier(t); setPage(0); }}
              >
                {t === "all" ? "All Tiers" : `Tier ${t}`}
              </PillButton>
            ))}
          </div>

          <div className="h-5 w-px bg-neutral-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</span>
              <input
                type="number"
                value={minStake || ""}
                onChange={(e) => { setMinStake(Number(e.target.value) || 0); setPage(0); }}
                placeholder="Min"
                className="w-20 bg-neutral-800/60 border border-neutral-700/50 rounded-lg pl-6 pr-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-all"
              />
            </div>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(0); }}
                className="appearance-none bg-neutral-800/60 border border-neutral-700/50 rounded-lg px-3 pr-7 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500/40 cursor-pointer transition-all"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <span className="text-xs text-neutral-500 ml-auto tabular-nums">
            {total.toLocaleString()} signal{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-neutral-500">
            <div className="w-5 h-5 border-2 border-neutral-600 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-sm">Loading signals...</span>
          </div>
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
          <Search className="w-8 h-8 mb-2 opacity-40" />
          <span className="text-sm">No signals found</span>
          <span className="text-xs text-neutral-600 mt-1">Try adjusting your filters</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {signals.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <SignalCard signal={s} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/60 text-neutral-300 border border-neutral-700/50 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Prev
          </button>
          <span className="text-xs text-neutral-500 tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-800/60 text-neutral-300 border border-neutral-700/50 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

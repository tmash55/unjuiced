"use client";

import { useState, useEffect, useCallback } from "react";
import { GameCard } from "./game-card";

const SPORTS = ["all", "nba", "nhl", "mlb", "soccer", "tennis", "mma"];
const CONFIDENCE_OPTIONS = ["all", "strong", "lean"];

export interface GameOutcome {
  outcome: string;
  total_dollars: number;
  sharp_count: number;
  whale_count: number;
  total_bets: number;
  avg_entry_price: number;
  best_book: string | null;
  best_book_price: string | null;
  best_book_decimal: number | null;
  wins: number;
  losses: number;
  bets: {
    anon_id: string;
    tier: string;
    bet_size: number;
    entry_price: number;
    american_odds: number;
    result: string | null;
    quality_score: number | null;
    created_at: string;
  }[];
}

export interface GameSignal {
  condition_id: string;
  market_title: string;
  sport: string | null;
  market_type: string | null;
  game_date: string | null;
  game_start_time: string | null;
  resolved: boolean;
  consensus_outcome: string;
  consensus_result: "win" | "loss" | "pending";
  flow_pct: number;
  confidence: "strong" | "lean" | "split";
  total_dollars: number;
  total_bets: number;
  total_sharps: number;
  total_whales: number;
  outcomes: GameOutcome[];
  first_signal_at: string;
  last_signal_at: string;
}

export function GameFeed() {
  const [games, setGames] = useState<GameSignal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sport, setSport] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [resolvedFilter, setResolvedFilter] = useState("all");

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (sport !== "all") params.set("sport", sport);
    if (confidence !== "all") params.set("confidence", confidence);
    if (todayOnly) params.set("today", "true");
    if (resolvedFilter !== "all") params.set("resolved", resolvedFilter);

    try {
      const res = await fetch(`/api/polymarket/games?${params}`);
      const data = await res.json();
      setGames(data.games ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [sport, confidence, todayOnly, resolvedFilter]);

  useEffect(() => {
    fetchGames();
    // Auto-refresh every 30s
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All Sports" : s.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
        >
          {CONFIDENCE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All Confidence" : c === "strong" ? "🟢 Strong" : "🟡 Lean"}
            </option>
          ))}
        </select>

        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
        >
          <option value="all">All Markets</option>
          <option value="false">Pending</option>
          <option value="true">Resolved</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
            className="rounded border-neutral-600 bg-neutral-800 text-sky-500 focus:ring-sky-500"
          />
          Today only
        </label>

        <span className="text-xs text-neutral-500 ml-auto">
          {total} markets
        </span>
      </div>

      {/* Game cards */}
      {loading ? (
        <div className="text-center py-12 text-neutral-500">Loading markets...</div>
      ) : games.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">No markets with sharp flow found</div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <GameCard key={game.condition_id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

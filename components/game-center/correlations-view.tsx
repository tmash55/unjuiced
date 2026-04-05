"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMlbCorrelations } from "@/hooks/use-mlb-correlations";
import { useMlbSuggestedParlays } from "@/hooks/use-mlb-suggested-parlays";
import type { CorrelationRow } from "@/app/api/mlb/correlations/route";
import type { SuggestedParlay } from "@/app/api/mlb/suggested-parlays/route";
import type { MlbPlayerSearchResult } from "@/app/api/mlb/player-search/route";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { Loader2, Search, X, ArrowRight, Users, Zap, Hand, Check, Info, ChevronDown, ChevronUp } from "lucide-react";

// ── Confidence Badges ───────────────────────────────────────────────────────

const CONFIDENCE = [
  { tier: "S", label: "Strong", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  { tier: "A", label: "Good", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  { tier: "B", label: "Fair", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30" },
  { tier: "C", label: "Limited", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
] as const;

function getConfidence(tier: string) {
  return CONFIDENCE.find((c) => c.tier === tier) ?? CONFIDENCE[3];
}

function ConfidenceBadge({ tier }: { tier: string }) {
  const c = getConfidence(tier);
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", c.bg, c.color)}>
      {c.tier}
    </span>
  );
}

function rateBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-neutral-500";
}

// ── Market label helpers ────────────────────────────────────────────────────

const MARKET_LABELS: Record<string, string> = {
  hits: "Hits", hr: "HR", tb: "Total Bases", rbi: "RBI", sb: "Stolen Bases",
  pitcher_k: "Strikeouts", pitcher_h: "Hits Allowed", pitcher_er: "Earned Runs",
};

function marketLabel(market: string): string {
  return MARKET_LABELS[market] ?? market;
}

// ── Player Search ───────────────────────────────────────────────────────────

function PlayerSearch({
  onSelect,
  onClear,
  selectedPlayer,
  gameTeams,
}: {
  onSelect: (player: MlbPlayerSearchResult) => void;
  onClear: () => void;
  selectedPlayer: MlbPlayerSearchResult | null;
  /** Only show players from these teams */
  gameTeams?: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MlbPlayerSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const search = useCallback((q: string) => {
    if (q.length < 2) { setResults([]); setIsOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/mlb/player-search?q=${encodeURIComponent(q)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          let players = data.players ?? [];
          // Filter to only players on teams in this game
          if (gameTeams && gameTeams.length > 0) {
            const teamSet = new Set(gameTeams.map((t) => t.toUpperCase()));
            players = players.filter((p: MlbPlayerSearchResult) =>
              p.team_abbr && teamSet.has(p.team_abbr.toUpperCase())
            );
          }
          setResults(players);
          setIsOpen(true);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
  }, []);

  if (selectedPlayer) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/5 dark:bg-brand/10 border border-brand/20">
        <Image
          src={getMlbHeadshotUrl(selectedPlayer.player_id, "tiny")}
          alt={selectedPlayer.name}
          width={24}
          height={24}
          className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
          unoptimized
        />
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">{selectedPlayer.name}</span>
        {selectedPlayer.team_abbr && (
          <span className="text-xs text-neutral-500">{selectedPlayer.team_abbr}</span>
        )}
        <button onClick={onClear} className="ml-auto p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors">
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search player for correlations..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/30 text-neutral-900 dark:text-white"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-400" />}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/50 shadow-2xl overflow-hidden max-h-[320px] overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.player_id}
              onClick={() => { onSelect(p); setQuery(""); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors border-b border-neutral-100/50 dark:border-neutral-800/30 last:border-0"
            >
              <Image
                src={getMlbHeadshotUrl(p.player_id, "tiny")}
                alt={p.name}
                width={28}
                height={28}
                className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
                unoptimized
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{p.name}</div>
                <div className="text-[10px] text-neutral-500">
                  {p.team_abbr ?? ""} {p.position ? `· ${p.position}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Correlation Card ────────────────────────────────────────────────────────

function CorrelationCard({ corr }: { corr: CorrelationRow }) {
  const ctx = corr.context ?? {};
  const aLabel = ctx.a_label ?? `1+ ${marketLabel(corr.player_a_market)}`;
  const bLabel = ctx.b_label ?? (corr.player_b_market ? `1+ ${marketLabel(corr.player_b_market)}` : "");
  const lift = ctx.lift as number | undefined;

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-neutral-500 mb-1">
            When <span className="font-semibold text-neutral-900 dark:text-white">{corr.player_a_name}</span> gets {aLabel}...
          </div>
          {corr.player_b_name && (
            <div className="flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3 text-brand shrink-0" />
              <span className="text-sm font-bold text-neutral-900 dark:text-white">{corr.player_b_name}</span>
              <span className="text-sm text-neutral-500">gets {bLabel}</span>
            </div>
          )}
        </div>
        <ConfidenceBadge tier={corr.confidence} />
      </div>

      {/* Rate bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2.5 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", rateBarColor(corr.co_occurrence_pct))}
            style={{ width: `${Math.min(corr.co_occurrence_pct, 100)}%` }}
          />
        </div>
        <span className={cn(
          "text-sm font-black tabular-nums shrink-0",
          corr.co_occurrence_pct >= 80 ? "text-emerald-400" :
          corr.co_occurrence_pct >= 60 ? "text-blue-400" :
          "text-amber-400"
        )}>
          {corr.co_occurrence_pct.toFixed(1)}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-neutral-500">
        <span className="tabular-nums">{corr.sample_size} games</span>
        {lift != null && lift > 1.15 && (
          <Tooltip content={`${((lift - 1) * 100).toFixed(0)}% more likely than Player B's base rate`} side="top">
            <span className="font-semibold text-emerald-500 cursor-help">{lift.toFixed(2)}x lift</span>
          </Tooltip>
        )}
        {corr.team_abbr && (
          <span className="flex items-center gap-1">
            <img src={`/team-logos/mlb/${corr.team_abbr.toUpperCase()}.svg`} className="w-3 h-3 object-contain" alt="" />
            {corr.team_abbr}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Handedness Card ─────────────────────────────────────────────────────────

function HandednessCard({ corr, pitcherHand }: { corr: CorrelationRow; pitcherHand?: string | null }) {
  const ctx = corr.context ?? {};
  const hand = ctx.pitcher_hand as string | undefined;
  const isMatch = pitcherHand && hand && pitcherHand.toUpperCase() === hand.toUpperCase();
  const label = ctx.label as string | undefined;

  return (
    <div className={cn(
      "rounded-xl border bg-white dark:bg-neutral-900 p-4",
      isMatch ? "border-emerald-500/30" : "border-neutral-200/60 dark:border-neutral-800/60"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-bold text-neutral-900 dark:text-white">
          {corr.player_a_name} <span className="text-neutral-400 font-normal">vs {hand}HP</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isMatch && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Today
            </span>
          )}
          <ConfidenceBadge tier={corr.confidence} />
        </div>
      </div>

      {label && (
        <div className="text-xs text-neutral-500 mb-2">{label}</div>
      )}

      {/* Rate bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full", rateBarColor(corr.co_occurrence_pct))}
            style={{ width: `${Math.min(corr.co_occurrence_pct, 100)}%` }}
          />
        </div>
        <span className={cn("text-sm font-black tabular-nums", corr.co_occurrence_pct >= 80 ? "text-emerald-400" : "text-blue-400")}>
          {corr.co_occurrence_pct.toFixed(1)}%
        </span>
      </div>

      {/* Extra stats from context */}
      <div className="flex items-center gap-3 text-[10px] text-neutral-500">
        <span>{corr.sample_size} games</span>
        {ctx.avg != null && <span>AVG: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Number(ctx.avg).toFixed(3)}</span></span>}
        {ctx.tb_per_game != null && <span>TB/G: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Number(ctx.tb_per_game).toFixed(2)}</span></span>}
        {ctx.hr_rate != null && <span>HR: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Number(ctx.hr_rate).toFixed(1)}%</span></span>}
      </div>
    </div>
  );
}

// ── Smart Parlay Card ───────────────────────────────────────────────────────

function ParlayCard({ parlay }: { parlay: SuggestedParlay }) {
  const typeLabel = parlay.parlay_type === "teammate_stack" ? "Teammate Stack"
    : parlay.parlay_type === "pitcher_domination" ? "Pitcher Dom"
    : "Narrative";

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/40">
        <div className="flex items-center gap-2">
          <ConfidenceBadge tier={parlay.confidence} />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{typeLabel}</span>
        </div>
        {parlay.combined_model_prob != null && (
          <span className="text-xs font-mono tabular-nums text-neutral-500">
            Model: <span className="font-bold text-neutral-900 dark:text-white">{(parlay.combined_model_prob * 100).toFixed(0)}%</span>
            {parlay.correlation_boost != null && parlay.correlation_boost > 0 && (
              <span className="text-emerald-500 ml-1">+{(parlay.correlation_boost * 100).toFixed(0)}% corr</span>
            )}
          </span>
        )}
      </div>

      {/* Narrative */}
      {parlay.narrative && (
        <div className="px-4 py-2.5 text-xs italic text-neutral-500 dark:text-neutral-400 border-b border-neutral-100/50 dark:border-neutral-800/20">
          "{parlay.narrative}"
        </div>
      )}

      {/* Legs */}
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {parlay.legs.map((leg, i) => (
          <div
            key={`${leg.player_id}-${i}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/40 dark:border-neutral-700/20"
          >
            <Image
              src={getMlbHeadshotUrl(leg.player_id, "tiny")}
              alt={leg.player_name}
              width={24}
              height={24}
              className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
              unoptimized
            />
            <div>
              <div className="text-xs font-semibold text-neutral-900 dark:text-white">{leg.player_name}</div>
              <div className="text-[10px] text-neutral-500">
                {leg.line}+ {marketLabel(leg.market)}
                {leg.grade && (
                  <span className={cn("ml-1 font-bold",
                    leg.grade === "S" ? "text-purple-400" :
                    leg.grade === "A" ? "text-emerald-400" :
                    "text-blue-400"
                  )}>
                    {leg.grade}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <Icon className="w-4 h-4 text-brand" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500">{title}</h3>
      <span className="text-[10px] text-neutral-400 tabular-nums">{count}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CorrelationsView({
  gameId,
  pitcherHand,
  gameTeams,
}: {
  gameId: number;
  pitcherHand?: string | null;
  /** Team abbreviations in this game (e.g., ["SEA", "LAA"]) — used to filter out unrelated teams */
  gameTeams?: string[];
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [selectedPlayer, setSelectedPlayer] = useState<MlbPlayerSearchResult | null>(null);
  const [showAllHands, setShowAllHands] = useState(false);

  // Fetch correlations — game mode or player mode
  const { correlations: rawCorrelations, isLoading: corrLoading } = useMlbCorrelations(
    selectedPlayer
      ? { playerId: selectedPlayer.player_id }
      : { gameId }
  );

  // Fetch suggested parlays for this game
  const { parlays, isLoading: parlaysLoading } = useMlbSuggestedParlays(gameId);

  // Filter correlations
  const correlations = useMemo(() => {
    let filtered = rawCorrelations;

    // Remove trivial same-player correlations where one stat implies the other
    // e.g., "When X gets 1+ Hits → X gets 1+ TB" (a hit IS a total base)
    filtered = filtered.filter((c) => {
      if (c.correlation_type !== "teammate_props") return true;
      // Same player with hit→tb or tb→hit at threshold 0.5
      if (c.player_a_id === c.player_b_id) {
        const markets = [c.player_a_market, c.player_b_market].sort();
        // hits always = 1+ TB, so hits↔tb for same player is trivial
        if (markets[0] === "hits" && markets[1] === "tb") return false;
        // Same player, same market is also trivial (when X gets hits → X gets hits)
        if (c.player_a_market === c.player_b_market) return false;
      }
      return true;
    });

    return filtered;
  }, [rawCorrelations, selectedPlayer, gameTeams]);

  // Group correlations by type
  const grouped = useMemo(() => {
    const teammate = correlations.filter((c) => c.correlation_type === "teammate_props");
    const pitcher = correlations.filter((c) => c.correlation_type === "pitcher_vs_team");
    let hand = correlations.filter((c) => c.correlation_type === "vs_hand");

    // Auto-filter handedness to today's pitcher if not showing all
    if (!showAllHands && pitcherHand && hand.length > 0) {
      const filtered = hand.filter((c) => {
        const ctx = c.context ?? {};
        return ctx.pitcher_hand?.toUpperCase() === pitcherHand.toUpperCase();
      });
      if (filtered.length > 0) hand = filtered;
    }

    return { teammate, pitcher, hand };
  }, [correlations, showAllHands, pitcherHand]);

  const [sortBy, setSortBy] = useState<"rate" | "sample" | "lift" | "conf">("rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const CONF_ORDER: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };

  // Sort teammate stacks
  const sortedTeammate = useMemo(() => {
    return [...grouped.teammate].sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case "rate": diff = a.co_occurrence_pct - b.co_occurrence_pct; break;
        case "sample": diff = a.sample_size - b.sample_size; break;
        case "lift": diff = ((a.context?.lift as number) ?? 0) - ((b.context?.lift as number) ?? 0); break;
        case "conf": diff = (CONF_ORDER[a.confidence] ?? 0) - (CONF_ORDER[b.confidence] ?? 0); break;
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [grouped.teammate, sortBy, sortDir]);

  const isLoading = corrLoading || parlaysLoading;

  return (
    <div className="space-y-4">
      {/* Player Search */}
      <PlayerSearch
        selectedPlayer={selectedPlayer}
        onSelect={setSelectedPlayer}
        onClear={() => setSelectedPlayer(null)}
        gameTeams={gameTeams}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <span className="ml-2 text-sm text-neutral-500">Loading correlations...</span>
        </div>
      ) : (
        <>
          {/* Smart Parlays */}
          {!selectedPlayer && parlays.length > 0 && (
            <>
              <SectionHeader icon={Zap} title="Smart Parlays" count={parlays.length} />
              <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                {parlays.map((p) => (
                  <ParlayCard key={p.id} parlay={p} />
                ))}
              </div>
            </>
          )}

          {/* Teammate Stacks — Table layout */}
          {sortedTeammate.length > 0 && (
            <>
              <SectionHeader icon={Users} title="Teammate Stacks" count={sortedTeammate.length} />

              {isMobile ? (
                <div className="space-y-2 mt-3">
                  {sortedTeammate.map((c, i) => (
                    <CorrelationCard key={`tm-${i}`} corr={c} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-neutral-900 overflow-hidden mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-200/80 dark:border-neutral-700/80">
                        <th className="py-2.5 px-4 text-left font-medium">When</th>
                        <th className="py-2.5 px-2 text-center font-medium w-8"></th>
                        <th className="py-2.5 px-4 text-left font-medium">Then</th>
                        {([
                          { key: "rate" as const, label: "Rate", tip: "Co-occurrence rate — how often both outcomes hit in the same game" },
                          { key: "sample" as const, label: "Games", tip: "Number of games where both players appeared together" },
                          { key: "lift" as const, label: "Lift", tip: "How much more likely Player B's outcome is when Player A hits, vs their normal rate. 1.3x = 30% more likely. Higher = stronger correlation.", hasInfo: true },
                          { key: "conf" as const, label: "Conf", tip: "S = 100+ games (Strong) · A = 60+ (Good) · B = 30+ (Fair) · C = 20+ (Limited)" },
                        ]).map((col) => (
                          <th key={col.key} className="py-2.5 px-3 text-center font-medium">
                            <Tooltip content={col.tip} side="top">
                              <button
                                onClick={() => handleSort(col.key)}
                                className="w-full flex items-center justify-center gap-1 cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                              >
                                {col.label}
                                {col.hasInfo && <Info className="w-3 h-3 text-neutral-400" />}
                                {sortBy === col.key
                                  ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-brand" /> : <ChevronUp className="w-3 h-3 text-brand" />)
                                  : <ChevronDown className="w-3 h-3 opacity-30" />}
                              </button>
                            </Tooltip>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeammate.map((c, i) => {
                        const ctx = c.context ?? {};
                        const aLabel = ctx.a_label ?? `1+ ${marketLabel(c.player_a_market)}`;
                        const bLabel = ctx.b_label ?? `1+ ${marketLabel(c.player_b_market ?? "")}`;
                        const lift = ctx.lift as number | undefined;
                        return (
                          <tr
                            key={`tm-row-${i}`}
                            className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                {c.team_abbr && (
                                  <img src={`/team-logos/mlb/${c.team_abbr.toUpperCase()}.svg`} className="w-4 h-4 object-contain shrink-0" alt="" />
                                )}
                                <div>
                                  <span className="font-semibold text-neutral-900 dark:text-white text-xs">{c.player_a_name}</span>
                                  <span className="text-neutral-500 text-xs ml-1">{aLabel}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <ArrowRight className="w-3.5 h-3.5 text-brand mx-auto" />
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-semibold text-neutral-900 dark:text-white text-xs">{c.player_b_name}</span>
                              <span className="text-neutral-500 text-xs ml-1">{bLabel}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-700/50 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", rateBarColor(c.co_occurrence_pct))}
                                    style={{ width: `${Math.min(c.co_occurrence_pct, 100)}%` }}
                                  />
                                </div>
                                <span className={cn(
                                  "text-xs font-bold tabular-nums",
                                  c.co_occurrence_pct >= 80 ? "text-emerald-400" :
                                  c.co_occurrence_pct >= 60 ? "text-blue-400" :
                                  "text-amber-400"
                                )}>
                                  {c.co_occurrence_pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center text-xs text-neutral-500 tabular-nums">
                              {c.sample_size}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {lift != null && lift > 1.0 ? (
                                <span className={cn("text-xs font-bold tabular-nums", lift > 1.2 ? "text-emerald-400" : "text-neutral-400")}>
                                  {lift.toFixed(2)}x
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-500">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <ConfidenceBadge tier={c.confidence} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Pitcher Domination */}
          {grouped.pitcher.length > 0 && (
            <>
              <SectionHeader icon={Zap} title="Pitcher Domination" count={grouped.pitcher.length} />
              <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                {grouped.pitcher.map((c, i) => (
                  <CorrelationCard key={`pd-${i}`} corr={c} />
                ))}
              </div>
            </>
          )}

          {/* Handedness Edges */}
          {grouped.hand.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-brand" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500">Handedness Edges</h3>
                  <span className="text-[10px] text-neutral-400 tabular-nums">{grouped.hand.length}</span>
                </div>
                {pitcherHand && (
                  <button
                    onClick={() => setShowAllHands(!showAllHands)}
                    className="text-[10px] font-semibold text-brand hover:text-brand/80 transition-colors"
                  >
                    {showAllHands ? `Show vs ${pitcherHand}HP only` : "Show all hands"}
                  </button>
                )}
              </div>
              <div className={cn("grid gap-3 mt-3", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
                {grouped.hand.map((c, i) => (
                  <HandednessCard key={`hd-${i}`} corr={c} pitcherHand={pitcherHand} />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {correlations.length === 0 && parlays.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
              <Users className="w-8 h-8 mb-2 text-neutral-400" />
              <span className="text-sm">
                {selectedPlayer
                  ? `No correlations found for ${selectedPlayer.name}`
                  : "No correlations available for this game"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

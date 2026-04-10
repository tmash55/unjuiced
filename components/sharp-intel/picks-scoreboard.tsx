"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useActivePlays } from "@/hooks/use-active-plays";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { PickCardV2 } from "./pick-card-v2";
import { SegmentedControl } from "@/components/cheat-sheet/sheet-filter-bar";
import { Loader2, Shield, TrendingUp, Zap } from "lucide-react";

const SPORT_OPTIONS = [
  { label: "All", value: "" },
  { label: "NBA", value: "nba" },
  { label: "MLB", value: "mlb" },
  { label: "NHL", value: "nhl" },
  { label: "Soccer", value: "soccer" },
  { label: "Tennis", value: "tennis" },
  { label: "MMA", value: "mma" },
  { label: "Golf", value: "golf" },
];

const MIN_SCORE_OPTIONS = [
  { label: "All", value: "0" },
  { label: "60+", value: "60" },
  { label: "75+", value: "75" },
  { label: "85+", value: "85" },
  { label: "90+", value: "90" },
];

export function PicksScoreboard() {
  const [sport, setSport] = useState("");
  const [minScore, setMinScore] = useState("60");
  const [label, setLabel] = useState("");

  const { prefs } = useSignalPreferences();
  const bankroll = (prefs as any)?.bankroll ?? null;
  const riskTolerance = ((prefs as any)?.risk_tolerance as "conservative" | "moderate" | "aggressive") ?? "moderate";

  const { data, isLoading, isFetching } = useActivePlays({
    minScore: Number(minScore),
    sport: sport || null,
    label: label || null,
  });

  const plays = data?.plays ?? [];

  // Summary stats
  const nuclearCount = plays.filter((p) => p.play_score >= 90).length;
  const strongCount = plays.filter((p) => p.play_score >= 75 && p.play_score < 90).length;
  const totalVolume = plays.reduce((sum, p) => sum + parseFloat(p.total_sharp_volume ?? "0"), 0);

  return (
    <div className="space-y-4">
      {/* Trust banner */}
      <div className="rounded-xl bg-neutral-50/80 dark:bg-neutral-950/40 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Shield className="w-3.5 h-3.5 text-brand" />
          <span>Plays scored <span className="font-bold text-neutral-300">85+</span> have historically won <span className="font-bold text-emerald-500">67.4%</span> across 20,000+ signals</span>
          <span className="text-neutral-600 dark:text-neutral-700">·</span>
          <span>90+ = <span className="font-bold text-emerald-500">72.2%</span></span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sport pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {SPORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSport(s.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors",
                sport === s.value
                  ? "bg-brand text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />

        {/* Min score */}
        <SegmentedControl
          value={minScore}
          onChange={setMinScore}
          options={MIN_SCORE_OPTIONS}
        />

        <div className="flex-1" />

        {/* Summary */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-neutral-500">{plays.length} plays</span>
          {nuclearCount > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <Zap className="w-3 h-3" /> {nuclearCount} Nuclear
            </span>
          )}
          {strongCount > 0 && (
            <span className="flex items-center gap-1 text-orange-500 font-bold">
              <TrendingUp className="w-3 h-3" /> {strongCount} Strong
            </span>
          )}
          {isFetching && !isLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
          )}
        </div>
      </div>

      {/* Label pills */}
      <div className="flex items-center gap-1">
        {["", "NUCLEAR", "STRONG", "LEAN", "WATCH"].map((l) => (
          <button
            key={l}
            onClick={() => setLabel(l)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors",
              label === l
                ? l === "NUCLEAR" ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/30"
                  : l === "STRONG" ? "bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/30"
                  : l === "LEAN" ? "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30"
                  : l === "WATCH" ? "bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/30"
                  : "bg-brand text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            {l || "All Labels"}
          </button>
        ))}
      </div>

      {/* Play cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
            <p className="text-sm text-neutral-500 mt-3">Loading plays...</p>
          </div>
        </div>
      ) : plays.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-sm font-bold text-neutral-900 dark:text-white">No active plays</p>
            <p className="text-xs text-neutral-500 mt-1">Try lowering the minimum score filter or selecting a different sport.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {plays.map((play) => (
            <PickCardV2
              key={play.id}
              play={play}
              bankroll={bankroll}
              riskTolerance={riskTolerance}
            />
          ))}
        </div>
      )}
    </div>
  );
}

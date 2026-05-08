"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GameCard as GameCardType, Pitcher, TeamOffense, RecentStart, Sportsbook } from "@/lib/nrfi-data";
import { getLeanLabel, getLeanClasses } from "@/lib/nrfi-data";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { useStateLink } from "@/hooks/use-state-link";
import { formatGameTimeForUser } from "@/lib/mlb/game-time";
import {
  ChevronDown,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Snowflake,
  Thermometer,
  Wind,
  Heart,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.square || null;
}

function TeamLogo({ abbr, size = 20 }: { abbr: string; size?: number }) {
  return (
    <Image
      src={`/team-logos/mlb/${abbr.toUpperCase()}.svg`}
      alt={abbr}
      width={size}
      height={size}
      className="object-contain shrink-0"
    />
  );
}

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "bg-emerald-500", text: "text-white", border: "border-l-emerald-500" },
  "A":  { bg: "bg-emerald-500", text: "text-white", border: "border-l-emerald-500" },
  "B+": { bg: "bg-teal-500", text: "text-white", border: "border-l-teal-500" },
  "B":  { bg: "bg-teal-500", text: "text-white", border: "border-l-teal-500" },
  "C":  { bg: "bg-amber-500", text: "text-white", border: "border-l-amber-500" },
  "D":  { bg: "bg-red-500", text: "text-white", border: "border-l-red-500" },
  "F":  { bg: "bg-red-700", text: "text-white", border: "border-l-red-700" },
};

function getGradeStyle(grade: string) {
  return GRADE_STYLES[grade] ?? GRADE_STYLES["C"];
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-red-500" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-emerald-500" />;
  return <Minus className="w-3 h-3 text-neutral-400" />;
}

function StreakDisplay({ starts }: { starts: RecentStart[] }) {
  if (starts.length === 0) return null;
  let streak = 0;
  const isNrfi = starts[0]?.scoreless;
  for (const s of starts) {
    if (s.scoreless === isNrfi) streak++;
    else break;
  }
  if (streak < 2) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
      isNrfi ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
    )}>
      {isNrfi ? <Flame className="w-3 h-3" /> : <Snowflake className="w-3 h-3" />}
      {streak}
    </span>
  );
}

// ── Pitcher Mini Card ────────────────────────────────────────────────────────

function PitcherMini({ pitcher, side }: { pitcher: Pitcher; side: "away" | "home" }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Image
          src={getMlbHeadshotUrl(pitcher.playerId, "tiny")}
          alt={pitcher.name}
          width={32} height={32}
          className="rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0"
          unoptimized
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">{pitcher.name}</span>
            <span className="text-[10px] text-neutral-400">{pitcher.team}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-bold text-emerald-500 tabular-nums">{pitcher.scorelessRecord} ({pitcher.scorelessPct}%)</span>
            <StreakDisplay starts={pitcher.recentStarts} />
          </div>
        </div>
      </div>
      {/* Key stats row */}
      <div className="flex items-center gap-3 text-[10px] text-neutral-500">
        <span>WHIP <span className="font-bold text-neutral-300">{pitcher.whip}</span></span>
        <span>K% <span className="font-bold text-neutral-300">{pitcher.k_pct}</span></span>
        <span>BB% <span className={cn("font-bold", parseFloat(pitcher.bb_pct) > 9 ? "text-amber-400" : "text-neutral-300")}>{pitcher.bb_pct}</span></span>
      </div>
    </div>
  );
}

// ── Main Game Card ───────────────────────────────────────────────────────────

export function GameCardV2({
  game,
  expanded,
  onToggle,
}: {
  game: GameCardType;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lm = getLeanClasses(game.lean);
  const gs = getGradeStyle(game.grade);
  const applyState = useStateLink();

  // Best odds
  const primarySide = lm.isNrfi || lm.color === "yellow" ? "NRFI" : "YRFI";
  const primaryOdds = primarySide === "NRFI" ? game.bestNrfiOdds : game.bestYrfiOdds;
  const gameTime = formatGameTimeForUser(game.gameDatetime, {
    fallback: game.gameTime,
    includeTimeZoneName: true,
  });
  const bestBook = game.sportsbooks.length > 0
    ? game.sportsbooks.reduce((best, b) => {
        const price = primarySide === "NRFI" ? b.nrfiOdds : b.yrfiOdds;
        const bestPrice = primarySide === "NRFI" ? best.nrfiOdds : best.yrfiOdds;
        if (price === "-") return best;
        if (bestPrice === "-") return b;
        return parseFloat(price) > parseFloat(bestPrice) ? b : best;
      })
    : null;

  return (
    <div className={cn(
      "rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 border-l-[3px] overflow-hidden transition-all",
      gs.border
    )}>
      {/* ── Collapsed view ────────────────────────────────────────────── */}
      <button onClick={onToggle} className="w-full text-left p-4 group">
        {/* Top row: Grade + Lean + Matchup + Time + Odds */}
        <div className="flex items-start gap-3">
          {/* Grade badge */}
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", gs.bg)}>
            <span className={cn("text-sm font-black", gs.text)}>{game.grade}</span>
          </div>

          {/* Matchup info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", lm.text)}>
                {getLeanLabel(game.lean)}
              </span>
              {game.nrfiResult != null && (
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  game.nrfiResult ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
                )}>
                  {game.nrfiResult ? "NRFI ✓" : "YRFI ✗"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TeamLogo abbr={game.awayTricode} size={16} />
              <span className="text-sm font-bold text-neutral-900 dark:text-white">{game.awayTricode}</span>
              <span className="text-[10px] text-neutral-400">@</span>
              <TeamLogo abbr={game.homeTricode} size={16} />
              <span className="text-sm font-bold text-neutral-900 dark:text-white">{game.homeTricode}</span>
              <span className="text-[10px] text-neutral-400 ml-1">{gameTime}</span>
            </div>
          </div>

          {/* Odds pill */}
          <div className="flex items-center gap-2 shrink-0">
            {bestBook && getBookLogo(bestBook.name) && (
              <img src={getBookLogo(bestBook.name)!} alt="" className="h-4 w-4 object-contain opacity-70" />
            )}
            <span className={cn("text-lg font-black tabular-nums", lm.text)}>{primaryOdds}</span>
            <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", expanded && "rotate-180")} />
          </div>
        </div>

        {/* Pitcher pairing row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/40">
          <PitcherMini pitcher={game.awayPitcher} side="away" />
          <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
          <PitcherMini pitcher={game.homePitcher} side="home" />
        </div>

        {/* Offense Threat Section */}
        <div className="mt-3 pt-2 border-t border-neutral-100/50 dark:border-neutral-800/20 space-y-1.5">
          {[
            { offense: game.homeOffense, pitcher: game.awayPitcher, team: game.homeTricode, label: `vs ${game.awayPitcher.name.split(" ").pop()}` },
            { offense: game.awayOffense, pitcher: game.homePitcher, team: game.awayTricode, label: `vs ${game.homePitcher.name.split(" ").pop()}` },
          ].map(({ offense, team, label }) => {
            const pct = parseFloat(offense.scoringPct);
            const l30 = parseFloat(offense.l30ScoringPct);
            const diff = l30 - pct;
            const trendArrow = diff > 5 ? "↑" : diff < -5 ? "↓" : "→";
            const trendColor = diff > 5 ? "text-red-500" : diff < -5 ? "text-emerald-500" : "text-neutral-400";
            const badge = pct <= 22 ? { label: "NRFI FRIENDLY", cls: "bg-emerald-500/10 text-emerald-500" }
              : pct <= 30 ? { label: "ACTIVE", cls: "bg-amber-500/10 text-amber-500" }
              : pct <= 35 ? { label: "AGGRESSIVE", cls: "bg-orange-500/10 text-orange-500" }
              : { label: "YRFI THREAT", cls: "bg-red-500/10 text-red-500" };

            return (
              <div key={team} className="flex items-center gap-2 text-[10px]">
                <TeamLogo abbr={team} size={14} />
                <span className="text-neutral-500">{label}:</span>
                <span className="font-bold text-neutral-300 tabular-nums">{offense.scoringPct} scoring</span>
                <span className={cn("font-bold tabular-nums", trendColor)}>
                  {trendArrow} {offense.l30ScoringPct}
                </span>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", badge.cls)}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grade breakdown */}
        <div className="mt-2 pt-2 border-t border-neutral-100/30 dark:border-neutral-800/15">
          <span className="text-[9px] text-neutral-400 tabular-nums">
            SP {game.componentScores.pitching?.toFixed(0) ?? "—"} + SP {game.componentScores.pitching?.toFixed(0) ?? "—"} − Off {game.componentScores.offense?.toFixed(0) ?? "—"} + Env {game.componentScores.environment?.toFixed(0) ?? "—"} = {game.gradeScore.toFixed(1)}
          </span>
        </div>
      </button>

      {/* ── Expanded view ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/40">
          {/* Recent starts timeline */}
          <div className="px-4 py-3 grid grid-cols-2 gap-4">
            {[{ pitcher: game.awayPitcher, team: game.awayTricode }, { pitcher: game.homePitcher, team: game.homeTricode }].map(({ pitcher, team }) => (
              <div key={pitcher.playerId}>
                <div className="flex items-center gap-1.5 mb-2">
                  <TeamLogo abbr={team} size={14} />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{pitcher.name} — Last {pitcher.recentStarts.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  {pitcher.recentStarts.map((s, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black",
                        s.scoreless ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                      )}
                      title={`${s.scoreless ? "NRFI" : "YRFI"} ${s.isHome ? "vs" : "@"} ${s.opponent} — ${s.detail}`}
                    >
                      {s.scoreless ? "✓" : "✗"}
                    </div>
                  ))}
                </div>
                {/* Home/Away split */}
                {pitcher.homeNrfiPct && pitcher.awayNrfiPct && (
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-500">
                    <span>Home: <span className="font-bold text-neutral-300">{pitcher.homeNrfiPct}%</span></span>
                    <span>Away: <span className="font-bold text-neutral-300">{pitcher.awayNrfiPct}%</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Team 1st Inning Stats */}
          <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800/40 grid grid-cols-2 gap-4">
            {[
              { offense: game.homeOffense, team: game.homeTricode },
              { offense: game.awayOffense, team: game.awayTricode },
            ].map(({ offense, team }) => (
              <div key={team}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TeamLogo abbr={team} size={14} />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{team} 1st Inning</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  <span className="text-neutral-500">Scoring</span>
                  <span className="font-bold text-neutral-300 tabular-nums text-right">{offense.scoringPct}</span>
                  <span className="text-neutral-500">OPS</span>
                  <span className="font-bold text-neutral-300 tabular-nums text-right">{offense.ops}</span>
                  <span className="text-neutral-500">Home / Away</span>
                  <span className="font-bold text-neutral-300 tabular-nums text-right">{offense.homePct} / {offense.awayPct}</span>
                  <span className="text-neutral-500">L30</span>
                  <span className="font-bold text-neutral-300 tabular-nums text-right">{offense.l30ScoringPct}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Weather & Park */}
          {game.weather && (
            <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/40 flex items-center gap-4 text-[10px] text-neutral-500">
              {game.weather.temperatureF != null && (
                <span className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3" />
                  {game.weather.temperatureF}°F
                </span>
              )}
              {game.weather.windSpeedMph != null && game.weather.windLabel && (
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" />
                  {game.weather.windSpeedMph}mph {game.weather.windLabel}
                </span>
              )}
              <span>Park: {game.parkFactor}</span>
              {game.weather.roofType === "dome" && (
                <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-400 text-[9px] font-medium">Dome</span>
              )}
            </div>
          )}

          {/* All sportsbook odds */}
          {game.sportsbooks.length > 0 && (
            <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Odds Comparison</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {game.sportsbooks
                  .filter((b) => b.nrfiOdds !== "-" || b.yrfiOdds !== "-")
                  .map((book) => {
                    const logo = getBookLogo(book.name);
                    const link = book.link ? (applyState(book.link) || book.link) : null;
                    return (
                      <a
                        key={book.name}
                        href={link ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { if (!link) e.preventDefault(); }}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors",
                          link ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer" : "cursor-default",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          {logo && <img src={logo} alt="" className="h-4 w-4 object-contain" />}
                          <span className="text-[10px] text-neutral-500 truncate">{book.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] tabular-nums shrink-0">
                          <span className="font-bold text-emerald-500">{book.nrfiOdds !== "-" ? book.nrfiOdds : "—"}</span>
                          <span className="text-neutral-600 dark:text-neutral-400">{book.yrfiOdds !== "-" ? book.yrfiOdds : "—"}</span>
                        </div>
                      </a>
                    );
                  })}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-neutral-400">
                <span><span className="text-emerald-500 font-bold">Green</span> = NRFI</span>
                <span>Gray = YRFI</span>
              </div>
            </div>
          )}

          {/* Grade explanation */}
          {game.gradeExplanation && (
            <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-800/20">
              <p className="text-[11px] text-neutral-500">{game.gradeExplanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  GameCard as GameCardType,
  Lean,
  Pitcher,
  TeamOffense,
  RecentStart,
} from "@/lib/nrfi-data";
import { getLeanLabel, getLeanColor } from "@/lib/nrfi-data";
import {
  ChevronUp,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from "lucide-react";

// ─── Color helpers ──────────────────────────────────────────────────────────────

function getLeanTextClass(lean: Lean) {
  const c = getLeanColor(lean);
  if (c === "green") return "text-nrfi-green";
  if (c === "red") return "text-yrfi-red";
  return "text-neutral-yellow";
}

function getGradeBadgeClass(lean: Lean) {
  const c = getLeanColor(lean);
  if (c === "green")
    return "bg-nrfi-green-subtle text-nrfi-green border border-nrfi-green-border";
  if (c === "red")
    return "bg-yrfi-red-subtle text-yrfi-red border border-yrfi-red-border";
  return "bg-neutral-yellow-subtle text-neutral-yellow border border-neutral-yellow-border";
}

function getBgClass(lean: Lean) {
  const c = getLeanColor(lean);
  if (c === "green") return "bg-nrfi-green-subtle border-nrfi-green-border";
  if (c === "red") return "bg-yrfi-red-subtle border-yrfi-red-border";
  return "bg-neutral-yellow-subtle border-neutral-yellow-border";
}

function getLeftAccentStyle(lean: Lean): React.CSSProperties {
  const c = getLeanColor(lean);
  const color =
    c === "green"
      ? "oklch(0.68 0.18 155 / 0.6)"
      : c === "red"
      ? "oklch(0.62 0.2 25 / 0.6)"
      : "oklch(0.78 0.17 85 / 0.6)";
  return { borderLeftColor: color };
}

// ─── Score meter ────────────────────────────────────────────────────────────────

function ScoreMeter({ label, value, lean }: { label: string; value: number; lean: Lean }) {
  const color = getLeanColor(lean);
  const barColor =
    color === "green" ? "bg-nrfi-green" : color === "red" ? "bg-yrfi-red" : "bg-neutral-yellow";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground/80 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-border/50 rounded-full overflow-visible relative">
        <div
          className={cn("h-[3px] rounded-full transition-all duration-500 -mt-px", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground/70 w-6 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ─── Pitcher helpers ────────────────────────────────────────────────────────────

function PitcherStatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      {/* Label — deliberately dim, small, secondary */}
      <span className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">{label}</span>
      {/* Value — larger, bold, clearly primary */}
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          highlight ? "text-neutral-yellow" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RecentStartBadge({ start }: { start: RecentStart }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg w-full",
        start.scoreless
          ? "bg-nrfi-green-subtle"
          : "bg-yrfi-red-subtle"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "font-black shrink-0 text-xs",
            start.scoreless ? "text-nrfi-green" : "text-yrfi-red"
          )}
        >
          {start.scoreless ? "✓" : "✗"}
        </span>
        <span className="text-xs text-muted-foreground/70 truncate">vs {start.opponent}</span>
      </div>
      <span
        className={cn(
          "shrink-0 tabular-nums text-xs font-semibold",
          start.scoreless ? "text-nrfi-green" : "text-yrfi-red"
        )}
      >
        {start.detail}
      </span>
    </div>
  );
}

function PitcherColumn({ pitcher }: { pitcher: Pitcher }) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Hero scoreless record */}
      <div className="text-center py-4 px-3 rounded-lg border border-border/20">
        <p className="text-[11px] text-muted-foreground/50 font-medium mb-2 truncate tracking-wide uppercase">
          {pitcher.name}
          <span className="text-muted-foreground/30 ml-1.5 normal-case">{pitcher.team}</span>
        </p>
        <p className="text-3xl font-black text-foreground tabular-nums leading-none">
          {pitcher.scorelessRecord}
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-2 tracking-wide">
          {pitcher.scorelessPct}% scoreless
        </p>
      </div>
      {/* Stat rows — clear major/minor visual weight */}
      <div className="px-1">
        <PitcherStatRow label="K%" value={pitcher.k_pct} />
        <PitcherStatRow
          label="BB%"
          value={pitcher.bb_pct}
          highlight={parseFloat(pitcher.bb_pct) > 9}
        />
        <PitcherStatRow label="WHIP" value={pitcher.whip} />
      </div>
      {/* Last 3 starts */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-semibold px-1">
          Last 3 Starts
        </span>
        {pitcher.recentStarts.map((s, i) => (
          <RecentStartBadge key={i} start={s} />
        ))}
      </div>
    </div>
  );
}

// ─── Offense helpers ────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-nrfi-green" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-yrfi-red" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function PressureBadge({ pressure }: { pressure: "Low" | "Medium" | "High" }) {
  const cls =
    pressure === "Low"
      ? "bg-nrfi-green-subtle text-nrfi-green border-nrfi-green-border"
      : pressure === "High"
      ? "bg-yrfi-red-subtle text-yrfi-red border-yrfi-red-border"
      : "bg-neutral-yellow-subtle text-neutral-yellow border-neutral-yellow-border";
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold border shrink-0", cls)}>
      {pressure}
    </span>
  );
}

function OffenseColumn({ offense }: { offense: TeamOffense }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-foreground">{offense.team}</span>
        <PressureBadge pressure={offense.pressure} />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between py-1.5 border-b border-border/40">
          <span className="text-xs text-muted-foreground/70">1st-inn score</span>
          <span className="text-xs font-bold text-foreground tabular-nums">{offense.scoringPct}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-border/40">
          <span className="text-xs text-muted-foreground/70">OPS</span>
          <span className="text-xs font-bold text-foreground tabular-nums">{offense.ops}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-border/40">
          <span className="text-xs text-muted-foreground/70 whitespace-nowrap">H/A split</span>
          <span className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
            {offense.homePct} / {offense.awayPct}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-muted-foreground/70">L30 trend</span>
          <TrendIcon trend={offense.l30Trend} />
        </div>
      </div>
    </div>
  );
}

// ─── Collapsed Card ─────────────────────────────────────────────────────────────

function CollapsedCard({ game, onExpand }: { game: GameCardType; onExpand: () => void }) {
  const leanColor = getLeanColor(game.lean);
  const badgeClass = getGradeBadgeClass(game.lean);
  const leanTextClass = getLeanTextClass(game.lean);
  const accentStyle = getLeftAccentStyle(game.lean);
  const isNrfiLean = leanColor === "green";
  const isYrfiLean = leanColor === "red";

  return (
    <button
      onClick={onExpand}
      className={cn(
        "w-full text-left group",
        "rounded-xl border border-border/70 bg-card border-l-2",
        "p-5 flex flex-col gap-4",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:border-border",
        "cursor-pointer"
      )}
      style={accentStyle}
    >
      {/* Row 1: Lean + matchup + grade */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-sm font-black tracking-tight leading-none", leanTextClass)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="text-base font-bold text-foreground tracking-tight leading-snug">
            {game.awayTeam}{" "}
            <span className="font-normal text-muted-foreground/60">@</span>{" "}
            {game.homeTeam}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground/60">{game.gameTime}</span>
          </div>
        </div>
        <span className={cn("px-3 py-1.5 rounded-lg text-2xl font-black tabular-nums leading-none shrink-0", badgeClass)}>
          {game.grade}
        </span>
      </div>

      {/* Row 2: Pitcher pairing */}
      <div className="flex items-stretch rounded-lg overflow-hidden border border-border/50 bg-secondary/50">
        <div className="flex-1 flex flex-col gap-0.5 px-3 py-2.5">
          <span className="text-[11px] text-muted-foreground/60 font-medium truncate">{game.awayPitcher.name}</span>
          <span className="text-xl font-black text-foreground tabular-nums leading-tight">{game.awayPitcher.scorelessRecord}</span>
          <span className="text-[11px] text-muted-foreground/50">scoreless</span>
        </div>
        <div className="flex flex-col items-center justify-center px-3 border-x border-border/50">
          <div className="w-px h-3 bg-border/50" />
          <span className="text-[11px] text-muted-foreground/40 font-medium py-1">vs</span>
          <div className="w-px h-3 bg-border/50" />
        </div>
        <div className="flex-1 flex flex-col gap-0.5 px-3 py-2.5 items-end text-right">
          <span className="text-[11px] text-muted-foreground/60 font-medium truncate">{game.homePitcher.name}</span>
          <span className="text-xl font-black text-foreground tabular-nums leading-tight">{game.homePitcher.scorelessRecord}</span>
          <span className="text-[11px] text-muted-foreground/50">scoreless</span>
        </div>
      </div>

      {/* Row 3: Tags */}
      <div className="flex flex-wrap gap-1.5">
        {game.reasonTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-muted-foreground border border-border/40 tracking-tight whitespace-nowrap"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Row 4: Odds + expand cue */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
              {isNrfiLean ? "Rec. NRFI" : isYrfiLean ? "Rec. YRFI" : "NRFI"}
            </span>
            <span
              className={cn(
                "text-xl font-black tabular-nums leading-none",
                isNrfiLean ? "text-nrfi-green" : isYrfiLean ? "text-yrfi-red" : "text-neutral-yellow"
              )}
            >
              {isNrfiLean || leanColor === "yellow" ? game.bestNrfiOdds : game.bestYrfiOdds}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 opacity-40">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {isNrfiLean ? "YRFI" : "NRFI"}
            </span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {isNrfiLean || leanColor === "yellow" ? game.bestYrfiOdds : game.bestNrfiOdds}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
          <span className="text-xs font-medium tracking-wide">Details</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

// ─── Expanded Card ──────────────────────────────────────────────────────────────

function ExpandedCard({ game, onCollapse }: { game: GameCardType; onCollapse: () => void }) {
  const leanColor = getLeanColor(game.lean);
  const badgeClass = getGradeBadgeClass(game.lean);
  const leanTextClass = getLeanTextClass(game.lean);
  const bgClass = getBgClass(game.lean);
  const accentStyle = getLeftAccentStyle(game.lean);
  const isNrfiLean = leanColor === "green";
  const isYrfiLean = leanColor === "red";

  return (
    <div
      className="rounded-xl border border-border/80 bg-card border-l-2 shadow-2xl shadow-black/30"
      style={accentStyle}
    >
      {/* ── Header ── */}
      <button
        onClick={onCollapse}
        className="w-full text-left px-6 pt-5 pb-4 flex items-start justify-between gap-3 cursor-pointer group"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className={cn("text-sm font-black tracking-tight leading-none", leanTextClass)}>
            {getLeanLabel(game.lean)}
          </span>
          <h3 className="text-lg font-bold text-foreground tracking-tight leading-snug">
            {game.awayTeam}{" "}
            <span className="font-normal text-muted-foreground/50">@</span>{" "}
            {game.homeTeam}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground/60">{game.gameTime}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("px-3 py-1.5 rounded-lg text-2xl font-black tabular-nums leading-none", badgeClass)}>
            {game.grade}
          </span>
          <div className="flex items-center gap-1 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
            <span className="text-xs font-medium">Collapse</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </div>
        </div>
      </button>

      {/* ── Grade rationale strip — full width, 4-meter row ── */}
      <div className={cn("mx-6 mb-5 rounded-xl border", bgClass)}>
        <div className="px-5 py-3 grid grid-cols-[1fr_auto] gap-6 items-center">
          <p className="text-sm text-foreground/85 leading-relaxed">{game.gradeExplanation}</p>
          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <ScoreMeter label="Pitching" value={game.componentScores.pitching} lean={game.lean} />
            <ScoreMeter label="Offense" value={game.componentScores.offense} lean={game.lean} />
            <ScoreMeter label="Environment" value={game.componentScores.environment} lean={game.lean} />
            <ScoreMeter label="Price" value={game.componentScores.price} lean={game.lean} />
          </div>
        </div>
      </div>

      {/* ── Main 3-column body ── */}
      <div className="px-6 pb-6 grid grid-cols-3 gap-5">

        {/* ── COL 1: Starting Pitchers ── */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
            Starting Pitchers
          </h4>
          <div className="rounded-xl bg-secondary border border-border/60 overflow-hidden h-full">
            <div className="grid grid-cols-2 divide-x divide-border/50 h-full">
              <div className="p-5">
                <PitcherColumn pitcher={game.awayPitcher} />
              </div>
              <div className="p-5">
                <PitcherColumn pitcher={game.homePitcher} />
              </div>
            </div>
          </div>
        </div>

        {/* ── COL 2: 1st-Inning Offense + Conditions ── */}
        <div className="flex flex-col gap-3">

          <div className="flex flex-col gap-2">
            <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              1st-Inning Offense
            </h4>
            <div className="grid grid-cols-2 divide-x divide-border/50 rounded-xl bg-secondary border border-border/60 overflow-hidden">
              <div className="p-5 pb-6">
                <OffenseColumn offense={game.awayOffense} />
              </div>
              <div className="p-5 pb-6">
                <OffenseColumn offense={game.homeOffense} />
              </div>
            </div>
          </div>

          {/* Conditions — hard max: park · weather (optional) · lineup only. Never add more. */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Conditions
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-muted-foreground border border-border/50 whitespace-nowrap">
                {game.parkFactor}
              </span>
              {game.weatherFlag && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-yellow-subtle text-neutral-yellow border border-neutral-yellow-border whitespace-nowrap">
                  {game.weatherFlag}
                </span>
              )}
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
                  game.lineupStatus === "Confirmed"
                    ? "bg-nrfi-green-subtle text-nrfi-green border-nrfi-green-border"
                    : "bg-secondary text-muted-foreground/60 border-border/40"
                )}
              >
                {game.lineupStatus} lineups
              </span>
            </div>
          </div>

        </div>

        {/* ── COL 3: Best Available Odds ── */}
        <div className="flex flex-col gap-3">
          <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
            Best Available Odds
          </h4>
          <div className="rounded-xl bg-secondary border border-border/60 overflow-hidden h-full flex flex-col">

            {/* Rec / Alt hero */}
            <div className="grid grid-cols-2 divide-x divide-border/50 border-b border-border/60">
              <div
                className={cn(
                  "px-5 py-4 flex flex-col gap-1",
                  isNrfiLean
                    ? "bg-nrfi-green-subtle"
                    : isYrfiLean
                    ? "bg-yrfi-red-subtle"
                    : "bg-neutral-yellow-subtle"
                )}
              >
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  Recommended
                </span>
                <span
                  className={cn(
                    "text-xs font-bold mt-0.5",
                    isNrfiLean ? "text-nrfi-green" : isYrfiLean ? "text-yrfi-red" : "text-neutral-yellow"
                  )}
                >
                  {isNrfiLean ? "NRFI" : isYrfiLean ? "YRFI" : "NRFI"}
                </span>
                <span
                  className={cn(
                    "text-3xl font-black tabular-nums leading-none mt-0.5",
                    isNrfiLean ? "text-nrfi-green" : isYrfiLean ? "text-yrfi-red" : "text-neutral-yellow"
                  )}
                >
                  {isNrfiLean ? game.bestNrfiOdds : game.bestYrfiOdds}
                </span>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1 opacity-40">
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  Alt side
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {isNrfiLean ? "YRFI" : "NRFI"}
                </span>
                <span className="text-3xl font-black tabular-nums leading-none mt-0.5 text-muted-foreground">
                  {isNrfiLean ? game.bestYrfiOdds : game.bestNrfiOdds}
                </span>
              </div>
            </div>

            {/* Sportsbook rows */}
            <div className="flex flex-col px-2 pt-3 pb-2 flex-1 border-t border-border/40">
              {/* Column header */}
              <div className="flex items-center px-3 pb-2 mb-1 border-b border-border/30">
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-semibold flex-1">Book</span>
                <span className="text-[10px] text-nrfi-green/50 uppercase tracking-widest font-semibold w-16 text-right">NRFI</span>
                <span className="text-[10px] text-yrfi-red/50 uppercase tracking-widest font-semibold w-16 text-right">YRFI</span>
                <span className="w-16" />
              </div>
              {game.sportsbooks.map((book) => (
                <div
                  key={book.name}
                  className="flex items-center py-2.5 px-3 rounded-lg hover:bg-card/60 transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground flex-1 min-w-0 truncate">
                    {book.name}
                  </span>
                  <span className="text-sm font-bold text-nrfi-green tabular-nums w-16 text-right shrink-0">
                    {book.nrfiOdds}
                  </span>
                  <span className="text-sm font-bold text-yrfi-red tabular-nums w-16 text-right shrink-0">
                    {book.yrfiOdds}
                  </span>
                  <div className="w-16 flex justify-end shrink-0">
                    <a
                      href={book.link}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-foreground text-background hover:opacity-80 transition-opacity"
                    >
                      Bet <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────

export function GameCard({
  game,
  isExpanded,
  onExpand,
  onCollapse,
  className,
}: {
  game: GameCardType;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {isExpanded ? (
        <ExpandedCard game={game} onCollapse={onCollapse} />
      ) : (
        <CollapsedCard game={game} onExpand={onExpand} />
      )}
    </div>
  );
}

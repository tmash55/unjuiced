"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { LineStepper } from "./line-stepper";

interface DrilldownHeaderProps {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  /** Currently active line (default if no custom adjustment, otherwise the custom value). */
  effectiveLine: number;
  onLineChange: (value: number) => void;
  onLineReset: () => void;
  backHref: string;
}

// Drilldown header — slim single-row card. Identity → Market & Line → Matchup
// → Best Odds, separated by subtle gradient dividers. Sticky on scroll so the
// market switcher and odds stay accessible while scrolling deeper sections.
export function DrilldownHeader({
  profile,
  sport,
  effectiveLine,
  onLineChange,
  onLineReset,
  backHref,
}: DrilldownHeaderProps) {
  const positionLabel = formatPosition(profile.position);
  const opponent = profile.opponentTeamAbbr ?? profile.opponentTeamName ?? "OPP";
  const isHome = profile.homeAway === "H";
  const gameTime = formatGameTime(profile.gameStatus, profile.gameDate);
  const hasInjury =
    profile.injuryStatus &&
    profile.injuryStatus.toLowerCase() !== "active" &&
    profile.injuryStatus.toLowerCase() !== "available";

  // Best Over: use the existing bestOdds field (selKey encodes the side; for
  // hit-rate rows it's "over"). Under fills in once we wire the per-row
  // /odds-line fetch in the next pass.
  const overPrice = profile.bestOdds?.price ?? null;
  const overBook = profile.bestOdds?.book ?? null;

  return (
    <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-neutral-200/60 bg-white/90 backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-950/90">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-3">
        {/* Slim card with inline back button */}
        <div className="rounded-xl border border-neutral-200/70 bg-white/80 px-3 py-3 shadow-sm ring-1 ring-black/[0.03] dark:border-neutral-800/70 dark:bg-neutral-900/60 dark:ring-white/[0.03]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            {/* Identity + Matchup — grouped together so "who + what game" reads as one unit */}
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <Tooltip content="Back to Hit Rates" side="bottom">
                <Link
                  href={backHref}
                  aria-label="Back to Hit Rates"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-neutral-500 transition-colors hover:border-brand/40 hover:text-brand dark:border-neutral-800/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-brand"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Tooltip>
              <PlayerAvatar profile={profile} sport={sport} />

              {/* Identity meta column */}
              <div className="min-w-0 shrink">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-base font-black tracking-tight text-neutral-900 dark:text-white lg:text-lg">
                    {profile.playerName}
                  </h1>
                  {hasInjury && (
                    <Tooltip
                      content={`${profile.injuryStatus!.charAt(0).toUpperCase() + profile.injuryStatus!.slice(1)}${profile.injuryNotes ? ` — ${profile.injuryNotes}` : ""}`}
                      side="top"
                    >
                      <HeartPulse className={cn("h-3.5 w-3.5 shrink-0 cursor-help", getInjuryIconColor(profile.injuryStatus))} />
                    </Tooltip>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {profile.teamAbbr && (
                    <img
                      src={getTeamLogoUrl(profile.teamAbbr, sport)}
                      alt={profile.teamAbbr}
                      className="h-3.5 w-3.5 shrink-0 object-contain"
                    />
                  )}
                  {profile.teamAbbr && (
                    <span className="font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                      {profile.teamAbbr}
                    </span>
                  )}
                  {positionLabel && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-600">·</span>
                      <span>{positionLabel}</span>
                    </>
                  )}
                  {profile.jerseyNumber !== null && profile.jerseyNumber !== undefined && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-600">·</span>
                      <span className="tabular-nums">#{profile.jerseyNumber}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Subtle inline divider before matchup */}
              <div className="hidden md:block self-center">
                <div className="h-8 w-px bg-gradient-to-b from-transparent via-neutral-200 to-transparent dark:via-neutral-800" />
              </div>

              {/* Matchup — same identity row, lives next to the player meta */}
              <div className="hidden md:block min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                    {isHome ? "vs" : "@"}
                  </span>
                  {profile.opponentTeamAbbr && (
                    <img
                      src={getTeamLogoUrl(profile.opponentTeamAbbr, sport)}
                      alt={opponent}
                      className="h-5 w-5 shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                    />
                  )}
                  <span className="text-sm font-black tabular-nums text-neutral-900 dark:text-white">
                    {opponent}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] tabular-nums text-neutral-500 dark:text-neutral-400">
                    {gameTime}
                  </span>
                </div>
                {(profile.spread !== null || profile.total !== null) && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold tabular-nums leading-tight text-neutral-500 dark:text-neutral-400">
                    {profile.spread !== null && (
                      <span className="text-neutral-700 dark:text-neutral-200">
                        {profile.spread > 0 ? "+" : ""}
                        {profile.spread}
                      </span>
                    )}
                    {profile.spread !== null && profile.total !== null && (
                      <span className="text-neutral-300 dark:text-neutral-700">·</span>
                    )}
                    {profile.total !== null && (
                      <span>
                        O/U <span className="text-neutral-700 dark:text-neutral-200">{formatTotal(profile.total)}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Divider />

            {/* Line stepper — primary line-adjustment affordance. Market is
                switched via the scroller below the header. */}
            <LineStepper
              value={effectiveLine}
              defaultValue={profile.line ?? effectiveLine}
              onChange={onLineChange}
              onReset={onLineReset}
            />

            <Divider />

            {/* Odds — Over / Under stacked, mini layout */}
            <div className="flex flex-col gap-1">
              <OddsRow side="O" price={overPrice} book={overBook} />
              {/* Under fills in once we wire per-row /odds-line in the next pass */}
              <OddsRow side="U" price={null} book={null} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PlayerAvatar({ profile, sport }: { profile: HitRateProfile; sport: "nba" | "wnba" }) {
  return (
    <div
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-800/60 dark:ring-neutral-800/80"
      style={
        profile.primaryColor
          ? { boxShadow: `inset 0 -2px 0 ${profile.primaryColor}88` }
          : undefined
      }
    >
      <PlayerHeadshot
        sport={sport}
        nbaPlayerId={profile.nbaPlayerId ?? profile.playerId}
        mlbPlayerId={profile.playerId}
        name={profile.playerName}
        size="small"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function Divider() {
  return (
    <div className="hidden self-stretch lg:block">
      <div className="mx-1 h-full w-px bg-gradient-to-b from-transparent via-neutral-200 to-transparent dark:via-neutral-800" />
    </div>
  );
}

function OddsRow({
  side,
  price,
  book,
}: {
  side: "O" | "U";
  price: number | null;
  book: string | null;
}) {
  if (price === null) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {side}
        </span>
        <span className="text-xs font-black tabular-nums text-neutral-400 dark:text-neutral-500">
          —
        </span>
      </div>
    );
  }
  const sb = book ? getSportsbookById(book) : null;
  const logo = sb?.image?.light ?? null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {side}
      </span>
      {logo && (
        <img
          src={logo}
          alt={sb?.name ?? book ?? ""}
          className="h-3.5 w-3.5 shrink-0 object-contain"
        />
      )}
      <span
        className={cn(
          "text-xs font-black tabular-nums",
          price > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-200"
        )}
      >
        {formatPrice(price)}
      </span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}

function formatTotal(total: number) {
  return Number.isInteger(total) ? `${total}` : total.toFixed(1);
}

function formatGameTime(gameStatus: string | null, gameDate: string | null) {
  if (!gameStatus) return "TBD";
  if (gameStatus.toLowerCase().includes("final")) return gameStatus;
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch || !gameDate) return gameStatus.replace(/\s*ET$/i, "").trim();
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  const etDate = new Date(`${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`);
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPosition(position: string | null) {
  if (!position) return null;
  const p = position.toUpperCase();
  if (p.includes("-")) return p.split("-").map((s) => s.trim()).join("/");
  return p;
}

function getInjuryIconColor(status: string | null): string {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision") return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500";
}

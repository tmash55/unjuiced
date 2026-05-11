"use client";

import React from "react";
import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import {
  InjuryReportTooltipContent,
  hasReportableInjury,
} from "@/components/hit-rates/injury-report-tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import type { LineOdds } from "@/hooks/use-hit-rate-odds";
import { LineStepper } from "./line-stepper";

interface DrilldownHeaderProps {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  /** Currently active line (default if no custom adjustment, otherwise the custom value). */
  effectiveLine: number;
  onLineChange: (value: number) => void;
  onLineReset: () => void;
  odds: LineOdds | null;
  /** Tighter sizing for embedded contexts (quick-view modal). Shrinks the
   *  matchup ticker minimum width, drops the line stepper to the default
   *  size, and tightens the best-price text so the whole strip fits in a
   *  modal without horizontal overflow. */
  compact?: boolean;
}

// Drilldown header — flat command-bar strip (no inner card). Reads left → right
// as Identity → Matchup → Hero Line → Best Odds, mirroring how a bettor scans:
// who, where, what target, where to take it. The back arrow lives in the
// PlayerSwitcherStrip above this row, so this header focuses purely on
// "who am I researching, against whom, at what line, for what odds."
export function DrilldownHeader({
  profile,
  sport,
  effectiveLine,
  onLineChange,
  onLineReset,
  odds,
  compact = false,
}: DrilldownHeaderProps) {
  const positionLabel = formatPosition(profile.position);
  const opponent =
    profile.opponentTeamAbbr ?? profile.opponentTeamName ?? "OPP";
  // homeAway ships in different casings depending on the source ("H"/"A",
  // "home"/"away", sometimes 1/0). Normalize before comparing so the header
  // doesn't end up flipped against the venue chip.
  const homeAwayNormalized = (profile.homeAway ?? "")
    .toString()
    .trim()
    .toLowerCase();
  const isHome =
    homeAwayNormalized === "h" ||
    homeAwayNormalized === "home" ||
    homeAwayNormalized === "1" ||
    homeAwayNormalized === "true";
  const gameTime = formatGameTime(profile.gameStatus, profile.gameDate);
  const hasInjury = hasReportableInjury(profile.injuryStatus);

  const activeLineOdds = getLineOddsForActiveLine(odds, effectiveLine);
  const isDefaultLine =
    profile.line !== null && Math.abs(profile.line - effectiveLine) < 0.001;
  const bestOver =
    activeLineOdds?.bestOver ??
    (isDefaultLine ? (odds?.bestOver ?? profile.bestOdds) : null);
  const bestUnder =
    activeLineOdds?.bestUnder ?? (isDefaultLine ? odds?.bestUnder : null);

  const marketLabel = profile.market
    ? formatMarketLabelShort(profile.market)
    : undefined;
  const homeAbbr = isHome ? profile.teamAbbr : profile.opponentTeamAbbr;
  const awayAbbr = isHome ? profile.opponentTeamAbbr : profile.teamAbbr;

  // Per-team spread breakdown — favored side gets the filled pill, dog gets
  // the subdued one. Books invert the sign for the opposing team, so we
  // negate profile.spread (which is always relative to the player's team).
  const playerSpread = profile.spread;
  const opponentSpread = playerSpread !== null ? -playerSpread : null;
  const awaySpread = isHome ? opponentSpread : playerSpread;
  const homeSpread = isHome ? playerSpread : opponentSpread;

  return (
    <div className={cn(
      "flex flex-col lg:flex-row lg:items-center",
      compact ? "gap-1.5 lg:gap-3" : "gap-3 lg:gap-5",
    )}>
      {/* LEFT — identity. flex-1 so the matchup sits visually centered between
          the left and right groups when they share the leftover space evenly. */}
      <div className="flex min-w-0 items-center gap-3 lg:flex-1">
        <PlayerAvatar profile={profile} sport={sport} />
        <div className="min-w-0 shrink">
          <div className="flex items-center gap-1.5">
            <h1 className={cn(
              "truncate font-black tracking-tight text-neutral-900 dark:text-white",
              compact ? "text-sm lg:text-base" : "text-base lg:text-lg",
            )}>
              {profile.playerName}
            </h1>
            {hasInjury && (
              <Tooltip
                content={
                  <InjuryReportTooltipContent
                    playerName={profile.playerName}
                    status={profile.injuryStatus}
                    notes={profile.injuryNotes}
                    updatedAt={profile.injuryUpdatedAt}
                    returnDate={profile.injuryReturnDate}
                    source={profile.injurySource}
                    rawStatus={profile.injuryRawStatus}
                  />
                }
                side="top"
                contentClassName="p-0"
              >
                <HeartPulse
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 cursor-help",
                    getInjuryIconColor(profile.injuryStatus),
                  )}
                />
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
              <span className="font-bold tracking-wide text-neutral-700 uppercase dark:text-neutral-300">
                {profile.teamAbbr}
              </span>
            )}
            {positionLabel && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">
                  ·
                </span>
                <span>{positionLabel}</span>
              </>
            )}
            {profile.jerseyNumber !== null &&
              profile.jerseyNumber !== undefined && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600">
                    ·
                  </span>
                  <span className="tabular-nums">#{profile.jerseyNumber}</span>
                </>
              )}
          </div>
        </div>
      </div>

      {/* CENTER — matchup. AWAY @ HOME with inline spread pills (filled for
          favorite, subdued for dog) and a hairline-separated tip-off. Reads
          like a sportsbook ticker: instant team + price context, no mental
          inversion required. */}
      {compact ? (
        // Compact: 2-row matchup card. Away team on top, home on bottom.
        // The favorite (negative spread) carries the spread badge; the dog
        // shows the game total instead. That avoids duplicating the spread
        // (one team's +X is the other's -X) and surfaces the two unique
        // numbers — spread + total — without an extra info row.
        <div className="flex min-w-0 flex-col gap-0.5 lg:flex-shrink-0">
          <MatchupRow
            abbr={awayAbbr}
            sport={sport}
            spread={awaySpread}
            total={profile.total}
            isFavorite={awaySpread !== null && awaySpread < 0}
            tipOff={null}
          />
          <MatchupRow
            abbr={homeAbbr ?? opponent}
            sport={sport}
            spread={homeSpread}
            total={profile.total}
            isFavorite={homeSpread !== null && homeSpread < 0}
            tipOff={gameTime}
          />
        </div>
      ) : (
        // Full drilldown: 2-row matchup with the tip-off centered vertically
        // between the rows on the right. No border / bg — reads as inline
        // ESPN-style content, not a contained card.
        <div className="hidden items-center gap-3 md:flex lg:flex-shrink-0">
          <div className="flex flex-col gap-1">
            <MatchupRow
              abbr={awayAbbr}
              sport={sport}
              spread={awaySpread}
              total={profile.total}
              isFavorite={awaySpread !== null && awaySpread < 0}
              tipOff={null}
            />
            <MatchupRow
              abbr={homeAbbr ?? opponent}
              sport={sport}
              spread={homeSpread}
              total={profile.total}
              isFavorite={homeSpread !== null && homeSpread < 0}
              tipOff={null}
            />
          </div>
          <span className="text-[11px] font-black tabular-nums text-neutral-500 dark:text-neutral-400">
            {gameTime}
          </span>
        </div>
      )}

      {/* RIGHT — line + odds, grouped together. Mirrors the left group's
          flex-1 so the matchup centers between them, and keeps the actionable
          bet info (the line you're researching + where to take it) co-located.
          In compact mode (modal) the right group hides on mobile because the
          modal renders a slimmer line + odds row inline with the market
          dropdown above the chart. */}
      <div className={cn(
        "flex items-center lg:flex-1 lg:justify-end",
        compact ? "hidden gap-3 sm:flex" : "gap-5",
      )}>
        <div className="lg:flex-shrink-0">
          <LineStepper
            value={effectiveLine}
            defaultValue={profile.line ?? effectiveLine}
            onChange={onLineChange}
            onReset={onLineReset}
            size={compact ? "default" : "hero"}
            marketLabel={marketLabel}
          />
        </div>

        <div className={cn(
          "flex flex-col gap-0.5 lg:flex-shrink-0 lg:border-l lg:border-neutral-200/60 lg:dark:border-neutral-800/60",
          compact ? "lg:pl-3" : "lg:pl-5",
        )}>
          <span className="mb-0.5 text-[9.5px] font-bold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
            Best Price
          </span>
          <OddsRow
            side="O"
            price={bestOver?.price ?? null}
            book={bestOver?.book ?? null}
            compact={compact}
          />
          <OddsRow
            side="U"
            price={bestUnder?.price ?? null}
            book={bestUnder?.book ?? null}
            compact={compact}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PlayerAvatar({
  profile,
  sport,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
}) {
  return (
    <div
      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-100 shadow-sm ring-1 ring-neutral-200/70 dark:bg-neutral-800/60 dark:ring-neutral-800/80"
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

function OddsRow({
  side,
  price,
  book,
  compact = false,
}: {
  side: "O" | "U";
  price: number | null;
  book: string | null;
  compact?: boolean;
}) {
  const label = side === "O" ? "Over" : "Under";
  const priceClass = compact
    ? "min-w-[3.5ch] text-[13px] font-black tracking-tight tabular-nums"
    : "min-w-[3.5ch] text-[15px] font-black tracking-tight tabular-nums";
  // UNDER is 5 chars + tracking; needs ~36px to avoid bleeding into the price
  // column. OVER is shorter but using the same width keeps the prices aligned.
  const labelWidth = compact ? "w-9" : "w-9";
  const rowGap = compact ? "gap-1.5" : "gap-2";
  if (price === null) {
    return (
      <div className={cn("flex items-center", rowGap)}>
        <span className={cn(labelWidth, "text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase dark:text-neutral-600")}>
          {label}
        </span>
        <span className={cn(priceClass, "text-neutral-300 dark:text-neutral-700")}>
          —
        </span>
      </div>
    );
  }
  const sb = book ? getSportsbookById(book) : null;
  const logo = sb?.image?.light ?? null;
  return (
    <div className={cn("flex items-center", rowGap)}>
      <span className={cn(labelWidth, "text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase dark:text-neutral-400")}>
        {label}
      </span>
      <span
        className={cn(
          priceClass,
          price > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-neutral-900 dark:text-white",
        )}
      >
        {formatPrice(price)}
      </span>
      {logo && (
        <img
          src={logo}
          alt={sb?.name ?? book ?? ""}
          className="h-3.5 w-3.5 shrink-0 object-contain opacity-90"
        />
      )}
    </div>
  );
}

// TeamGlyph — logo + abbreviation + inline spread pill. Favored team gets the
// filled high-contrast pill; underdog gets a subdued one. Both pills always
// render so the eye doesn't have to invert the spread.
// Per-team row used by the compact 2-row matchup ticker. Favorite gets the
// spread; dog gets the game total in the same slot so the user reads the
// two unique price points (spread + total) without redundancy.
function MatchupRow({
  abbr,
  sport,
  spread,
  total,
  isFavorite,
  tipOff,
}: {
  abbr: string | null | undefined;
  sport: "nba" | "wnba";
  spread: number | null;
  total: number | null;
  isFavorite: boolean;
  tipOff: string | null;
}) {
  if (!abbr) return null;
  return (
    <div className="flex items-center gap-1.5">
      <img
        src={getTeamLogoUrl(abbr, sport)}
        alt={abbr}
        className="h-3.5 w-3.5 shrink-0 object-contain"
      />
      <span className="text-[13px] font-black tracking-tight text-neutral-900 tabular-nums dark:text-white">
        {abbr}
      </span>
      {isFavorite && spread !== null ? (
        <span className="ml-0.5 inline-flex items-center rounded bg-neutral-900 px-1 py-px text-[9px] font-black tracking-tight tabular-nums text-white dark:bg-white dark:text-neutral-950">
          {formatSpread(spread)}
        </span>
      ) : total !== null ? (
        <span className="ml-0.5 inline-flex items-baseline gap-0.5 rounded bg-neutral-100 px-1 py-px text-[9px] font-black tabular-nums text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400">
          <span className="opacity-60">O/U</span>
          <span>{formatTotal(total)}</span>
        </span>
      ) : null}
      {tipOff && (
        <span className="ml-1 text-[10px] font-bold tabular-nums text-neutral-500 dark:text-neutral-400">
          {tipOff}
        </span>
      )}
    </div>
  );
}

function TeamGlyph({
  abbr,
  sport,
  spread,
  compact,
}: {
  abbr: string | null | undefined;
  sport: "nba" | "wnba";
  spread: number | null;
  compact?: boolean;
}) {
  if (!abbr) return null;
  const isFavored = spread !== null && spread < 0;
  const isPickEm = spread === 0;
  return (
    <div className="flex items-center gap-1">
      <img
        src={getTeamLogoUrl(abbr, sport)}
        alt={abbr}
        className={cn("shrink-0 object-contain", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
      />
      <span className={cn(
        "font-black tracking-tight text-neutral-900 tabular-nums dark:text-white",
        compact ? "text-[13px]" : "text-[15px]",
      )}>
        {abbr}
      </span>
      {spread !== null && !isPickEm && (
        <span
          className={cn(
            "ml-0.5 inline-flex items-center rounded font-black tracking-tight tabular-nums",
            compact ? "px-1 py-px text-[9px]" : "px-1.5 py-px text-[10px]",
            isFavored
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400",
          )}
        >
          {formatSpread(spread)}
        </span>
      )}
    </div>
  );
}

function LineBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9.5px] font-bold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
        {label}
      </span>
      <span className="text-[11px] font-black tracking-tight text-neutral-800 tabular-nums dark:text-neutral-100">
        {value}
      </span>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLineOddsForActiveLine(odds: LineOdds | null, activeLine: number) {
  if (!odds?.allLines?.length) return null;
  return (
    odds.allLines.find((line) => Math.abs(line.line - activeLine) < 0.001) ??
    null
  );
}

function formatPrice(price: number) {
  return price > 0 ? `+${price}` : `${price}`;
}

function formatTotal(total: number) {
  return Number.isInteger(total) ? `${total}` : total.toFixed(1);
}

function formatSpread(spread: number) {
  const value = Number.isInteger(spread) ? `${spread}` : spread.toFixed(1);
  return spread > 0 ? `+${value}` : value;
}

function formatGameSpread(spread: number | null) {
  return spread === null ? "—" : formatSpread(spread);
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
  const etDate = new Date(
    `${gameDate}T${hour.toString().padStart(2, "0")}:${minutes}:00-05:00`,
  );
  return etDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPosition(position: string | null) {
  if (!position) return null;
  const p = position.toUpperCase();
  if (p.includes("-"))
    return p
      .split("-")
      .map((s) => s.trim())
      .join("/");
  return p;
}

function getInjuryIconColor(status: string | null): string {
  if (!status) return "text-amber-500";
  const s = status.toLowerCase();
  if (s === "out") return "text-red-500";
  if (s === "questionable" || s === "gtd" || s === "game time decision")
    return "text-amber-500";
  if (s === "probable") return "text-emerald-500";
  return "text-amber-500";
}

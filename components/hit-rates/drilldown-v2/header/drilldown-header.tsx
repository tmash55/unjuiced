"use client";

import React from "react";
import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerHeadshot } from "@/components/player-headshot";
import { Tooltip } from "@/components/tooltip";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { useHitRateOdds, type LineOdds } from "@/hooks/use-hit-rate-odds";
import { LineStepper } from "./line-stepper";

interface DrilldownHeaderProps {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  /** Currently active line (default if no custom adjustment, otherwise the custom value). */
  effectiveLine: number;
  onLineChange: (value: number) => void;
  onLineReset: () => void;
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
  const hasInjury =
    profile.injuryStatus &&
    profile.injuryStatus.toLowerCase() !== "active" &&
    profile.injuryStatus.toLowerCase() !== "available";

  const { getOdds } = useHitRateOdds({
    rows: [{ oddsSelectionId: profile.oddsSelectionId, line: profile.line }],
    sport,
    enabled: !!profile.oddsSelectionId,
  });
  const odds = getOdds(profile.oddsSelectionId);
  const activeLineOdds = getLineOddsForActiveLine(odds, effectiveLine);
  const isDefaultLine =
    profile.line !== null && Math.abs(profile.line - effectiveLine) < 0.001;
  const bestOver =
    activeLineOdds?.bestOver ??
    odds?.bestOver ??
    (isDefaultLine ? profile.bestOdds : null);
  const bestUnder = activeLineOdds?.bestUnder ?? odds?.bestUnder ?? null;

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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      {/* LEFT — identity. flex-1 so the matchup sits visually centered between
          the left and right groups when they share the leftover space evenly. */}
      <div className="flex min-w-0 items-center gap-3 lg:flex-1">
        <PlayerAvatar profile={profile} sport={sport} />
        <div className="min-w-0 shrink">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-base font-black tracking-tight text-neutral-900 lg:text-lg dark:text-white">
              {profile.playerName}
            </h1>
            {hasInjury && (
              <Tooltip
                content={`${profile.injuryStatus!.charAt(0).toUpperCase() + profile.injuryStatus!.slice(1)}${profile.injuryNotes ? ` — ${profile.injuryNotes}` : ""}`}
                side="top"
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
      <div className="hidden min-w-[330px] rounded-xl border border-neutral-200/70 bg-neutral-50/70 px-3 py-2 shadow-sm md:flex md:flex-col md:gap-1.5 lg:flex-shrink-0 dark:border-neutral-800/70 dark:bg-neutral-950/35">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <TeamGlyph abbr={awayAbbr} sport={sport} spread={awaySpread} />
            <span className="text-[10px] font-bold tracking-[0.18em] text-neutral-300 uppercase dark:text-neutral-600">
              @
            </span>
            <TeamGlyph
              abbr={homeAbbr ?? opponent}
              sport={sport}
              spread={homeSpread}
            />
          </div>
          <span className="shrink-0 rounded-md bg-white/70 px-2 py-1 text-[11px] font-black text-neutral-700 tabular-nums ring-1 ring-neutral-200/70 dark:bg-neutral-900/70 dark:text-neutral-200 dark:ring-neutral-800/70">
            {gameTime}
          </span>
        </div>
        <div className="flex items-center gap-2 pl-0.5">
          <LineBadge label="Spread" value={formatGameSpread(playerSpread)} />
          {profile.total !== null && (
            <LineBadge label="Total" value={formatTotal(profile.total)} />
          )}
        </div>
      </div>

      {/* RIGHT — line + odds, grouped together. Mirrors the left group's
          flex-1 so the matchup centers between them, and keeps the actionable
          bet info (the line you're researching + where to take it) co-located. */}
      <div className="flex items-center gap-5 lg:flex-1 lg:justify-end">
        <div className="lg:flex-shrink-0">
          <LineStepper
            value={effectiveLine}
            defaultValue={profile.line ?? effectiveLine}
            onChange={onLineChange}
            onReset={onLineReset}
            size="hero"
            marketLabel={marketLabel}
          />
        </div>

        <div className="flex flex-col gap-0.5 lg:flex-shrink-0 lg:border-l lg:border-neutral-200/60 lg:pl-5 lg:dark:border-neutral-800/60">
          <span className="mb-0.5 text-[9.5px] font-bold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
            Best Price
          </span>
          <OddsRow
            side="O"
            price={bestOver?.price ?? null}
            book={bestOver?.book ?? null}
          />
          <OddsRow
            side="U"
            price={bestUnder?.price ?? null}
            book={bestUnder?.book ?? null}
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
}: {
  side: "O" | "U";
  price: number | null;
  book: string | null;
}) {
  const label = side === "O" ? "Over" : "Under";
  if (price === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-9 text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase dark:text-neutral-600">
          {label}
        </span>
        <span className="min-w-[3.5ch] text-[15px] font-black tracking-tight text-neutral-300 tabular-nums dark:text-neutral-700">
          —
        </span>
      </div>
    );
  }
  const sb = book ? getSportsbookById(book) : null;
  const logo = sb?.image?.light ?? null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-bold tracking-[0.1em] text-neutral-500 uppercase dark:text-neutral-400">
        {label}
      </span>
      <span
        className={cn(
          "min-w-[3.5ch] text-[15px] font-black tracking-tight tabular-nums",
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
function TeamGlyph({
  abbr,
  sport,
  spread,
}: {
  abbr: string | null | undefined;
  sport: "nba" | "wnba";
  spread: number | null;
}) {
  if (!abbr) return null;
  const isFavored = spread !== null && spread < 0;
  const isPickEm = spread === 0;
  return (
    <div className="flex items-center gap-1">
      <img
        src={getTeamLogoUrl(abbr, sport)}
        alt={abbr}
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="text-[15px] font-black tracking-tight text-neutral-900 tabular-nums dark:text-white">
        {abbr}
      </span>
      {spread !== null && !isPickEm && (
        <span
          className={cn(
            "ml-0.5 inline-flex items-center rounded px-1.5 py-px text-[10px] font-black tracking-tight tabular-nums",
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

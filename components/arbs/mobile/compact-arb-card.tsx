"use client";

import React, { useMemo } from "react";
import {
  Calculator,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById, getSportsbookLogo } from "@/lib/data/sportsbooks";
import type { ArbRow } from "@/lib/arb-schema";
import { SportIcon } from "@/components/icons/sport-icons";
import { useStateLink } from "@/hooks/use-state-link";
import { ArbRiskIndicator } from "@/components/arbs/arb-risk-indicator";

const logo = (id?: string) => getSportsbookLogo(id);

const getBookUrl = (
  bk?: string,
  directUrl?: string,
  mobileUrl?: string | null,
): string | undefined => {
  if (mobileUrl) return mobileUrl;
  if (directUrl) return directUrl;
  if (!bk) return undefined;
  const sb = getSportsbookById(bk);
  if (!sb) return undefined;
  const base =
    sb.affiliate && sb.affiliateLink
      ? sb.affiliateLink
      : sb.links.desktop || undefined;
  if (!base) return undefined;
  if (sb.requiresState && base.includes("{state}"))
    return base.replace(/\{state\}/g, "nj");
  return base;
};

const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

const isSpread = (mkt?: string) =>
  /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(
    String(mkt || ""),
  );
const isMoneyline = (mkt?: string) =>
  /moneyline|\bml\b/i.test(String(mkt || ""));

const extractPlayer = (name?: string) => {
  if (!name) return "";
  return name.replace(/\s+(Over|Under).*$/i, "").trim();
};

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

const humanizeMarket = (mkt?: string) => {
  const s = String(mkt || "")
    .replace(/_/g, " ")
    .replace(/\bplayer\b\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return titleCase(s);
};

// Calculate equal-profit bet sizes
const calculateBetSizes = (
  overOdds: number,
  underOdds: number,
  total: number,
) => {
  const overDec =
    overOdds > 0 ? 1 + overOdds / 100 : 1 + 100 / Math.abs(overOdds);
  const underDec =
    underOdds > 0 ? 1 + underOdds / 100 : 1 + 100 / Math.abs(underOdds);
  const overStake = (total * underDec) / (overDec + underDec);
  const underStake = total - overStake;
  return { over: overStake, under: underStake };
};

// Calculate payout from American odds
const calculatePayout = (odds: number, stake: number): number => {
  if (!stake || !odds) return 0;
  if (odds > 0) return stake * (1 + odds / 100);
  return stake * (1 + 100 / Math.abs(odds));
};

/** Round a number to the nearest multiple of `step`. 0 = no rounding. */
function roundStake(n: number, step: number): number {
  if (step <= 0) return Math.round(n * 100) / 100;
  return Math.round(n / step) * step;
}

interface CompactArbCardProps {
  row: ArbRow;
  totalBetAmount: number;
  roundTo?: number;
  isNew?: boolean;
  hasChange?: boolean;
  onOpenCalculator?: () => void;
  onShowWarning?: () => void;
}

export function CompactArbCard({
  row,
  totalBetAmount,
  roundTo = 0,
  isNew,
  hasChange,
  onOpenCalculator,
  onShowWarning,
}: CompactArbCardProps) {
  const applyState = useStateLink();
  const roiPct = (row.roi_bps ?? 0) / 100;
  const isHighROI = roiPct > 10;
  const overOdds = Number(row.o?.od || 0);
  const underOdds = Number(row.u?.od || 0);

  const stakes = useMemo(() => {
    const raw = calculateBetSizes(overOdds, underOdds, totalBetAmount);
    return {
      over: roundStake(raw.over, roundTo),
      under: roundStake(raw.under, roundTo),
    };
  }, [overOdds, underOdds, totalBetAmount, roundTo]);
  const { profitMin, profitMax, hasRange } = useMemo(() => {
    const overPayout = calculatePayout(overOdds, stakes.over);
    const underPayout = calculatePayout(underOdds, stakes.under);
    const total = stakes.over + stakes.under;
    const pO = overPayout - total;
    const pU = underPayout - total;
    const min = Math.min(pO, pU);
    const max = Math.max(pO, pU);
    return {
      profitMin: min,
      profitMax: max,
      hasRange: roundTo > 0 && Math.abs(max - min) >= 0.01,
    };
  }, [overOdds, underOdds, stakes, roundTo]);
  const profit = profitMin;

  const overLogo = logo(row.o?.bk);
  const underLogo = logo(row.u?.bk);
  const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);

  // Get brand colors for bet buttons
  const overBrandColor =
    getSportsbookById(row.o?.bk || "")?.brandColor || "#10b981";
  const underBrandColor =
    getSportsbookById(row.u?.bk || "")?.brandColor || "#10b981";

  // Get side labels
  const getSideLabel = (side: "over" | "under") => {
    if (isMoneyline(row.mkt)) {
      return side === "over"
        ? row.ev?.home?.abbr || "Home"
        : row.ev?.away?.abbr || "Away";
    }
    if (isSpread(row.mkt)) {
      const raw = side === "over" ? row.o?.name || "" : row.u?.name || "";
      let out = raw;
      const homeName = row.ev?.home?.name || "";
      const awayName = row.ev?.away?.name || "";
      const homeAbbr = row.ev?.home?.abbr || homeName;
      const awayAbbr = row.ev?.away?.abbr || awayName;
      if (homeName)
        out = out.replace(
          new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"),
          homeAbbr,
        );
      if (awayName)
        out = out.replace(
          new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"),
          awayAbbr,
        );
      return out.replace(/\s+/g, " ").trim();
    }
    return side === "over" ? `O ${row.ln}` : `U ${row.ln}`;
  };

  const openBet = (
    e: React.MouseEvent,
    bk?: string,
    url?: string,
    mobileUrl?: string | null,
  ) => {
    e.stopPropagation();
    const link = getBookUrl(bk, url, mobileUrl);
    const finalLink = link ? applyState(link) || link : link;
    if (finalLink) window.open(finalLink, "_blank", "noopener,noreferrer");
  };

  // Format time - compact
  const formatTime = () => {
    const d = row.ev?.dt ? new Date(row.ev.dt) : null;
    if (!d) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    if (isToday) return time;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const gameTitle = `${row.ev?.away?.abbr || "Away"} @ ${row.ev?.home?.abbr || "Home"}`;

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 dark:bg-neutral-900 dark:shadow-none",
          isNew
            ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
            : "border-neutral-200 dark:border-neutral-800",
          hasChange && !isNew && "ring-1 ring-amber-500/30",
        )}
      >
        {/* Header Row - Edge Finder style */}
        <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700/50 dark:bg-neutral-800/60">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Game Info */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
                <SportIcon
                  sport={row.lg?.sport?.toLowerCase() || "basketball"}
                  className="h-3.5 w-3.5"
                />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {row.lg?.name}
              </span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
              <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {gameTitle}
              </span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {formatTime()}
              </span>
            </div>

            {/* Right: Warning Icon (if high ROI) + ROI Badge */}
            <div className="flex shrink-0 items-center gap-1.5">
              <ArbRiskIndicator row={row} variant="icon" />
              {isHighROI && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowWarning?.();
                  }}
                  className="rounded-md bg-amber-100 p-1 transition-colors hover:bg-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </button>
              )}
              <div
                className={cn(
                  "rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
                  roiPct >= 3
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
                )}
              >
                +{roiPct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Market & Player */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              {humanizeMarket(row.mkt)}
            </span>
            {player && (
              <>
                <span className="text-neutral-400 dark:text-neutral-600">
                  •
                </span>
                <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                  {player}
                </span>
              </>
            )}
            <ArbRiskIndicator row={row} />
          </div>
        </div>

        {/* Body - Two Sides (Hero Section - Compact) */}
        <div className="flex items-stretch gap-2 px-3 py-2.5">
          {/* Bet A - Over Side */}
          <div
            className="flex-1 rounded-lg border-l-2 bg-neutral-50 px-2.5 py-2 dark:bg-neutral-800/40"
            style={{ borderLeftColor: overBrandColor }}
          >
            <div className="flex items-center gap-2">
              {/* Book Logo */}
              {overLogo ? (
                <img
                  src={overLogo}
                  alt={row.o?.bk || ""}
                  className="h-5 w-5 shrink-0 rounded object-contain"
                />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded bg-neutral-200 dark:bg-neutral-700" />
              )}
              <div className="min-w-0 flex-1">
                {/* Side & Line - Small */}
                <div className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                  {getSideLabel("over")}
                </div>
                {/* Odds + Max - Hero */}
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {formatOdds(overOdds)}
                  </span>
                  {row.o?.max != null && (
                    <span className="text-[9px] text-neutral-400 tabular-nums dark:text-neutral-600">
                      (${Math.round(row.o.max)})
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Bet Button - Subtle Pill */}
            <button
              onClick={(e) => openBet(e, row.o?.bk, row.o?.u, row.o?.m)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-neutral-200 py-1.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase transition-all duration-150 hover:bg-neutral-300 active:scale-[0.97] dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
            >
              Bet
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </div>

          {/* Bet B - Under Side */}
          <div
            className="flex-1 rounded-lg border-l-2 bg-neutral-50 px-2.5 py-2 dark:bg-neutral-800/40"
            style={{ borderLeftColor: underBrandColor }}
          >
            <div className="flex items-center gap-2">
              {/* Book Logo */}
              {underLogo ? (
                <img
                  src={underLogo}
                  alt={row.u?.bk || ""}
                  className="h-5 w-5 shrink-0 rounded object-contain"
                />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded bg-neutral-200 dark:bg-neutral-700" />
              )}
              <div className="min-w-0 flex-1">
                {/* Side & Line - Small */}
                <div className="truncate text-[10px] text-neutral-400 dark:text-neutral-500">
                  {getSideLabel("under")}
                </div>
                {/* Odds + Max - Hero */}
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-rose-600 tabular-nums dark:text-rose-400">
                    {formatOdds(underOdds)}
                  </span>
                  {row.u?.max != null && (
                    <span className="text-[9px] text-neutral-400 tabular-nums dark:text-neutral-600">
                      (${Math.round(row.u.max)})
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Bet Button - Subtle Pill */}
            <button
              onClick={(e) => openBet(e, row.u?.bk, row.u?.u, row.u?.m)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-neutral-200 py-1.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase transition-all duration-150 hover:bg-neutral-300 active:scale-[0.97] dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
            >
              Bet
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {/* Footer - Action Zone (Click to Split Bets) */}
        <button
          onClick={onOpenCalculator}
          className="group flex w-full items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 transition-colors hover:bg-neutral-100 dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800/80"
        >
          {/* Left: Stake */}
          <div className="text-left">
            <div className="text-[9px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              Stake
            </div>
            <div className="text-sm font-semibold text-neutral-700 tabular-nums dark:text-neutral-200">
              ${Math.round(stakes.over + stakes.under)}
            </div>
          </div>

          {/* Center: Profit */}
          <div className="text-center">
            <div className="text-[9px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              Profit
            </div>
            <div className="text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {hasRange
                ? `+$${profitMin.toFixed(2)} – $${profitMax.toFixed(2)}`
                : `+$${profit.toFixed(2)}`}
            </div>
          </div>

          {/* Right: Split Bets Button */}
          <div className="bg-brand/10 dark:bg-brand/15 group-hover:bg-brand/20 dark:group-hover:bg-brand/25 flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors">
            <Calculator className="text-brand h-3.5 w-3.5" />
            <span className="text-brand text-xs font-semibold">Split Bets</span>
            <ChevronDown className="text-brand/60 h-3 w-3" />
          </div>
        </button>
      </div>
    </>
  );
}

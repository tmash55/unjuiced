"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Calculator,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSportsbookById,
  getSportsbookLogo,
  getSportsbookName,
} from "@/lib/data/sportsbooks";
import type { ArbRow } from "@/lib/arb-schema";
import { SportIcon } from "@/components/icons/sport-icons";
import { useStateLink } from "@/hooks/use-state-link";
import { ArbRiskIndicator } from "@/components/arbs/arb-risk-indicator";

const logo = (id?: string) => getSportsbookLogo(id);
const bookName = (id?: string) => getSportsbookName(id);

const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) || window.innerWidth < 768
  );
};

const getBookFallbackUrl = (
  bk?: string,
  applyState?: (url: string | null | undefined) => string | null,
): string | undefined => {
  if (!bk) return undefined;

  const sportsbook = getSportsbookById(bk);
  if (sportsbook?.links) {
    const desktopUrl = sportsbook.links.desktop;
    const mobileUrl = sportsbook.links.mobile;

    if (isMobileDevice() && mobileUrl) return mobileUrl;
    if (desktopUrl) return applyState?.(desktopUrl) || desktopUrl;
    if (mobileUrl) return mobileUrl;
  }

  return undefined;
};

const getBookUrl = (
  bk?: string,
  directUrl?: string | null,
  mobileUrl?: string | null,
  applyState?: (url: string | null | undefined) => string | null,
): string | undefined => {
  if (isMobileDevice() && mobileUrl) return mobileUrl;
  if (directUrl) return applyState?.(directUrl) || directUrl;
  if (mobileUrl) return mobileUrl;
  return getBookFallbackUrl(bk, applyState);
};

const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

// Calculate payout from American odds
const calculatePayout = (odds: number, stake: number): number => {
  if (!stake || !odds) return 0;
  if (odds > 0) return stake * (1 + odds / 100);
  return stake * (1 + 100 / Math.abs(odds));
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

// Calculate opposite stake given one stake
const calculateOppositeStake = (
  knownStake: number,
  knownOdds: number,
  oppositeOdds: number,
): number => {
  const knownDec =
    knownOdds > 0 ? 1 + knownOdds / 100 : 1 + 100 / Math.abs(knownOdds);
  const oppDec =
    oppositeOdds > 0
      ? 1 + oppositeOdds / 100
      : 1 + 100 / Math.abs(oppositeOdds);
  return (knownStake * knownDec) / oppDec;
};

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

/** Round a number to the nearest multiple of `step`. 0 = no rounding (2 decimal places). */
function roundStake(n: number, step: number): number {
  if (step <= 0) return Math.round(n * 100) / 100;
  return Math.round(n / step) * step;
}
function formatStake(n: number, step: number): string {
  if (step <= 0) return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return String(Math.round(n / step) * step);
}

interface BetCalculatorModalProps {
  row: ArbRow; // Snapshot row (captured when modal opened)
  currentRow?: ArbRow | null; // Current version from live data (for staleness detection)
  isOpen: boolean;
  onClose: () => void;
  defaultTotal: number;
  roundTo?: number;
}

export function BetCalculatorModal({
  row,
  currentRow,
  isOpen,
  onClose,
  defaultTotal,
  roundTo = 0,
}: BetCalculatorModalProps) {
  const applyState = useStateLink();

  // Check if the opportunity is still available by comparing snapshot with current data
  const isStale = useMemo(() => {
    // If no current row, the opportunity was removed
    if (!currentRow) return true;

    // Check if odds have changed significantly (more than 20 points difference)
    const snapshotOverOdds = Number(row.o?.od || 0);
    const snapshotUnderOdds = Number(row.u?.od || 0);
    const currentOverOdds = Number(currentRow.o?.od || 0);
    const currentUnderOdds = Number(currentRow.u?.od || 0);

    if (Math.abs(snapshotOverOdds - currentOverOdds) > 20) return true;
    if (Math.abs(snapshotUnderOdds - currentUnderOdds) > 20) return true;

    // Check if ROI dropped below 0 (no longer profitable)
    const currentRoi = (currentRow.roi_bps ?? 0) / 100;
    if (currentRoi <= 0) return true;

    return false;
  }, [row, currentRow]);

  const overOdds = Number(row.o?.od || 0);
  const underOdds = Number(row.u?.od || 0);
  const roiPct = (row.roi_bps ?? 0) / 100;

  const defaultSizes = useMemo(
    () => calculateBetSizes(overOdds, underOdds, defaultTotal),
    [overOdds, underOdds, defaultTotal],
  );

  const [overAmount, setOverAmount] = useState(
    formatStake(roundStake(defaultSizes.over, roundTo), roundTo),
  );
  const [underAmount, setUnderAmount] = useState(
    formatStake(roundStake(defaultSizes.under, roundTo), roundTo),
  );

  // Loading states for bet buttons
  const [loadingOver, setLoadingOver] = useState(false);
  const [loadingUnder, setLoadingUnder] = useState(false);

  // Reset amounts when modal opens or row changes
  useEffect(() => {
    if (isOpen && row) {
      const sizes = calculateBetSizes(
        Number(row.o?.od || 0),
        Number(row.u?.od || 0),
        defaultTotal,
      );
      setOverAmount(formatStake(roundStake(sizes.over, roundTo), roundTo));
      setUnderAmount(formatStake(roundStake(sizes.under, roundTo), roundTo));
      // Reset loading states
      setLoadingOver(false);
      setLoadingUnder(false);
    }
  }, [isOpen, row, defaultTotal, roundTo]);

  // Calculate values
  const overStake = parseFloat(overAmount) || 0;
  const underStake = parseFloat(underAmount) || 0;
  const totalStake = overStake + underStake;
  const overPayout = calculatePayout(overOdds, overStake);
  const underPayout = calculatePayout(underOdds, underStake);
  const profitIfOver = overPayout - totalStake;
  const profitIfUnder = underPayout - totalStake;
  const profitMin = Math.min(profitIfOver, profitIfUnder);
  const profitMax = Math.max(profitIfOver, profitIfUnder);
  const profit = profitMin;
  const guaranteedPayout = Math.min(overPayout, underPayout);
  const calcHasRange = roundTo > 0 && Math.abs(profitMax - profitMin) >= 0.01;

  // Handle over amount change
  const handleOverChange = (val: string) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setOverAmount(val);
    }
  };

  // Handle under amount change
  const handleUnderChange = (val: string) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setUnderAmount(val);
    }
  };

  // Recalculate opposite side on blur
  const handleOverBlur = () => {
    const stake = parseFloat(overAmount);
    if (stake > 0) {
      const opposite = roundStake(
        calculateOppositeStake(stake, overOdds, underOdds),
        roundTo,
      );
      setUnderAmount(formatStake(opposite, roundTo));
    }
  };

  const handleUnderBlur = () => {
    const stake = parseFloat(underAmount);
    if (stake > 0) {
      const opposite = roundStake(
        calculateOppositeStake(stake, underOdds, overOdds),
        roundTo,
      );
      setOverAmount(formatStake(opposite, roundTo));
    }
  };

  // Quick presets
  const presets = [50, 100, 200, 500];
  const applyPreset = (total: number) => {
    const sizes = calculateBetSizes(overOdds, underOdds, total);
    const o = roundStake(sizes.over, roundTo);
    const u = roundStake(sizes.under, roundTo);
    setOverAmount(formatStake(o, roundTo));
    setUnderAmount(formatStake(u, roundTo));
  };

  // Open bet with loading state
  const openBet = (
    bk?: string,
    url?: string,
    mobileUrl?: string | null,
    side: "over" | "under" = "over",
  ) => {
    const setLoading = side === "over" ? setLoadingOver : setLoadingUnder;
    setLoading(true);

    // Brief loading state for feedback
    setTimeout(() => {
      const finalLink = getBookUrl(bk, url, mobileUrl, applyState);
      if (finalLink) window.open(finalLink, "_blank", "noopener,noreferrer");
      // Reset loading after a moment
      setTimeout(() => setLoading(false), 1000);
    }, 150);
  };

  // Get side labels
  const getSideLabel = (side: "over" | "under") => {
    if (isMoneyline(row.mkt)) {
      return side === "over"
        ? row.ev?.home?.abbr || "Home"
        : row.ev?.away?.abbr || "Away";
    }
    if (isSpread(row.mkt)) {
      const raw = side === "over" ? row.o?.name || "" : row.u?.name || "";
      return raw.replace(/\s+/g, " ").trim();
    }
    return side === "over" ? `Over ${row.ln}` : `Under ${row.ln}`;
  };

  if (!isOpen) return null;

  const overLogo = logo(row.o?.bk);
  const underLogo = logo(row.u?.bk);
  const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);
  const gameTitle = `${row.ev?.away?.abbr || "Away"} @ ${row.ev?.home?.abbr || "Home"}`;
  const overBookName = bookName(row.o?.bk);
  const underBookName = bookName(row.u?.bk);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md dark:bg-black/60"
        onClick={onClose}
        style={{
          WebkitBackdropFilter: "blur(12px)",
          backdropFilter: "blur(12px)",
        }}
      />

      {/* Modal - Centered */}
      <div
        className={cn(
          "animate-in zoom-in-95 fade-in relative w-full max-w-sm overflow-hidden rounded-2xl border bg-white shadow-xl duration-200 dark:bg-neutral-900 dark:shadow-none",
          isStale
            ? "border-amber-400 dark:border-amber-500/50"
            : "border-neutral-200 dark:border-neutral-800",
        )}
      >
        {/* Stale Warning Banner */}
        {isStale && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This opportunity may no longer be available. Odds have changed.
            </p>
          </div>
        )}

        {/* Header */}
        <div
          className={cn(
            "border-b border-neutral-200 px-4 py-3 dark:border-neutral-700/50",
            isStale
              ? "bg-neutral-50 dark:bg-neutral-800/50"
              : "bg-neutral-50 dark:bg-neutral-800/80",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "rounded-lg p-1.5",
                  isStale
                    ? "bg-amber-100 dark:bg-amber-500/15"
                    : "bg-brand/10 dark:bg-brand/15",
                )}
              >
                <Calculator
                  className={cn(
                    "h-4 w-4",
                    isStale
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-brand",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-sm font-semibold",
                  isStale
                    ? "text-neutral-500 dark:text-neutral-400"
                    : "text-neutral-900 dark:text-white",
                )}
              >
                Bet Calculator
              </span>
            </div>
            <button
              onClick={onClose}
              className="-mr-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700/50 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Market Info */}
          <div
            className={cn(
              "mt-2.5 flex items-center gap-2",
              isStale && "opacity-60",
            )}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-200 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400">
              <SportIcon
                sport={row.lg?.sport?.toLowerCase() || "basketball"}
                className="h-3 w-3"
              />
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {row.lg?.name}
            </span>
            <span className="text-neutral-400 dark:text-neutral-600">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {gameTitle}
            </span>
          </div>

          {/* Player/Market */}
          <div
            className={cn(
              "mt-1.5 flex items-center justify-between",
              isStale && "opacity-60",
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                {humanizeMarket(row.mkt)}
              </span>
              {player && (
                <>
                  <span className="text-neutral-400 dark:text-neutral-600">
                    •
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isStale
                        ? "text-neutral-500 dark:text-neutral-400"
                        : "text-neutral-900 dark:text-white",
                    )}
                  >
                    {player}
                  </span>
                </>
              )}
              <ArbRiskIndicator row={row} />
            </div>
            <div
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
                isStale
                  ? "bg-neutral-200 text-neutral-500 line-through dark:bg-neutral-700 dark:text-neutral-400"
                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
              )}
            >
              +{roiPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div
          className={cn(
            "px-4 pt-4 pb-3",
            isStale && "pointer-events-none opacity-50",
          )}
        >
          <div className="flex gap-2">
            {presets.map((amount) => (
              <button
                key={amount}
                onClick={() => applyPreset(amount)}
                disabled={isStale}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-semibold tabular-nums transition-all duration-150",
                  Math.abs(totalStake - amount) < 1
                    ? "bg-brand scale-[1.02] text-neutral-900"
                    : "bg-neutral-100 text-neutral-600 hover:scale-[1.02] hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700",
                )}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Cards - Two Columns with aligned rows */}
        <div className={cn("px-4 pb-4", isStale && "opacity-50")}>
          <div className="grid grid-cols-[1fr_1px_1fr] gap-0">
            {/* Bet A - Over Side */}
            <div className="flex flex-col p-3">
              {/* Book Logo & Name - Fixed height */}
              <div className="mb-2 flex h-7 items-center gap-2">
                {overLogo ? (
                  <img
                    src={overLogo}
                    alt={row.o?.bk || ""}
                    className={cn(
                      "h-6 w-6 rounded object-contain",
                      isStale && "grayscale",
                    )}
                  />
                ) : (
                  <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                )}
                <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {overBookName}
                </span>
              </div>

              {/* Side Label - Fixed height */}
              <div className="line-clamp-2 h-8 text-[10px] text-neutral-400 dark:text-neutral-500">
                {getSideLabel("over")}
              </div>

              {/* Odds - Fixed height */}
              <div
                className={cn(
                  "h-8 text-2xl font-bold tabular-nums",
                  isStale
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatOdds(overOdds)}
              </div>

              {/* Stake Label */}
              <div className="mt-3 mb-1 text-[9px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                Stake at {overBookName.split(" ")[0]}
              </div>

              {/* Input */}
              <div className="relative mb-3">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-neutral-400 dark:text-neutral-500">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={overAmount}
                  onChange={(e) => handleOverChange(e.target.value)}
                  onBlur={handleOverBlur}
                  disabled={isStale}
                  className={cn(
                    "focus:border-brand focus:ring-brand/20 w-full rounded-lg border border-neutral-200 bg-neutral-100 py-2.5 pr-3 pl-7 text-sm font-bold text-neutral-900 tabular-nums transition-all duration-150 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white",
                    isStale && "cursor-not-allowed",
                  )}
                />
              </div>

              {/* Bet Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!loadingOver) {
                    openBet(row.o?.bk, row.o?.u, row.o?.m, "over");
                  }
                }}
                disabled={isStale || loadingOver}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white transition-all duration-150",
                  isStale
                    ? "cursor-not-allowed bg-neutral-300 dark:bg-neutral-700"
                    : loadingOver
                      ? "bg-emerald-700"
                      : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]",
                )}
              >
                {loadingOver ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="truncate">Opening...</span>
                  </>
                ) : (
                  <>
                    BET <ExternalLink className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="my-2 bg-neutral-200 dark:bg-neutral-700/50" />

            {/* Bet B - Under Side */}
            <div className="flex flex-col p-3">
              {/* Book Logo & Name - Fixed height */}
              <div className="mb-2 flex h-7 items-center gap-2">
                {underLogo ? (
                  <img
                    src={underLogo}
                    alt={row.u?.bk || ""}
                    className={cn(
                      "h-6 w-6 rounded object-contain",
                      isStale && "grayscale",
                    )}
                  />
                ) : (
                  <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                )}
                <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {underBookName}
                </span>
              </div>

              {/* Side Label - Fixed height */}
              <div className="line-clamp-2 h-8 text-[10px] text-neutral-400 dark:text-neutral-500">
                {getSideLabel("under")}
              </div>

              {/* Odds - Fixed height */}
              <div
                className={cn(
                  "h-8 text-2xl font-bold tabular-nums",
                  isStale
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {formatOdds(underOdds)}
              </div>

              {/* Stake Label */}
              <div className="mt-3 mb-1 text-[9px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                Stake at {underBookName.split(" ")[0]}
              </div>

              {/* Input */}
              <div className="relative mb-3">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-neutral-400 dark:text-neutral-500">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={underAmount}
                  onChange={(e) => handleUnderChange(e.target.value)}
                  onBlur={handleUnderBlur}
                  disabled={isStale}
                  className={cn(
                    "focus:border-brand focus:ring-brand/20 w-full rounded-lg border border-neutral-200 bg-neutral-100 py-2.5 pr-3 pl-7 text-sm font-bold text-neutral-900 tabular-nums transition-all duration-150 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white",
                    isStale && "cursor-not-allowed",
                  )}
                />
              </div>

              {/* Bet Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!loadingUnder) {
                    openBet(row.u?.bk, row.u?.u, row.u?.m, "under");
                  }
                }}
                disabled={isStale || loadingUnder}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-white transition-all duration-150",
                  isStale
                    ? "cursor-not-allowed bg-neutral-300 dark:bg-neutral-700"
                    : loadingUnder
                      ? "bg-emerald-700"
                      : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]",
                )}
              >
                {loadingUnder ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="truncate">Opening...</span>
                  </>
                ) : (
                  <>
                    BET <ExternalLink className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Footer */}
        <div
          className={cn(
            "border-t border-neutral-200 px-4 py-3 dark:border-neutral-700/50",
            isStale
              ? "bg-neutral-50 dark:bg-neutral-800/30"
              : "bg-neutral-50 dark:bg-neutral-800/50",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <div className="text-[10px] tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                Total Stake
              </div>
              <div
                className={cn(
                  "text-sm font-bold tabular-nums transition-all duration-150",
                  isStale
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-900 dark:text-white",
                )}
              >
                ${totalStake.toFixed(2)}
              </div>
            </div>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 text-center">
              <div className="text-[10px] tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                Payout
              </div>
              <div
                className={cn(
                  "text-sm font-bold tabular-nums transition-all duration-150",
                  isStale
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-600 dark:text-neutral-300",
                )}
              >
                ${guaranteedPayout.toFixed(2)}
              </div>
            </div>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 text-center">
              <div className="text-[10px] tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                Profit
              </div>
              <div
                className={cn(
                  "text-base font-bold tabular-nums transition-all duration-150",
                  isStale
                    ? "text-neutral-400 line-through dark:text-neutral-500"
                    : profit > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-neutral-500 dark:text-neutral-400",
                )}
              >
                {calcHasRange ? (
                  <>
                    {profit > 0 ? "+" : ""}${profitMin.toFixed(2)} – $
                    {profitMax.toFixed(2)}
                  </>
                ) : (
                  <>
                    {profit > 0 ? "+" : ""}${profit.toFixed(2)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, Calculator, ExternalLink, AlertCircle, Copy, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sportsbooks, getSportsbookById } from "@/lib/data/sportsbooks";
import type { ArbRow } from "@/lib/arb-schema";
import { SportIcon } from "@/components/icons/sport-icons";

// Build sportsbook map for quick lookup
const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();
const logo = (id?: string) => SB_MAP.get(norm(id))?.logo;
const bookName = (id?: string) => SB_MAP.get(norm(id))?.name || (id || "");

const getBookUrl = (bk?: string, directUrl?: string, mobileUrl?: string | null): string | undefined => {
  if (mobileUrl) return mobileUrl;
  if (directUrl) return directUrl;
  if (!bk) return undefined;
  const sb = SB_MAP.get(norm(bk));
  if (!sb) return undefined;
  const base = (sb.affiliate && sb.affiliateLink) ? sb.affiliateLink : (sb.url || undefined);
  if (!base) return undefined;
  if (sb.requiresState && base.includes("{state}")) return base.replace(/\{state\}/g, "nj");
  return base;
};

const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

// Calculate payout from American odds
const calculatePayout = (odds: number, stake: number): number => {
  if (!stake || !odds) return 0;
  if (odds > 0) return stake * (1 + odds / 100);
  return stake * (1 + 100 / Math.abs(odds));
};

// Calculate equal-profit bet sizes
const calculateBetSizes = (overOdds: number, underOdds: number, total: number) => {
  const overDec = overOdds > 0 ? 1 + overOdds / 100 : 1 + 100 / Math.abs(overOdds);
  const underDec = underOdds > 0 ? 1 + underOdds / 100 : 1 + 100 / Math.abs(underOdds);
  const overStake = (total * underDec) / (overDec + underDec);
  const underStake = total - overStake;
  return { over: overStake, under: underStake };
};

// Calculate opposite stake given one stake
const calculateOppositeStake = (knownStake: number, knownOdds: number, oppositeOdds: number): number => {
  const knownDec = knownOdds > 0 ? 1 + knownOdds / 100 : 1 + 100 / Math.abs(knownOdds);
  const oppDec = oppositeOdds > 0 ? 1 + oppositeOdds / 100 : 1 + 100 / Math.abs(oppositeOdds);
  return (knownStake * knownDec) / oppDec;
};

const isSpread = (mkt?: string) => /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(String(mkt || ''));
const isMoneyline = (mkt?: string) => /moneyline|\bml\b/i.test(String(mkt || ''));

const extractPlayer = (name?: string) => {
  if (!name) return '';
  return name.replace(/\s+(Over|Under).*$/i, '').trim();
};

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

const humanizeMarket = (mkt?: string) => {
  const s = String(mkt || '')
    .replace(/_/g, ' ')
    .replace(/\bplayer\b\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return titleCase(s);
};

interface BetCalculatorModalProps {
  row: ArbRow;  // Snapshot row (captured when modal opened)
  currentRow?: ArbRow | null;  // Current version from live data (for staleness detection)
  isOpen: boolean;
  onClose: () => void;
  defaultTotal: number;
}

export function BetCalculatorModal({ row, currentRow, isOpen, onClose, defaultTotal }: BetCalculatorModalProps) {
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
  const roiPct = ((row.roi_bps ?? 0) / 100);
  
  const defaultSizes = useMemo(() => calculateBetSizes(overOdds, underOdds, defaultTotal), [overOdds, underOdds, defaultTotal]);
  
  const [overAmount, setOverAmount] = useState(defaultSizes.over.toFixed(2));
  const [underAmount, setUnderAmount] = useState(defaultSizes.under.toFixed(2));
  
  // Loading states for bet buttons
  const [loadingOver, setLoadingOver] = useState(false);
  const [loadingUnder, setLoadingUnder] = useState(false);
  
  // Copy success states
  const [copiedOver, setCopiedOver] = useState(false);
  const [copiedUnder, setCopiedUnder] = useState(false);
  
  // Long press detection refs
  const overPressTimer = useRef<NodeJS.Timeout | null>(null);
  const underPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Reset amounts when modal opens or row changes
  useEffect(() => {
    if (isOpen && row) {
      const sizes = calculateBetSizes(
        Number(row.o?.od || 0),
        Number(row.u?.od || 0),
        defaultTotal
      );
      setOverAmount(sizes.over.toFixed(2));
      setUnderAmount(sizes.under.toFixed(2));
      // Reset loading/copy states
      setLoadingOver(false);
      setLoadingUnder(false);
      setCopiedOver(false);
      setCopiedUnder(false);
    }
  }, [isOpen, row, defaultTotal]);

  // Calculate values
  const overStake = parseFloat(overAmount) || 0;
  const underStake = parseFloat(underAmount) || 0;
  const totalStake = overStake + underStake;
  const overPayout = calculatePayout(overOdds, overStake);
  const underPayout = calculatePayout(underOdds, underStake);
  const guaranteedPayout = Math.min(overPayout, underPayout);
  const profit = guaranteedPayout - totalStake;

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
      const opposite = calculateOppositeStake(stake, overOdds, underOdds);
      setUnderAmount(opposite.toFixed(2));
    }
  };

  const handleUnderBlur = () => {
    const stake = parseFloat(underAmount);
    if (stake > 0) {
      const opposite = calculateOppositeStake(stake, underOdds, overOdds);
      setOverAmount(opposite.toFixed(2));
    }
  };

  // Quick presets
  const presets = [50, 100, 200, 500];
  const applyPreset = (total: number) => {
    const sizes = calculateBetSizes(overOdds, underOdds, total);
    setOverAmount(sizes.over.toFixed(2));
    setUnderAmount(sizes.under.toFixed(2));
  };

  // Open bet with loading state
  const openBet = (bk?: string, url?: string, mobileUrl?: string | null, side: 'over' | 'under' = 'over') => {
    const setLoading = side === 'over' ? setLoadingOver : setLoadingUnder;
    setLoading(true);
    
    // Brief loading state for feedback
    setTimeout(() => {
      const link = getBookUrl(bk, url, mobileUrl);
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
      // Reset loading after a moment
      setTimeout(() => setLoading(false), 1000);
    }, 150);
  };

  // Copy stake to clipboard
  const copyStake = useCallback(async (amount: string, side: 'over' | 'under') => {
    try {
      await navigator.clipboard.writeText(`$${parseFloat(amount).toFixed(2)}`);
      if (side === 'over') {
        setCopiedOver(true);
        setTimeout(() => setCopiedOver(false), 2000);
      } else {
        setCopiedUnder(true);
        setTimeout(() => setCopiedUnder(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Long press handlers for copy
  const handlePressStart = (side: 'over' | 'under') => {
    const timer = setTimeout(() => {
      copyStake(side === 'over' ? overAmount : underAmount, side);
    }, 500); // 500ms long press
    if (side === 'over') {
      overPressTimer.current = timer;
    } else {
      underPressTimer.current = timer;
    }
  };

  const handlePressEnd = (side: 'over' | 'under') => {
    const timer = side === 'over' ? overPressTimer.current : underPressTimer.current;
    if (timer) {
      clearTimeout(timer);
    }
  };

  // Get side labels
  const getSideLabel = (side: "over" | "under") => {
    if (isMoneyline(row.mkt)) {
      return side === "over" ? (row.ev?.home?.abbr || "Home") : (row.ev?.away?.abbr || "Away");
    }
    if (isSpread(row.mkt)) {
      const raw = side === "over" ? (row.o?.name || "") : (row.u?.name || "");
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
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md"
        onClick={onClose}
        style={{ WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)' }}
      />
      
      {/* Modal - Centered */}
      <div className={cn(
        "relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl border overflow-hidden animate-in zoom-in-95 fade-in duration-200 shadow-xl dark:shadow-none",
        isStale ? "border-amber-400 dark:border-amber-500/50" : "border-neutral-200 dark:border-neutral-800"
      )}>
        {/* Stale Warning Banner */}
        {isStale && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This opportunity may no longer be available. Odds have changed.
            </p>
          </div>
        )}

        {/* Header */}
        <div className={cn(
          "px-4 py-3 border-b border-neutral-200 dark:border-neutral-700/50",
          isStale ? "bg-neutral-50 dark:bg-neutral-800/50" : "bg-neutral-50 dark:bg-neutral-800/80"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                isStale ? "bg-amber-100 dark:bg-amber-500/15" : "bg-brand/10 dark:bg-brand/15"
              )}>
                <Calculator className={cn("w-4 h-4", isStale ? "text-amber-500 dark:text-amber-400" : "text-brand")} />
              </div>
              <span className={cn(
                "font-semibold text-sm",
                isStale ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-900 dark:text-white"
              )}>Bet Calculator</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 -mr-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Market Info */}
          <div className={cn("mt-2.5 flex items-center gap-2", isStale && "opacity-60")}>
            <div className="flex items-center justify-center w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400">
              <SportIcon sport={row.lg?.sport?.toLowerCase() || "basketball"} className="w-3 h-3" />
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{row.lg?.name}</span>
            <span className="text-neutral-400 dark:text-neutral-600">•</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{gameTitle}</span>
          </div>
          
          {/* Player/Market */}
          <div className={cn("mt-1.5 flex items-center justify-between", isStale && "opacity-60")}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                {humanizeMarket(row.mkt)}
              </span>
              {player && (
                <>
                  <span className="text-neutral-400 dark:text-neutral-600">•</span>
                  <span className={cn("text-sm font-medium", isStale ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-900 dark:text-white")}>{player}</span>
                </>
              )}
            </div>
            <div className={cn(
              "px-2 py-0.5 rounded-md text-xs font-bold tabular-nums",
              isStale 
                ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 line-through" 
                : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            )}>
              +{roiPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className={cn("px-4 pt-4 pb-3", isStale && "opacity-50 pointer-events-none")}>
          <div className="flex gap-2">
            {presets.map((amount) => (
              <button
                key={amount}
                onClick={() => applyPreset(amount)}
                disabled={isStale}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-all duration-150",
                  Math.abs(totalStake - amount) < 1
                    ? "bg-brand text-neutral-900 scale-[1.02]"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:scale-[1.02]"
                )}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Cards - Two Columns */}
        <div className={cn("px-4 pb-4", isStale && "opacity-50")}>
          <div className="flex gap-0">
            {/* Bet A - Over Side */}
            <div className="flex-1 p-3">
              {/* Book Logo & Name */}
              <div className="flex items-center gap-2 mb-2">
                {overLogo ? (
                  <img src={overLogo} alt={row.o?.bk || ''} className={cn("h-6 w-6 object-contain rounded", isStale && "grayscale")} />
                ) : (
                  <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                )}
                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{overBookName}</span>
              </div>
              
              {/* Side Label */}
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1">{getSideLabel("over")}</div>
              
              {/* Odds */}
              <div className={cn(
                "font-bold text-xl mb-2 tabular-nums",
                isStale ? "text-neutral-400 dark:text-neutral-500" : "text-emerald-600 dark:text-emerald-400"
              )}>{formatOdds(overOdds)}</div>
              
              {/* Stake Label */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">
                  Stake at {overBookName.split(' ')[0]}
                </span>
                {/* Copy button */}
                <button
                  onClick={() => copyStake(overAmount, 'over')}
                  className={cn(
                    "p-0.5 rounded transition-colors",
                    copiedOver 
                      ? "text-emerald-500" 
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                  title="Copy stake"
                >
                  {copiedOver ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              
              {/* Input */}
              <div 
                className="relative mb-3"
                onTouchStart={() => handlePressStart('over')}
                onTouchEnd={() => handlePressEnd('over')}
                onMouseDown={() => handlePressStart('over')}
                onMouseUp={() => handlePressEnd('over')}
                onMouseLeave={() => handlePressEnd('over')}
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-sm font-medium">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={overAmount}
                  onChange={(e) => handleOverChange(e.target.value)}
                  onBlur={handleOverBlur}
                  disabled={isStale}
                  className={cn(
                    "w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-7 pr-3 py-2.5 text-sm font-bold tabular-nums text-neutral-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150",
                    isStale && "cursor-not-allowed"
                  )}
                />
              </div>
              
              {/* Bet Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!loadingOver) {
                    openBet(row.o?.bk, row.o?.u, row.o?.m, 'over');
                  }
                }}
                disabled={isStale || loadingOver}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-2.5 rounded-lg transition-all duration-150",
                  isStale 
                    ? "bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed" 
                    : loadingOver
                      ? "bg-emerald-700"
                      : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]"
                )}
              >
                {loadingOver ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="truncate">Opening {overBookName.split(' ')[0]}...</span>
                  </>
                ) : (
                  <>
                    BET <ExternalLink className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="w-px bg-neutral-200 dark:bg-neutral-700/50 my-2" />

            {/* Bet B - Under Side */}
            <div className="flex-1 p-3">
              {/* Book Logo & Name */}
              <div className="flex items-center gap-2 mb-2">
                {underLogo ? (
                  <img src={underLogo} alt={row.u?.bk || ''} className={cn("h-6 w-6 object-contain rounded", isStale && "grayscale")} />
                ) : (
                  <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                )}
                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{underBookName}</span>
              </div>
              
              {/* Side Label */}
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1">{getSideLabel("under")}</div>
              
              {/* Odds */}
              <div className={cn(
                "font-bold text-xl mb-2 tabular-nums",
                isStale ? "text-neutral-400 dark:text-neutral-500" : "text-rose-600 dark:text-rose-400"
              )}>{formatOdds(underOdds)}</div>
              
              {/* Stake Label */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">
                  Stake at {underBookName.split(' ')[0]}
                </span>
                {/* Copy button */}
                <button
                  onClick={() => copyStake(underAmount, 'under')}
                  className={cn(
                    "p-0.5 rounded transition-colors",
                    copiedUnder 
                      ? "text-emerald-500" 
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  )}
                  title="Copy stake"
                >
                  {copiedUnder ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              
              {/* Input */}
              <div 
                className="relative mb-3"
                onTouchStart={() => handlePressStart('under')}
                onTouchEnd={() => handlePressEnd('under')}
                onMouseDown={() => handlePressStart('under')}
                onMouseUp={() => handlePressEnd('under')}
                onMouseLeave={() => handlePressEnd('under')}
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-sm font-medium">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={underAmount}
                  onChange={(e) => handleUnderChange(e.target.value)}
                  onBlur={handleUnderBlur}
                  disabled={isStale}
                  className={cn(
                    "w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-7 pr-3 py-2.5 text-sm font-bold tabular-nums text-neutral-900 dark:text-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150",
                    isStale && "cursor-not-allowed"
                  )}
                />
              </div>
              
              {/* Bet Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (!loadingUnder) {
                    openBet(row.u?.bk, row.u?.u, row.u?.m, 'under');
                  }
                }}
                disabled={isStale || loadingUnder}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-2.5 rounded-lg transition-all duration-150",
                  isStale 
                    ? "bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed" 
                    : loadingUnder
                      ? "bg-emerald-700"
                      : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]"
                )}
              >
                {loadingUnder ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="truncate">Opening {underBookName.split(' ')[0]}...</span>
                  </>
                ) : (
                  <>
                    BET <ExternalLink className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Footer */}
        <div className={cn(
          "px-4 py-3 border-t border-neutral-200 dark:border-neutral-700/50",
          isStale ? "bg-neutral-50 dark:bg-neutral-800/30" : "bg-neutral-50 dark:bg-neutral-800/50"
        )}>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Total Stake</div>
              <div className={cn(
                "text-sm font-bold tabular-nums transition-all duration-150",
                isStale ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-900 dark:text-white"
              )}>
                ${totalStake.toFixed(2)}
              </div>
            </div>
            <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700" />
            <div className="text-center flex-1">
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Payout</div>
              <div className={cn(
                "text-sm font-bold tabular-nums transition-all duration-150",
                isStale ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-300"
              )}>
                ${guaranteedPayout.toFixed(2)}
              </div>
            </div>
            <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700" />
            <div className="text-center flex-1">
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Profit</div>
              <div className={cn(
                "text-base font-bold tabular-nums transition-all duration-150",
                isStale ? "text-neutral-400 dark:text-neutral-500 line-through" : profit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 dark:text-neutral-400"
              )}>
                {profit > 0 ? "+" : ""}${profit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Copy Success Toast */}
        {(copiedOver || copiedUnder) && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
              Stake copied!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

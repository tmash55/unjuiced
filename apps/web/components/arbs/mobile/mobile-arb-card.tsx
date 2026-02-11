"use client";

import React, { useState, useCallback } from "react";
import { ChevronDown, ExternalLink, Zap, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { sportsbooks } from "@/lib/data/sportsbooks";
import type { ArbRow } from "@/lib/arb-schema";
import { SportIcon } from "@/components/icons/sport-icons";

// Build sportsbook map for quick lookup (using legacy `logo` field)
const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();

interface MobileArbCardProps {
  row: ArbRow;
  id: string;
  totalBetAmount: number;
  roundBets?: boolean;
  isNew?: boolean;
  hasChange?: boolean;
}

// Utility functions
const logo = (id?: string) => SB_MAP.get(norm(id))?.logo;
const bookName = (id?: string) => SB_MAP.get(norm(id))?.name || (id || "");

const getBookUrl = (bk?: string, directUrl?: string, mobileUrl?: string | null): string | undefined => {
  // Prefer mobile URL, then direct URL, then affiliate/fallback
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

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

const humanizeMarket = (mkt?: string) => {
  const s = String(mkt || '')
    .replace(/_/g, ' ')
    .replace(/\bplayer\b\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return titleCase(s);
};

const isSpread = (mkt?: string) => /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(String(mkt || ''));
const isMoneyline = (mkt?: string) => /moneyline|\bml\b/i.test(String(mkt || ''));

const extractPlayer = (name?: string) => {
  if (!name) return '';
  return name.replace(/\s+(Over|Under).*$/i, '').trim();
};

const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

const formatPlayerShort = (full?: string) => {
  if (!full) return '';
  const tokens = full.trim().replace(/\s+/g, ' ').split(' ');
  if (tokens.length === 0) return '';
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi']);
  let end = tokens.length - 1;
  if (suffixes.has(tokens[end].toLowerCase())) end -= 1;
  if (end < 1) return tokens[0];
  const first = tokens[0];
  const last = tokens[end].replace(/[,]+/g, '');
  return `${first} ${last}`;
};

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

export function MobileArbCard({ row, id, totalBetAmount, roundBets = false, isNew, hasChange }: MobileArbCardProps) {
  const [expanded, setExpanded] = useState(false);

  const roiPct = ((row.roi_bps ?? 0) / 100);
  const isHighROI = roiPct > 5;
  
  const overOdds = Number(row.o?.od || 0);
  const underOdds = Number(row.u?.od || 0);
  
  // Calculate bet sizes
  const defaultSizes = calculateBetSizes(overOdds, underOdds, totalBetAmount);
  
  // Initialize with default values
  const [customOver, setCustomOver] = useState<string>(Math.round(defaultSizes.over).toString());
  const [customUnder, setCustomUnder] = useState<string>(Math.round(defaultSizes.under).toString());
  const overStake = customOver && !isNaN(parseFloat(customOver)) ? parseFloat(customOver) : defaultSizes.over;
  const underStake = customUnder && !isNaN(parseFloat(customUnder)) ? parseFloat(customUnder) : defaultSizes.under;
  
  const formatAmount = (n: number) => {
    if (roundBets) return `$${Math.round(n)}`;
    return `$${n.toFixed(2)}`;
  };

  // Calculate profit
  const totalStake = overStake + underStake;
  const overPayout = calculatePayout(overOdds, overStake);
  const underPayout = calculatePayout(underOdds, underStake);
  const profit = Math.min(overPayout, underPayout) - totalStake;
  
  // Get side labels
  const getSideLabel = (side: "over" | "under") => {
    if (isMoneyline(row.mkt)) return side === "over" ? (row.ev?.home?.abbr || "Home") : (row.ev?.away?.abbr || "Away");
    if (isSpread(row.mkt)) {
      const raw = side === "over" ? (row.o?.name || "") : (row.u?.name || "");
      // Compress team names
      let out = raw;
      const homeName = row.ev?.home?.name || "";
      const awayName = row.ev?.away?.name || "";
      const homeAbbr = row.ev?.home?.abbr || homeName;
      const awayAbbr = row.ev?.away?.abbr || awayName;
      if (homeName) out = out.replace(new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), homeAbbr);
      if (awayName) out = out.replace(new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), awayAbbr);
      return out.replace(/\s+/g, " ").trim();
    }
    return side === "over" ? `Over ${row.ln}` : `Under ${row.ln}`;
  };

  // Open bet link
  const openBet = (bk?: string, url?: string, mobileUrl?: string | null) => {
    const link = getBookUrl(bk, url, mobileUrl);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Format time
  const formatTime = () => {
    const d = row.ev?.dt ? new Date(row.ev.dt) : null;
    if (!d) return "TBD";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
  };

  const overLogo = logo(row.o?.bk);
  const underLogo = logo(row.u?.bk);
  const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);
  const playerShort = formatPlayerShort(player);
  const gameTitle = `${row.ev?.away?.abbr || row.ev?.away?.name || "Away"} vs ${row.ev?.home?.abbr || row.ev?.home?.name || "Home"}`;

  return (
    <div className={cn(
      "bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-sm dark:shadow-none",
      isNew ? "border-emerald-500 shadow-lg shadow-emerald-500/25" : "border-neutral-200 dark:border-neutral-800",
      hasChange && !isNew && "ring-2 ring-amber-500/40"
    )}>
      {/* Header - ROI & Game Info */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left: ROI & Profit */}
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              isHighROI ? "text-emerald-500 dark:text-emerald-400" : "text-emerald-600 dark:text-emerald-500"
            )}>
              {roiPct.toFixed(2)}%
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              ~{formatAmount(profit)}
            </span>
          </div>
          
          {/* Right: Time */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Clock className="w-3 h-3" />
            <span>{formatTime()}</span>
          </div>
        </div>
        
        {/* Sport & Game */}
        <div className="mt-2 flex items-center gap-2">
          <SportIcon sport={row.lg?.sport?.toLowerCase() || "basketball"} className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {row.lg?.sport} • {row.lg?.name}
          </span>
        </div>
        <div className="mt-1 text-sm font-medium text-neutral-900 dark:text-white">
          {gameTitle}
        </div>
        <div className="mt-0.5 text-xs text-brand font-medium">
          {isMoneyline(row.mkt) || isSpread(row.mkt) 
            ? humanizeMarket(row.mkt)
            : `${humanizeMarket(row.mkt)}${playerShort ? ` - ${playerShort}` : ""}`
          }
        </div>
      </div>

      {/* Bet Cards - Two Columns */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Over Side */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-200 dark:border-neutral-700/50">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              {extractPlayer(row.o?.name) || row.ev?.home?.abbr || "Side 1"}
            </div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
              {getSideLabel("over")}
            </div>
            
            {/* Book & Odds */}
            <div className="flex items-center gap-2 mb-3">
              {overLogo && (
                <img src={overLogo} alt={row.o?.bk || ''} className="h-5 w-5 object-contain rounded" />
              )}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                {formatOdds(overOdds)}
              </span>
              {row.o?.max != null && (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  (${Math.round(row.o.max)})
                </span>
              )}
            </div>
            
            {/* Bet Amount Input */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-xs">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customOver}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow empty string or valid numbers
                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                      setCustomOver(val);
                    }
                  }}
                  onBlur={() => {
                    // On blur, if empty, reset to default
                    if (customOver === "" || isNaN(parseFloat(customOver))) {
                      setCustomOver(Math.round(defaultSizes.over).toString());
                    }
                  }}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-5 pr-2 py-1.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                  placeholder={Math.round(defaultSizes.over).toString()}
                />
              </div>
            </div>
            
            {/* Bet Button */}
            <button
              onClick={() => openBet(row.o?.bk, row.o?.u, row.o?.m)}
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              BET
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Under Side */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-200 dark:border-neutral-700/50">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              {extractPlayer(row.u?.name) || row.ev?.away?.abbr || "Side 2"}
            </div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
              {getSideLabel("under")}
            </div>
            
            {/* Book & Odds */}
            <div className="flex items-center gap-2 mb-3">
              {underLogo && (
                <img src={underLogo} alt={row.u?.bk || ''} className="h-5 w-5 object-contain rounded" />
              )}
              <span className="text-rose-600 dark:text-rose-400 font-bold text-lg">
                {formatOdds(underOdds)}
              </span>
              {row.u?.max != null && (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  (${Math.round(row.u.max)})
                </span>
              )}
            </div>
            
            {/* Bet Amount Input */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-xs">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customUnder}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow empty string or valid numbers
                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                      setCustomUnder(val);
                    }
                  }}
                  onBlur={() => {
                    // On blur, if empty, reset to default
                    if (customUnder === "" || isNaN(parseFloat(customUnder))) {
                      setCustomUnder(Math.round(defaultSizes.under).toString());
                    }
                  }}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-5 pr-2 py-1.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand"
                  placeholder={Math.round(defaultSizes.under).toString()}
                />
              </div>
            </div>
            
            {/* Bet Button */}
            <button
              onClick={() => openBet(row.u?.bk, row.u?.u, row.u?.m)}
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              BET
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Footer - Payout & Actions */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => {
              openBet(row.o?.bk, row.o?.u, row.o?.m);
              setTimeout(() => openBet(row.u?.bk, row.u?.u, row.u?.m), 150);
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-brand transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Open Both Bets</span>
          </button>
          
          <div className="text-sm">
            <span className="text-neutral-500 dark:text-neutral-400">Payout </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              ~{formatAmount(Math.min(overPayout, underPayout))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

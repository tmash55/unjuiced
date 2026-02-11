"use client";

import React, { useMemo } from "react";
import { Calculator, ChevronDown, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { sportsbooks, getSportsbookById } from "@/lib/data/sportsbooks";
import type { ArbRow } from "@/lib/arb-schema";
import { SportIcon } from "@/components/icons/sport-icons";

// Build sportsbook map for quick lookup (using legacy `logo` field)
const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();
const logo = (id?: string) => SB_MAP.get(norm(id))?.logo;

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

// Calculate equal-profit bet sizes
const calculateBetSizes = (overOdds: number, underOdds: number, total: number) => {
  const overDec = overOdds > 0 ? 1 + overOdds / 100 : 1 + 100 / Math.abs(overOdds);
  const underDec = underOdds > 0 ? 1 + underOdds / 100 : 1 + 100 / Math.abs(underOdds);
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

interface CompactArbCardProps {
  row: ArbRow;
  totalBetAmount: number;
  isNew?: boolean;
  hasChange?: boolean;
  onOpenCalculator?: () => void;
  onShowWarning?: () => void;
}

export function CompactArbCard({ row, totalBetAmount, isNew, hasChange, onOpenCalculator, onShowWarning }: CompactArbCardProps) {
  const roiPct = ((row.roi_bps ?? 0) / 100);
  const isHighROI = roiPct > 10;
  const overOdds = Number(row.o?.od || 0);
  const underOdds = Number(row.u?.od || 0);
  
  const stakes = useMemo(() => calculateBetSizes(overOdds, underOdds, totalBetAmount), [overOdds, underOdds, totalBetAmount]);
  const profit = useMemo(() => {
    const overPayout = calculatePayout(overOdds, stakes.over);
    const underPayout = calculatePayout(underOdds, stakes.under);
    return Math.min(overPayout, underPayout) - (stakes.over + stakes.under);
  }, [overOdds, underOdds, stakes]);

  const overLogo = logo(row.o?.bk);
  const underLogo = logo(row.u?.bk);
  const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);
  
  // Get brand colors for bet buttons
  const overBrandColor = getSportsbookById(row.o?.bk || '')?.brandColor || '#10b981';
  const underBrandColor = getSportsbookById(row.u?.bk || '')?.brandColor || '#10b981';
  
  // Get side labels
  const getSideLabel = (side: "over" | "under") => {
    if (isMoneyline(row.mkt)) {
      return side === "over" ? (row.ev?.home?.abbr || "Home") : (row.ev?.away?.abbr || "Away");
    }
    if (isSpread(row.mkt)) {
      const raw = side === "over" ? (row.o?.name || "") : (row.u?.name || "");
      let out = raw;
      const homeName = row.ev?.home?.name || "";
      const awayName = row.ev?.away?.name || "";
      const homeAbbr = row.ev?.home?.abbr || homeName;
      const awayAbbr = row.ev?.away?.abbr || awayName;
      if (homeName) out = out.replace(new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), homeAbbr);
      if (awayName) out = out.replace(new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), awayAbbr);
      return out.replace(/\s+/g, " ").trim();
    }
    return side === "over" ? `O ${row.ln}` : `U ${row.ln}`;
  };

  const openBet = (e: React.MouseEvent, bk?: string, url?: string, mobileUrl?: string | null) => {
    e.stopPropagation();
    const link = getBookUrl(bk, url, mobileUrl);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Format time - compact
  const formatTime = () => {
    const d = row.ev?.dt ? new Date(row.ev.dt) : null;
    if (!d) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return time;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const gameTitle = `${row.ev?.away?.abbr || "Away"} @ ${row.ev?.home?.abbr || "Home"}`;

  return (
    <>
      <div className={cn(
        "bg-white dark:bg-neutral-900 rounded-xl overflow-hidden border transition-all duration-200 shadow-sm dark:shadow-none",
        isNew ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-neutral-200 dark:border-neutral-800",
        hasChange && !isNew && "ring-1 ring-amber-500/30"
      )}>
        {/* Header Row - Edge Finder style */}
        <div className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700/50">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Game Info */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-neutral-200 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300 shrink-0">
                <SportIcon sport={row.lg?.sport?.toLowerCase() || "basketball"} className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {row.lg?.name}
              </span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {gameTitle}
              </span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{formatTime()}</span>
            </div>
            
            {/* Right: Warning Icon (if high ROI) + ROI Badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isHighROI && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShowWarning?.(); }}
                  className="p-1 rounded-md bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                </button>
              )}
              <div className={cn(
                "px-2 py-1 rounded-lg text-xs font-bold tabular-nums",
                roiPct >= 3 
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                  : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              )}>
                +{roiPct.toFixed(1)}%
              </div>
            </div>
          </div>
          
          {/* Market & Player */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">
              {humanizeMarket(row.mkt)}
            </span>
            {player && (
              <>
                <span className="text-neutral-400 dark:text-neutral-600">•</span>
                <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{player}</span>
              </>
            )}
          </div>
        </div>

        {/* Body - Two Sides (Hero Section - Compact) */}
        <div className="px-3 py-2.5 flex items-stretch gap-2">
          {/* Bet A - Over Side */}
          <div
            className="flex-1 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg px-2.5 py-2 border-l-2"
            style={{ borderLeftColor: overBrandColor }}
          >
            <div className="flex items-center gap-2">
              {/* Book Logo */}
              {overLogo ? (
                <img src={overLogo} alt={row.o?.bk || ''} className="h-5 w-5 object-contain rounded shrink-0" />
              ) : (
                <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {/* Side & Line - Small */}
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">{getSideLabel("over")}</div>
                {/* Odds + Max - Hero */}
                <div className="flex items-baseline gap-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base tabular-nums">{formatOdds(overOdds)}</span>
                  {row.o?.max != null && (
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-600 tabular-nums">(${Math.round(row.o.max)})</span>
                  )}
                </div>
              </div>
            </div>
            {/* Bet Button - Subtle Pill */}
            <button
              onClick={(e) => openBet(e, row.o?.bk, row.o?.u, row.o?.m)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-150 active:scale-[0.97]"
            >
              Bet
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Bet B - Under Side */}
          <div
            className="flex-1 bg-neutral-50 dark:bg-neutral-800/40 rounded-lg px-2.5 py-2 border-l-2"
            style={{ borderLeftColor: underBrandColor }}
          >
            <div className="flex items-center gap-2">
              {/* Book Logo */}
              {underLogo ? (
                <img src={underLogo} alt={row.u?.bk || ''} className="h-5 w-5 object-contain rounded shrink-0" />
              ) : (
                <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {/* Side & Line - Small */}
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">{getSideLabel("under")}</div>
                {/* Odds + Max - Hero */}
                <div className="flex items-baseline gap-1">
                  <span className="text-rose-600 dark:text-rose-400 font-bold text-base tabular-nums">{formatOdds(underOdds)}</span>
                  {row.u?.max != null && (
                    <span className="text-[9px] text-neutral-400 dark:text-neutral-600 tabular-nums">(${Math.round(row.u.max)})</span>
                  )}
                </div>
              </div>
            </div>
            {/* Bet Button - Subtle Pill */}
            <button
              onClick={(e) => openBet(e, row.u?.bk, row.u?.u, row.u?.m)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-all duration-150 active:scale-[0.97]"
            >
              Bet
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Footer - Action Zone (Click to Split Bets) */}
        <button
          onClick={onOpenCalculator}
          className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border-t border-neutral-200 dark:border-neutral-700/50 flex items-center justify-between transition-colors group"
        >
          {/* Left: Stake */}
          <div className="text-left">
            <div className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Stake</div>
            <div className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">${Math.round(stakes.over + stakes.under)}</div>
          </div>
          
          {/* Center: Profit */}
          <div className="text-center">
            <div className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide font-medium">Profit</div>
            <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+${profit.toFixed(2)}</div>
          </div>
          
          {/* Right: Split Bets Button */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 dark:bg-brand/15 group-hover:bg-brand/20 dark:group-hover:bg-brand/25 transition-colors">
            <Calculator className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-semibold text-brand">Split Bets</span>
            <ChevronDown className="w-3 h-3 text-brand/60" />
          </div>
        </button>
      </div>
    </>
  );
}

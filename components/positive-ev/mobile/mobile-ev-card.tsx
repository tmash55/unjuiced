"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronUp, ExternalLink, EyeOff, Eye, Zap, Calculator, AlertTriangle } from "lucide-react";
import { Heart } from "@/components/icons/heart";
import { HeartFill } from "@/components/icons/heart-fill";
import { cn } from "@/lib/utils";
import type { PositiveEVOpportunity, DevigMethod } from "@/lib/ev/types";
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks";
import { getLeagueName } from "@/lib/data/sports";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { motion, AnimatePresence } from "framer-motion";
import { applyBoostToDecimalOdds } from "@/lib/utils/kelly";
import { ShareOddsButton } from "@/components/opportunities/share-odds-button";
import { ShareOddsCard } from "@/components/opportunities/share-odds-card";
import { useFavorites } from "@/hooks/use-favorites";
import { SportIcon } from "@/components/icons/sport-icons";
import { SHARP_PRESETS } from "@/lib/ev/constants";
import { impliedProbToAmerican } from "@/lib/ev/devig";

const EXTREME_EV_THRESHOLD = 100;
const EXTREME_EV_WARNING =
  "This large +EV likely exists because the player is expected to sit out. Prediction markets (Polymarket, Kalshi) may have already priced this in. Review their terms before placing bets on +EV this large.";

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Helper to get sportsbook name
const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

// Format odds with + prefix for positive
const formatOdds = (price: number | string | undefined): string => {
  if (price === undefined || price === null) return "—";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "—";
  return num > 0 ? `+${Math.round(num)}` : `${Math.round(num)}`;
};

// Get color for EV percentage
function getEVColor(ev: number | null): string {
  if (ev === null) return "text-neutral-500";
  if (ev >= 10) return "text-emerald-500 dark:text-emerald-400";
  if (ev >= 5) return "text-green-500 dark:text-green-400";
  if (ev >= 2) return "text-blue-500 dark:text-blue-400";
  return "text-neutral-600 dark:text-neutral-400";
}

// Get background color for EV badge
function getEVBgColor(ev: number | null): string {
  if (ev === null) return "bg-neutral-100 dark:bg-neutral-800";
  if (ev >= 10) return "bg-emerald-500/15 dark:bg-emerald-500/20";
  if (ev >= 5) return "bg-green-500/15 dark:bg-green-500/20";
  if (ev >= 2) return "bg-blue-500/15 dark:bg-blue-500/20";
  return "bg-neutral-100 dark:bg-neutral-800";
}

// Format time relative to now
function formatGameTime(gameStart: string | null | undefined): string {
  if (!gameStart) return "—";
  const start = new Date(gameStart);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 0) return "Live";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h`;
  }
  // Show day of week + time
  return start.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

interface MobileEVCardProps {
  opportunity: PositiveEVOpportunity;
  onBetClick?: (opportunity: PositiveEVOpportunity) => void;
  onPlayerClick?: (opportunity: PositiveEVOpportunity) => void;
  onHide?: (opportunity: PositiveEVOpportunity) => void;
  onUnhide?: (opportunity: PositiveEVOpportunity) => void;
  isHidden?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  bankroll?: number;
  kellyPercent?: number;
  boostPercent?: number;
  evCase?: "worst" | "best";
  selectedDevigMethods?: DevigMethod[];
  selectedBooks?: string[];
}

export function MobileEVCard({
  opportunity,
  onBetClick,
  onPlayerClick,
  onHide,
  onUnhide,
  isHidden = false,
  isExpanded = false,
  onToggleExpand,
  bankroll = 0,
  kellyPercent = 25,
  boostPercent = 0,
  evCase = "worst",
  selectedDevigMethods = ["power", "multiplicative"],
  selectedBooks = [],
}: MobileEVCardProps) {
  const opp = opportunity;
  
  // Favorites state
  const [isToggling, setIsToggling] = useState(false);
  const { toggleFavorite, isFavorited, isLoggedIn } = useFavorites();
  
  // Check if this opportunity is favorited
  const isFav = isFavorited({
    event_id: opp.eventId,
    type: opp.playerName ? 'player' : 'game',
    player_id: opp.playerId || null,
    market: opp.market,
    line: opp.line ?? null,
    side: opp.side,
  });
  
  // Handle toggle favorite
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn || isToggling) return;
    
    setIsToggling(true);
    try {
      // Convert allBooks to books_snapshot format
      const booksSnapshot: Record<string, { price: number; u?: string | null; m?: string | null; sgp?: string | null }> = {};
      for (const book of opp.allBooks || []) {
        booksSnapshot[book.bookId] = {
          price: book.price,
          u: book.link ?? null,
          m: book.mobileLink ?? null,
          sgp: book.sgp ?? null,
        };
      }
      
      // Build odds_key for Redis lookups: odds:{sport}:{eventId}:{market}
      const oddsKey = `odds:${opp.sport}:${opp.eventId}:${opp.market}`;
      
      await toggleFavorite({
        type: opp.playerName ? 'player' : 'game',
        sport: opp.sport,
        event_id: opp.eventId,
        game_date: opp.gameDate || null,
        home_team: opp.homeTeam || null,
        away_team: opp.awayTeam || null,
        start_time: opp.startTime || null,
        player_id: opp.playerId || null,
        player_name: opp.playerName || null,
        player_team: opp.playerTeam || null,
        player_position: opp.playerPosition || null,
        market: opp.market,
        line: opp.line ?? null,
        side: opp.side,
        odds_key: oddsKey,
        odds_selection_id: opp.id,
        books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
        best_price_at_save: opp.book.price,
        best_book_at_save: opp.book.bookId || null,
        source: 'positive_ev_mobile',
      });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsToggling(false);
    }
  };
  
  // Get EV based on case selection
  const baseEV = evCase === "best" ? opp.evCalculations.evBest : opp.evCalculations.evWorst;
  const displayEV = boostPercent > 0 ? baseEV * (1 + boostPercent / 100) : baseEV;
  
  const calculateBoostedEV = useCallback((baseEV: number, decimalOdds: number, fairProb: number, boost: number) => {
    if (boost <= 0) return baseEV;
    const boostedOdds = applyBoostToDecimalOdds(decimalOdds, boost);
    return (fairProb * boostedOdds - 1) * 100;
  }, []);

  // Calculate recommended stake (match desktop logic)
  const recStakeDisplay = useMemo(() => {
    if (bankroll <= 0) return null;

    const baseEV = evCase === "best" ? opp.evCalculations.evBest : opp.evCalculations.evWorst;
    const decimalOdds = opp.book.priceDecimal || (opp.book.price > 0 ? 1 + opp.book.price / 100 : 1 + 100 / Math.abs(opp.book.price));
    const fairProbability = opp.evCalculations.power?.fairProb 
      || opp.evCalculations.multiplicative?.fairProb 
      || opp.evCalculations.additive?.fairProb 
      || opp.evCalculations.probit?.fairProb 
      || 0;
    const displayEV = boostPercent > 0
      ? calculateBoostedEV(baseEV, decimalOdds, fairProbability, boostPercent)
      : baseEV;

    const effectiveDecimalOdds = boostPercent > 0 
      ? applyBoostToDecimalOdds(decimalOdds, boostPercent)
      : decimalOdds;

    if (displayEV <= 0 || effectiveDecimalOdds <= 1) return null;

    const fullKellyPct = (displayEV / 100) / (effectiveDecimalOdds - 1) * 100;
    if (fullKellyPct <= 0 || !isFinite(fullKellyPct)) return null;

    const fractionalKellyPct = fullKellyPct * (kellyPercent / 100);
    const stake = bankroll * (fractionalKellyPct / 100);

    if (stake < 0.5) return "<$1";
    if (stake < 10) return `$${Math.round(stake)}`;
    if (stake < 100) return `$${Math.round(stake / 5) * 5}`;
    return `$${Math.round(stake / 10) * 10}`;
  }, [bankroll, kellyPercent, boostPercent, evCase, opp, calculateBoostedEV]);
  
  // Get best book info
  const bestBookInfo = getSportsbookById(opp.book.bookId);
  const bestBookLogo = getBookLogo(opp.book.bookId);
  
  // Determine if this is a player prop
  const isPlayerProp = !!opp.playerName;
  
  // Format the selection display
  const selectionDisplay = isPlayerProp 
    ? opp.playerName 
    : `${opp.awayTeam} @ ${opp.homeTeam}`;
  
  // Format the market display
  const marketDisplay = formatMarketLabelShort(opp.market) || opp.marketDisplay || opp.market?.replace(/_/g, " ");

  const referenceLabel = useMemo(() => {
    const modelName = (opp as PositiveEVOpportunity & { modelName?: string }).modelName;
    const presetLabel = opp.sharpPreset && opp.sharpPreset in SHARP_PRESETS
      ? SHARP_PRESETS[opp.sharpPreset as keyof typeof SHARP_PRESETS].label
      : opp.sharpPreset;
    let label = modelName || presetLabel || "Market Average";
    if (label.toLowerCase().startsWith("vs ")) {
      label = label.slice(3);
    }
    return label;
  }, [opp]);

  const shareText = useMemo(() => {
    const bestBookName = getBookName(opp.book.bookId) || opp.book.bookName || opp.book.bookId;
    const bestOdds = formatOdds(opp.book.price);
    const sideLabel = opp.side === "over" ? "Over" : opp.side === "under" ? "Under" : opp.side === "yes" ? "Yes" : "No";
    const linePart = opp.line !== undefined && opp.line !== null ? ` ${opp.line}` : "";
    const selectionLine = `${sideLabel}${linePart}`;

    let fairOdds = "";
    const devigResult = opp.devigResults?.power || opp.devigResults?.multiplicative || opp.devigResults?.additive;
    if (devigResult?.success) {
      const fairProb = opp.side === "over" || opp.side === "yes" ? devigResult.fairProbOver : devigResult.fairProbUnder;
      if (fairProb > 0 && fairProb < 1) {
        const fairAmerican = impliedProbToAmerican(fairProb);
        fairOdds = `${fairAmerican > 0 ? "+" : ""}${Math.round(fairAmerican)}`;
      }
    }

    const oddsComparison = fairOdds
      ? `${bestBookName} ${bestOdds} vs ${fairOdds} (${referenceLabel})`
      : `${bestBookName} ${bestOdds} (${referenceLabel})`;

    return [
      `${selectionDisplay}`,
      `${selectionLine} ${marketDisplay}`,
      oddsComparison,
      "unjuiced.bet",
    ].join("\n");
  }, [opp, referenceLabel, selectionDisplay, marketDisplay]);
  
  // Determine if this is a binary/yes-no market
  // Single-line scorer markets (first/last TD, first/last goal, first basket) - ALWAYS yes/no
  const isScorerMarket = (
    opp.market.includes("first_td") ||
    opp.market.includes("last_td") ||
    opp.market.includes("first_touchdown") ||
    opp.market.includes("first_goal") ||
    opp.market.includes("last_goal") ||
    opp.market.includes("first_basket") ||
    opp.market.includes("goalscorer") ||
    opp.market.includes("first_field_goal")
  );
  // Other binary markets require line === 0.5
  const isBinaryMarket = isScorerMarket || (opp.line === 0.5 && (
    opp.market.includes("double_double") ||
    opp.market.includes("triple_double") ||
    opp.market.includes("to_score") ||
    opp.market.includes("anytime") ||
    opp.market.includes("to_record") ||
    opp.market.includes("overtime") ||
    opp.market.includes("player_touchdowns") ||
    opp.market.includes("player_goals")
  ));
  
  const sideDisplay = opp.side === "yes" ? "Yes" : 
    opp.side === "no" ? "No" :
    isBinaryMarket ? (opp.side === "over" ? "Yes" : "No") :
    opp.side === "over" ? "o" : opp.side === "under" ? "u" : opp.side;
  const lineDisplay = isBinaryMarket ? "" : (opp.line !== undefined && opp.line !== null ? opp.line : "");
  
  // Get method that produced the displayed EV for the badge
  // This matches the desktop logic - find which method actually gave the min/max EV
  const usedMethod = useMemo(() => {
    const methodEVs: { method: string; ev: number }[] = [];
    
    if (selectedDevigMethods.includes("power") && opp.evCalculations.power?.evPercent !== undefined) {
      methodEVs.push({ method: "pwr", ev: opp.evCalculations.power.evPercent });
    }
    if (selectedDevigMethods.includes("multiplicative") && opp.evCalculations.multiplicative?.evPercent !== undefined) {
      methodEVs.push({ method: "mult", ev: opp.evCalculations.multiplicative.evPercent });
    }
    if (selectedDevigMethods.includes("additive") && opp.evCalculations.additive?.evPercent !== undefined) {
      methodEVs.push({ method: "add", ev: opp.evCalculations.additive.evPercent });
    }
    if (selectedDevigMethods.includes("probit") && opp.evCalculations.probit?.evPercent !== undefined) {
      methodEVs.push({ method: "prb", ev: opp.evCalculations.probit.evPercent });
    }
    
    if (methodEVs.length === 0) return "pwr";
    
    // Sort by EV - for best case take highest, for worst case take lowest
    methodEVs.sort((a, b) => evCase === "best" ? b.ev - a.ev : a.ev - b.ev);
    return methodEVs[0].method;
  }, [opp.evCalculations, selectedDevigMethods, evCase]);
  
  return (
    <div className={cn(
      "mx-3 mb-2 rounded-xl overflow-hidden",
      "bg-white dark:bg-neutral-900",
      "border border-neutral-200/80 dark:border-neutral-800",
      "transition-all duration-200",
      isHidden && "opacity-40 bg-neutral-100/50 dark:bg-neutral-800/30"
    )}>
      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/60 dark:to-neutral-800/30 border-b border-neutral-100 dark:border-neutral-800/50">
        {/* Row 1: Sport + Game + Time + EV */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Sport + Game + Time */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 text-[9px]">
            <SportIcon sport={opp.sport} className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-bold text-neutral-600 dark:text-neutral-300 uppercase shrink-0">
              {getLeagueName(opp.sport)}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-neutral-500 dark:text-neutral-400 truncate">
              {opp.awayTeam} @ {opp.homeTeam}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600 shrink-0">•</span>
            <span className="text-neutral-400 dark:text-neutral-500 shrink-0">
              {formatGameTime(opp.startTime)}
            </span>
          </div>
          
          {/* Right: EV Badge + Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "px-2 py-1 rounded-full flex items-center justify-center gap-1",
              displayEV >= EXTREME_EV_THRESHOLD
                ? "bg-amber-500/20 ring-1 ring-amber-400/50"
                : cn(getEVBgColor(displayEV), boostPercent > 0 && "ring-1 ring-amber-400/50")
            )}>
              {displayEV >= EXTREME_EV_THRESHOLD ? (
                <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
              ) : boostPercent > 0 ? (
                <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              ) : null}
              <span className={cn(
                "text-[10px] font-bold tabular-nums leading-none",
                displayEV >= EXTREME_EV_THRESHOLD ? "text-amber-600 dark:text-amber-400" : getEVColor(displayEV)
              )}>
                +{displayEV.toFixed(1)}%
              </span>
              <span className="text-[8px] text-neutral-400 dark:text-neutral-500 uppercase">
                {usedMethod}
              </span>
            </div>
            
            {/* Add to Betslip Button */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={!isLoggedIn || isToggling}
              data-no-row-toggle="true"
              className={cn(
                "p-1.5 rounded-lg transition-all",
                !isLoggedIn && "opacity-50 cursor-not-allowed",
                isFav 
                  ? "bg-red-500/10 hover:bg-red-500/20" 
                  : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
              title={!isLoggedIn ? "Sign in to save plays" : isFav ? "Remove from My Plays" : "Add to My Plays"}
            >
              {isToggling ? (
                <HeartFill className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              ) : isFav ? (
                <HeartFill className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Heart className="w-3.5 h-3.5 text-neutral-400 hover:text-red-400" />
              )}
            </button>
            
            {/* Hide/Unhide toggle */}
            {isHidden && onUnhide ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnhide(opp);
                }}
                className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors"
                title="Unhide"
              >
                <Eye className="w-3 h-3 text-neutral-400" />
              </button>
            ) : onHide ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(opp);
                }}
                className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors"
                title="Hide"
              >
                <EyeOff className="w-3 h-3 text-neutral-400" />
              </button>
            ) : null}
          </div>
        </div>
        
        {/* Row 2: Market */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
            {marketDisplay}
          </span>
        </div>
      </div>
      
      {/* Extreme EV warning banner */}
      {displayEV >= EXTREME_EV_THRESHOLD && (
        <div className="mx-3 mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-tight text-amber-700 dark:text-amber-400">
            {EXTREME_EV_WARNING}
          </p>
        </div>
      )}

      {/* Main Content - Tappable to expand */}
      <div 
        className="px-3 py-2.5 cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
        onClick={onToggleExpand}
      >
        {/* Player/Selection + Line + Share */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {isPlayerProp ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayerClick?.(opp);
                }}
                className="text-left"
              >
                <span className="text-[15px] font-bold text-neutral-900 dark:text-white hover:text-brand transition-colors leading-tight">
                  {opp.playerName}
                </span>
              </button>
            ) : (
              <span className="text-[15px] font-bold text-neutral-900 dark:text-white leading-tight">
                {selectionDisplay}
              </span>
            )}
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {sideDisplay} {lineDisplay}
            </span>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <ShareOddsButton
              showOnMobile
              toastOnCopy
              shareText={shareText}
              className="h-7 w-7 p-1.5"
              shareContent={
                <ShareOddsCard
                  playerName={selectionDisplay || ""}
                  market={marketDisplay || opp.market || ""}
                  sport={opp.sport.toUpperCase()}
                  line={opp.line ?? 0}
                  side={opp.side}
                  bestBookId={opp.book.bookId}
                  bestOdds={formatOdds(opp.book.price)}
                  edgePercent={(() => {
                    const evCalc = opp.evCalculations?.power || opp.evCalculations?.multiplicative;
                    return evCalc?.evPercent ?? 0;
                  })()}
                  fairOdds={(() => {
                    const devigResult = opp.devigResults?.power || opp.devigResults?.multiplicative || opp.devigResults?.additive;
                    if (!devigResult?.success) return null;
                    const fairProb = opp.side === "over" || opp.side === "yes" ? devigResult.fairProbOver : devigResult.fairProbUnder;
                    if (!fairProb || fairProb <= 0 || fairProb >= 1) return null;
                    const fairAmerican = impliedProbToAmerican(fairProb);
                    return `${fairAmerican > 0 ? "+" : ""}${Math.round(fairAmerican)}`;
                  })()}
                  sharpOdds={formatOdds(opp.sharpReference?.overOdds)}
                  referenceLabel={referenceLabel}
                  eventLabel={opp.awayTeam && opp.homeTeam ? `${opp.awayTeam} @ ${opp.homeTeam}` : undefined}
                  timeLabel={opp.startTime || opp.gameDate || undefined}
                  overBooks={(opp.side === "over" ? opp.allBooks : opp.oppositeBooks || []).map((b) => ({
                    bookId: b.bookId,
                    price: b.price,
                  }))}
                  underBooks={(opp.side === "under" ? opp.allBooks : opp.oppositeBooks || []).map((b) => ({
                    bookId: b.bookId,
                    price: b.price,
                  }))}
                  accent="emerald"
                />
              }
            />
          </div>
        </div>
        
        {/* Action Row - Odds left, BET right */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Book(s) + Odds + Expand indicator */}
          <div className="flex items-center gap-2">
            {/* Overlapping logos for tied books */}
            {(() => {
              const bestEV = opp.book.evPercent ?? displayEV;
              const selectedBooksSet = selectedBooks && selectedBooks.length > 0 
                ? new Set(selectedBooks.map(b => normalizeSportsbookId(b)))
                : null;
              const allTiedBooks = opp.allBooks
                .filter(b => {
                  if (b.isSharpRef) return false;
                  if (Math.abs((b.evPercent ?? 0) - bestEV) >= 0.01) return false;
                  // Filter by selected books if any are selected
                  if (selectedBooksSet) {
                    const normalizedId = normalizeSportsbookId(b.bookId);
                    if (!selectedBooksSet.has(normalizedId)) return false;
                  }
                  return true;
                });
              const tiedBooks = allTiedBooks.slice(0, 3); // Max 3 for mobile
              const extraCount = allTiedBooks.length - 3;
              
              if (tiedBooks.length <= 1) {
                // Single book - show as before
                return bestBookLogo ? (
                  <img 
                    src={bestBookLogo} 
                    alt={bestBookInfo?.name || opp.book.bookId} 
                    className="w-5 h-5 rounded object-contain"
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                );
              }
              
              // Multiple tied books - show overlapping
              return (
                <div className="flex items-center -space-x-1.5">
                  {tiedBooks.map((book, idx) => {
                    const logo = getBookLogo(book.bookId);
                    if (!logo) return null;
                    return (
                      <div 
                        key={book.bookId}
                        className="relative flex-shrink-0 ring-1 ring-white dark:ring-neutral-900 rounded"
                        style={{ zIndex: tiedBooks.length - idx }}
                      >
                        <img 
                          src={logo} 
                          alt={getBookName(book.bookId) || book.bookId} 
                          className="w-5 h-5 object-contain rounded bg-white dark:bg-neutral-800"
                        />
                      </div>
                    );
                  })}
                  {extraCount > 0 && (
                    <div 
                      className="relative flex-shrink-0 ring-1 ring-white dark:ring-neutral-900 rounded w-5 h-5 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
                      style={{ zIndex: 0 }}
                    >
                      <span className="text-[8px] font-bold text-neutral-600 dark:text-neutral-300">+{extraCount}</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
              {formatOdds(opp.book.price)}
            </span>
            {/* Limits display */}
            {opp.book.limits?.max && (
              <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
                Max ${opp.book.limits.max >= 1000 ? `${(opp.book.limits.max / 1000).toFixed(0)}k` : opp.book.limits.max}
              </span>
            )}
            {/* Expand indicator */}
            <div className={cn(
              "p-1 rounded transition-colors",
              isExpanded 
                ? "bg-neutral-200 dark:bg-neutral-700" 
                : "bg-neutral-100 dark:bg-neutral-800"
            )}>
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              )}
            </div>
          </div>
          
          {/* Right: Rec Stake + Bet Button */}
          <div className="flex items-center gap-2">
            {recStakeDisplay && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5">
                {boostPercent > 0 && <Zap className="w-3 h-3 text-amber-500" />}
                <span className="text-[9px] uppercase">Rec </span>
                <span className={cn(
                  "font-bold tabular-nums",
                  boostPercent > 0 
                    ? "text-amber-600 dark:text-amber-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )}>{recStakeDisplay}</span>
              </span>
            )}

            {/* Bet Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBetClick?.(opp);
              }}
              className={cn(
                "flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg",
                "bg-brand text-white text-xs font-bold",
                "hover:bg-brand/90 active:scale-[0.97] transition-all duration-150"
              )}
            >
              <span>BET</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded Section - All Odds Comparison */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-neutral-200/60 dark:border-neutral-800"
          >
            <div className="px-3 py-2.5 bg-neutral-50/50 dark:bg-neutral-950/30">
              {/* Fair Odds + Method Info */}
              <div className="flex items-center justify-between gap-3 mb-2 px-1">
                {/* Sharp Reference */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">
                    Sharp
                  </span>
                  <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {formatOdds(opp.sharpReference.overOdds)}
                  </span>
                </div>
                
                {/* Fair Odds */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">
                    Fair
                  </span>
                  <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatOdds(
                      opp.side === "over" 
                        ? (opp.devigResults?.power?.fairProbOver ?? 0.5) >= 0.5
                          ? Math.round(-100 * (opp.devigResults?.power?.fairProbOver ?? 0.5) / (1 - (opp.devigResults?.power?.fairProbOver ?? 0.5)))
                          : Math.round(100 * (1 - (opp.devigResults?.power?.fairProbOver ?? 0.5)) / (opp.devigResults?.power?.fairProbOver ?? 0.5))
                        : (opp.devigResults?.power?.fairProbUnder ?? 0.5) >= 0.5
                          ? Math.round(-100 * (opp.devigResults?.power?.fairProbUnder ?? 0.5) / (1 - (opp.devigResults?.power?.fairProbUnder ?? 0.5)))
                          : Math.round(100 * (1 - (opp.devigResults?.power?.fairProbUnder ?? 0.5)) / (opp.devigResults?.power?.fairProbUnder ?? 0.5))
                    )}
                  </span>
                </div>
                
                {/* EV by method */}
                <div className="flex items-center gap-1">
                  {opp.evCalculations.power && (
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      selectedDevigMethods.includes("power") ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    )}>
                      P: +{opp.evCalculations.power.evPercent.toFixed(1)}%
                    </span>
                  )}
                  {opp.evCalculations.multiplicative && (
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      selectedDevigMethods.includes("multiplicative") ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    )}>
                      M: +{opp.evCalculations.multiplicative.evPercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              {/* Book Comparison - Over/Under side-by-side or single side grid */}
              {(opp.side === "over" || opp.side === "under") && opp.oppositeBooks && opp.oppositeBooks.length > 0 ? (
                <>
                  {/* Over/Under Comparison Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      Over {opp.line}
                    </span>
                    <span className="text-[8px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">
                      Book
                    </span>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Under {opp.line}
                    </span>
                  </div>
                  
                  {/* Over/Under Rows - Logo in center */}
                  <div className="space-y-1">
                    {(() => {
                      // Combine books from both sides, matching by bookId
                      const overBooks = opp.side === "over" ? opp.allBooks : opp.oppositeBooks;
                      const underBooks = opp.side === "under" ? opp.allBooks : opp.oppositeBooks;
                      
                      // Get all unique book IDs
                      const allBookIds = new Set([
                        ...overBooks.map(b => b.bookId),
                        ...underBooks.map(b => b.bookId)
                      ]);
                      
                      // Find best books for each side
                      const bestOverBook = overBooks.reduce((best, b) => !best || b.price > best.price ? b : best, null as typeof overBooks[0] | null);
                      const bestUnderBook = underBooks.reduce((best, b) => !best || b.price > best.price ? b : best, null as typeof underBooks[0] | null);
                      
                      // Create paired rows sorted by over price (best first)
                      const pairedBooks = Array.from(allBookIds).map(bookId => ({
                        bookId,
                        over: overBooks.find(b => b.bookId === bookId),
                        under: underBooks.find(b => b.bookId === bookId),
                      })).sort((a, b) => {
                        const aPrice = a.over?.price ?? -9999;
                        const bPrice = b.over?.price ?? -9999;
                        return bPrice - aPrice;
                      });
                      
                      return pairedBooks.map((pair, idx) => {
                        const bookInfo = getSportsbookById(pair.bookId);
                        const bookLogo = getBookLogo(pair.bookId);
                        const isBestOver = pair.over && bestOverBook && pair.over.price === bestOverBook.price;
                        const isBestUnder = pair.under && bestUnderBook && pair.under.price === bestUnderBook.price;
                        
                        return (
                          <div 
                            key={`${pair.bookId}-${idx}`}
                            className="flex items-center gap-1"
                          >
                            {/* Over Side */}
                            <button
                              type="button"
                              onClick={() => {
                                const link = pair.over?.mobileLink || pair.over?.link;
                                if (link) window.open(link, "_blank");
                              }}
                              disabled={!pair.over}
                              className={cn(
                                "flex-1 flex items-center justify-end px-2 py-1.5 rounded-lg",
                                "transition-all duration-100 active:scale-[0.98]",
                                !pair.over && "opacity-40 cursor-not-allowed",
                                isBestOver 
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60"
                                  : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800"
                              )}
                            >
                              <span className={cn(
                                "text-[12px] font-bold tabular-nums",
                                isBestOver ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {pair.over ? formatOdds(pair.over.price) : "—"}
                              </span>
                            </button>
                            
                            {/* Center Logo */}
                            <div className="w-7 h-7 flex items-center justify-center shrink-0">
                              {bookLogo ? (
                                <img 
                                  src={bookLogo} 
                                  alt={bookInfo?.name || pair.bookId} 
                                  className="w-6 h-6 rounded object-contain"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-neutral-500">{pair.bookId.slice(0, 2).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Under Side */}
                            <button
                              type="button"
                              onClick={() => {
                                const link = pair.under?.mobileLink || pair.under?.link;
                                if (link) window.open(link, "_blank");
                              }}
                              disabled={!pair.under}
                              className={cn(
                                "flex-1 flex items-center justify-start px-2 py-1.5 rounded-lg",
                                "transition-all duration-100 active:scale-[0.98]",
                                !pair.under && "opacity-40 cursor-not-allowed",
                                isBestUnder 
                                  ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-300/60 dark:border-blue-800/60"
                                  : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800"
                              )}
                            >
                              <span className={cn(
                                "text-[12px] font-bold tabular-nums",
                                isBestUnder ? "text-blue-600 dark:text-blue-400" : "text-neutral-900 dark:text-white"
                              )}>
                                {pair.under ? formatOdds(pair.under.price) : "—"}
                              </span>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {/* Single Side Grid (for yes/no markets or missing opposite side) */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      Compare Odds
                    </span>
                    <span className="text-[9px] text-neutral-400">
                      {opp.allBooks.length} book{opp.allBooks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1">
                    {opp.allBooks.map((book, idx) => {
                      const bookInfo = getSportsbookById(book.bookId);
                      const bookLogo = getBookLogo(book.bookId);
                      const isBest = book.bookId === opp.book.bookId;
                      
                      return (
                        <button
                          key={`${book.bookId}-${idx}`}
                          type="button"
                          onClick={() => {
                            const link = book.mobileLink || book.link;
                            if (link) window.open(link, "_blank");
                          }}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded-lg",
                            "transition-all duration-100 active:scale-[0.98]",
                            isBest 
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60"
                              : "bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800"
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {bookLogo ? (
                              <img 
                                src={bookLogo} 
                                alt={bookInfo?.name || book.bookId} 
                                className="w-4 h-4 rounded object-contain shrink-0"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded bg-neutral-300 dark:bg-neutral-600 shrink-0" />
                            )}
                            <span className={cn(
                              "text-[10px] font-medium truncate",
                              isBest ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-600 dark:text-neutral-300"
                            )}>
                              {bookInfo?.name || book.bookId}
                            </span>
                          </div>
                          <div className="flex flex-col items-end shrink-0 ml-1">
                            <span className={cn(
                              "text-[11px] font-bold tabular-nums",
                              isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {formatOdds(book.price)}
                            </span>
                            {book.limits?.max && (
                              <span className="text-[8px] text-neutral-400">
                                Max ${book.limits.max >= 1000 ? `${(book.limits.max / 1000).toFixed(0)}k` : book.limits.max}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

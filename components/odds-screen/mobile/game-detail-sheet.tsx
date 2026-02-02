"use client";

import React, { useState, useMemo, useCallback } from "react";
import { X, ChevronRight, RefreshCw, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import type { OddsScreenItem, OddsScreenEvent, OddsPrice } from "../types/odds-screen-types";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { MarketChips, getDefaultMarketForType } from "./market-chips";
import { OddsSheet } from "./odds-sheet";
import { AlternatesSheet } from "./alternates-sheet";
import { fetchOddsWithNewAPI } from "@/lib/api-adapters/props-to-odds";
import { useFavorites, AddFavoriteParams, BookSnapshot } from "@/hooks/use-favorites";

interface GameDetailSheetProps {
  game: OddsScreenEvent;
  moneylineItem?: OddsScreenItem;  // Optional moneyline data for initial display
  sport: string;
  scope: "pregame" | "live";
  isOpen: boolean;
  onClose: () => void;
}

// Format American odds
function formatOdds(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
}

// Format line with sign for spreads
function formatSpreadLine(line: number | undefined): string {
  if (line === undefined) return "";
  return line >= 0 ? `+${line}` : `${line}`;
}

// Format time
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { 
    hour: "numeric", 
    minute: "2-digit",
    hour12: true,
  }).replace(" ", "");
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Check if sport has team logos
function hasTeamLogos(sport: string): boolean {
  const sportsWithLogos = ["nfl", "nhl", "nba", "mlb"];
  return sportsWithLogos.includes(sport.toLowerCase());
}

// Get team logo URL
function getTeamLogoUrl(teamName: string, sport: string): string {
  if (!teamName) return "";
  const abbr = getStandardAbbreviation(teamName, sport);
  return `/team-logos/${sport}/${abbr.toUpperCase()}.svg`;
}

// Get sportsbook logo
function getBookLogo(bookId: string): string | null {
  const book = getSportsbookById(bookId);
  return book?.image?.square || book?.image?.light || null;
}

// Check if sport has player props
function hasPlayerProps(sport: string): boolean {
  const sportsWithoutPlayerProps = ["ncaab", "mlb", "wnba"];
  return !sportsWithoutPlayerProps.includes(sport.toLowerCase());
}

export function GameDetailSheet({ game, moneylineItem, sport, scope, isOpen, onClose }: GameDetailSheetProps) {
  const [type, setType] = useState<"game" | "player">("game");
  const [selectedMarket, setSelectedMarket] = useState<string>("game_moneyline");
  const [selectedOdds, setSelectedOdds] = useState<{ item: OddsScreenItem; side: "over" | "under" } | null>(null);
  const [selectedAlternates, setSelectedAlternates] = useState<OddsScreenItem | null>(null);

  const showLogos = hasTeamLogos(sport);
  const sportHasPlayerProps = hasPlayerProps(sport);

  // Handle type toggle
  const handleTypeChange = (newType: "game" | "player") => {
    setType(newType);
    setSelectedMarket(getDefaultMarketForType(sport, newType));
  };

  // Fetch market data on demand
  const { data: marketData, isLoading, refetch } = useQuery({
    queryKey: ["odds-market", sport, game.id, selectedMarket, scope],
    queryFn: async () => {
      const result = await fetchOddsWithNewAPI({
        sport,
        market: selectedMarket,
        scope,
        type,
        limit: 200,
      });
      // Filter to only items for this game
      return result.data.filter(item => item.event?.id === game.id);
    },
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Use moneyline item if we're showing moneyline and have it, otherwise use fetched data
  const displayItems = useMemo(() => {
    if (selectedMarket === "game_moneyline" && moneylineItem) {
      return [moneylineItem];
    }
    return marketData || [];
  }, [selectedMarket, moneylineItem, marketData]);

  // Handle tapping on an odds row
  const handleOddsTap = (item: OddsScreenItem, side: "over" | "under") => {
    setSelectedOdds({ item, side });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet - takes most of screen */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-3xl h-[92vh] flex flex-col"
          >
            {/* Drag Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Game Header */}
            <div className="px-5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                {/* Teams */}
                <div className="flex items-center gap-3">
                  {showLogos && (
                    <div className="flex items-center gap-1">
                      <img
                        src={getTeamLogoUrl(game.awayTeam, sport)}
                        alt={game.awayTeam}
                        className="w-8 h-8 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="text-neutral-400 dark:text-neutral-500 text-sm">@</span>
                      <img
                        src={getTeamLogoUrl(game.homeTeam, sport)}
                        alt={game.homeTeam}
                        className="w-8 h-8 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {game.awayTeam} @ {game.homeTeam}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(game.startTime)} • {formatTime(game.startTime)}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors active:scale-[0.95]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Props Toggle */}
            {sportHasPlayerProps && (
              <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
                  <button
                    onClick={() => handleTypeChange("game")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                      type === "game"
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    Game Props
                  </button>
                  <button
                    onClick={() => handleTypeChange("player")}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                      type === "player"
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    Player Props
                  </button>
                </div>
              </div>
            )}

            {/* Market Chips */}
            <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
              <MarketChips
                sport={sport}
                type={type}
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
              />
            </div>

            {/* Odds Content */}
            <div className="flex-1 overflow-y-auto pb-safe">
              {isLoading && selectedMarket !== "game_moneyline" ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400 text-center">
                    Loading odds...
                  </p>
                </div>
              ) : type === "game" ? (
                <GamePropsContent
                  items={displayItems}
                  game={game}
                  sport={sport}
                  selectedMarket={selectedMarket}
                  onOddsTap={handleOddsTap}
                />
              ) : (
                <PlayerPropsContent
                  items={displayItems}
                  game={game}
                  sport={sport}
                  selectedMarket={selectedMarket}
                  onOddsTap={handleOddsTap}
                  onAltTap={setSelectedAlternates}
                />
              )}
            </div>
          </motion.div>

          {/* Nested OddsSheet for all books */}
          {selectedOdds && (
            <OddsSheet
              item={selectedOdds.item}
              side={selectedOdds.side}
              sport={sport}
              market={selectedMarket}
              event={game}
              isOpen={!!selectedOdds}
              onClose={() => setSelectedOdds(null)}
            />
          )}

          {/* Alternates Sheet for player props */}
          {selectedAlternates && (
            <AlternatesSheet
              item={selectedAlternates}
              sport={sport}
              market={selectedMarket}
              isOpen={!!selectedAlternates}
              onClose={() => setSelectedAlternates(null)}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}

// Game Props Content
interface GamePropsContentProps {
  items: OddsScreenItem[];
  game: OddsScreenEvent;
  sport: string;
  selectedMarket: string;
  onOddsTap: (item: OddsScreenItem, side: "over" | "under") => void;
}

function GamePropsContent({ items, game, sport, selectedMarket, onOddsTap }: GamePropsContentProps) {
  const showLogos = hasTeamLogos(sport);
  const { toggleFavorite, isFavorited, isToggling, isLoggedIn } = useFavorites();

  // Find the item for this market (game props usually have one item per market)
  const item = items[0];

  // Build favorite params helper
  const buildFavoriteParams = useCallback((
    oddsItem: OddsScreenItem,
    side: "over" | "under"
  ): AddFavoriteParams | null => {
    const sideOdds = oddsItem.odds?.best?.[side];
    if (!sideOdds) return null;

    // Build books snapshot
    const booksSnapshot: Record<string, BookSnapshot> = {};
    Object.entries(oddsItem.odds?.books || {}).forEach(([bookId, bookData]) => {
      const odds = bookData?.[side];
      if (odds?.price) {
        booksSnapshot[bookId] = {
          price: odds.price,
          u: odds.link || null,
          m: odds.mobileLink || null,
          sgp: odds.sgp || null,
        };
      }
    });

    return {
      type: "game",
      sport,
      event_id: game.id || "",
      game_date: game.startTime?.split("T")[0] || null,
      home_team: game.homeTeam || null,
      away_team: game.awayTeam || null,
      start_time: game.startTime || null,
      player_id: null,
      player_name: null,
      player_team: null,
      player_position: null,
      market: selectedMarket,
      line: sideOdds.line ?? null,
      side,
      books_snapshot: booksSnapshot,
      best_price_at_save: sideOdds.price ?? null,
      best_book_at_save: sideOdds.book || null,
      source: "mobile_odds",
    };
  }, [sport, game, selectedMarket]);

  // Check if favorited helper
  const checkIsFavorited = useCallback((side: "over" | "under") => {
    if (!item) return false;
    const params = buildFavoriteParams(item, side);
    if (!params) return false;
    return isFavorited({
      event_id: params.event_id,
      type: params.type,
      market: params.market,
      side: params.side,
      line: params.line,
      player_id: params.player_id,
    });
  }, [item, buildFavoriteParams, isFavorited]);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((side: "over" | "under", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn || !item) return;
    const params = buildFavoriteParams(item, side);
    if (params) {
      toggleFavorite(params);
    }
  }, [isLoggedIn, item, buildFavoriteParams, toggleFavorite]);

  if (!item || !item.odds) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-neutral-500 dark:text-neutral-400 text-center">
          No odds available for this market
        </p>
      </div>
    );
  }

  // Get the primary line from best odds
  const primaryOverLine = item.odds.best?.over?.line;
  const primaryUnderLine = item.odds.best?.under?.line;
  
  // Get the actual best odds for those specific lines
  const overOdds = getBestOddsForLine(item, "over", primaryOverLine);
  const underOdds = getBestOddsForLine(item, "under", primaryUnderLine);

  // Check market type
  const isMoneyline = selectedMarket.includes("moneyline");
  const isSpread = selectedMarket.includes("spread");
  const isTotal = selectedMarket.includes("total");

  const isOverFavorited = checkIsFavorited("over");
  const isUnderFavorited = checkIsFavorited("under");

  return (
    <div className="p-4 space-y-3">
      {/* First Row - Away team / Over */}
      {overOdds && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOddsTap(item, "over")}
            className="flex-1 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {isTotal ? (
                <span className="text-base font-medium text-neutral-900 dark:text-white">
                  Over {overOdds.line}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {showLogos && (
                    <img
                      src={getTeamLogoUrl(game.awayTeam, sport)}
                      alt={game.awayTeam}
                      className="w-7 h-7 object-contain"
                    />
                  )}
                  <span className="text-base font-semibold text-neutral-900 dark:text-white">
                    {game.awayTeam}
                  </span>
                  {isSpread && overOdds.line !== undefined && (
                    <span className="text-neutral-500 text-sm">{formatSpreadLine(overOdds.line)}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center gap-2">
                {overOdds.book && getBookLogo(overOdds.book) && (
                  <img
                    src={getBookLogo(overOdds.book)!}
                    alt={overOdds.book}
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatOdds(overOdds.price)}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </div>
          </button>
          {/* Favorite Button */}
          <button
            onClick={(e) => handleFavoriteToggle("over", e)}
            disabled={isToggling}
            className={cn(
              "p-3 rounded-xl transition-all active:scale-[0.95]",
              isOverFavorited
                ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-400",
              isToggling && "opacity-50"
            )}
          >
            <Heart className={cn("w-5 h-5", isOverFavorited && "fill-current")} />
          </button>
        </div>
      )}

      {/* Second Row - Home team / Under */}
      {underOdds && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOddsTap(item, "under")}
            className="flex-1 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {isTotal ? (
                <span className="text-base font-medium text-neutral-900 dark:text-white">
                  Under {underOdds.line}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {showLogos && (
                    <img
                      src={getTeamLogoUrl(game.homeTeam, sport)}
                      alt={game.homeTeam}
                      className="w-7 h-7 object-contain"
                    />
                  )}
                  <span className="text-base font-semibold text-neutral-900 dark:text-white">
                    {game.homeTeam}
                  </span>
                  {isSpread && underOdds.line !== undefined && (
                    <span className="text-neutral-500 text-sm">{formatSpreadLine(underOdds.line)}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center gap-2">
                {underOdds.book && getBookLogo(underOdds.book) && (
                  <img
                    src={getBookLogo(underOdds.book)!}
                    alt={underOdds.book}
                    className="w-5 h-5 object-contain"
                  />
                )}
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                  {formatOdds(underOdds.price)}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </div>
          </button>
          {/* Favorite Button */}
          <button
            onClick={(e) => handleFavoriteToggle("under", e)}
            disabled={isToggling}
            className={cn(
              "p-3 rounded-xl transition-all active:scale-[0.95]",
              isUnderFavorited
                ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-red-400",
              isToggling && "opacity-50"
            )}
          >
            <Heart className={cn("w-5 h-5", isUnderFavorited && "fill-current")} />
          </button>
        </div>
      )}

      {!overOdds && !underOdds && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <p className="text-neutral-500 dark:text-neutral-400 text-center">
            No odds available for this market
          </p>
        </div>
      )}
    </div>
  );
}

// Player Props Content
interface PlayerPropsContentProps {
  items: OddsScreenItem[];
  game: OddsScreenEvent;
  sport: string;
  selectedMarket: string;
  onOddsTap: (item: OddsScreenItem, side: "over" | "under") => void;
  onAltTap: (item: OddsScreenItem) => void;
}

// Helper to find the best price for a specific line from books data
function getBestOddsForLine(
  item: OddsScreenItem,
  side: "over" | "under",
  targetLine: number | undefined
): { price: number; book: string; line: number } | null {
  if (targetLine === undefined || !item.odds?.books) return null;

  let bestPrice: number | null = null;
  let bestBook: string | null = null;

  Object.entries(item.odds.books).forEach(([bookId, bookData]) => {
    const sideOdds = bookData?.[side];
    if (!sideOdds?.price) return;
    
    // Only consider books with the matching line
    if (sideOdds.line !== targetLine) return;

    // Higher price is better (for both positive and negative odds)
    if (bestPrice === null || sideOdds.price > bestPrice) {
      bestPrice = sideOdds.price;
      bestBook = bookId;
    }
  });

  if (bestPrice === null || bestBook === null) return null;

  return { price: bestPrice, book: bestBook, line: targetLine };
}

function PlayerPropsContent({ items, game, sport, selectedMarket, onOddsTap, onAltTap }: PlayerPropsContentProps) {
  const showLogos = hasTeamLogos(sport);
  const { toggleFavorite, isFavorited, isToggling, isLoggedIn } = useFavorites();

  // Build favorite params helper
  const buildFavoriteParams = useCallback((
    oddsItem: OddsScreenItem,
    side: "over" | "under"
  ): AddFavoriteParams | null => {
    const sideOdds = oddsItem.odds?.best?.[side];
    if (!sideOdds) return null;

    // Build books snapshot
    const booksSnapshot: Record<string, BookSnapshot> = {};
    Object.entries(oddsItem.odds?.books || {}).forEach(([bookId, bookData]) => {
      const odds = bookData?.[side];
      if (odds?.price) {
        booksSnapshot[bookId] = {
          price: odds.price,
          u: odds.link || null,
          m: odds.mobileLink || null,
          sgp: odds.sgp || null,
        };
      }
    });

    return {
      type: "player",
      sport,
      event_id: game.id || "",
      game_date: game.startTime?.split("T")[0] || null,
      home_team: game.homeTeam || null,
      away_team: game.awayTeam || null,
      start_time: game.startTime || null,
      player_id: oddsItem.entity?.id || null,
      player_name: oddsItem.entity?.name || null,
      player_team: oddsItem.entity?.team || null,
      player_position: oddsItem.entity?.details || null,
      market: selectedMarket,
      line: sideOdds.line ?? null,
      side,
      books_snapshot: booksSnapshot,
      best_price_at_save: sideOdds.price ?? null,
      best_book_at_save: sideOdds.book || null,
      source: "mobile_odds",
    };
  }, [sport, game, selectedMarket]);

  // Check if favorited helper
  const checkIsFavorited = useCallback((oddsItem: OddsScreenItem, side: "over" | "under") => {
    const params = buildFavoriteParams(oddsItem, side);
    if (!params) return false;
    return isFavorited({
      event_id: params.event_id,
      type: params.type,
      market: params.market,
      side: params.side,
      line: params.line,
      player_id: params.player_id,
    });
  }, [buildFavoriteParams, isFavorited]);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((oddsItem: OddsScreenItem, side: "over" | "under", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) return;
    const params = buildFavoriteParams(oddsItem, side);
    if (params) {
      toggleFavorite(params);
    }
  }, [isLoggedIn, buildFavoriteParams, toggleFavorite]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-neutral-500 dark:text-neutral-400 text-center">
          No player props available for this market
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {items.map((item) => {
        // Get the primary line from best odds
        const primaryOverLine = item.odds?.best?.over?.line;
        const primaryUnderLine = item.odds?.best?.under?.line;
        
        // Get the actual best odds for those specific lines
        const overOdds = getBestOddsForLine(item, "over", primaryOverLine);
        const underOdds = getBestOddsForLine(item, "under", primaryUnderLine);
        
        const playerTeam = item.entity?.team;
        const hasOdds = overOdds || underOdds;

        if (!hasOdds) return null;

        const isOverFavorited = checkIsFavorited(item, "over");
        const isUnderFavorited = checkIsFavorited(item, "under");

        return (
          <div key={item.id} className="p-4">
            {/* Player Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {showLogos && playerTeam && (
                  <img
                    src={getTeamLogoUrl(playerTeam, sport)}
                    alt={playerTeam}
                    className="w-5 h-5 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <span className="text-base font-semibold text-neutral-900 dark:text-white">
                  {item.entity.name}
                </span>
                {item.entity.details && (
                  <span className="text-sm text-neutral-400">
                    {item.entity.details}
                  </span>
                )}
              </div>
              {/* Alt Lines Button */}
              <button
                onClick={() => onAltTap(item)}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors active:scale-[0.95]"
              >
                Alt Lines
              </button>
            </div>

            {/* Odds Buttons with Favorite Hearts */}
            <div className="flex gap-2">
              {/* Over Button + Heart */}
              <div className="flex-1 flex items-center gap-1.5">
                <button
                  onClick={() => onOddsTap(item, "over")}
                  disabled={!overOdds}
                  className={cn(
                    "flex-1 flex items-center justify-between px-3 py-3 rounded-xl transition-colors active:scale-[0.98]",
                    overOdds
                      ? "bg-emerald-50 dark:bg-emerald-900/20 active:bg-emerald-100 dark:active:bg-emerald-900/30"
                      : "bg-neutral-50 dark:bg-neutral-800/50 opacity-50"
                  )}
                >
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    O {overOdds?.line ?? primaryOverLine ?? "—"}
                  </span>
                  {overOdds && (
                    <div className="flex items-center gap-1">
                      {overOdds.book && getBookLogo(overOdds.book) && (
                        <img
                          src={getBookLogo(overOdds.book)!}
                          alt={overOdds.book}
                          className="w-4 h-4 object-contain"
                        />
                      )}
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatOdds(overOdds.price)}
                      </span>
                    </div>
                  )}
                </button>
                {overOdds && (
                  <button
                    onClick={(e) => handleFavoriteToggle(item, "over", e)}
                    disabled={isToggling}
                    className={cn(
                      "p-2 rounded-lg transition-all active:scale-[0.95]",
                      isOverFavorited
                        ? "text-red-500"
                        : "text-neutral-300 dark:text-neutral-600 hover:text-red-400",
                      isToggling && "opacity-50"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isOverFavorited && "fill-current")} />
                  </button>
                )}
              </div>

              {/* Under Button + Heart */}
              <div className="flex-1 flex items-center gap-1.5">
                <button
                  onClick={() => onOddsTap(item, "under")}
                  disabled={!underOdds}
                  className={cn(
                    "flex-1 flex items-center justify-between px-3 py-3 rounded-xl transition-colors active:scale-[0.98]",
                    underOdds
                      ? "bg-blue-50 dark:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30"
                      : "bg-neutral-50 dark:bg-neutral-800/50 opacity-50"
                  )}
                >
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    U {underOdds?.line ?? primaryUnderLine ?? "—"}
                  </span>
                  {underOdds && (
                    <div className="flex items-center gap-1">
                      {underOdds.book && getBookLogo(underOdds.book) && (
                        <img
                          src={getBookLogo(underOdds.book)!}
                          alt={underOdds.book}
                          className="w-4 h-4 object-contain"
                        />
                      )}
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                        {formatOdds(underOdds.price)}
                      </span>
                    </div>
                  )}
                </button>
                {underOdds && (
                  <button
                    onClick={(e) => handleFavoriteToggle(item, "under", e)}
                    disabled={isToggling}
                    className={cn(
                      "p-2 rounded-lg transition-all active:scale-[0.95]",
                      isUnderFavorited
                        ? "text-red-500"
                        : "text-neutral-300 dark:text-neutral-600 hover:text-red-400",
                      isToggling && "opacity-50"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isUnderFavorited && "fill-current")} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

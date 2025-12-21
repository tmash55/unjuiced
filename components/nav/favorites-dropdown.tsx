"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { useFavorites, Favorite } from "@/hooks/use-favorites";
import { HeartFill } from "@/components/icons/heart-fill";
import { Heart } from "@/components/icons/heart";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";

// Helper to format market name
const formatMarket = (market: string): string => {
  const marketMap: Record<string, string> = {
    player_points: "PTS",
    player_rebounds: "REB",
    player_assists: "AST",
    player_threes_made: "3PM",
    player_steals: "STL",
    player_blocks: "BLK",
    player_turnovers: "TO",
    player_points_rebounds_assists: "PRA",
    player_points_rebounds: "P+R",
    player_points_assists: "P+A",
    player_rebounds_assists: "R+A",
    player_blocks_steals: "B+S",
  };
  return marketMap[market] || market.replace("player_", "").toUpperCase();
};

// Helper to format odds
const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
};

// Helper to get sportsbook logo
const getBookLogo = (bookId?: string | null): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

// Individual favorite item - compact row style
function FavoriteItem({ 
  favorite, 
  onRemove,
  isRemoving 
}: { 
  favorite: Favorite; 
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const teamLogo = favorite.player_team 
    ? getTeamLogoUrl(favorite.player_team, "basketball_nba")
    : null;
  const bookLogo = getBookLogo(favorite.best_book_at_save);
  
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        isRemoving && "opacity-50"
      )}
    >
      {/* Team Logo */}
      {teamLogo && (
        <div className="shrink-0 w-5 h-5">
          <Image
            src={teamLogo}
            alt={favorite.player_team || ""}
            width={20}
            height={20}
            className="w-5 h-5 object-contain"
          />
        </div>
      )}
      
      {/* Player + Prop Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {favorite.player_name?.split(" ").pop() || "Unknown"}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatMarket(favorite.market)} o{favorite.line}
          </span>
        </div>
      </div>
      
      {/* Book Logo + Odds */}
      <div className="flex items-center gap-2 shrink-0">
        {bookLogo && (
          <Image
            src={bookLogo}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 object-contain rounded"
          />
        )}
        {favorite.best_price_at_save && (
          <span className={cn(
            "text-xs font-semibold tabular-nums",
            favorite.best_price_at_save >= 0 
              ? "text-emerald-600 dark:text-emerald-400" 
              : "text-neutral-600 dark:text-neutral-300"
          )}>
            {formatOdds(favorite.best_price_at_save)}
          </span>
        )}
      </div>
      
      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        disabled={isRemoving}
        className={cn(
          "shrink-0 p-1 rounded transition-all",
          "opacity-0 group-hover:opacity-100",
          "text-neutral-400 hover:text-red-500",
          isRemoving && "opacity-100"
        )}
      >
        {isRemoving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-2">
        <Heart className="w-5 h-5 text-neutral-400" />
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
        No saved picks yet
      </p>
    </div>
  );
}

export function FavoritesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { favorites, isLoading, isLoggedIn, removeFavorite } = useFavorites();
  
  const count = favorites.length;
  const hasItems = count > 0;
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Handle remove
  const handleRemove = async (favoriteId: string) => {
    setRemovingId(favoriteId);
    try {
      await removeFavorite(favoriteId);
    } finally {
      setRemovingId(null);
    }
  };
  
  if (!isLoggedIn) {
    return (
      <Tooltip content="Sign in to save favorites" side="bottom">
        <button
          disabled
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            "border-neutral-200 bg-white opacity-50 cursor-not-allowed",
            "dark:border-white/10 dark:bg-neutral-900"
          )}
        >
          <Heart className="h-4 w-4 text-neutral-400" />
        </button>
      </Tooltip>
    );
  }
  
  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
          "border-neutral-200 bg-white hover:bg-neutral-50",
          "dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800",
          hasItems && "border-red-200 dark:border-red-900/50",
          isOpen && "ring-2 ring-neutral-200 dark:ring-neutral-700"
        )}
      >
        {hasItems ? (
          <HeartFill className="h-4 w-4 text-red-500" />
        ) : (
          <Heart className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        )}
        
        {/* Count Badge */}
        {hasItems && (
          <span className={cn(
            "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center",
            "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          )}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      
      {/* Dropdown - matching nav dropdown style */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 top-full z-50 mt-2 w-72 origin-top-right",
                "rounded-lg border bg-white shadow-lg",
                "dark:border-white/10 dark:bg-neutral-900"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <HeartFill className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    Saved Picks
                  </span>
                  {hasItems && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({count})
                    </span>
                  )}
                </div>
              </div>
              
              {/* Content */}
              <div className="max-h-[280px] overflow-y-auto py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                  </div>
                ) : !hasItems ? (
                  <EmptyState />
                ) : (
                  <>
                    {favorites.slice(0, 8).map((favorite) => (
                      <FavoriteItem
                        key={favorite.id}
                        favorite={favorite}
                        onRemove={() => handleRemove(favorite.id)}
                        isRemoving={removingId === favorite.id}
                      />
                    ))}
                    
                    {/* Show more indicator */}
                    {count > 8 && (
                      <div className="px-3 py-2 text-center">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          +{count - 8} more
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Footer */}
              {hasItems && (
                <div className="border-t border-neutral-200 dark:border-white/10 p-2">
                  <Link
                    href="/favorites"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 w-full py-2 rounded-md",
                      "text-sm font-medium transition-colors",
                      "text-neutral-700 hover:bg-neutral-100",
                      "dark:text-neutral-300 dark:hover:bg-neutral-800"
                    )}
                  >
                    View All Picks
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

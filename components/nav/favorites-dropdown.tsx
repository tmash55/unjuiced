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
import { X, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabelShort } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";

// Helper to format side display
const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "o";
  if (side === "under" || side === "u") return "u";
  if (side === "yes") return "y";
  if (side === "no") return "n";
  return side.charAt(0).toLowerCase();
};

// Helper to format odds
const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
};

// Get first initial from name
const getInitials = (name: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Get a consistent color based on name
const getAvatarColor = (name: string | null): string => {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-amber-500",
    "from-pink-500 to-rose-500",
    "from-indigo-500 to-blue-600",
  ];
  if (!name) return colors[0];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Get sportsbook logo
const getBookLogo = (bookId?: string | null): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.square || sb?.image?.light || null;
};

// Map sport strings to SportIcon format
const normalizeSport = (sport: string | null): string => {
  if (!sport) return "nba";
  const sportMap: Record<string, string> = {
    nba: "basketball_nba",
    nfl: "americanfootball_nfl",
    nhl: "icehockey_nhl",
    mlb: "baseball_mlb",
    ncaabaseball: "baseball_mlb",
    ncaab: "basketball_ncaab",
    ncaaf: "americanfootball_ncaaf",
    soccer_epl: "soccer_epl",
    soccer_laliga: "soccer_laliga",
    soccer_mls: "soccer_mls",
    soccer_ucl: "soccer_ucl",
    soccer_uel: "soccer_uel",
    tennis_atp: "tennis_atp",
    tennis_challenger: "tennis_challenger",
    tennis_itf_men: "tennis_itf_men",
    tennis_itf_women: "tennis_itf_women",
    tennis_utr_men: "tennis_utr_men",
    tennis_utr_women: "tennis_utr_women",
    tennis_wta: "tennis_wta",
    ufc: "ufc",
  };
  return sportMap[sport.toLowerCase()] || sport;
};

// Individual favorite item - cart-style preview
function FavoriteItem({ 
  favorite, 
  onRemove,
  isRemoving 
}: { 
  favorite: Favorite; 
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const initials = getInitials(favorite.player_name);
  const avatarColor = getAvatarColor(favorite.player_name);
  const lastName = favorite.player_name?.split(" ").pop() || "Unknown";
  const side = formatSide(favorite.side);
  const hasLine = favorite.line !== null && favorite.line !== undefined;
  const bookLogo = getBookLogo(favorite.best_book_at_save);
  const marketLabel = formatMarketLabelShort(favorite.market);
  const normalizedSport = normalizeSport(favorite.sport);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-3 transition-all duration-150",
        "border-b border-neutral-100 dark:border-white/5 last:border-b-0",
        isRemoving && "opacity-40 pointer-events-none"
      )}
    >
      {/* Sport Icon - Left edge indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-neutral-200 dark:via-neutral-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Sport badge */}
      <div className={cn(
        "shrink-0 w-6 h-6 rounded-md flex items-center justify-center",
        "bg-neutral-100 dark:bg-white/5"
      )}>
        <SportIcon sport={normalizedSport} className="w-3.5 h-3.5 text-neutral-500" />
      </div>
      
      {/* Avatar with initials */}
      <div className={cn(
        "shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
        "bg-gradient-to-br shadow-sm",
        avatarColor
      )}>
        <span className="text-[11px] font-bold text-white tracking-tight">
          {initials}
        </span>
        </div>
      
      {/* Player + Bet Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {lastName}
          </span>
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase">
            {favorite.player_team || ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {marketLabel}
          </span>
          {hasLine && (
            <span className={cn(
              "text-xs font-semibold",
              side === "o" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              {side}{favorite.line}
            </span>
          )}
        </div>
      </div>
      
      {/* Best Odds Section */}
      <div className="flex items-center gap-1.5 shrink-0">
        {bookLogo && (
          <div className="w-5 h-5 rounded overflow-hidden bg-white dark:bg-neutral-800 flex items-center justify-center">
          <Image
            src={bookLogo}
              alt={favorite.best_book_at_save || ""}
              width={18}
              height={18}
              className="w-[18px] h-[18px] object-contain"
          />
          </div>
        )}
        {favorite.best_price_at_save && (
          <span className={cn(
            "text-sm font-bold tabular-nums",
            favorite.best_price_at_save >= 0 
              ? "text-emerald-600 dark:text-emerald-400" 
              : "text-neutral-700 dark:text-neutral-300"
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
          "shrink-0 p-1.5 rounded-full transition-all duration-150",
          "opacity-0 group-hover:opacity-100",
          "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10",
          isRemoving && "opacity-100"
        )}
      >
        {isRemoving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.div>
  );
}

// Empty state - modern and inviting
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center shadow-inner">
          <Heart className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 text-center">
        Your betslip is empty
      </p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-1 max-w-[200px]">
        Tap the ❤️ on any edge to add it to your picks
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
      <Tooltip content="Sign in to save plays" side="bottom">
        <button
          disabled
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
            "bg-neutral-100 dark:bg-white/5 opacity-50 cursor-not-allowed"
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
          "relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200",
          "bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10",
          hasItems && "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20",
          isOpen && "ring-2 ring-neutral-300 dark:ring-neutral-600 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950"
        )}
      >
        {hasItems ? (
          <HeartFill className="h-4 w-4 text-red-500" />
        ) : (
          <Heart className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        )}
        
        {/* Count Badge */}
        <AnimatePresence>
        {hasItems && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={cn(
            "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center",
                "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
              )}
            >
            {count > 99 ? "99+" : count}
            </motion.span>
        )}
        </AnimatePresence>
      </button>
      
      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: "spring", duration: 0.25, bounce: 0.2 }}
              className={cn(
                "absolute right-0 top-full z-50 mt-2 w-[340px] origin-top-right",
                "rounded-xl border shadow-2xl",
                "bg-white border-neutral-200",
                "dark:bg-neutral-900 dark:border-white/10"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 shadow-sm">
                    <HeartFill className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                      My Picks
                  </span>
                  {hasItems && (
                      <span className="ml-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
                        {count} {count === 1 ? 'selection' : 'selections'}
                    </span>
                  )}
                  </div>
                </div>
                {hasItems && (
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                    Best Odds
                  </span>
                )}
              </div>
              
              {/* Content */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-700">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                  </div>
                ) : !hasItems ? (
                  <EmptyState />
                ) : (
                  <AnimatePresence mode="popLayout">
                    {favorites.slice(0, 8).map((favorite) => (
                      <FavoriteItem
                        key={favorite.id}
                        favorite={favorite}
                        onRemove={() => handleRemove(favorite.id)}
                        isRemoving={removingId === favorite.id}
                      />
                    ))}
                  </AnimatePresence>
                )}
                    
                    {/* Show more indicator */}
                    {count > 8 && (
                  <div className="px-4 py-3 text-center border-t border-neutral-100 dark:border-white/5">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      +{count - 8} more picks
                        </span>
                      </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="border-t border-neutral-100 dark:border-white/5 p-3">
                  <Link
                    href="/my-slips"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                    "flex items-center justify-center gap-2 w-full py-3 rounded-lg",
                    "text-sm font-semibold transition-all duration-150",
                    "bg-gradient-to-r from-neutral-900 to-neutral-800 text-white",
                    "hover:from-neutral-800 hover:to-neutral-700",
                    "dark:from-white dark:to-neutral-100 dark:text-neutral-900",
                    "dark:hover:from-neutral-100 dark:hover:to-neutral-200",
                    "shadow-sm"
                    )}
                  >
                    View All Picks
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

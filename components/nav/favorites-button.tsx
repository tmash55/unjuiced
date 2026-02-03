"use client";

import { useFavorites } from "@/hooks/use-favorites";
import { HeartFill } from "@/components/icons/heart-fill";
import { Heart } from "@/components/icons/heart";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Tooltip } from "@/components/tooltip";

interface FavoritesButtonProps {
  className?: string;
}

export function FavoritesButton({ className }: FavoritesButtonProps) {
  const { favorites, isLoading, isLoggedIn } = useFavorites();
  
  const count = favorites.length;
  const hasItems = count > 0;
  
  if (!isLoggedIn) {
    return (
      <Tooltip content="Sign in to save plays" side="bottom">
        <button
          disabled
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            "border-neutral-200 bg-white opacity-50 cursor-not-allowed",
            "dark:border-white/10 dark:bg-neutral-900",
            className
          )}
        >
          <Heart className="h-4 w-4 text-neutral-400" />
        </button>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip content={hasItems ? `${count} saved play${count !== 1 ? 's' : ''}` : "Your saved plays"} side="bottom">
      <Link
        href="/my-slips"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
          "border-neutral-200 bg-white hover:bg-neutral-50",
          "dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800",
          hasItems && "border-red-200 dark:border-red-900/50",
          className
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
            "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
            count > 9 && "px-1.5"
          )}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

// Mobile version - slightly larger touch target
export function MobileFavoritesButton({ className }: FavoritesButtonProps) {
  const { favorites, isLoading, isLoggedIn } = useFavorites();
  
  const count = favorites.length;
  const hasItems = count > 0;
  
  if (!isLoggedIn) {
    return (
      <button
        disabled
        className={cn(
          "relative flex size-8 items-center justify-center rounded-md opacity-50 cursor-not-allowed",
          "text-neutral-400",
          className
        )}
      >
        <Heart className="size-5" />
      </button>
    );
  }
  
  return (
    <Link
      href="/my-slips"
      className={cn(
        "relative flex size-8 items-center justify-center rounded-md transition-colors",
        "text-neutral-700 hover:bg-neutral-100",
        "dark:text-white dark:hover:bg-neutral-800",
        hasItems && "text-red-500 dark:text-red-400",
        className
      )}
    >
      {hasItems ? (
        <HeartFill className="size-5" />
      ) : (
        <Heart className="size-5" />
      )}
      
      {/* Count Badge */}
      {hasItems && (
        <span className={cn(
          "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center",
          "rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
        )}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}


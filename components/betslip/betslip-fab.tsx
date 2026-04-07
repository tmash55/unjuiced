"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BetslipPanel } from "./betslip-panel";

export function BetslipFab() {
  const { favorites, isLoggedIn } = useFavorites();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(favorites.length);
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Pulse badge when count increases
  useEffect(() => {
    if (favorites.length > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
    prevCount.current = favorites.length;
  }, [favorites.length]);

  if (!isLoggedIn) return null;

  const count = favorites.length;
  const hasItems = count > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 flex items-center justify-center rounded-full shadow-lg transition-all",
          "bg-brand hover:bg-brand/90 text-white",
          "ring-1 ring-brand/20 hover:ring-brand/40",
          hasItems
            ? isMobile ? "w-12 h-12 bottom-24 right-4" : "w-12 h-12 bottom-6 right-6"
            : isMobile ? "w-10 h-10 bottom-24 right-4 opacity-60" : "w-10 h-10 bottom-6 right-6 opacity-60",
        )}
        aria-label={`Open betslip (${count} plays)`}
      >
        <ReceiptText className={cn("shrink-0", hasItems ? "w-5 h-5" : "w-4 h-4")} />

        {/* Count badge */}
        {hasItems && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center",
              "rounded-full bg-white text-brand text-[11px] font-black shadow-sm",
              "ring-2 ring-brand",
              pulse && "animate-bounce"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <BetslipPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

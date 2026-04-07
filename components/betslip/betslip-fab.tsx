"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/hooks/use-favorites";
import { BetslipPanel } from "./betslip-panel";

/** Desktop only — floating action button in bottom-right corner */
export function BetslipFab() {
  const { favorites, isLoggedIn } = useFavorites();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(favorites.length);

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
      {/* Desktop FAB — hidden on mobile (header button used instead) */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 hidden md:flex items-center justify-center rounded-full shadow-lg transition-all",
          "bg-brand hover:bg-brand/90 text-white",
          "ring-1 ring-brand/20 hover:ring-brand/40",
          hasItems ? "w-12 h-12 bottom-6 right-6" : "w-10 h-10 bottom-6 right-6 opacity-60",
        )}
        aria-label={`Open betslip (${count} plays)`}
      >
        <ReceiptText className={cn("shrink-0", hasItems ? "w-5 h-5" : "w-4 h-4")} />

        {hasItems && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center",
              "rounded-full bg-white text-brand text-[11px] font-black shadow-sm ring-2 ring-brand",
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

/** Mobile only — inline button for the header bar */
export function BetslipHeaderButton() {
  const { favorites, isLoggedIn } = useFavorites();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(favorites.length);

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
          "relative p-2 rounded-lg transition-all duration-200",
          "hover:bg-[#0EA5E9]/10 dark:hover:bg-[#7DD3FC]/10",
          hasItems
            ? "text-brand"
            : "text-neutral-500 dark:text-neutral-400 hover:text-[#0EA5E9] dark:hover:text-[#7DD3FC]",
        )}
        aria-label={`Open betslip (${count} plays)`}
      >
        <ReceiptText className="h-5 w-5" />

        {hasItems && (
          <span
            className={cn(
              "absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center",
              "rounded-full bg-brand px-1 text-[9px] font-black text-white",
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

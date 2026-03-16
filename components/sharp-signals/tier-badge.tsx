"use client";

import { cn } from "@/lib/utils";
import type { WalletTier } from "@/lib/polymarket/types";

const tierConfig: Record<WalletTier, { label: string; color: string; bg: string }> = {
  S: { label: "S", color: "text-amber-300", bg: "bg-amber-500/20 border-amber-500/40" },
  A: { label: "A", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/40" },
  B: { label: "B", color: "text-sky-400", bg: "bg-sky-500/20 border-sky-500/40" },
  C: { label: "C", color: "text-neutral-400", bg: "bg-neutral-500/20 border-neutral-500/40" },
  FADE: { label: "FADE", color: "text-red-400", bg: "bg-red-500/20 border-red-500/40" },
  NEW: { label: "NEW", color: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/40" },
};

export function TierBadge({ tier, size = "sm", className }: { tier: WalletTier | string; size?: "xs" | "sm"; className?: string }) {
  const config = tierConfig[tier as WalletTier] ?? tierConfig.C;
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold uppercase tracking-wider rounded border",
        size === "xs" ? "px-1 py-px text-[8px]" : "px-1.5 py-0.5 text-[10px]",
        config.bg,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}

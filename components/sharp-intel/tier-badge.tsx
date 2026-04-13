"use client";

import { cn } from "@/lib/utils";

/**
 * User-facing signal tier system.
 *
 * Mapping (based on signal.tier, NOT wallet_tier S/A/B/C):
 *   "sharp"  → Sharp       (green)
 *   "whale"  → Insider     (purple)
 *   "fade"   → Fade        (red)
 *   "burner" → New Account (gray)
 */

export type SignalTier = "sharp" | "whale" | "fade" | "burner";

const tierConfig: Record<
  SignalTier,
  { label: string; dot: string; text: string; bg: string }
> = {
  sharp: {
    label: "Sharp",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25",
  },
  whale: {
    label: "Insider",
    dot: "bg-purple-500 dark:bg-purple-400",
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/25",
  },
  fade: {
    label: "Fade",
    dot: "bg-red-500 dark:bg-red-400",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/25",
  },
  burner: {
    label: "New Account",
    dot: "bg-neutral-400 dark:bg-neutral-500",
    text: "text-neutral-500 dark:text-neutral-400",
    bg: "bg-neutral-100 border-neutral-300 dark:bg-neutral-500/10 dark:border-neutral-600/25",
  },
};

function resolveConfig(tier: string) {
  const key = tier?.toLowerCase() as SignalTier;
  return tierConfig[key] ?? tierConfig.burner;
}

export function TierBadge({
  tier,
  size = "sm",
  className,
  ...rest
}: {
  tier: string;
  size?: "xs" | "sm" | "md";
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const config = resolveConfig(tier);

  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-md border",
        size === "xs" && "px-1.5 py-px text-[9px] gap-1",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-xs",
        config.bg,
        config.text,
        className
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2",
          config.dot
        )}
      />
      {config.label}
    </span>
  );
}

/**
 * Minimal dot-only variant for tight spaces.
 */
export function TierDot({
  tier,
  className,
}: {
  tier: string;
  className?: string;
}) {
  const config = resolveConfig(tier);
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", config.dot, className)}
      title={config.label}
    />
  );
}

/** Utility to get the user-facing label for a signal tier. */
export function getTierLabel(tier: string): string {
  return resolveConfig(tier).label;
}

/** Utility to get the tier color class. */
export function getTierColor(tier: string): string {
  return resolveConfig(tier).text;
}

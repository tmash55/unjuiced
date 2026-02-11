"use client";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export type FeatureCard = {
  id: string;
  title: string;
  description?: string;
  // Any React node for richer previews (images, mini UIs, etc.)
  preview: React.ReactNode;
};

export function FeatureDisplay({
  cards,
  intervalMs = 5000,
  className,
}: {
  cards: FeatureCard[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const safeCards = useMemo(() => cards.filter(Boolean), [cards]);

  useEffect(() => {
    if (safeCards.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % safeCards.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [safeCards.length, intervalMs]);

  if (safeCards.length === 0) return null;
  const active = safeCards[index];

  return (
    <div className={cn("relative", className)}>
      {/* Tabs */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {safeCards.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setIndex(i)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              i === index
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-black dark:text-white/80 dark:hover:bg-neutral-900",
            )}
          >
            <div className="font-medium">{c.title}</div>
            {c.description && (
              <div className="mt-1 line-clamp-2 text-xs opacity-80">{c.description}</div>
            )}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-black">
        {active.preview}
      </div>
    </div>
  );
}



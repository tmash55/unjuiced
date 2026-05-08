"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "wnba-expansion-welcome-2026:v1";

interface WnbaExpansionWelcomeProps {
  className?: string;
}

export function WnbaExpansionWelcome({ className }: WnbaExpansionWelcomeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        const timer = window.setTimeout(() => setVisible(true), 700);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-3 right-3 z-50 sm:left-auto sm:right-5 sm:max-w-md",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-2xl border border-sky-400/25 bg-neutral-950/95 text-white shadow-2xl shadow-sky-950/30 backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-400/15 text-sky-300">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
              WNBA 2026 note
            </div>
            <h2 className="mt-0.5 text-sm font-bold tracking-tight">
              Welcome to the expanded WNBA slate
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Dismiss WNBA note"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3 text-sm leading-6 text-neutral-200">
          <p>
            Toronto Tempo and Portland Fire are new expansion teams this season. Since they did not play in 2025, tools that default to 2025 defensive baselines will show limited or empty defense ranks for those matchups.
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
            We will populate 2026 defensive context as regular season data comes in.
          </p>
        </div>

        <div className="flex justify-end border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-sky-300/30 bg-sky-400/15 px-3 py-1.5 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-400/25 active:scale-95"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

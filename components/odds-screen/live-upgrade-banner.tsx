"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LiveUpgradeBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 overflow-hidden rounded-lg border border-brand/20 bg-gradient-to-r from-brand/10 via-orange-500/10 to-yellow-500/10 backdrop-blur-sm dark:from-brand/20 dark:via-orange-500/20 dark:to-yellow-500/20"
        >
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/20 dark:bg-brand/30">
                <Zap className="h-5 w-5 text-brand" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Unlock Real-Time Odds Updates
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Get live SSE feeds with instant updates and color-coded changes. Upgrade to Pro for the edge.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                className={cn(
                  "rounded-md bg-brand px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand/90",
                  "focus:outline-none focus:ring-2 focus:ring-brand/50"
                )}
              >
                Upgrade Now
              </Link>
              <button
                onClick={() => setIsDismissed(true)}
                className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-200/50 hover:text-neutral-700 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-300"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { Zap } from "lucide-react";
import { motion } from "motion/react";
import { ButtonLink } from "@/components/button-link";
import { useAuth } from "@/components/auth/auth-provider";
import { useEntitlements } from "@/hooks/use-entitlements";

export function LiveUpgradeBanner() {
  const { user } = useAuth();
  const { data: entitlements } = useEntitlements();

  // Determine if user can access trial
  const canUseTrial = !user || (entitlements?.trial?.trial_used === false);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 overflow-hidden rounded-xl border border-[var(--tertiary)]/20 bg-gradient-to-r from-[var(--tertiary)]/10 via-[var(--tertiary)]/5 to-transparent backdrop-blur-sm dark:from-[var(--tertiary)]/15 dark:via-[var(--tertiary)]/8 dark:to-transparent"
    >
      <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--tertiary)]/20 dark:bg-[var(--tertiary)]/25">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--tertiary-strong)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white mb-1">
              Unlock Real-Time Odds Updates
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Get live SSE feeds with instant updates and color-coded changes. Upgrade to Sharp for the edge.
            </p>
          </div>
        </div>
        
        <div className="flex items-center shrink-0">
          <ButtonLink
            href="/pricing"
            variant="pro"
            className="text-xs sm:text-sm px-4 py-2 h-auto"
          >
            {canUseTrial ? "Start Free Trial" : "Get Sharp Now"}
          </ButtonLink>
        </div>
      </div>
    </motion.div>
  );
}

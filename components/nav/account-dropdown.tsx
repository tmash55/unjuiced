"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { CircleUserRound } from "lucide-react";
import Logout from "@/icons/logout";
import { Gear } from "@/icons/gear";
import { UserIcon } from "@/icons/user-icon";
import { useEntitlements } from "@/hooks/use-entitlements";

export function AccountDropdown({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useAuth();
  const { data: entitlements } = useEntitlements();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
          "border-neutral-200 bg-white hover:bg-neutral-50",
          "dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800",
          isOpen && "ring-2 ring-neutral-200 dark:ring-neutral-700"
        )}
      >
        <UserIcon className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right",
                "rounded-lg border bg-white shadow-lg",
                "dark:border-white/10 dark:bg-neutral-900"
              )}
            >
              {/* User Info */}
              <div className="border-b border-neutral-200 p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {user.user_metadata?.name || user.email}
                    </div>
                    {user.user_metadata?.name && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                  {entitlements?.plan && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        entitlements.plan === "pro" &&
                          entitlements.entitlement_source === "trial" &&
                          "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
                        entitlements.plan === "pro" &&
                          entitlements.entitlement_source === "subscription" &&
                          "bg-[var(--tertiary)]/10 text-[var(--tertiary-strong)] dark:bg-[var(--tertiary)]/20",
                        entitlements.plan === "free" &&
                          "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      )}
                    >
                      {entitlements.entitlement_source === "trial"
                        ? "Trial"
                        : entitlements.plan === "pro"
                        ? "Pro"
                        : "Free"}
                    </span>
                  )}
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1">
                <Link
                  href="/account/settings"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    "text-neutral-700 hover:bg-neutral-100",
                    "dark:text-neutral-300 dark:hover:bg-neutral-800"
                  )}
                >
                  <Gear className="h-4 w-4" />
                  Settings
                </Link>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleSignOut();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    "text-red-600 hover:bg-red-50",
                    "dark:text-red-400 dark:hover:bg-red-950/50"
                  )}
                >
                  <Logout className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}


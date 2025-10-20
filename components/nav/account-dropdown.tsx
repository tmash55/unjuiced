"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { CircleUserRound } from "lucide-react";
import Logout from "@/icons/logout";
import { Gear } from "@/icons/gear";

export function AccountDropdown({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useAuth();

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
        <CircleUserRound className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
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
                <div className="text-sm font-medium text-neutral-900 dark:text-white">
                  {user.email}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {user.user_metadata?.full_name || "User"}
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1">
                <Link
                  href="/settings"
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


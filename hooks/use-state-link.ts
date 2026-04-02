"use client";

import { useCallback } from "react";
import { useUserState } from "@/context/preferences-context";
import { replaceStateInLink } from "@/lib/utils/state-link";

/**
 * Hook that returns a function to replace state codes in sportsbook desktop links.
 * Uses the user's saved state preference.
 *
 * Usage:
 *   const applyState = useStateLink();
 *   const link = applyState("https://nj.sportsbook.fanduel.com/...");
 *   // If user state is "ia": "https://ia.sportsbook.fanduel.com/..."
 */
export function useStateLink() {
  const { stateCode } = useUserState();

  return useCallback(
    (url: string | null | undefined): string | null => {
      return replaceStateInLink(url, stateCode);
    },
    [stateCode]
  );
}

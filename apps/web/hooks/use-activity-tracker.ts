"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single POST to /api/me/activity on mount.
 * Uses a module-level flag so it only fires once per page session,
 * even if the hook remounts (React strict mode, layout re-renders, etc.).
 */
let activityTracked = false;

export function useActivityTracker(userId: string | undefined) {
  const called = useRef(false);

  useEffect(() => {
    if (!userId || activityTracked || called.current) return;
    called.current = true;
    activityTracked = true;

    fetch("/api/me/activity", { method: "POST" }).catch(() => {});
  }, [userId]);
}

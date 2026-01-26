"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect if a media query matches
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Create listener
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener("change", handler);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}

/**
 * Hook to detect if the current viewport is mobile (phone)
 * @returns boolean indicating if viewport is mobile (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Hook to detect if the current viewport is tablet
 * @returns boolean indicating if viewport is tablet (768px - 1279px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1279px)");
}

/**
 * Hook to detect if the current viewport is desktop
 * @returns boolean indicating if viewport is desktop (>= 1280px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}

/**
 * Hook to detect if the viewport should use mobile/card view
 * Used by tools like Positive EV, Edge Finder that have complex tables
 * Shows card view only on phones (< 768px) to avoid conflict with sidebar
 * Desktop table view is shown on tablets and larger to utilize the sidebar layout
 * @returns boolean indicating if should use mobile/card view
 */
export function useIsMobileOrTablet(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

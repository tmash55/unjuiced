import { createClient } from "@/libs/supabase/client";
import { useMemo } from "react";

/**
 * Hook to get a memoized Supabase client instance.
 * This prevents creating new client instances on every render.
 * 
 * @returns Singleton Supabase client for the component lifecycle
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}


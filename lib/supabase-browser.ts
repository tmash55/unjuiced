import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Singleton Supabase client for browser-side usage.
 * Uses the anon key (respects RLS) — safe for client bundles.
 */
export function getSupabaseBrowser() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: {
      params: { eventsPerSecond: 2 },
    },
  });

  return client;
}

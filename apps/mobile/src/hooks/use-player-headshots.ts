import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

type HeadshotMap = Record<string, string>; // playerName → headshot URL

/**
 * Batch-fetch NBA headshot URLs for a list of player names.
 * Queries nba_players_hr via Supabase, returns a map of name → CDN URL.
 * Long cache since player IDs don't change.
 */
export function usePlayerHeadshots(playerNames: string[]) {
  const dedupedNames = [...new Set(playerNames.filter(Boolean))];
  const cacheKey = dedupedNames.slice().sort().join(",");

  return useQuery<HeadshotMap>({
    queryKey: ["player-headshots", cacheKey],
    enabled: dedupedNames.length > 0,
    queryFn: async () => {
      const map: HeadshotMap = {};

      // Supabase .in() has a limit; batch in groups of 50
      for (let i = 0; i < dedupedNames.length; i += 50) {
        const batch = dedupedNames.slice(i, i + 50);
        const { data } = await supabase
          .from("nba_players_hr")
          .select("name, nba_player_id")
          .in("name", batch);

        if (data) {
          for (const row of data) {
            if (row.nba_player_id) {
              map[row.name] = `https://cdn.nba.com/headshots/nba/latest/260x190/${row.nba_player_id}.png`;
            }
          }
        }
      }

      return map;
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

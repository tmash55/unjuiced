import { useQuery } from '@tanstack/react-query';
import type { PlayerLookupResponse } from '@/app/api/players/lookup/route';

interface UsePlayerLookupOptions {
  odds_player_id?: string;
  player_name?: string;
  enabled?: boolean;
}

async function fetchPlayerLookup(
  odds_player_id?: string,
  player_name?: string
): Promise<PlayerLookupResponse> {
  const response = await fetch('/api/players/lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      odds_player_id,
      player_name,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[usePlayerLookup] API error:', response.status, errorText);
    throw new Error(`Failed to lookup player: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook to lookup a player by odds_player_id or name
 * Returns nba_player_id and full player data
 * 
 * Features:
 * - 24 hour cache (player IDs don't change)
 * - Automatic deduplication
 * - Returns null gracefully if player not found
 */
export function usePlayerLookup({ 
  odds_player_id, 
  player_name, 
  enabled = true 
}: UsePlayerLookupOptions) {
  return useQuery({
    queryKey: ['player-lookup', odds_player_id, player_name],
    queryFn: () => fetchPlayerLookup(odds_player_id, player_name),
    enabled: enabled && !!(odds_player_id || player_name),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - IDs don't change
    gcTime: 48 * 60 * 60 * 1000, // 48 hours - keep in cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}


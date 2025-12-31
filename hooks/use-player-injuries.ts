import { useQuery } from '@tanstack/react-query';
import type { PlayerInjuryStatus, InjuryLookupResponse } from '@/app/api/nba/players/injury-lookup/route';

interface UsePlayerInjuriesOptions {
  playerIds: string[]; // odds_player_id UUIDs
  enabled?: boolean;
}

async function fetchPlayerInjuries(playerIds: string[]): Promise<Map<string, PlayerInjuryStatus>> {
  if (playerIds.length === 0) {
    return new Map();
  }

  // Batch requests if we have more than 500 players
  const BATCH_SIZE = 500;
  const injuryMap = new Map<string, PlayerInjuryStatus>();

  if (playerIds.length > BATCH_SIZE) {
    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
      batches.push(playerIds.slice(i, i + BATCH_SIZE));
    }

    // Fetch all batches in parallel
    const results = await Promise.all(
      batches.map(async (batch, index) => {
        const response = await fetch('/api/nba/players/injury-lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ playerIds: batch }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[usePlayerInjuries] Batch ${index + 1} error:`, response.status, errorText);
          throw new Error(`Failed to fetch injury data batch ${index + 1}: ${response.statusText}`);
        }

        return response.json();
      })
    );

    // Merge all results
    results.forEach((data: InjuryLookupResponse) => {
      data.players.forEach((player) => {
        injuryMap.set(player.playerId, player);
      });
    });
  } else {
    // Single request for <= 500 players
    const response = await fetch('/api/nba/players/injury-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playerIds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[usePlayerInjuries] API error:', response.status, errorText);
      throw new Error(`Failed to fetch injury data: ${response.statusText}`);
    }

    const data: InjuryLookupResponse = await response.json();
    
    // Convert array to Map for O(1) lookups by odds_player_id
    data.players.forEach((player) => {
      injuryMap.set(player.playerId, player);
    });
  }
  return injuryMap;
}

/**
 * Hook to fetch injury status for multiple players with smart caching
 * 
 * Features:
 * - 5 minute stale time (won't refetch for 5 minutes)
 * - 10 minute cache time (keeps data in memory for 10 minutes)
 * - Automatic deduplication (same query won't run twice)
 * - Returns Map for O(1) lookup by odds_player_id
 * - Automatic batching for large datasets (>500 players)
 */
export function usePlayerInjuries({ playerIds, enabled = true }: UsePlayerInjuriesOptions) {
  // Sort IDs for consistent cache key (["A", "B"] === ["B", "A"])
  const sortedIds = [...playerIds].sort();

  return useQuery({
    queryKey: ['player-injuries', sortedIds],
    queryFn: () => fetchPlayerInjuries(sortedIds),
    enabled: enabled && playerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnMount: false, // Don't refetch if data exists in cache
  });
}

/**
 * Helper function to check if a player has an injury
 * Returns true only if player has a meaningful injury status (not healthy/available)
 */
export function hasInjuryStatus(injuryStatus: string | null | undefined): boolean {
  if (!injuryStatus) return false;
  
  const status = injuryStatus.toLowerCase();
  // Don't show icon for healthy players
  if (status === 'available' || status === 'active' || status === 'healthy') {
    return false;
  }
  
  return true;
}

/**
 * Helper function to get injury icon color class
 */
export function getInjuryIconColorClass(injuryStatus: string | null | undefined): string {
  if (!injuryStatus) return 'text-neutral-400';
  
  const status = injuryStatus.toLowerCase();
  if (status === 'out') return 'text-red-500';
  if (status === 'questionable' || status === 'doubtful') return 'text-amber-500';
  if (status === 'probable') return 'text-emerald-500';
  
  return 'text-neutral-400';
}

/**
 * Helper function to check if injury is G-League assignment
 */
export function isGLeagueAssignment(injuryNotes: string | null | undefined): boolean {
  if (!injuryNotes) return false;
  const notes = injuryNotes.toLowerCase();
  return notes.includes('g league') || notes.includes('g-league') || notes.includes('gleague');
}


import { useQuery } from "@tanstack/react-query";
import type { 
  TeamShotZoneRanksResponse, 
  ShotZoneData, 
  ShotZoneTeamData 
} from "@/app/api/nba/team-shot-zone-ranks/route";

export type { ShotZoneData, ShotZoneTeamData, TeamShotZoneRanksResponse };

// Shot zone keys for filtering (matches RPC output zone names)
export const SHOT_ZONE_KEYS = [
  { key: "Restricted Area", label: "At Rim", description: "Restricted area (layups/dunks)" },
  { key: "In The Paint (Non-RA)", label: "Paint", description: "In the paint (non-RA)" },
  { key: "Mid-Range", label: "Mid-Range", description: "Mid-range jumpers" },
  { key: "Left Corner 3", label: "Corner 3 (L)", description: "Left corner three-pointers" },
  { key: "Right Corner 3", label: "Corner 3 (R)", description: "Right corner three-pointers" },
  { key: "Above the Break 3", label: "Above Break 3", description: "Above the break three-pointers" },
  { key: "Backcourt", label: "Backcourt", description: "Backcourt shots" },
] as const;

export type ShotZoneKey = typeof SHOT_ZONE_KEYS[number]["key"];

interface UseTeamShotZoneRanksOptions {
  season?: string;
  enabled?: boolean;
}

async function fetchTeamShotZoneRanks(season?: string): Promise<TeamShotZoneRanksResponse> {
  const params = new URLSearchParams();
  if (season) params.set("season", season);

  const res = await fetch(`/api/nba/team-shot-zone-ranks?${params.toString()}`);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch team shot zone ranks: ${res.status}`);
  }
  
  return res.json();
}

export function useTeamShotZoneRanks({ season, enabled = true }: UseTeamShotZoneRanksOptions = {}) {
  const query = useQuery({
    queryKey: ["team-shot-zone-ranks", season],
    queryFn: () => fetchTeamShotZoneRanks(season),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    zones: query.data?.zones ?? [],
    zoneList: query.data?.zoneList ?? [],
    season: query.data?.season ?? "2025-26",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isAvailable: (query.data?.zones?.length ?? 0) > 0, // True when backend data is available
  };
}

// Helper to build a lookup map: zone -> teamAbbr -> team data
export function buildShotZoneRanksMap(
  zones: ShotZoneData[]
): Map<string, Map<string, ShotZoneTeamData>> {
  const map = new Map<string, Map<string, ShotZoneTeamData>>();
  
  for (const zone of zones) {
    const teamMap = new Map<string, ShotZoneTeamData>();
    for (const team of zone.teams) {
      teamMap.set(team.teamAbbr, team);
    }
    map.set(zone.zone, teamMap);
  }
  
  return map;
}

// Helper to get team rank for a specific shot zone
export function getTeamShotZoneRank(
  zones: ShotZoneData[],
  zoneKey: string,
  teamAbbr: string
): ShotZoneTeamData | undefined {
  const zone = zones.find(z => z.zone === zoneKey);
  if (!zone) return undefined;
  return zone.teams.find(t => t.teamAbbr === teamAbbr);
}

// Helper to get all teams with their rank for a specific shot zone
export function getShotZoneTeams(
  zones: ShotZoneData[],
  zoneKey: string
): ShotZoneTeamData[] {
  const zone = zones.find(z => z.zone === zoneKey);
  return zone?.teams ?? [];
}

// Get teams by matchup label (tough/neutral/favorable)
export function getTeamsByShotZoneMatchup(
  zones: ShotZoneData[],
  zoneKey: string,
  matchupLabel: "tough" | "neutral" | "favorable"
): string[] {
  const teams = getShotZoneTeams(zones, zoneKey);
  return teams
    .filter(t => t.matchupLabel === matchupLabel)
    .map(t => t.teamAbbr);
}

// Helper to get rank color
export function getShotZoneRankColor(rank: number | null): string {
  if (rank === null) return "text-neutral-500";
  if (rank <= 10) return "text-red-600 dark:text-red-400"; // Tough
  if (rank >= 21) return "text-emerald-600 dark:text-emerald-400"; // Favorable
  return "text-neutral-600 dark:text-neutral-400"; // Neutral
}

// Get matchup label from rank
export function getShotZoneMatchupLabel(rank: number | null): "tough" | "neutral" | "favorable" | null {
  if (rank === null) return null;
  if (rank <= 10) return "tough";
  if (rank >= 21) return "favorable";
  return "neutral";
}

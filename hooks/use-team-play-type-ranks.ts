import { useQuery } from "@tanstack/react-query";
import type { 
  TeamPlayTypeRanksResponse, 
  PlayTypeData, 
  PlayTypeTeamData 
} from "@/app/api/nba/team-play-type-ranks/route";

export type { PlayTypeData, PlayTypeTeamData, TeamPlayTypeRanksResponse };

// Play type keys for filtering (matches RPC output)
export const PLAY_TYPE_KEYS = [
  { key: "Spotup", label: "Spot Up", description: "Catch and shoot opportunities" },
  { key: "Transition", label: "Transition", description: "Fast break scoring" },
  { key: "PRBallHandler", label: "P&R Ball Handler", description: "Pick & Roll ball handler" },
  { key: "PRRollman", label: "P&R Roll Man", description: "Pick & Roll roll/pop man" },
  { key: "Postup", label: "Post Up", description: "Back-to-basket post plays" },
  { key: "Isolation", label: "Isolation", description: "1-on-1 isolation plays" },
  { key: "Cut", label: "Cut", description: "Cutting to the basket" },
  { key: "OffScreen", label: "Off Screen", description: "Coming off screens" },
  { key: "Handoff", label: "Handoff", description: "Dribble handoff plays" },
  { key: "Putbacks", label: "Putbacks", description: "Offensive rebound putbacks" },
  { key: "FreeThrows", label: "Free Throws", description: "Free throw attempts allowed" },
] as const;

export type PlayTypeKey = typeof PLAY_TYPE_KEYS[number]["key"];

interface UseTeamPlayTypeRanksOptions {
  season?: string;
  enabled?: boolean;
}

async function fetchTeamPlayTypeRanks(season?: string): Promise<TeamPlayTypeRanksResponse> {
  const params = new URLSearchParams();
  if (season) params.set("season", season);

  const res = await fetch(`/api/nba/team-play-type-ranks?${params.toString()}`);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch team play type ranks: ${res.status}`);
  }
  
  return res.json();
}

export function useTeamPlayTypeRanks({ season, enabled = true }: UseTeamPlayTypeRanksOptions = {}) {
  const query = useQuery({
    queryKey: ["team-play-type-ranks", season],
    queryFn: () => fetchTeamPlayTypeRanks(season),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    playTypes: query.data?.playTypes ?? [],
    displayNames: query.data?.displayNames ?? {},
    season: query.data?.season ?? "2025-26",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isAvailable: (query.data?.playTypes?.length ?? 0) > 0, // True when backend data is available
  };
}

// Helper to build a lookup map: playType -> teamAbbr -> team data
export function buildPlayTypeRanksMap(
  playTypes: PlayTypeData[]
): Map<string, Map<string, PlayTypeTeamData>> {
  const map = new Map<string, Map<string, PlayTypeTeamData>>();
  
  for (const pt of playTypes) {
    const teamMap = new Map<string, PlayTypeTeamData>();
    for (const team of pt.teams) {
      teamMap.set(team.teamAbbr, team);
    }
    map.set(pt.playType, teamMap);
  }
  
  return map;
}

// Helper to get team rank for a specific play type
export function getTeamPlayTypeRank(
  playTypes: PlayTypeData[],
  playTypeKey: string,
  teamAbbr: string
): PlayTypeTeamData | undefined {
  const pt = playTypes.find(p => p.playType === playTypeKey);
  if (!pt) return undefined;
  return pt.teams.find(t => t.teamAbbr === teamAbbr);
}

// Helper to get all teams with their rank for a specific play type
export function getPlayTypeTeams(
  playTypes: PlayTypeData[],
  playTypeKey: string
): PlayTypeTeamData[] {
  const pt = playTypes.find(p => p.playType === playTypeKey);
  return pt?.teams ?? [];
}

// Get teams by matchup label (tough/neutral/favorable)
export function getTeamsByPlayTypeMatchup(
  playTypes: PlayTypeData[],
  playTypeKey: string,
  matchupLabel: "tough" | "neutral" | "favorable"
): string[] {
  const teams = getPlayTypeTeams(playTypes, playTypeKey);
  return teams
    .filter(t => t.matchupLabel === matchupLabel)
    .map(t => t.teamAbbr);
}

// Helper to get rank color
export function getPlayTypeRankColor(rank: number | null): string {
  if (rank === null) return "text-neutral-500";
  if (rank <= 10) return "text-red-600 dark:text-red-400"; // Tough
  if (rank >= 21) return "text-emerald-600 dark:text-emerald-400"; // Favorable
  return "text-neutral-600 dark:text-neutral-400"; // Neutral
}

// Get matchup label from rank
export function getPlayTypeMatchupLabel(rank: number | null): "tough" | "neutral" | "favorable" | null {
  if (rank === null) return null;
  if (rank <= 10) return "tough";
  if (rank >= 21) return "favorable";
  return "neutral";
}

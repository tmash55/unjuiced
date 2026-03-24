"use client";

import { useQuery } from "@tanstack/react-query";

export interface BatterZoneCell {
  zone: number;
  pitches_seen: number | null;
  swing_pct: number | null;
  whiff_pct: number | null;
  contact_pct: number | null;
  temp: string | null; // "hot" | "warm" | "lukewarm" | "cold"
}

export interface PitcherZoneCell {
  zone: number;
  pitches_thrown: number | null;
  zone_pct: number | null;
  whiffs_generated: number | null;
  temp: string | null;
}

export interface OverlayZoneCell {
  zone: number;
  pitcher_zone_pct: number | null;
  batter_whiff_pct: number | null;
  advantage: string | null; // "batter_advantage" | "pitcher_advantage" | "neutral" | "dead_zone"
  temp: string | null;
  value: number | null;
}

export interface HotZonePitchType {
  pitch_type: string | null;
  pitch_name: string | null;
  usage_pct: number | null;
}

interface HotZoneData {
  batterZones: BatterZoneCell[];
  pitcherZones: PitcherZoneCell[];
  overlay: OverlayZoneCell[];
  pitchTypes: HotZonePitchType[];
}

async function fetchHotZone(batterId: number, pitcherId: number, pitchType?: string): Promise<HotZoneData> {
  const params = new URLSearchParams({
    batterId: String(batterId),
    pitcherId: String(pitcherId),
    batterWindow: "season",
    pitcherWindow: "season",
  });
  if (pitchType) params.set("pitchType", pitchType);

  const res = await fetch(`/api/mlb/hot-zone-matchup?${params.toString()}`);
  if (!res.ok) return { batterZones: [], pitcherZones: [], overlay: [], pitchTypes: [] };
  const data = await res.json();

  const batterZones: BatterZoneCell[] = (data.batter_zones ?? [])
    .filter((z: any) => z?.zone >= 1 && z?.zone <= 9)
    .map((z: any) => ({
      zone: z.zone,
      pitches_seen: z.pitches_seen ?? null,
      swing_pct: z.swing_pct ?? null,
      whiff_pct: z.whiff_pct ?? null,
      contact_pct: z.contact_pct ?? null,
      temp: z.temp ?? null,
    }));

  const pitcherZones: PitcherZoneCell[] = (data.pitcher_zones ?? [])
    .filter((z: any) => z?.zone >= 1 && z?.zone <= 9)
    .map((z: any) => ({
      zone: z.zone,
      pitches_thrown: z.pitches_thrown ?? null,
      zone_pct: z.zone_pct ?? null,
      whiffs_generated: z.whiffs_generated ?? null,
      temp: z.temp ?? null,
    }));

  const overlay: OverlayZoneCell[] = (data.matchup_overlay ?? [])
    .filter((z: any) => z?.zone >= 1 && z?.zone <= 9)
    .map((z: any) => ({
      zone: z.zone,
      pitcher_zone_pct: z.pitcher_zone_pct ?? null,
      batter_whiff_pct: z.batter_whiff_pct ?? null,
      advantage: z.advantage ?? null,
      temp: z.temp ?? null,
      value: z.value ?? null,
    }));

  // Extract available pitch types from pitcher_pitch_mix (always returns all types)
  const pitchTypes: HotZonePitchType[] = (data.pitcher_pitch_mix ?? [])
    .filter((p: any) => p?.pitch_type)
    .map((p: any) => ({
      pitch_type: p.pitch_type ?? null,
      pitch_name: p.pitch_name ?? null,
      usage_pct: p.usage_pct ?? p.pct ?? null,
    }))
    .sort((a: HotZonePitchType, b: HotZonePitchType) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));

  return { batterZones, pitcherZones, overlay, pitchTypes };
}

export function useMlbHotZone(
  batterId: number | null,
  pitcherId: number | null,
  enabled: boolean,
  pitchType?: string
) {
  const query = useQuery<HotZoneData>({
    queryKey: ["mlb-hot-zone", batterId, pitcherId, pitchType ?? "all"],
    queryFn: () => fetchHotZone(batterId!, pitcherId!, pitchType),
    enabled: enabled && batterId != null && pitcherId != null,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

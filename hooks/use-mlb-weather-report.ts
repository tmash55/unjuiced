"use client";

import { useQuery } from "@tanstack/react-query";

export interface MlbWeatherReportRow {
  gameId: number;
  venueId: number;
  gameDate: string;
  gameDatetime: string;
  temperatureF: number | null;
  feelsLikeF: number | null;
  humidityPct: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  windDirectionDeg: number | null;
  windRelativeDeg: number | null;
  windLabel: string | null;
  windImpact: string | null;
  hrImpactScore: number | null;
  totalImpact: string | null;
  weatherAlert: string | null;
  precipProbability: number | null;
  pressureMslHpa: number | null;
  cloudCoverPct: number | null;
  uvIndex: number | null;
  roofType: string | null;
  venueName: string | null;
  elevationFt: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamAbbr: string | null;
  awayTeamAbbr: string | null;
  venueCity: string | null;
  venueState: string | null;
  wallHeights: {
    lf: number | null;
    lcf: number | null;
    cf: number | null;
    rcf: number | null;
    rf: number | null;
  };
  fieldDistances: {
    leftLine: number | null;
    leftCenter: number | null;
    centerField: number | null;
    rightCenter: number | null;
    rightLine: number | null;
  };
  stadiumGeometry: {
    outfieldOuter: number[][];
    outfieldInner: number[][];
    infieldOuter: number[][];
    infieldInner: number[][];
    foulLines: number[][];
    homePlate: number[][];
    season: number | null;
  } | null;
}

interface MlbWeatherReportResponse {
  date: string;
  rows: MlbWeatherReportRow[];
  count: number;
}

function getETDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function fetchMlbWeatherReport(date?: string): Promise<MlbWeatherReportResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);

  const res = await fetch(`/api/mlb/weather-report${params.toString() ? `?${params.toString()}` : ""}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to fetch MLB weather report");
  }

  return res.json();
}

export function useMlbWeatherReport(date?: string) {
  const effectiveDate = date || getETDate(0);

  const query = useQuery<MlbWeatherReportResponse>({
    queryKey: ["mlb-weather-report", effectiveDate],
    queryFn: () => fetchMlbWeatherReport(effectiveDate),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    date: query.data?.date ?? effectiveDate,
    rows: query.data?.rows ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

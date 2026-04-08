"use client";

import React, { useMemo } from "react";
import { Loader2, CloudOff } from "lucide-react";
import { useMlbWeatherReport } from "@/hooks/use-mlb-weather-report";
import { HREnvironmentDetail } from "@/components/cheat-sheet/mlb/hr-environment-detail";

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function WeatherView({ gameId }: { gameId: number }) {
  const date = getETDate();
  const { rows, isLoading } = useMlbWeatherReport(date);

  const gameRow = useMemo(
    () => rows.find((r) => r.gameId === gameId) ?? null,
    [rows, gameId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading weather...</span>
      </div>
    );
  }

  if (!gameRow) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <CloudOff className="w-8 h-8 mb-2 text-neutral-400" />
        <span className="text-sm">No weather data available for this game</span>
      </div>
    );
  }

  return <HREnvironmentDetail row={gameRow} date={date} />;
}

"use client";

import { notFound } from "next/navigation";
import { use } from "react";
import { PlayerDrilldownPageShell } from "@/components/hit-rates/drilldown/player-drilldown-page-shell";
import { isDrilldownSport } from "@/components/hit-rates/drilldown/types";

interface PlayerProfilePageProps {
  params: Promise<{ sport: string; id: string }>;
}

export default function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const resolvedParams = use(params);
  const sport = resolvedParams.sport?.toLowerCase();

  if (!isDrilldownSport(sport)) {
    notFound();
  }

  return <PlayerDrilldownPageShell sport={sport} playerIdParam={resolvedParams.id} />;
}

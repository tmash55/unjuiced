"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Tile } from "../shared/tile";
import { useTeamDefenseRanks } from "@/hooks/use-team-defense-ranks";
import { useTeamPace } from "@/hooks/use-team-pace";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import type { PaceRecentContext } from "@/lib/basketball/pace-context";

type Tab = "pace" | "defense";

interface MatchupContextPanelProps {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
  className?: string;
}

// Quick-glance matchup context. Two tabs:
// - Pace: side-by-side L5 / L10 / Season pace + rank for player team and
//   opponent. Prefer the row's shared pace_context, with the legacy NBA lookup
//   as a fallback for older payloads.
// - Defense: opponent's defensive rank vs the player's position for the
//   active market, with avg allowed.
export function MatchupContextPanel({
  profile,
  sport,
  className,
}: MatchupContextPanelProps) {
  const [tab, setTab] = useState<Tab>("pace");

  return (
    <Tile
      label="Matchup Context"
      className={className}
      headerRight={
        <div className="flex items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
          <TabBtn active={tab === "pace"} onClick={() => setTab("pace")}>
            Pace
          </TabBtn>
          <TabBtn active={tab === "defense"} onClick={() => setTab("defense")}>
            Defense
          </TabBtn>
        </div>
      }
    >
      {tab === "pace" ? (
        <PaceTab profile={profile} sport={sport} />
      ) : (
        <DefenseTab profile={profile} sport={sport} />
      )}
    </Tile>
  );
}

// ── Pace tab ──────────────────────────────────────────────────────────────

function PaceTab({ profile, sport }: { profile: HitRateProfile; sport: "nba" | "wnba" }) {
  const embeddedPace = profile.paceContext;
  const hasEmbeddedPace =
    !!embeddedPace &&
    (hasPaceValue(embeddedPace.teamRecent) ||
      hasPaceValue(embeddedPace.opponentRecent));
  const teamIds = [profile.teamId, profile.opponentTeamId].filter(
    (id): id is number => typeof id === "number" && id > 0
  );
  const { teams, totalTeams, isLoading } = useTeamPace({
    teamIds,
    sport,
    enabled: !hasEmbeddedPace && teamIds.length > 0,
  });

  if (!hasEmbeddedPace && isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/60" />
        ))}
      </div>
    );
  }

  const playerRow = embeddedPace?.teamRecent
    ? toPaceStats(embeddedPace.teamRecent)
    : profile.teamId
      ? teams[String(profile.teamId)]
      : null;
  const oppRow = embeddedPace?.opponentRecent
    ? toPaceStats(embeddedPace.opponentRecent)
    : profile.opponentTeamId
      ? teams[String(profile.opponentTeamId)]
      : null;
  const paceTotalTeams = totalTeams || (sport === "nba" ? 30 : 15);

  if (!playerRow && !oppRow) {
    return (
      <div className="rounded-md bg-neutral-50/60 px-2.5 py-3 text-center text-[11px] font-medium text-neutral-400 dark:bg-neutral-900/40 dark:text-neutral-500">
        No pace context for this matchup yet.
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
          <th className="py-1 text-left">Team</th>
          <th className="py-1 text-right">L5</th>
          <th className="py-1 text-right">L10</th>
          <th className="py-1 text-right">SZN</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
        <PaceTableRow
          team={profile.teamAbbr ?? "—"}
          isOpponent={false}
          totalTeams={paceTotalTeams}
          stats={playerRow}
        />
        <PaceTableRow
          team={profile.opponentTeamAbbr ?? "—"}
          isOpponent={true}
          totalTeams={paceTotalTeams}
          stats={oppRow}
        />
      </tbody>
    </table>
  );
}

type PaceStats = {
  l5: { pace: number | null; rank: number | null };
  l10: { pace: number | null; rank: number | null };
  season: { pace: number | null; rank: number | null };
};

function toPaceStats(context: PaceRecentContext): PaceStats {
  return {
    l5: { pace: context.l5, rank: context.l5Rank ?? null },
    l10: { pace: context.l10, rank: context.l10Rank ?? null },
    season: { pace: context.season, rank: context.seasonRank ?? null },
  };
}

function hasPaceValue(context?: PaceRecentContext | null) {
  return (
    typeof context?.l5 === "number" ||
    typeof context?.l10 === "number" ||
    typeof context?.season === "number"
  );
}

function PaceTableRow({
  team,
  isOpponent,
  totalTeams,
  stats,
}: {
  team: string;
  isOpponent: boolean;
  totalTeams: number;
  stats: PaceStats | null | undefined;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-2">
        <span
          className={cn(
            "rounded-sm px-1 py-px text-[9px] font-black tracking-wide",
            isOpponent
              ? "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300"
              : "bg-brand/10 text-brand dark:bg-brand/15"
          )}
        >
          {team}
        </span>
      </td>
      <PaceCell entry={stats?.l5 ?? null} totalTeams={totalTeams} />
      <PaceCell entry={stats?.l10 ?? null} totalTeams={totalTeams} />
      <PaceCell entry={stats?.season ?? null} totalTeams={totalTeams} />
    </tr>
  );
}

function PaceCell({
  entry,
  totalTeams,
}: {
  entry: { pace: number | null; rank: number | null } | null;
  totalTeams: number;
}) {
  if (!entry || entry.pace === null) {
    return <td className="py-1.5 pl-1 text-right text-neutral-400">—</td>;
  }
  // Higher pace = faster game = good for over-on-counting-stats. Rank 1 =
  // fastest team. Color the rank: top third bright, bottom third muted.
  const rank = entry.rank ?? null;
  const tier =
    rank === null
      ? "mid"
      : rank <= Math.round(totalTeams / 3)
      ? "fast"
      : rank > Math.round((totalTeams * 2) / 3)
      ? "slow"
      : "mid";
  const rankColor =
    tier === "fast"
      ? "text-emerald-600 dark:text-emerald-400"
      : tier === "slow"
      ? "text-red-500 dark:text-red-400"
      : "text-neutral-500 dark:text-neutral-400";
  return (
    <td className="py-1.5 pl-1 text-right">
      <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
        <span className="text-[12px] font-black text-neutral-900 dark:text-white">
          {entry.pace.toFixed(1)}
        </span>
        {rank !== null && (
          <span className={cn("text-[9px] font-bold", rankColor)}>#{rank}</span>
        )}
      </div>
    </td>
  );
}

// ── Defense tab ───────────────────────────────────────────────────────────

function DefenseTab({
  profile,
  sport,
}: {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
}) {
  const { positions, meta, isLoading } = useTeamDefenseRanks({
    opponentTeamId: profile.opponentTeamId,
    sport,
    enabled: !!profile.opponentTeamId,
  });

  const position = (profile.position ?? "").toUpperCase().split("-")[0];
  const totalTeams = meta?.totalTeams ?? (sport === "nba" ? 30 : 15);

  // Show all the markets we care about for this position. The active market
  // gets a brand-tinted highlight so the user sees the matchup at a glance.
  const marketsToShow = [
    { market: "player_points", label: "PTS" },
    { market: "player_rebounds", label: "REB" },
    { market: "player_assists", label: "AST" },
    { market: "player_threes_made", label: "3PM" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/60" />
        ))}
      </div>
    );
  }

  if (!position || !positions[position]) {
    return (
      <div className="rounded-md bg-neutral-50/60 px-2.5 py-3 text-center text-[11px] font-medium text-neutral-400 dark:bg-neutral-900/40 dark:text-neutral-500">
        No defensive rank for this matchup yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
        {profile.opponentTeamAbbr ?? "OPP"} vs {position}
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
            <th className="py-1 text-left">Stat</th>
            <th className="py-1 text-right">Allowed</th>
            <th className="py-1 text-right">Rank</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
          {marketsToShow.map((m) => {
            const info = positions[position]?.[m.market];
            const isActive = m.market === profile.market;
            return (
              <DefenseTableRow
                key={m.market}
                label={m.label}
                allowed={info?.avgAllowed ?? null}
                rank={info?.rank ?? null}
                totalTeams={totalTeams}
                isActive={isActive}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DefenseTableRow({
  label,
  allowed,
  rank,
  totalTeams,
  isActive,
}: {
  label: string;
  allowed: number | null;
  rank: number | null;
  totalTeams: number;
  isActive: boolean;
}) {
  const tier =
    rank === null
      ? "mid"
      : rank <= Math.round(totalTeams / 3)
      ? "tough"
      : rank > Math.round((totalTeams * 2) / 3)
      ? "soft"
      : "mid";
  const rankColor =
    tier === "tough"
      ? "text-red-500 dark:text-red-400"
      : tier === "soft"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-neutral-500 dark:text-neutral-400";
  return (
    <tr className={cn(isActive && "bg-brand/[0.06] dark:bg-brand/[0.08]")}>
      <td className="py-1.5 pr-2">
        <span
          className={cn(
            "text-[11px] font-bold",
            isActive
              ? "text-brand"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        >
          {label}
        </span>
      </td>
      <td className="py-1.5 pl-1 text-right text-[12px] font-black tabular-nums text-neutral-900 dark:text-white">
        {allowed !== null ? allowed.toFixed(1) : "—"}
      </td>
      <td className={cn("py-1.5 pl-1 text-right text-[11px] font-bold tabular-nums", rankColor)}>
        {rank !== null ? `#${rank}` : "—"}
      </td>
    </tr>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

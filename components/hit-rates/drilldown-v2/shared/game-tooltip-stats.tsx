"use client";

import React from "react";
import type { BoxScoreGame } from "@/hooks/use-player-box-scores";

// Market-specific stat rows for the chart's bar tooltip. Mirrors v1's
// getMarketStats but with v2's typography. Returns one row per stat — Minutes/
// Fouls common to every basketball market, then market-specific breakouts.

const StatRow = ({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string | number;
  subValue?: string;
}) => (
  <div className="flex items-center justify-between py-[3px]">
    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
      {label}
    </span>
    <span className="text-[11px] font-bold tabular-nums text-neutral-800 dark:text-white">
      {value}
      {subValue && (
        <span className="ml-1.5 font-normal text-neutral-400 dark:text-neutral-500">
          ({subValue})
        </span>
      )}
    </span>
  </div>
);

const Divider = () => (
  <div className="my-2 border-t border-neutral-200/60 dark:border-neutral-700/40" />
);

const formatPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;

const formatUsage = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  // box-score data sometimes ships as 0..1, sometimes already as 0..100
  const n = v < 1 ? v * 100 : v;
  return `${n.toFixed(1)}%`;
};

export function getGameStatRows(game: BoxScoreGame, market: string): React.ReactNode {
  const minutesRow = <StatRow label="Minutes" value={Math.round(game.minutes)} />;
  const foulsRow = <StatRow label="Fouls" value={game.fouls} />;
  const common = (
    <>
      {minutesRow}
      {foulsRow}
    </>
  );

  switch (market) {
    case "player_points":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="FG" value={`${game.fgm}/${game.fga}`} subValue={formatPct(game.fgPct)} />
          <StatRow label="3PT" value={`${game.fg3m}/${game.fg3a}`} subValue={formatPct(game.fg3Pct)} />
          <StatRow label="FT" value={`${game.ftm}/${game.fta}`} subValue={formatPct(game.ftPct)} />
        </>
      );

    case "player_rebounds":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="OREB" value={game.oreb} />
          <StatRow label="DREB" value={game.dreb} />
          <StatRow label="Total REB" value={game.reb} />
          {game.potentialReb > 0 && <StatRow label="Potential REB" value={game.potentialReb} />}
        </>
      );

    case "player_assists":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Assists" value={game.ast} />
          {game.potentialAssists !== null && game.potentialAssists !== undefined && (
            <StatRow label="Potential AST" value={game.potentialAssists} />
          )}
          {game.passes > 0 && <StatRow label="Passes" value={game.passes} />}
          <StatRow label="Turnovers" value={game.tov} />
          <StatRow
            label="AST/TO"
            value={
              game.ast === 0
                ? "0"
                : game.tov === 0
                ? game.ast.toString()
                : (game.ast / Math.max(1, game.tov)).toFixed(1)
            }
          />
        </>
      );

    case "player_threes_made":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="3PT" value={`${game.fg3m}/${game.fg3a}`} subValue={formatPct(game.fg3Pct)} />
          <StatRow label="FG" value={`${game.fgm}/${game.fga}`} subValue={formatPct(game.fgPct)} />
          <StatRow label="FT" value={`${game.ftm}/${game.fta}`} subValue={formatPct(game.ftPct)} />
        </>
      );

    case "player_steals":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Steals" value={game.stl} />
          <StatRow label="Blocks" value={game.blk} />
        </>
      );

    case "player_blocks":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Blocks" value={game.blk} />
          <StatRow label="Steals" value={game.stl} />
        </>
      );

    case "player_blocks_steals":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Blocks" value={game.blk} />
          <StatRow label="Steals" value={game.stl} />
          <StatRow label="Blk+Stl" value={game.bs} />
        </>
      );

    case "player_points_assists":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="P+A Total" value={game.pa} />
        </>
      );

    case "player_points_rebounds":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="P+R Total" value={game.pr} />
        </>
      );

    case "player_rebounds_assists":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow label="R+A Total" value={game.ra} />
        </>
      );

    case "player_points_rebounds_assists":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Points" value={game.pts} />
          <StatRow label="Rebounds" value={game.reb} />
          <StatRow label="Assists" value={game.ast} />
          <Divider />
          <StatRow label="PRA Total" value={game.pra} />
          {game.usagePct !== null && game.usagePct !== undefined && (
            <StatRow label="Usage" value={formatUsage(game.usagePct)} />
          )}
        </>
      );

    case "player_turnovers":
      return (
        <>
          {common}
          <Divider />
          <StatRow label="Turnovers" value={game.tov} />
          <StatRow label="Assists" value={game.ast} />
          <StatRow
            label="AST/TO"
            value={
              game.ast === 0
                ? "0"
                : game.tov === 0
                ? game.ast.toString()
                : (game.ast / Math.max(1, game.tov)).toFixed(1)
            }
          />
          {game.passes > 0 && <StatRow label="Passes" value={game.passes} />}
          {game.usagePct !== null && game.usagePct !== undefined && (
            <StatRow label="Usage" value={formatUsage(game.usagePct)} />
          )}
        </>
      );

    default:
      return common;
  }
}

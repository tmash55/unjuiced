"use client";

import React from "react";
import { cn } from "@/lib/utils";
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

const formatMinutes = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v < 14 ? v.toFixed(1) : Math.round(v).toString();
};

export function getGameStatRows(game: BoxScoreGame, market: string): React.ReactNode {
  const isQ1Market = market.startsWith("1st_quarter_player_");
  const minutesRow = (
    <StatRow
      label={isQ1Market ? "Q1 Minutes" : "Minutes"}
      value={formatMinutes(isQ1Market ? game.q1Minutes : game.minutes)}
    />
  );
  const starterRow = isQ1Market && game.isStarter !== null && game.isStarter !== undefined ? (
    <StatRow label="Started" value={game.isStarter ? "Yes" : "No"} />
  ) : null;
  const foulsRow = <StatRow label="Fouls" value={game.fouls} />;
  const common = (
    <>
      {minutesRow}
      {starterRow}
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
          {game.potentialReb > 0 && <StatRow label="Potential REB" value={game.potentialReb} />}
          <StatRow label="Assists" value={game.ast} />
          {game.potentialAssists !== null && game.potentialAssists !== undefined && (
            <StatRow label="Potential AST" value={game.potentialAssists} />
          )}
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

    case "player_double_double":
    case "player_triple_double":
      return <DoubleDoubleStatRows game={game} common={common} required={market === "player_triple_double" ? 3 : 2} />;

    case "1st_quarter_player_points":
    case "1st_quarter_player_rebounds":
    case "1st_quarter_player_assists":
      return (
        <>
          {common}
          <Divider />
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
            1st Quarter
          </div>
          <StatRow label="PTS" value={game.q1Pts ?? 0} />
          <StatRow label="REB" value={game.q1Reb ?? 0} />
          <StatRow label="AST" value={game.q1Ast ?? 0} />
          <StatRow label="STL" value={game.q1Stl ?? 0} />
          <StatRow label="BLK" value={game.q1Blk ?? 0} />
          {(game.q1Fga ?? 0) > 0 && (
            <StatRow
              label="FG"
              value={`${game.q1Fgm ?? 0}/${game.q1Fga ?? 0}`}
              subValue={formatPct((game.q1Fgm ?? 0) / Math.max(1, game.q1Fga ?? 0))}
            />
          )}
          {(game.q1Fg3a ?? 0) > 0 && (
            <StatRow
              label="3PT"
              value={`${game.q1Fg3m ?? 0}/${game.q1Fg3a ?? 0}`}
              subValue={formatPct((game.q1Fg3m ?? 0) / Math.max(1, game.q1Fg3a ?? 0))}
            />
          )}
        </>
      );

    default:
      return common;
  }
}

// Renders the 5 traditional categories (PTS/REB/AST/STL/BLK) with the ones in
// double figures bolded + tinted. Lets the user see at a glance which boxes
// the player checked toward DD/TD this game and which they missed.
function DoubleDoubleStatRows({
  game,
  common,
  required,
}: {
  game: BoxScoreGame;
  common: React.ReactNode;
  required: 2 | 3;
}) {
  const cats: Array<{ label: string; value: number }> = [
    { label: "PTS", value: game.pts },
    { label: "REB", value: game.reb },
    { label: "AST", value: game.ast },
    { label: "STL", value: game.stl },
    { label: "BLK", value: game.blk },
  ];
  const hits = cats.filter((c) => c.value >= 10).length;
  const achieved = hits >= required;
  return (
    <>
      {common}
      <Divider />
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {required === 3 ? "Triple-Double" : "Double-Double"}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider tabular-nums ring-1",
            achieved
              ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400"
          )}
        >
          {hits}/{required}
        </span>
      </div>
      {cats.map((c) => {
        const qualifies = c.value >= 10;
        return (
          <div key={c.label} className="flex items-center justify-between py-[3px]">
            <span
              className={cn(
                "text-[11px]",
                qualifies
                  ? "font-bold text-neutral-800 dark:text-neutral-100"
                  : "font-medium text-neutral-500 dark:text-neutral-400"
              )}
            >
              {c.label}
            </span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                qualifies
                  ? "font-black text-emerald-600 dark:text-emerald-400"
                  : "font-bold text-neutral-800 dark:text-white"
              )}
            >
              {c.value}
            </span>
          </div>
        );
      })}
    </>
  );
}

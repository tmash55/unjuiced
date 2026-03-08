import type { PlayerBoxScoreGame } from "@unjuiced/types";
import { brandColors } from "@/src/theme/brand";

/* ─── Tab Types ─── */

export type TabId = "chart" | "shooting" | "playtypes" | "matchup" | "correlation" | "stats" | "odds";

export const TAB_LABELS: Record<TabId, string> = {
  chart: "Chart",
  shooting: "Shooting",
  playtypes: "Play Types",
  matchup: "Matchup",
  correlation: "Correlation",
  stats: "Stats",
  odds: "Odds"
};

/* ─── Market Labels ─── */

export const MARKET_LABELS: Record<string, string> = {
  player_points: "PTS",
  player_rebounds: "REB",
  player_assists: "AST",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  player_threes_made: "3PM",
  player_fgm: "FGM",
  player_steals: "STL",
  player_blocks: "BLK",
  player_turnovers: "TOV",
  player_blocks_steals: "B+S",
  player_double_double: "DD",
  player_triple_double: "TD",
  first_field_goal: "1st BKT",
  team_first_basket: "TM 1st",
  "1st_quarter_player_points": "1Q PTS",
  "1st_quarter_player_assists": "1Q AST",
  "1st_quarter_player_rebounds": "1Q REB"
};

export const MARKET_LABELS_LONG: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_points_rebounds_assists: "Pts + Reb + Ast",
  player_points_rebounds: "Pts + Reb",
  player_points_assists: "Pts + Ast",
  player_rebounds_assists: "Reb + Ast",
  player_threes_made: "3-Pointers Made",
  player_fgm: "Field Goals Made",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_turnovers: "Turnovers",
  player_blocks_steals: "Blk + Stl",
  player_double_double: "Double Double",
  player_triple_double: "Triple Double",
  first_field_goal: "1st Basket (Game)",
  team_first_basket: "1st Basket (Team)",
  "1st_quarter_player_points": "1st Quarter Points",
  "1st_quarter_player_assists": "1st Quarter Assists",
  "1st_quarter_player_rebounds": "1st Quarter Rebounds"
};

/* ─── Chart Constants ─── */

export const CHART_HEIGHT = 200;
export const CHART_BAR_W = 28;
export const CHART_BAR_GAP = 4;
export const RECENT_GAMES_LIMIT = 25;

export type ChartPeriod = "L5" | "L10" | "L20" | "SZN";
export const PERIOD_COUNTS: Record<ChartPeriod, number | null> = { L5: 5, L10: 10, L20: 20, SZN: null };

/* ─── Bar Colors (dark mode) ─── */

export const BAR_HIT = "#22C55E";
export const BAR_MISS = "#EF4444";
export const BAR_PUSH = "#F59E0B";
export const BAR_NO_LINE = "#6B7280";
export const TEXT_HIT = "#22C55E";
export const TEXT_MISS = "#F87171";
export const TEXT_PUSH = "#FBBF24";

/* ─── Streak Colors (intensity scales with streak length) ─── */

export function streakColor(streak: number): string {
  if (streak >= 10) return "#DC2626"; // red-600 — on fire
  if (streak >= 7) return "#EA580C";  // orange-600
  if (streak >= 5) return "#F97316";  // orange-500
  return "#F59E0B";                    // amber-500 (default 3-4)
}


/* ─── Injury Status Colors ─── */

export function injuryBorderColor(reason: string | null): string {
  if (!reason) return "rgba(255,255,255,0.08)";
  const r = reason.toLowerCase();
  if (r === "out" || r.includes("out") || r.includes("injury") || r.includes("illness")) return "#EF4444"; // red
  if (r === "doubtful" || r.includes("doubtful")) return "#F97316"; // orange
  if (r === "questionable" || r.includes("questionable") || r === "gtd" || r.includes("game time")) return "#EAB308"; // yellow
  if (r === "probable" || r.includes("probable")) return "#6B7280"; // gray
  if (r === "inactive" || r === "dnp" || r.startsWith("dnd") || r.includes("rest")) return "#6B7280"; // gray for non-injury absences
  return "#6B7280"; // default to gray for unknown status
}

export function injuryBgColor(reason: string | null): string {
  if (!reason) return "transparent";
  const r = reason.toLowerCase();
  if (r === "out" || r.includes("out") || r.includes("injury") || r.includes("illness")) return "rgba(239, 68, 68, 0.08)";
  if (r === "doubtful" || r.includes("doubtful")) return "rgba(249, 115, 22, 0.08)";
  if (r === "questionable" || r.includes("questionable") || r === "gtd" || r.includes("game time")) return "rgba(234, 179, 8, 0.08)";
  if (r === "inactive" || r === "dnp" || r.startsWith("dnd") || r.includes("rest")) return "rgba(107, 114, 128, 0.08)";
  return "rgba(107, 114, 128, 0.08)"; // default to gray
}

/* ─── Helpers ─── */

export function parseParam(v: string | string[] | undefined): string | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export function fmtPct(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}

export function fmtLine(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

export function fmtOdds(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v > 0 ? `+${v}` : String(v);
}

export function mktTab(m: string): string {
  return MARKET_LABELS[m] ?? m.replace("player_", "").replace(/_/g, " ").toUpperCase();
}

export function mktLong(m: string): string {
  return MARKET_LABELS_LONG[m] ?? m.replace("player_", "").replace(/_/g, " ");
}

export function barColor(val: number, line: number | null): { bar: string; text: string } {
  if (line == null) return { bar: BAR_NO_LINE, text: brandColors.textSecondary };
  if (val > line) return { bar: BAR_HIT, text: TEXT_HIT };
  if (val < line) return { bar: BAR_MISS, text: TEXT_MISS };
  return { bar: BAR_PUSH, text: TEXT_PUSH };
}

export function hitColor(pct: number | null | undefined): string {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return brandColors.textMuted;
  if (pct >= 70) return brandColors.success;
  if (pct >= 55) return brandColors.textPrimary;
  if (pct >= 40) return brandColors.warning;
  return brandColors.error;
}

export function fmtDate(v: string): string {
  const dt = new Date(v);
  if (!Number.isFinite(dt.getTime())) return v;
  return dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

export function fmtGameTime(v: string | null | undefined): string {
  if (!v) return "—";
  if (!/\d{4}/.test(v)) return v;
  const dt = new Date(v);
  if (!Number.isFinite(dt.getTime())) return v;
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    + " · "
    + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function fmtDateShort(v: string): string {
  const dt = new Date(v);
  if (!Number.isFinite(dt.getTime())) return v;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getGameStat(game: PlayerBoxScoreGame, market: string): number {
  switch (market) {
    case "player_points": return game.pts;
    case "player_rebounds": return game.reb;
    case "player_assists": return game.ast;
    case "player_threes_made": return game.fg3m;
    case "player_fgm": return game.fgm;
    case "player_steals": return game.stl;
    case "player_blocks": return game.blk;
    case "player_turnovers": return game.tov;
    case "player_points_rebounds_assists": return game.pra;
    case "player_points_rebounds": return game.pr;
    case "player_points_assists": return game.pa;
    case "player_rebounds_assists": return game.ra;
    case "player_blocks_steals": return game.bs;
    case "player_double_double": {
      const cats = [game.pts, game.reb, game.ast, game.stl, game.blk];
      return cats.filter((v) => v >= 10).length >= 2 ? 1 : 0;
    }
    case "player_triple_double": {
      const cats = [game.pts, game.reb, game.ast, game.stl, game.blk];
      return cats.filter((v) => v >= 10).length >= 3 ? 1 : 0;
    }
    default: return game.pts;
  }
}

export function getHitRate(games: PlayerBoxScoreGame[], market: string, line: number | null): number | null {
  if (!games.length || line == null || !Number.isFinite(line)) return null;
  const hits = games.filter((g) => getGameStat(g, market) >= line).length;
  return Math.round((hits / games.length) * 100);
}

export function getHitRateFraction(games: PlayerBoxScoreGame[], market: string, line: number | null): { pct: number | null; hits: number; total: number } {
  if (!games.length || line == null || !Number.isFinite(line)) return { pct: null, hits: 0, total: 0 };
  const hits = games.filter((g) => getGameStat(g, market) >= line).length;
  return { pct: Math.round((hits / games.length) * 100), hits, total: games.length };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/* ─── Defense Rank Color ─── */

export function rankColor(rank: number | null): string {
  if (rank == null) return brandColors.textMuted;
  if (rank <= 10) return "#EF4444"; // tough (red)
  if (rank <= 20) return "#F59E0B"; // neutral (amber)
  return "#22C55E"; // favorable (green)
}

export function rankBgColor(rank: number | null): string {
  if (rank == null) return "transparent";
  if (rank <= 10) return "rgba(239, 68, 68, 0.12)";
  if (rank <= 20) return "rgba(245, 158, 11, 0.12)";
  return "rgba(34, 197, 94, 0.12)";
}

export function matchupColor(rating: string): string {
  switch (rating) {
    case "favorable": return "#22C55E";
    case "unfavorable":
    case "tough": return "#EF4444";
    case "neutral": return "#F59E0B";
    default: return brandColors.textMuted;
  }
}

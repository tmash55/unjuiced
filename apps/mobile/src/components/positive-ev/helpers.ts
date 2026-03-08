import type { PositiveEVOpportunity } from "@unjuiced/types";
import { type EvTier, EV_TIER_THRESHOLDS, SPORT_OPTIONS, type SortField } from "./constants";
import { shortenMarketDisplay, humanizeMarketKey } from "@/src/lib/market-display";

export function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

export function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

export function getEvTier(ev: number): EvTier {
  for (const { tier, min } of EV_TIER_THRESHOLDS) {
    if (ev >= min) return tier;
  }
  return "standard";
}

export function sportLabel(sportId: string): string {
  return SPORT_OPTIONS.find((s) => s.id === sportId)?.label ?? sportId.toUpperCase();
}

export function getOpportunityTitle(opp: PositiveEVOpportunity): string {
  if (opp.playerName && !opp.playerName.includes("_")) return opp.playerName;
  if (opp.playerName?.includes("_")) return humanizeMarketKey(opp.playerName);
  const away = opp.awayTeam || "Away";
  const home = opp.homeTeam || "Home";
  return `${away} @ ${home}`;
}

export function normalizeBookLabel(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function probToAmerican(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) return Math.round((-100 * prob) / (1 - prob));
  return Math.round((100 * (1 - prob)) / prob);
}

export function getFairValueOdds(opp: PositiveEVOpportunity): number | null {
  if (!opp.sharpReference) return null;
  if (opp.side === "over" || opp.side === "yes") return opp.sharpReference.overOdds;
  if (opp.side === "under" || opp.side === "no") return opp.sharpReference.underOdds;
  return null;
}

export function formatGameInfo(opp: PositiveEVOpportunity): string {
  const parts: string[] = [];
  if (opp.awayTeam && opp.homeTeam) {
    parts.push(`${opp.awayTeam} @ ${opp.homeTeam}`);
  }
  if (opp.startTime) {
    const date = new Date(opp.startTime);
    if (Number.isFinite(date.getTime())) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (isToday) parts.push(timeStr);
      else if (isTomorrow) parts.push(`Tmrw ${timeStr}`);
      else parts.push(`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStr}`);
    }
  }
  return parts.join("  ");
}

export function getMarketShort(opp: PositiveEVOpportunity): string {
  if (opp.marketDisplay) return shortenMarketDisplay(opp.marketDisplay);
  return shortenMarketDisplay(
    opp.market.replace("player_", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function sortOpportunities(
  list: PositiveEVOpportunity[],
  field: SortField,
  dir: "asc" | "desc"
): PositiveEVOpportunity[] {
  const sorted = [...list];
  const mult = dir === "desc" ? -1 : 1;
  sorted.sort((a, b) => {
    switch (field) {
      case "ev": {
        const aEv = a.evCalculations?.evWorst ?? 0;
        const bEv = b.evCalculations?.evWorst ?? 0;
        return (aEv - bEv) * mult;
      }
      case "kelly": {
        const aK = a.evCalculations?.kellyWorst ?? 0;
        const bK = b.evCalculations?.kellyWorst ?? 0;
        return (aK - bK) * mult;
      }
      case "time": {
        const aT = a.startTime ? new Date(a.startTime).getTime() : Infinity;
        const bT = b.startTime ? new Date(b.startTime).getTime() : Infinity;
        return (aT - bT) * mult;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

export function filterBySearch(
  list: PositiveEVOpportunity[],
  searchText: string
): PositiveEVOpportunity[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return list;
  return list.filter((opp) => {
    const player = (opp.playerName ?? "").toLowerCase();
    const away = (opp.awayTeam ?? "").toLowerCase();
    const home = (opp.homeTeam ?? "").toLowerCase();
    const market = (opp.marketDisplay ?? opp.market ?? "").toLowerCase();
    return player.includes(q) || away.includes(q) || home.includes(q) || market.includes(q);
  });
}

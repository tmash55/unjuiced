import type { PositiveEVOpportunity } from "@/lib/ev/types";

const PLAYER_PROP_MARKET_PREFIXES = ["player_", "batter_", "pitcher_"];

export function getPositiveEVFavoriteType(
  opportunity: Pick<PositiveEVOpportunity, "market" | "playerId">
): "player" | "game" {
  const market = opportunity.market.toLowerCase();
  const isPlayerProp =
    Boolean(opportunity.playerId) ||
    PLAYER_PROP_MARKET_PREFIXES.some((prefix) => market.startsWith(prefix));

  return isPlayerProp ? "player" : "game";
}

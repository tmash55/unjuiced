const NBA_CDN_BASE = "https://cdn.nba.com/headshots/nba/latest";
const WNBA_CDN_BASE = "https://cdn.wnba.com/headshots/wnba/latest";
const MLB_CDN_BASE = "https://img.mlbstatic.com/mlb-photos/image/upload";

export type PlayerHeadshotSize = "tiny" | "small" | "large";
export type PlayerHeadshotSport = "nba" | "mlb" | "wnba";

const SIZE_CONFIG: Record<PlayerHeadshotSize, { path: string; width: number; height: number }> = {
  tiny: { path: "260x190", width: 28, height: 28 }, // Uses small CDN image, renders at 28x28
  small: { path: "260x190", width: 260, height: 190 },
  large: { path: "1040x760", width: 1040, height: 760 },
};

const FALLBACK_ID = "player_id";

export function getPlayerHeadshotUrl(
  playerId: number | string | null | undefined,
  size: PlayerHeadshotSize = "small",
  sport: PlayerHeadshotSport = "nba"
): string {
  const idSegment = playerId ? String(playerId) : FALLBACK_ID;
  if (sport === "mlb") {
    return getMlbHeadshotUrl(idSegment, size);
  }

  // WNBA player IDs in the DB come from the NBA Stats namespace (not the
  // stats.wnba.com namespace), so they resolve on cdn.nba.com — not
  // cdn.wnba.com. Use NBA CDN for both leagues until a separate mapping
  // is populated.
  const { path } = SIZE_CONFIG[size] ?? SIZE_CONFIG.small;
  return `${NBA_CDN_BASE}/${path}/${idSegment}.png`;
}

export function getMlbHeadshotUrl(
  mlbPlayerId: number | string | null | undefined,
  size: PlayerHeadshotSize = "small"
): string {
  const idSegment = mlbPlayerId ? String(mlbPlayerId) : FALLBACK_ID;
  const sizeToWidth: Record<PlayerHeadshotSize, number> = {
    tiny: 48,
    small: 260,
    large: 1040,
  };
  const width = sizeToWidth[size] ?? sizeToWidth.small;
  return `${MLB_CDN_BASE}/w_${width},q_100/v1/people/${idSegment}/headshot/silo/current`;
}

export function getPlayerHeadshotDimensions(size: PlayerHeadshotSize = "small") {
  return SIZE_CONFIG[size] ?? SIZE_CONFIG.small;
}

export function getFallbackHeadshotUrl(
  size: PlayerHeadshotSize = "small",
  sport: PlayerHeadshotSport = "nba"
) {
  return getPlayerHeadshotUrl(null, size, sport);
}

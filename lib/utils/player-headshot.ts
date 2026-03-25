const NBA_CDN_BASE = "https://cdn.nba.com/headshots/nba/latest";

export type PlayerHeadshotSize = "tiny" | "small" | "large";

const SIZE_CONFIG: Record<PlayerHeadshotSize, { path: string; width: number; height: number }> = {
  tiny: { path: "260x190", width: 28, height: 28 }, // Uses small CDN image, renders at 28x28
  small: { path: "260x190", width: 260, height: 190 },
  large: { path: "1040x760", width: 1040, height: 760 },
};

const FALLBACK_ID = "player_id";

export function getPlayerHeadshotUrl(
  nbaPlayerId: number | string | null | undefined,
  size: PlayerHeadshotSize = "small"
): string {
  const { path } = SIZE_CONFIG[size] ?? SIZE_CONFIG.small;
  const idSegment = nbaPlayerId ? String(nbaPlayerId) : FALLBACK_ID;
  return `${NBA_CDN_BASE}/${path}/${idSegment}.png`;
}

export function getPlayerHeadshotDimensions(size: PlayerHeadshotSize = "small") {
  return SIZE_CONFIG[size] ?? SIZE_CONFIG.small;
}

export function getFallbackHeadshotUrl(size: PlayerHeadshotSize = "small") {
  return getPlayerHeadshotUrl(null, size);
}


"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getFallbackHeadshotUrl,
  getPlayerHeadshotDimensions,
  getPlayerHeadshotUrl,
  PlayerHeadshotSize,
  PlayerHeadshotSport,
} from "@/lib/utils/player-headshot";

interface PlayerHeadshotProps {
  nbaPlayerId: number | string | null;
  mlbPlayerId?: number | string | null;
  sport?: PlayerHeadshotSport;
  name: string;
  size?: PlayerHeadshotSize;
  className?: string;
  priority?: boolean;
}

export function PlayerHeadshot({
  nbaPlayerId,
  mlbPlayerId,
  sport = "nba",
  name,
  size = "small",
  className,
  priority = false,
}: PlayerHeadshotProps) {
  const headshotId = sport === "mlb" ? (mlbPlayerId ?? nbaPlayerId) : nbaPlayerId;
  const [src, setSrc] = useState(() => getPlayerHeadshotUrl(headshotId, size, sport));

  useEffect(() => {
    setSrc(getPlayerHeadshotUrl(headshotId, size, sport));
  }, [headshotId, size, sport]);

  const { width, height } = getPlayerHeadshotDimensions(size);

  return (
    <Image
      src={src}
      alt={`${name} headshot`}
      width={width}
      height={height}
      priority={priority}
      className={cn("object-cover", className)}
      sizes={size === "small" ? "(max-width: 768px) 120px, 260px" : "50vw"}
      onError={() => {
        const fallback = getFallbackHeadshotUrl(size, sport);
        if (src !== fallback) {
          setSrc(fallback);
        }
      }}
    />
  );
}

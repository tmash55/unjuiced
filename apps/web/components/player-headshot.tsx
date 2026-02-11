"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getFallbackHeadshotUrl,
  getPlayerHeadshotDimensions,
  getPlayerHeadshotUrl,
  PlayerHeadshotSize,
} from "@/lib/utils/player-headshot";

interface PlayerHeadshotProps {
  nbaPlayerId: number | string | null;
  name: string;
  size?: PlayerHeadshotSize;
  className?: string;
  priority?: boolean;
}

export function PlayerHeadshot({
  nbaPlayerId,
  name,
  size = "small",
  className,
  priority = false,
}: PlayerHeadshotProps) {
  const [src, setSrc] = useState(() => getPlayerHeadshotUrl(nbaPlayerId, size));

  useEffect(() => {
    setSrc(getPlayerHeadshotUrl(nbaPlayerId, size));
  }, [nbaPlayerId, size]);

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
        const fallback = getFallbackHeadshotUrl(size);
        if (src !== fallback) {
          setSrc(fallback);
        }
      }}
    />
  );
}


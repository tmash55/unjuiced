"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PricePoint {
  t: number;
  p: number;
}

export function PriceChart({
  tokenId,
  entryPrice,
  className,
}: {
  tokenId?: string;
  entryPrice?: number;
  className?: string;
}) {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenId) return;
    setLoading(true);
    fetch(`/api/polymarket/price-chart?token_id=${tokenId}`)
      .then((r) => r.json())
      .then((d) => setPoints(d.history ?? []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [tokenId]);

  if (!tokenId || loading || points.length < 2) {
    return null;
  }

  const prices = points.map((p) => p.p);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;

  const W = 200;
  const H = 60;
  const pad = 2;

  const pathPoints = points.map((pt, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((pt.p - minP) / range) * (H - pad * 2);
    return `${x},${y}`;
  });

  const lastPrice = prices[prices.length - 1];
  const trending = lastPrice >= (entryPrice ?? prices[0]);

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        <polyline
          points={pathPoints.join(" ")}
          fill="none"
          stroke={trending ? "#34d399" : "#f87171"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {entryPrice != null && (
          <line
            x1={pad}
            x2={W - pad}
            y1={H - pad - ((entryPrice - minP) / range) * (H - pad * 2)}
            y2={H - pad - ((entryPrice - minP) / range) * (H - pad * 2)}
            stroke="#fbbf24"
            strokeWidth="0.5"
            strokeDasharray="3,2"
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
        <span>{(minP * 100).toFixed(0)}¢</span>
        <span>{(maxP * 100).toFixed(0)}¢</span>
      </div>
    </div>
  );
}

"use client";

import { TierBadge } from "./tier-badge";

/**
 * Anonymous insider display: tier badge + 4-char hash + stats
 * NEVER shows wallet address or username
 */
export function InsiderCard({
  walletAddress,
  tier,
  roi,
  record,
}: {
  walletAddress: string;
  tier: string;
  roi?: number | null;
  record?: string | null;
}) {
  const anonId = `#${walletAddress.slice(0, 4).toUpperCase()}`;

  return (
    <div className="flex items-center gap-2">
      <TierBadge tier={tier} />
      <span className="font-mono text-sm font-semibold text-neutral-200 tabular-nums">
        {anonId}
      </span>
      {record && (
        <span className="text-xs text-neutral-500 tabular-nums">{record}</span>
      )}
      {roi != null && (
        <span
          className={`text-xs font-medium tabular-nums ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          {roi >= 0 ? "+" : ""}
          {roi.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

"use client";

import { TierBadge } from "./tier-badge";
import type { WalletTier } from "@/lib/polymarket/types";

/**
 * Anonymous insider display: tier badge + 4-char hash
 * NEVER shows wallet address or username
 */
export function InsiderCard({
  walletAddress,
  tier,
  roi,
  record,
}: {
  walletAddress: string;
  tier: WalletTier | string;
  roi?: number | null;
  record?: string | null;
}) {
  const anonId = `#${walletAddress.slice(0, 4).toUpperCase()}`;

  return (
    <div className="flex items-center gap-2">
      <TierBadge tier={tier} />
      <span className="font-mono text-sm font-semibold text-neutral-200">{anonId}</span>
      {roi != null && (
        <span className={`text-xs ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {roi >= 0 ? "+" : ""}{(roi * 100).toFixed(1)}%
        </span>
      )}
      {record && (
        <span className="text-xs text-neutral-500">{record}</span>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { WalletScore, LeaderboardResponse } from "@/lib/polymarket/types";
import { TierBadge } from "./tier-badge";

export function Leaderboard() {
  const [wallets, setWallets] = useState<WalletScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/polymarket/leaderboard?limit=50")
      .then((r) => r.json())
      .then((data: LeaderboardResponse) => setWallets(data.wallets ?? []))
      .catch(() => setWallets([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-neutral-500">Loading leaderboard...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Tier</th>
            <th className="py-2 pr-3">Insider</th>
            <th className="py-2 pr-3 text-right">ROI</th>
            <th className="py-2 pr-3 text-right">Win%</th>
            <th className="py-2 pr-3 text-right">Bets</th>
            <th className="py-2 pr-3 text-right">CLV</th>
            <th className="py-2 pr-3">Specialty</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((w) => {
            const anonId = `#${w.wallet_address.slice(0, 4).toUpperCase()}`;
            return (
              <tr key={w.wallet_address} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2.5 pr-3 text-neutral-400 font-mono">{w.rank}</td>
                <td className="py-2.5 pr-3"><TierBadge tier={w.tier} /></td>
                <td className="py-2.5 pr-3 font-mono font-semibold text-neutral-200">{anonId}</td>
                <td className={`py-2.5 pr-3 text-right font-semibold ${(w.roi ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {w.roi != null ? `${(w.roi * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right text-neutral-300">
                  {w.win_rate != null ? `${(w.win_rate * 100).toFixed(0)}%` : "—"}
                </td>
                <td className="py-2.5 pr-3 text-right text-neutral-400">{w.total_bets}</td>
                <td className={`py-2.5 pr-3 text-right ${(w.clv_avg ?? 0) > 0 ? "text-emerald-400" : "text-neutral-500"}`}>
                  {w.clv_avg != null ? `${(w.clv_avg * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-2.5 pr-3 text-neutral-400 capitalize">{w.primary_sport ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {wallets.length === 0 && (
        <div className="text-center py-8 text-neutral-500">No leaderboard data yet</div>
      )}
    </div>
  );
}

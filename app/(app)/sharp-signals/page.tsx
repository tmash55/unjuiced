"use client";

import { useState } from "react";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { useHasEliteAccess } from "@/hooks/use-entitlements";
import { SignalFeed } from "@/components/sharp-signals/signal-feed";
import { GameFeed } from "@/components/sharp-signals/game-feed";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { StatsBar } from "@/components/sharp-signals/stats-bar";

type Tab = "feed" | "games";

export default function SharpSignalsPage() {
  const { hasAccess, isLoading } = useHasEliteAccess();
  const [tab, setTab] = useState<Tab>("feed");

  if (isLoading) {
    return (
      <AppPageLayout title="Sharp Signals" subtitle="Real-time prediction market insider tracking">
        <div className="flex items-center justify-center py-20 text-neutral-500">Loading...</div>
      </AppPageLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppPageLayout title="Sharp Signals" subtitle="Real-time prediction market insider tracking">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-neutral-200 mb-2">Elite Feature</h2>
          <p className="text-neutral-500 mb-6 max-w-md">
            Sharp Signals gives you real-time tracking of prediction market insiders.
            Upgrade to Elite to unlock this feature.
          </p>
          <Link
            href="/pricing"
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors"
          >
            Upgrade to Elite
          </Link>
        </div>
      </AppPageLayout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "feed", label: "Signal Feed" },
    { key: "games", label: "Game Feed" },
  ];

  return (
    <AppPageLayout
      title="Sharp Signals"
      subtitle="Real-time prediction market insider tracking"
      headerActions={
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-400 font-medium">Live</span>
        </div>
      }
      statsBar={<StatsBar />}
      contextBar={
        <div className="flex gap-1 border-b border-neutral-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === t.key
                  ? "border-sky-500 text-sky-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "feed" && <SignalFeed />}
      {tab === "games" && <GameFeed />}
    </AppPageLayout>
  );
}

"use client";

import { cn } from "@/lib/utils";

export function AutoToggle({
  enabled,
  setEnabled,
  pro,
  connected,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  pro: boolean;
  connected: boolean;
}) {
  const isReconnecting = enabled && !connected;
  
  return (
    <button
      onClick={() => pro && setEnabled(!enabled)}
      disabled={!pro}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
        enabled && connected && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
        isReconnecting && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
        !enabled && "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400",
        !pro && "opacity-50 cursor-not-allowed"
      )}
      title={pro ? (enabled ? "Disable auto refresh" : "Enable auto refresh") : "Elite required for auto-refresh"}
    >
      <span className={cn(
        "inline-flex h-2 w-2 rounded-full",
        enabled && connected && "bg-green-500",
        isReconnecting && "bg-amber-500 animate-pulse",
        !enabled && "bg-neutral-400"
      )} />
      <span>
        {enabled ? (connected ? "Auto Refresh" : "Reconnecting...") : "Auto Refresh"}
      </span>
    </button>
  );
}
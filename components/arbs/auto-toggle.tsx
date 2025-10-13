"use client";

import { RefreshCw, Radio } from "lucide-react";

export function AutoToggle({
  enabled,
  setEnabled,
  pro,
  connected,
  onManual,
  refreshing,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  pro: boolean;
  connected: boolean;
  onManual: () => void | Promise<void>;
  refreshing?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onManual}
        disabled={!!refreshing}
        className={`h-9 inline-flex items-center gap-2 rounded-md border px-3 bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:bg-neutral-900 dark:text-white dark:border-slate-700 dark:hover:bg-neutral-800 ${refreshing ? 'opacity-80 cursor-wait' : ''}`}
        title="Manual refresh"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        <span className="inline-block">Refresh</span>
      </button>

      <button
        onClick={() => pro && setEnabled(!enabled)}
        disabled={!pro}
        className={`h-9 inline-flex items-center gap-2 rounded-md border px-3 ${enabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:bg-neutral-900 dark:text-white dark:border-slate-700 dark:hover:bg-neutral-800'} ${!pro ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={pro ? 'Toggle live SSE' : 'Pro required'}
      >
        <Radio className={`h-4 w-4 ${enabled ? 'animate-pulse' : ''}`} />
        {enabled ? (connected ? 'Live' : 'Reconnecting…') : 'Enable Live'}
      </button>
    </div>
  );
}
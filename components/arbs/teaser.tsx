"use client";

import { useEffect, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import Link from "next/link";

export function Teaser() {
  const [rows, setRows] = useState<ArbRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/arbs/teaser?limit=2", { cache: "no-store" });
        const j = await r.json();
        setRows(j.rows || []);
      } catch {void 0;}
      setLoading(false);
    })();
  }, []);

  if (loading || rows.length === 0) return null;
  const first = rows[0];
  return (
    <div className="border rounded-md p-4 bg-white/80 dark:bg-slate-800/70">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Example arbitrage</div>
        <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{((first.roi_bps||0)/100).toFixed(2)}% ROI</div>
      </div>
      <div className="text-sm">
        <div className="font-medium">
          {(first.ev?.away?.abbr || first.ev?.away?.name || "Away")} @ {(first.ev?.home?.abbr || first.ev?.home?.name || "Home")}
        </div>
        <div className="text-xs text-muted-foreground">{new Date(first.ev?.dt || Date.now()).toLocaleString()}</div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Link href="/auth" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700">Create free account</Link>
        <Link href="/pricing" className="text-sm text-slate-600 dark:text-slate-300 hover:underline">See plans</Link>
      </div>
    </div>
  );
}
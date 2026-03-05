"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolPerformanceBannerProps {
  className?: string;
}

export function ToolPerformanceBanner({ className }: ToolPerformanceBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-100",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs font-medium sm:text-sm">
          We are experiencing slow load times on Positive EV and Edge Finder. We are working on a fix now.
        </p>
      </div>
    </div>
  );
}

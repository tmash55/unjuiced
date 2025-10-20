"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";

interface LiveStatusIndicatorProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  className?: string;
}

export function LiveStatusIndicator({
  isConnected,
  isReconnecting = false,
  className,
}: LiveStatusIndicatorProps) {
  return (
    <Tooltip
      content={
        <div className="text-xs">
          {isReconnecting ? (
            <>
              <div className="font-medium">Reconnecting...</div>
              <div className="text-neutral-400">Attempting to restore live connection</div>
            </>
          ) : isConnected ? (
            <>
              <div className="font-medium">Live Updates Active</div>
              <div className="text-neutral-400">Real-time odds via SSE</div>
            </>
          ) : (
            <>
              <div className="font-medium">Manual Updates</div>
              <div className="text-neutral-400">Click refresh to update data</div>
            </>
          )}
        </div>
      }
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          isConnected && "text-green-600 dark:text-green-500",
          isReconnecting && "text-yellow-600 dark:text-yellow-500",
          !isConnected && !isReconnecting && "text-neutral-500 dark:text-neutral-400",
          className
        )}
      >
        <div className="relative flex h-2 w-2">
          {isConnected && (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </>
          )}
          {isReconnecting && (
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          )}
          {!isConnected && !isReconnecting && (
            <span className="inline-flex h-2 w-2 rounded-full bg-neutral-400" />
          )}
        </div>
        <span className="hidden sm:inline">
          {isReconnecting ? "Reconnecting" : isConnected ? "Live" : "Manual"}
        </span>
      </div>
    </Tooltip>
  );
}

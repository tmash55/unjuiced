"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";

interface LastUpdatedIndicatorProps {
  timestamp: Date;
  isLive?: boolean;
  className?: string;
}

export function LastUpdatedIndicator({
  timestamp,
  isLive = false,
  className,
}: LastUpdatedIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    const updateRelativeTime = () => {
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);

      if (diffSeconds < 5) {
        setRelativeTime("just now");
      } else if (diffSeconds < 60) {
        setRelativeTime(`${diffSeconds}s ago`);
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        setRelativeTime(`${minutes}m ago`);
      } else if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        setRelativeTime(`${hours}h ago`);
      } else {
        const days = Math.floor(diffSeconds / 86400);
        setRelativeTime(`${days}d ago`);
      }
    };

    updateRelativeTime();
    
    // Update every second for first minute, then every minute
    const diffMs = new Date().getTime() - timestamp.getTime();
    const interval = diffMs < 60000 ? 1000 : 60000;
    
    const timer = setInterval(updateRelativeTime, interval);
    return () => clearInterval(timer);
  }, [timestamp]);

  const formattedTimestamp = timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <Tooltip
      content={
        <div className="text-xs">
          <div className="font-medium">
            {isLive ? 'Last live update' : 'Last refreshed'}
          </div>
          <div className="text-neutral-400">{formattedTimestamp}</div>
        </div>
      }
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400",
          className
        )}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="hidden sm:inline">{relativeTime}</span>
      </div>
    </Tooltip>
  );
}



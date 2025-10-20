"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/button";
import { Tooltip } from "@/components/tooltip";

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  cooldownSeconds?: number;
  className?: string;
}

export function RefreshButton({
  onRefresh,
  cooldownSeconds = 60,
  className,
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleRefresh = async () => {
    if (isRefreshing || cooldownRemaining > 0) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setCooldownRemaining(cooldownSeconds);
    } catch (error) {
      console.error("[REFRESH] Error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isDisabled = isRefreshing || cooldownRemaining > 0;
  const tooltipContent = isRefreshing
    ? "Refreshing..."
    : cooldownRemaining > 0
    ? `Please wait ${cooldownRemaining}s`
    : "Refresh odds data";

  return (
    <Tooltip content={tooltipContent}>
      <Button
        onClick={handleRefresh}
        disabled={isDisabled}
        variant="secondary"
        className={cn(
          "h-8 gap-2 px-3 text-xs font-medium",
          isRefreshing && "cursor-wait",
          className
        )}
      >
        <RefreshCw
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            isRefreshing && "animate-spin"
          )}
        />
        <span className="hidden sm:inline">
          {isRefreshing
            ? "Refreshing..."
            : cooldownRemaining > 0
            ? `Refresh (${cooldownRemaining}s)`
            : "Refresh"}
        </span>
        <span className="sm:hidden">
          {cooldownRemaining > 0 ? `${cooldownRemaining}s` : "Refresh"}
        </span>
      </Button>
    </Tooltip>
  );
}

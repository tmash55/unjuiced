"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ResetButtonProps {
  onReset: () => void;
  disabled?: boolean;
}

export function ResetButton({ onReset, disabled = false }: ResetButtonProps) {
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    onReset();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip content="Reset all filters to defaults">
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg transition-all",
              "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
              "border border-neutral-200/80 dark:border-neutral-700/80",
              "hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64 p-4">
        <div className="flex flex-col items-center text-center">
          {/* Warning icon */}
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
            Reset All Filters?
          </h3>

          {/* Description */}
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            This will reset all filters to their default values. This action cannot be undone.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

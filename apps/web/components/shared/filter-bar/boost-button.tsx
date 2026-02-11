"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { IconBolt } from "@tabler/icons-react";
import { X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const BOOST_PRESETS = [0, 10, 15, 20, 25, 30, 50, 100];

interface BoostButtonProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function BoostButton({ value, onChange, disabled = false }: BoostButtonProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const isActive = value > 0;

  const handlePresetClick = (preset: number) => {
    onChange(preset);
    setOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 200) {
      onChange(num);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(0);
    setCustomValue("");
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip content="Profit Boost - Apply a sportsbook boost to recalculate EV">
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <IconBolt className={cn("w-4 h-4", isActive && "text-amber-500")} />
              {isActive ? (
                <span className="tabular-nums">+{value}%</span>
              ) : null}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Profit Boost %</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Preset options */}
          <div className="p-1 space-y-0.5">
            {BOOST_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "w-full px-2 py-1.5 rounded-md text-left text-sm transition-colors",
                  value === preset
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                )}
              >
                {preset === 0 ? "No Boost" : `+${preset}%`}
              </button>
            ))}
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Custom input */}
          <div className="p-2">
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-1.5">
              Custom %
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={200}
                placeholder="0"
                value={customValue || (value > 0 && !BOOST_PRESETS.includes(value) ? value : "")}
                onChange={handleCustomChange}
                className="w-full h-8 text-sm"
              />
              <span className="text-sm text-neutral-500">%</span>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Clear button */}
      {isActive && (
        <button
          onClick={handleClear}
          disabled={disabled}
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          title="Clear boost"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

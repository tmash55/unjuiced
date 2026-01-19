"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
  accentColor?: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  badge?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  gradientFrom = "from-white",
  gradientTo = "to-neutral-50/20",
  accentColor = "from-neutral-500 to-neutral-600",
  children,
  defaultCollapsed = true,
  badge,
  className,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/60 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 overflow-hidden shadow-lg ring-1 ring-black/5 dark:ring-white/5",
        className
      )}
    >
      {/* Header - Clickable */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full text-left relative overflow-hidden group"
      >
        {/* Background Pattern */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br",
          gradientFrom,
          "via-neutral-50/50",
          gradientTo,
          "dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-neutral-900/10",
          "group-hover:from-neutral-50 dark:group-hover:from-neutral-700/80 transition-colors"
        )} />
        
        {/* Content */}
        <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-1.5 rounded-full bg-gradient-to-b shadow-sm", accentColor)} />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {icon && <div className="text-neutral-500">{icon}</div>}
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                    {title}
                  </h2>
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            
            {/* Collapse/Expand Indicator */}
            <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-all">
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              ) : (
                <ChevronUp className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-5">
          {children}
        </div>
      )}
    </div>
  );
}

// Simple Section Header for non-collapsible sections
export function SectionHeader({
  title,
  subtitle,
  icon,
  gradientFrom = "from-white",
  gradientTo = "to-neutral-50/20",
  accentColor = "from-neutral-500 to-neutral-600",
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
  accentColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br",
        gradientFrom,
        "via-neutral-50/50",
        gradientTo,
        "dark:from-neutral-800/80 dark:via-neutral-800/50 dark:to-neutral-900/10"
      )} />
      
      {/* Content */}
      <div className="relative px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-1.5 rounded-full bg-gradient-to-b shadow-sm", accentColor)} />
            <div>
              {icon && <div className="text-neutral-500 mb-1">{icon}</div>}
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

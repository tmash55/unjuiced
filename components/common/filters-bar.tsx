"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  children: React.ReactNode;
  className?: string;
  useDots?: boolean;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  children,
  className,
  useDots = false,
}) => {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm",
        "shadow-sm",
        className
      )}
    >
      {/* Optional static dot pattern background */}
      {useDots && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none opacity-[0.4] dark:opacity-[0.3]">
          <div className="absolute inset-0 bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] [background-size:10px_10px]" />
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        {children}
      </div>
    </div>
  );
};

interface FiltersBarSectionProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}

export const FiltersBarSection: React.FC<FiltersBarSectionProps> = ({
  children,
  className,
  align = "left",
}) => {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        align === "left" ? "flex-1 min-w-0" : "flex-shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
};

interface FiltersBarDividerProps {
  className?: string;
}

export const FiltersBarDivider: React.FC<FiltersBarDividerProps> = ({
  className,
}) => {
  return (
    <div
      className={cn(
        "hidden sm:block h-6 w-px bg-neutral-200 dark:bg-neutral-800",
        className
      )}
    />
  );
};


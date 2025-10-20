import React from "react";
import { cn } from "@/lib/utils";

export const ToolSubheading = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <p
      className={cn(
        "mt-2 text-base text-neutral-600 dark:text-neutral-400 sm:text-lg",
        className,
      )}
    >
      {children}
    </p>
  );
};


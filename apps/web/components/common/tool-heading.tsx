import React from "react";
import { cn } from "@/lib/utils";

export const ToolHeading = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h1
      className={cn(
        "text-3xl font-bold text-neutral-900 dark:text-white sm:text-4xl",
        className,
      )}
    >
      {children}
    </h1>
  );
};


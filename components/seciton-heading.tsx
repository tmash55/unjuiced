import React from "react";
import { cn } from "@/lib/utils";

export const SectionHeading = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h2
      className={cn(
        "mt-3 text-pretty font-display text-2xl font-medium text-neutral-900 sm:text-3xl md:text-4xl lg:text-5xl dark:text-neutral-100",
        className,
      )}
    >
      {children}
    </h2>
  );
};

import React from "react";
import { cn } from "@/lib/utils";

export const SubHeading = ({
  children,
  className,
  as: Component = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) => {
  return (
    <Component
      className={cn(
        "mt-5 text-pretty text-base text-neutral-600 dark:text-neutral-300 sm:text-xl animate-slide-up-fade [--offset:10px] [animation-delay:200ms] [animation-duration:1s] [animation-fill-mode:both] motion-reduce:animate-fade-in",
        className,
      )}
    >
      {children}
    </Component>
  );
};

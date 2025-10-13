import React from "react";
import { cn } from "@/lib/utils";

export const Heading = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <h1
      className={cn(
        "mt-5 text-center font-display text-3xl font-medium text-neutral-900 dark:text-white sm:text-5xl md:text-6xl sm:leading-[1.15] animate-slide-up-fade [--offset:20px] [animation-duration:1s] [animation-fill-mode:both] motion-reduce:animate-fade-in text-pretty [animation-delay:100ms]",
        className,
      )}
    >
      {children}
    </h1>
  );
};

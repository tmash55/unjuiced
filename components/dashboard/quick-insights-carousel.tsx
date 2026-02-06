"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { IconBulb } from "@tabler/icons-react";

const INSIGHTS = [
  {
    title: "Smarter devig sources",
    description: "We're back-testing different markets across multiple books to find the sharpest source to devig against for each market — not just Pinnacle.",
  },
  {
    title: "What +EV actually means",
    description: "Positive Expected Value means a bet is mathematically profitable over the long run vs the true odds.",
  },
  {
    title: "Why market averages matter",
    description: "If a line is significantly better than the consensus of all sportsbooks, it often signals value.",
  },
  {
    title: "Why lines move",
    description: "Sportsbooks adjust odds based on betting volume, injuries, and sharp action to balance their risk.",
  },
];

export function QuickInsightsCarousel() {
  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-lg bg-sky-500/10 dark:bg-sky-400/10">
            <IconBulb className="size-4 text-sky-500 dark:text-sky-400" />
          </div>
          <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">Quick Insights</span>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex gap-1">
          <CarouselPrevious className="static translate-y-0 translate-x-0 !size-7 rounded-lg border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400" />
          <CarouselNext className="static translate-y-0 translate-x-0 !size-7 rounded-lg border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400" />
        </div>
      </div>

      {/* Carousel Content */}
      <CarouselContent className="flex-1 min-h-0">
        {INSIGHTS.map((insight, index) => (
          <CarouselItem key={index} className="h-full">
            <div className="h-full flex flex-col justify-center px-4 pb-4">
              <div className="flex-1 flex flex-col justify-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-500 dark:text-sky-400">
                  {index + 1}/{INSIGHTS.length}
                </span>
                <h4 className="mt-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                  {insight.title}
                </h4>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

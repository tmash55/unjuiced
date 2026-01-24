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
    title: "Why we devig to Pinnacle",
    description: "Pinnacle is widely considered the sharpest bookmaker. We use their odds to determine true probability.",
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
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-sky-500 to-blue-600"
          )}>
            <IconBulb className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-xs sm:text-sm">Quick Insights</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:block">
              Tips & education
            </p>
          </div>
        </div>
        
        {/* Navigation Controls */}
        <div className="flex gap-1">
          <CarouselPrevious className="static translate-y-0 translate-x-0 !h-5 !w-5 sm:!h-6 sm:!w-6 border-sky-200 dark:border-sky-700/30 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-300 dark:hover:border-sky-600/30" />
          <CarouselNext className="static translate-y-0 translate-x-0 !h-5 !w-5 sm:!h-6 sm:!w-6 border-sky-200 dark:border-sky-700/30 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-300 dark:hover:border-sky-600/30" />
        </div>
      </div>

      {/* Carousel Content */}
      <CarouselContent className="flex-1 min-h-0">
        {INSIGHTS.map((insight, index) => (
          <CarouselItem key={index} className="h-full">
            <div className="h-full flex flex-col justify-center px-3 sm:px-4 py-2 sm:py-3">
              {/* Insight Card */}
              <div className={cn(
                "p-3 sm:p-4 rounded-lg sm:rounded-xl",
                "bg-sky-50 dark:bg-sky-900/20",
                "border border-sky-200/50 dark:border-sky-800/30"
              )}>
                {/* Index Badge */}
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <span className="text-[9px] sm:text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                    Tip {index + 1} of {INSIGHTS.length}
                  </span>
                </div>
                
                {/* Title */}
                <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-tight mb-1 sm:mb-1.5">
                  {insight.title}
                </h4>
                
                {/* Description */}
                <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
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

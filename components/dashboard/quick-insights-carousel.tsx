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
import { Lightbulb, ArrowRight } from "lucide-react";
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
    <div className={cn(
      "h-full flex flex-col p-2 rounded-xl",
      // Brand blue gradient for educational content
      "bg-gradient-to-br from-[#0EA5E9]/[0.04] via-transparent to-[#7DD3FC]/[0.02]",
      "dark:from-[#0EA5E9]/[0.06] dark:via-transparent dark:to-[#7DD3FC]/[0.03]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
            // Brand blue gradient
            "bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]"
          )}>
            <IconBulb className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Quick Insights</span>
        </div>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        <CarouselContent className="h-full">
          {INSIGHTS.map((insight, index) => (
            <CarouselItem key={index} className="h-full">
              <div className="h-full flex flex-col justify-between">
                <div className="space-y-2">
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center",
                    "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10"
                  )}>
                    <Lightbulb className="h-3.5 w-3.5 text-[#0EA5E9] dark:text-[#7DD3FC]" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center text-[10px] font-semibold mt-2 transition-colors",
                  "text-[#0284C7] dark:text-[#7DD3FC]",
                  "hover:text-[#0EA5E9] dark:hover:text-[#38BDF8]"
                )}>
                  Learn more <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Navigation Controls */}
        <div className="absolute -top-8 right-0 flex gap-1">
          <CarouselPrevious className="static translate-y-0 translate-x-0 left-auto top-auto right-auto bottom-auto !h-6 !w-6 border-[#0EA5E9]/20 hover:bg-[#0EA5E9]/10 hover:border-[#0EA5E9]/30" />
          <CarouselNext className="static translate-y-0 translate-x-0 left-auto top-auto right-auto bottom-auto !h-6 !w-6 border-[#0EA5E9]/20 hover:bg-[#0EA5E9]/10 hover:border-[#0EA5E9]/30" />
        </div>
      </Carousel>
    </div>
  );
}

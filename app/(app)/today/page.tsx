"use client";

import { cn } from "@/lib/utils";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { RefreshCw } from "lucide-react";
import { 
  IconTargetArrow, 
  IconTrendingUp, 
  IconScale, 
  IconBolt, 
  IconChartBar, 
  IconBulb 
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { HitRatesBentoCarousel } from "@/components/dashboard/hit-rates-bento-carousel";
import { QuickInsightsCarousel } from "@/components/dashboard/quick-insights-carousel";
import { MarketPulseStats } from "@/components/dashboard/market-pulse-stats";
import { BestBetsSection } from "@/components/dashboard/best-bets-section";
import { ArbitrageSection } from "@/components/dashboard/arbitrage-section";
import { PopularMarketsSection } from "@/components/dashboard/popular-markets-section";

// Skeleton components for visual interest in each card

const BestBetsSkeleton = () => {
  const variants = {
    initial: { x: 0 },
    animate: { x: 5, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      initial="initial"
      whileHover="animate"
      className="flex flex-1 w-full h-full min-h-[6rem] flex-col space-y-2"
    >
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          variants={variants}
          className="flex items-center gap-3 rounded-lg border border-neutral-100 dark:border-white/[0.1] p-3 bg-white dark:bg-black"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-2 w-1/2 rounded bg-neutral-50 dark:bg-neutral-900" />
          </div>
          <div className="text-right">
            <div className="h-4 w-12 rounded bg-emerald-100 dark:bg-emerald-900/30" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

const PopularMarketsSkeleton = () => {
  return (
    <div className="flex flex-1 w-full h-full min-h-[6rem] flex-col">
      <div className="grid grid-cols-2 gap-2 h-full">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.02, y: -2 }}
            className="rounded-lg border border-neutral-100 dark:border-white/[0.1] p-3 bg-white dark:bg-black flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 rounded bg-violet-100 dark:bg-violet-900/30" />
              <div className="h-2.5 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full rounded bg-neutral-50 dark:bg-neutral-900" />
              <div className="h-3 w-12 rounded bg-violet-100 dark:bg-violet-900/30" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ArbitrageSkeleton = () => {
  const variants = {
    initial: { width: 0 },
    animate: { width: "100%", transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="flex flex-1 w-full h-full min-h-[6rem] flex-row gap-3"
    >
      {[1, 2].map((i) => (
        <motion.div
          key={i}
          variants={variants}
          className="flex-1 rounded-lg border border-neutral-100 dark:border-white/[0.1] p-3 bg-white dark:bg-black"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-20 rounded bg-blue-100 dark:bg-blue-900/30" />
            <div className="h-5 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-2 w-3/4 rounded bg-neutral-50 dark:bg-neutral-900" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

const MarketPulseSkeleton = () => {
  return (
    <div className="flex flex-1 w-full h-full min-h-[2.5rem] flex-col justify-center space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <div className="h-2.5 w-20 rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
        <div className="h-2.5 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>
  );
};

const HitRatesSkeleton = () => {
  const barHeights = [85, 70, 90, 60];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="flex flex-1 w-full h-full min-h-[6rem] flex-col"
    >
      <div className="flex items-end justify-around h-full gap-2 pt-4">
        {barHeights.map((height, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={cn(
              "w-8 rounded-t-md",
              i === 0 && "bg-emerald-400",
              i === 1 && "bg-blue-400",
              i === 2 && "bg-amber-400",
              i === 3 && "bg-purple-400"
            )}
          />
        ))}
      </div>
      <div className="flex justify-around mt-2 text-[10px] text-neutral-400">
        <span>L5</span>
        <span>L10</span>
        <span>L20</span>
        <span>SZN</span>
      </div>
    </motion.div>
  );
};

const QuickInsightsSkeleton = () => {
  return (
    <div className="flex flex-1 w-full h-full min-h-[2.5rem] flex-col justify-center">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="space-y-2"
      >
        <div className="h-2.5 w-full rounded bg-blue-100 dark:bg-blue-900/30" />
        <div className="h-2 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
      </motion.div>
    </div>
  );
};

// Dashboard items configuration
// Mobile: Single column, ordered by priority (most important first)
// Desktop: 3 columns with specific row spans
//
// Mobile Order & Heights:
// 1. Market Pulse (compact stats) - 120px
// 2. Best Bets (primary value) - 320px
// 3. Hit Rates (research) - 380px
// 4. Arbitrage (money-making) - 400px
// 5. Popular Markets (discovery) - 280px
// 6. Quick Insights (education) - 200px
const dashboardItems = [
  {
    header: <MarketPulseStats />,
    className: "md:col-span-1 md:row-span-2 md:order-3",
    mobileHeight: "120px",
  },
  {
    header: <BestBetsSection />,
    className: "md:col-span-1 md:row-span-6 md:order-1",
    mobileHeight: "340px",
  },
  {
    header: <HitRatesBentoCarousel />,
    className: "md:col-span-1 md:row-span-6 md:order-4",
    mobileHeight: "400px",
  },
  {
    header: <ArbitrageSection />,
    className: "md:col-span-2 md:row-span-4 md:order-5",
    mobileHeight: "420px",
  },
  {
    header: <PopularMarketsSection />,
    className: "md:col-span-1 md:row-span-6 md:order-2",
    mobileHeight: "300px",
  },
  {
    header: <QuickInsightsCarousel />,
    className: "md:col-span-1 md:row-span-2 md:order-6",
    mobileHeight: "180px",
  },
];

export default function TodayPage() {
  // Format current date
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-base sm:text-lg font-medium text-neutral-500 dark:text-neutral-400">
              Today
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 hidden sm:block">
              Updated every few minutes · Based on real market data
            </p>
          </div>

          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium",
              "bg-white dark:bg-neutral-900",
              "border border-neutral-200 dark:border-neutral-800",
              "text-neutral-600 dark:text-neutral-400",
              "hover:bg-neutral-50 dark:hover:bg-neutral-800",
              "transition-all"
            )}
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Bento Grid Dashboard */}
        <BentoGrid className="max-w-none md:auto-rows-[5rem] md:grid-cols-3 gap-3 sm:gap-4">
          {dashboardItems.map((item, i) => (
            <BentoGridItem
              key={i}
              header={item.header}
              className={item.className}
              mobileHeight={item.mobileHeight}
            />
          ))}
        </BentoGrid>

        {/* Footer */}
        <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500">
            <span>Data refreshes automatically</span>
            <span className="hidden sm:inline">•</span>
            <span>Odds may vary by sportsbook</span>
            <span className="hidden sm:inline">•</span>
            <span>Gamble responsibly</span>
          </div>
        </div>
      </div>
    </div>
  );
}

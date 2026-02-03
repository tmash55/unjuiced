"use client";
import React from "react";
import { motion } from "motion/react";

export const EVFinderSkeleton = () => {
  const opportunities = [
    { player: "Joel Embiid", prop: "O 28.5 Pts", book: "DK", ev: "+8.2%" },
    { player: "LeBron James", prop: "O 7.5 Ast", book: "FD", ev: "+5.7%" },
    { player: "Stephen Curry", prop: "O 4.5 3PM", book: "MGM", ev: "+4.1%" },
  ];

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">+EV Opportunities</span>
          <div className="flex items-center gap-1">
            <motion.div
              className="w-2 h-2 bg-accent rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-xs text-accent">Live</span>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {opportunities.map((opp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  {opp.book}
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{opp.player}</div>
                  <div className="text-xs text-neutral-500">{opp.prop}</div>
                </div>
              </div>
              <span className="text-sm font-bold text-accent bg-accent/10 px-2 py-1 rounded">{opp.ev}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const EdgeFinderSkeleton = () => {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Line Discrepancy Found</span>
        </div>

        <div className="p-4 space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Edge Detected</span>
              <span className="text-xs text-orange-600 dark:text-orange-400">+12 cents</span>
            </div>
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Saquon Barkley O 82.5 Rush Yds
            </div>
          </motion.div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Market Average</span>
              <span className="text-neutral-900 dark:text-neutral-100">-108</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">BetMGM</span>
              <span className="text-accent font-bold">+104</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Edge</span>
              <span className="text-accent font-bold">+12 cents</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KellyCalculatorSkeleton = () => {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Kelly Calculator</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Your Edge</div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">5.2%</div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Odds</div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">+115</div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-lg bg-accent/10 border border-accent/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-accent font-medium">Recommended Bet Size</span>
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">$24.50</span>
              <span className="text-sm text-neutral-500">(2.45% of bankroll)</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

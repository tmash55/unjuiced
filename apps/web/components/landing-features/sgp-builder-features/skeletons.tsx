"use client";
import React from "react";
import { motion } from "motion/react";

export const BuildParlaysSkeleton = () => {
  const legs = [
    { player: "Patrick Mahomes", prop: "O 274.5 Pass Yds", odds: "+105" },
    { player: "Travis Kelce", prop: "O 5.5 Receptions", odds: "-110" },
    { player: "Isiah Pacheco", prop: "O 62.5 Rush Yds", odds: "-115" },
  ];

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand/20 flex items-center justify-center">
              <span className="text-brand text-xs font-bold">3</span>
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Parlay Builder</span>
          </div>
          <span className="text-xs text-accent font-medium">+847</span>
        </div>

        {/* Legs */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {legs.map((leg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{leg.player}</div>
                <div className="text-xs text-neutral-500">{leg.prop}</div>
              </div>
              <span className="text-sm font-medium text-accent">{leg.odds}</span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Potential Payout</span>
            <span className="text-lg font-bold text-accent">$94.70</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CompareOddsSkeleton = () => {
  const books = [
    { name: "BetMGM", odds: "+847", best: true },
    { name: "DraftKings", odds: "+812", best: false },
    { name: "FanDuel", odds: "+798", best: false },
    { name: "Caesars", odds: "+785", best: false },
  ];

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Best Odds Comparison</span>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {books.map((book, i) => (
            <motion.div
              key={book.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`px-4 py-3 flex items-center justify-between ${book.best ? 'bg-accent/5' : ''}`}
            >
              <div className="flex items-center gap-3">
                {book.best && (
                  <span className="text-xs bg-accent text-white px-2 py-0.5 rounded font-medium">Best</span>
                )}
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{book.name}</span>
              </div>
              <span className={`text-sm font-bold ${book.best ? 'text-accent' : 'text-neutral-600 dark:text-neutral-400'}`}>
                {book.odds}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AccuratePricingSkeleton = () => {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Correlation Analysis</span>
        </div>

        <div className="p-4 space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-accent/10 border border-accent/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-accent font-medium">Fair Value Calculated</span>
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-300">SGP+ Adjusted Odds</span>
              <span className="text-lg font-bold text-accent">+847</span>
            </div>
          </motion.div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Uncorrelated</span>
              <span className="text-neutral-900 dark:text-neutral-100">+892</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Correlation Penalty</span>
              <span className="text-red-500">-45</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

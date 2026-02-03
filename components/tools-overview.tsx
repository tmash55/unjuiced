"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";
import { ButtonLink } from "./button-link";
import { cn } from "@/lib/utils";
import Link from "next/link";

const tools = [
  {
    id: "hit-rates",
    title: "Hit Rates",
    description: "See how often players hit their props with visual game logs.",
    longDescription: "Track player performance over their last 5, 10, or 20 games. Visual game logs show exactly when players hit or miss their lines.",
    href: "/hit-rates/nba",
    color: "text-accent",
  },
  {
    id: "sgp-builder",
    title: "SGP Builder",
    description: "Build same game parlays and compare odds across books.",
    longDescription: "Create multi-leg parlays and instantly see which sportsbook offers the best payout with our correlation-adjusted pricing.",
    href: "/parlay-builder",
    color: "text-brand",
  },
  {
    id: "ev-finder",
    title: "+EV Finder",
    description: "Find mathematically profitable bets using sharp book pricing.",
    longDescription: "Discover positive expected value bets by comparing soft book odds against sharp book consensus.",
    href: "/positive-ev",
    color: "text-purple-500",
  },
  {
    id: "edge-finder",
    title: "Edge Finder",
    description: "Spot mispriced lines before the market corrects.",
    longDescription: "Our edge finder scans thousands of lines to find discrepancies between sportsbooks.",
    href: "/positive-ev",
    color: "text-orange-500",
  },
  {
    id: "arbitrage",
    title: "Arbitrage",
    description: "Lock in guaranteed profits with line discrepancies.",
    longDescription: "Find risk-free arbitrage opportunities where you can bet both sides and guarantee a profit.",
    href: "/arbitrage",
    color: "text-rose-500",
  },
];

export function ToolsOverview() {
  const [activeTab, setActiveTab] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  useEffect(() => {
    if (!isAutoRotating) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tools.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  const activeTool = tools[activeTab];

  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col items-start pt-16 pb-8">
        <Badge text="5 Powerful Tools" className="px-4 md:px-12" />
        <SectionHeading className="mt-4 px-4 md:px-12 text-left">
          Everything You Need to Find Your Edge
        </SectionHeading>
        <SubHeading as="p" className="mt-3 text-left px-4 md:px-12 max-w-xl text-pretty text-base text-neutral-500 dark:text-neutral-400 sm:text-lg">
          From hit rate analysis to guaranteed arbitrage — we've got you covered.
        </SubHeading>

        {/* Tab Navigation */}
        <div className="mt-8 px-4 md:px-12 flex flex-wrap gap-2">
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTab(index);
                setIsAutoRotating(false);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                index === activeTab
                  ? "bg-brand text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              )}
            >
              {tool.title}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="mt-8 w-full border-t border-divide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 md:p-12">
            {/* Left: Description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col justify-center"
              >
                <h3 className={cn("text-2xl font-bold mb-4", activeTool.color)}>
                  {activeTool.title}
                </h3>
                <p className="text-lg text-neutral-600 dark:text-neutral-300 mb-6">
                  {activeTool.longDescription}
                </p>
                <ButtonLink href={activeTool.href} variant="secondary">
                  Learn More →
                </ButtonLink>
              </motion.div>
            </AnimatePresence>

            {/* Right: Preview Placeholder */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <div className="aspect-[4/3] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                  <div className="text-center p-8">
                    <div className={cn("w-16 h-16 mx-auto mb-4 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center", activeTool.color)}>
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{activeTool.title} Preview</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Add screenshot here</p>
                  </div>

                  {/* Progress bar */}
                  {isAutoRotating && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-700">
                      <motion.div
                        className="h-full bg-brand"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 5, ease: "linear" }}
                        key={activeTab}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Tab indicators (mobile) */}
        <div className="flex justify-center gap-2 w-full pb-4 lg:hidden">
          {tools.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveTab(index);
                setIsAutoRotating(false);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === activeTab ? "bg-brand w-6" : "bg-neutral-300 dark:bg-neutral-600"
              )}
            />
          ))}
        </div>
      </div>
    </Container>
  );
}

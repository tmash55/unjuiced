"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

const featureChips = [
  "Hit Rates",
  "Positive EV",
  "Edge Finder",
  "Arbitrage",
  "My Slips",
  "Odds Screen",
  "Cheat Sheets",
  "Custom Models",
  "Defense vs Position",
  "Injury Impact",
  "Alt Lines",
  "Book Comparison",
];

const capabilities = [
  {
    title: "Research",
    description:
      "Validate props with hit rates, shooting zones, matchup context, and performance splits.",
    href: "/features/hit-rates",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 21-4.3-4.3" /><circle cx="11" cy="11" r="8" />
      </svg>
    ),
  },
  {
    title: "Discover",
    description:
      "Surface mispriced odds, positive EV bets, and line discrepancies across 20+ books in real time.",
    href: "/features/positive-ev",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
      </svg>
    ),
  },
  {
    title: "Build",
    description:
      "Save plays to My Slips, create same-game parlays, compare payouts, and deep-link to your sportsbook.",
    href: "/features/my-slips",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M14 15H9v-5" /><path d="M16 3l5 5" /><path d="M21 3l-5 5" />
      </svg>
    ),
  },
  {
    title: "Execute",
    description:
      "Spot arbitrage windows, lock in risk-free opportunities, and auto-size stakes with Kelly criterion.",
    href: "/features/arbitrage",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

export function MoreThanTools() {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const [topWidth, setTopWidth] = useState(0);
  const [bottomWidth, setBottomWidth] = useState(0);

  const topItems = useMemo(() => [...featureChips, ...featureChips], []);
  const bottomItems = useMemo(
    () => [
      ...featureChips.slice(3),
      ...featureChips,
      ...featureChips.slice(0, 3),
    ],
    [],
  );

  useEffect(() => {
    const update = () => {
      if (topRowRef.current) {
        setTopWidth(topRowRef.current.scrollWidth / 2);
      }
      if (bottomRowRef.current) {
        setBottomWidth(bottomRowRef.current.scrollWidth / 2);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    if (topRowRef.current) ro.observe(topRowRef.current);
    if (bottomRowRef.current) ro.observe(bottomRowRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="bg-black py-16 sm:py-20 lg:py-24">
      <MaxWidthWrapper>
        {/* Scrolling chips */}
        <div className="space-y-3">
          <ScrollingRow
            ref={topRowRef}
            items={topItems}
            width={topWidth}
            direction="left"
            speed={70}
          />
          <ScrollingRow
            ref={bottomRowRef}
            items={bottomItems}
            width={bottomWidth}
            direction="right"
            speed={60}
          />
        </div>

        {/* Heading */}
        <div className="mt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            More Than Just Tools
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            One platform for research, discovery, and execution
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Our tools work together to help you find value, validate the edge,
            and build smarter bets — all in one place.
          </p>
        </div>

        {/* Capability cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary-weak)]">
                {card.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {card.title}
              </h3>
              <p className="mt-2 flex-1 text-sm text-white/50">
                {card.description}
              </p>
              <span className="mt-4 text-sm font-semibold text-[color:var(--primary-weak)] opacity-0 transition-opacity group-hover:opacity-100">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

const ScrollingRow = React.forwardRef<
  HTMLDivElement,
  {
    items: string[];
    width: number;
    direction: "left" | "right";
    speed: number;
  }
>(({ items, width, direction, speed }, ref) => (
  <div
    className="relative overflow-hidden"
    style={{
      maskImage:
        "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
      WebkitMaskImage:
        "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
    }}
  >
    <motion.div
      ref={ref}
      className="flex w-max items-center gap-3 py-1"
      animate={
        width
          ? {
              x: direction === "left" ? [0, -width] : [-width, 0],
            }
          : undefined
      }
      transition={{
        x: {
          repeat: Infinity,
          repeatType: "loop",
          duration: speed,
          ease: "linear",
        },
      }}
    >
      {items.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className="whitespace-nowrap rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40"
        >
          {chip}
        </span>
      ))}
    </motion.div>
  </div>
));

ScrollingRow.displayName = "ScrollingRow";

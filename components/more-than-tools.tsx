"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { cn } from "@/lib/utils";

const featureChips = [
  "Hit Rates",
  "Smart Edges",
  "+EV Scanner",
  "Edge Finder",
  "Arbitrage Alerts",
  "SGP Builder",
  "Custom Models",
  "Odds Screen",
  "Defense vs Position",
  "Line Movement",
  "Injury Impact",
  "Alt Lines",
  "Book Comparison",
];

const cards = [
  {
    title: "Research",
    description:
      "Validate props with hit rates, matchup context, and performance splits.",
    href: "/hit-rates/nba",
    mediaLabel: "Hit Rates UI",
  },
  {
    title: "Discover",
    description:
      "Surface mispriced odds and real-time value across your favorite books.",
    href: "/positive-ev",
    mediaLabel: "Smart Edges UI",
  },
  {
    title: "Build",
    description:
      "Create same game parlays and compare payouts before you place a bet.",
    href: "/parlay-builder",
    mediaLabel: "SGP Builder UI",
  },
  {
    title: "Optimize",
    description:
      "Spot arbitrage windows and lock in risk-free opportunities faster.",
    href: "/arbitrage",
    mediaLabel: "Arbitrage Alerts UI",
  },
];

export function MoreThanTools() {
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const [topWidth, setTopWidth] = useState(0);
  const [bottomWidth, setBottomWidth] = useState(0);

  const topItems = useMemo(
    () => [...featureChips, ...featureChips],
    [],
  );
  const bottomItems = useMemo(
    () => [...featureChips.slice(3), ...featureChips, ...featureChips.slice(0, 3)],
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
    <section className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.1),transparent_75%)] pb-16 pt-10 sm:pb-20">
      <MaxWidthWrapper>
        <div className="space-y-4">
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
              ref={topRowRef}
              className="flex w-max items-center gap-4 py-2"
              animate={topWidth ? { x: [0, -topWidth] } : undefined}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 70,
                  ease: "linear",
                },
              }}
            >
              {topItems.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/70"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
          </div>

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
              ref={bottomRowRef}
              className="flex w-max items-center gap-4 py-2"
              animate={bottomWidth ? { x: [-bottomWidth, 0] } : undefined}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 60,
                  ease: "linear",
                },
              }}
            >
              {bottomItems.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/60"
                >
                  {chip}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            More Than Just Hit Rates
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            One platform for research, discovery, and execution
          </h2>
          <p className="mt-4 text-base text-white/70 sm:text-lg">
            Our tools work together to help you find value, validate the edge,
            and build smarter bets in minutes.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8"
            >
              <div>
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm text-white/70">{card.description}</p>
                <Link
                  href={card.href}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--primary-weak)] transition-colors hover:text-white"
                >
                  View tool →
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
                <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-white/60">
                  {card.mediaLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

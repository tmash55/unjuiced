"use client";
import { motion, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

type MockOpp = {
    type: "LIVE" | "PREGAME";
    league: string;
    match: string;
    market: string;       // e.g., Moneyline / Player Prop / Alternate
    books: [string, string];
    ev: number;           // expected value %
    hold: number;         // combined hold
    startsIn?: string;    // for pregame
    updated?: string;     // for live
  };
  
  const mockOpps: MockOpp[] = [
    {
      type: "LIVE",
      league: "NFL",
      match: "KC @ BUF",
      market: "Moneyline",
      books: ["DraftKings", "FanDuel"],
      ev: 1.8,
      hold: -0.3,
      updated: "2s ago",
    },
    {
      type: "PREGAME",
      league: "NBA",
      match: "LAL @ BOS",
      market: "Alternate Total 225.5",
      books: ["BetMGM", "Caesars"],
      ev: 1.2,
      hold: -0.1,
      startsIn: "2h 14m",
    },
    {
      type: "LIVE",
      league: "MLB",
      match: "NYY @ HOU",
      market: "Player Hits (A. Judge 1+)",
      books: ["ESPN BET", "BetRivers"],
      ev: 2.4,
      hold: -0.6,
      updated: "1s ago",
    },
    {
      type: "PREGAME",
      league: "NHL",
      match: "TOR @ NYR",
      market: "Moneyline",
      books: ["FanDuel", "PointsBet"],
      ev: 0.9,
      hold: -0.2,
      startsIn: "6h 03m",
    },
  ];
  
  export function ArbOpportunitiesSkeleton() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const prefersReducedMotion = useReducedMotion();

    // Extend the opportunities array for infinite scroll
    const extendedOpps = [...mockOpps, ...mockOpps, ...mockOpps];

    const cardHeight = 180; // approximate card height
    const gap = 16; // gap between cards (space-y-4)
    const itemHeight = cardHeight + gap;
    const offset = (containerHeight - cardHeight) / 2;

    useEffect(() => {
      const observer = new ResizeObserver((entries) => {
        const height = entries[0]?.contentRect.height ?? 0;
        setContainerHeight(height);
      });

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => observer.disconnect();
    }, []);

    const y = useMotionValue(0);
    const totalHeight = extendedOpps.length * itemHeight;

    useEffect(() => {
      // Skip auto-scroll animation if user prefers reduced motion
      if (prefersReducedMotion) return;

      let animationFrame: number;
      let lastTime = performance.now();
      const speed = 35; // Slightly reduced speed for subtlety (was 40)

      function animateScroll(now: number) {
        const elapsed = (now - lastTime) / 1000;
        lastTime = now;
        let current = y.get();
        current -= speed * elapsed;

        // Reset when we've scrolled through one repetition
        if (Math.abs(current) >= totalHeight / 3) {
          current += totalHeight / 3;
        }
        y.set(current);
        animationFrame = requestAnimationFrame(animateScroll);
      }
      animationFrame = requestAnimationFrame(animateScroll);
      return () => cancelAnimationFrame(animationFrame);
    }, [y, totalHeight, prefersReducedMotion]);

    return (
      <div className="relative mt-8 w-full max-w-4xl px-4">
        {/* floating header */}
        <motion.div
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-gray-900 dark:text-white">Live Opportunities</span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <motion.span 
                className="inline-block size-1.5 rounded-full bg-brand"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Updates every 1s
            </div>
          </div>
          <span className="text-sm text-gray-500 dark:text-neutral-400">
            {mockOpps.length} active
          </span>
        </motion.div>
  
        {/* Auto-scrolling card carousel */}
        <div
          ref={containerRef}
          className="relative h-[500px] w-full overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        >
          <motion.div
            className="absolute left-1/2 flex w-full -translate-x-1/2 flex-col"
            style={{ y }}
          >
            {extendedOpps.map((opp, index) => (
              <motion.div
                key={`${index}-${opp.match}`}
                className="mb-4 w-full"
                style={{
                  scale: useTransform(
                    y,
                    [
                      offset + (index - 2) * -itemHeight,
                      offset + (index - 1) * -itemHeight,
                      offset + index * -itemHeight,
                      offset + (index + 1) * -itemHeight,
                      offset + (index + 2) * -itemHeight,
                    ],
                    [0.88, 0.94, 1, 0.94, 0.88],
                  ),
                  opacity: useTransform(
                    y,
                    [
                      offset + (index - 2) * -itemHeight,
                      offset + (index - 1) * -itemHeight,
                      offset + index * -itemHeight,
                      offset + (index + 1) * -itemHeight,
                      offset + (index + 2) * -itemHeight,
                    ],
                    [0.3, 0.6, 1, 0.6, 0.3],
                  ),
                }}
              >
                <ArbCard opp={opp} index={index} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }
  
  function ArbCard({ opp, index = 0 }: { opp: MockOpp; index?: number }) {
    const isLive = opp.type === "LIVE";
    const [isHovered, setIsHovered] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    
    return (
      <motion.div
        whileHover={prefersReducedMotion ? {} : { scale: 1.015, y: -2 }} // Reduced scale and movement for subtlety
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        transition={{ duration: 0.2, ease: "easeOut" }} // Smoother, quicker transition
        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
          isHovered
            ? "border-brand/30 bg-white shadow-lg ring-1 ring-brand/10 dark:border-brand/50 dark:bg-neutral-900 dark:ring-brand/15"
            : "border-gray-200 bg-white shadow-md hover:shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        }`}
      >
        {/* Animated gradient background on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0"
          animate={{ opacity: isHovered ? 0.05 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full w-full bg-gradient-to-br from-brand/20 via-transparent to-brand/10" />
        </motion.div>

        {/* live pulse border */}
        {isLive && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-brand/40"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="relative p-5">
  
          {/* top row: type + league + timing */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-transform " +
                  (isLive
                    ? "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
                    : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700")
                }
              >
                {isLive && <span className="size-1.5 animate-pulse rounded-full bg-red-500" />}
                {opp.type}
              </span>
              <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">{opp.league}</span>
            </div>
            <div className="text-[11px] text-gray-500 transition-opacity dark:text-neutral-400">
              {isLive ? `Updated ${opp.updated}` : `Starts in ${opp.startsIn}`}
            </div>
          </div>
    
          {/* match + market */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-neutral-100">
                {opp.match}
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">{opp.market}</div>
            </div>
    
            {/* EV / Hold badges */}
            <div className="flex items-center gap-2">
              <Badge color="ev">{opp.ev.toFixed(1)}% EV</Badge>
              <Badge color={opp.hold <= 0 ? "green" : "warn"}>
                {opp.hold > 0 ? `+${opp.hold.toFixed(1)}%` : `${opp.hold.toFixed(1)}%`}
              </Badge>
            </div>
          </div>
    
          {/* book pair + action buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              {opp.books.map((b, idx) => {
                // Map book names to logo paths
                const bookLogos: Record<string, string> = {
                  DraftKings: "/images/sports-books/draftkings.png",
                  FanDuel: "/images/sports-books/fanduel.png",
                  BetMGM: "/images/sports-books/betmgm.png",
                  Caesars: "/images/sports-books/caesars.png",
                  "Hard Rock": "/images/sports-books/hardrockbet.png",
                  "ESPN BET": "/images/sports-books/espnbet.png",
                  BetRivers: "/images/sports-books/betrivers.png",
                  Bet365: "/images/sports-books/bet365.png",
                  Fanatics: "/images/sports-books/fanatics.png",
                  Circa: "/images/sports-books/circa.png",
                };
                
                return (
                  <div
                    key={b + idx}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-transform dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-800 dark:text-neutral-200"
                  >
                    <Image 
                      src={bookLogos[b] || "/images/sports-books/generic-sportsbook.svg"} 
                      alt={b}
                      width={14}
                      height={14}
                      className="size-3.5 object-contain"
                    />
                    {b}
                  </div>
                );
              })}
            </div>
    
            <div className="flex items-center gap-2 transition-opacity">
              <button className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand/10 dark:border-brand/30 dark:bg-brand/10">
                View Details
              </button>
              <button className="rounded-lg border-2 border-brand bg-brand px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow-md">
                Place Bets
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  function Badge({
    children,
    color = "neutral",
  }: {
    children: React.ReactNode;
    color?: "ev" | "green" | "warn" | "neutral";
  }) {
    const map = {
      ev: "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
      green:
        "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
      warn:
        "border-yellow-500 bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30",
      neutral:
        "border-gray-300 bg-gray-50 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
    } as const;
  
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1 ${map[color]}`}
      >
        {children}
      </span>
    );
  }

export function ChooseBooksSkeleton() {
  const books = [
    { name: "DraftKings", logo: "/images/sports-books/draftkings.png", defaultSelected: true, coverage: "98%" },
    { name: "FanDuel", logo: "/images/sports-books/fanduel.png", defaultSelected: true, coverage: "95%" },
    { name: "Caesars", logo: "/images/sports-books/caesars.png", defaultSelected: true, coverage: "92%" },
    { name: "BetMGM", logo: "/images/sports-books/betmgm.png", defaultSelected: true, coverage: "90%" },
    { name: "ESPN BET", logo: "/images/sports-books/espnbet.png", defaultSelected: false, coverage: "85%" },
    { name: "Hard Rock", logo: "/images/sports-books/hardrockbet.png", defaultSelected: false, coverage: "88%" },
    { name: "BetRivers", logo: "/images/sports-books/betrivers.png", defaultSelected: false, coverage: "82%" },
    { name: "Fanatics", logo: "/images/sports-books/fanatics.png", defaultSelected: false, coverage: "80%" },
    { name: "Fliff", logo: "/images/sports-books/fliff.png", defaultSelected: false, coverage: "75%" },
  ];

  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    new Set(books.filter((b) => b.defaultSelected).map((b) => b.name))
  );

  const toggleBook = (name: string) => {
    setSelectedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectedCount = selectedBooks.size;

  return (
    <div className="mt-10 w-full max-w-4xl px-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-base font-medium text-gray-900 dark:text-white">Choose your sportsbooks</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            Select books you have accounts with • <span className="text-brand">{selectedCount} selected</span>
          </div>
        </div>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setSelectedBooks(new Set(books.map((b) => b.name)))}
          className="text-xs font-medium text-brand transition-colors hover:text-brand/80"
        >
          Select all
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {books.map((b, i) => {
          const isSelected = selectedBooks.has(b.name);
          return (
          <motion.button
            key={b.name}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleBook(b.name)}
              className={`group relative flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-all ${
                isSelected
                  ? "border-brand bg-brand/5 hover:shadow-md dark:border-brand dark:bg-brand/10"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900"
              }`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  layoutId="selected-book"
                  className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-brand shadow-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              )}
              
              <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-800">
                <Image
                  src={b.logo}
                  alt={b.name}
                  fill
                  className="object-contain p-1.5"
                />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="h-1 w-full max-w-[60px] overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-800">
                    <motion.div
                      className="h-full bg-brand"
                      initial={{ width: 0 }}
                      animate={{ width: b.coverage }}
                      transition={{ delay: i * 0.1 + 0.2, duration: 0.6 }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-neutral-400">{b.coverage}</span>
                </div>
              </div>
              {/* selected toggle with animation */}
              <motion.div
                animate={{
                  scale: isSelected ? 1.1 : 1,
                  rotate: isSelected ? 360 : 0,
                }}
                transition={{ type: "spring", stiffness: 200 }}
                className={`rounded-full border p-1.5 transition-all ${
                  isSelected
                    ? "border-brand bg-brand shadow-sm"
                    : "border-gray-300 group-hover:border-gray-400 dark:border-neutral-700"
                }`}
              >
                <motion.div
                  animate={{
                    scale: isSelected ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`h-3 w-3 rounded-full transition-all ${
                    isSelected
                      ? "bg-white"
                      : "bg-gray-300 group-hover:bg-brand/70 dark:bg-neutral-600"
                  }`}
                />
              </motion.div>
            </motion.button>
          );
        })}
            </div>

      {/* Enhanced footer with stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-800"
      >
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-brand">{selectedCount}</div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-400">Books</div>
            </div>
          <div className="h-8 w-px bg-gray-200 dark:bg-neutral-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.round(selectedCount * 24)}+
            </div>
            <div className="text-[10px] text-gray-500 dark:text-neutral-400">Markets</div>
      </div>
      </div>
        <button className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow-md">
          Continue
        </button>
      </motion.div>
    </div>
  );
}


export function SmartFiltersSkeleton() {
  const books = [
    { name: "DraftKings", logo: "/images/sports-books/draftkings.png", defaultSelected: true, coverage: "98%" },
    { name: "FanDuel", logo: "/images/sports-books/fanduel.png", defaultSelected: true, coverage: "95%" },
    { name: "Caesars", logo: "/images/sports-books/caesars.png", defaultSelected: true, coverage: "92%" },
    { name: "BetMGM", logo: "/images/sports-books/betmgm.png", defaultSelected: true, coverage: "90%" },
    { name: "ESPN BET", logo: "/images/sports-books/espnbet.png", defaultSelected: false, coverage: "85%" },
    { name: "Hard Rock", logo: "/images/sports-books/hardrockbet.png", defaultSelected: false, coverage: "88%" },
  ];

  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    new Set(books.filter((b) => b.defaultSelected).map((b) => b.name))
  );
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set(["NFL", "NBA"]));
  const [selectedMarkets, setSelectedMarkets] = useState<Set<string>>(new Set(["Moneyline"]));

  const toggleBook = (name: string) => {
    setSelectedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleLeague = (league: string) => {
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(league)) {
        next.delete(league);
      } else {
        next.add(league);
      }
      return next;
    });
  };

  const toggleMarket = (market: string) => {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(market)) {
        next.delete(market);
      } else {
        next.add(market);
      }
      return next;
    });
  };

  const selectedCount = selectedBooks.size;

  return (
    <div className="mt-10 w-full max-w-5xl px-4">
      {/* Sportsbook selection section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-medium text-gray-900 dark:text-white">Sportsbooks</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
              <span className="font-medium text-gray-700 dark:text-neutral-300">{selectedCount} selected</span> • Click to toggle
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {books.map((b, i) => {
            const isSelected = selectedBooks.has(b.name);
            return (
              <motion.button
                key={b.name}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleBook(b.name)}
                className={`group relative flex items-center gap-2 rounded-xl border p-2.5 shadow-sm transition-all ${
                  isSelected
                    ? "border-gray-300 bg-gray-50 hover:shadow-md dark:border-neutral-600 dark:bg-neutral-800"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900"
                }`}
              >
                {/* Selection indicator - removed for cleaner look */}
                
                <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-800">
                  <Image
                    src={b.logo}
                    alt={b.name}
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">{b.name}</div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-0.5 w-full max-w-[50px] overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
                      <motion.div
                        className="h-full bg-gray-600 dark:bg-neutral-400"
                        initial={{ width: 0 }}
                        animate={{ width: b.coverage }}
                        transition={{ delay: i * 0.1 + 0.2, duration: 0.6 }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 dark:text-neutral-400">{b.coverage}</span>
                  </div>
                </div>
                {/* Checkbox */}
                <motion.div
                  animate={{
                    scale: isSelected ? 1.1 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className={`rounded-full border p-1 transition-all ${
                    isSelected
                      ? "border-gray-600 bg-gray-600 shadow-sm dark:border-neutral-400 dark:bg-neutral-400"
                      : "border-gray-300 group-hover:border-gray-400 dark:border-neutral-700"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full transition-all ${
                      isSelected
                        ? "bg-white"
                        : "bg-gray-300 group-hover:bg-gray-400 dark:bg-neutral-600"
                    }`}
                  />
                </motion.div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* League filter */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-3 text-sm font-medium text-gray-700 dark:text-neutral-300">League</div>
          <div className="flex flex-wrap gap-2">
            {["NFL", "NBA", "MLB", "NHL", "WNBA", "NCAAF", "NCAAB"].map((l, i) => {
              const isSelected = selectedLeagues.has(l);
              return (
                <motion.button
                key={l}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                  onClick={() => toggleLeague(l)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-gray-600 bg-gray-600 text-white shadow-sm dark:border-neutral-400 dark:bg-neutral-400 dark:text-neutral-900"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {l}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Market type */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-3 text-sm font-medium text-gray-700 dark:text-neutral-300">Market Type</div>
          <div className="flex flex-wrap gap-2">
            {["Moneyline", "Spread", "Totals", "Player Props", "Team Props", "Alt Lines"].map((m, i) => {
              const isSelected = selectedMarkets.has(m);
              return (
                <motion.button
                key={m}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                  onClick={() => toggleMarket(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-gray-600 text-white shadow-sm dark:bg-neutral-400 dark:text-neutral-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {m}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Min EV / Max Hold */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-3 text-sm font-medium text-gray-700 dark:text-neutral-300">Thresholds</div>
          {[
            { label: "Min EV", width: "70%", value: "2.5%" },
            { label: "Max Hold", width: "55%", value: "5.0%" },
          ].map((s, i) => (
            <div key={i} className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-neutral-400">{s.label}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">{s.value}</span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-gray-600 to-gray-500 dark:from-neutral-400 dark:to-neutral-500"
                  initial={{ width: "10%" }}
                  animate={{ width: s.width }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions with live count */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-800"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-green-500 opacity-75" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">
            <span className="font-semibold text-gray-900 dark:text-white">47</span> active opportunities
          </span>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-950">
            Reset
          </button>
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white">
            Apply Filters
          </button>
      </div>
      </motion.div>
    </div>
  );
}



// Horizontal connection line component with animated gradient (right to left)
const HorizontalLineRTL = ({ className }: { className?: string }) => {
  return (
    <svg
      width="150"
      height="2"
      viewBox="0 0 150 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <line
        x1="0"
        y1="1"
        x2="150"
        y2="1"
        stroke="var(--color-line)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="0"
        y1="1"
        x2="150"
        y2="1"
        stroke="url(#horizontal-gradient-rtl)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          id="horizontal-gradient-rtl"
          initial={{
            x1: "120%",
            x2: "140%",
            y1: 0,
            y2: 0,
          }}
          animate={{
            x1: "-20%",
            x2: "0%",
            y1: 0,
            y2: 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
            delay: 0,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.5" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

// Horizontal connection line component with animated gradient (left to right)
const HorizontalLine = ({ className }: { className?: string }) => {
  return (
    <svg
      width="150"
      height="2"
      viewBox="0 0 150 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <line
        x1="0"
        y1="1"
        x2="150"
        y2="1"
        stroke="var(--color-line)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <line
        x1="0"
        y1="1"
        x2="150"
        y2="1"
        stroke="url(#horizontal-gradient-ltr)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          id="horizontal-gradient-ltr"
          initial={{
            x1: "-20%",
            x2: "0%",
            y1: 0,
            y2: 0,
          }}
          animate={{
            x1: "120%",
            x2: "140%",
            y1: 0,
            y2: 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            repeatDelay: 1,
            delay: 0,
          }}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-line)" />
          <stop offset="0.5" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

export function OneClickDualBetSkeleton() {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative mt-10 flex w-full max-w-7xl items-center justify-center gap-0 px-4">
      {/* Left Bet Slip - DraftKings */}
      <motion.div
        initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 100, damping: 15 }}
        className="relative z-10 w-full max-w-[320px]"
      >
        {/* Animated border wrapper */}
        <div className="relative overflow-hidden rounded-2xl bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
          {/* Spinning gradient borders */}
          <div className="absolute inset-0 scale-[1.4] animate-spin rounded-2xl bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:3s]" />
          <div className="absolute inset-0 scale-[1.4] animate-spin rounded-2xl [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1.5s] [animation-duration:3s]" />
          
      <motion.div
            animate={{ 
              scale: isHovered && !prefersReducedMotion ? 1.01 : 1,
            }}
            transition={{ duration: 0.2 }}
            className="relative z-20 overflow-hidden rounded-2xl bg-white dark:bg-neutral-900"
          >
          {/* Window title bar */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 dark:border-neutral-700 dark:from-neutral-800 dark:to-neutral-900">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-neutral-400">
              DraftKings Bet Slip
            </div>
          </div>
          
          {/* Content */}
          <div className="p-5">
            {/* Book header */}
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-neutral-800">
              <div className="relative h-6 w-6 overflow-hidden rounded">
                <Image
                  src="/images/sports-books/draftkings.png"
                  alt="DraftKings"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">DraftKings</span>
              <div className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                Best Price
              </div>
            </div>
          
          {/* Bet details */}
          <div className="mb-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 dark:text-neutral-400">NBA • Moneyline</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-white">LA Lakers</div>
                <div className="text-xs text-gray-500">vs Boston Celtics</div>
              </div>
              <div className="rounded-lg bg-green-50 px-3 py-1.5 text-lg font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                +150
              </div>
            </div>
          </div>

          {/* Stake input */}
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="text-[10px] text-gray-500 dark:text-neutral-400">Stake</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">$100.00</div>
          </div>

            {/* Potential return */}
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-neutral-400">Potential return</span>
              <span className="font-semibold text-gray-900 dark:text-white">$250.00</span>
            </div>
          </div>
        </motion.div>
        </div>
      </motion.div>

      {/* Left connection line (right to left animation) */}
      <HorizontalLineRTL className="shrink-0" />

      {/* Center - Zap Button */}
      <div className="relative z-20 flex shrink-0 flex-col items-center gap-3">
        {/* Profit indicator above button */}
      <motion.div
          initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 px-4 py-2 shadow-sm dark:border-green-900/30 dark:from-green-900/20 dark:to-emerald-900/20"
        >
          <div className="text-center">
            <div className="text-[10px] font-medium text-green-600 dark:text-green-400">Guaranteed Profit</div>
            <div className="mt-0.5 flex items-baseline gap-1.5 justify-center">
              <span className="text-xl font-bold text-green-700 dark:text-green-300">$19</span>
              <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-green-500">+7.6%</span>
            </div>
          </div>
      </motion.div>

        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Zap button - clean, no animations */}
          <button className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-brand bg-gradient-to-br from-brand to-brand/80 shadow-xl transition-transform hover:scale-105">
            {/* Zap icon */}
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </button>
        </div>

        {/* Label */}
        <div className="rounded-full border border-brand/20 bg-brand/10 px-4 py-1 text-xs font-medium text-brand dark:border-brand/30 dark:bg-brand/20">
          One-Click Dual Bet
        </div>
      </div>

      {/* Right connection line */}
      <HorizontalLine className="shrink-0" />

      {/* Right Bet Slip - FanDuel */}
      <motion.div
        initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 100, damping: 15 }}
        className="relative z-10 w-full max-w-[320px]"
      >
        {/* Animated border wrapper */}
        <div className="relative overflow-hidden rounded-2xl bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
          {/* Spinning gradient borders */}
          <div className="absolute inset-0 scale-[1.4] animate-spin rounded-2xl bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:3s]" />
          <div className="absolute inset-0 scale-[1.4] animate-spin rounded-2xl [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1.5s] [animation-duration:3s]" />
          
          <motion.div
            animate={{ 
              scale: isHovered && !prefersReducedMotion ? 1.01 : 1,
            }}
            transition={{ duration: 0.2 }}
            className="relative z-20 overflow-hidden rounded-2xl bg-white dark:bg-neutral-900"
          >
          {/* Window title bar */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 dark:border-neutral-700 dark:from-neutral-800 dark:to-neutral-900">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 text-center text-xs font-medium text-gray-600 dark:text-neutral-400">
              FanDuel Bet Slip
            </div>
          </div>
          
          {/* Content */}
          <div className="p-5">
            {/* Book header */}
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-neutral-800">
              <div className="relative h-6 w-6 overflow-hidden rounded">
                <Image
                  src="/images/sports-books/fanduel.png"
                  alt="FanDuel"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">FanDuel</span>
              <div className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Best Price
              </div>
            </div>
          
          {/* Bet details */}
          <div className="mb-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 dark:text-neutral-400">NBA • Moneyline</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-white">Boston Celtics</div>
                <div className="text-xs text-gray-500">vs LA Lakers</div>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-lg font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                -110
              </div>
            </div>
          </div>

          {/* Stake input */}
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="text-[10px] text-gray-500 dark:text-neutral-400">Stake</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">$130.00</div>
          </div>

            {/* Potential return */}
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-neutral-400">Potential return</span>
              <span className="font-semibold text-gray-900 dark:text-white">$250.00</span>
            </div>
          </div>
        </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

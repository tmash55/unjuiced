"use client";
import React from "react";
import { motion } from "motion/react";
import Image from "next/image";

const sportsbooks = [
  { name: "DraftKings", logo: "/images/sports-books/draftkings.png" },
  { name: "FanDuel", logo: "/images/sports-books/fanduel.png" },
  { name: "BetMGM", logo: "/images/sports-books/betmgm.png" },
  { name: "BetRivers", logo: "/images/sports-books/betrivers.png" },
  { name: "Caesars", logo: "/images/sports-books/caesars.png" },
  { name: "ESPN Bet", logo: "/images/sports-books/espnbet.png" },
  { name: "Fanatics", logo: "/images/sports-books/fanatics.png" },
  { name: "Hard Rock Bet", logo: "/images/sports-books/hardrockbet.png" },
  { name: "Pinnacle", logo: "/images/sports-books/pinnacle.png" },
  { name: "Bet365", logo: "/images/sports-books/bet365.png" },
];

export function SocialProofBar() {
  const logoWidth = 100;
  const gapWidth = 32;
  const totalWidth = sportsbooks.length * (logoWidth + gapWidth);
  const extendedLogos = [...sportsbooks, ...sportsbooks, ...sportsbooks];

  return (
    <div className="border-divide border-x border-t bg-neutral-50/50 dark:bg-neutral-900/50 py-6 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
          {/* Left: Social proof text */}
          <div className="flex-shrink-0 flex items-center gap-3 text-center md:text-left">
            <div className="p-2 bg-accent/10 rounded-lg">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">5,000+ bettors</div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">finding their edge</div>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden md:block w-px h-12 bg-neutral-200 dark:bg-neutral-700" />

          {/* Right: Scrolling logos */}
          <div className="flex-1 relative overflow-hidden">
            {/* Gradient overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-neutral-50/50 dark:from-neutral-900/50 to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-neutral-50/50 dark:from-neutral-900/50 to-transparent z-10" />

            {/* Scrolling container */}
            <div className="flex overflow-hidden py-2">
              <motion.div
                className="flex gap-8 items-center"
                animate={{
                  x: [-totalWidth, 0],
                }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: 40,
                    ease: "linear",
                  },
                }}
                style={{
                  width: `${totalWidth * 3}px`,
                }}
              >
                {extendedLogos.map((sportsbook, index) => (
                  <div
                    key={`${sportsbook.name}-${index}`}
                    className="flex-shrink-0 w-[100px] h-10 relative"
                  >
                    <div className="w-full h-full relative bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors">
                      <Image
                        src={sportsbook.logo}
                        alt={`${sportsbook.name} logo`}
                        fill
                        className="object-contain p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                        sizes="100px"
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

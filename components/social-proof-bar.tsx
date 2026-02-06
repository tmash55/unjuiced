"use client";
import React from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";

export function SocialProofBar({
  className,
  variant = "section",
  logoWidth = 100,
  gapWidth = 40,
  title = "Powered by 20+ sportsbooks",
}: {
  className?: string;
  variant?: "section" | "hero";
  logoWidth?: number;
  gapWidth?: number;
  title?: string;
}) {
  const isHero = variant === "hero";
  const sportsbooks = getAllActiveSportsbooks()
    .filter((sportsbook) => Boolean(sportsbook.image?.light))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((sportsbook) => ({
      name: sportsbook.name,
      logo: sportsbook.image.light,
    }));

  const totalWidth = sportsbooks.length * (logoWidth + gapWidth);
  const extendedLogos = [...sportsbooks, ...sportsbooks, ...sportsbooks];

  return (
    <div
      className={cn(
        isHero
          ? "bg-transparent pt-0 pb-3"
          : "relative overflow-hidden bg-transparent py-2",
        "overflow-hidden",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-12">
        {!isHero && (
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.26em] text-white/55">
            {title}
          </p>
        )}
        <div className="relative overflow-hidden">
          {/* Scrolling container */}
          <div
            className="flex overflow-hidden py-1"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <motion.div
              className="flex gap-10 items-center"
              animate={{
                x: [0, -totalWidth],
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 60,
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
                  className={cn(
                    "flex-shrink-0 w-[100px] h-10 relative transition-opacity",
                    isHero ? "opacity-70 hover:opacity-100" : "opacity-78 hover:opacity-100",
                  )}
                >
                  <Image
                    src={sportsbook.logo}
                    alt={`${sportsbook.name} logo`}
                    fill
                    className={cn(
                      "object-contain p-0.5",
                      isHero ? "opacity-80 mix-blend-screen saturate-125" : "",
                    )}
                    sizes="100px"
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

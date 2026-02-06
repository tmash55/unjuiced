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
    <div className={cn("overflow-hidden", className)}>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {!isHero && (
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.26em] text-white/40">
            {title}
          </p>
        )}
        <div className="relative overflow-hidden">
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
              className="flex items-center gap-10"
              animate={{ x: [0, -totalWidth] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 60,
                  ease: "linear",
                },
              }}
              style={{ width: `${totalWidth * 3}px` }}
            >
              {extendedLogos.map((sportsbook, index) => (
                <div
                  key={`${sportsbook.name}-${index}`}
                  className="relative h-10 w-[100px] shrink-0 opacity-40 transition-opacity hover:opacity-70"
                >
                  <Image
                    src={sportsbook.logo}
                    alt={`${sportsbook.name} logo`}
                    fill
                    className="object-contain"
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

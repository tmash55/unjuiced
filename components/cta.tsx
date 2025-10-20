"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Container } from "./container";
import { SectionHeading } from "./seciton-heading";
import { ButtonLink } from "./button-link";
import Image from "next/image";

export type CTAOrbitProps = {
  size?: number;
  className?: string;
  showRings?: boolean;
  ringDurationsSec?: number[];
  numRings?: number;
};

export const CTA = () => {
  return (
    <Container className="border-divide relative flex min-h-60 flex-col items-center justify-center overflow-hidden border-x px-4 py-4 md:min-h-120">
      <CTAOrbit className="absolute inset-x-0 -top-120 mask-b-from-30%" />
      <SectionHeading className="relative z-10 text-center lg:text-6xl">
        Find the Best Odds. <br /> Every Time.
      </SectionHeading>
      <ButtonLink href="/register" variant="primary" className="relative z-20 mt-4">
        Start Comparing
      </ButtonLink>
    </Container>
  );
};

export const CTAOrbit: React.FC<CTAOrbitProps> = ({
  size = 800,
  className,
  showRings = true,
  ringDurationsSec,
  numRings = 3,
}) => {
  const sportsbooks = [
    { name: "DraftKings", logo: "/images/sports-books/draftkings.png" },
    { name: "FanDuel", logo: "/images/sports-books/fanduel.png" },
    { name: "BetMGM", logo: "/images/sports-books/betmgm.png" },
    { name: "Caesars", logo: "/images/sports-books/caesars.png" },
    { name: "ESPN BET", logo: "/images/sports-books/espnbet.png" },
    { name: "Fanatics", logo: "/images/sports-books/fanatics.png" },
    { name: "BetRivers", logo: "/images/sports-books/betrivers.png" },
    { name: "Pinnacle", logo: "/images/sports-books/pinnacle.png" },
    { name: "Fliff", logo: "/images/sports-books/fliff.png" },
    { name: "Hard Rock", logo: "/images/sports-books/hardrockbet.png" },
    { name: "Circa", logo: "/images/sports-books/circa.png" },
    { name: "BetParx", logo: "/images/sports-books/betparx.png" },
    { name: "Bovada", logo: "/images/sports-books/bovada.png" },
    { name: "BallyBet", logo: "/images/sports-books/ballybet.png" },
  ];
  const total = sportsbooks.length;

  // Compute ring weights (fewer inner, more outer): proportional 1..numRings
  const weights = Array.from({ length: numRings }, (_, i) => i + 1); // [1,2,...]
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const countsBase = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - countsBase.reduce((a, b) => a + b, 0);
  // Distribute remainder from outermost inward to favor outer rings
  for (let i = numRings - 1; i >= 0 && remainder > 0; i--) {
    countsBase[i] += 1;
    remainder--;
  }
  const counts: number[] = countsBase; // inner→outer

  let cursor = 0;
  const rings: typeof sportsbooks[] = counts.map((count) => {
    const slice = sportsbooks.slice(cursor, cursor + count);
    cursor += count;
    return slice;
  });

  // Dynamic ring scales (inner→outer)
  const innerScale = 0.42;
  const outerScale = 0.94;
  const ringScaleFactors: number[] =
    numRings <= 1
      ? [(innerScale + outerScale) / 2]
      : Array.from(
          { length: numRings },
          (_, i) =>
            innerScale + ((outerScale - innerScale) * i) / (numRings - 1),
        );

  const renderRing = (ringIndex: number) => {
    const ringSportsbooks = rings[ringIndex];
    const count = ringSportsbooks.length;
    if (count === 0) return null;

    const diameter = Math.round(size * ringScaleFactors[ringIndex]);
    const radius = diameter / 2;
    const defaultBase = 18;
    const defaultStep = 8;
    const duration =
      (ringDurationsSec && ringDurationsSec[ringIndex]) ??
      defaultBase + defaultStep * ringIndex;
    const reverse = ringIndex % 2 === 1;

    return (
      <div
        key={`ring-${ringIndex}`}
        className={cn(
          "absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full",
          reverse ? "animate-counter-orbit" : "animate-orbit",
        )}
        style={{
          width: diameter,
          height: diameter,
          ["--duration" as any]: `${duration}s`,
        }}
      >
        <div className="relative h-full w-full">
          {ringSportsbooks.map((sportsbook, idx) => {
            const angleDeg = (360 / count) * idx;
            const translate = radius;
            return (
              <div
                key={`ring-${ringIndex}-logo-${idx}`}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  transform: `rotate(${angleDeg}deg) translateX(${translate}px)`,
                }}
              >
                <div style={{ transform: `rotate(${-angleDeg}deg)` }}>
                  <div
                    className={cn(
                      "shadow-aceternity flex size-14 items-center justify-center rounded-md bg-white p-2 dark:bg-neutral-950",
                      reverse ? "animate-orbit" : "animate-counter-orbit",
                    )}
                    style={{
                      ["--duration" as any]: `${duration}s`,
                    }}
                  >
                    <Image
                      src={sportsbook.logo || "/images/sports-books/generic-sportsbook.svg"}
                      alt={sportsbook.name}
                      width={40}
                      height={40}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative mx-auto flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showRings && (
        <div className="pointer-events-none absolute inset-0 z-0">
          {Array.from({ length: numRings }, (_, idx) => numRings - 1 - idx).map(
            (i) => {
              const diameter = Math.round(size * ringScaleFactors[i]);
              return (
                <div
                  key={`bg-ring-${i}`}
                  className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-inner",
                    i === 0 && "bg-neutral-300 dark:bg-neutral-500",
                    i === 1 && "bg-neutral-200 dark:bg-neutral-600",
                    i === 2 && "bg-neutral-100 dark:bg-neutral-700",
                    i === 3 && "bg-neutral-50 dark:bg-neutral-800",
                  )}
                  style={{
                    width: diameter,
                    height: diameter,
                  }}
                />
              );
            },
          )}
        </div>
      )}
      {Array.from({ length: numRings }, (_, idx) => numRings - 1 - idx).map(
        (ringIndex) => renderRing(ringIndex),
      )}
    </div>
  );
};

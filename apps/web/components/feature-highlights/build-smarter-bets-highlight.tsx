"use client";

import React from "react";
import Image from "next/image";
import { FeatureHighlight } from "@/components/feature-highlight";

export function BuildSmarterBetsHighlight() {
  return (
    <FeatureHighlight
      badge="Execute"
      title="Turn Data Into Better Bets"
      description="Save plays to My Slips, build same-game parlays, compare payouts across books, and deep-link straight to your sportsbook."
      ctaText="Learn More"
      ctaHref="/features/my-slips"
      className="bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)]"
    >
      <div className="relative w-full rounded-xl">
        <Image
          src="/landing-page/slips-main.png"
          alt="My Slips desktop view with play tracking and parlay builder"
          width={1920}
          height={1080}
          className="w-full rounded-lg"
          quality={90}
        />
        <div className="absolute bottom-2 right-2 w-[24%] sm:bottom-3 sm:right-3 sm:w-[20%] md:bottom-4 md:right-4 lg:bottom-5 lg:right-5 lg:w-[18%]">
          <div className="overflow-hidden rounded-lg border-2 border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.5)] sm:rounded-xl md:rounded-2xl">
            <Image
              src="/landing-page/slips-mobile.png"
              alt="My Slips mobile view"
              width={390}
              height={844}
              className="block w-full"
              quality={90}
            />
          </div>
        </div>
      </div>
    </FeatureHighlight>
  );
}

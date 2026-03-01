"use client";
import React from "react";
import { TabbedFeatureSection } from "../../tabbed-feature-section";
import {
  HitRateMatrixSkeleton,
  InjuryImpactSkeleton,
  AltLineGridSkeleton,
  TripleDoubleSkeleton,
} from "./skeletons";
import { SVGProps } from "react";

export const CheatSheetFeatures = () => {
  const tabs = [
    {
      title: "Hit Rate Cheat Sheet",
      description: "A master view of every player prop, ranked by L5/L10 hit rates and confidence scores. Find the green on the board instantly without clicking through hundreds of players.",
      icon: GridIcon,
      id: "hit-rate-matrix",
      skeleton: <HitRateMatrixSkeleton />,
      learnMoreHref: "/cheatsheets/nba/hit-rates",
    },
    {
      title: "Injury Impact",
      description: "Capitalize on lineup changes. Automatically see which players get a usage and stat boost when a star teammate is out — with historical performance data.",
      icon: HeartPulseIcon,
      id: "injury-impact",
      skeleton: <InjuryImpactSkeleton />,
      learnMoreHref: "/cheatsheets/nba/injury-impact",
    },
    {
      title: "Triple Double Sheet",
      description: "Compare SGP-built triple double pricing against the actual triple double market. Instantly spot +EV opportunities where the SGP payout exceeds the market price.",
      icon: TripleIcon,
      id: "triple-double",
      skeleton: <TripleDoubleSkeleton />,
      learnMoreHref: "/cheatsheets/nba/triple-double",
    },
    {
      title: "Alt Line Grids",
      description: "Find safer floors or ladder opportunities. Toggle between different line thresholds to find the perfect risk/reward ratio for any player prop.",
      icon: SlidersIcon,
      id: "alt-lines",
      skeleton: <AltLineGridSkeleton />,
      learnMoreHref: "/cheatsheets/nba/hit-rates",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Cheat Sheets"
      heading="Scan the Entire Slate in Seconds."
      subheading="Don't click through hundreds of players. Our cheat sheets rank every available prop by hit rate, value, and injury impact — so you can find opportunities fast."
      ctaText="View Cheat Sheets"
      ctaHref="/cheatsheets/nba/hit-rates"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={10000}
    />
  );
};

// Icons
const GridIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const HeartPulseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1 8H4L5.5 5L8 11L10.5 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TripleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="4" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const SlidersIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 4H8M12 4H14M10 2V6M2 8H4M8 8H14M6 6V10M2 12H10M14 12H14M12 10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);


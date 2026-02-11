"use client";
import React from "react";
import { TabbedFeatureSection } from "../../tabbed-feature-section";
import { EVFinderSkeleton, EdgeFinderSkeleton, KellyCalculatorSkeleton } from "./skeletons";
import { SVGProps } from "react";

export const EVFeatures = () => {
  const tabs = [
    {
      title: "+EV Finder",
      description: "Discover bets where the true probability of winning exceeds the implied odds. Sharp book consensus pricing reveals hidden value.",
      icon: TrendingUpIcon,
      id: "ev-finder",
      skeleton: <EVFinderSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "Edge Finder",
      description: "Spot lines that deviate significantly from the market average before they move. Cross-book comparison with historical line movement.",
      icon: SearchIcon,
      id: "edge-finder",
      skeleton: <EdgeFinderSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "Kelly Calculator",
      description: "Calculate optimal bet sizing based on your edge and bankroll. Full and fractional Kelly with risk-adjusted recommendations.",
      icon: CalculatorIcon,
      id: "kelly-calculator",
      skeleton: <KellyCalculatorSkeleton />,
      learnMoreHref: "/positive-ev",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="+EV & Edge Tools"
      heading="Find Mathematically Profitable Bets"
      subheading="Use sharp book pricing and edge detection to identify value others miss."
      ctaText="Explore +EV Bets"
      ctaHref="/positive-ev"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={8000}
    />
  );
};

// Icons
const TrendingUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 12L6 8L9 11L14 4M14 4H10M14 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 14L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CalculatorIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 5H11M5 8H8M5 11H11M10 8H11M10 11H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

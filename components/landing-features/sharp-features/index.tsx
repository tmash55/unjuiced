"use client";
import React from "react";
import { TabbedFeatureSection } from "../../tabbed-feature-section";
import { 
  EdgeFinderSkeleton, 
  ArbitrageSkeleton, 
  LiveOddsSkeleton 
} from "./skeletons";
import { SVGProps } from "react";

export const SharpFeatures = () => {
  const tabs = [
    {
      title: "Edge Finder (+EV)",
      description: "Our algorithms compare lines against sharp bookmakers to identify mathematically profitable bets. Filter by EV%, Kelly stake, and market type to match your strategy.",
      icon: TargetIcon,
      id: "edge-finder",
      skeleton: <EdgeFinderSkeleton />,
      learnMoreHref: "/pro/ev",
    },
    {
      title: "Arbitrage Scanner",
      description: "Lock in risk-free profit by exploiting line discrepancies between different sportsbooks. Real-time detection with stake calculations included.",
      icon: ScaleIcon,
      id: "arbitrage",
      skeleton: <ArbitrageSkeleton />,
      learnMoreHref: "/pro/arbitrage",
    },
    {
      title: "Live Odds Screen",
      description: "The ultimate command center. View real-time line movement across 20+ books, customize your columns, and deep link directly to your sportsbook's bet slip.",
      icon: ZapIcon,
      id: "live-odds",
      skeleton: <LiveOddsSkeleton />,
      learnMoreHref: "/odds/nfl",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Pro Tools"
      heading="Find the Edge the Books Missed."
      subheading="Tools for the serious bettor. Identify pricing errors, arbitrage opportunities, and positive EV plays in real-time across 20+ sportsbooks."
      ctaText="Explore Pro Tools"
      ctaHref="/pro/ev"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={10000}
    />
  );
};

// Icons
const TargetIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
  </svg>
);

const ScaleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8 2V14M3 4L8 2L13 4M3 4V6C3 7 4 8 5.5 8M13 4V6C13 7 12 8 10.5 8M3 12H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ZapIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


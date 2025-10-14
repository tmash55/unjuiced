"use client";
import React from "react";
import { TabbedFeatureSection } from "../tabbed-feature-section";
import { SVGProps } from "react";

// You would create your own skeletons specific to Positive EV features
// For now, using placeholder components
const EVOpportunitiesSkeleton = () => <div className="text-center text-gray-500">EV Opportunities Display</div>;
const EVCalculatorSkeleton = () => <div className="text-center text-gray-500">EV Calculator Display</div>;
const EVTrackerSkeleton = () => <div className="text-center text-gray-500">EV Tracker Display</div>;

export const OddsScreenFeatures = () => {
  const tabs = [
    {
      title: "Real-Time Odds Across 300+ Markets",
      description: "Stay ahead with live odds updated every few 2-3 seconds for game lines and player props across NFL, NCAAF, NBA, NHL, MLB, WNBA. Access both main and alternate lines for over 300+ markets.",
      icon: EVIcon,
      id: "opportunities",
      skeleton: <EVOpportunitiesSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "Customize Odds Screen",
      description: "Build your perfect view. Drag and drop columns, hide or display sportsbooks, and create custom layouts tailored to your betting strategy. Your Preferences are saved for seamless experience everyt time you log in.",
      icon: CalculatorIcon,
      id: "calculator",
      skeleton: <EVCalculatorSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "One-Click Betslip Integration",
      description: "Found the line you want? Deep link directly to your sportsbooks with one click - your selection is added to your betslip instantly. No copy-pasting, no wasted time.",
      icon: ChartIcon,
      id: "tracker",
      skeleton: <EVTrackerSkeleton />,
      learnMoreHref: "/positive-ev",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Positive EV"
      heading="Find profitable edges, automatically."
      subheading="Our algorithm scans thousands of lines per second to identify positive expected value opportunities before they disappear."
      ctaText="Start Finding +EV"
      ctaHref="/positive-ev"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={10000} // 10 seconds per tab
    />
  );
};

// Example icons - you would use your own
const EVIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 1L10.5 6L16 7L12 11L13 16L8 13.5L3 16L4 11L0 7L5.5 6L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const CalculatorIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="4" y="3" width="8" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="5" cy="9" r="0.5" fill="currentColor"/>
      <circle cx="8" cy="9" r="0.5" fill="currentColor"/>
      <circle cx="11" cy="9" r="0.5" fill="currentColor"/>
      <circle cx="5" cy="12" r="0.5" fill="currentColor"/>
      <circle cx="8" cy="12" r="0.5" fill="currentColor"/>
      <circle cx="11" cy="12" r="0.5" fill="currentColor"/>
    </svg>
  );
};

const ChartIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M2 14L5 11L8 13L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 6H14V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};


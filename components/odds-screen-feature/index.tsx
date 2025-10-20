"use client";
import React from "react";
import { TabbedFeatureSection } from "../tabbed-feature-section";
import { OddsLiveSkeleton, CustomizationSkeleton, DeepLinkSkeleton } from "./skeletons";
import { SVGProps } from "react";

// Icons remain minimal; skeletons below provide rich visuals for each tab

export const OddsScreenFeatures = () => {
  const tabs = [
    {
      title: "Lightning-Fast Odds Updates",
      description: "Never miss a move. Odds Refresh every 2-3 seconds across 300+ markets. Main and alternate game lines and player props for NFL, NCAAF, NBA, NHL, MLB, and WNBA.",
      icon: EVIcon,
      id: "opportunities",
      skeleton: <OddsLiveSkeleton />,
      learnMoreHref: "/odds/nfl",
    },
    {
      title: "Your Screen, Your Rules",
      description: "Customize everything. Drag and Drop columns, hide sportsbooks you don't need, and save your perfect layout for instant access everytime you log in.",
      icon: CalculatorIcon,
      id: "calculator",
      skeleton: <CustomizationSkeleton />,
      learnMoreHref: "/odds/nfl",
    },
    {
      title: "One-Click Betslip Integration",
      description: "Found the line you want? Deep link directly to your sportsbooks with one click - your selection is added to your betslip instantly. No copy-pasting, no wasted time.",
      icon: ChartIcon,
      id: "tracker",
      skeleton: <DeepLinkSkeleton />,
      learnMoreHref: "/odds/nfl",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Odds Screen"
      heading="The Ultimate Odds Screen"
      subheading="Compare game lines and player props across every major sportsbook in real time. Customize your view, track 300+ markets, and never miss the best line again."
      ctaText="Explore the Odds"
      ctaHref="/odds/nfl"
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
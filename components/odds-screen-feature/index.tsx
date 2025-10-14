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
      title: "Lightning-Fast Odds Updates",
      description: "Never miss a move. Odds refresh every 2–3 seconds across 300+ markets—game lines, player props, and alternate lines for  NFL, NCAAF, NBA, NHL, MLB, WNBA, and more coming.",
      icon: EVIcon,
      id: "opportunities",
      skeleton: <EVOpportunitiesSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "Your Screen, Your Rules",
      description: "Customize everything. Drag and drop columns, hide sportsbooks you don’t need, and save your perfect layout for instant access every time you log in.",
      icon: CalculatorIcon,
      id: "calculator",
      skeleton: <EVCalculatorSkeleton />,
      learnMoreHref: "/positive-ev",
    },
    {
      title: "All Markets. One Screen",
      description: "Compare odds from every major sportsbook in one place. No more tab-hopping—just the best lines at your fingertips.",
      icon: ChartIcon,
      id: "tracker",
      skeleton: <EVTrackerSkeleton />,
      learnMoreHref: "/positive-ev",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Positive EV"
      heading="The Ultimate Odds Screen—Built for Speed and Control"
      subheading="Compare game lines and player props across every major sportsbook in real time. Customize your view, track 300+ markets, and never miss the best line again."
      ctaText="Start Exploring Odds"
      ctaHref="/pdds/nfl"
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


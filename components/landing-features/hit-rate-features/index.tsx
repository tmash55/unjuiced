"use client";
import React from "react";
import { TabbedFeatureSection } from "../../tabbed-feature-section";
import { 
  HitRateChartSkeleton, 
  ContextualFiltersSkeleton, 
  MatchupDvpSkeleton 
} from "./skeletons";
import { SVGProps } from "react";

export const HitRateFeatures = () => {
  const tabs = [
    {
      title: "Visual Hit Rates",
      description: "See the last 5, 10, and 20 games instantly. Identify streaks and slumps with clear, visual bar charts that show exactly how often a player hits their prop.",
      icon: ChartBarIcon,
      id: "hit-rate-chart",
      skeleton: <HitRateChartSkeleton />,
      learnMoreHref: "/hit-rates/nba",
    },
    {
      title: "Contextual Filters",
      description: "Filter game logs by 'Home/Away', 'With/Without Teammate', or 'Vs Specific Defense' to uncover the real story behind the numbers.",
      icon: FilterIcon,
      id: "contextual-filters",
      skeleton: <ContextualFiltersSkeleton />,
      learnMoreHref: "/hit-rates/nba",
    },
    {
      title: "Matchup & DvP Analysis",
      description: "Know the matchup before you bet. See how opponents defend specific positions and play styles with our Defense vs Position rankings.",
      icon: ShieldIcon,
      id: "matchup-dvp",
      skeleton: <MatchupDvpSkeleton />,
      learnMoreHref: "/hit-rates/nba",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="Player Analytics"
      heading="Stop Guessing. Start Analyzing."
      subheading="Go beyond simple averages. Visualize performance trends, analyze specific matchups, and filter for the exact context of tonight's game."
      ctaText="Explore Hit Rates"
      ctaHref="/hit-rates/nba"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={10000}
    />
  );
};

// Icons
const ChartBarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 14V8M6 14V4M10 14V6M14 14V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FilterIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 3H14M4 7H12M6 11H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShieldIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8 1L2 4V8C2 11.5 4.5 14.5 8 15C11.5 14.5 14 11.5 14 8V4L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


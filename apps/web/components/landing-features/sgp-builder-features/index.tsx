"use client";
import React from "react";
import { TabbedFeatureSection } from "../../tabbed-feature-section";
import { BuildParlaysSkeleton, CompareOddsSkeleton, AccuratePricingSkeleton } from "./skeletons";
import { SVGProps } from "react";

export const SGPBuilderFeatures = () => {
  const tabs = [
    {
      title: "Build Your Parlay",
      description: "Add legs from any game, any market. Our intuitive interface makes building complex parlays simple with instant search and real-time odds updates.",
      icon: PlusIcon,
      id: "build-parlay",
      skeleton: <BuildParlaysSkeleton />,
      learnMoreHref: "/parlay-builder",
    },
    {
      title: "Compare Odds",
      description: "See which sportsbook offers the best payout for your exact parlay combination. Side-by-side comparison with one-click deep links.",
      icon: ChartIcon,
      id: "compare-odds",
      skeleton: <CompareOddsSkeleton />,
      learnMoreHref: "/parlay-builder",
    },
    {
      title: "Accurate Pricing",
      description: "Our SGP+ correlation engine ensures you're getting fair odds on correlated legs. Know when a book is overcharging for correlation.",
      icon: ShieldIcon,
      id: "accurate-pricing",
      skeleton: <AccuratePricingSkeleton />,
      learnMoreHref: "/parlay-builder",
    },
  ];

  return (
    <TabbedFeatureSection
      badge="SGP Builder"
      heading="Build Smarter Same Game Parlays"
      subheading="Compare SGP odds across sportsbooks and find the best payouts for your picks."
      ctaText="Try SGP Builder"
      ctaHref="/parlay-builder"
      tabs={tabs}
      autoRotate={true}
      autoRotateDuration={8000}
    />
  );
};

// Icons
const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChartIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M2 14V8M6 14V4M10 14V6M14 14V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShieldIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M8 1L2 4V8C2 11.5 4.5 14.5 8 15C11.5 14.5 14 11.5 14 8V4L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 8L7.5 9.5L10 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

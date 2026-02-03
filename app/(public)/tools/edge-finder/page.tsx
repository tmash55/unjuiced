import { Metadata } from "next";
import { ToolPreviewLayout, ToolFeature, ToolBenefit } from "@/components/tool-preview";
import { buildRegisterCheckoutPath } from "@/constants/billing";
import { TrendingUp, Zap, Target, BarChart3, Clock, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Edge Finder - Find Mispriced Odds Across Sportsbooks",
  description: "Discover betting edges by comparing odds across 20+ sportsbooks. Find value bets with positive expected value in seconds.",
  openGraph: {
    title: "Edge Finder - Find Mispriced Odds Across Sportsbooks",
    description: "Discover betting edges by comparing odds across 20+ sportsbooks. Find value bets with positive expected value in seconds.",
  },
};

const features: ToolFeature[] = [
  {
    title: "Real-Time Comparison",
    description: "Compare odds across 20+ sportsbooks instantly. Our system updates every few seconds to catch edges before they disappear.",
    icon: <Clock className="size-5 text-amber-600" />,
  },
  {
    title: "Expected Value Calculator",
    description: "See exactly how much edge you have on every bet. We calculate EV against sharp books like Pinnacle for accuracy.",
    icon: <TrendingUp className="size-5 text-amber-600" />,
  },
  {
    title: "Multi-Sport Coverage",
    description: "Find edges across NFL, NBA, NHL, MLB, NCAAF, NCAAB, and more. Both game lines and player props supported.",
    icon: <Target className="size-5 text-amber-600" />,
  },
  {
    title: "Smart Filters",
    description: "Filter by sport, market, book, minimum EV, and more. Save your favorite filter presets for quick access.",
    icon: <BarChart3 className="size-5 text-amber-600" />,
  },
  {
    title: "One-Click Bet Links",
    description: "Click any bet to open directly in your sportsbook app. No more manually searching for the line.",
    icon: <Zap className="size-5 text-amber-600" />,
  },
  {
    title: "Devigging Methods",
    description: "Choose between Power and Multiplicative devigging methods. Customize your EV calculation approach.",
    icon: <Shield className="size-5 text-amber-600" />,
  },
];

const benefits: ToolBenefit[] = [
  { text: "Real-Time Updates" },
  { text: "20+ Sportsbooks" },
  { text: "+EV Opportunities" },
];

export default function EdgeFinderPreview() {
  return (
    <ToolPreviewLayout
      title="Edge Finder"
      tagline="Find mispriced odds across every sportsbook"
      description="Stop leaving money on the table. Edge Finder scans 20+ sportsbooks in real-time to surface positive expected value bets before the lines move. See exactly how much edge you have on every opportunity."
      features={features}
      benefits={benefits}
      ctaText="Start Finding Edges"
      ctaHref={buildRegisterCheckoutPath("sharp", "monthly", { trialDays: 3 })}
      accentColor="#f59e0b"
      category="Betting Tools"
      toolPath="/edge-finder"
    />
  );
}

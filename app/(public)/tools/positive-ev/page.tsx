import { Metadata } from "next";
import { ToolPreviewLayout, ToolFeature, ToolBenefit } from "@/components/tool-preview";
import { Calculator, TrendingUp, Zap, BarChart3, Clock, Target } from "lucide-react";
import { buildRegisterCheckoutPath } from "@/constants/billing";

export const metadata: Metadata = {
  title: "Positive EV Tool - Data-Driven Betting Edges",
  description: "Find positive expected value bets with calculated ROI. Compare odds against sharp lines and bet with confidence.",
  openGraph: {
    title: "Positive EV Tool - Data-Driven Betting Edges",
    description: "Find positive expected value bets with calculated ROI. Compare odds against sharp lines and bet with confidence.",
  },
};

const features: ToolFeature[] = [
  {
    title: "Sharp Line Comparison",
    description: "Every bet is compared against Pinnacle's sharp lines. See exactly how much value you're getting vs the true odds.",
    icon: <TrendingUp className="size-5 text-violet-600" />,
  },
  {
    title: "Expected Value Display",
    description: "See the EV percentage for every opportunity. Know exactly what edge you have before placing your bet.",
    icon: <Calculator className="size-5 text-violet-600" />,
  },
  {
    title: "Fair Odds Calculator",
    description: "View the true fair odds for any line. Understand the implied probability without the vig.",
    icon: <BarChart3 className="size-5 text-violet-600" />,
  },
  {
    title: "Real-Time Updates",
    description: "Lines update every few seconds. Never miss an edge due to stale data.",
    icon: <Clock className="size-5 text-violet-600" />,
  },
  {
    title: "Multi-Book Coverage",
    description: "Compare prices across all major US sportsbooks. DraftKings, FanDuel, BetMGM, Caesars, and more.",
    icon: <Target className="size-5 text-violet-600" />,
  },
  {
    title: "Instant Bet Links",
    description: "One click opens the bet directly in your sportsbook app. Jump on edges before they disappear.",
    icon: <Zap className="size-5 text-violet-600" />,
  },
];

const benefits: ToolBenefit[] = [
  { text: "Sharp Line Data" },
  { text: "EV Calculated" },
  { text: "Real-Time Prices" },
];

export default function PositiveEvPreview() {
  return (
    <ToolPreviewLayout
      title="Positive Expected Value (EV)"
      tagline="Data-driven edges with expected ROI on every bet"
      description="Make smarter bets with mathematically proven edges. Our Positive Expected Value tool compares every line against sharp books to show you exactly how much value you're getting—and where to find the best prices."
      features={features}
      benefits={benefits}
      ctaText="Find +EV Bets"
      ctaHref={buildRegisterCheckoutPath("sharp", "monthly", { trialDays: 3 })}
      accentColor="#8b5cf6"
      category="Betting Tools"
      toolPath="/positive-ev"
    />
  );
}

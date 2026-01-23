import { Metadata } from "next";
import { ToolPreviewLayout, ToolFeature, ToolBenefit } from "@/components/tool-preview";
import { Link2, Shield, Calculator, Zap, Clock, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Arbitrage Tool - Risk-Free Betting Opportunities",
  description: "Find guaranteed profit opportunities by betting both sides across different sportsbooks. Lock in returns regardless of outcome.",
  openGraph: {
    title: "Arbitrage Tool - Risk-Free Betting Opportunities",
    description: "Find guaranteed profit opportunities by betting both sides across different sportsbooks. Lock in returns regardless of outcome.",
  },
};

const features: ToolFeature[] = [
  {
    title: "Guaranteed Profit",
    description: "Lock in returns regardless of the outcome. Our scanner finds price discrepancies you can exploit across books.",
    icon: <Shield className="size-5 text-blue-600" />,
  },
  {
    title: "Automatic Leg Matching",
    description: "We do the math for you. See both legs of every arb with optimal stake sizing calculated instantly.",
    icon: <Link2 className="size-5 text-blue-600" />,
  },
  {
    title: "ROI Calculator",
    description: "See the exact return percentage on every opportunity. Filter by minimum ROI to focus on the best plays.",
    icon: <Calculator className="size-5 text-blue-600" />,
  },
  {
    title: "Real-Time Scanning",
    description: "Our system scans continuously to catch arbs the moment they appear. Speed is everything in arbitrage.",
    icon: <Clock className="size-5 text-blue-600" />,
  },
  {
    title: "Multi-Sport Coverage",
    description: "Find arbs across NFL, NBA, NHL, MLB, college sports, and more. Both pregame and live opportunities.",
    icon: <Target className="size-5 text-blue-600" />,
  },
  {
    title: "One-Click Execution",
    description: "Click any leg to open directly in the sportsbook app. Execute both sides quickly before lines move.",
    icon: <Zap className="size-5 text-blue-600" />,
  },
];

const benefits: ToolBenefit[] = [
  { text: "Risk-Free Returns" },
  { text: "Auto Stake Sizing" },
  { text: "Real-Time Alerts" },
];

export default function ArbitragePreview() {
  return (
    <ToolPreviewLayout
      title="Arbitrage"
      tagline="Risk-free opportunities across sportsbooks"
      description="Lock in guaranteed profits by exploiting price differences between sportsbooks. Our arbitrage scanner finds opportunities in real-time and calculates optimal stake sizes automatically—so you can execute before the edge disappears."
      features={features}
      benefits={benefits}
      ctaText="Find Arb Opportunities"
      accentColor="#2563eb"
      category="Betting Tools"
      toolPath="/arbitrage"
    />
  );
}

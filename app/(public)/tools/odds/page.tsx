import { Metadata } from "next";
import { ToolPreviewLayout, ToolFeature, ToolBenefit } from "@/components/tool-preview";
import { Eye, TrendingUp, Zap, BarChart3, Clock, Settings2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Odds Screen - Live Odds Comparison Across Sportsbooks",
  description: "Compare real-time odds across 20+ sportsbooks. See line movement, best prices, and alternate lines all in one place.",
  openGraph: {
    title: "Odds Screen - Live Odds Comparison Across Sportsbooks",
    description: "Compare real-time odds across 20+ sportsbooks. See line movement, best prices, and alternate lines all in one place.",
  },
};

const features: ToolFeature[] = [
  {
    title: "Real-Time Prices",
    description: "Odds update every few seconds across 20+ sportsbooks. Always see the current market prices.",
    icon: <Clock className="size-5 text-cyan-600" />,
  },
  {
    title: "Best Price Highlighting",
    description: "Instantly see which book has the best odds for any line. Green highlighting shows the best value.",
    icon: <Eye className="size-5 text-cyan-600" />,
  },
  {
    title: "Line Movement Tracking",
    description: "Watch how lines move over time. Understand market sentiment and catch steam moves early.",
    icon: <TrendingUp className="size-5 text-cyan-600" />,
  },
  {
    title: "Alternate Lines",
    description: "View all alternate spreads, totals, and player prop lines. Find value at different price points.",
    icon: <BarChart3 className="size-5 text-cyan-600" />,
  },
  {
    title: "Player Props",
    description: "Full coverage of player prop markets. Points, rebounds, assists, passing yards, and more.",
    icon: <Settings2 className="size-5 text-cyan-600" />,
  },
  {
    title: "One-Click Betting",
    description: "Click any cell to open directly in your sportsbook app. Seamless execution on any device.",
    icon: <Zap className="size-5 text-cyan-600" />,
  },
];

const benefits: ToolBenefit[] = [
  { text: "20+ Sportsbooks" },
  { text: "Real-Time Updates" },
  { text: "All Markets" },
];

export default function OddsPreview() {
  return (
    <ToolPreviewLayout
      title="Odds Screen"
      tagline="Live market odds with best-price highlights"
      description="Stop switching between sportsbook apps. Our odds screen shows real-time prices from 20+ books in one view—with the best odds highlighted so you always know where to bet. Game lines, player props, and alternates all in one place."
      features={features}
      benefits={benefits}
      ctaText="Compare Odds Now"
      accentColor="#00b4d8"
      category="Betting Tools"
      toolPath="/odds/nfl"
    />
  );
}

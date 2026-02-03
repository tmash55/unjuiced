import { Metadata } from "next";
import { ToolPreviewLayout, ToolFeature, ToolBenefit } from "@/components/tool-preview";
import { buildRegisterCheckoutPath } from "@/constants/billing";
import { BarChart3, TrendingUp, Users, Target, History, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Hit Rates - Player Prop Hit Rate Analysis",
  description: "Analyze player prop hit rates with L5, L10, L20, and season data. Find consistent performers and matchup-based edges.",
  openGraph: {
    title: "Hit Rates - Player Prop Hit Rate Analysis",
    description: "Analyze player prop hit rates with L5, L10, L20, and season data. Find consistent performers and matchup-based edges.",
  },
};

const features: ToolFeature[] = [
  {
    title: "Historical Hit Rates",
    description: "See L5, L10, L20, and season hit rates for every player prop. Understand performance consistency at a glance.",
    icon: <History className="size-5 text-emerald-600" />,
  },
  {
    title: "Game Log Analysis",
    description: "View detailed game-by-game performance. See exactly when and why players hit or missed their lines.",
    icon: <BarChart3 className="size-5 text-emerald-600" />,
  },
  {
    title: "Matchup Insights",
    description: "Defense vs Position rankings show how opponents affect player performance. Find favorable matchups.",
    icon: <Users className="size-5 text-emerald-600" />,
  },
  {
    title: "Hit Streaks",
    description: "Track current hit and miss streaks. Identify players on hot or cold runs.",
    icon: <TrendingUp className="size-5 text-emerald-600" />,
  },
  {
    title: "Market Coverage",
    description: "Points, rebounds, assists, 3-pointers, steals, blocks, and combo props. All major markets supported.",
    icon: <Target className="size-5 text-emerald-600" />,
  },
  {
    title: "Player Profiles",
    description: "Deep dive into any player with comprehensive stats, trends, and recent performance charts.",
    icon: <Zap className="size-5 text-emerald-600" />,
  },
];

const benefits: ToolBenefit[] = [
  { text: "L5/L10/L20 Data" },
  { text: "Game Log Analysis" },
  { text: "Matchup Insights" },
];

export default function HitRatesPreview() {
  return (
    <ToolPreviewLayout
      title="Hit Rates"
      tagline="Player prop analysis with historical performance data"
      description="Make better player prop bets with comprehensive hit rate data. See exactly how often players hit their lines over different sample sizes, analyze game logs for context, and find favorable matchups—all backed by historical data."
      features={features}
      benefits={benefits}
      ctaText="Analyze Hit Rates"
      ctaHref={buildRegisterCheckoutPath("scout", "monthly")}
      accentColor="#10b981"
      category="Player Props"
      badge="NEW"
      toolPath="/hit-rates/nba"
    />
  );
}

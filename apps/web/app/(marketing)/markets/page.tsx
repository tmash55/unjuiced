import { getSEOTags } from "@/lib/seo";
import MarketsClient from "./markets-client";

export const metadata = getSEOTags({
  title: "Betting Markets | Compare Odds Across All Sports",
  description: "Explore comprehensive betting markets for NFL, NBA, NHL, MLB, NCAAF, and NCAAB. Find the best odds on game lines, player props, and more.",
  canonicalUrlRelative: "/markets",
});

export default function MarketsPage() {
  return <MarketsClient />;
}

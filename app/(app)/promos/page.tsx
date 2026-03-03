import type { Metadata } from "next";
import { PromosPage } from "@/components/promos/promos-page";

export const metadata: Metadata = {
  title: "Promos & Boosts | Unjuiced.bet",
  description:
    "Daily sportsbook promotions, odds boosts, free bets, and insurance offers from DraftKings, FanDuel, Caesars, BetMGM, and more. Updated every day.",
  keywords: [
    "sportsbook promos",
    "odds boosts",
    "free bets",
    "DraftKings promo",
    "FanDuel boost",
    "sports betting promotions",
    "daily sportsbook offers",
  ],
  openGraph: {
    title: "Promos & Boosts | Unjuiced.bet",
    description:
      "Daily sportsbook promotions, odds boosts, and free bets — all in one place.",
    type: "website",
  },
};

export default function PromosRoute() {
  return <PromosPage />;
}
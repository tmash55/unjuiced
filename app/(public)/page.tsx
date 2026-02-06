import { CTA } from "@/components/cta";
import { FAQs } from "@/components/faqs";
import { HeroSpotlight } from "@/components/hero-spotlight";
import { SocialProofBar } from "@/components/social-proof-bar";
import { HitRatesHighlight } from "@/components/feature-highlights/hit-rates-highlight";
import { SmartEdgesHighlight } from "@/components/feature-highlights/smart-edges-highlight";
import { BuildSmarterBetsHighlight } from "@/components/feature-highlights/build-smarter-bets-highlight";
import { PricingHighlight } from "@/components/pricing-highlight";
import { MoreThanTools } from "@/components/more-than-tools";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags();

/**
 * Homepage - Unjuiced Landing Page
 * Restructured to showcase 5 core tools:
 * Hit Rate, SGP Builder, +EV, Edge Finder, Arbitrage
 */
export default function Home() {
  return (
    <>
      {/* 1. Hero */}
      <HeroSpotlight />

      <SocialProofBar
        variant="hero"
        className="bg-black pt-10 pb-10 sm:pt-12 sm:pb-12 lg:pt-16 lg:pb-16"
      />

      {/* 2b. Feature Highlight */}
      <HitRatesHighlight />

      <SmartEdgesHighlight />

      <BuildSmarterBetsHighlight />

      <PricingHighlight />

      <MoreThanTools />

      {/* 3. FAQs */}
      <section id="faq">
        <FAQs />
      </section>

      {/* 4. CTA */}
      <CTA />
    </>
  );
}

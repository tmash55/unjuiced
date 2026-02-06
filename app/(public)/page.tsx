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

export default function Home() {
  return (
    <>
      <HeroSpotlight />

      <SocialProofBar
        variant="hero"
        className="bg-black py-10 sm:py-12 lg:py-14"
      />

      <HitRatesHighlight />
      <SmartEdgesHighlight />
      <BuildSmarterBetsHighlight />

      <PricingHighlight />
      <MoreThanTools />

      <section id="faq">
        <FAQs />
      </section>

      <CTA />
    </>
  );
}

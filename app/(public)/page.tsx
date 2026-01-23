import { Benefits } from "@/components/benefits";
import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { OddsScreenFeatures } from "@/components/odds-screen-feature";
import { Pricing } from "@/components/pricing";
import { Security } from "@/components/security";
import { StatsWithNumberTicker } from "@/components/stats-with-ticker";
import { UseCases } from "@/components/use-cases";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags();

/**
 * Homepage - moved to (public) route group
 * Uses PublicNav via layout.tsx
 */
export default function Home() {
  return (
    <>
      <Hero />
      <StatsWithNumberTicker />
      <DivideX />
      <HowItWorks />
      <DivideX />
      <OddsScreenFeatures />
      <DivideX />
      <UseCases />
      <DivideX />
      <Benefits />
      <DivideX />
      <Pricing />
      <DivideX />
      <Security />
      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
    </>
  );
}

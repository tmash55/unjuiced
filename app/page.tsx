import { AgenticIntelligence } from "@/components/agentic-intelligence";
import { Benefits } from "@/components/benefits";
import { CTA, CTAOrbit } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Hero } from "@/components/hero";
import { HeroImage } from "@/components/hero-image";
import { HowItWorks } from "@/components/how-it-works";
import { PositiveEVFeatures } from "@/components/positive-ev";
import { OddsScreenFeatures } from "@/components/odds-screen-feature";
import { LogoCloud2 } from "@/components/logo-cloud-ace";
import { Pricing } from "@/components/pricing";
import { Security } from "@/components/security";
import { StatsWithNumberTicker } from "@/components/stats-with-ticker";
import { Testimonials } from "@/components/testimonials";
import { UseCases } from "@/components/use-cases";
import { FeatureSection } from "@/components/features";
import { Nav } from "@/components/nav/navbar";
import { Footer } from "@/components/footer";
import SportsbookGridSection from "@/components/sportsbooks-section";


import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags();

export default function Home() {
  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      <Nav />
      <DivideX />
      <Hero />
      <StatsWithNumberTicker/>
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
      <DivideX />
      <Footer />
    </main>
  );
}

import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { HeroV2 } from "@/components/hero-v2";
import { SocialProofBar } from "@/components/social-proof-bar";
import { ToolsOverview } from "@/components/tools-overview";
import { HitRateFeatures } from "@/components/landing-features/hit-rate-features";
import { SGPBuilderFeatures } from "@/components/landing-features/sgp-builder-features";
import { EVFeatures } from "@/components/landing-features/ev-features";
import { HowItWorks } from "@/components/how-it-works";
import { TestimonialsV2 } from "@/components/testimonials-v2";
import { WhyUnjuiced } from "@/components/why-unjuiced";
import { Pricing } from "@/components/pricing";

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
      <HeroV2 />

      {/* 2. Social Proof Bar */}
      <SocialProofBar />

      <DivideX />

      {/* 3. Tools Overview (5 tabs) */}
      <section id="tools">
        <ToolsOverview />
      </section>

      <DivideX />

      {/* 4. Hit Rate Features */}
      <section id="hit-rates">
        <HitRateFeatures />
      </section>

      <DivideX />

      {/* 5. SGP Builder Features */}
      <section id="sgp-builder">
        <SGPBuilderFeatures />
      </section>

      <DivideX />

      {/* 6. EV Tools (+EV Finder & Edge Finder) */}
      <section id="ev-tools">
        <EVFeatures />
      </section>

      <DivideX />

      {/* 7. Arbitrage Features */}
      <section id="how-it-works">
        <HowItWorks />
      </section>

      <DivideX />

      {/* 8. Testimonials */}
      <section id="testimonials">
        <TestimonialsV2 />
      </section>

      <DivideX />

      {/* 9. Why Unjuiced */}
      <section id="why-unjuiced">
        <WhyUnjuiced />
      </section>

      <DivideX />

      {/* 10. Pricing */}
      <section id="pricing">
        <Pricing />
      </section>

      <DivideX />

      {/* 11. FAQs */}
      <section id="faq">
        <FAQs />
      </section>

      <DivideX />

      {/* 12. CTA */}
      <CTA />
    </>
  );
}

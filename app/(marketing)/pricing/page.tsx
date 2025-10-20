import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Pricing } from "@/components/pricing";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Pricing | Unjuiced",
  description:
    "Choose the perfect plan for your betting strategy. Start with our free plan or unlock Pro features with real-time updates and unlimited arbitrage detection.",
});

export default function PricingPage() {
  return (
    <main>
      <DivideX />
      <Pricing />
      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { PricingNew } from "@/components/pricing-new";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Pricing | Unjuiced",
  description:
    "Choose the perfect plan for your betting strategy. From free tools to professional-grade arbitrage and EV scanning across 20+ sportsbooks.",
});

export default function PricingPage() {
  return (
    <main>
      <PricingNew />
      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

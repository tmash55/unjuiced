import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Pricing } from "@/components/pricing";
import { PricingTable } from "@/components/pricing-table";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Sportsbooks - Unjuiced | View Sportsbooks",
  description:
    "View the Sportsbooks that Unjuiced supports and are partners with.",
});

export default function SportsbooksPage() {
  return (
    <main>
      <DivideX />
      <Pricing />
      <DivideX />
      <PricingTable />
      {/* <DivideX /> */}
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

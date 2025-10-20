import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Sportsbooks | Unjuiced",
  description:
    "View all 20+ sportsbooks that Unjuiced supports for real-time odds comparison and arbitrage detection.",
});

export default function SportsbooksPage() {
  return (
    <main>
      <DivideX />
      {/* TODO: Add sportsbooks grid/list component here */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold">Supported Sportsbooks</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Coming soon: View all 20+ sportsbooks we support with detailed information.
        </p>
      </div>
      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

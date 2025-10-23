import { CTA } from "@/components/cta";
import { DivideX } from "@/components/divide";
import { FAQs } from "@/components/faqs";
import { Container } from "@/components/container";
import { Badge } from "@/components/badge";
import { SectionHeading } from "@/components/seciton-heading";
import { SubHeading } from "@/components/subheading";

import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Sportsbooks | Unjuiced",
  description:
    "View all 20+ sportsbooks that Unjuiced supports for real-time odds comparison and arbitrage detection.",
});

export default function SportsbooksPage() {
  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      {/* Hero Section */}
      <Container className="border-divide border-x">
        <div className="flex flex-col items-center py-20 px-4">
          <Badge text="Sportsbooks" />
          <SectionHeading className="mt-4">
            Every Book. Best Odds.
          </SectionHeading>
          <SubHeading as="p" className="mx-auto mt-6 max-w-2xl text-center">
            Compare odds across 20+ trusted sportsbooks in real-time. Find the best lines for every bet and maximize your edge with instant odds comparison.
          </SubHeading>
        </div>
      </Container>

      <DivideX />

      {/* TODO: Add sportsbooks grid/list component here */}
      <Container className="border-x border-neutral-200 dark:border-neutral-800">
        <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
          <div className="flex max-w-md flex-col items-center text-center">
            {/* Icon container with gradient */}
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-sky-500/20 via-blue-500/20 to-indigo-500/20 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <svg
                  className="h-10 w-10 text-sky-600 dark:text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
              Sportsbook Directory Coming Soon
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              We're building a comprehensive directory of all 20+ sportsbooks with detailed information, features, and direct links.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-6 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="text-center">
                <div className="text-lg font-bold text-neutral-900 dark:text-white">20+</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Books</div>
              </div>
              <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-neutral-900 dark:text-white">Live</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Updates</div>
              </div>
              <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-neutral-900 dark:text-white">Real-time</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Odds</div>
              </div>
            </div>
          </div>
        </div>
      </Container>

      <DivideX />
      <FAQs />
      <DivideX />
      <CTA />
      <DivideX />
    </main>
  );
}

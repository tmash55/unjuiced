import { Container } from "@/components/container";
import { Metadata } from "next";
import { Heading } from "@/components/heading";
import { SubHeading } from "@/components/subheading";
import { Badge } from "@/components/badge";
import { DivideX } from "@/components/divide";

export const metadata: Metadata = {
  title: "Blog | Unjuiced - Sports Betting Insights & Analysis",
  description:
    "Stay updated with the latest sports betting insights, strategies, and analysis from Unjuiced. Learn how to bet smarter and maximize your edge.",
};

export default async function BlogsPage() {
  return (
    <div>
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x pt-10 md:pt-20 md:pb-10">
        <Badge text="Blog" />
        <Heading>Insights & Analysis</Heading>
        <SubHeading className="mx-auto mt-2 max-w-2xl px-4 text-center">
          Expert sports betting insights, strategies, and analysis to help you make smarter bets and find more value.
        </SubHeading>
        <div className="border-divide divide-divide mt-10 flex w-full flex-col divide-y border-y">
          <ComingSoonSection />
        </div>
      </Container>

      <DivideX />
    </div>
  );
}

const ComingSoonSection = () => {
  return (
    <div className="w-full">
      {/* Coming Soon Message */}
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="inline-flex items-center rounded-full bg-brand/10 px-4 py-2 text-sm font-medium text-brand dark:bg-brand/20 dark:text-brand-300 mb-4">
          Coming Soon
        </div>
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          We're Working on Something Great
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md text-center">
          Our blog is currently under development. Check back soon for expert betting insights, market analysis, and winning strategies.
        </p>
      </div>

      {/* Skeleton Loaders */}
      <div className="divide-divide grid grid-cols-1 divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0 border-t border-neutral-200 dark:border-neutral-800">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 md:p-8 animate-pulse">
            <div className="h-60 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800 md:h-80 lg:h-60" />
            <div className="mt-4 space-y-3">
              <div className="h-5 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>

      {/* Additional Row Skeletons */}
      <div className="divide-divide flex flex-col divide-y border-t border-neutral-200 dark:border-neutral-800">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col justify-between px-4 py-6 md:flex-row md:items-center md:px-8 animate-pulse">
            <div className="flex-1 space-y-3">
              <div className="h-5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-full max-w-lg rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-4/5 max-w-lg rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end space-y-2">
              <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

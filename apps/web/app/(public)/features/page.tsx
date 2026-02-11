import { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/badge";
import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { Heading } from "@/components/heading";
import { SubHeading } from "@/components/subheading";
import { ButtonLink } from "@/components/button-link";
import { featurePages } from "@/data/feature-pages";

export const metadata: Metadata = {
  title: "Features | Unjuiced",
  description:
    "Explore Unjuiced features built to help you find value, track markets, and bet smarter.",
};

export default function FeaturesPage() {
  return (
    <div>
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x pt-10 md:pt-20 md:pb-10">
        <Badge text="Features" />
        <Heading>Every tool, one edge.</Heading>
        <SubHeading className="mx-auto mt-2 max-w-2xl px-4 text-center">
          Explore the Unjuiced toolkit. Each feature is built to help you spot value faster, compare
          markets confidently, and place smarter bets.
        </SubHeading>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <ButtonLink href="/register" variant="primary">
            Start Free Trial
          </ButtonLink>
          <ButtonLink href="/pricing" variant="outline">
            View Pricing
          </ButtonLink>
        </div>
      </Container>

      <DivideX />

      <Container className="border-divide border-x py-12 md:py-16">
        <div className="grid gap-6 px-4 md:grid-cols-2 lg:grid-cols-3">
          {featurePages.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-black"
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: feature.accentColor ?? "#0ea5e9" }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {feature.category}
                </span>
                {feature.badge && (
                  <span
                    className="rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: feature.accentColor ?? "#0ea5e9" }}
                  >
                    {feature.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {feature.tagline}
              </p>
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-500">
                {feature.description}
              </p>
              <div className="mt-6 inline-flex items-center text-sm font-medium text-neutral-900 transition-transform group-hover:translate-x-1 dark:text-neutral-100">
                View feature
                <span className="ml-2">→</span>
              </div>
            </Link>
          ))}
        </div>
      </Container>

      <DivideX />
    </div>
  );
}

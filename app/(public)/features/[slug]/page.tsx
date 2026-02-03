import { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/badge";
import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { SubHeading } from "@/components/subheading";
import { ToolPreviewLayout } from "@/components/tool-preview";
import { featurePages, getFeatureBySlug } from "@/data/feature-pages";

export async function generateStaticParams() {
  return featurePages.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const feature = getFeatureBySlug(params.slug);
  if (!feature) return {};

  return {
    title: feature.seo.title,
    description: feature.seo.description,
    openGraph: {
      title: feature.seo.title,
      description: feature.seo.description,
    },
  };
}

export default function FeatureDetailPage({ params }: { params: { slug: string } }) {
  const feature = getFeatureBySlug(params.slug);

  if (!feature) {
    notFound();
  }

  return (
    <div>
      <ToolPreviewLayout
        title={feature.title}
        tagline={feature.tagline}
        description={feature.description}
        screenshot={feature.screenshot}
        features={feature.features}
        benefits={feature.benefits.map((text) => ({ text }))}
        ctaText={`Try ${feature.title}`}
        accentColor={feature.accentColor}
        category={feature.category}
        badge={feature.badge}
        toolPath={feature.toolPath}
      />

      <DivideX />

      <Container className="border-divide border-x py-12 md:py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <Badge text="How It Works" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Get value in three steps
          </h2>
          <SubHeading className="mx-auto mt-3 max-w-2xl">
            {feature.title} is built for speed. See the edge, validate it, and move before the
            market shifts.
          </SubHeading>
        </div>

        <div className="mt-10 grid gap-6 px-4 md:grid-cols-3">
          {feature.steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-black"
            >
              <div
                className="inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: feature.accentColor ?? "#0ea5e9" }}
              >
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Container>

      <DivideX />

      <Container className="border-divide border-x py-12 md:py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <Badge text="FAQ" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Common questions
          </h2>
          <SubHeading className="mx-auto mt-3 max-w-2xl">
            Quick answers about {feature.title} so you can decide fast.
          </SubHeading>
        </div>

        <div className="mt-10 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white px-6 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-black">
          {feature.faqs.map((item) => (
            <div key={item.question} className="py-6">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {item.question}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

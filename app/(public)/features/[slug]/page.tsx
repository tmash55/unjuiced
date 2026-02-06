import { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolPreviewLayout } from "@/components/tool-preview";
import { featurePages, getFeatureBySlug } from "@/data/feature-pages";

export async function generateStaticParams() {
  return featurePages.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
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

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);

  if (!feature) {
    notFound();
  }

  return (
    <div className="bg-black">
      <ToolPreviewLayout
        title={feature.title}
        tagline={feature.tagline}
        description={feature.description}
        screenshot={feature.screenshot}
        heroImage={feature.heroImage}
        mobileImage={feature.mobileImage}
        features={feature.features}
        benefits={feature.benefits.map((text) => ({ text }))}
        ctaText={`Try ${feature.title}`}
        accentColor={feature.accentColor}
        category={feature.category}
        badge={feature.badge}
        toolPath={feature.toolPath}
      />

      {/* How It Works */}
      <section className="bg-black px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p
              className="text-xs font-semibold uppercase tracking-[0.28em]"
              style={{ color: feature.accentColor }}
            >
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Get value in three steps
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-white/60">
              {feature.title} is built for speed. See the edge, validate it, and
              move before the market shifts.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {feature.steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl bg-white/[0.04] p-6"
              >
                <div
                  className="inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: feature.accentColor ?? "#0ea5e9" }}
                >
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-white/50">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-black px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p
              className="text-xs font-semibold uppercase tracking-[0.28em]"
              style={{ color: feature.accentColor }}
            >
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Common questions
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-white/60">
              Quick answers about {feature.title} so you can decide fast.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl divide-y divide-white/10">
            {feature.faqs.map((item) => (
              <div key={item.question} className="py-6">
                <h3 className="text-base font-semibold text-white">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm text-white/50">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

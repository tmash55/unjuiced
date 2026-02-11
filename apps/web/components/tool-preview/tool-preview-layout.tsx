"use client";

import React from "react";
import { motion } from "motion/react";
import { ButtonLink } from "@/components/button-link";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface ToolFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  image?: string;
  isMobile?: boolean;
}

export interface ToolBenefit {
  text: string;
}

export interface ToolPreviewLayoutProps {
  title: string;
  tagline: string;
  description: string;
  screenshot?: string;
  heroImage?: string;
  mobileImage?: string;
  screenshotComponent?: React.ReactNode;
  features: ToolFeature[];
  benefits?: ToolBenefit[];
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  accentColor?: string;
  badge?: string;
  category?: string;
  toolPath: string;
}

export function ToolPreviewLayout({
  title,
  tagline,
  description,
  screenshot,
  heroImage,
  mobileImage,
  screenshotComponent,
  features,
  benefits = [],
  ctaText = "Get Started Free",
  ctaHref,
  secondaryCtaText = "View Pricing",
  secondaryCtaHref = "/pricing",
  accentColor = "#0ea5e9",
  badge,
  category,
  toolPath,
}: ToolPreviewLayoutProps) {
  const finalCtaHref =
    ctaHref || `/register?redirectTo=${encodeURIComponent(toolPath)}`;
  const displayImage = heroImage || screenshot;

  return (
    <>
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-black">
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 70% 40%, ${accentColor}, transparent)`,
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28 lg:pt-28 lg:pb-32">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left: text */}
            <div>
              {/* Category & Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2"
              >
                {category && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                    {category}
                  </span>
                )}
                {badge && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {badge}
                  </span>
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                {title}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="mt-3 text-lg font-medium md:text-xl"
                style={{ color: accentColor }}
              >
                {tagline}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-5 max-w-lg text-base text-white/70 md:text-lg"
              >
                {description}
              </motion.p>

              {benefits.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="mt-6 flex flex-wrap gap-4 text-sm text-white/60"
                >
                  {benefits.map((benefit) => (
                    <div key={benefit.text} className="flex items-center gap-2">
                      <Check
                        className="size-4"
                        style={{ color: accentColor }}
                      />
                      <span>{benefit.text}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <ButtonLink
                  href={finalCtaHref}
                  variant="primary"
                  className="justify-center rounded-full px-8 py-3 text-base font-medium text-white hover:ring-4 sm:w-auto"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                    // @ts-expect-error CSS variable for ring color
                    "--tw-ring-color": `${accentColor}33`,
                  }}
                >
                  {ctaText}
                  <ArrowRight className="ml-2 size-4" />
                </ButtonLink>
                <ButtonLink
                  href={secondaryCtaHref}
                  variant="secondary"
                  className="justify-center rounded-full border-white/20 bg-white/10 px-6 py-3 text-base font-medium text-white hover:bg-white/20 sm:w-auto"
                >
                  {secondaryCtaText}
                </ButtonLink>
              </motion.div>
            </div>

            {/* Right: image with fade */}
            {displayImage && (
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative lg:w-[160%] lg:origin-left"
              >
                <div
                  className="relative overflow-hidden rounded-2xl"
                  style={{
                    maskImage:
                      "linear-gradient(to right, black 50%, transparent 100%), linear-gradient(to top, transparent 0%, black 30%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, black 50%, transparent 100%), linear-gradient(to top, transparent 0%, black 30%)",
                    maskComposite: "intersect",
                    WebkitMaskComposite: "destination-in",
                  }}
                >
                  <Image
                    src={displayImage}
                    alt={`${title} preview`}
                    width={1920}
                    height={1080}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-2xl"
                    priority
                  />
                </div>

                {/* iPhone overlay - bottom left */}
                {mobileImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="absolute -bottom-4 -left-2 z-20 hidden w-[18%] sm:-bottom-6 sm:-left-4 lg:block"
                  >
                    <div className="rounded-[1.5rem] border-[4px] border-neutral-700 bg-black p-0.5 shadow-2xl">
                      {/* Notch */}
                      <div className="absolute left-1/2 top-0.5 z-10 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />
                      <div className="overflow-hidden rounded-[1.2rem]">
                        <Image
                          src={mobileImage}
                          alt={`${title} mobile preview`}
                          width={390}
                          height={844}
                          className="h-auto w-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Fallback: screenshot component */}
            {!displayImage && screenshotComponent && (
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {screenshotComponent}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-black px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p
              className="text-xs font-semibold uppercase tracking-[0.28em]"
              style={{ color: accentColor }}
            >
              Features
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Powerful Features
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Everything you need to find and capitalize on betting value.
            </p>
          </div>

          <div className="mt-16 flex flex-col gap-20 md:gap-28">
            {features
              .filter((f) => f.image)
              .map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className={cn(
                    "flex flex-col items-center gap-8 md:gap-12 lg:items-center",
                    index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse",
                  )}
                >
                  {/* Image */}
                  <div className={cn(
                    "w-full",
                    feature.isMobile ? "flex justify-center lg:w-2/5" : "lg:w-3/5"
                  )}>
                    {feature.isMobile ? (
                      <div className="w-[260px] sm:w-[280px]">
                        <div className="overflow-hidden rounded-[2.5rem] border-[5px] border-neutral-700 bg-black shadow-2xl">
                          <Image
                            src={feature.image!}
                            alt={feature.title}
                            width={390}
                            height={844}
                            className="h-auto w-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <Image
                        src={feature.image!}
                        alt={feature.title}
                        width={1200}
                        height={750}
                        className="h-auto w-full rounded-xl border border-white/10 shadow-2xl"
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className={cn(
                    "w-full",
                    feature.isMobile ? "lg:w-3/5" : "lg:w-2/5"
                  )}>
                    <div
                      className="mb-3 inline-flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: `${accentColor}30` }}
                    >
                      {index + 1}
                    </div>
                    <h3 className="text-2xl font-semibold text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-base text-white/50 md:text-lg">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="relative overflow-hidden bg-black px-4 py-16 md:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            background: `radial-gradient(ellipse at center bottom, ${accentColor}, transparent 70%)`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Ready to find your edge?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
            Join thousands of smart bettors using {title} to maximize their
            profits.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink
              href={finalCtaHref}
              variant="primary"
              className="justify-center rounded-full px-8 py-3 text-base font-medium text-white hover:ring-4 sm:w-auto"
              style={{
                backgroundColor: accentColor,
                borderColor: accentColor,
              }}
            >
              {ctaText}
              <ArrowRight className="ml-2 size-4" />
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-white/40">
            Free 3-day trial included
          </p>
        </motion.div>
      </section>
    </>
  );
}

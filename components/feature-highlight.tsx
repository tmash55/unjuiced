"use client";

import { cn } from "@/lib/utils";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import Link from "next/link";
import React from "react";

interface FeatureHighlightProps {
  badge: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatureHighlight({
  badge,
  title,
  description,
  ctaText,
  ctaHref,
  children,
  className,
}: FeatureHighlightProps) {
  return (
    <section className={cn("bg-black py-12 sm:py-16 lg:py-20", className)}>
      <MaxWidthWrapper>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
              {badge}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            <p className="mt-4 text-base text-white/70 sm:text-lg">
              {description}
            </p>
          </div>

          <div>
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {ctaText} →
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-4 sm:p-6">
          {children}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

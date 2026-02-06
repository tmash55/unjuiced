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
    <section className={cn("bg-black py-16 sm:py-20 lg:py-24", className)}>
      <MaxWidthWrapper>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
              {badge}
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            <p className="mt-4 text-base text-white/60 sm:text-lg">
              {description}
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {ctaText} →
            </Link>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {children}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

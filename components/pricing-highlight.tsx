"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { BuyButton } from "@/components/billing/BuyButton";
import { tiers } from "@/constants/pricing";
import { getProductPriceId } from "@/constants/billing";
import { cn } from "@/lib/utils";

const planHighlights: Record<string, string[]> = {
  scout: [
    "All hit rate tools",
    "Defense vs Position matchups",
    "Hit Rate Matrix cheat sheets",
    "Injury impact analysis",
    "L5, L10, L20, Season stats",
    "Player correlations",
  ],
  sharp: [
    "Everything in Scout, plus…",
    "Positive EV scanner",
    "Edge Finder & line discrepancies",
    "20+ sportsbooks in real time",
    "Real-time odds (2s updates)",
    "Alternate lines & player props",
    "Deep linking to sportsbooks",
  ],
  edge: [
    "Everything in Sharp, plus…",
    "Live arbitrage alerts (risk-free windows)",
    "Custom EV & pricing models",
    "Advanced hit rates weighted by EV",
    "Priority refresh speed",
    "Priority support",
    "Early access to new tools",
  ],
};

const displayNameForTier = (title: string, productType: string) => {
  if (productType === "edge") return "Elite";
  return title;
};

export function PricingHighlight() {
  const previewTiers = tiers.slice(0, 3);
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.1),transparent_70%)] py-12 sm:py-16 lg:py-20">
      <MaxWidthWrapper>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            Choose the plan that fits how you bet
          </h2>
          <p className="mt-4 text-base text-white/70 sm:text-lg">
            Our plans give you the tools and flexibility to bet smarter, find
            value, and maximize ROI.
          </p>
          <div className="mt-6">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              Compare all plans →
            </Link>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors",
                !isYearly
                  ? "bg-white text-neutral-900"
                  : "text-white/70 hover:text-white",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors",
                isYearly
                  ? "bg-white text-neutral-900"
                  : "text-white/70 hover:text-white",
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {previewTiers.map((tier) => {
            const productType = tier.productType;
            const priceId = getProductPriceId(
              productType,
              isYearly ? "yearly" : "monthly",
            );
            const highlights = planHighlights[productType] || tier.features.slice(0, 3);
            const isFeatured = Boolean(tier.featured);
            const displayPrice = isYearly ? tier.yearly / 12 : tier.monthly;
            const roleCopy =
              productType === "scout"
                ? "Research & confidence before you bet"
                : productType === "sharp"
                ? "Real-time value & mispriced odds"
                : "For bettors who want alerts, automation, and guaranteed edges.";
            const planLabel =
              productType === "edge" ? "Elite" : displayNameForTier(tier.title, productType);
            const ctaLabel =
              productType === "scout"
                ? "Try for free"
                : productType === "sharp"
                ? "Start free trial"
                : "Unlock Edge tools";

            return (
              <div
                key={tier.title}
                className={cn(
                  "flex h-full min-h-[460px] flex-col rounded-2xl border p-8 md:p-10",
                  isFeatured
                    ? "border-[color:var(--primary-weak)]/40 bg-white/10 shadow-xl ring-2 ring-[color:var(--primary)]/20"
                    : "border-white/10 bg-white/5",
                )}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-2xl font-semibold text-white">
                    {planLabel}
                  </h3>
                  {isFeatured && (
                    <span className="rounded-full border border-[color:var(--primary-weak)]/40 bg-[color:var(--primary)]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary-weak)]">
                      Most Popular
                    </span>
                  )}
                </div>

                <div className="mt-4 h-px w-full bg-white/10" />

                <div className="mt-6 min-h-[96px]">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Starting at
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-white">
                      ${Math.round(displayPrice)}
                    </span>
                    <span className="text-sm text-white/60">/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    {isYearly ? "Billed yearly" : "Billed monthly"}
                  </p>
                </div>

                <p className="mt-3 text-sm text-white/70">
                  {roleCopy}
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-white/70">
                  {highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--primary-weak)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  <BuyButton
                    priceId={priceId}
                    mode="subscription"
                    trialDays={tier.trialDays}
                    label={ctaLabel}
                    className={cn(
                      "w-full justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors",
                      isFeatured
                        ? "bg-white text-neutral-900 hover:bg-neutral-100"
                        : "border border-white/20 bg-white/10 text-white hover:bg-white/20",
                    )}
                  />
                  {productType === "edge" && (
                    <p className="mt-3 text-center text-xs text-white/50">
                      Best for high-volume bettors
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

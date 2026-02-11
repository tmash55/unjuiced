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
    <section className="bg-black bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)] py-16 sm:py-20 lg:py-24">
      <MaxWidthWrapper>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            Choose the plan that fits how you bet
          </h2>
          <p className="mt-4 text-base text-white/60 sm:text-lg">
            Our plans give you the tools and flexibility to bet smarter, find
            value, and maximize ROI.
          </p>
          <div className="mt-6">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Compare all plans →
            </Link>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors",
                !isYearly
                  ? "bg-white text-neutral-900"
                  : "text-white/60 hover:text-white",
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
                  : "text-white/60 hover:text-white",
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
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
                : "Alerts, automation, and guaranteed edges";
            const planLabel =
              productType === "edge" ? "Elite" : displayNameForTier(tier.title, productType);
            const ctaLabel =
              productType === "scout"
                ? "Try for free"
                : productType === "sharp"
                ? "Start free trial"
                : "Unlock Elite";

            return (
              <div
                key={tier.title}
                className={cn(
                  "relative flex h-full min-h-[460px] flex-col rounded-2xl border p-8 transition-colors md:p-10",
                  isFeatured
                    ? "border-[color:var(--primary)]/25 bg-white/[0.07]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                )}
              >
                {isFeatured && (
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_60%)]" />
                )}

                <div className="relative flex items-start justify-between">
                  <h3 className="text-2xl font-semibold text-white">
                    {planLabel}
                  </h3>
                  {isFeatured && (
                    <span className="rounded-full bg-[color:var(--primary)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary-weak)]">
                      Popular
                    </span>
                  )}
                </div>

                <div className="relative mt-6 min-h-[96px]">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Starting at
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-white">
                      ${Math.round(displayPrice)}
                    </span>
                    <span className="text-sm text-white/40">/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    {isYearly ? "Billed yearly" : "Billed monthly"}
                  </p>
                </div>

                <p className="relative mt-3 text-sm text-white/60">
                  {roleCopy}
                </p>

                <ul className="relative mt-5 flex flex-1 flex-col gap-2.5 text-sm text-white/60">
                  {highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[color:var(--primary-weak)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative mt-8">
                  <BuyButton
                    priceId={priceId}
                    mode="subscription"
                    trialDays={tier.trialDays}
                    label={ctaLabel}
                    className={cn(
                      "w-full justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors",
                      isFeatured
                        ? "bg-white text-neutral-900 hover:bg-neutral-100"
                        : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

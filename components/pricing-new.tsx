"use client";

import React, { useState } from "react";
import { Container } from "./container";
import { motion } from "motion/react";
import { CheckIcon } from "@/icons/card-icons";
import { ButtonLink } from "./button-link";
import { getProductPriceId, ProductType } from "@/constants/billing";
import { useAuth } from "./auth/auth-provider";
import { useEntitlements } from "@/hooks/use-entitlements";
import { usePartnerCoupon } from "@/hooks/use-partner-coupon";

// ═══════════════════════════════════════════════════════════════════════════════
// Plan Data
// ═══════════════════════════════════════════════════════════════════════════════

interface PlanTier {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  previousTier?: string;
  badge?: string;
  productType: ProductType | "free";
  trialDays?: number;
}

const plans: PlanTier[] = [
  {
    name: "Free",
    description: "Get started with basic tools",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Dashboard overview",
      "Defense vs Position matchups",
      "Hit Rate Matrix cheat sheets",
      "My Plays & betslip builder",
      "Community access",
    ],
    productType: "free",
  },
  {
    name: "Scout",
    description: "Hit rate research tools",
    monthlyPrice: 15,
    yearlyPrice: 150,
    features: [
      "All hit rate tools",
      "Injury Impact analysis",
      "L5, L10, L20, Season stats",
      "Player correlations",
      "Head-to-head matchups",
      "Deep linking to books",
    ],
    previousTier: "Free",
    productType: "scout",
  },
  {
    name: "Sharp",
    description: "Complete betting toolkit",
    monthlyPrice: 35,
    yearlyPrice: 350,
    features: [
      "Positive EV scanner",
      "Pregame Arbitrage finder",
      "Edge Finder tool",
      "Real-time odds (2s updates)",
      "20+ sportsbooks coverage",
      "EV-enhanced hit rates (soon)",
    ],
    previousTier: "Scout",
    badge: "Most Popular",
    productType: "sharp",
    trialDays: 3,
  },
  {
    name: "Edge",
    description: "Every advantage",
    monthlyPrice: 65,
    yearlyPrice: 650,
    features: [
      "Live Arbitrage (in-game)",
      "Custom Model builder",
      "Custom EV thresholds",
      "Priority odds updates",
      "Priority support",
      "Early access to features",
    ],
    previousTier: "Sharp",
    badge: "Best Value",
    productType: "edge",
    trialDays: 3,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Feature Comparison Data
// ═══════════════════════════════════════════════════════════════════════════════

interface FeatureRow {
  name: string;
  free: boolean | string;
  scout: boolean | string;
  sharp: boolean | string;
  edge: boolean | string;
}

const featureCategories: { category: string; features: FeatureRow[] }[] = [
  {
    category: "Hit Rate Tools",
    features: [
      { name: "Dashboard Overview", free: true, scout: true, sharp: true, edge: true },
      { name: "Defense vs Position", free: true, scout: true, sharp: true, edge: true },
      { name: "Hit Rate Matrix", free: true, scout: true, sharp: true, edge: true },
      { name: "My Plays & Betslip", free: true, scout: true, sharp: true, edge: true },
      { name: "Injury Impact Analysis", free: false, scout: true, sharp: true, edge: true },
      { name: "Player Correlations", free: false, scout: true, sharp: true, edge: true },
      { name: "Head-to-Head Matchups", free: false, scout: true, sharp: true, edge: true },
      { name: "Game Logs & Box Scores", free: false, scout: true, sharp: true, edge: true },
      { name: "Deep Linking to Books", free: false, scout: true, sharp: true, edge: true },
    ],
  },
  {
    category: "Sharp Betting Tools",
    features: [
      { name: "Positive EV Scanner", free: false, scout: false, sharp: true, edge: true },
      { name: "Pregame Arbitrage Finder", free: false, scout: false, sharp: true, edge: true },
      { name: "Edge Finder", free: false, scout: false, sharp: true, edge: true },
      { name: "Real-time Odds (2s updates)", free: false, scout: false, sharp: true, edge: true },
      { name: "20+ Sportsbooks", free: false, scout: false, sharp: true, edge: true },
      { name: "Alternate Lines & Props", free: false, scout: false, sharp: true, edge: true },
      { name: "Advanced Filters & Export", free: false, scout: false, sharp: true, edge: true },
      { name: "EV-Enhanced Hit Rates", free: false, scout: false, sharp: "Soon", edge: "Soon" },
    ],
  },
  {
    category: "Edge Features",
    features: [
      { name: "Live Arbitrage (In-Game)", free: false, scout: false, sharp: false, edge: true },
      { name: "Custom Model Builder", free: false, scout: false, sharp: false, edge: true },
      { name: "Custom EV Thresholds", free: false, scout: false, sharp: false, edge: true },
      { name: "Priority Odds Updates", free: false, scout: false, sharp: false, edge: true },
      { name: "Priority Support", free: false, scout: false, sharp: false, edge: true },
      { name: "Early Access to Features", free: false, scout: false, sharp: false, edge: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export const PricingNew = () => {
  const [isYearly, setIsYearly] = useState(false);
  const { user } = useAuth();
  const { data: entitlements } = useEntitlements();
  const { couponId: partnerCouponId } = usePartnerCoupon();

  // Show trial CTA only if user hasn't used trial
  const showTrialCTA = !user || entitlements?.trial?.trial_used === false;

  // Build checkout URL
  const getCheckoutUrl = (productType: ProductType, trialDays?: number) => {
    const plan = isYearly ? "yearly" : "monthly";
    const priceId = getProductPriceId(productType, plan);
    const params = new URLSearchParams({
      priceId,
      mode: "subscription",
    });
    if (trialDays && showTrialCTA) params.set("trialDays", String(trialDays));
    if (partnerCouponId) params.set("couponId", partnerCouponId);
    return `/billing/start?${params.toString()}`;
  };

  return (
    <section className="bg-neutral-50 dark:bg-neutral-950">
      <Container className="px-4 py-16 md:px-8 md:py-24">
        {/* Header */}
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 uppercase md:text-4xl dark:text-white">
            Choose Your Plan
          </h1>

          {/* Monthly/Yearly Toggle */}
          <div className="flex items-center rounded-full border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800">
            <button
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                isYearly
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, idx) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isYearly={isYearly}
              index={idx}
              checkoutUrl={
                plan.productType !== "free"
                  ? getCheckoutUrl(plan.productType, plan.trialDays)
                  : undefined
              }
              showTrialCTA={showTrialCTA}
            />
          ))}
        </div>

        {/* Footnote */}
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          All paid plans include a 3-day free trial. Cancel anytime.
        </p>

        {/* Feature Comparison */}
        <FeatureComparison />
      </Container>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Plan Card Component
// ═══════════════════════════════════════════════════════════════════════════════

interface PlanCardProps {
  plan: PlanTier;
  isYearly: boolean;
  index: number;
  checkoutUrl?: string;
  showTrialCTA: boolean;
}

const PlanCard = ({ plan, isYearly, index, checkoutUrl, showTrialCTA }: PlanCardProps) => {
  const price = isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
  const yearlyTotal = plan.yearlyPrice;
  const isFree = plan.productType === "free";
  const isPopular = plan.badge === "Most Popular";
  const hasTrial = plan.trialDays && showTrialCTA;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900"
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              isPopular
                ? "bg-brand text-white"
                : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            }`}
          >
            {plan.badge}
          </span>
        </div>
      )}

      {/* Plan Name & Description */}
      <div className="mt-2">
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{plan.name}</h3>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mt-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-neutral-900 dark:text-white">
            ${price}
          </span>
          {!isFree && (
            <span className="text-neutral-500 dark:text-neutral-400">per month</span>
          )}
        </div>
        {!isFree && isYearly && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            ${yearlyTotal} billed annually
          </p>
        )}
        {isFree && (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">No commitment</p>
        )}
      </div>

      {/* Features */}
      <div className="mt-6 flex-1">
        {plan.previousTier && (
          <p className="mb-3 text-sm font-medium text-neutral-900 dark:text-white">
            Everything on {plan.previousTier} +
          </p>
        )}
        {!plan.previousTier && (
          <p className="mb-3 text-sm font-medium text-neutral-900 dark:text-white">
            What&apos;s included...
          </p>
        )}
        <ul className="space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <span className="mt-0.5 text-brand">
                <CheckIcon className="h-4 w-4" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <div className="mt-6">
        {isFree ? (
          <ButtonLink
            href="/register"
            className="!flex !w-full items-center justify-center rounded-lg border-2 border-neutral-900 bg-white py-3 text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-50 dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/5"
          >
            Sign up for free
          </ButtonLink>
        ) : (
          <ButtonLink
            href={checkoutUrl || "/register"}
            className={`!flex !w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-all ${
              isPopular
                ? "bg-brand text-white hover:bg-brand/90"
                : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            }`}
          >
            {hasTrial ? "Try for free" : "Get started"}
          </ButtonLink>
        )}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Feature Comparison Table
// ═══════════════════════════════════════════════════════════════════════════════

const FeatureComparison = () => {
  return (
    <div className="mt-20">
      <h2 className="text-center text-2xl font-black uppercase tracking-tight text-neutral-900 md:text-3xl dark:text-white">
        Feature Comparison
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-neutral-500 dark:text-neutral-400">
        Compare plans to find the right tools for your betting strategy
      </p>

      {/* Desktop Table */}
      <div className="mt-10 hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block dark:border-neutral-700 dark:bg-neutral-900">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-white">
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.name}
                  className="px-6 py-4 text-center text-sm font-semibold text-neutral-900 dark:text-white"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureCategories.map((category, catIdx) => (
              <React.Fragment key={category.category}>
                {/* Category Header */}
                <tr className="border-b border-neutral-200 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-800/50">
                  <td
                    colSpan={5}
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                  >
                    {category.category}
                  </td>
                </tr>
                {/* Feature Rows */}
                {category.features.map((feature, idx) => (
                  <tr
                    key={feature.name}
                    className={`border-b border-neutral-100 dark:border-neutral-800 ${
                      idx % 2 === 0 ? "" : "bg-neutral-50/30 dark:bg-neutral-800/20"
                    }`}
                  >
                    <td className="px-6 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                      {feature.name}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <FeatureValue value={feature.free} />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <FeatureValue value={feature.scout} />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <FeatureValue value={feature.sharp} />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <FeatureValue value={feature.edge} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Accordion or simplified view */}
      <div className="mt-10 space-y-4 md:hidden">
        {featureCategories.map((category) => (
          <div
            key={category.category}
            className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              {category.category}
            </h3>
            <ul className="mt-3 space-y-2">
              {category.features.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {feature.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {feature.edge && (
                      <span className="text-xs font-medium text-brand">Edge</span>
                    )}
                    {feature.sharp && !feature.edge && (
                      <span className="text-xs font-medium text-neutral-500">Sharp+</span>
                    )}
                    {feature.scout && !feature.sharp && (
                      <span className="text-xs font-medium text-neutral-400">Scout+</span>
                    )}
                    {feature.free && !feature.scout && (
                      <span className="text-xs font-medium text-neutral-300">Free</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const FeatureValue = ({ value }: { value: boolean | string }) => {
  if (typeof value === "string") {
    return <span className="text-sm text-neutral-600 dark:text-neutral-400">{value}</span>;
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center text-brand">
        <CheckIcon className="h-5 w-5" />
      </span>
    );
  }
  return <span className="text-neutral-300 dark:text-neutral-600">—</span>;
};

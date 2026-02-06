"use client";

import React, { useState } from "react";
import { Container } from "./container";
import { motion } from "motion/react";
import { CheckIcon } from "@/icons/card-icons";
import { ButtonLink } from "./button-link";
import { buildCheckoutStartPath, buildRegisterCheckoutPath, ProductType } from "@/constants/billing";
import { useAuth } from "./auth/auth-provider";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useSubscription } from "@/hooks/use-subscription";
import { usePartnerCoupon } from "@/hooks/use-partner-coupon";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// Plan hierarchy (higher index = higher tier)
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_RANK: Record<string, number> = {
  free: 0,
  scout: 1,
  sharp: 2,
  edge: 3,
  elite: 3,
  admin: 4,
  unlimited: 4,
};

function getPlanRank(plan: string | undefined): number {
  return PLAN_RANK[plan || "free"] ?? 0;
}

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
  ctaText?: string;
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
      "My Slips & betslip builder",
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
    ctaText: "Try for free",
    trialDays: 3,
  },
  {
    name: "Sharp",
    description: "Complete betting toolkit",
    monthlyPrice: 40,
    yearlyPrice: 400,
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
    name: "Elite",
    description: "Every advantage",
    monthlyPrice: 70,
    yearlyPrice: 700,
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
  elite: boolean | string;
}

const featureCategories: { category: string; features: FeatureRow[] }[] = [
  {
    category: "Hit Rate Tools",
    features: [
      { name: "Dashboard Overview", free: true, scout: true, sharp: true, elite: true },
      { name: "Defense vs Position", free: true, scout: true, sharp: true, elite: true },
      { name: "Hit Rate Matrix", free: true, scout: true, sharp: true, elite: true },
      { name: "My Slips & Betslip", free: true, scout: true, sharp: true, elite: true },
      { name: "Injury Impact Analysis", free: false, scout: true, sharp: true, elite: true },
      { name: "Player Correlations", free: false, scout: true, sharp: true, elite: true },
      { name: "Head-to-Head Matchups", free: false, scout: true, sharp: true, elite: true },
      { name: "Game Logs & Box Scores", free: false, scout: true, sharp: true, elite: true },
      { name: "Deep Linking to Books", free: false, scout: true, sharp: true, elite: true },
    ],
  },
  {
    category: "Sharp Betting Tools",
    features: [
      { name: "Positive EV Scanner", free: false, scout: false, sharp: true, elite: true },
      { name: "Pregame Arbitrage Finder", free: false, scout: false, sharp: true, elite: true },
      { name: "Edge Finder", free: false, scout: false, sharp: true, elite: true },
      { name: "Real-time Odds (2s updates)", free: false, scout: false, sharp: true, elite: true },
      { name: "20+ Sportsbooks", free: false, scout: false, sharp: true, elite: true },
      { name: "Alternate Lines & Props", free: false, scout: false, sharp: true, elite: true },
      { name: "Advanced Filters & Export", free: false, scout: false, sharp: true, elite: true },
      { name: "EV-Enhanced Hit Rates", free: false, scout: false, sharp: "Soon", elite: "Soon" },
    ],
  },
  {
    category: "Elite Features",
    features: [
      { name: "Live Arbitrage (In-Game)", free: false, scout: false, sharp: false, elite: true },
      { name: "Custom Model Builder", free: false, scout: false, sharp: false, elite: true },
      { name: "Custom EV Thresholds", free: false, scout: false, sharp: false, elite: true },
      { name: "Priority Odds Updates", free: false, scout: false, sharp: false, elite: true },
      { name: "Priority Support", free: false, scout: false, sharp: false, elite: true },
      { name: "Early Access to Features", free: false, scout: false, sharp: false, elite: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export const PricingNew = () => {
  const [isYearly, setIsYearly] = useState(false);
  const { user } = useAuth();
  const { data: entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  const { couponId: partnerCouponId } = usePartnerCoupon();

  const isLoading = isLoadingEntitlements || isLoadingSubscription;

  // Determine the user's current plan
  const currentPlan = entitlements?.plan || "free";
  const currentPlanRank = getPlanRank(currentPlan);
  const trialUsed = entitlements?.trial?.trial_used !== false; // true if used or undefined
  const isTrialing = entitlements?.entitlement_source === "trial";
  const hasActiveSubscription = entitlements?.entitlement_source === "subscription";
  const isGranted = entitlements?.entitlement_source === "grant";

  // Show trial CTA only if user hasn't used trial
  const showTrialCTA = !user || !trialUsed;

  // Build checkout URL (wrap in /register if not authenticated)
  const getCheckoutUrl = (productType: ProductType, trialDays?: number) => {
    const plan = isYearly ? "yearly" : "monthly";
    const trial = trialDays && showTrialCTA ? trialDays : undefined;
    const checkoutPath = buildCheckoutStartPath(productType, plan, {
      trialDays: trial,
      couponId: partnerCouponId ?? undefined,
    });
    return user
      ? checkoutPath
      : buildRegisterCheckoutPath(productType, plan, {
          trialDays: trial,
          couponId: partnerCouponId ?? undefined,
        });
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
          {plans.map((plan, idx) => {
            const cardProductType = plan.productType === "free" ? "free" : plan.productType;
            // Normalize "edge" → rank 3, which is the same as "elite"
            const cardPlanKey = cardProductType === "edge" ? "edge" : cardProductType;
            const cardRank = getPlanRank(cardPlanKey);
            const isCurrentPlan = user && !isLoading && currentPlanRank === cardRank && cardRank > 0;
            const isCurrentFree = user && !isLoading && currentPlanRank === 0 && cardRank === 0;
            const isUpgrade = user && !isLoading && cardRank > currentPlanRank && cardRank > 0;
            const isDowngrade = user && !isLoading && cardRank < currentPlanRank && cardRank > 0;

            return (
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
                isCurrentPlan={Boolean(isCurrentPlan) || Boolean(isCurrentFree)}
                isUpgrade={Boolean(isUpgrade)}
                isDowngrade={Boolean(isDowngrade)}
                hasActiveSubscription={hasActiveSubscription || isTrialing}
                isGranted={Boolean(isGranted)}
                isLoggedIn={Boolean(user)}
                isLoading={isLoading}
              />
            );
          })}
        </div>

        {/* Footnote */}
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {showTrialCTA
            ? "All paid plans include a 3-day free trial. Yearly billing includes 2 months free."
            : "Yearly billing includes 2 months free. Upgrade or downgrade anytime."}
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
  isCurrentPlan: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
  hasActiveSubscription: boolean;
  isGranted: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
}

const PlanCard = ({
  plan,
  isYearly,
  index,
  checkoutUrl,
  showTrialCTA,
  isCurrentPlan,
  isUpgrade,
  isDowngrade,
  hasActiveSubscription,
  isGranted,
  isLoggedIn,
  isLoading,
}: PlanCardProps) => {
  const [portalLoading, setPortalLoading] = useState(false);

  const price = isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
  const yearlyTotal = plan.yearlyPrice;
  const isFree = plan.productType === "free";
  const isPopular = plan.badge === "Most Popular";
  const hasTrial = plan.trialDays && showTrialCTA;

  // Open Stripe Customer Portal for existing subscribers to upgrade/downgrade
  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.origin + "/plans",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal");
      if (data.url) window.location.assign(data.url);
    } catch (error: any) {
      console.error("Portal error:", error);
      setPortalLoading(false);
    }
  };

  // Determine CTA label and action
  let ctaLabel: string;
  let ctaAction: "checkout" | "portal" | "register" | "current" | "none";

  if (isLoading) {
    ctaLabel = "";
    ctaAction = "none";
  } else if (isFree) {
    if (isCurrentPlan) {
      ctaLabel = "Current plan";
      ctaAction = "current";
    } else {
      ctaLabel = "Sign up for free";
      ctaAction = "register";
    }
  } else if (isCurrentPlan) {
    ctaLabel = isGranted ? "Granted access" : "Current plan";
    ctaAction = "current";
  } else if (isGranted) {
    // Grant users shouldn't see upgrade/downgrade for other tiers —
    // their access is managed outside of billing
    ctaLabel = "";
    ctaAction = "none";
  } else if (isUpgrade && hasActiveSubscription) {
    ctaLabel = "Upgrade";
    ctaAction = "portal";
  } else if (isDowngrade && hasActiveSubscription) {
    ctaLabel = "Downgrade";
    ctaAction = "portal";
  } else {
    // No subscription yet — go through checkout
    ctaLabel = plan.ctaText || (hasTrial ? "Try for free" : "Get started");
    ctaAction = "checkout";
  }

  // Override badge for current plan
  const displayBadge = isCurrentPlan
    ? isGranted
      ? "Granted"
      : "Current Plan"
    : plan.badge;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-colors",
        isCurrentPlan
          ? "border-brand/30 bg-brand/[0.03] dark:border-brand/20 dark:bg-brand/[0.05]"
          : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
      )}
    >
      {/* Badge */}
      {displayBadge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
              isCurrentPlan
                ? "bg-brand text-white"
                : isPopular
                ? "bg-brand text-white"
                : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
            )}
          >
            {displayBadge}
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
            ${yearlyTotal} billed annually · 2 months free
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
        {isLoading ? (
          <div className="flex h-12 w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : ctaAction === "none" ? (
          // Grant users on non-current tiers, or loading — no button
          <div className="h-12" />
        ) : ctaAction === "current" ? (
          <div className="flex h-12 w-full items-center justify-center rounded-lg border-2 border-brand/30 bg-brand/5 text-sm font-semibold text-brand dark:border-brand/20 dark:bg-brand/10">
            {ctaLabel}
          </div>
        ) : ctaAction === "portal" ? (
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className={cn(
              "flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              isUpgrade
                ? "bg-brand text-white hover:bg-brand/90"
                : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
            )}
          >
            {portalLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              ctaLabel
            )}
          </button>
        ) : ctaAction === "register" ? (
          <ButtonLink
            href="/register"
            className="!flex !h-12 !w-full items-center justify-center rounded-lg border-2 border-neutral-900 bg-white text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-50 dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/5"
          >
            {ctaLabel}
          </ButtonLink>
        ) : (
          <ButtonLink
            href={checkoutUrl || "/register"}
            className={cn(
              "!flex !h-12 !w-full items-center justify-center rounded-lg text-sm font-semibold transition-all",
              isPopular
                ? "bg-brand text-white hover:bg-brand/90"
                : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100",
            )}
          >
            {ctaLabel}
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
            {featureCategories.map((category) => (
              <React.Fragment key={category.category}>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-800/50">
                  <td
                    colSpan={5}
                    className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                  >
                    {category.category}
                  </td>
                </tr>
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
                      <FeatureValue value={feature.elite} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
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
                    {feature.elite && (
                      <span className="text-xs font-medium text-brand">Elite</span>
                    )}
                    {feature.sharp && !feature.elite && (
                      <span className="text-xs font-medium text-neutral-500">Sharp+</span>
                    )}
                    {feature.scout && !feature.sharp && !feature.elite && (
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

"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useEntitlements } from "@/hooks/use-entitlements";
import { buildCheckoutStartPath, getPriceId } from "@/constants/billing";
import config from "@/config";
import { useSubscription } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

export default function BillingSettings({ user }: { user: any }) {
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const { data: entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: window.location.origin + "/account/settings",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the user has no customer yet or a stale customer id, route them to Checkout instead
        const priceId = getPriceId("monthly", config.stripe.plans[0]?.priceId);
        const msg: string = data?.message || data?.error || "";
        const shouldUpgrade =
          res.status === 400 ||
          /no customer/i.test(msg) ||
          /No such customer/i.test(msg) ||
          /billing account/i.test(msg);
        if (priceId && shouldUpgrade) {
          const params = new URLSearchParams({
            priceId,
            mode: "subscription",
            trialDays: "7",
          }).toString();
          window.location.assign(`/billing/start?${params}`);
          return;
        }
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (error: any) {
      console.error("Billing portal error:", error);
      toast.error(error.message || "Failed to open billing portal");
      setLoading(false);
    }
  };

  const isElite = entitlements?.plan === "elite" || entitlements?.plan === "admin";
  const isSharp = entitlements?.plan === "sharp" || entitlements?.plan === "pro";
  const isScout = entitlements?.plan === "scout" || entitlements?.plan === "hit_rate";
  const isPro = isElite || isSharp;
  const hasPaidPlan = isElite || isSharp || isScout;
  const showTrialCTA = entitlements?.trial?.trial_used === false;
  const isTrial = entitlements?.entitlement_source === "trial";
  const isSubscription = entitlements?.entitlement_source === "subscription";
  const isGrant = entitlements?.entitlement_source === "grant";
  const isCanceled = subscription?.cancel_at_period_end === true;
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const isLoading = isLoadingEntitlements || isLoadingSubscription;
  // Route legacy (pre-card) trial users directly to Checkout instead of the portal.
  // Cutoff: 2025-11-12 07:00:00 Central = 2025-11-12T13:00:00Z
  const legacyTrialCutoff = new Date("2025-11-12T13:00:00Z");
  const trialStartedAt = entitlements?.trial?.trial_started_at ? new Date(entitlements.trial.trial_started_at) : null;
  const isLegacyTrial =
    isTrial &&
    trialStartedAt !== null &&
    trialStartedAt.getTime() < legacyTrialCutoff.getTime();
  const currentPlanLabel = isElite ? "Elite" : isSharp ? "Sharp" : isScout ? "Scout" : "Free";

  const planOptions = [
    {
      name: "Scout",
      description: "Hit rate research tools",
      monthly: 15,
      yearly: 150,
      productType: "scout" as const,
      trialDays: 3,
      highlights: [
        "Hit rate tools + matrices",
        "Defense vs Position matchups",
        "Injury impact + trends",
      ],
    },
    {
      name: "Sharp",
      description: "Complete betting toolkit",
      monthly: 40,
      yearly: 400,
      productType: "sharp" as const,
      trialDays: 3,
      badge: "Most Popular",
      highlights: [
        "Positive EV + arbitrage",
        "Edge Finder + live odds",
        "20+ sportsbook coverage",
      ],
    },
    {
      name: "Elite",
      description: "Every advantage",
      monthly: 70,
      yearly: 700,
      productType: "edge" as const,
      trialDays: 3,
      badge: "Best Value",
      highlights: [
        "Live arbitrage (in-game)",
        "Custom models + EV thresholds",
        "Priority support + updates",
      ],
    },
  ];

  // Show loading state while fetching entitlements
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Billing & Subscription
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Loading Skeleton */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
              <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Billing & Subscription
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                Current Plan
              </h3>
              {isSharp && !isCanceled && !isTrial && !isGrant && (
                <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                  Sharp
                </span>
              )}
              {isElite && !isCanceled && !isTrial && !isGrant && (
                <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                  Elite
                </span>
              )}
              {isGrant && (
                <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-sm">
                  Elite
                </span>
              )}
              {isTrial && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Trial
                </span>
              )}
              {isSharp && isCanceled && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Canceling
                </span>
              )}
              {isElite && isCanceled && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Canceling
                </span>
              )}
              {isScout && !isCanceled && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Scout
                </span>
              )}
              {isScout && isCanceled && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Canceling
                </span>
              )}
              {!hasPaidPlan && !isTrial && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  Free
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {isLoading && "Loading..."}
              {!isLoading && isTrial && entitlements?.trial?.trial_ends_at && (
                <>
                  Trial ends{" "}
                  <span className="font-medium text-neutral-900 dark:text-white">
                    {new Date(entitlements.trial.trial_ends_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
              {!isLoading && hasPaidPlan && isSubscription && !isCanceled && `Active ${currentPlanLabel} subscription`}
              {!isLoading && isGrant && "Granted access"}
              {!isLoading && isSubscription && isCanceled && "Subscription set to cancel"}
              {!isLoading && !hasPaidPlan && !isTrial && "Free plan with limited features"}
            </p>
          </div>
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isPro && isSubscription && !isCanceled
              ? "bg-brand/10 dark:bg-brand/20"
              : "bg-neutral-50 dark:bg-neutral-800"
          )}>
            {isElite && isSubscription && !isCanceled && <CheckCircle className="h-5 w-5 text-brand" />}
            {isSharp && isSubscription && !isCanceled && <CheckCircle className="h-5 w-5 text-brand" />}
            {isScout && isSubscription && !isCanceled && <CheckCircle className="h-5 w-5 text-orange-500" />}
            {isSubscription && isCanceled && <AlertCircle className="h-5 w-5 text-amber-500" />}
            {isTrial && <CheckCircle className="h-5 w-5 text-blue-500" />}
            {isGrant && <CheckCircle className="h-5 w-5 text-emerald-500" />}
            {!isSubscription && !isTrial && !isGrant && <CreditCard className="h-5 w-5 text-neutral-400" />}
          </div>
        </div>

        {/* Trial Info */}
        {isTrial && entitlements?.trial?.trial_ends_at && (
          <div className="mt-5 rounded-lg border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-50/50 p-4 shadow-sm dark:border-blue-900/30 dark:from-blue-950/20 dark:to-blue-950/10">
            <div className="flex gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <CheckCircle className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Free Trial Active
                </p>
                <p className="text-sm leading-relaxed text-blue-800/90 dark:text-blue-300/90">
                  You have full access until{" "}
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    {new Date(entitlements.trial.trial_ends_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  . Billing will begin automatically after your trial unless you cancel beforehand.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Notice */}
        {isCanceled && periodEnd && (
          <div className="mt-5 rounded-lg border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-50/50 p-4 shadow-sm dark:border-amber-900/30 dark:from-amber-950/20 dark:to-amber-950/10">
            <div className="flex gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Subscription Ending
                </p>
                <p className="text-sm leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  Your {currentPlanLabel} access will end on{" "}
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    {periodEnd.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  . You can reactivate anytime before then.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manage Subscription Button - Sharp users only */}
        {isSubscription && (isElite || isSharp) && (
          <div className="mt-6 space-y-2">
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  Manage Subscription
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Update payment method, view invoices, or cancel
            </p>
          </div>
        )}

        {/* Upgrade CTA for Trial Users */}
        {isTrial && (
          <div className="mt-6 space-y-2">
            {isLegacyTrial ? (
              <>
            <a
                  href={`/billing/start?priceId=${encodeURIComponent(getPriceId("monthly", config.stripe.plans[0]?.priceId))}&mode=subscription&trialDays=3`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow"
            >
                  Upgrade to {currentPlanLabel === "Free" ? "Sharp" : currentPlanLabel}
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Complete checkout to continue after your trial ends.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      Manage Billing
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Update payment method, view invoices, or cancel your trial
                </p>
              </>
            )}
          </div>
        )}

        {/* Upgrade CTA for Free Users */}
        {!hasPaidPlan && !isTrial && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Upgrade your plan
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  All paid plans include a 3-day free trial. Yearly billing includes 2 months free.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
                {["monthly", "yearly"].map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle as "monthly" | "yearly")}
                    className={cn(
                      "rounded-full px-3 py-1 font-semibold transition",
                      billingCycle === cycle
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                    )}
                  >
                    {cycle === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {planOptions.map((plan) => {
                const yearly = billingCycle === "yearly";
                const displayPrice = yearly ? Math.round(plan.yearly / 12) : plan.monthly;
                const checkoutPath = buildCheckoutStartPath(plan.productType, billingCycle, {
                  trialDays: showTrialCTA ? plan.trialDays : undefined,
                });
                const ctaLabel = showTrialCTA ? "Try for free" : `Get ${plan.name}`;
                const isPopular = plan.badge === "Most Popular";
                return (
                  <div
                    key={plan.name}
                    className="flex h-full flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {plan.name}
                        </h5>
                        {plan.badge && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              isPopular
                                ? "bg-brand text-white"
                                : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                            )}
                          >
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-semibold text-neutral-900 dark:text-white">
                          ${displayPrice}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">/mo</span>
                      </div>
                      {yearly && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          ${plan.yearly} billed yearly · 2 months free
                        </p>
                      )}
                      <ul className="space-y-1.5 pt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {plan.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand/70" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href={checkoutPath}
                      className="mt-4 inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                    >
                      {ctaLabel}
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <a
                href="/plans"
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                View all plans
              </a>
            </div>
          </div>
        )}

        {/* Upgrade CTA for Hit Rate Users */}
        {isScout && isSubscription && !isCanceled && (
          <div className="mt-6 space-y-2">
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  Manage Subscription
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Update payment method, view invoices, or upgrade to Sharp
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

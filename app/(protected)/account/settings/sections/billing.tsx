"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useEntitlements } from "@/hooks/use-entitlements";
import { getPriceId } from "@/constants/billing";
import config from "@/config";
import { useSubscription } from "@/hooks/use-subscription";

export default function BillingSettings({ user }: { user: any }) {
  const [loading, setLoading] = useState(false);
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

  const isPro = entitlements?.plan === "pro" || entitlements?.plan === "admin";
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
              {isPro && !isCanceled && !isTrial && !isGrant && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-brand to-brand/80 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Pro
                </span>
              )}
              {isGrant && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Pro
                </span>
              )}
              {isTrial && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Trial
                </span>
              )}
              {isPro && isCanceled && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Canceling
                </span>
              )}
              {!isPro && (
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
              {!isLoading && isSubscription && !isCanceled && "Active subscription"}
              {!isLoading && isGrant && "Granted access"}
              {!isLoading && isSubscription && isCanceled && "Subscription set to cancel"}
              {!isLoading && !isPro && "Free plan with limited features"}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800">
            {isSubscription && !isCanceled && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isSubscription && isCanceled && <AlertCircle className="h-5 w-5 text-amber-500" />}
            {isTrial && <CheckCircle className="h-5 w-5 text-blue-500" />}
            {isGrant && <CheckCircle className="h-5 w-5 text-emerald-500" />}
            {!isSubscription && !isTrial && <CreditCard className="h-5 w-5 text-neutral-400" />}
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
                  You have full Pro access until{" "}
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
                  Your Pro access will end on{" "}
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

        {/* Manage Subscription Button */}
        {isSubscription && (
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
                  href={`/billing/start?priceId=${encodeURIComponent(getPriceId("monthly", config.stripe.plans[0]?.priceId))}&mode=subscription&trialDays=7`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow"
            >
                  Upgrade to Pro
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
        {!isPro && !isTrial && (
          <div className="mt-6">
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              Upgrade to Pro
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {/* Features Summary */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
          {isPro ? "Pro Features" : "Upgrade Benefits"}
        </h3>
        <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-100 dark:bg-green-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-400'}`} />
            </div>
            <span className="leading-relaxed">Real-time odds updates (sub 2s)</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-100 dark:bg-green-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-400'}`} />
            </div>
            <span className="leading-relaxed">Legal arbitrage detection</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-100 dark:bg-green-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-400'}`} />
            </div>
            <span className="leading-relaxed">Alternate lines & props</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-100 dark:bg-green-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-400'}`} />
            </div>
            <span className="leading-relaxed">One-click deep linking</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? 'bg-green-100 dark:bg-green-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-600 dark:bg-green-400' : 'bg-neutral-400'}`} />
            </div>
            <span className="leading-relaxed">Priority support</span>
          </li>
        </ul>
      </div>
    </div>
  );
}


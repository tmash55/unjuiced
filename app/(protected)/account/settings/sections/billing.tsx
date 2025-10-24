"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEntitlements } from "@/hooks/use-entitlements";

export default function BillingSettings({ user }: { user: any }) {
  const [loading, setLoading] = useState(false);
  const { data: entitlements, isLoading } = useEntitlements();

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
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                Current Plan
              </h3>
              {isPro && (
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                  Pro
                </span>
              )}
              {!isPro && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  Free
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {isLoading && "Loading..."}
              {!isLoading && isTrial && "7-day free trial"}
              {!isLoading && isSubscription && "Active subscription"}
              {!isLoading && !isPro && "Free plan with limited features"}
            </p>
          </div>
          <CreditCard className="h-5 w-5 text-neutral-400" />
        </div>

        {/* Trial Info */}
        {isTrial && entitlements?.trial?.trial_ends_at && (
          <div className="mt-4 rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              Your trial ends on{" "}
              {new Date(entitlements.trial.trial_ends_at).toLocaleDateString(
                "en-US",
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }
              )}
            </p>
          </div>
        )}

        {/* Manage Subscription Button */}
        {isSubscription && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Update payment method, view invoices, or cancel
            </p>
          </div>
        )}

        {/* Upgrade CTA for Free Users */}
        {!isPro && (
          <div className="mt-6">
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              Upgrade to Pro
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {/* Features Summary */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {isPro ? "Pro Features" : "Upgrade Benefits"}
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-500' : 'bg-neutral-300'}`} />
            Real-time odds updates (sub 2s)
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-500' : 'bg-neutral-300'}`} />
            Legal arbitrage detection
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-500' : 'bg-neutral-300'}`} />
            Alternate lines & props
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-500' : 'bg-neutral-300'}`} />
            One-click deep linking
          </li>
          <li className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isPro ? 'bg-green-500' : 'bg-neutral-300'}`} />
            Priority support
          </li>
        </ul>
      </div>
    </div>
  );
}


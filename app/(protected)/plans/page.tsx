"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Sparkles, Zap, TrendingUp, ArrowRight, Star, Shield, Clock, Users } from "lucide-react";
import Chart from "@/icons/chart";
import { tiers } from "@/constants/pricing";
import { getProductPriceId } from "@/constants/billing";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const testimonials = [
  {
    quote: "Unjuiced completely changed my approach to player props. The matchup data is incredible.",
    author: "Marcus T.",
    role: "Sports Bettor",
    avatar: "MT",
  },
  {
    quote: "The hit rate analytics saved me hours of research. Worth every penny.",
    author: "Jake R.",
    role: "Daily Fantasy Player",
    avatar: "JR",
  },
  {
    quote: "Finally, a tool that shows me the edge before I place a bet. Game changer.",
    author: "Chris L.",
    role: "Pro Bettor",
    avatar: "CL",
  },
];

const stats = [
  { value: "50K+", label: "Bets Analyzed Daily" },
  { value: "20+", label: "Sportsbooks" },
  { value: "94%", label: "User Satisfaction" },
];

export default function PlansPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const router = useRouter();

  const handleSelectPlan = async (
    productType: "pro" | "nba_hit_rates",
    yearly: boolean,
    trialDays?: number
  ) => {
    const priceId = getProductPriceId(productType, yearly ? "yearly" : "monthly");
    
    if (!priceId) {
      toast.error("Plan not available. Please try again.");
      return;
    }

    setLoadingPlan(productType);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          mode: "subscription",
          trialDays: trialDays || undefined,
        }),
      });

      const json = await res.json();

      if (json?.url) {
        window.location.assign(json.url);
        return;
      }

      const params = new URLSearchParams({
        priceId,
        mode: "subscription",
        ...(trialDays ? { trialDays: String(trialDays) } : {}),
      });
      window.location.assign(`/billing/start?${params.toString()}`);
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      {/* Subtle grid pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px] opacity-[0.15] dark:opacity-[0.05]" />
      
      {/* Gradient orbs - using brand colors */}
      <div className="pointer-events-none fixed left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[var(--color-brand)]/20 via-[var(--tertiary)]/10 to-transparent blur-3xl" />
      <div className="pointer-events-none fixed right-1/4 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-gradient-to-br from-[var(--secondary)]/15 via-[var(--accent)]/10 to-transparent blur-3xl" />

      <div className="relative">
        {/* Header - Condensed on mobile */}
        <div className="px-4 pt-8 pb-6 text-center sm:pt-20 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand backdrop-blur-sm sm:mb-6 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              You&apos;re almost there
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl lg:text-6xl">
              Choose the plan that
              <span className="relative ml-1 sm:ml-3">
                <span className="relative z-10 bg-gradient-to-r from-[var(--color-brand)] via-[var(--tertiary)] to-[var(--color-brand)] bg-clip-text text-transparent">
                  fits your game
                </span>
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:mt-6 sm:text-lg">
              Join thousands of bettors who use Unjuiced to find edges and make smarter decisions.
            </p>
          </motion.div>

          {/* Stats - Hidden on mobile, shown on sm+ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 hidden max-w-2xl flex-wrap items-center justify-center gap-8 sm:mt-10 sm:flex sm:gap-12"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Plans Grid */}
        <div className="mx-auto max-w-5xl px-4 pb-16">
          {/* Reverse order on mobile so Pro (featured) shows first */}
          <div className="flex flex-col-reverse gap-8 md:grid md:grid-cols-2 md:flex-none">
            {tiers.map((tier, idx) => {
              const isPro = tier.productType === "pro";
              const isLoading = loadingPlan === tier.productType;
              const showYearlyToggle = isPro;
              const price = isPro && isYearly ? Math.round(tier.yearly / 12) : tier.monthly;
              const hasTrial = isPro && tier.trialDays;

              return (
                <motion.div
                  key={tier.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 + idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-3xl border backdrop-blur-xl transition-all duration-300",
                    tier.featured
                      ? "border-brand/30 bg-white/80 shadow-2xl shadow-brand/10 hover:shadow-brand/20 dark:border-brand/20 dark:bg-neutral-900/80"
                      : "border-neutral-200/80 bg-white/60 shadow-xl hover:shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900/60"
                  )}
                >
                  {/* Gradient overlay for featured */}
                  {tier.featured && (
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-brand)]/5 via-transparent to-[var(--tertiary)]/5" />
                  )}

                  {/* Badge - Pro */}
                  {tier.badge && (
                    <div className="absolute right-6 top-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--tertiary)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-[var(--color-brand)]/25">
                        <Zap className="h-3.5 w-3.5" />
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  {/* Badge - Hit Rates (NEW) */}
                  {!tier.featured && (
                    <div className="absolute right-6 top-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--secondary)] to-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-[var(--secondary)]/25">
                        <Sparkles className="h-3.5 w-3.5" />
                        NEW
                      </span>
                    </div>
                  )}

                  <div className="relative p-8 sm:p-10">
                    {/* Plan Icon */}
                    <div className={cn(
                      "mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
                      tier.featured
                        ? "bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--tertiary)]/20 text-[var(--color-brand)]"
                        : "bg-gradient-to-br from-[var(--secondary)]/20 to-[var(--accent)]/20 text-[var(--secondary)]"
                    )}>
                      {tier.featured ? (
                        <TrendingUp className="h-7 w-7" />
                      ) : (
                        <Chart className="h-7 w-7" />
                      )}
                    </div>

                    {/* Plan Info */}
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">
                      {tier.title}
                    </h2>
                    <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                      {tier.subtitle}
                    </p>

                    {/* Pricing Section */}
                    <div className="mt-6">
                      {/* Price with inline toggle for Pro */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-5xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-6xl">
                          ${price}
                        </span>
                        <span className="text-lg text-neutral-500 dark:text-neutral-400">/month</span>
                        
                        {/* Yearly Toggle - Inline with price */}
                        {showYearlyToggle && (
                          <div className="ml-2 inline-flex items-center gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 p-0.5 dark:border-neutral-700 dark:bg-neutral-800">
                            <button
                              onClick={() => setIsYearly(false)}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                                !isYearly
                                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                              )}
                            >
                              Mo
                            </button>
                            <button
                              onClick={() => setIsYearly(true)}
                              className={cn(
                                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                                isYearly
                                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                              )}
                            >
                              Yr
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                                -17%
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Price subtitle */}
                      <div className="mt-2 h-6">
                        {isPro && isYearly && (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            ${tier.yearly} billed annually
                          </p>
                        )}
                      </div>
                      
                      {/* Trial badge */}
                      <div className="mt-2 h-8">
                        {hasTrial && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)]/10 px-3 py-1 text-sm font-medium text-[var(--color-brand)]">
                            <Clock className="h-4 w-4" />
                            {tier.trialDays}-day free trial
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() =>
                        handleSelectPlan(
                          tier.productType,
                          isPro && isYearly,
                          hasTrial ? tier.trialDays : undefined
                        )
                      }
                      disabled={isLoading}
                      className={cn(
                        "mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50",
                        tier.featured
                          ? "bg-gradient-to-r from-[var(--color-brand)] to-[var(--tertiary)] text-white shadow-lg shadow-[var(--color-brand)]/30 hover:shadow-xl hover:shadow-[var(--color-brand)]/40 hover:brightness-110"
                          : "bg-gradient-to-r from-[var(--secondary)] to-[var(--accent)] text-white shadow-lg shadow-[var(--secondary)]/30 hover:shadow-xl hover:shadow-[var(--secondary)]/40 hover:brightness-110"
                      )}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Setting up...
                        </span>
                      ) : (
                        <>
                          {hasTrial ? `Start ${tier.trialDays}-Day Free Trial` : tier.ctaText}
                          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    {/* Features */}
                    <ul className="mt-10 space-y-4">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                              tier.featured
                                ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                                : "bg-[var(--secondary)]/10 text-[var(--secondary)]"
                            )}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </div>
                          <span className="text-neutral-700 dark:text-neutral-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Skip for now */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 text-center"
          >
            <button
              onClick={() => router.push("/hit-rates")}
              className="text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-300"
            >
              Skip for now — explore as a free user
            </button>
          </motion.div>
        </div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="border-t border-neutral-200/80 bg-white/50 backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-900/50"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white sm:text-3xl">
                Loved by bettors everywhere
              </h2>
              <p className="mt-3 text-neutral-600 dark:text-neutral-400">
                See what our users are saying about Unjuiced
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + idx * 0.1 }}
                  className="relative rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900"
                >
                  {/* Stars */}
                  <div className="mb-4 flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-neutral-700 dark:text-neutral-300">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--tertiary)]/20 text-sm font-semibold text-[var(--color-brand)]">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {testimonial.author}
                      </div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Trust Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="border-t border-neutral-200/80 dark:border-neutral-800/80"
        >
          <div className="mx-auto max-w-4xl px-4 py-12">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-neutral-500 dark:text-neutral-400 sm:gap-12">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 dark:text-white">Secure Checkout</div>
                  <div className="text-xs">256-bit SSL encryption</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 dark:text-white">Cancel Anytime</div>
                  <div className="text-xs">No long-term commitment</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 dark:text-white">Priority Support</div>
                  <div className="text-xs">We&apos;re here to help</div>
                </div>
              </div>
            </div>

            {/* Stripe Text Badge */}
            <div className="mt-8 text-center text-sm text-neutral-400">
              Payments secured by Stripe
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

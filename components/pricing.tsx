"use client";
import React, { useState } from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { motion } from "motion/react";
import { DivideX } from "./divide";
import { Button } from "./button";
import { SlidingNumber } from "./sliding-number";
import { CheckIcon } from "@/icons/card-icons";
import { Scale } from "./scale";
import { tiers } from "@/constants/pricing";
import Link from "next/link";
import { ButtonLink } from "./button-link";
import { BuyButton } from "./billing/BuyButton";
import { getPriceId } from "@/constants/billing";
import { useAuth } from "./auth/auth-provider";
import { useEntitlements } from "@/hooks/use-entitlements";

export const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const { user } = useAuth();
  const { data: entitlements } = useEntitlements();
  
  // Show trial CTA only if user is not signed in OR has never used trial
  const showTrialCTA = !user || (entitlements?.trial?.trial_used === false);
  return (
    <section className="">
      <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-20 pb-10 md:px-8">
        <Badge text="Pricing" />
        <SectionHeading className="mt-4">
          Start Free, Scale to Pro
        </SectionHeading>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base text-neutral-600 md:text-lg dark:text-neutral-400">
          Find the plan that fits your betting strategy
        </p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 dark:border-brand/30 dark:bg-brand/10"
        >
          <p className="text-center text-sm font-medium text-brand-700 dark:text-brand-300">
            Save hours daily finding value—our users uncover $50-$200/day in edges
          </p>
        </motion.div>

        {/* Two-card layout - Pro first on mobile, Free first on desktop */}
        <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          {tiers.map((tier, tierIdx) => (
            <motion.div
              key={tier.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: tierIdx * 0.1 }}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                tier.featured
                  ? "border-brand bg-white shadow-xl ring-2 ring-brand/20 md:order-2 dark:bg-neutral-900"
                  : "border-neutral-200 bg-gray-50 md:order-1 dark:border-neutral-700 dark:bg-neutral-800"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-4 md:left-1/2 md:-translate-x-1/2">
                  <span className="rounded-full bg-brand px-4 py-1 text-sm font-medium text-white">
                    {tier.badge}
                  </span>
                </div>
              )}
              {tier.featured && isYearly && (
                <div className="absolute -top-4 right-4">
                  <span className="rounded-full bg-green-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg">
                    2 months free
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {tier.title}
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {tier.subtitle}
                </p>
                
                {/* Billed yearly toggle - only for Pro tier */}
                {tier.featured && (
                  <div className="mt-6 flex items-center justify-center gap-2.5">
                    <button
                      onClick={() => setIsYearly(!isYearly)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        isYearly ? 'bg-brand' : 'bg-neutral-300 dark:bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                          isYearly ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Billed yearly
                    </span>
                  </div>
                )}
                
                <div className="mt-6 flex items-baseline justify-center gap-2">
                  <div className="relative overflow-hidden">
                    {tier.monthly > 0 ? (
                      <Price 
                        value={tier.featured && isYearly ? Math.round(tier.yearly / 12) : tier.monthly} 
                      />
                    ) : (
                      <span className="text-5xl font-bold text-neutral-900 dark:text-white">
                        ${tier.monthly}
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    /month
                  </span>
                </div>
                {tier.title === "Pro" && showTrialCTA && (
                  <p className="mt-2 text-sm text-brand">
                    7-day free trial
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-4">
                {tier.features.map((feature, idx) => (
                  <Step key={feature + idx}>{feature}</Step>
                ))}
              </div>

              {tier.featured ? (
                <div className="mt-8 flex flex-col gap-3">
                  {showTrialCTA ? (
                    <>
                      {/* Primary CTA - Start Free Trial */}
                      <ButtonLink
                        className="w-full justify-center rounded-lg border-2 border-brand bg-brand px-6 py-3 text-center text-base font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow-md hover:ring-4 hover:ring-brand/20 dark:border-brand dark:bg-brand dark:text-white dark:hover:bg-brand/90"
                        href={`/billing/start?priceId=${encodeURIComponent(getPriceId(isYearly ? "yearly" : "monthly"))}&mode=subscription&trialDays=7`}
                        variant="primary"
                      >
                        Start Free — 7-Day Trial
                      </ButtonLink>

                      {/* Secondary CTA - Go Pro Now (Stripe Checkout) — only for signed-in users */}
                      {user && (
                        <BuyButton
                          priceId={getPriceId(isYearly ? "yearly" : "monthly")}
                          mode="subscription"
                          label="Unlock Pro Now"
                          className="w-full justify-center rounded-lg border-2 border-neutral-200 bg-white px-6 py-2.5 text-center text-sm font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Single CTA - Go Pro Now (for users who already used trial) */}
                      <BuyButton
                        priceId={getPriceId(isYearly ? "yearly" : "monthly")}
                        mode="subscription"
                        label="Unlock Pro Now"
                        className="w-full justify-center rounded-lg border-2 border-brand bg-brand px-6 py-3 text-center text-base font-semibold text-white shadow-sm transition-all hover:bg-brand/90 hover:shadow-md hover:ring-4 hover:ring-brand/20"
                      />
                      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                        Subscribe to unlock all Pro features
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <ButtonLink
                  className="mt-8 w-full justify-center rounded-lg border-2 border-neutral-900 bg-neutral-900 px-6 py-3 text-center text-base font-medium text-white transition-all hover:bg-neutral-800 hover:ring-4 hover:ring-neutral-200/60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-50"
                  href={tier.ctaLink}
                  variant="primary"
                >
                  {tier.ctaText}
                </ButtonLink>
              )}
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
};

const Step = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="text-charcoal-700 flex items-center gap-2 dark:text-neutral-100">
      <CheckIcon className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
};

const Price = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = React.useState(value);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);
    const start = displayValue;
    const end = value;
    const duration = 400; // ms
    const startTime = Date.now();
    const isIncreasing = end > start;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const current = Math.round(start + (end - start) * easeProgress);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <motion.span
      key={displayValue}
      animate={{
        y: isAnimating ? [0, -5, 0] : 0,
      }}
      transition={{ duration: 0.15 }}
      className="text-5xl font-bold text-neutral-900 dark:text-white"
    >
      ${displayValue}
    </motion.span>
  );
};

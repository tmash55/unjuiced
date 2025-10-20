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

export const Pricing = () => {
  const tabs = [
    {
      title: "Monthly",
      value: "monthly",
      badge: "",
    },
    {
      title: "Yearly",
      value: "yearly",
      badge: "Save 17%",
    },
  ];
  const [activeTier, setActiveTier] = useState<"monthly" | "yearly">("monthly");
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
        <div className="relative mt-8 flex items-center gap-4 rounded-xl bg-gray-50 p-2 dark:bg-neutral-800">
          <Scale className="opacity-50" />
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTier(tab.value as "monthly" | "yearly")}
              className="relative z-20 flex w-32 justify-center py-1 text-center sm:w-40"
            >
              {activeTier === tab.value && (
                <motion.div
                  layoutId="active-span"
                  className="shadow-aceternity absolute inset-0 h-full w-full rounded-md bg-white dark:bg-neutral-950"
                ></motion.div>
              )}
              <span className="relative z-20 flex items-center gap-2 text-sm sm:text-base">
                {tab.title}{" "}
                {tab.badge && (
                  <span className="bg-brand/10 text-brand rounded-full px-2 py-1 text-xs font-medium">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Two-card layout */}
        <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          {tiers.map((tier, tierIdx) => (
            <motion.div
              key={tier.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: tierIdx * 0.1 }}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                tier.featured
                  ? "border-brand bg-white shadow-xl ring-2 ring-brand/20 dark:bg-neutral-900"
                  : "border-neutral-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand px-4 py-1 text-sm font-medium text-white">
                    {tier.badge}
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
                <div className="mt-6 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-neutral-900 dark:text-white">
                    ${activeTier === "monthly" ? tier.monthly : tier.yearly}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    /{activeTier === "monthly" ? "month" : "year"}
                  </span>
                </div>
                {tier.title === "Pro" && (
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

              <ButtonLink
                className={`mt-8 w-full justify-center rounded-lg px-6 py-3 text-center text-base font-medium ${
                  tier.featured
                    ? "border-brand bg-brand text-white hover:bg-brand/90 hover:ring-4 hover:ring-brand/20 dark:border-brand dark:bg-brand dark:hover:bg-brand/90"
                    : "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 hover:ring-4 hover:ring-neutral-200/60 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-50"
                }`}
                href={tier.ctaLink}
                variant={tier.featured ? "primary" : "primary"}
              >
                {tier.ctaText}
              </ButtonLink>
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
  return <SlidingNumber value={value} />;
};

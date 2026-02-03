"use client";
import React from "react";
import { motion } from "motion/react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";

const differentiators = [
  {
    icon: BuildingIcon,
    title: "20+ Sportsbooks",
    description: "More coverage than any competitor. Compare odds across every major U.S. sportsbook in one place.",
  },
  {
    icon: ZapIcon,
    title: "Sub-2s Updates",
    description: "Fastest odds refresh in the market. Our real-time engine catches line movements before they disappear.",
  },
  {
    icon: ScaleIcon,
    title: "No-Vig Pricing",
    description: "Fair odds calculated from sharp book consensus. Know the true probability behind every line.",
  },
  {
    icon: ClickIcon,
    title: "One-Click Betting",
    description: "Deep links straight to your sportsbook's bet slip. No more copy-pasting or manual searching.",
  },
];

export function WhyUnjuiced() {
  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col items-start pt-16 pb-8">
        <Badge text="Why Unjuiced" className="px-4 md:px-12" />
        <SectionHeading className="mt-4 px-4 md:px-12 text-left">
          Built Different. Built Better.
        </SectionHeading>
        <SubHeading as="p" className="mt-3 text-left px-4 md:px-12 max-w-xl text-pretty text-base text-neutral-500 dark:text-neutral-400 sm:text-lg">
          The tools serious bettors need, with none of the fluff.
        </SubHeading>

        {/* Differentiators Grid */}
        <div className="mt-12 w-full border-t border-divide">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-divide">
            {differentiators.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-6 md:p-8 text-center"
                >
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-brand/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-8 w-full px-4 md:px-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 p-6 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-divide">
            {[
              { value: "5,000+", label: "Active Bettors" },
              { value: "100K+", label: "Props Compared Monthly" },
              { value: "20+", label: "Sportsbooks" },
              { value: "<2s", label: "Odds Refresh" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-brand">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}

// Icons
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function ClickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  );
}

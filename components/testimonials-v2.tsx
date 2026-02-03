"use client";
import React from "react";
import { motion } from "motion/react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SectionHeading } from "./seciton-heading";
import { SubHeading } from "./subheading";

const testimonials = [
  {
    name: "Chris D.",
    handle: "@chrisd_bets",
    avatar: "C",
    quote: "I used to place bets without checking. Now I check Unjuiced first — the difference in payouts adds up fast.",
    role: "Sharp Bettor",
  },
  {
    name: "Alex G.",
    handle: "@alexg_sports",
    avatar: "A",
    quote: "The SGP builder is exactly what I didn't know I needed. Seeing odds across books? Game-changer.",
    role: "Fantasy Enthusiast",
  },
  {
    name: "Jordan P.",
    handle: "@jordan_plays",
    avatar: "J",
    quote: "Clean interface. Easy to use. The hit rate tracker alone has saved me from so many bad bets.",
    role: "Props Player",
  },
  {
    name: "Mike R.",
    handle: "@mike_arbs",
    avatar: "M",
    quote: "Found $200+ in arbitrage opportunities my first week. The one-click dual bet feature is genius.",
    role: "Arb Hunter",
  },
  {
    name: "Sarah T.",
    handle: "@sarah_bets",
    avatar: "S",
    quote: "Finally a tool that shows me actual data instead of gut feelings. My hit rate on props is way up.",
    role: "Data-Driven Bettor",
  },
  {
    name: "Tyler M.",
    handle: "@tyler_ev",
    avatar: "T",
    quote: "The +EV finder is incredible. I'm actually making mathematically sound bets now instead of guessing.",
    role: "EV Bettor",
  },
];

export function TestimonialsV2() {
  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col items-start pt-16 pb-8">
        <Badge text="What Bettors Say" className="px-4 md:px-12" />
        <SectionHeading className="mt-4 px-4 md:px-12 text-left">
          Trusted by Thousands of Bettors
        </SectionHeading>
        <SubHeading as="p" className="mt-3 text-left px-4 md:px-12 max-w-xl text-pretty text-base text-neutral-500 dark:text-neutral-400 sm:text-lg">
          See what our community has to say about finding their edge with Unjuiced.
        </SubHeading>

        {/* Testimonials Grid */}
        <div className="mt-12 w-full border-t border-divide">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-divide">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-6 md:p-8"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">{testimonial.name}</div>
                      <div className="text-sm text-neutral-500">{testimonial.handle}</div>
                    </div>
                  </div>
                  {/* X/Twitter icon */}
                  <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>

                {/* Quote */}
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  "{testimonial.quote}"
                </p>

                {/* Role badge */}
                <span className="inline-block text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-1 rounded">
                  {testimonial.role}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="mt-6 px-4 md:px-12 text-sm text-neutral-500 dark:text-neutral-400">
          Real feedback from our community. Names shortened for privacy.
        </p>
      </div>
    </Container>
  );
}

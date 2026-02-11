"use client";
import { cn } from "@/lib/utils";
import React, { useRef } from "react";
import { motion, useInView, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { Container } from "./container";

export function StatsWithNumberTicker() {
  const items = [
    {
      label: "using Unjuiced",
      value: 1000,
      prefix: "",
      suffix: "+",
    },
    {
      label: "player & prop markets",
      value: 300,
      prefix: "",
      suffix: "+",
    },
    {
      label: "bets scanned monthly",
      value: 500000,
      prefix: "",
      suffix:"+",
    },
    {
      label: "odds refresh",
      value: 2,
      prefix: "<",
      suffix: "s",
    },
  ];
  return (
    <Container className="border-divide border-x px-4 py-12 sm:p-10 sm:py-20">
      <div className="relative z-20">
        <h2 className="text-center text-xl font-medium text-neutral-900 dark:text-white sm:text-2xl md:text-3xl">
          Metrics that compound advantage
        </h2>
        <p className="mx-auto mt-4 max-w-2xl px-4 text-center text-sm text-neutral-600 md:text-base dark:text-neutral-300">
          Unjuiced delivers institutional-grade markets coverage and real-time signal. Built for teams that need reliable edge—at scale.
        </p>
        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-10 justify-items-center sm:grid-cols-2 md:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              key={"card" + index}
              className={cn("group/card relative overflow-hidden rounded-lg text-center")}
            >
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-mono text-3xl font-medium text-[var(--color-brand)]">
                  {item.prefix}
                  <AnimatedNumber value={item.value} />
                  {item.suffix}
                </span>
              </div>
              <p className="mt-2 text-balance text-sm text-neutral-700 dark:text-neutral-300">
                {item.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </Container>
  );
}

function AnimatedNumber({
  value,
  initial = 0,
}: {
  value: number;
  initial?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref);

  const spring = useSpring(initial, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString(),
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    } else {
      spring.set(initial);
    }
  }, [isInView, spring, value, initial]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

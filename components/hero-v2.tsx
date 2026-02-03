"use client";
import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Container } from "./container";
import { ButtonLink } from "./button-link";

export function HeroV2() {
  return (
    <Container className="border-divide border-x">
      <div className="relative flex w-full items-center justify-center overflow-hidden bg-white px-4 pb-16 pt-12 md:py-32 dark:bg-black">
        <Background />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <Badge text="Trusted by 5,000+ Bettors" />
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 text-center text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl lg:text-7xl dark:text-neutral-100"
          >
            Find Profitable Bets.{" "}
            <span
              className="relative text-brand"
              style={{
                textShadow: '0 0 40px rgba(14, 165, 233, 0.3), 0 0 20px rgba(14, 165, 233, 0.2)',
              }}
            >
              Not Gut Feelings.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mx-auto mt-8 max-w-3xl text-center text-base text-neutral-600 sm:text-lg md:text-xl dark:text-neutral-400"
          >
            Hit rates, arbitrage, +EV finder, and SGP builder — all in one platform with 20+ sportsbooks.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mx-auto mt-8 flex items-center justify-center gap-6 text-sm text-neutral-500 dark:text-neutral-400"
          >
            <div className="flex items-center gap-2">
              <span className="text-brand">✓</span>
              <span>3 Day Free Trial</span>
            </div>
            <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-600"></div>
            <div className="flex items-center gap-2">
              <span className="text-accent">✓</span>
              <span>Real-Time Updates</span>
            </div>
            <div className="hidden h-4 w-px bg-neutral-300 sm:block dark:bg-neutral-600"></div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-brand">✓</span>
              <span>20+ Sportsbooks</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="mt-10 flex w-full flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:px-0"
          >
            <ButtonLink
              href="/register"
              variant="primary"
              className="w-full justify-center text-center rounded-lg border-brand bg-brand px-8 py-3 text-base font-medium text-white hover:bg-brand/90 hover:ring-4 hover:ring-brand/20 sm:w-auto dark:border-brand dark:bg-brand dark:hover:bg-brand/90"
            >
              Start Free Trial
            </ButtonLink>
            <ButtonLink
              href="#how-it-works"
              variant="secondary"
              className="w-full justify-center text-center rounded-lg border-transparent bg-transparent px-6 py-3 text-base font-medium text-brand hover:bg-brand/10 sm:w-auto dark:border-transparent dark:text-brand dark:hover:bg-brand/20"
            >
              See How It Works
            </ButtonLink>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="mx-auto mt-8 max-w-2xl px-4"
          >
            <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
              For entertainment purposes only. Unjuiced does not accept or facilitate bets.
            </p>
          </motion.div>

          <div className="z-40 mt-12 flex w-full justify-center bg-white dark:bg-black">
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="relative w-full overflow-hidden rounded-xl shadow-2xl [mask-image:linear-gradient(to_bottom,white,white_40%,transparent)]"
            >
              {/* Placeholder for tool showcase image/GIF */}
              <div className="aspect-video w-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-xl bg-brand/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Tool Dashboard Preview</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Add screenshot or GIF here</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-50"></div>
            </motion.div>
          </div>
        </div>
      </div>
    </Container>
  );
}

const Badge = ({ text }: { text: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative mx-auto mb-6 flex w-fit items-center justify-center overflow-hidden rounded-full p-px"
    >
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-accent to-brand"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ width: "300px", height: "20px" }}
      />
      <div className="relative z-10 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
        {text}
      </div>
    </motion.div>
  );
};

const Background = () => {
  const [strips, setStrips] = useState<number[]>([]);
  useEffect(() => {
    const calculateStrips = () => {
      const viewportWidth = window.innerWidth;
      const stripWidth = 80;
      const numberOfStrips = Math.ceil(viewportWidth / stripWidth);
      setStrips(Array.from({ length: numberOfStrips }, (_, i) => i));
    };
    calculateStrips();
    window.addEventListener("resize", calculateStrips);
    return () => window.removeEventListener("resize", calculateStrips);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 z-0 flex [mask-image:radial-gradient(circle_at_center,white_0%,white_30%,transparent_70%)]"
    >
      <Noise />
      {strips.map((index) => (
        <div
          key={index}
          className="h-full w-20 bg-gradient-to-r from-neutral-100 to-white shadow-[2px_0px_0px_0px_var(--color-neutral-400)] dark:from-neutral-900 dark:to-neutral-950 dark:shadow-[2px_0px_0px_0px_var(--color-neutral-800)]"
        />
      ))}
    </motion.div>
  );
};

const Noise = () => {
  return (
    <div
      className="absolute inset-0 h-full w-full scale-[1.2] transform opacity-[0.05] [mask-image:radial-gradient(#fff,transparent,75%)]"
      style={{
        backgroundImage: "url(/noise.webp)",
        backgroundSize: "20%",
      }}
    ></div>
  );
};

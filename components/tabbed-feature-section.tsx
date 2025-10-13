"use client";
import React, { useEffect, useState } from "react";
import { Container } from "./container";
import { Badge } from "./badge";
import { SubHeading } from "./subheading";
import { SectionHeading } from "./seciton-heading";
import { PixelatedCanvas } from "./pixelated-canvas";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ButtonLink } from "./button-link";

export type FeatureTab = {
  title: string;
  description: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  id: string;
  skeleton: React.ReactNode;
  learnMoreHref?: string;
};

export type TabbedFeatureSectionProps = {
  badge: string;
  heading: string;
  subheading: string;
  ctaText?: string;
  ctaHref?: string;
  tabs: FeatureTab[];
  autoRotate?: boolean;
  autoRotateDuration?: number;
};

export const TabbedFeatureSection = ({
  badge,
  heading,
  subheading,
  ctaText,
  ctaHref,
  tabs,
  autoRotate = true,
  autoRotateDuration = 8000,
}: TabbedFeatureSectionProps) => {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab.id);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    }, autoRotateDuration);

    return () => clearInterval(interval);
  }, [activeTab, tabs, autoRotate, autoRotateDuration]);

  return (
    <Container className="border-divide border-x">
      <div className="flex flex-col items-start pt-16 pb-8">
        <Badge text={badge} className="px-4 md:px-12" />
        <SectionHeading className="mt-4 px-4 md:px-12 text-left">
          {heading}
        </SectionHeading>

        <SubHeading as="p" className="mt-3 text-left px-4 md:px-12 max-w-xl text-pretty text-base text-neutral-500 dark:text-neutral-400 sm:text-lg">
          {subheading}
        </SubHeading>
        
        {ctaText && ctaHref && (
          <div className="mt-4 px-4 md:px-12">
            <ButtonLink variant="secondary" href={ctaHref}>
              {ctaText}
            </ButtonLink>
          </div>
        )}

        {/* Desktop Tabs */}
        <div className="mt-16 hidden w-full flex-col border-t border-divide lg:flex">
          {/* Top row: Display area */}
          <div className="relative h-[480px] w-full overflow-hidden bg-[radial-gradient(var(--color-dots)_1px,transparent_1px)] [background-size:10px_10px]">
            {/* Vignette blur overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/60 dark:from-black/60 dark:to-black/60" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-white/40 dark:from-black/40 dark:to-black/40" />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab.id}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ filter: "blur(10px)", opacity: 0 }}
                animate={{ filter: "blur(0px)", opacity: 1 }}
                exit={{ filter: "blur(10px)", opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {activeTab.skeleton}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom row: Tab grid */}
          <div className={cn(
            "grid divide-x divide-divide border-t border-divide",
            tabs.length === 2 && "grid-cols-2",
            tabs.length === 3 && "grid-cols-3",
            tabs.length === 4 && "grid-cols-4",
            tabs.length > 4 && "grid-cols-3"
          )}>
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTab.id;
              return (
                <div
                  key={tab.id}
                  className="group relative flex w-full flex-col items-start overflow-hidden px-8 py-8 hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <button
                    className="absolute inset-0 z-10"
                    onClick={() => setActiveTab(tab)}
                    aria-label={`Switch to ${tab.title}`}
                  />
                  {isActive && (
                    <Canvas activeTab={tab} duration={2500} />
                  )}
                  {isActive && <Loader duration={autoRotateDuration} />}
                  <div
                    className={cn(
                      "text-charcoal-700 relative z-20 flex items-center gap-2 font-medium dark:text-neutral-100",
                      !isActive && "group-hover:text-brand",
                    )}
                  >
                    <tab.icon className="shrink-0" /> {tab.title}
                  </div>
                  <p
                    className={cn(
                      "relative z-20 mt-2 text-left text-sm text-gray-600 dark:text-neutral-300",
                      isActive && "text-charcoal-700 dark:text-neutral-100",
                    )}
                  >
                    {tab.description}
                  </p>
                  {tab.learnMoreHref && (
                    <Link
                      href={tab.learnMoreHref}
                      className={cn(
                        "relative z-20 mt-4 flex items-center gap-1 text-sm transition-colors hover:underline",
                        isActive
                          ? "text-brand"
                          : "text-gray-400 dark:text-neutral-500",
                      )}
                    >
                      Learn more
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="transition-transform group-hover:translate-x-0.5"
                      >
                        <path
                          d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="divide-divide border-divide mt-8 flex w-full flex-col divide-y overflow-hidden border-t lg:hidden">
          {tabs.map((tab, index) => (
            <div
              key={tab.id + "mobile"}
              className="group relative flex w-full flex-col items-start overflow-hidden px-4 py-6 md:px-12 md:py-8"
            >
              <div className="text-charcoal-700 relative z-20 flex items-center gap-2 text-base font-medium dark:text-neutral-100">
                <tab.icon className="h-4 w-4 shrink-0" /> {tab.title}
              </div>
              <p className="relative z-20 mt-2 text-left text-sm text-gray-600 dark:text-neutral-400">
                {tab.description}
              </p>
              <div className="relative mx-auto mt-6 h-64 w-full overflow-hidden sm:h-80 mask-t-from-90% mask-r-from-90% mask-b-from-90% mask-l-from-90%">
                {tab.skeleton}
              </div>
              {tab.learnMoreHref && (
                <Link
                  href={tab.learnMoreHref}
                  className="relative z-20 mt-4 flex items-center gap-1 text-sm text-brand transition-colors hover:underline"
                >
                  Learn more
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <path
                      d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

const Loader = ({ duration = 2500 }: { duration?: number }) => {
  return (
    <motion.div
      className="bg-brand absolute inset-x-0 bottom-0 z-30 h-0.5 w-full rounded-full"
      initial={{ width: 0 }}
      animate={{ width: "100%" }}
      transition={{ duration: duration / 1000 }}
    />
  );
};

const Canvas = ({
  activeTab,
  duration,
}: {
  activeTab: FeatureTab;
  duration: number;
}) => {
  return (
    <>
      <div className="absolute inset-x-0 z-20 h-full w-full bg-white mask-t-from-50% dark:bg-neutral-900" />
      <PixelatedCanvas
        key={activeTab.id}
        isActive={true}
        fillColor="var(--color-canvas)"
        backgroundColor="var(--color-canvas-fill)"
        size={2.5}
        duration={duration}
        className="absolute inset-0 scale-[1.01] opacity-20"
      />
    </>
  );
};


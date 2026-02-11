"use client";

import React, { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "motion/react";
import Image from "next/image";

export interface StickyScrollFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  image?: string;
  content?: React.ReactNode;
}

export function FeaturesStickyScroll({
  features,
  accentColor = "#0ea5e9",
}: {
  features: StickyScrollFeature[];
  accentColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <div
      ref={ref}
      className="relative mx-auto h-full w-full max-w-7xl bg-black pt-16 md:pt-24"
    >
      <div className="flex flex-col items-center px-6 text-center">
        <p
          className="text-xs font-semibold uppercase tracking-[0.28em]"
          style={{ color: accentColor }}
        >
          Features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Powerful Features
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
          Everything you need to find and capitalize on betting value.
        </p>
      </div>

      {/* Desktop: sticky scroll */}
      <div className="py-4 md:py-20">
        <motion.div className="relative mx-auto hidden h-full max-w-7xl flex-col justify-between p-10 lg:flex">
          {features.map((item, index) => (
            <ScrollContent
              key={item.title + index}
              item={item}
              index={index}
              accentColor={accentColor}
            />
          ))}
        </motion.div>

        {/* Mobile: stacked */}
        <motion.div className="relative mx-auto flex max-w-7xl flex-col justify-between px-4 py-10 lg:hidden">
          {features.map((item, index) => (
            <ScrollContentMobile
              key={item.title + index}
              item={item}
              index={index}
              accentColor={accentColor}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

const ScrollContent = ({
  item,
  index,
  accentColor,
}: {
  item: StickyScrollFeature;
  index: number;
  accentColor: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const translate = useTransform(scrollYProgress, [0, 1], [0, 250]);
  const translateContent = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.5, 0.7, 1],
    [0, 1, 1, 0, 0],
  );
  const opacityContent = useTransform(
    scrollYProgress,
    [0, 0.2, 0.5, 0.8, 1],
    [0, 0, 1, 1, 0],
  );

  const imageContent = item.content || (item.image ? (
    <Image
      src={item.image}
      alt={item.title}
      width={800}
      height={500}
      className="h-auto w-full rounded-xl border border-white/10 shadow-2xl"
    />
  ) : null);

  return (
    <motion.div
      ref={ref}
      transition={{ duration: 0.3 }}
      className="relative my-40 grid grid-cols-2 gap-12"
    >
      <div className="w-full">
        <motion.div style={{ y: translate, opacity: index === 0 ? opacityContent : 1 }}>
          {item.icon && <div className="mb-3">{item.icon}</div>}
          {!item.icon && (
            <div
              className="mb-3 inline-flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: `${accentColor}30` }}
            >
              {index + 1}
            </div>
          )}
          <motion.h2 className="max-w-md text-left text-2xl font-semibold text-white lg:text-4xl">
            {item.title}
          </motion.h2>
          <motion.p className="mt-3 max-w-sm text-lg text-white/50">
            {item.description}
          </motion.p>
        </motion.div>
      </div>

      <motion.div
        style={{ y: translateContent, opacity }}
        className="h-full w-full self-start rounded-md"
      >
        {imageContent}
      </motion.div>
    </motion.div>
  );
};

const ScrollContentMobile = ({
  item,
  index,
  accentColor,
}: {
  item: StickyScrollFeature;
  index: number;
  accentColor: string;
}) => {
  const imageContent = item.content || (item.image ? (
    <Image
      src={item.image}
      alt={item.title}
      width={800}
      height={500}
      className="h-auto w-full rounded-xl border border-white/10 shadow-2xl"
    />
  ) : null);

  return (
    <motion.div
      transition={{ duration: 0.3 }}
      className="relative my-8 flex flex-col gap-6"
    >
      {imageContent && (
        <div className="w-full rounded-md">
          {imageContent}
        </div>
      )}
      <div className="w-full">
        {item.icon && <div className="mb-3">{item.icon}</div>}
        {!item.icon && (
          <div
            className="mb-3 inline-flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: `${accentColor}30` }}
          >
            {index + 1}
          </div>
        )}
        <h2 className="text-2xl font-semibold text-white">
          {item.title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-white/50 md:text-base">
          {item.description}
        </p>
      </div>
    </motion.div>
  );
};

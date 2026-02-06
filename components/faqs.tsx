"use client";
import React, { useMemo, useState } from "react";
import { faqs } from "@/constants/faqs";
import { AnimatePresence, motion } from "motion/react";
import useMeasure from "react-use-measure";
import { MaxWidthWrapper } from "./max-width-wrapper";
import Link from "next/link";

const ChevronDownIcon = (
  props: React.SVGProps<SVGSVGElement> & { rotated?: boolean },
) => {
  const { rotated, className, ...rest } = props;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <path
        d="M3.75 6.5L8 10.75L12.25 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const FAQs = () => {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section className="bg-black bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_60%)] py-16 sm:py-20 lg:py-24">
      <MaxWidthWrapper>
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            FAQs
          </p>
          <h2 className="mt-3 text-center text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            Questions, Answered
          </h2>
          <p className="mx-auto mt-4 max-w-2xl px-2 text-center text-base text-white/60 sm:text-lg">
            Everything you need to know about research, value discovery, and
            execution on Unjuiced.
          </p>

          <div className="mt-8 mb-10 flex w-full flex-col items-center justify-center gap-3 px-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Contact Support
            </Link>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-4xl gap-2.5">
          {faqs.map((item, index) => (
            <AccordionItem
              key={item.question}
              index={index}
              question={item.question}
              answer={item.answer}
              isOpen={openItems.has(index)}
              onToggle={() => toggle(index)}
            />
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

const AccordionItem = ({
  index,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const [ref, { height }] = useMeasure();
  const targetHeight = useMemo(() => (isOpen ? height : 0), [isOpen, height]);

  // Parse answer text and convert "/path" patterns to links
  const renderAnswer = (text: string) => {
    const parts = text.split(/(\bhref:\s*\/[a-z-]+|\bhere:\s*\/[a-z-]+)/gi);

    return parts.map((part, i) => {
      const linkMatch = part.match(/\b(href|here):\s*(\/[a-z-]+)/i);
      if (linkMatch) {
        const path = linkMatch[2];
        const displayText = path.substring(1);
        return (
          <React.Fragment key={i}>
            {linkMatch[1]}:{" "}
            <a
              href={path}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-[color:var(--primary-weak)] hover:underline"
            >
              {displayText}
            </a>
          </React.Fragment>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] transition-colors hover:bg-white/[0.05]">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${index}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
      >
        <span className="text-sm font-medium text-white sm:text-base">
          {question}
        </span>
        <motion.span
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-white/40"
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDownIcon />
        </motion.span>
      </button>

      <motion.div
        id={`faq-panel-${index}`}
        role="region"
        aria-hidden={!isOpen}
        initial={false}
        animate={{ height: targetHeight, opacity: isOpen ? 1 : 0 }}
        transition={{ height: { duration: 0.35 }, opacity: { duration: 0.2 } }}
        className="overflow-hidden px-5 sm:px-6"
      >
        <div ref={ref} className="pb-4">
          <AnimatePresence mode="popLayout">
            {isOpen && (
              <motion.p
                key="content"
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-sm text-white/50 leading-relaxed"
              >
                {renderAnswer(answer)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

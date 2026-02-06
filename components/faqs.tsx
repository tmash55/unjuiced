"use client";
import React, { useMemo, useState } from "react";
import { SubHeading } from "./subheading";
import { SectionHeading } from "./seciton-heading";
import { Badge } from "./badge";
import { faqs } from "@/constants/faqs";
import { AnimatePresence, motion } from "motion/react";
import useMeasure from "react-use-measure";
import { ButtonLink } from "./button-link";
import { MaxWidthWrapper } from "./max-width-wrapper";


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
    <section className="bg-black bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_70%)] py-14 sm:py-20">
      <MaxWidthWrapper>
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <Badge text="FAQs" />
          <SectionHeading className="mt-4 text-center">
            Questions, Answered
          </SectionHeading>

          <SubHeading as="p" className="mx-auto mt-5 max-w-2xl px-2 text-center text-white/70">
            Everything you need to know about research, value discovery, and execution on Unjuiced.
          </SubHeading>

          <div className="mt-7 mb-10 flex w-full flex-col items-center justify-center gap-3 px-4 sm:flex-row">
            <ButtonLink
              variant="primary"
              href="/register"
              className="rounded-full border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-strong)]"
            >
              Start Free Trial
            </ButtonLink>
            <ButtonLink
              variant="outline"
              href="/contact"
              className="rounded-full border border-white/20 text-white hover:bg-white/10"
            >
              Contact Support
            </ButtonLink>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-5xl gap-3">
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
    // Match patterns like "here: /path" or "here: /path."
    const parts = text.split(/(\bhref:\s*\/[a-z-]+|\bhere:\s*\/[a-z-]+)/gi);
    
    return parts.map((part, i) => {
      // Check if this part contains a link pattern
      const linkMatch = part.match(/\b(href|here):\s*(\/[a-z-]+)/i);
      if (linkMatch) {
        const path = linkMatch[2];
        const displayText = path.substring(1); // Remove leading slash for display
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
    <div className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${index}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-7"
      >
        <span className="text-base font-medium text-white">
          {question}
        </span>
        <motion.span
          className="inline-flex size-7 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white"
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <ChevronDownIcon className="dark:text-neutral-100" />
        </motion.span>
      </button>

      <motion.div
        id={`faq-panel-${index}`}
        role="region"
        aria-hidden={!isOpen}
        initial={false}
        animate={{ height: targetHeight, opacity: isOpen ? 1 : 0 }}
        transition={{ height: { duration: 0.35 }, opacity: { duration: 0.2 } }}
        className="overflow-hidden px-6 sm:px-7"
      >
        <div ref={ref} className="pb-5">
          <AnimatePresence mode="popLayout">
            {isOpen && (
              <motion.p
                key="content"
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-white/70"
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

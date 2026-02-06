"use client";

import React from "react";
import { MaxWidthWrapper } from "./max-width-wrapper";
import { ButtonLink } from "./button-link";

export const CTA = () => {
  return (
    <section className="relative overflow-hidden bg-black py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_65%)]" />

      <MaxWidthWrapper>
        <div className="relative mx-auto max-w-4xl rounded-3xl border border-white/12 bg-gradient-to-br from-[rgba(14,165,233,0.2)] via-[rgba(10,16,20,0.85)] to-black px-6 py-12 text-center shadow-[0_24px_80px_rgba(2,132,199,0.25)] sm:px-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            Ready to Start
          </p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Start Finding Better Bets Today
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70 sm:text-lg">
            Research smarter, find value faster, and execute with confidence across every ticket.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink
              href="/register"
              variant="primary"
              className="rounded-full border-[color:var(--primary)] bg-[color:var(--primary)] px-8 text-white hover:bg-[color:var(--primary-strong)]"
            >
              Start Free Trial
            </ButtonLink>
            <ButtonLink
              href="/pricing"
              variant="secondary"
              className="rounded-full border border-white/20 bg-white/[0.08] px-8 text-white hover:bg-white/[0.15]"
            >
              Compare Plans
            </ButtonLink>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

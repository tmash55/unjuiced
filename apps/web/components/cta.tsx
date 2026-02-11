"use client";

import React from "react";
import { MaxWidthWrapper } from "./max-width-wrapper";
import { ButtonLink } from "./button-link";
import { useAuth } from "@/components/auth/auth-provider";

function getDashboardUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    if (host.includes("localhost")) {
      const port = host.split(":")[1] || "3000";
      return `http://app.localhost:${port}/today`;
    }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const baseUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    return `${baseUrl}/today`;
  }
  return "https://app.unjuiced.bet/today";
}

export const CTA = () => {
  const { user } = useAuth();
  const dashboardUrl = getDashboardUrl();

  return (
    <section className="relative overflow-hidden bg-black py-16 sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_60%)]" />

      <MaxWidthWrapper>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)]">
            Ready to Start
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            {user ? "Welcome Back" : "Start Finding Better Bets Today"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/60 sm:text-lg">
            Research smarter, find value faster, and execute with confidence
            across every ticket.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {user ? (
              <a
                href={dashboardUrl}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
              >
                Go to Dashboard
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </a>
            ) : (
              <>
                <ButtonLink
                  href="/register"
                  variant="primary"
                  className="rounded-full bg-white px-8 text-neutral-900 hover:bg-neutral-100 border-transparent"
                >
                  Start Free Trial
                </ButtonLink>
                <ButtonLink
                  href="/pricing"
                  variant="secondary"
                  className="rounded-full border-white/10 bg-white/5 px-8 text-white hover:bg-white/10"
                >
                  Compare Plans
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

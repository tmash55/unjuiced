"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/button-link";
import { Home, Search, ArrowLeft, Droplet } from "lucide-react";
import X from "@/components/icons/x";
import { Grid } from "@/components/grid";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";

export default function NotFound() {
  return (
    <>
      {/* Background with Grid and Gradient */}
      <div className="absolute inset-0 isolate overflow-hidden bg-white dark:bg-black">
        {/* Grid */}
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 w-[1200px] -translate-x-1/2",
            "[mask-composite:intersect] [mask-image:linear-gradient(black,transparent_320px),linear-gradient(90deg,transparent,black_5%,black_95%,transparent)]",
          )}
        >
          <Grid
            cellSize={60}
            patternOffset={[0.75, 0]}
            className="text-neutral-200 opacity-100 dark:text-neutral-800 dark:opacity-20"
          />
        </div>

        {/* Gradient */}
        {[...Array(2)].map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "absolute left-1/2 top-6 size-[80px] -translate-x-1/2 -translate-y-1/2 scale-x-[1.6]",
              idx === 0 
                ? "opacity-40 mix-blend-normal dark:mix-blend-lighten dark:opacity-30" 
                : "opacity-15 dark:opacity-5",
            )}
          >
            {[...Array(idx === 0 ? 2 : 1)].map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "absolute -inset-16 blur-[50px]",
                  "mix-blend-normal saturate-150 dark:mix-blend-overlay dark:saturate-[2]",
                  "bg-[conic-gradient(from_90deg,var(--color-primary)_0deg,var(--color-primary-light)_60deg,var(--color-secondary)_120deg,var(--color-accent)_180deg,var(--color-tertiary)_240deg,var(--color-tertiary-light)_300deg,var(--color-primary)_360deg)]",
                )}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative flex min-h-screen w-full flex-col items-center justify-between">
        {/* Wordmark Logo at Top */}
        <Link
          href="/"
          className="absolute left-1/2 top-4 z-10 -translate-x-1/2 transition-opacity hover:opacity-80"
        >
          <Wordmark className="h-8" />
        </Link>

      {/* Top spacer */}
      <div className="grow basis-0">
        <div className="h-24" />
      </div>

      {/* Main Content */}
      <div className="relative flex w-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl">

          {/* 404 Badge */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-brand/10 px-4 py-2 text-sm font-medium text-brand dark:bg-brand/20 dark:text-brand-300">
              Error 404
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-center text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl dark:text-white mb-6">
            Page Not Found
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-neutral-600 sm:text-lg dark:text-neutral-400 mb-12">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The odds might be against this URL existing.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <ButtonLink 
              href="/" 
              variant="primary"
              className="inline-flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </ButtonLink>
            <ButtonLink 
              href="/odds/nfl" 
              variant="secondary"
              className="inline-flex items-center justify-center gap-2"
            >
              <Search className="h-4 w-4" />
              Browse Odds
            </ButtonLink>
          </div>

          {/* Back Link */}
          <div className="flex justify-center mt-8">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-brand transition-colors dark:text-neutral-400 dark:hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back to previous page
            </button>
          </div>
        </div>
      </div>

      {/* Bottom section with social link */}
      <div className="flex grow basis-0 flex-col justify-end">
        <div className="flex flex-col items-center gap-4 px-4 py-8">
          {/* Social Link */}
          <a
            href="https://twitter.com/unjuiced"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-brand transition-colors dark:text-neutral-400 dark:hover:text-brand"
            aria-label="Follow us on X"
          >
            <X className="h-4 w-4" />
            <span>Follow us on X</span>
          </a>
          
          {/* Terms */}
          <p className="text-center text-xs font-medium text-neutral-500">
            <a
              href="/terms"
              className="font-semibold text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Terms of Service
            </a>
            {" · "}
            <a
              href="/privacy"
              className="font-semibold text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
      </div>
    </>
  );
}


"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FlippingText } from "@/components/flipping-text";
import { cn } from "@/lib/utils";
import {
  SpotlightConfig,
  SpotlightShader,
} from "@/components/spotlight-shader";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";

const heroSpotlights: SpotlightConfig[] = [
  {
    position: "top-left",
    color: "var(--primary-weak)",
    intensity: 1.6,
    size: 520,
    spread: 62,
  },
  {
    position: "top-right",
    color: "var(--primary)",
    intensity: 2.0,
    size: 520,
    spread: 58,
  },
  {
    position: "bottom-right",
    color: "var(--primary-strong)",
    intensity: 1.2,
    size: 420,
    spread: 50,
  },
];

export function HeroSpotlight() {
  const { signInWithGoogle } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setIsGoogleLoading(false);
    }
  };

  return (
    <section className="relative -mt-16 w-full overflow-hidden bg-black pt-16">
      <SpotlightShader
        className="pointer-events-none absolute inset-0 bg-black"
        spotlights={heroSpotlights}
        ambientColor="var(--color-neutral-900)"
        animationSpeed={0.18}
        enableAnimation={true}
        easeInDuration={1.1}
        blur={34}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/45" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18),transparent_72%)]" />

      <div className="relative z-10 w-full pt-10 md:pt-20 lg:pt-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--primary-weak)] md:text-left">
            Trusted by 5,000+ bettors
          </p>

          <h1 className="text-center text-4xl font-semibold leading-tight tracking-tight text-white md:text-left md:text-5xl lg:text-6xl">
            Find your edge in{" "}
            <span className="text-[color:var(--primary-weak)]">
              <FlippingText
                words={["props", "odds", "lines", "markets"]}
                className="text-[color:var(--primary-weak)]"
              />
            </span>
          </h1>

          <p className="mx-auto max-w-xl py-6 text-center text-lg text-white/70 md:mx-0 md:text-left md:text-xl">
            Real-time data, sharp books, and tools built to help you bet smarter
            — not louder.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              <GoogleLogo className="h-4 w-4" />
              {isGoogleLoading ? "Redirecting..." : "Sign up with Google"}
            </button>
            <Link
              href="/register"
              className="flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/20 sm:w-auto"
            >
              Sign up with email
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-white/70 md:justify-start">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              3 Day Free Trial
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary-weak)]" />
              Real-Time Updates
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary-strong)]" />
              20+ Sportsbooks
            </span>
          </div>

          <LandingImages />
        </div>
      </div>
    </section>
  );
}

const LandingImages = () => {
  return (
    <div className="relative min-h-40 w-full pt-16 perspective-distant sm:min-h-80 md:min-h-[400px] lg:min-h-[520px]">
      {/* Front image (top layer) */}
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        viewport={{ once: true }}
        className="perspective-[4000px]"
      >
        <Image
          src="/landing-page/hero-back.png"
          alt="Unjuiced positive EV finder"
          width={1920}
          height={1080}
          className={cn(
            "absolute inset-0 rounded-lg border border-white/10 shadow-2xl mask-r-from-20% mask-b-from-20%",
          )}
          style={{
            transform: "rotateY(20deg) rotateX(40deg) rotateZ(-20deg)",
          }}
          priority
        />
      </motion.div>

      {/* Back image (behind, offset) */}
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        className="translate-x-20 -translate-y-10 perspective-[4000px] md:-translate-y-20 lg:-translate-y-40"
      >
        <Image
          src="/landing-page/hero-main.png"
          alt="Unjuiced hit rates dashboard"
          width={1920}
          height={1080}
          className={cn(
            "absolute inset-0 -translate-x-10 rounded-lg border border-white/10 shadow-2xl mask-r-from-50% mask-b-from-50%",
          )}
          style={{
            transform: "rotateY(20deg) rotateX(40deg) rotateZ(-20deg)",
          }}
        />
      </motion.div>
    </div>
  );
};

const GoogleLogo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
};

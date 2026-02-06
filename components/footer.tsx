import Link from "next/link";
import { featurePages } from "@/data/feature-pages";

export const Footer = () => {
  const features = featurePages.map((feature) => ({
    title: feature.title,
    href: `/features/${feature.slug}`,
  }));

  const sports = [
    { title: "NFL", href: "/odds/nfl" },
    { title: "NBA", href: "/odds/nba" },
    { title: "NHL", href: "/odds/nhl" },
    { title: "MLB", href: "/odds/mlb" },
    { title: "NCAAF", href: "/odds/ncaaf" },
    { title: "NCAAB", href: "/odds/ncaab" },
  ];

  const company = [
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
    { title: "Pricing", href: "/pricing" },
    { title: "Sign In", href: "/login" },
  ];

  const legal = [
    { title: "Privacy Policy", href: "/privacy" },
    { title: "Terms of Service", href: "/terms" },
    { title: "Responsible Gaming", href: "/responsible-gaming" },
  ];

  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Main grid */}
        <div className="grid grid-cols-2 gap-8 py-12 sm:py-16 md:grid-cols-4 lg:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2 mb-4 lg:mb-0">
            <span className="text-xl font-bold text-white">Unjuiced</span>
            <p className="mt-3 max-w-xs text-sm text-white/50">
              Real-time odds comparison and tools built to help you bet smarter.
            </p>
            <Link
              href="/register"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              Get Started
            </Link>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Features
            </p>
            {features.map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                {item.title}
              </Link>
            ))}
          </div>

          {/* Sports */}
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Sports
            </p>
            {sports.map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                {item.title}
              </Link>
            ))}
          </div>

          {/* Company */}
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Company
            </p>
            {company.map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                {item.title}
              </Link>
            ))}
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Legal
            </p>
            {legal.map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="text-sm text-white/50 transition-colors hover:text-white"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} Unjuiced
            </p>
            <div className="flex flex-col gap-1.5 text-center md:text-right">
              <p className="max-w-md text-xs text-white/30">
                For entertainment purposes only. Unjuiced does not accept or
                facilitate bets.
              </p>
              <p className="max-w-md text-xs text-white/30">
                Please gamble responsibly. If you or someone you know has a
                gambling problem, call 1-800-GAMBLER.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="https://x.com/UnjuicedApp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 transition-colors hover:text-white"
                aria-label="X"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

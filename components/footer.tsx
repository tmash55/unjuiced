import Link from "next/link";
import { ButtonLink } from "./button-link";
import { Container } from "./container";
import { Droplet } from "lucide-react";
import { SubHeading } from "./subheading";

export const Footer = () => {
  const features = [
    {
      title: "Arbitrage Finder",
      href: "/arbitrage",
    },
    {
      title: "Odds Screen",
      href: "/odds/nfl",
    },
    {
      title: "Live Updates",
      href: "/pricing",
    },
    {
      title: "Pricing",
      href: "/pricing",
    },
  ];

  const sports = [
    {
      title: "NFL",
      href: "/odds/nfl",
    },
    {
      title: "NBA",
      href: "/odds/nba",
    },
    {
      title: "NHL",
      href: "/odds/nhl",
    },
    {
      title: "MLB",
      href: "/odds/mlb",
    },
    {
      title: "NCAAF",
      href: "/odds/ncaaf",
    },
    {
      title: "NCAAB",
      href: "/odds/ncaab",
    },
  ];

  const company = [
    {
      title: "About",
      href: "/about",
    },
    {
      title: "Contact",
      href: "/contact",
    },
    {
      title: "Sign In",
      href: "/login",
    },
    {
      title: "Sign Up",
      href: "/register",
    },
  ];

  const legal = [
    {
      title: "Privacy Policy",
      href: "/privacy",
    },
    {
      title: "Terms of Service",
      href: "/terms",
    },
   
    {
      title: "Responsible Gaming",
      href: "/responsible-gaming",
    },
  ];
  return (
    <Container>
      <div className="grid grid-cols-1 gap-8 px-4 py-20 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <div className="mb-6 sm:col-span-2 md:col-span-4 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
              <Droplet className="h-5 w-5 text-brand" />
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">Unjuiced</span>
          </div>
          <SubHeading as="p" className="mt-4 max-w-sm text-left">
            Real-time odds comparison and arbitrage opportunities across all major sportsbooks.
          </SubHeading>
          <ButtonLink href="/register" variant="primary" className="mt-6 mb-8 lg:mb-0">
            Get Started
          </ButtonLink>
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Features</p>
          {features.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link text-sm font-medium transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Sports</p>
          {sports.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link text-sm font-medium transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Company</p>
          {company.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link text-sm font-medium transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Legal</p>
          {legal.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link text-sm font-medium transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
      <div className="px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-footer-link text-sm">
            © {new Date().getFullYear()} Unjuiced
          </p>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-footer-link text-xs max-w-md">
              For entertainment purposes only. Unjuiced does not accept or facilitate bets.
            </p>
            <p className="text-footer-link text-xs max-w-md">
              Please gamble responsibly. If you or someone you know has a gambling problem, call 1-800-GAMBLER.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://twitter.com/unjuiced"
              target="_blank"
              rel="noopener noreferrer"
              className="text-footer-link transition-colors hover:text-neutral-900 dark:hover:text-white"
              aria-label="X"
            >
              {/* X Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
};


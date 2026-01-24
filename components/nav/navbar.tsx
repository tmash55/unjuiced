"use client";

import { cn } from "@/lib/utils";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, SVGProps, createContext, useId, useState, useEffect } from "react";
import { buttonVariants } from "../button";

import { useScroll } from "@/hooks/use-scroll";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { NavWordmark } from "@/components/nav-wordmark";
import { ProductContent } from "@/components/nav/content/tools-content";
import { StatsContent } from "@/components/nav/content/stats-content";
import { ResourcesContent } from "@/components/nav/content/resources-content";
import { CheatSheetsContent } from "@/components/nav/content/cheatsheets-content";
import { TOOLS } from "@/lib/tools";
import { STATS } from "@/lib/stats";
import { RESOURCES } from "@/lib/resources";
import { createHref } from "./content/shared";
import { ModeToggle } from "@/components/mode-toggle";
import { Menu, X, Moon, Sun, Monitor, ArrowRight } from "lucide-react";
import { FavoritesModal } from "@/components/nav/favorites-modal";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountDropdown } from "./account-dropdown";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useMobileNav } from "@/contexts/mobile-nav-context";

// Hook to get app subdomain URL for auth routes with proper hydration handling
function useAppAuthUrls() {
  const [urls, setUrls] = useState({
    login: "/login",
    register: "/register",
  });
  
  useEffect(() => {
    const host = window.location.host;
    const isLocal = host.includes('localhost');
    
    if (isLocal) {
      const port = host.split(':')[1] || '3000';
      const baseUrl = `http://app.localhost:${port}`;
      setUrls({
        login: `${baseUrl}/login`,
        register: `${baseUrl}/register`,
      });
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.unjuiced.bet';
      const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
      setUrls({
        login: `${baseUrl}/login`,
        register: `${baseUrl}/register`,
      });
    }
  }, []);
  
  return urls;
}

// Helper to get app subdomain URL for auth routes (legacy, prefer hook)
function getAppAuthUrl(path: string): string {
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    const isLocal = host.includes('localhost');
    
    if (isLocal) {
      const port = host.split(':')[1] || '3000';
      return `http://app.localhost:${port}${path}`;
    }
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    return `${baseUrl}${path}`;
  }
  
  return `https://app.unjuiced.bet${path}`;
}


export type NavTheme = "light" | "dark";

export const NavContext = createContext<{ theme: NavTheme }>({
  theme: "light",
});

export const navItems = [
  {
    name: "Cheat Sheets",
    content: CheatSheetsContent,
    childItems: [],
    segments: [
      "/cheatsheets",
    ],
  },
  {
    name: "Stats",
    content: StatsContent,
    childItems: STATS,
    segments: [
      "/stats/nba",
      "/stats/nba/king-of-the-court",
      "/stats/nba/defense-vs-position",
      "/stats/nfl",
      "/stats/props",
    ],
  },
  {
    name: "Resources",
    content: ResourcesContent,
    childItems: RESOURCES,
    segments: [
      "/help",
      "/docs",
      "/about",
      "/careers",
      "/brand",
      "/blog",
      "/changelog",
      "/contact",
    ],
  },
  {
    name: "Pricing",
    href: "/pricing",
    segments: ["/pricing"],
  },
];

const navItemClassName = cn(
  "relative group/item flex items-center rounded-md px-4 py-2 text-sm rounded-lg font-medium text-neutral-700 hover:text-neutral-900 transition-colors",
  "dark:text-white/90 dark:hover:text-white",
  "hover:bg-neutral-900/5 dark:hover:bg-white/10",
  "data-[active=true]:bg-neutral-900/5 dark:data-[active=true]:bg-white/10",

  // Hide active state when another item is hovered
  "group-has-[:hover]:data-[active=true]:[&:not(:hover)]:bg-transparent",
);

export function Nav({
  theme = "light",
  staticDomain,
  maxWidthWrapperClassName,
}: {
  theme?: NavTheme;
  staticDomain?: string;
  maxWidthWrapperClassName?: string;
}) {
  const domain = staticDomain ?? "notalus.ai";

  const layoutGroupId = useId();

  const scrolled = useScroll(40);
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { data: entitlements } = useEntitlements();
  const authUrls = useAppAuthUrls();

  // Hide pricing if user has Pro via subscription or grant (still show during trial to encourage upgrade)
  const showPricing =
    !entitlements ||
    (entitlements.entitlement_source !== 'subscription' &&
     entitlements.entitlement_source !== 'grant');

  const filteredNavItems = navItems.filter(item => 
    item.name !== 'Pricing' || showPricing
  );

  return (
    <NavContext.Provider value={{ theme }}>
      <LayoutGroup id={layoutGroupId}>
        <div
          className={cn(
            `sticky inset-x-0 top-0 z-50 w-full transition-all`,
            theme === "dark" && "dark",
          )}
        >
          {/* Scrolled background */}
          <div
            className={cn(
              "absolute inset-0 block border-b bg-white dark:bg-black transition-all",
              scrolled
                ? "border-neutral-100 backdrop-blur-lg dark:border-white/10"
                : "border-transparent",
            )}
          />
          <MaxWidthWrapper className={cn("relative", maxWidthWrapperClassName)}>
            <div className="flex h-14 items-center justify-between">
              <div className="flex grow basis-0 items-center">
                <Link
                  className="flex items-center w-fit py-2 pr-2"
                  href="/"
                >
                  <NavWordmark />
                </Link>
              </div>
              <NavigationMenuPrimitive.Root
                delayDuration={0}
                className="relative hidden lg:block"
              >
                <NavigationMenuPrimitive.List className="group relative z-0 flex">
                  {filteredNavItems.map(
                    ({ name, href, segments, content: Content }) => {
                      const isActive = segments.some((segment) =>
                        pathname?.startsWith(segment),
                      );
                      return (
                        <NavigationMenuPrimitive.Item key={name}>
                          <WithTrigger trigger={!!Content}>
                            {href !== undefined ? (
                              <Link
                                id={`nav-${href}`}
                                href={createHref(href, domain, {
                                  utm_source: "Custom Domain",
                                  utm_medium: "Navbar",
                                  utm_campaign: domain,
                                  utm_content: name,
                                })}
                                className={navItemClassName}
                                data-active={isActive}
                              >
                                {name}
                              </Link>
                            ) : (
                              <button
                                className={navItemClassName}
                                data-active={isActive}
                              >
                                {name}
                                <AnimatedChevron className="ml-1.5 size-2.5 text-neutral-700" />
                              </button>
                            )}
                          </WithTrigger>

                          {Content && (
                            <NavigationMenuPrimitive.Content className="data-[motion=from-start]:animate-enter-from-left data-[motion=from-end]:animate-enter-from-right data-[motion=to-start]:animate-exit-to-left data-[motion=to-end]:animate-exit-to-right absolute left-0 top-0">
                              <Content domain={domain} />
                            </NavigationMenuPrimitive.Content>
                          )}
                        </NavigationMenuPrimitive.Item>
                      );
                    },
                  )}
                </NavigationMenuPrimitive.List>

                <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 z-[60]">
                  <NavigationMenuPrimitive.Viewport
                    className={cn(
                      "relative flex origin-[top_center] justify-start overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-md dark:border-white/[0.15] dark:bg-black",
                      "data-[state=closed]:animate-scale-out-content data-[state=open]:animate-scale-in-content",
                      "h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] transition-[width,height]",
                    )}
                  />
                </div>
              </NavigationMenuPrimitive.Root>

              <div className="hidden grow basis-0 justify-end gap-3 lg:flex items-center">
                {!loading && (
                  <>
                    {user ? (
                      <>
                        <FavoritesModal />
                        <AccountDropdown user={user} />
                      </>
                    ) : (
                      <>
                        {/* Login - plain text link, less focal */}
                        <a
                          href={authUrls.login}
                          className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors dark:text-neutral-300 dark:hover:text-white"
                        >
                          Login
                        </a>
                        {/* Sign up for free - prominent blue button */}
                        <a
                          href={authUrls.register}
                          className={cn(
                            "flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all",
                            "bg-[#0EA5E9] text-white hover:bg-[#0284C7]",
                            "shadow-sm hover:shadow-md",
                            "dark:bg-[#38BDF8] dark:text-[#07131A] dark:hover:bg-[#7DD3FC]",
                          )}
                        >
                          Sign up for free
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Mobile Menu Button */}
              <MobileNav domain={domain} />
            </div>
          </MaxWidthWrapper>
        </div>
      </LayoutGroup>
    </NavContext.Provider>
  );
}

function AnimatedChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="9"
      height="9"
      fill="none"
      viewBox="0 0 9 9"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M7.278 3.389 4.5 6.167 1.722 3.389"
        className="transition-transform duration-150 [transform-box:view-box] [transform-origin:center] [vector-effect:non-scaling-stroke] group-data-[state=open]/item:-scale-y-100"
      />
    </svg>
  );
}

function WithTrigger({
  trigger,
  children,
}: PropsWithChildren<{ trigger: boolean }>) {
  return trigger ? (
    <NavigationMenuPrimitive.Trigger asChild>
      {children}
    </NavigationMenuPrimitive.Trigger>
  ) : (
    children
  );
}

function MobileNav({ domain }: { domain: string }) {
  const { isMenuOpen: isOpen, setIsMenuOpen: setIsOpen } = useMobileNav();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const { data: entitlements } = useEntitlements();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const authUrls = useAppAuthUrls();
  
  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide pricing if user is on an active subscription (not trial)
  const showPricing = !entitlements || entitlements.entitlement_source !== 'subscription';

  // Create grouped mobile nav items
  type MobileNavItem = { title: string; href: string; badge?: string; disabled?: boolean };
  type MobileNavGroup = { group: string; items: MobileNavItem[] };
  
  const mobileNavGroups: MobileNavGroup[] = [
    {
      group: "Cheat Sheets",
      items: [
        { title: "Hit Rate Cheat Sheet", href: "/cheatsheets/nba/hit-rates", badge: "NEW" },
        { title: "Injury Impact", href: "/cheatsheets/nba/injury-impact", badge: "NEW" },
        { title: "Alt Line Matrix", href: "/cheatsheets/nba/alt-hit-matrix", disabled: true },
      ],
    },
    {
      group: "NBA Stats",
      items: [
        { title: "King of the Court", href: "/stats/nba/king-of-the-court" },
        { title: "Defense vs Position", href: "/stats/nba/defense-vs-position", badge: "NEW" },
      ],
    },
    {
      group: "Resources",
      items: [
        { title: "Sportsbooks", href: "/sportsbooks" },
        { title: "Markets", href: "/markets" },
        { title: "Blog", href: "/blog" },
        { title: "Changelog", href: "/changelog" },
      ],
    },
    {
      group: "Company",
      items: [
        { title: "About", href: "/about" },
        { title: "Contact", href: "/contact" },
        ...(showPricing ? [{ title: "Pricing", href: "/pricing" }] : []),
      ],
    },
  ];

  return (
    <div className="flex items-center gap-2 lg:hidden">
      {user && <FavoritesModal />}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
        aria-label="Toggle menu"
      >
        <Menu className="size-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex h-full w-full flex-col overflow-hidden bg-white dark:bg-black"
          >
            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200 dark:border-white/10">
              <MaxWidthWrapper>
                <div className="flex h-14 items-center justify-between">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    className="block w-fit py-2 pr-2"
                  >
                    <NavWordmark />
                  </Link>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
                    aria-label="Close menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </MaxWidthWrapper>
            </div>

            {/* Menu Items - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <MaxWidthWrapper>
                <div className="flex flex-col py-4 space-y-6">
                {mobileNavGroups.map((group, groupIndex) => (
                  <motion.div
                    key={group.group}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2, delay: groupIndex * 0.1 }}
                  >
                    {/* Group Header */}
                    <div className="px-4 mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                        {group.group}
                      </span>
                    </div>
                    
                    {/* Group Items */}
                    <div className="space-y-0.5">
                      {group.items.map((item, itemIndex) => {
                        const isActive = pathname?.startsWith(item.href);
                        const isDisabled = item.disabled;
                        
                        if (isDisabled) {
                          return (
                            <div
                              key={item.title}
                              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                            >
                              {item.title}
                              {item.badge && (
                                <span className="rounded-full bg-neutral-300 dark:bg-neutral-700 px-2 py-0.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
                                  {item.badge}
                                </span>
                              )}
                              <span className="ml-auto text-[10px] font-medium text-neutral-400 dark:text-neutral-600">
                                Coming soon
                              </span>
                            </div>
                          );
                        }
                        
                        return (
                          <Link
                            key={item.title}
                            href={createHref(item.href, domain, {})}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
                                : "text-neutral-600 hover:bg-neutral-900/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                            )}
                          >
                            {item.title}
                            {item.badge && (
                              <span className="rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}

                {/* CTA Buttons / User Info */}
                {!loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: mobileNavGroups.length * 0.1 + 0.1 }}
                    className="mt-2 space-y-4 border-t border-neutral-200 px-4 pt-6 dark:border-white/10"
                  >
                    {user ? (
                      <>
                        {/* User Info */}
                        <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-4 shadow-sm dark:border-white/10 dark:from-neutral-900 dark:to-neutral-900/50">
                          <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {user.email}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {user.user_metadata?.full_name || "User"}
                          </div>
                        </div>
                        {/* Theme Toggle */}
                        {mounted && (
                          <div className="rounded-xl border border-neutral-200 p-3 dark:border-white/10">
                            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                              Theme
                            </div>
                            <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                              <button
                                onClick={() => setTheme("light")}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                                  theme === "light"
                                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                                )}
                              >
                                <Sun className="h-4 w-4" />
                                Light
                              </button>
                              <button
                                onClick={() => setTheme("dark")}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                                  theme === "dark"
                                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                                )}
                              >
                                <Moon className="h-4 w-4" />
                                Dark
                              </button>
                              <button
                                onClick={() => setTheme("system")}
                                className={cn(
                                  "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                                  theme === "system"
                                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                                )}
                              >
                                <Monitor className="h-4 w-4" />
                                Auto
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Settings & Sign Out Buttons */}
                        <div className="space-y-3">
                          <Link
                            href="/account/settings"
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all",
                              buttonVariants({ variant: "secondary" }),
                              "group relative w-full overflow-hidden shadow-sm hover:scale-[1.02] active:scale-[0.98]",
                            )}
                          >
                            <span className="relative z-10">Settings</span>
                          </Link>
                          <button
                            onClick={async () => {
                              setIsOpen(false);
                              await signOut();
                            }}
                            className={cn(
                              "flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all",
                              "w-full overflow-hidden shadow-sm hover:scale-[1.02] active:scale-[0.98]",
                              "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-black dark:text-red-400 dark:hover:bg-red-950/50",
                            )}
                          >
                            <span className="relative z-10">Sign out</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <a
                            href={authUrls.login}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all",
                              "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                              "dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5",
                              "w-full overflow-hidden hover:scale-[1.02] active:scale-[0.98]",
                            )}
                          >
                            <span className="relative z-10">Login</span>
                          </a>
                          <a
                            href={authUrls.register}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all",
                              "bg-[#0EA5E9] text-white hover:bg-[#0284C7]",
                              "dark:bg-[#38BDF8] dark:text-[#07131A] dark:hover:bg-[#7DD3FC]",
                              "w-full overflow-hidden shadow-lg hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
                            )}
                          >
                            <span className="relative z-10">Sign up for free</span>
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                          No credit card required
                        </p>
                      </>
                    )}
                  </motion.div>
                )}
                </div>
              </MaxWidthWrapper>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
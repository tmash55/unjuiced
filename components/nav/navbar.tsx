"use client";

import { cn } from "@/lib/utils";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, SVGProps, createContext, useId, useState } from "react";
import { buttonVariants } from "../button";

import { useScroll } from "@/hooks/use-scroll";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { NavWordmark } from "@/components/nav-wordmark";
import { ProductContent } from "@/components/nav/content/tools-content";
import { ResourcesContent } from "@/components/nav/content/resources-content";
import { TOOLS } from "@/lib/tools";
import { RESOURCES } from "@/lib/resources";
import { createHref } from "./content/shared";
import { ModeToggle } from "@/components/mode-toggle";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountDropdown } from "./account-dropdown";


export type NavTheme = "light" | "dark";

export const NavContext = createContext<{ theme: NavTheme }>({
  theme: "light",
});

export const navItems = [
  {
    name: "Tools",
    content: ProductContent,
    childItems: TOOLS,
    segments: [
      "/arbitrage",
      "/analytics",
      "/partners",
      "/integrations",
      "/compare",
      "/features",
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
              "absolute inset-0 block border-b border-transparent transition-all",
              scrolled &&
                "border-neutral-100 bg-white/75 backdrop-blur-lg dark:border-white/10 dark:bg-black/75",
            )}
          />
          <MaxWidthWrapper className={cn("relative", maxWidthWrapperClassName)}>
            <div className="flex h-14 items-center justify-between">
              <div className="grow basis-0">
                <Link
                  className="block w-fit py-2 pr-2"
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
                  {navItems.map(
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

                <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2">
                  <NavigationMenuPrimitive.Viewport
                    className={cn(
                      "relative flex origin-[top_center] justify-start overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-md dark:border-white/[0.15] dark:bg-black",
                      "data-[state=closed]:animate-scale-out-content data-[state=open]:animate-scale-in-content",
                      "h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] transition-[width,height]",
                    )}
                  />
                </div>
              </NavigationMenuPrimitive.Root>

              <div className="hidden grow basis-0 justify-end gap-2 lg:flex">
                <ModeToggle />
                {!loading && (
                  <>
                    {user ? (
                      <AccountDropdown user={user} />
                    ) : (
                      <>
                        <Link
                          href={createHref("/login", domain, { utm_content: "login" })}
                          className={cn(
                            buttonVariants({ variant: "secondary" }),
                            "flex h-8 items-center rounded-lg border px-4 text-sm",
                            "dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-neutral-900",
                          )}
                        >
                          Log in
                        </Link>
                        <Link
                          href={createHref("/register", domain, { utm_content: "signup" })}
                          className={cn(
                            buttonVariants({ variant: "primary" }),
                            "flex h-8 items-center rounded-lg border px-4 text-sm",
                            "dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-50 dark:hover:ring-white/10",
                          )}
                        >
                          Sign up
                        </Link>
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
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  // Create flat list of mobile nav items
  const mobileNavItems = [
    { title: "Arbitrage", href: "/arbitrage" },
    { title: "Odds Screen", href: "/odds/nfl" },
    { title: "Sportsbooks", href: "/sportsbooks" },
    { title: "About", href: "/about" },
    { title: "Contact", href: "/contact" },
    { title: "Blog", href: "/blog" },
    { title: "Changelog", href: "/changelog" },
    { title: "Pricing", href: "/pricing" },
  ];

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <ModeToggle />
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
            className="fixed inset-0 z-[100] h-full w-full bg-white dark:bg-black"
          >
            {/* Header */}
            <div className="border-b border-neutral-200 dark:border-white/10">
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

            {/* Menu Items */}
            <MaxWidthWrapper>
              <div className="flex flex-col py-4">
                {mobileNavItems.map((item, index) => {
                  const isActive = pathname?.startsWith(item.href);
                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Link
                        href={createHref(item.href, domain, {})}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "block rounded-lg px-4 py-3 text-base font-medium transition-colors",
                          isActive
                            ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
                            : "text-neutral-600 hover:bg-neutral-900/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                        )}
                      >
                        {item.title}
                      </Link>
                    </motion.div>
                  );
                })}

                {/* CTA Buttons / User Info */}
                {!loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: mobileNavItems.length * 0.05 }}
                    className="mt-6 flex flex-col gap-3 px-4"
                  >
                    {user ? (
                      <>
                        {/* User Info */}
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-neutral-900">
                          <div className="text-sm font-medium text-neutral-900 dark:text-white">
                            {user.email}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {user.user_metadata?.full_name || "User"}
                          </div>
                        </div>
                        {/* Sign Out Button */}
                        <button
                          onClick={async () => {
                            setIsOpen(false);
                            await signOut();
                          }}
                          className={cn(
                            buttonVariants({ variant: "secondary" }),
                            "w-full justify-center border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50",
                          )}
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={createHref("/login", domain, { utm_content: "login" })}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            buttonVariants({ variant: "secondary" }),
                            "w-full justify-center",
                          )}
                        >
                          Log in
                        </Link>
                        <Link
                          href={createHref("/register", domain, { utm_content: "signup" })}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            buttonVariants({ variant: "primary" }),
                            "w-full justify-center",
                          )}
                        >
                          Sign up
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            </MaxWidthWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { satoshi, inter } from "@/fonts/fonts";
import { ThemeProvider } from "@/context/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PreferencesProvider } from "@/context/preferences-context";
import { TooltipProvider } from "@/components/tooltip";
import { Analytics } from "@vercel/analytics/next"
import { Analytics as DubAnalytics } from '@dub/analytics/react';
import { DubDiscountBanner } from "@/components/dub-discount-banner";

import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://unjuiced.bet'),
  title: {
    default: "Unjuiced - Find the Edge. Lose the Vig.",
    template: "%s | Unjuiced"
  },
  description: "Sports betting tools for finding value. Real-time arbitrage, full odds coverage, and one-click to bet slip.",
  keywords: ["sports betting", "arbitrage", "odds comparison", "betting tools", "sportsbook", "NFL", "NBA", "NHL", "MLB", "NCAAF"],
  authors: [{ name: "Unjuiced" }],
  creator: "Unjuiced",
  publisher: "Unjuiced",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Unjuiced",
    title: "Unjuiced - Find the Edge. Lose the Vig.",
    description: "Sports betting tools for finding value. Real-time arbitrage, full odds coverage, and one-click to bet slip.",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "Unjuiced - Sports Betting Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unjuiced - Find the Edge. Lose the Vig.",
    description: "Sports betting tools for finding value. Real-time arbitrage, full odds coverage, and one-click to bet slip.",
    images: ["/banner.png"],
    creator: "@unjuiced",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${satoshi.variable} ${inter.variable} ${geistMono.variable} overflow-y-scroll`}>
      <head>
      </head>
      <body className="font-primary h-full bg-white [--pattern-fg:var(--color-charcoal-900)]/10 dark:bg-black dark:[--pattern-fg:var(--color-neutral-100)]/30">
        <DubAnalytics
          apiHost="/_proxy/dub"
          scriptProps={{
            src: "/_proxy/dub/script.js",
          }}
          domainsConfig={{
            refer: "unj.bet",
          }}
        />
        <Suspense fallback={null}>
          <DubDiscountBanner />
        </Suspense>
        <ThemeProvider attribute="class" defaultTheme="system">
          <TooltipProvider>
            <QueryProvider>
              <AuthProvider>
                <PreferencesProvider>
                  <Analytics />
                  {children}
                  <Toaster position="top-center" />
                </PreferencesProvider>
              </AuthProvider>
            </QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

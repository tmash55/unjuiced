import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { satoshi, inter } from "@/fonts/fonts";
import { ThemeProvider } from "@/context/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PreferencesProvider } from "@/context/preferences-context";
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
  title: "Unjuiced - Find the Edge. Lose the Vig.",
  description: "Sports betting tools for finding value. Real-time arbitrage, full odds coverage, and one-click to bet slip.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${satoshi.variable} ${inter.variable} ${geistMono.variable} overflow-y-scroll`}>
      <body className="font-primary h-full bg-white [--pattern-fg:var(--color-charcoal-900)]/10 dark:bg-black dark:[--pattern-fg:var(--color-neutral-100)]/30">
        <ThemeProvider attribute="class" defaultTheme="system">
          <AuthProvider>
            <PreferencesProvider>
              {children}
              <Toaster position="top-center" />
            </PreferencesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

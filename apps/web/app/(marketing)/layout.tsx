import { PublicNav } from "@/components/nav/public-navbar";
import { Footer } from "@/components/footer";
import { ReactNode } from "react";

/**
 * Marketing layout for public-facing pages (about, blog, changelog, etc.)
 * Uses the same PublicNav as the homepage for consistent navigation
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      <PublicNav />
      {children}
      <Footer />
    </main>
  );
}

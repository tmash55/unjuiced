import { PublicNav } from "@/components/nav/public-navbar";
import { Footer } from "@/components/footer";
import { DivideX } from "@/components/divide";
import { ReactNode } from "react";

/**
 * Public layout for unauthenticated users
 * Uses the public navbar (Features, Resources, Pricing, Sign In/Sign Up)
 * Used for: homepage, tool preview pages, marketing pages
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      <PublicNav />
      <DivideX />
      {children}
      <DivideX />
      <div className="hidden md:block">
        <Footer />
      </div>
    </main>
  );
}

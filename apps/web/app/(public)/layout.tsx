import { PublicNav } from "@/components/nav/public-navbar";
import { Footer } from "@/components/footer";
import { ReactNode } from "react";

/**
 * Public layout for unauthenticated users
 * Uses the public navbar (Features, Resources, Pricing, Sign In/Sign Up)
 * Used for: homepage, tool preview pages, marketing pages
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="h-full bg-black antialiased">
      <PublicNav />
      {children}
      <Footer />
    </main>
  );
}

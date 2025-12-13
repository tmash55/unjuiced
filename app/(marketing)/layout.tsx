import { Nav } from "@/components/nav/navbar";
import { Footer } from "@/components/footer";
import { DivideX } from "@/components/divide";
import { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      <Nav />
      <DivideX />
      {children}
      <div className="hidden md:block">
        <Footer />
      </div>
    </main>
  );
}

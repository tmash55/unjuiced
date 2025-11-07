import { Nav } from "@/components/nav/navbar";
import { Footer } from "@/components/footer";
import { ReactNode } from "react";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <main className="h-full bg-gradient-to-b from-neutral-50 to-neutral-100 antialiased dark:from-neutral-950 dark:to-black">
      <Nav />
      {children}
      <Footer />
    </main>
  );
}

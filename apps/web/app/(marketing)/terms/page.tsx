import { getSEOTags } from "@/lib/seo";
import TermsPageClient from "./terms-client";

export const metadata = getSEOTags({
  title: "Terms of Service | Unjuiced",
  description: "Terms of Service for Unjuiced - Sports betting odds comparison and arbitrage platform.",
  canonicalUrlRelative: "/terms",
});

export default function TermsPage() {
  return <TermsPageClient />;
}


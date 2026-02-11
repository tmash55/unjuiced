import { getSEOTags } from "@/lib/seo";
import PrivacyPageClient from "./privacy-client";

export const metadata = getSEOTags({
  title: "Privacy Policy | Unjuiced",
  description: "Privacy Policy for Unjuiced - Learn how we collect, use, and protect your personal information.",
  canonicalUrlRelative: "/privacy",
});

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}


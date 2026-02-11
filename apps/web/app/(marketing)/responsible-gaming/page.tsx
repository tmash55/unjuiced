import { getSEOTags } from "@/lib/seo";
import ResponsibleGamingPageClient from "./responsible-gaming-client";

export const metadata = getSEOTags({
  title: "Responsible Gaming | Unjuiced",
  description: "Unjuiced is committed to promoting responsible gaming. Learn about resources, tools, and support for safe betting practices.",
  canonicalUrlRelative: "/responsible-gaming",
});

export default function ResponsibleGamingPage() {
  return <ResponsibleGamingPageClient />;
}


import { Contact } from "@/components/contact";
import { FAQs } from "@/components/faqs";
import { DivideX } from "@/components/divide";
import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Contact Us | Unjuiced",
  description:
    "Get in touch with Unjuiced. Have questions about odds comparison, arbitrage detection, or our platform? We're here to help.",
});

export default function ContactPage() {
  return (
    <main>
      <DivideX />
      <Contact />
      <DivideX />
      <FAQs />
      <DivideX />
    </main>
  );
}

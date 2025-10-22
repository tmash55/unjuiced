"use client";

import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { useEffect, useState } from "react";

const sections = [
  { id: "services", label: "The Unjuiced Services" },
  { id: "ownership", label: "Data Ownership" },
  { id: "invoices", label: "Subscription Fees" },
  { id: "commissions", label: "Affiliate & Taxes" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes to These Terms" },
  { id: "warranties", label: "Warranties" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "confidentiality", label: "Confidentiality" },
  { id: "indemnification", label: "Indemnification" },
  { id: "limitation", label: "Limitation of Liability" },
  { id: "general", label: "General" },
];

export default function TermsPageClient() {
  const [activeSection, setActiveSection] = useState("services");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 140;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="h-full bg-white antialiased dark:bg-black">
      <DivideX />

      {/* Hero Section */}
      <Container className="border-divide border-x bg-neutral-50 dark:bg-neutral-900/50">
        <div className="flex flex-col items-center justify-center py-16 px-4 md:py-24">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white md:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-center text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Last updated: October 22, 2025
          </p>
        </div>
      </Container>

      <DivideX />

      {/* Main Content with Side Nav */}
      <div className="relative">
        <Container className="border-divide border-x">
          <div className="flex gap-8 py-12">
            {/* Side Navigation - Hidden on mobile */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-[140px]">
                <nav className="space-y-1">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3 px-3">
                    On this page
                  </p>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${
                        activeSection === section.id
                          ? "bg-brand/10 text-brand font-medium dark:bg-brand/20"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Content */}
            <div className="flex-1 prose prose-neutral dark:prose-invert max-w-none px-4 md:px-8">
              {/* Introduction */}
              <div className="mb-12 text-neutral-700 dark:text-neutral-300 leading-relaxed">
                <p className="mb-4">
                  Subject to these Terms of Service (this &quot;Agreement&quot;), Unjuiced (&quot;Unjuiced.com&quot;, &quot;we&quot;, &quot;us&quot; and/or &quot;our&quot;) 
                  provides access to Unjuiced&apos;s sports betting odds comparison and arbitrage platform as a service (collectively, the &quot;Services&quot;). 
                  By using or accessing the Services, you acknowledge that you have read, understand, and agree to be bound by this Agreement. 
                  We may revise the Agreement terms or any additional terms and conditions that are relevant to Unjuiced from time to time. 
                  You agree that we shall not be liable to you or to any third party for any modification of this Agreement.
                </p>
                <p className="mb-4">
                  If you are entering into this Agreement on behalf of a company, business or other legal entity, you represent that you have 
                  the authority to bind such entity to this Agreement, in which case the term &quot;you&quot; shall refer to such entity. If you do not 
                  have such authority, or if you do not agree with this Agreement, you must not accept this Agreement and may not use the Services.
                </p>
                <div className="mt-6 rounded-lg border-2 border-brand/30 bg-brand/5 p-6 dark:bg-brand/10">
                  <p className="font-semibold text-neutral-900 dark:text-white mb-3">
                    ⚠️ IMPORTANT: INFORMATIONAL AND ENTERTAINMENT PURPOSES ONLY
                  </p>
                  <p className="mb-2">
                    Unjuiced is an <strong>informational and entertainment platform only</strong>. We provide odds comparison tools and data 
                    for educational and entertainment purposes. <strong>Unjuiced does not accept, place, or facilitate any bets or wagers</strong>. 
                    We do not collect money for gambling purposes, process betting transactions, or act as a sportsbook or gambling operator.
                  </p>
                  <p>
                    All betting and wagering activities occur directly between you and third-party licensed sportsbooks. You are solely 
                    responsible for ensuring that your betting activities comply with all applicable laws in your jurisdiction.
                  </p>
                </div>
              </div>

              {/* Section 1: The Unjuiced Services */}
              <section id="services" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    1
                  </span>
                  The Unjuiced Services
                </h2>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.1 Description of Services
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Unjuiced is an <strong>informational platform</strong> that provides sports betting odds comparison and arbitrage detection tools 
                  for entertainment and educational purposes. We aggregate and display publicly available odds data from licensed third-party sportsbooks 
                  to help users compare odds and identify potential arbitrage opportunities. The Unjuiced Services consist of two primary products: 
                  <strong> Odds Comparison</strong> and <strong>Arbitrage Detection</strong> (collectively, the &quot;Products&quot;). The Products are accessible 
                  at unjuiced.com and other domains and subdomains controlled by us (collectively, &quot;the Website&quot;).
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  <strong>Odds Comparison</strong> enables users to view and compare real-time betting odds from multiple third-party sportsbooks across 
                  various sports including NFL, NBA, NHL, MLB, NCAAF, NCAAB, and WNBA. Users can filter by sport, league, market type, and sportsbook, 
                  and search for specific teams or players. This is an informational tool only.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  <strong>Arbitrage Detection</strong> allows users to identify and analyze potential arbitrage betting opportunities by comparing odds 
                  across different third-party sportsbooks. The platform calculates theoretical bet sizes and expected returns for informational purposes. 
                  This is an educational tool only and does not guarantee profits or outcomes.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-semibold">
                  IMPORTANT: Unjuiced does not accept bets, place wagers, process gambling transactions, or facilitate any betting activities. 
                  All betting occurs directly with licensed third-party sportsbooks. We are not a sportsbook, gambling operator, or betting platform.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.2 Account Access
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Users must sign up on Unjuiced, create an account (&quot;User Account&quot;), and accept these Terms of Service. You are responsible 
                  for ensuring that all access to Unjuiced occurs only through your User Account and in compliance with this Agreement. Sharing 
                  your User Account with any other person is prohibited. You are solely responsible for maintaining the confidentiality of all 
                  login credentials associated with your User Account and for all activities that occur under the account, whether authorized or not.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  You must notify Unjuiced immediately of any actual or suspected unauthorized use of your account. Unjuiced reserves the right 
                  to suspend, deactivate, or replace your User Account if it determines the account has been, or may have been, used for an 
                  unauthorized purpose.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.3 Subscription Plans and Usage Limits
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Unjuiced offers both free and paid subscription plans. Each plan has specific features and usage limits. If you exceed your 
                  applicable usage limits and do not agree to upgrade to an appropriate plan, Unjuiced reserves the right to suspend or restrict 
                  access, enforce additional limitations, or terminate your account.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Paid subscriptions automatically renew unless cancelled before the renewal date. You may cancel your subscription at any time 
                  through your account settings. Refunds are not provided for partial subscription periods.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.4 Access Suspension
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We can, at any time and at our sole discretion, without limiting any of our other rights or remedies at law or in equity 
                  under this Agreement, suspend your access to or use of Unjuiced:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>for scheduled maintenance;</li>
                  <li>due to a Force Majeure Event;</li>
                  <li>if you violate any provision of the Agreement;</li>
                  <li>to address any emergency security concerns;</li>
                  <li>if required by a governmental or regulatory authority or as a result of a change in applicable law.</li>
                </ul>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.5 Fair Use and Prohibited Activities
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You are responsible for your use of the Services. You may not use the Service for any malicious purpose, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Scraping, copying, or redistributing our odds data without permission;</li>
                  <li>Attempting to reverse engineer, decompile, or hack the platform;</li>
                  <li>Using automated bots or scripts to access the service;</li>
                  <li>Reselling or sublicensing access to the Services;</li>
                  <li>Violating any applicable laws or regulations;</li>
                  <li>Interfering with or disrupting the Services or servers.</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  We reserve the right to suspend or terminate your access to the Services if we determine, in our sole discretion, that you 
                  have violated these Terms of Service.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  1.6 No Betting Services or Financial Transactions
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  <strong>Unjuiced does not operate as a sportsbook, gambling platform, or betting service.</strong> We do not:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Accept, place, or facilitate bets or wagers of any kind;</li>
                  <li>Collect, hold, or process money for gambling purposes;</li>
                  <li>Act as an intermediary for betting transactions;</li>
                  <li>Provide betting advice or recommendations;</li>
                  <li>Guarantee profits or outcomes from any betting activities;</li>
                  <li>Have any affiliation with or control over third-party sportsbooks.</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Our platform provides informational tools for entertainment and educational purposes only. All betting decisions are made 
                  solely by you, and all betting transactions occur directly between you and licensed third-party sportsbooks. You are 
                  responsible for understanding the risks involved in sports betting and must comply with all applicable laws and regulations 
                  regarding sports betting in your jurisdiction.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  The odds data, arbitrage calculations, and other information provided on our platform are for informational purposes only 
                  and should not be considered as financial, legal, or betting advice.
                </p>
              </section>

              {/* Section 2: Data Ownership */}
              <section id="ownership" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    2
                  </span>
                  Data Ownership
                </h2>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  2.1 Privacy Policy
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  By using Unjuiced, you agree to the terms of our Privacy Policy, which is incorporated into and forms part of this Agreement.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  2.2 Your Data
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You retain ownership of any data you provide to Unjuiced, including your account information, preferences, and settings. 
                  We will not sell your personal data to third parties. We may use aggregated, anonymized data for analytics and service 
                  improvement purposes.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  2.3 Intellectual Property Rights
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You acknowledge and agree that the Services and their entire contents, features, and functionality, including but not limited 
                  to all information, software, code, text, displays, graphics, photographs, video, audio, design, presentation, selection, and 
                  arrangement, are owned by us, our licensors, or other providers of such material and are protected by United States and 
                  international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  The Unjuiced name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of 
                  Unjuiced or its affiliates or licensors. You must not use such marks without our prior written permission.
                </p>
              </section>

              {/* Section 3: Invoices */}
              <section id="invoices" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    3
                  </span>
                  Subscription Fees and Invoices
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  For paid subscriptions to access our informational tools and features, we will provide invoices for your subscription payments. 
                  Invoices are available in your account settings and will be sent to your registered email address. You are responsible for 
                  providing accurate billing information and updating it as needed.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  All subscription fees are in U.S. Dollars unless otherwise specified. You agree to pay all fees associated with your subscription 
                  plan. If payment fails, we may suspend your access to paid features until payment is received.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-semibold">
                  Note: Subscription fees are for access to our informational platform and tools only. We do not collect, hold, or process any 
                  money related to betting or gambling activities.
                </p>
              </section>

              {/* Section 4: Commissions and Taxes */}
              <section id="commissions" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    4
                  </span>
                  Affiliate Relationships and Taxes
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Unjuiced may earn affiliate commissions from third-party sportsbooks when users sign up through our referral links. These 
                  commissions are paid by the sportsbooks for referring customers and do not affect the odds or information we display. You 
                  do not pay anything additional for using our referral links.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  <strong>Important:</strong> Unjuiced does not receive, hold, or process any funds related to your betting activities. All 
                  affiliate commissions are separate business arrangements between Unjuiced and third-party sportsbooks.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  You are solely responsible for determining what, if any, taxes apply to your betting activities and for collecting, reporting, 
                  and remitting the correct taxes to the appropriate tax authorities. Unjuiced is not responsible for determining whether taxes 
                  apply to your betting activities or for collecting, reporting, or remitting any taxes arising from any betting you conduct with 
                  third-party sportsbooks.
                </p>
              </section>

              {/* Section 5: Termination */}
              <section id="termination" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    5
                  </span>
                  Termination
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You may terminate your account at any time by contacting us or through your account settings. Upon termination, your right 
                  to access and use the Services will immediately cease.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  We may terminate or suspend your account and access to the Services immediately, without prior notice or liability, for any 
                  reason, including if you breach these Terms of Service. Upon termination, we may delete your account data in accordance with 
                  our data retention policies.
                </p>
              </section>

              {/* Section 6: Changes to These Terms */}
              <section id="changes" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    6
                  </span>
                  Changes to These Terms
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We reserve the right to modify these Terms of Service at any time. If we make material changes, we will notify you by email 
                  or through a notice on the Website. Your continued use of the Services after such modifications constitutes your acceptance 
                  of the updated terms.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  It is your responsibility to review these Terms of Service periodically. If you do not agree to the modified terms, you must 
                  stop using the Services.
                </p>
              </section>

              {/* Section 7: Warranties */}
              <section id="warranties" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    7
                  </span>
                  Warranties
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You represent and warrant that:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>You have the legal capacity to enter into this Agreement;</li>
                  <li>You are at least 18 years old (or the legal gambling age in your jurisdiction);</li>
                  <li>You will comply with all applicable laws and regulations;</li>
                  <li>All information you provide is accurate and complete;</li>
                  <li>You will not use the Services for any illegal or unauthorized purpose.</li>
                </ul>
              </section>

              {/* Section 8: Disclaimer */}
              <section id="disclaimer" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    8
                  </span>
                  Disclaimer
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  THE SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
                  INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF 
                  PERFORMANCE.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  UNJUICED DOES NOT WARRANT THAT:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>The Services will be uninterrupted, secure, or error-free;</li>
                  <li>The odds data will be accurate, complete, or up-to-date;</li>
                  <li>Any defects or errors will be corrected;</li>
                  <li>The Services will meet your requirements or expectations;</li>
                  <li>Any arbitrage opportunities identified will result in profit.</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You acknowledge that odds can change rapidly and that sportsbooks may limit or restrict your account. Unjuiced is not 
                  responsible for any losses resulting from odds changes, account limitations, or other factors beyond our control.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-semibold">
                  UNJUICED IS AN INFORMATIONAL PLATFORM ONLY. We do not accept bets, place wagers, or process any gambling transactions. 
                  All betting activities occur directly between you and licensed third-party sportsbooks.
                </p>
              </section>

              {/* Section 9: Confidentiality */}
              <section id="confidentiality" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    9
                  </span>
                  Confidentiality
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You agree to keep confidential any non-public information about Unjuiced&apos;s technology, algorithms, or business practices 
                  that you may learn through your use of the Services. This obligation survives termination of this Agreement.
                </p>
              </section>

              {/* Section 10: Indemnification */}
              <section id="indemnification" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    10
                  </span>
                  Indemnification
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You agree to indemnify, defend, and hold harmless Unjuiced, its officers, directors, employees, agents, and affiliates from 
                  and against any and all claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) 
                  arising from:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Your use or misuse of the Services;</li>
                  <li>Your violation of these Terms of Service;</li>
                  <li>Your violation of any rights of another party;</li>
                  <li>Your betting activities with third-party sportsbooks or any losses incurred from such betting;</li>
                  <li>Your violation of any applicable laws or regulations;</li>
                  <li>Any claims that Unjuiced facilitated, processed, or was involved in your betting activities.</li>
                </ul>
              </section>

              {/* Section 11: Limitation of Liability */}
              <section id="limitation" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    11
                  </span>
                  Limitation of Liability
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL UNJUICED, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES 
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF 
                  PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Your access to or use of or inability to access or use the Services;</li>
                  <li>Any conduct or content of any third party on the Services;</li>
                  <li>Any content obtained from the Services;</li>
                  <li>Unauthorized access, use, or alteration of your transmissions or content;</li>
                  <li>Any betting losses or missed opportunities;</li>
                  <li>Errors or inaccuracies in odds data;</li>
                  <li>Account limitations or closures by sportsbooks.</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  IN NO EVENT SHALL UNJUICED&apos;S TOTAL LIABILITY TO YOU FOR ALL DAMAGES, LOSSES, AND CAUSES OF ACTION EXCEED THE AMOUNT YOU 
                  HAVE PAID TO UNJUICED IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
                </p>
              </section>

              {/* Section 12: General */}
              <section id="general" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    12
                  </span>
                  General
                </h2>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  12.1 Governing Law
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  These Terms of Service shall be governed by and construed in accordance with the laws of the United States, without regard 
                  to its conflict of law provisions.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  12.2 Dispute Resolution
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Any dispute arising from or relating to these Terms of Service or the Services shall be resolved through binding arbitration 
                  in accordance with the rules of the American Arbitration Association. You agree to waive any right to a jury trial or to 
                  participate in a class action.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  12.3 Severability
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  If any provision of these Terms of Service is found to be invalid or unenforceable, the remaining provisions will remain in 
                  full force and effect.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  12.4 Entire Agreement
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and Unjuiced regarding 
                  the Services and supersede all prior agreements and understandings.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  12.5 Contact Information
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Email: <a href="mailto:support@unjuiced.com" className="text-brand hover:underline">support@unjuiced.com</a>
                </p>
              </section>
            </div>
          </div>
        </Container>
      </div>

      <DivideX />
    </main>
  );
}


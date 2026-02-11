"use client";

import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { useEffect, useState } from "react";

const sections = [
  { id: "definitions", label: "Definitions" },
  { id: "collection", label: "Information Collection" },
  { id: "usage", label: "How We Use Your Data" },
  { id: "storage", label: "Data Storage & Security" },
  { id: "cookies", label: "Cookies & Tracking" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "sharing", label: "Data Sharing" },
  { id: "rights", label: "Your Rights" },
  { id: "retention", label: "Data Retention" },
  { id: "children", label: "Children's Privacy" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
];

export default function PrivacyPageClient() {
  const [activeSection, setActiveSection] = useState("definitions");

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
            Privacy Policy
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
                  Welcome to Unjuiced (the &quot;Site&quot;), operated by Unjuiced (&quot;Unjuiced&quot;, &quot;we&quot;, &quot;us&quot;, and/or &quot;our&quot;). 
                  Unjuiced provides an informational platform for comparing sports betting odds and identifying arbitrage opportunities 
                  (the &quot;Services&quot;). We value your privacy and are dedicated to protecting your personal data. This Privacy Policy covers 
                  how we collect, handle, and disclose personal data on our Platform.
                </p>
                <p className="mb-4">
                  We use your data to provide and improve our Services. By using our Services, you agree to the collection and use of 
                  information in accordance with this policy. Unless otherwise defined in this Privacy Policy, the terms used in this 
                  Privacy Policy have the same meanings as in our Terms of Service.
                </p>
                <p>
                  Our Terms of Service (&quot;Terms&quot;) govern all use of our Services and together with the Privacy Policy constitutes 
                  your agreement with us (&quot;agreement&quot;).
                </p>
              </div>

              {/* Section 1: Definitions */}
              <section id="definitions" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    1
                  </span>
                  Definitions
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Below is a list of definitions for the terms used in this Privacy Policy:
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-neutral-200 dark:border-neutral-800">
                    <thead className="bg-neutral-50 dark:bg-neutral-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-800">
                          Term
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-800">
                          Definition
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Service
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          unjuiced.bet website and related web applications operated by Unjuiced.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Personal Data
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          Data about a living individual who can be identified from those data (or from those and other information 
                          either in our possession or likely to come into our possession).
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Usage Data
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          Data collected automatically either generated by the use of Service or from Service infrastructure itself 
                          (for example, the duration of a page visit).
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Cookies
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          Small files stored on your device (computer or mobile device).
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Data Controller
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          A natural or legal person who (either alone or jointly or in common with other persons) determines the 
                          purposes for which and the manner in which any personal data are, or are to be, processed. For the purpose 
                          of this Privacy Policy, we are a Data Controller of your data.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Data Processors
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          Any natural or legal person who processes the data on behalf of the Data Controller. We may use the 
                          services of various Service Providers in order to process your data more effectively.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          Data Subject
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          Any living individual who is the subject of Personal Data.
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                          User
                        </td>
                        <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
                          The individual using our Service. The User corresponds to the Data Subject, who is the subject of Personal Data.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 2: Information Collection and Use */}
              <section id="collection" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    2
                  </span>
                  Information Collection and Use
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6">
                  We collect several different types of information for various purposes to provide and improve our Service to you.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  2.1 Personal Data
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  While using our Service, we may ask you to provide us with certain personally identifiable information that can be 
                  used to contact or identify you (&quot;Personal Data&quot;). Personally identifiable information may include, but is not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Email address</li>
                  <li>Name (if provided)</li>
                  <li>Profile information (if provided)</li>
                  <li>Payment information (processed securely through Stripe)</li>
                  <li>User preferences and settings</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may use your Personal Data to contact you with newsletters, marketing or promotional materials and other information 
                  that may be of interest to you. You may opt out of receiving any, or all, of these communications from us by following 
                  the unsubscribe link or by emailing us at <a href="mailto:privacy@unjuiced.bet" className="text-brand hover:underline">privacy@unjuiced.bet</a>.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  2.2 Usage Data
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may also collect information that your browser sends whenever you visit our Service or when you access Service by 
                  or through a mobile device (&quot;Usage Data&quot;).
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  This Usage Data may include information such as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Your computer&apos;s Internet Protocol address (IP address)</li>
                  <li>Browser type and version</li>
                  <li>The pages of our Service that you visit</li>
                  <li>The time and date of your visit</li>
                  <li>The time spent on those pages</li>
                  <li>Unique device identifiers</li>
                  <li>Other diagnostic data</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  When you access Service with a mobile device, this Usage Data may include information such as the type of mobile device 
                  you use, your mobile device unique ID, the IP address of your mobile device, your mobile operating system, the type of 
                  mobile Internet browser you use, unique device identifiers and other diagnostic data.
                </p>
              </section>

              {/* Section 3: How We Use Your Data */}
              <section id="usage" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    3
                  </span>
                  How We Use Your Data
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Unjuiced uses the collected data for various purposes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>To provide and maintain our Service</li>
                  <li>To notify you about changes to our Service</li>
                  <li>To allow you to participate in interactive features of our Service when you choose to do so</li>
                  <li>To provide customer support</li>
                  <li>To gather analysis or valuable information so that we can improve our Service</li>
                  <li>To monitor the usage of our Service</li>
                  <li>To detect, prevent and address technical issues</li>
                  <li>To provide you with news, special offers and general information about other goods, services and events which 
                      we offer that are similar to those that you have already purchased or enquired about unless you have opted not 
                      to receive such information</li>
                  <li>To process payments and manage subscriptions</li>
                  <li>To personalize your experience and save your preferences</li>
                </ul>
              </section>

              {/* Section 4: Data Storage and Security */}
              <section id="storage" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    4
                  </span>
                  Data Storage and Security
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  The security of your data is important to us, but remember that no method of transmission over the Internet or method 
                  of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, 
                  we cannot guarantee its absolute security.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We implement appropriate technical and organizational measures to protect your personal data, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Encryption of data in transit using SSL/TLS</li>
                  <li>Secure authentication using industry-standard protocols</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication requirements</li>
                  <li>Secure hosting infrastructure</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Your account is protected by a password. We encourage you to use a strong, unique password and to never share it with 
                  anyone. If you believe your account has been compromised, please contact us immediately.
                </p>
              </section>

              {/* Section 5: Cookies and Tracking Technologies */}
              <section id="cookies" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    5
                  </span>
                  Cookies and Tracking Technologies
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We use cookies and similar tracking technologies to track the activity on our Service and hold certain information.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Cookies are files with a small amount of data which may include an anonymous unique identifier. Cookies are sent to 
                  your browser from a website and stored on your device. Other tracking technologies are also used such as beacons, tags 
                  and scripts to collect and track information and to improve and analyze our Service.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  5.1 Types of Cookies We Use
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We use the following types of cookies:
                </p>

                <div className="space-y-4 mb-6">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Essential Cookies</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      These cookies are necessary for the Service to function properly. They enable core functionality such as security, 
                      authentication, and session management. Without these cookies, the Service cannot function properly.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                      Examples: Authentication tokens, session identifiers, security tokens
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Preference Cookies</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      These cookies allow us to remember choices you make when you use our Service, such as your preferred sportsbooks, 
                      filter settings, theme preferences (light/dark mode), and other customization options.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                      Examples: Theme settings, sportsbook selections, filter preferences, display options
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Analytics Cookies</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      These cookies help us understand how visitors interact with our Service by collecting and reporting information 
                      anonymously. This helps us improve our Service and user experience.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">
                      Examples: Page views, session duration, feature usage, error tracking
                    </p>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  5.2 Local Storage
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  In addition to cookies, we use browser local storage to save your preferences and settings locally on your device. 
                  This includes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>User interface preferences (theme, layout)</li>
                  <li>Filter and sort settings</li>
                  <li>Selected sportsbooks and markets</li>
                  <li>Custom view configurations</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  You can clear local storage data through your browser settings at any time. Note that clearing this data will reset 
                  your preferences to default settings.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  5.3 Managing Cookies
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not 
                  accept cookies, you may not be able to use some portions of our Service.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Most web browsers allow some control of most cookies through the browser settings. To find out more about cookies, 
                  including how to see what cookies have been set and how to manage and delete them, visit{" "}
                  <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    www.allaboutcookies.org
                  </a>.
                </p>
              </section>

              {/* Section 6: Third-Party Services */}
              <section id="third-party" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    6
                  </span>
                  Third-Party Services
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may employ third-party companies and individuals to facilitate our Service (&quot;Service Providers&quot;), provide 
                  the Service on our behalf, perform Service-related services or assist us in analyzing how our Service is used.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6">
                  These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not 
                  to disclose or use it for any other purpose. The third-party services we use include:
                </p>

                <div className="space-y-4 mb-6">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Authentication & Database</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                      We use Supabase for user authentication and data storage. Supabase processes your email address, password (encrypted), 
                      and profile information.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Privacy Policy:{" "}
                      <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        supabase.com/privacy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Payment Processing</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                      We use Stripe for payment processing. Stripe processes your payment information securely. We do not store your 
                      complete credit card information on our servers.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Privacy Policy:{" "}
                      <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        stripe.com/privacy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Email Communications</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                      We use Resend for sending transactional emails (login links, account notifications, etc.). Resend processes your 
                      email address to deliver these communications.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Privacy Policy:{" "}
                      <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        resend.com/legal/privacy-policy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <h4 className="font-semibold text-neutral-900 dark:text-white mb-2">Hosting & Infrastructure</h4>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                      Our Service is hosted on Vercel. Vercel may collect technical and usage data to provide hosting services.
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Privacy Policy:{" "}
                      <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        vercel.com/legal/privacy-policy
                      </a>
                    </p>
                  </div>
                </div>

                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed font-semibold">
                  Important: We do not share your personal data with sportsbooks. Any links to sportsbooks are for informational purposes 
                  only. If you choose to sign up with a sportsbook through our affiliate links, you will be subject to that sportsbook&apos;s 
                  privacy policy.
                </p>
              </section>

              {/* Section 7: Data Sharing and Disclosure */}
              <section id="sharing" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    7
                  </span>
                  Data Sharing and Disclosure
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We do not sell, trade, or rent your personal data to third parties. We may share your information in the following circumstances:
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  7.1 Service Providers
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may share your information with third-party service providers who perform services on our behalf, such as payment 
                  processing, data analysis, email delivery, hosting services, and customer service.
                </p>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  7.2 Legal Requirements
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may disclose your Personal Data in the good faith belief that such action is necessary to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li>Comply with a legal obligation</li>
                  <li>Protect and defend the rights or property of Unjuiced</li>
                  <li>Prevent or investigate possible wrongdoing in connection with the Service</li>
                  <li>Protect the personal safety of users of the Service or the public</li>
                  <li>Protect against legal liability</li>
                </ul>

                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mt-8 mb-4">
                  7.3 Business Transfers
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  If Unjuiced is involved in a merger, acquisition or asset sale, your Personal Data may be transferred. We will provide 
                  notice before your Personal Data is transferred and becomes subject to a different Privacy Policy.
                </p>
              </section>

              {/* Section 8: Your Rights */}
              <section id="rights" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    8
                  </span>
                  Your Data Protection Rights
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Depending on your location, you may have the following rights regarding your personal data:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-neutral-700 dark:text-neutral-300 mb-4">
                  <li><strong>The right to access</strong> – You have the right to request copies of your personal data.</li>
                  <li><strong>The right to rectification</strong> – You have the right to request that we correct any information you 
                      believe is inaccurate or complete information you believe is incomplete.</li>
                  <li><strong>The right to erasure</strong> – You have the right to request that we erase your personal data, under 
                      certain conditions.</li>
                  <li><strong>The right to restrict processing</strong> – You have the right to request that we restrict the processing 
                      of your personal data, under certain conditions.</li>
                  <li><strong>The right to object to processing</strong> – You have the right to object to our processing of your personal 
                      data, under certain conditions.</li>
                  <li><strong>The right to data portability</strong> – You have the right to request that we transfer the data that we 
                      have collected to another organization, or directly to you, under certain conditions.</li>
                </ul>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please 
                  contact us at <a href="mailto:privacy@unjuiced.bet" className="text-brand hover:underline">privacy@unjuiced.bet</a>.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  You can also update your account information and preferences directly through your account settings.
                </p>
              </section>

              {/* Section 9: Data Retention */}
              <section id="retention" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    9
                  </span>
                  Data Retention
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We will retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. 
                  We will retain and use your Personal Data to the extent necessary to comply with our legal obligations (for example, 
                  if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements 
                  and policies.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of 
                  time, except when this data is used to strengthen the security or to improve the functionality of our Service, or we are 
                  legally obligated to retain this data for longer time periods.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required 
                  to retain it for legal or regulatory purposes.
                </p>
              </section>

              {/* Section 10: Children's Privacy */}
              <section id="children" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    10
                  </span>
                  Children&apos;s Privacy
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Our Service is not intended for use by children under the age of 18 (&quot;Children&quot;). We do not knowingly collect 
                  personally identifiable information from anyone under the age of 18. If you are a parent or guardian and you are aware 
                  that your child has provided us with Personal Data, please contact us.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  If we become aware that we have collected Personal Data from children without verification of parental consent, we take 
                  steps to remove that information from our servers.
                </p>
              </section>

              {/* Section 11: Changes to This Privacy Policy */}
              <section id="changes" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    11
                  </span>
                  Changes to This Privacy Policy
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy 
                  on this page and updating the &quot;Last updated&quot; date at the top of this Privacy Policy.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective 
                  when they are posted on this page.
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  For material changes, we will provide a more prominent notice (including, for certain services, email notification of 
                  Privacy Policy changes).
                </p>
              </section>

              {/* Section 12: Contact Us */}
              <section id="contact" className="mb-16 scroll-mt-32">
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-lg font-bold">
                    12
                  </span>
                  Contact Us
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  If you have any questions about this Privacy Policy, please contact us:
                </p>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 bg-neutral-50 dark:bg-neutral-900/50">
                  
                  <p className="text-neutral-700 dark:text-neutral-300 mb-2">
                    <strong>Support:</strong>{" "}
                    <a href="mailto:support@unjuiced.bet" className="text-brand hover:underline">
                      support@unjuiced.bet
                    </a>
                  </p>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    <strong>Website:</strong>{" "}
                    <a href="https://unjuiced.bet" className="text-brand hover:underline">
                      unjuiced.bet
                    </a>
                  </p>
                </div>
              </section>
            </div>
          </div>
        </Container>
      </div>

      <DivideX />
    </main>
  );
}


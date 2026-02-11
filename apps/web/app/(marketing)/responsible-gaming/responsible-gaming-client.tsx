"use client";

import { Container } from "@/components/container";
import { DivideX } from "@/components/divide";
import { useEffect, useState } from "react";
import { AlertTriangle, Phone, Globe, Heart, Shield, Clock } from "lucide-react";

const sections = [
  { id: "commitment", label: "Our Commitment" },
  { id: "warning-signs", label: "Warning Signs" },
  { id: "resources", label: "Get Help" },
  { id: "tips", label: "Betting Tips" },
];

export default function ResponsibleGamingPageClient() {
  const [activeSection, setActiveSection] = useState("commitment");

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
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand/10 mb-6">
            <Heart className="h-8 w-8 text-brand" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white md:text-5xl text-center">
            Responsible Gaming
          </h1>
          <p className="mt-4 text-center text-neutral-600 dark:text-neutral-400 max-w-2xl">
            We&apos;re committed to promoting safe and responsible betting practices. If you or someone you know needs help, resources are available.
          </p>
        </div>
      </Container>

      <DivideX />

      {/* Emergency Help Banner */}
      <Container className="border-divide border-x">
        <div className="px-4 py-8 md:px-8">
          <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-6 dark:bg-red-500/10">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                  Need Help Now?
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 mb-4">
                  If you or someone you know has a gambling problem, help is available 24/7.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="tel:1-800-522-4700"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call 1-800-GAMBLER
                  </a>
                  <a
                    href="https://www.ncpgambling.org/chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-red-600 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    Live Chat Support
                  </a>
                </div>
              </div>
            </div>
          </div>
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
            <div className="flex-1 prose prose-neutral dark:prose-invert max-w-none px-4 md:px-8 overflow-x-hidden">
              {/* Section 1: Our Commitment */}
              <section id="commitment" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    1
                  </span>
                  <span className="break-words">Our Commitment</span>
                </h2>
                <p className="text-sm md:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4 break-words">
                  At Unjuiced, we believe that sports betting should be an enjoyable form of entertainment. We are committed to promoting 
                  responsible gaming practices and providing resources to help our users make informed decisions.
                </p>
                <p className="text-sm md:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4 break-words">
                  <strong>Important:</strong> Unjuiced is an informational platform only. We do not accept or facilitate bets. All betting 
                  activities occur directly with licensed third-party sportsbooks. We encourage you to use the responsible gaming tools 
                  provided by those sportsbooks.
                </p>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 md:p-6 bg-neutral-50 dark:bg-neutral-900/50 mt-6">
                  <h3 className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                    Our Principles
                  </h3>
                  <ul className="space-y-3 text-neutral-700 dark:text-neutral-300">
                    <li className="flex items-start gap-2 md:gap-3">
                      <Shield className="h-4 w-4 md:h-5 md:w-5 text-brand shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base break-words"><strong>Education:</strong> Providing information about responsible gaming and problem gambling</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <Shield className="h-4 w-4 md:h-5 md:w-5 text-brand shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base break-words"><strong>Prevention:</strong> Promoting awareness of warning signs and risk factors</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <Shield className="h-4 w-4 md:h-5 md:w-5 text-brand shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base break-words"><strong>Support:</strong> Connecting users with professional help and resources</span>
                    </li>
                    <li className="flex items-start gap-2 md:gap-3">
                      <Shield className="h-4 w-4 md:h-5 md:w-5 text-brand shrink-0 mt-0.5" />
                      <span className="text-sm md:text-base break-words"><strong>Age Verification:</strong> Ensuring our platform is only used by adults 18+</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Section 2: Warning Signs */}
              <section id="warning-signs" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    2
                  </span>
                  <span className="break-words">Warning Signs of Problem Gambling</span>
                </h2>
                <p className="text-sm md:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6 break-words">
                  Problem gambling can affect anyone. Recognizing the warning signs early is crucial. If you or someone you know exhibits 
                  any of these behaviors, it may be time to seek help:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3 break-words">Financial Warning Signs</h3>
                    <ul className="space-y-2 text-xs md:text-sm text-neutral-700 dark:text-neutral-300">
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Betting more money than you can afford to lose</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Borrowing money or selling possessions to gamble</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Hiding gambling losses or debts from family</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Neglecting bills or financial obligations</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3 break-words">Behavioral Warning Signs</h3>
                    <ul className="space-y-2 text-xs md:text-sm text-neutral-700 dark:text-neutral-300">
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Spending increasing amounts of time betting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Chasing losses by placing more bets</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Feeling restless or irritable when not gambling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Lying about gambling activities</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3 break-words">Emotional Warning Signs</h3>
                    <ul className="space-y-2 text-xs md:text-sm text-neutral-700 dark:text-neutral-300">
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Feeling guilty, anxious, or depressed about gambling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Using gambling to escape problems or stress</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Becoming defensive when confronted about gambling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Experiencing mood swings related to wins/losses</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 md:p-5">
                    <h3 className="text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3 break-words">Social Warning Signs</h3>
                    <ul className="space-y-2 text-xs md:text-sm text-neutral-700 dark:text-neutral-300">
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Neglecting work, school, or family responsibilities</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Isolating from friends and family</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Relationship problems due to gambling</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-brand mt-1 shrink-0">•</span>
                        <span className="break-words">Loss of interest in hobbies or activities</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 3: Get Help */}
              <section id="resources" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    4
                  </span>
                  <span className="break-words">Help & Resources</span>
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6">
                  If you or someone you know is struggling with problem gambling, help is available. These organizations provide free, 
                  confidential support:
                </p>

                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-brand/30 bg-brand/5 dark:bg-brand/10 p-6">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                      National Council on Problem Gambling
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                      24/7 confidential helpline providing crisis intervention, referrals to local treatment, and support.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="tel:1-800-522-4700"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white font-medium hover:bg-brand/90 transition-colors text-sm"
                      >
                        <Phone className="h-4 w-4" />
                        1-800-GAMBLER (1-800-522-4700)
                      </a>
                      <a
                        href="https://www.ncpgambling.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-brand text-brand font-medium hover:bg-brand/5 transition-colors text-sm"
                      >
                        <Globe className="h-4 w-4" />
                        ncpgambling.org
                      </a>
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                      Gamblers Anonymous
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                      Fellowship of men and women who share their experience, strength and hope with each other to solve their common 
                      problem and help others recover from gambling addiction.
                    </p>
                    <a
                      href="https://www.gamblersanonymous.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-brand hover:underline text-sm font-medium"
                    >
                      <Globe className="h-4 w-4" />
                      gamblersanonymous.org
                    </a>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                      SAMHSA National Helpline
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                      Substance Abuse and Mental Health Services Administration&apos;s free, confidential, 24/7 treatment referral and 
                      information service.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="tel:1-800-662-4357"
                        className="inline-flex items-center gap-2 text-brand hover:underline text-sm font-medium"
                      >
                        <Phone className="h-4 w-4" />
                        1-800-662-HELP (1-800-662-4357)
                      </a>
                      <a
                        href="https://www.samhsa.gov/find-help/national-helpline"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-brand hover:underline text-sm font-medium"
                      >
                        <Globe className="h-4 w-4" />
                        samhsa.gov
                      </a>
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                      National Suicide Prevention Lifeline
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                      If you&apos;re in crisis or having thoughts of suicide, immediate help is available.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href="tel:988"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors text-sm"
                      >
                        <Phone className="h-4 w-4" />
                        Call or Text 988
                      </a>
                      <a
                        href="https://988lifeline.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-brand hover:underline text-sm font-medium"
                      >
                        <Globe className="h-4 w-4" />
                        988lifeline.org
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5: State-by-State Resources */}
              <section id="state-resources" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    5
                  </span>
                  <span className="break-words">State-by-State Resources</span>
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6">
                  Many states offer their own problem gambling resources and helplines:
                </p>

                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
                      <thead className="bg-neutral-50 dark:bg-neutral-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                            State
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                            Helpline
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                            Website
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Arizona</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-NEXT-STEP</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://azproblemgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              azproblemgambling.org
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Colorado</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-522-4700</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.coproblemgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              coproblemgambling.org
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Illinois</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-GAMBLER</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.illinoisproblemgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              illinoisproblemgambling.org
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Indiana</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-9-WITH-IT</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.in.gov/igc" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              in.gov/igc
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Michigan</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-270-7117</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.michigan.gov/mgcb" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              michigan.gov/mgcb
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">New Jersey</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-GAMBLER</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.nj.gov/oag/ge/responsiblegaming.html" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              nj.gov/responsiblegaming
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Pennsylvania</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-800-GAMBLER</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.paproblemgambling.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              paproblemgambling.org
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">Virginia</td>
                          <td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">1-888-532-3500</td>
                          <td className="px-6 py-4 text-sm">
                            <a href="https://www.vacompulsivegambling.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                              vacompulsivegambling.org
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-4">
                  For a complete list of state resources, visit{" "}
                  <a href="https://www.ncpgambling.org/help-treatment/help-by-state/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    ncpgambling.org/help-by-state
                  </a>
                </p>
              </section>

              {/* Section 6: Responsible Betting Tips */}
              <section id="tips" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    6
                  </span>
                  <span className="break-words">Responsible Betting Tips</span>
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-6">
                  Follow these guidelines to help ensure that betting remains a fun and entertaining activity:
                </p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Set a Budget and Stick to It
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Only bet money you can afford to lose. Never use money intended for bills, rent, or other necessities. Treat betting 
                      as entertainment, not as a way to make money.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Never Chase Losses
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Accept losses as part of the game. Don&apos;t try to win back money you&apos;ve lost by placing larger or more frequent 
                      bets. This often leads to bigger losses.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Take Regular Breaks
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Don&apos;t bet continuously for long periods. Take breaks to clear your head and maintain perspective. Set time limits 
                      for your betting sessions.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Don&apos;t Bet Under the Influence
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Avoid betting when you&apos;re under the influence of alcohol or drugs. Impaired judgment can lead to poor decisions 
                      and excessive losses.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Keep Betting in Perspective
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Maintain balance in your life. Don&apos;t let betting interfere with work, family, relationships, or other important 
                      activities. If betting stops being fun, take a break.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Be Honest with Yourself
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Regularly assess your betting habits. If you find yourself thinking about betting constantly, hiding your activity, 
                      or feeling guilty, it may be time to seek help.
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                    <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="text-brand">✓</span>
                      Understand the Odds
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 pl-6">
                      Remember that the house always has an edge. There&apos;s no guaranteed way to win. Betting should be for entertainment, 
                      not as a source of income.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 7: Underage Gaming Prevention */}
              <section id="underage" className="mb-16 scroll-mt-32">
                <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6 flex items-start gap-3">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-brand/10 text-brand text-base md:text-lg font-bold shrink-0">
                    7
                  </span>
                  <span className="break-words">Underage Gaming Prevention</span>
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
                  Unjuiced is committed to preventing underage gambling. Our Service is only available to individuals who are 18 years of 
                  age or older (or the legal gambling age in your jurisdiction, whichever is higher).
                </p>

                <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                    For Parents and Guardians
                  </h3>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                    We encourage parents and guardians to take an active role in monitoring their children&apos;s online activities. Consider 
                    using parental control software to prevent access to gambling websites.
                  </p>
                  <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <li className="flex items-start gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>Talk to your children about the risks of gambling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>Monitor their internet usage and device activity</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>Keep credit cards and payment information secure</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>Use filtering software to block gambling websites</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                    Parental Control Resources
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white mb-1">Net Nanny</p>
                      <a href="https://www.netnanny.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        netnanny.com
                      </a>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white mb-1">Qustodio</p>
                      <a href="https://www.qustodio.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        qustodio.com
                      </a>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white mb-1">Bark</p>
                      <a href="https://www.bark.us" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        bark.us
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              {/* Final Note */}
              <div className="rounded-lg border-2 border-brand/30 bg-brand/5 dark:bg-brand/10 p-6 mt-12">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  Remember: Help is Available
                </h3>
                <p className="text-neutral-700 dark:text-neutral-300 mb-4">
                  If you&apos;re concerned about your gambling or someone else&apos;s, don&apos;t wait. Reach out for help today. Recovery 
                  is possible, and support is available 24/7.
                </p>
                <a
                  href="tel:1-800-522-4700"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand text-white font-medium hover:bg-brand/90 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call 1-800-GAMBLER Now
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <DivideX />
    </main>
  );
}


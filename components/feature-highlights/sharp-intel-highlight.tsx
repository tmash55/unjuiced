"use client"

import { FeatureHighlight } from "@/components/feature-highlight"

export function SharpIntelHighlight() {
  return (
    <FeatureHighlight
      badge="Elite"
      title="See What the Sharpest Bettors Are Doing — In Real Time"
      description="Sharp Intel tracks 80+ of the most profitable wallets on Polymarket. When an insider places a bet, you see it within seconds — scored, analyzed, and matched to the best legal sportsbook odds."
      ctaText="Explore Sharp Intel"
      ctaHref="/sharp-intel"
      className="bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_60%)]"
    >
      <div className="grid gap-px sm:grid-cols-3 rounded-xl overflow-hidden bg-white/[0.04]">
        {/* Stat cards */}
        {[
          {
            value: "65%",
            label: "Win Rate",
            desc: "Across consensus picks where 70%+ of insider money flows one direction",
          },
          {
            value: "+14%",
            label: "ROI",
            desc: "Return on $100 flat bets per consensus pick. Verified against resolved markets.",
          },
          {
            value: "80+",
            label: "Tracked Insiders",
            desc: "Top-50 ranked sharps and high-volume wallets from the Polymarket leaderboard",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.02] p-6 sm:p-8 text-center">
            <p className="font-mono text-3xl sm:text-4xl font-bold text-white tabular-nums">
              {stat.value}
            </p>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mt-2">
              {stat.label}
            </p>
            <p className="text-sm text-white/40 mt-2 leading-relaxed max-w-[280px] mx-auto">
              {stat.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Feature bullets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-px bg-white/[0.02] p-6 sm:p-8">
        {[
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            ),
            title: "Real-time signals",
            desc: "Bets detected within seconds of placement on Polymarket",
          },
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            title: "Best legal odds",
            desc: "15+ US sportsbooks compared — linked directly to bet slips",
          },
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
            title: "Follow & track",
            desc: "Build a personalized feed of your favorite sharps",
          },
          {
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            ),
            title: "Full transparency",
            desc: "Price charts, order fills, slippage, and complete track records",
          },
        ].map((f) => (
          <div key={f.title} className="flex gap-3">
            <div className="shrink-0 text-[color:var(--primary-weak)]">
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </FeatureHighlight>
  )
}

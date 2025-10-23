import { PageHeader } from "@/components/page-header";
import { Container } from "@/components/container";
import { getSEOTags } from "@/lib/seo";
import { DivideX } from "@/components/divide";

export const metadata = getSEOTags({
  title: "Changelog | Unjuiced",
  description:
    "All the latest updates, improvements, and fixes to Unjuiced",
});

export default function ChangelogPage() {
  return (
    <main>
      <PageHeader
        title="Changelog"
        description="All the latest updates, improvements, and fixes to Unjuiced"
        showFollowButtons={true}
        xUrl="https://twitter.com/unjuiced"
      />
      <DivideX />
      
      <Container className="border-x border-neutral-200 dark:border-neutral-800">
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-20">
          <ChangelogEmptyState />
        </div>
      </Container>
      <DivideX />
    </main>
  );
}

function ChangelogEmptyState() {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      {/* Icon container with gradient */}
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-sky-500/20 via-blue-500/20 to-indigo-500/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <svg
            className="h-10 w-10 text-sky-600 dark:text-sky-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
        Updates Coming Soon
      </h3>
      <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        We're working hard to bring you the best sports betting platform. 
        Check back soon for product updates, new features, and improvements.
      </p>

      {/* Stats */}
      <div className="flex items-center gap-6 rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">20+</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Sportsbooks</div>
        </div>
        <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">Live</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Updates</div>
        </div>
        <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900 dark:text-white">Real-time</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Odds</div>
        </div>
      </div>
    </div>
    
  );
}


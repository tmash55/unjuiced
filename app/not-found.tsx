import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60" />

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-[120px] sm:text-[160px] font-black leading-none text-neutral-200 dark:text-neutral-800 select-none">
          404
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white -mt-4 sm:-mt-6">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
      </div>

      <div className="py-6 text-center">
        <p className="text-xs text-neutral-400">
          <a href="/terms" className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Terms</a>
          {" · "}
          <a href="/privacy" className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Privacy</a>
        </p>
      </div>
    </div>
  );
}

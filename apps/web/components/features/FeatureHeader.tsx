"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function FeatureHeader({
  icon,
  eyebrow,
  title,
  description,
  cta,
  className,
}: {
  icon?: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  cta?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <h3 className="text-3xl font-medium text-neutral-900 dark:text-white sm:text-4xl">
        {title}
      </h3>
      <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">{description}</p>
      {cta && (
        <div className="mt-2">
          <Link
            href={cta.href}
            className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
          >
            {cta.label}
          </Link>
        </div>
      )}
    </div>
  );
}



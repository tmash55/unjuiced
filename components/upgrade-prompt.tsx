import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import Lock from "@/icons/lock";

interface UpgradePromptProps {
  plan: "anonymous" | "free" | "pro";
  feature: string;
  message: string;
  className?: string;
  variant?: "inline" | "card" | "banner";
}

export function UpgradePrompt({
  plan,
  feature,
  message,
  className,
  variant = "card",
}: UpgradePromptProps) {
  const isAnonymous = plan === "anonymous";
  const ctaText = isAnonymous ? "Sign up free" : "Upgrade to Pro";
  const ctaLink = isAnonymous ? "/register" : "/pricing";

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400",
          className
        )}
      >
        <Lock className="size-4" />
        <span>{message}</span>
        <Link
          href={ctaLink}
          className="font-medium text-brand hover:underline"
        >
          {ctaText} →
        </Link>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-lg border border-brand/20 bg-brand/5 p-4",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {isAnonymous ? (
            <Lock className="size-5 text-brand" />
          ) : (
            <Sparkles className="size-5 text-brand" />
          )}
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {message}
          </p>
        </div>
        <Link href={ctaLink}>
          <Button
            variant="primary"
            text={ctaText}
            icon={<ArrowRight className="size-4" />}
            className="shrink-0"
          />
        </Link>
      </div>
    );
  }

  // Card variant (default)
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900",
        className
      )}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand/10">
        {isAnonymous ? (
          <Lock className="size-6 text-brand" />
        ) : (
          <Sparkles className="size-6 text-brand" />
        )}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
        {isAnonymous ? "Unlock More Opportunities" : "Upgrade to Pro"}
      </h3>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        {message}
      </p>
      <Link href={ctaLink}>
        <Button
          variant="primary"
          text={ctaText}
          icon={<ArrowRight className="size-4" />}
          className="w-full justify-center"
        />
      </Link>
      {!isAnonymous && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Get unlimited access, faster updates, and export features
        </p>
      )}
    </div>
  );
}

/**
 * Simple locked overlay for blurred content
 */
export function LockedOverlay({
  plan,
  feature,
  message,
  className,
}: Omit<UpgradePromptProps, "variant">) {
  const isAnonymous = plan === "anonymous";
  const ctaText = isAnonymous ? "Sign up free" : "Upgrade to Pro";
  const ctaLink = isAnonymous ? "/register" : "/pricing";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-black/80",
        className
      )}
    >
      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand/10">
          <Lock className="size-6 text-brand" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
          {message}
        </h3>
        <Link href={ctaLink}>
          <Button
            variant="primary"
            text={ctaText}
            icon={<ArrowRight className="size-4" />}
            className="mt-4 w-full justify-center"
          />
        </Link>
      </div>
    </div>
  );
}


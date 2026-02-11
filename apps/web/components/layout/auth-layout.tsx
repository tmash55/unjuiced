import { ClientOnly } from "@/components/ui/client-only";
import { PropsWithChildren, Suspense } from "react";

export const AuthLayout = ({
  showTerms,
  children,
}: PropsWithChildren<{ showTerms?: "app" | "partners" }>) => {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between">
      {/* Empty div to help center main content */}
      <div className="grow basis-0">
        <div className="h-24" />
      </div>

      <ClientOnly className="relative flex w-full flex-col items-center justify-center px-4">
        <Suspense>{children}</Suspense>
      </ClientOnly>

      <div className="flex grow basis-0 flex-col justify-end">
        {showTerms && (
          <p className="px-20 py-8 text-center text-xs font-medium text-neutral-500 md:px-0">
            By continuing, you agree to Unjuiced&rsquo;s{" "}
            <a
              href={"/terms-of-service"}
              target="_blank"
              className="font-semibold text-neutral-600 hover:text-neutral-800"
            >
              {showTerms === "app" ? "Terms of Service" : "Partner Terms"}
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              className="font-semibold text-neutral-600 hover:text-neutral-800"
            >
              Privacy Policy
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

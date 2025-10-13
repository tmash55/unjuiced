import { getSEOTags } from "@/lib/seo";
import config from "@/config";
import LoginPageClient from "./page-client";
import { AuthLayout } from "@/components/layout/auth-layout";

export const metadata = getSEOTags({
  title: `Login | ${config.appName}`,
  description: `Login to ${config.appName} and access your account.`,
  canonicalUrlRelative: "/login",
});

export default function LoginPage() {
  return (
    <AuthLayout showTerms="app">
      <LoginPageClient />
    </AuthLayout>
  );
}

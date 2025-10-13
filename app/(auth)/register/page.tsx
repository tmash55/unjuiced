import { AuthLayout } from "@/components/layout/auth-layout";
import config from "@/config";
import RegisterPageClient from "./page-client";
import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: `Create your ${config.appName} account`,
  canonicalUrlRelative: "/register",
});

export default function RegisterPage() {
  return (
    <AuthLayout showTerms="app">
      <RegisterPageClient />
    </AuthLayout>
  );
}
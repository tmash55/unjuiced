import { getSEOTags } from "@/lib/seo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthLayout } from "@/components/layout/auth-layout";
import config from "@/config";

export const metadata = getSEOTags({
  title: `Reset Password | ${config.appName}`,
  canonicalUrlRelative: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <AuthLayout showTerms="app">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
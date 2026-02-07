import { redirect } from "next/navigation";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const billing = params?.billing;

  // If returning from Stripe checkout, redirect to billing section with the query param
  if (billing === "success" || billing === "cancelled") {
    redirect(`/account/settings/billing?billing=${billing}`);
  }

  redirect("/account/settings/general");
}

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { SubscriptionBanner } from "@/components/subscription-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  let restaurantName = "Solusi Saji";
  let subscriptionEndDate: string | null = null;
  if (profile.restaurant_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("restaurants")
      .select("name, subscription_end_date")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    if (data?.name) restaurantName = data.name as string;
    subscriptionEndDate = (data?.subscription_end_date as string | null) ?? null;
  }

  return (
    <>
      <NetworkStatusBanner />
      <SubscriptionBanner endDate={subscriptionEndDate} />
      <AppShell profile={profile} restaurantName={restaurantName}>{children}</AppShell>
    </>
  );
}

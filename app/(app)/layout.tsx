import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { NetworkStatusBanner } from "@/components/network-status-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  let restaurantName = "Solusi Saji";
  if (profile.restaurant_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    if (data?.name) restaurantName = data.name as string;
  }

  return (
    <>
      <NetworkStatusBanner />
      <AppShell profile={profile} restaurantName={restaurantName}>{children}</AppShell>
    </>
  );
}

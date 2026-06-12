import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NetworkStatusBanner } from "@/components/network-status-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <NetworkStatusBanner />
      <AppShell profile={profile}>{children}</AppShell>
    </>
  );
}

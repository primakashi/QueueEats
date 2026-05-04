import { redirect } from "next/navigation";
import { getProfile, homeForRole } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(homeForRole(profile.role));
}

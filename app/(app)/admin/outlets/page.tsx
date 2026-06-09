import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Outlet } from "@/lib/types";
import { OutletsManager } from "./outlets-manager";

export default async function AdminOutletsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("outlets")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Outlet"
        description="Kelola outlet permanen dan sementara. Setiap transaksi ditandai dengan outlet asal agar rekonsiliasi mudah."
      />
      <OutletsManager outlets={(data ?? []) as Outlet[]} />
    </div>
  );
}

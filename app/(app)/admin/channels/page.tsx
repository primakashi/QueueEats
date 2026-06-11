import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderChannelConfig } from "@/lib/types";
import { ChannelsManager } from "./channels-manager";

export default async function AdminChannelsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_channels")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Saluran Pesanan"
        description="Kelola saluran penerimaan pesanan yang tersedia saat membuat pesanan baru."
      />
      <ChannelsManager channels={(data ?? []) as OrderChannelConfig[]} />
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderChannelConfig } from "@/lib/types";
import { ChannelsManager } from "./channels-manager";

export default async function AdminChannelsPage() {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);
  let q = supabase.from("order_channels").select("*");
  if (rid) q = q.eq("restaurant_id", rid);
  const { data } = await q.order("sort_order", { ascending: true });

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

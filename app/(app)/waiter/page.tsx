import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { CHANNEL_PRESETS, type OrderChannelKind, type OrderWithItems } from "@/lib/types";
import { WaiterBoard } from "./waiter-board";

export default async function WaiterHome() {
  const profile = await requireRole(["waiter", "cashier", "admin", "branch_manager"]);
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const rid = getRestaurantFilter(profile);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let q = supabase
    .from("orders")
    .select("*, order_items(*)")
    .neq("status", "cancelled")
    .gte("created_at", today.toISOString());
  if (outletFilter) q = q.eq("outlet_id", outletFilter);
  else if (rid) q = q.eq("restaurant_id", rid);

  let channelsQuery = supabase.from("order_channels").select("name, kind");
  if (rid) channelsQuery = channelsQuery.eq("restaurant_id", rid);

  const [{ data }, { data: channelsRaw }] = await Promise.all([
    q.order("created_at", { ascending: false }),
    channelsQuery,
  ]);

  const orders = (data ?? []) as OrderWithItems[];

  const channelKindByName: Record<string, OrderChannelKind> = {};
  for (const c of (channelsRaw ?? []) as Array<{ name: string; kind: OrderChannelKind | null }>) {
    if (c.kind) channelKindByName[c.name.toLowerCase()] = c.kind;
  }
  for (const name of CHANNEL_PRESETS.direct) {
    channelKindByName[name.toLowerCase()] ??= "direct";
  }
  for (const name of CHANNEL_PRESETS.online) {
    channelKindByName[name.toLowerCase()] ??= "online";
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pesanan"
        description="Semua pesanan hari ini"
      />
      <WaiterBoard initialOrders={orders} channelKindByName={channelKindByName} />
    </div>
  );
}

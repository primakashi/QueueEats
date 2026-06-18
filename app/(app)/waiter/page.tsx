import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import {
  CHANNEL_PRESETS,
  type OrderChannelKind,
  type OrderWithItems,
  type OrderWorkflowMode,
} from "@/lib/types";
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

  let channelsQuery = supabase.from("order_channels").select("name, kind, requires_acceptance");
  if (rid) channelsQuery = channelsQuery.eq("restaurant_id", rid);

  const restaurantQ = rid
    ? supabase.from("restaurants").select("order_workflow").eq("id", rid).maybeSingle()
    : Promise.resolve({ data: null });

  const [{ data }, { data: channelsRaw }, restaurantRes] = await Promise.all([
    q.order("created_at", { ascending: false }),
    channelsQuery,
    restaurantQ,
  ]);

  const orders = (data ?? []) as OrderWithItems[];

  const channelKindByName: Record<string, OrderChannelKind> = {};
  const acceptanceByName: Record<string, boolean> = {};
  for (const c of (channelsRaw ?? []) as Array<{ name: string; kind: OrderChannelKind | null; requires_acceptance?: boolean }>) {
    if (c.kind) channelKindByName[c.name.toLowerCase()] = c.kind;
    if (c.requires_acceptance) acceptanceByName[c.name.toLowerCase()] = true;
  }
  for (const name of CHANNEL_PRESETS.direct) {
    channelKindByName[name.toLowerCase()] ??= "direct";
  }
  for (const name of CHANNEL_PRESETS.online) {
    channelKindByName[name.toLowerCase()] ??= "online";
  }

  const orderWorkflow: OrderWorkflowMode =
    ((restaurantRes.data as { order_workflow?: OrderWorkflowMode } | null)?.order_workflow as
      | OrderWorkflowMode
      | undefined) ?? "standard";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pesanan"
        description="Semua pesanan hari ini"
      />
      <WaiterBoard
        initialOrders={orders}
        channelKindByName={channelKindByName}
        acceptanceByChannelName={acceptanceByName}
        orderWorkflow={orderWorkflow}
      />
    </div>
  );
}

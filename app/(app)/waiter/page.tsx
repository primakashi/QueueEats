import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import type { OrderWithItems } from "@/lib/types";
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

  const { data } = await q.order("created_at", { ascending: false });

  const orders = (data ?? []) as OrderWithItems[];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pesanan"
        description="Semua pesanan hari ini"
      />
      <WaiterBoard initialOrders={orders} />
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import type { OrderWithItems, Outlet } from "@/lib/types";
import { KitchenBoard } from "./kitchen-board";

export default async function KitchenPage() {
  const profile = await requireRole(["kitchen", "admin", "branch_manager", "cashier", "waiter"]);
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const rid = getRestaurantFilter(profile);

  let ordersQ = supabase.from("orders").select("*, order_items(*)").in("status", ["accepted", "preparing", "ready"]);
  let outletsQ = supabase.from("outlets").select("id, name").eq("is_archived", false);
  if (outletFilter) { ordersQ = ordersQ.eq("outlet_id", outletFilter); outletsQ = outletsQ.eq("id", outletFilter); }
  else if (rid) { ordersQ = ordersQ.eq("restaurant_id", rid); outletsQ = outletsQ.eq("restaurant_id", rid); }

  const [{ data: ordersData }, { data: outletsData }] = await Promise.all([
    ordersQ.order("created_at", { ascending: true }),
    outletsQ.order("created_at", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dapur"
        description="Antrian pesanan diterima, diproses, dan siap diambil"
      />
      <KitchenBoard
        initialOrders={(ordersData ?? []) as OrderWithItems[]}
        outlets={(outletsData ?? []) as Pick<Outlet, "id" | "name">[]}
      />
    </div>
  );
}

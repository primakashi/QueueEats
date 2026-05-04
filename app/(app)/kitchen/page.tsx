import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { OrderWithItems } from "@/lib/types";
import { KitchenBoard } from "./kitchen-board";

export default async function KitchenPage() {
  await requireRole(["kitchen", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["pending", "preparing"])
    .order("created_at", { ascending: true });

  const initialOrders = (data ?? []) as OrderWithItems[];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Kitchen"
        description="Queue of pending and in-progress orders"
      />
      <KitchenBoard initialOrders={initialOrders} />
    </div>
  );
}

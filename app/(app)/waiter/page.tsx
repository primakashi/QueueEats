import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { OrderWithItems } from "@/lib/types";
import { WaiterBoard } from "./waiter-board";

export default async function WaiterHome() {
  await requireRole(["waiter", "cashier", "admin"]);
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .neq("status", "cancelled")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });

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

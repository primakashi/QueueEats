import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Outlet } from "@/lib/types";
import { ReconciliationBoard } from "./reconciliation-board";

export type ReconciliationOrder = {
  id: string;
  order_number: string;
  total: number;
  payment_method: string | null;
  payment_destination: string | null;
  outlet_id: string | null;
  outlet_name: string | null;
  payment_status: string;
  created_at: string;
};

export default async function ReconciliationPage() {
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();

  // Load last 30 days of paid orders + outlets
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const [{ data: ordersRaw }, { data: outletsRaw }] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, order_number, total,
        payment_method, payment_destination,
        outlet_id, payment_status, created_at,
        outlets ( name )
      `)
      .eq("payment_status", "paid")
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("outlets")
      .select("id, name")
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
  ]);

  const orders: ReconciliationOrder[] = (ordersRaw ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    order_number: o.order_number as string,
    total: o.total as number,
    payment_method: o.payment_method as string | null,
    payment_destination: o.payment_destination as string | null,
    outlet_id: o.outlet_id as string | null,
    outlet_name: (o.outlets as { name?: string } | null)?.name ?? null,
    payment_status: o.payment_status as string,
    created_at: o.created_at as string,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Rekonsiliasi"
        description="Cocokkan pendapatan tercatat dengan uang yang diterima per metode pembayaran."
      />
      <ReconciliationBoard
        orders={orders}
        outlets={(outletsRaw ?? []) as Pick<Outlet, "id" | "name">[]}
      />
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { requireRole, getOutletFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderChannelConfig, Outlet } from "@/lib/types";
import { SalesDashboard } from "./sales-dashboard";

export type SalesOrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type SalesOrder = {
  id: string;
  order_number: string;
  total: number;
  payment_method: string | null;
  payment_destination: string | null;
  order_channel: string | null;
  outlet_id: string | null;
  outlet_name: string | null;
  status: string;
  payment_status: string;
  created_at: string;
  items: SalesOrderItem[];
};

type Props = {
  searchParams: Promise<{ outlet?: string }>;
};

export default async function AdminSalesPage({ searchParams }: Props) {
  const profile = await requireRole(["admin", "owner", "finance", "branch_manager"]);
  const { outlet } = await searchParams;
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);

  let ordersQuery = supabase
    .from("orders")
    .select(`
      id,
      order_number,
      total,
      payment_method,
      payment_destination,
      order_channel,
      outlet_id,
      status,
      payment_status,
      created_at,
      outlets ( name ),
      order_items ( name_snapshot, quantity, price_snapshot )
    `)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });
  if (outletFilter) ordersQuery = ordersQuery.eq("outlet_id", outletFilter);

  const [{ data: ordersRaw }, { data: outletsRaw }, { data: channelsRaw }] = await Promise.all([
    ordersQuery,
    supabase
      .from("outlets")
      .select("id, name")
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_channels")
      .select("id, name, sort_order, is_active")
      .order("sort_order", { ascending: true }),
  ]);

  const orders: SalesOrder[] = (ordersRaw ?? []).map((o: Record<string, unknown>) => ({
    id: o.id as string,
    order_number: o.order_number as string,
    total: o.total as number,
    payment_method: o.payment_method as string | null,
    payment_destination: o.payment_destination as string | null,
    order_channel: o.order_channel as string | null,
    outlet_id: o.outlet_id as string | null,
    outlet_name: (o.outlets as { name?: string } | null)?.name ?? null,
    status: o.status as string,
    payment_status: o.payment_status as string,
    created_at: o.created_at as string,
    items: ((o.order_items as Array<{ name_snapshot: string; quantity: number; price_snapshot: number }>) ?? []).map((i) => ({
      name: i.name_snapshot,
      quantity: i.quantity,
      price: i.price_snapshot,
    })),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Penjualan"
        description="Rekap harian dengan filter outlet, channel, metode, dan Sumber Pembayaran."
      />
      <SalesDashboard
        orders={orders}
        outlets={(outletsRaw ?? []) as Pick<Outlet, "id" | "name">[]}
        channels={(channelsRaw ?? []) as OrderChannelConfig[]}
        initialOutlet={outlet}
      />
    </div>
  );
}

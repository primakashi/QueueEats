import { Fraunces, Inter, Space_Mono } from "next/font/google";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MenuCategory, MenuItem, OrderChannelConfig, Outlet } from "@/lib/types";
import { RingkasanBisnis } from "./ringkasan-bisnis";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--sales-serif" });
const inter = Inter({ subsets: ["latin"], variable: "--sales-sans" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--sales-mono" });

export type OwnerOrderItem = {
  menu_item_id: string | null;
  name: string;
  quantity: number;
  price: number;
};

export type OwnerOrder = {
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
  items: OwnerOrderItem[];
};

type Props = {
  searchParams: Promise<{ outlet?: string }>;
};

export default async function RingkasanBisnisPage({ searchParams }: Props) {
  const profile = await requireRole(["owner"]);
  await searchParams;
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const rid = getRestaurantFilter(profile);

  // 120-day window mirrors /admin/sales so cross-references stay aligned.
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
      order_items ( menu_item_id, name_snapshot, quantity, price_snapshot )
    `)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });
  if (outletFilter) ordersQuery = ordersQuery.eq("outlet_id", outletFilter);
  else if (rid) ordersQuery = ordersQuery.eq("restaurant_id", rid);

  let outletsQuery = supabase.from("outlets").select("id, name").eq("is_archived", false);
  if (rid) outletsQuery = outletsQuery.eq("restaurant_id", rid);

  let channelsQuery = supabase
    .from("order_channels")
    .select("id, name, sort_order, is_active, kind, commission_rate");
  if (rid) channelsQuery = channelsQuery.eq("restaurant_id", rid);

  let categoriesQuery = supabase.from("menu_categories").select("id, name, sort_order, created_at");
  if (rid) categoriesQuery = categoriesQuery.eq("restaurant_id", rid);

  let menuItemsQuery = supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, cost_price, image_url, is_available, sort_order, default_daily_quota, low_stock_threshold, created_at, updated_at");
  if (rid) menuItemsQuery = menuItemsQuery.eq("restaurant_id", rid);

  const [
    { data: ordersRaw },
    { data: outletsRaw },
    { data: channelsRaw },
    { data: categoriesRaw },
    { data: menuItemsRaw },
  ] = await Promise.all([
    ordersQuery,
    outletsQuery.order("created_at", { ascending: true }),
    channelsQuery.order("sort_order", { ascending: true }),
    categoriesQuery.order("sort_order", { ascending: true }),
    menuItemsQuery.order("name", { ascending: true }),
  ]);

  const orders: OwnerOrder[] = (ordersRaw ?? []).map((o: Record<string, unknown>) => ({
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
    items: ((o.order_items as Array<{ menu_item_id: string | null; name_snapshot: string; quantity: number; price_snapshot: number }>) ?? []).map((i) => ({
      menu_item_id: i.menu_item_id,
      name: i.name_snapshot,
      quantity: i.quantity,
      price: i.price_snapshot,
    })),
  }));

  return (
    <div className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}>
      <RingkasanBisnis
        orders={orders}
        outlets={(outletsRaw ?? []) as Pick<Outlet, "id" | "name">[]}
        channels={(channelsRaw ?? []) as OrderChannelConfig[]}
        categories={(categoriesRaw ?? []) as MenuCategory[]}
        menuItems={(menuItemsRaw ?? []) as MenuItem[]}
      />
    </div>
  );
}

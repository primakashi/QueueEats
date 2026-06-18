import { Fraunces, Inter, Space_Mono } from "next/font/google";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  CashMovement,
  CashierSession,
  MenuCategory,
  MenuItem,
  OrderChannelConfig,
  Outlet,
  UserRole,
} from "@/lib/types";
import { HQ_ROLES } from "@/lib/types";
import { SalesDashboard } from "./sales-dashboard";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--sales-serif" });
const inter = Inter({ subsets: ["latin"], variable: "--sales-sans" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--sales-mono" });

export type SalesOrderItem = {
  menu_item_id: string | null;
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

export type SalesCashierSession = CashierSession & {
  cash_in: number;
  cash_out: number;
  cash_sales: number;
};

type Props = {
  searchParams: Promise<{ outlet?: string }>;
};

function isOutletScoped(role: UserRole): boolean {
  return !HQ_ROLES.includes(role) && role !== "super_admin";
}

export default async function AdminSalesPage({ searchParams }: Props) {
  const profile = await requireRole(["admin", "owner", "finance", "branch_manager", "cashier", "waiter"]);
  const { outlet } = await searchParams;
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const rid = getRestaurantFilter(profile);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);
  const cutoffISO = cutoff.toISOString();
  const cutoffDate = cutoffISO.slice(0, 10);

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
    .gte("created_at", cutoffISO)
    .order("created_at", { ascending: false });
  if (outletFilter) ordersQuery = ordersQuery.eq("outlet_id", outletFilter);
  else if (rid) ordersQuery = ordersQuery.eq("restaurant_id", rid);

  let outletsQuery = supabase.from("outlets").select("id, name").eq("is_archived", false);
  if (rid) outletsQuery = outletsQuery.eq("restaurant_id", rid);

  let channelsQuery = supabase.from("order_channels").select("id, name, sort_order, is_active, kind, commission_rate");
  if (rid) channelsQuery = channelsQuery.eq("restaurant_id", rid);

  let categoriesQuery = supabase.from("menu_categories").select("id, name, sort_order, created_at");
  if (rid) categoriesQuery = categoriesQuery.eq("restaurant_id", rid);

  let menuItemsQuery = supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, image_url, is_available, sort_order, created_at, updated_at");
  if (rid) menuItemsQuery = menuItemsQuery.eq("restaurant_id", rid);

  let sessionsQuery = supabase
    .from("cashier_sessions")
    .select("*, cash_movements ( id, session_id, type, amount, created_at )")
    .gte("session_date", cutoffDate)
    .order("session_date", { ascending: false });
  if (outletFilter) sessionsQuery = sessionsQuery.eq("outlet_id", outletFilter);
  else if (rid) sessionsQuery = sessionsQuery.eq("restaurant_id", rid);

  const [
    { data: ordersRaw },
    { data: outletsRaw },
    { data: channelsRaw },
    { data: categoriesRaw },
    { data: menuItemsRaw },
    { data: sessionsRaw },
  ] = await Promise.all([
    ordersQuery,
    outletsQuery.order("created_at", { ascending: true }),
    channelsQuery.order("sort_order", { ascending: true }),
    categoriesQuery.order("sort_order", { ascending: true }),
    menuItemsQuery.order("name", { ascending: true }),
    sessionsQuery,
  ]);

  const sessionsRawTyped = (sessionsRaw ?? []) as Array<
    CashierSession & { cash_movements?: CashMovement[] | null }
  >;
  const movements: CashMovement[] = sessionsRawTyped.flatMap(
    (s) => s.cash_movements ?? [],
  );
  const sessions: CashierSession[] = sessionsRawTyped.map((s) => {
    const { cash_movements, ...rest } = s;
    void cash_movements;
    return rest;
  });

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
    items: ((o.order_items as Array<{ menu_item_id: string | null; name_snapshot: string; quantity: number; price_snapshot: number }>) ?? []).map((i) => ({
      menu_item_id: i.menu_item_id,
      name: i.name_snapshot,
      quantity: i.quantity,
      price: i.price_snapshot,
    })),
  }));

  // Build cash sales index keyed by session_date + outlet_id for fast lookup
  const cashByKey = new Map<string, number>();
  for (const o of orders) {
    if (o.payment_method !== "cash" || o.payment_status !== "paid") continue;
    const date = new Date(o.created_at).toLocaleDateString("en-CA");
    const key = `${date}|${o.outlet_id ?? ""}`;
    cashByKey.set(key, (cashByKey.get(key) ?? 0) + o.total);
  }

  const sessionsWithTotals: SalesCashierSession[] = sessions.map((s) => {
    const sessionMovements = movements.filter((m) => m.session_id === s.id);
    const cashIn = sessionMovements.filter((m) => m.type === "cash_in").reduce((sum, m) => sum + m.amount, 0);
    const cashOut = sessionMovements.filter((m) => m.type === "cash_out").reduce((sum, m) => sum + m.amount, 0);
    const cashSales = cashByKey.get(`${s.session_date}|${s.outlet_id ?? ""}`) ?? 0;
    return { ...s, cash_in: cashIn, cash_out: cashOut, cash_sales: cashSales };
  });

  const outlets = (outletsRaw ?? []) as Pick<Outlet, "id" | "name">[];
  const lockedOutletId = isOutletScoped(profile.role) ? profile.outlet_id : null;
  const lockedOutletName = lockedOutletId
    ? outlets.find((o) => o.id === lockedOutletId)?.name ?? null
    : null;

  return (
    <div className={`${fraunces.variable} ${inter.variable} ${spaceMono.variable}`}>
      <SalesDashboard
        orders={orders}
        outlets={outlets}
        channels={(channelsRaw ?? []) as OrderChannelConfig[]}
        categories={(categoriesRaw ?? []) as MenuCategory[]}
        menuItems={(menuItemsRaw ?? []) as MenuItem[]}
        sessions={sessionsWithTotals}
        initialOutlet={outlet}
        lockedOutletId={lockedOutletId}
        lockedOutletName={lockedOutletName}
      />
    </div>
  );
}

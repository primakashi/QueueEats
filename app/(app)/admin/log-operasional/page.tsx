import { PageHeader } from "@/components/page-header";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogOperasionalClient } from "./log-operasional-client";
import type { OperationalEvent } from "./types";

type Props = {
  searchParams: Promise<{ days?: string }>;
};

const DEFAULT_DAYS = 7;

export default async function LogOperasionalPage({ searchParams }: Props) {
  const profile = await requireRole(["admin", "owner", "branch_manager"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);
  const outletFilter = getOutletFilter(profile);

  const sp = await searchParams;
  const days = Math.min(60, Math.max(1, Number(sp.days ?? DEFAULT_DAYS) || DEFAULT_DAYS));
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffISO = cutoff.toISOString();
  const cutoffDate = cutoffISO.slice(0, 10);

  // Orders
  let ordersQ = supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, updated_at, created_by, cancelled_by, cancelled_at, outlet_id, table_number, customer_name")
    .gte("created_at", cutoffISO)
    .order("created_at", { ascending: false })
    .limit(500);
  if (outletFilter) ordersQ = ordersQ.eq("outlet_id", outletFilter);
  else if (rid) ordersQ = ordersQ.eq("restaurant_id", rid);

  // Cashier sessions
  let sessionsQ = supabase
    .from("cashier_sessions")
    .select("id, session_date, opened_at, closed_at, opening_cash, actual_closing_cash, opened_by, closed_by, outlet_id, status")
    .gte("session_date", cutoffDate)
    .order("opened_at", { ascending: false })
    .limit(300);
  if (outletFilter) sessionsQ = sessionsQ.eq("outlet_id", outletFilter);
  else if (rid) sessionsQ = sessionsQ.eq("restaurant_id", rid);

  // Cash movements
  let cashQ = supabase
    .from("cash_movements")
    .select("id, type, category, amount, notes, created_at, created_by, outlet_id")
    .gte("created_at", cutoffISO)
    .order("created_at", { ascending: false })
    .limit(300);
  if (outletFilter) cashQ = cashQ.eq("outlet_id", outletFilter);
  else if (rid) cashQ = cashQ.eq("restaurant_id", rid);

  // Stock movements (manual ones — sale/cancel get noisy)
  let stockQ = supabase
    .from("stock_movements")
    .select("id, change, resulting_stock, reason, notes, created_at, created_by, outlet_id, menu_item_id")
    .gte("created_at", cutoffISO)
    .in("reason", ["opening", "add", "remove", "adjust", "disable", "enable", "confirm"])
    .order("created_at", { ascending: false })
    .limit(300);
  if (outletFilter) stockQ = stockQ.eq("outlet_id", outletFilter);
  else if (rid) stockQ = stockQ.eq("restaurant_id", rid);

  const [
    { data: ordersRaw },
    { data: sessionsRaw },
    { data: cashRaw },
    { data: stockRaw },
  ] = await Promise.all([ordersQ, sessionsQ, cashQ, stockQ]);

  // Resolve names: actors + outlets + menu items
  const actorIds = new Set<string>();
  const outletIds = new Set<string>();
  const menuIds = new Set<string>();
  for (const r of (ordersRaw ?? []) as Array<Record<string, unknown>>) {
    if (r.created_by) actorIds.add(r.created_by as string);
    if (r.cancelled_by) actorIds.add(r.cancelled_by as string);
    if (r.outlet_id) outletIds.add(r.outlet_id as string);
  }
  for (const r of (sessionsRaw ?? []) as Array<Record<string, unknown>>) {
    if (r.opened_by) actorIds.add(r.opened_by as string);
    if (r.closed_by) actorIds.add(r.closed_by as string);
    if (r.outlet_id) outletIds.add(r.outlet_id as string);
  }
  for (const r of (cashRaw ?? []) as Array<Record<string, unknown>>) {
    if (r.created_by) actorIds.add(r.created_by as string);
    if (r.outlet_id) outletIds.add(r.outlet_id as string);
  }
  for (const r of (stockRaw ?? []) as Array<Record<string, unknown>>) {
    if (r.created_by) actorIds.add(r.created_by as string);
    if (r.outlet_id) outletIds.add(r.outlet_id as string);
    if (r.menu_item_id) menuIds.add(r.menu_item_id as string);
  }

  const [{ data: profilesRaw }, { data: outletsRaw }, { data: menuRaw }] = await Promise.all([
    actorIds.size > 0
      ? supabase.from("profiles").select("id, full_name").in("id", [...actorIds])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    outletIds.size > 0
      ? supabase.from("outlets").select("id, name").in("id", [...outletIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    menuIds.size > 0
      ? supabase.from("menu_items").select("id, name").in("id", [...menuIds])
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const actorById = new Map((profilesRaw ?? []).map((p) => [p.id as string, p.full_name as string]));
  const outletById = new Map((outletsRaw ?? []).map((o) => [o.id as string, o.name as string]));
  const menuById = new Map((menuRaw ?? []).map((m) => [m.id as string, m.name as string]));

  const events: OperationalEvent[] = [];

  for (const o of (ordersRaw ?? []) as Array<Record<string, unknown>>) {
    events.push({
      id: `order-${o.id}`,
      kind: "order",
      timestamp: o.created_at as string,
      actor_name: o.created_by ? actorById.get(o.created_by as string) ?? null : null,
      outlet_name: o.outlet_id ? outletById.get(o.outlet_id as string) ?? null : null,
      title: `Pesanan ${o.order_number}`,
      subtitle:
        [
          o.table_number ? `Meja ${o.table_number}` : null,
          o.customer_name ? `${o.customer_name}` : null,
          `Total Rp ${Math.round(o.total as number).toLocaleString("id-ID")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      status: o.status as string,
    });
    if (o.status === "cancelled") {
      // Prefer the explicit cancelled_at; fall back to updated_at for orders
      // cancelled before 0016 was applied.
      const cancelTs = (o.cancelled_at as string | null) ?? (o.updated_at as string | null);
      const cancelActor = o.cancelled_by
        ? actorById.get(o.cancelled_by as string) ?? null
        : null;
      if (cancelTs && cancelTs !== o.created_at) {
        events.push({
          id: `order-cancel-${o.id}`,
          kind: "order_cancel",
          timestamp: cancelTs,
          actor_name: cancelActor,
          outlet_name: o.outlet_id ? outletById.get(o.outlet_id as string) ?? null : null,
          title: `Pesanan ${o.order_number} dibatalkan`,
          subtitle: null,
          status: "cancelled",
        });
      }
    }
  }

  for (const s of (sessionsRaw ?? []) as Array<Record<string, unknown>>) {
    const opener = s.opened_by ? actorById.get(s.opened_by as string) ?? null : null;
    const outletName = s.outlet_id ? outletById.get(s.outlet_id as string) ?? null : null;
    events.push({
      id: `session-open-${s.id}`,
      kind: "session_open",
      timestamp: s.opened_at as string,
      actor_name: opener,
      outlet_name: outletName,
      title: "Sesi kasir dibuka",
      subtitle: `Modal awal Rp ${Math.round((s.opening_cash as number) ?? 0).toLocaleString("id-ID")}`,
      status: null,
    });
    if (s.closed_at && s.status === "closed") {
      const closer = s.closed_by ? actorById.get(s.closed_by as string) ?? null : null;
      events.push({
        id: `session-close-${s.id}`,
        kind: "session_close",
        timestamp: s.closed_at as string,
        actor_name: closer,
        outlet_name: outletName,
        title: "Sesi kasir ditutup",
        subtitle: s.actual_closing_cash != null
          ? `Kas akhir Rp ${Math.round(s.actual_closing_cash as number).toLocaleString("id-ID")}`
          : null,
        status: null,
      });
    }
  }

  for (const c of (cashRaw ?? []) as Array<Record<string, unknown>>) {
    events.push({
      id: `cash-${c.id}`,
      kind: c.type === "cash_in" ? "cash_in" : "cash_out",
      timestamp: c.created_at as string,
      actor_name: c.created_by ? actorById.get(c.created_by as string) ?? null : null,
      outlet_name: c.outlet_id ? outletById.get(c.outlet_id as string) ?? null : null,
      title: c.type === "cash_in" ? "Kas masuk" : "Kas keluar",
      subtitle: `Rp ${Math.round(c.amount as number).toLocaleString("id-ID")}${c.notes ? ` · ${c.notes as string}` : ""}`,
      status: null,
    });
  }

  for (const s of (stockRaw ?? []) as Array<Record<string, unknown>>) {
    const itemName = s.menu_item_id ? menuById.get(s.menu_item_id as string) ?? null : null;
    const change = s.change as number;
    events.push({
      id: `stock-${s.id}`,
      kind: "stock",
      timestamp: s.created_at as string,
      actor_name: s.created_by ? actorById.get(s.created_by as string) ?? null : null,
      outlet_name: s.outlet_id ? outletById.get(s.outlet_id as string) ?? null : null,
      title: `Stok ${itemName ?? "item"}`,
      subtitle: `${change > 0 ? "+" : ""}${change} → sisa ${s.resulting_stock}${s.notes ? ` · ${s.notes as string}` : ""}`,
      status: s.reason as string,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Log Operasional"
        description="Aktivitas kasir, dapur, dan waiter — buka/tutup sesi, pesanan, kas, stok."
      />
      <LogOperasionalClient events={events} days={days} />
    </div>
  );
}

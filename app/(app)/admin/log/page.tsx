import { PageHeader } from "@/components/page-header";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CashMovement, CashierSession } from "@/lib/types";
import { LogTabs } from "./log-tabs";
import type { AuditLog, OperationalEvent, SessionWithExtras } from "./types";

type Props = {
  searchParams: Promise<{ tab?: string; days?: string }>;
};

const OPERATIONAL_DEFAULT_DAYS = 7;

export default async function AdminLogPage({ searchParams }: Props) {
  const profile = await requireRole(["admin", "owner", "finance", "branch_manager"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);
  const outletFilter = getOutletFilter(profile);

  const days = Math.min(60, Math.max(1, Number(sp.days ?? OPERATIONAL_DEFAULT_DAYS) || OPERATIONAL_DEFAULT_DAYS));

  // ---------------- Cashier sessions (last 30 days) ----------------
  const sessionCutoff = new Date();
  sessionCutoff.setDate(sessionCutoff.getDate() - 30);
  const sessionCutoffDate = sessionCutoff.toISOString().slice(0, 10);

  let sessionsQ = supabase
    .from("cashier_sessions")
    .select(`
      *,
      outlets ( name ),
      opener:profiles!cashier_sessions_opened_by_fkey ( full_name ),
      closer:profiles!cashier_sessions_closed_by_fkey ( full_name )
    `)
    .gte("session_date", sessionCutoffDate)
    .order("session_date", { ascending: false });
  if (outletFilter) sessionsQ = sessionsQ.eq("outlet_id", outletFilter);
  else if (rid) sessionsQ = sessionsQ.eq("restaurant_id", rid);

  // ---------------- Audit logs (Perubahan) ----------------
  let staffIds: string[] = [];
  if (rid) {
    const { data: staffRows } = await supabase
      .from("profiles")
      .select("id")
      .eq("restaurant_id", rid);
    staffIds = ((staffRows ?? []) as Array<{ id: string }>).map((p) => p.id);
  }

  let auditQ = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (rid) {
    if (staffIds.length > 0) auditQ = auditQ.in("changed_by_id", staffIds);
    else auditQ = auditQ.eq("changed_by_id", "00000000-0000-0000-0000-000000000000");
  }

  // ---------------- Operational events (orders + sessions + cash + stock) ----------------
  const opCutoff = new Date();
  opCutoff.setHours(0, 0, 0, 0);
  opCutoff.setDate(opCutoff.getDate() - (days - 1));
  const opCutoffISO = opCutoff.toISOString();
  const opCutoffDate = opCutoffISO.slice(0, 10);

  let ordersQ = supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, updated_at, created_by, cancelled_by, cancelled_at, outlet_id, table_number, customer_name")
    .gte("created_at", opCutoffISO)
    .order("created_at", { ascending: false })
    .limit(500);
  if (outletFilter) ordersQ = ordersQ.eq("outlet_id", outletFilter);
  else if (rid) ordersQ = ordersQ.eq("restaurant_id", rid);

  let opSessionsQ = supabase
    .from("cashier_sessions")
    .select("id, session_date, opened_at, closed_at, opening_cash, actual_closing_cash, opened_by, closed_by, outlet_id, status")
    .gte("session_date", opCutoffDate)
    .order("opened_at", { ascending: false })
    .limit(300);
  if (outletFilter) opSessionsQ = opSessionsQ.eq("outlet_id", outletFilter);
  else if (rid) opSessionsQ = opSessionsQ.eq("restaurant_id", rid);

  let cashQ = supabase
    .from("cash_movements")
    .select("id, type, category, amount, notes, created_at, created_by, outlet_id")
    .gte("created_at", opCutoffISO)
    .order("created_at", { ascending: false })
    .limit(300);
  if (outletFilter) cashQ = cashQ.eq("outlet_id", outletFilter);
  else if (rid) cashQ = cashQ.eq("restaurant_id", rid);

  let stockQ = supabase
    .from("stock_movements")
    .select("id, change, resulting_stock, reason, notes, created_at, created_by, outlet_id, menu_item_id")
    .gte("created_at", opCutoffISO)
    .in("reason", ["opening", "add", "remove", "adjust", "disable", "enable", "confirm"])
    .order("created_at", { ascending: false })
    .limit(300);
  if (outletFilter) stockQ = stockQ.eq("outlet_id", outletFilter);
  else if (rid) stockQ = stockQ.eq("restaurant_id", rid);

  const [
    { data: sessionsRaw },
    { data: auditRaw },
    { data: ordersRaw },
    { data: opSessionsRaw },
    { data: cashRaw },
    { data: stockRaw },
  ] = await Promise.all([sessionsQ, auditQ, ordersQ, opSessionsQ, cashQ, stockQ]);

  // ---------------- Build SessionWithExtras[] (Kasir tab) ----------------
  const sessions = (sessionsRaw ?? []) as Array<Record<string, unknown>>;
  let sessionRows: SessionWithExtras[] = [];
  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id as string);
    const { data: movRaw } = await supabase
      .from("cash_movements")
      .select("session_id, type, amount")
      .in("session_id", sessionIds);
    const movements = (movRaw ?? []) as Pick<CashMovement, "session_id" | "type" | "amount">[];

    const minDate =
      (sessions.at(-1)?.session_date as string | undefined) ?? sessionCutoffDate;
    let cashSalesQ = supabase
      .from("orders")
      .select("outlet_id, total, updated_at")
      .eq("payment_method", "cash")
      .eq("payment_status", "paid")
      .gte("updated_at", `${minDate}T00:00:00.000Z`);
    if (outletFilter) cashSalesQ = cashSalesQ.eq("outlet_id", outletFilter);
    else if (rid) cashSalesQ = cashSalesQ.eq("restaurant_id", rid);
    const { data: cashOrdersRaw } = await cashSalesQ;
    const cashOrders = (cashOrdersRaw ?? []) as Array<{ outlet_id: string | null; total: number; updated_at: string }>;

    sessionRows = sessions.map((s) => {
      const sid = s.id as string;
      const outletId = s.outlet_id as string | null;
      const sessionDate = s.session_date as string;
      const sessionMovements = movements.filter((m) => m.session_id === sid);
      const cashIn = sessionMovements.filter((m) => m.type === "cash_in").reduce((sum, m) => sum + m.amount, 0);
      const cashOut = sessionMovements.filter((m) => m.type === "cash_out").reduce((sum, m) => sum + m.amount, 0);
      const cashSales = cashOrders
        .filter((o) => {
          const orderDate = o.updated_at.slice(0, 10);
          return orderDate === sessionDate && (!outletId || o.outlet_id === outletId);
        })
        .reduce((sum, o) => sum + o.total, 0);
      return {
        ...(s as unknown as CashierSession),
        outlet_name: (s.outlets as { name?: string } | null)?.name ?? null,
        opener_name: (s.opener as { full_name?: string } | null)?.full_name ?? null,
        closer_name: (s.closer as { full_name?: string } | null)?.full_name ?? null,
        cash_in: cashIn,
        cash_out: cashOut,
        cash_sales: cashSales,
      };
    });
  }

  const auditLogs = (auditRaw ?? []) as AuditLog[];

  // ---------------- Build OperationalEvent[] (Operasional tab) ----------------
  const actorIds = new Set<string>();
  const outletIds = new Set<string>();
  const menuIds = new Set<string>();
  for (const r of (ordersRaw ?? []) as Array<Record<string, unknown>>) {
    if (r.created_by) actorIds.add(r.created_by as string);
    if (r.cancelled_by) actorIds.add(r.cancelled_by as string);
    if (r.outlet_id) outletIds.add(r.outlet_id as string);
  }
  for (const r of (opSessionsRaw ?? []) as Array<Record<string, unknown>>) {
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
      subtitle: [
        o.table_number ? `Meja ${o.table_number}` : null,
        o.customer_name ? `${o.customer_name}` : null,
        `Total Rp ${Math.round(o.total as number).toLocaleString("id-ID")}`,
      ].filter(Boolean).join(" · "),
      status: o.status as string,
    });
    if (o.status === "cancelled") {
      const cancelTs = (o.cancelled_at as string | null) ?? (o.updated_at as string | null);
      const cancelActor = o.cancelled_by ? actorById.get(o.cancelled_by as string) ?? null : null;
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
  for (const s of (opSessionsRaw ?? []) as Array<Record<string, unknown>>) {
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

  const initialTab = sp.tab === "perubahan" || sp.tab === "operasional" ? sp.tab : "kasir";
  const showOutletColumn = !outletFilter;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Log"
        description="Riwayat sesi kasir, perubahan data, dan aktivitas operasional."
      />
      <LogTabs
        initialTab={initialTab}
        sessions={sessionRows}
        auditLogs={auditLogs}
        events={events}
        days={days}
        showOutletColumn={showOutletColumn}
      />
    </div>
  );
}

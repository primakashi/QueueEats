import { PageHeader } from "@/components/page-header";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CashMovement, CashierSession, Outlet } from "@/lib/types";
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

export type SessionWithMovements = CashierSession & {
  outlet_name: string | null;
  movements: Pick<CashMovement, "type" | "amount" | "category">[];
};

export default async function ReconciliationPage() {
  const profile = await requireRole(["admin", "owner", "finance", "branch_manager"]);
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const rid = getRestaurantFilter(profile);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  let ordersQuery = supabase
    .from("orders")
    .select(`
      id, order_number, total,
      payment_method, payment_destination,
      outlet_id, payment_status, created_at,
      outlets ( name )
    `)
    .eq("payment_status", "paid")
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });
  if (outletFilter) ordersQuery = ordersQuery.eq("outlet_id", outletFilter);
  else if (rid) ordersQuery = ordersQuery.eq("restaurant_id", rid);

  let sessionsQuery = supabase
    .from("cashier_sessions")
    .select(`*, outlets ( name )`)
    .gte("session_date", cutoffDate)
    .order("session_date", { ascending: false });
  if (outletFilter) sessionsQuery = sessionsQuery.eq("outlet_id", outletFilter);
  else if (rid) sessionsQuery = sessionsQuery.eq("restaurant_id", rid);

  let outletsQuery = supabase.from("outlets").select("id, name").eq("is_archived", false);
  if (rid) outletsQuery = outletsQuery.eq("restaurant_id", rid);

  const [
    { data: ordersRaw },
    { data: outletsRaw },
    { data: sessionsRaw },
  ] = await Promise.all([
    ordersQuery,
    outletsQuery.order("created_at", { ascending: true }),
    sessionsQuery,
  ]);

  // Fetch movements for all sessions
  const sessionIds = (sessionsRaw ?? []).map((s: Record<string, unknown>) => s.id as string);
  const { data: movementsRaw } = sessionIds.length
    ? await supabase
        .from("cash_movements")
        .select("session_id, type, amount, category")
        .in("session_id", sessionIds)
    : { data: [] };

  const movementsBySession = new Map<string, Pick<CashMovement, "type" | "amount" | "category">[]>();
  for (const m of (movementsRaw ?? []) as Array<Record<string, unknown>>) {
    const sid = m.session_id as string;
    const list = movementsBySession.get(sid) ?? [];
    list.push({ type: m.type as CashMovement["type"], amount: m.amount as number, category: m.category as CashMovement["category"] });
    movementsBySession.set(sid, list);
  }

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

  const sessions: SessionWithMovements[] = (sessionsRaw ?? []).map((s: Record<string, unknown>) => ({
    ...(s as unknown as CashierSession),
    outlet_name: (s.outlets as { name?: string } | null)?.name ?? null,
    movements: movementsBySession.get(s.id as string) ?? [],
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
        sessions={sessions}
      />
    </div>
  );
}

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import { formatIDR, formatTime } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
} from "@/lib/types";
import { paymentColor, statusColor } from "@/lib/status";
import { CashierRealtimeRefresher } from "./cashier-realtime";
import { OpenSessionGate } from "./components/OpenSessionModal";
import { SessionBar } from "./components/SessionBar";
import { getOpenSession, getSessionSummary } from "./session-actions";

export default async function CashierPage() {
  const profile = await requireRole(["cashier", "admin", "branch_manager", "waiter"]);
  const supabase = await createClient();
  const outletFilter = getOutletFilter(profile);
  const restaurantFilter = getRestaurantFilter(profile);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build orders query upfront so it runs in parallel with the session lookup.
  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, order_number, total, payment_method, payment_status, status, service_type, table_number, customer_name, outlet_id, created_at",
    )
    .neq("status", "cancelled")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });
  if (outletFilter) ordersQuery = ordersQuery.eq("outlet_id", outletFilter);

  const [session, { data }] = await Promise.all([
    getOpenSession(outletFilter, restaurantFilter),
    ordersQuery,
  ]);

  // sessionSummary and outletsForPicker both depend on `session` but are
  // independent of each other.
  const outletsPickerPromise: Promise<Array<{ id: string; name: string }>> =
    !session && !outletFilter && restaurantFilter
      ? (async () => {
          const { data: outletsData } = await supabase
            .from("outlets")
            .select("id, name")
            .eq("restaurant_id", restaurantFilter)
            .eq("is_archived", false)
            .order("name", { ascending: true });
          return (outletsData ?? []) as Array<{ id: string; name: string }>;
        })()
      : Promise.resolve([]);

  const [sessionSummary, outletsForPicker] = await Promise.all([
    session ? getSessionSummary(session.id) : Promise.resolve(null),
    outletsPickerPromise,
  ]);

  const all = (data ?? []) as Order[];
  const unpaid = all.filter((o) => o.payment_status !== "paid");
  const paid = all.filter((o) => o.payment_status === "paid");

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <CashierRealtimeRefresher />

      {!session && (
        <OpenSessionGate outletId={outletFilter} outlets={outletsForPicker} />
      )}

      <PageHeader
        title="Kasir"
        description="Pesanan yang menunggu pembayaran"
      />

      {session && sessionSummary && (
        <SessionBar session={session} movements={sessionSummary.movements} />
      )}

      {unpaid.length === 0 ? (
        <Card className="p-12 text-center mb-6">
          <div className="text-sm font-medium mb-1">Semua pesanan sudah terbayar!</div>
          <p className="text-sm text-muted-foreground">Tidak ada pesanan yang menunggu pembayaran.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Menunggu pembayaran
            </h2>
            <Badge variant="secondary" className="rounded-full px-1.5">
              {unpaid.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {unpaid.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none py-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pembayaran Selesai
            </span>
            <Badge variant="secondary" className="rounded-full px-1.5">{paid.length}</Badge>
          </summary>
          <div className="space-y-2 mt-2">
            {paid.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function OrderCard({ order: o }: { order: Order }) {
  return (
    <Link href={`/cashier/${o.id}`} className="block touch-manipulation">
      <Card className="p-3 gap-0 hover:border-primary active:scale-[0.99] transition-all">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{o.order_number}</span>
              <span className="text-xs text-muted-foreground truncate">
                {formatTime(o.created_at)}
                {o.service_type === "takeaway" ? " · Bungkus" : " · Dine-in"}
                {o.table_number ? ` · Meja ${o.table_number}` : ""}
                {o.customer_name ? ` · ${o.customer_name}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge className={`text-xs ${statusColor(o.status)}`}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              <Badge variant="secondary" className={`text-xs ${paymentColor(o.payment_status)}`}>
                {PAYMENT_STATUS_LABEL[o.payment_status]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold tabular-nums text-sm">{formatIDR(o.total)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatIDR, formatTime } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type Order,
} from "@/lib/types";
import { paymentColor, statusColor } from "@/lib/status";
import { CashierRealtimeRefresher } from "./cashier-realtime";

export default async function CashierPage() {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("orders")
    .select("*")
    .neq("status", "cancelled")
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });

  const all = (data ?? []) as Order[];
  const awaiting = all.filter(
    (o) => o.payment_status !== "paid" && o.status !== "cancelled",
  );
  const done = all.filter((o) => o.payment_status === "paid");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <CashierRealtimeRefresher />
      <PageHeader
        title="Kasir"
        description="Pesanan hari ini yang menunggu pembayaran"
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Menunggu pembayaran" orders={awaiting} emptyLabel="Semua sudah tertangani!" />
        <Section title="Lunas" orders={done} emptyLabel="Belum ada pesanan lunas hari ini" />
      </div>
    </div>
  );
}

function Section({
  title,
  orders,
  emptyLabel,
}: {
  title: string;
  orders: Order[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title} · {orders.length}
      </h2>
      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/cashier/${o.id}`}
              className="block touch-manipulation"
            >
              <Card className="p-4 gap-2 hover:border-primary active:scale-[0.99] transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold tabular-nums">
                      {o.order_number}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatTime(o.created_at)}
                      {o.table_number ? ` · Meja ${o.table_number}` : ""}
                      {o.customer_name ? ` · ${o.customer_name}` : ""}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Badge className={statusColor(o.status)}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={paymentColor(o.payment_status)}
                    >
                      {PAYMENT_STATUS_LABEL[o.payment_status]}
                    </Badge>
                  </div>
                  <div className="font-semibold tabular-nums">
                    {formatIDR(o.total)}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

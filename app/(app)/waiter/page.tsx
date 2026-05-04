import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { statusColor, paymentColor } from "@/lib/status";

export default async function WaiterHome() {
  const profile = await requireRole(["waiter", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const orders = (data ?? []) as Order[];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Your orders"
        description="Recent orders you've created today"
        actions={
          <Button size="lg" render={<Link href="/waiter/new" />}>
            <Plus className="h-4 w-4 mr-2" /> New order
          </Button>
        }
      />

      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="text-lg font-medium mb-2">No orders yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first order to get started.
          </p>
          <Button render={<Link href="/waiter/new" />}>
            <Plus className="h-4 w-4 mr-2" /> New order
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((o) => (
            <Card key={o.id} className="p-4 gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-lg tabular-nums">
                    {o.order_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTime(o.created_at)}
                    {o.table_number ? ` · Table ${o.table_number}` : ""}
                    {o.customer_name ? ` · ${o.customer_name}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
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
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">
                  {formatIDR(o.total)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

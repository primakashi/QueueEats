import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Plus, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default async function ConfirmationPage({ params }: Props) {
  await requireRole(["waiter", "admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!order) notFound();

  const orderTyped = order as Order;
  const itemsTyped = (items ?? []) as OrderItem[];

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Order sent</div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {orderTyped.order_number}
          </div>
          {orderTyped.table_number && (
            <div className="text-sm text-muted-foreground mt-1">
              Table {orderTyped.table_number}
              {orderTyped.customer_name ? ` · ${orderTyped.customer_name}` : ""}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2 text-left">
          {itemsTyped.map((i) => (
            <div key={i.id} className="flex justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">
                  <span className="font-medium">{i.quantity}×</span>{" "}
                  {i.name_snapshot}
                </div>
                {i.notes && (
                  <div className="text-xs text-muted-foreground truncate">
                    {i.notes}
                  </div>
                )}
              </div>
              <div className="tabular-nums">
                {formatIDR(i.price_snapshot * i.quantity)}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="font-medium">Total</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatIDR(orderTyped.total)}
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            render={<Link href="/waiter" />}
          >
            <ListOrdered className="h-4 w-4 mr-2" /> Orders
          </Button>
          <Button className="flex-1" render={<Link href="/waiter/new" />}>
            <Plus className="h-4 w-4 mr-2" /> New order
          </Button>
        </div>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatIDR, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type MenuItem,
  type Order,
  type OrderItem,
} from "@/lib/types";
import { paymentColor, statusColor } from "@/lib/status";
import { PaymentPanel } from "./payment-panel";
import { EditableOrderItems } from "./order-edit";

type Props = { params: Promise<{ orderId: string }> };

export default async function CashierOrderPage({ params }: Props) {
  await requireRole(["cashier", "admin"]);
  const { orderId } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: menuItems }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("menu_items")
        .select("id, name, price, is_available")
        .eq("is_available", true)
        .order("name"),
    ]);

  if (!order) notFound();
  const typed = order as Order;
  const itemsTyped = (items ?? []) as OrderItem[];
  const menuTyped = (menuItems ?? []) as MenuItem[];

  const isPaid = typed.payment_status === "paid";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button variant="ghost" size="sm" render={<Link href="/cashier" />}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke kasir
        </Button>
      </div>
      <PageHeader
        title={typed.order_number}
        description={`Dibuat ${formatDateTime(typed.created_at)}`}
        actions={
          <div className="flex gap-2">
            <Badge className={statusColor(typed.status)}>
              {ORDER_STATUS_LABEL[typed.status]}
            </Badge>
            <Badge variant="secondary" className={paymentColor(typed.payment_status)}>
              {PAYMENT_STATUS_LABEL[typed.payment_status]}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px]">
        <Card className="p-5 gap-0">
          <div className="grid grid-cols-2 gap-3 pb-4">
            <Field label="Meja" value={typed.table_number ?? "—"} />
            <Field label="Pelanggan" value={typed.customer_name ?? "—"} />
            <Field
              label="Tipe"
              value={typed.service_type === "takeaway" ? "Bungkus" : "Makan di tempat"}
            />
            <Field label="Channel" value={typed.order_channel ?? "—"} />
          </div>

          {isPaid ? (
            <>
              <div className="border-t py-4 space-y-2">
                {itemsTyped.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div>
                        <span className="font-semibold tabular-nums">{i.quantity}×</span>{" "}
                        {i.name_snapshot}
                      </div>
                      {i.notes && (
                        <div className="text-xs text-muted-foreground italic">{i.notes}</div>
                      )}
                    </div>
                    <div className="tabular-nums">{formatIDR(i.price_snapshot * i.quantity)}</div>
                  </div>
                ))}
              </div>
              {typed.notes && (
                <div className="border-t py-3 text-sm text-muted-foreground italic">
                  Catatan: {typed.notes}
                </div>
              )}
              <div className="border-t pt-4 space-y-1.5">
                {(typed.tax_amount > 0 || typed.service_charge_amount > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatIDR(typed.subtotal)}</span>
                    </div>
                    {typed.tax_amount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Pajak</span>
                        <span className="tabular-nums">{formatIDR(typed.tax_amount)}</span>
                      </div>
                    )}
                    {typed.service_charge_amount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Biaya layanan</span>
                        <span className="tabular-nums">{formatIDR(typed.service_charge_amount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2" />
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <span className="text-2xl font-semibold tabular-nums">{formatIDR(typed.total)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="border-t">
              <EditableOrderItems
                orderId={typed.id}
                items={itemsTyped}
                total={typed.total}
                subtotal={typed.subtotal}
                taxAmount={typed.tax_amount ?? 0}
                serviceAmount={typed.service_charge_amount ?? 0}
                menuItems={menuTyped}
              />
            </div>
          )}
        </Card>

        <div className="min-w-0">
          <PaymentPanel order={typed} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

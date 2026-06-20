import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Plus, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatIDR, formatDateTime } from "@/lib/format";
import { readWithRetry } from "@/lib/retry";
import { ORDER_CHANNEL_LABEL, type Order, type OrderChannelConfig, type OrderItem } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default async function ConfirmationPage({ params }: Props) {
  await requireRole(["waiter", "cashier", "admin", "branch_manager"]);
  const { id } = await params;
  const supabase = await createClient();

  // Order was just created elsewhere; retry once if the first read is empty
  // to dodge transient RLS / connection blips. Runs in parallel with the
  // items + channels reads so the slower path doesn't compound.
  const [orderRes, { data: items }, { data: channelsRaw }] = await Promise.all([
    readWithRetry(() =>
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    ),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("order_channels").select("id, name, kind"),
  ]);

  // Real query error — let the error boundary render a retry UI, don't 404.
  if (orderRes.error) throw new Error(orderRes.error.message);
  const order = orderRes.data;
  if (!order) notFound();

  const orderTyped = order as Order;
  const itemsTyped = (items ?? []) as OrderItem[];
  const channels = (channelsRaw ?? []) as Pick<OrderChannelConfig, "id" | "name" | "kind">[];

  const channelInfo = channels.find((c) => c.id === orderTyped.order_channel);
  const channelKind = channelInfo?.kind;
  const tipeLabel =
    channelKind === "online" ? "Online" : channelKind === "popup" ? "Pop-up" : "Langsung";
  const sourceLabel =
    channelKind === "online" || channelKind === "popup"
      ? (channelInfo?.name ?? ORDER_CHANNEL_LABEL[orderTyped.order_channel ?? ""] ?? orderTyped.order_channel ?? tipeLabel)
      : orderTyped.service_type === "takeaway"
      ? "Takeaway"
      : "Dine-in";

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Pesanan tercatat</div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {orderTyped.order_number}
          </div>
        </div>

        <div className="text-left text-sm space-y-1.5 rounded-md border bg-muted/30 p-4">
          <DetailRow label="Waktu" value={formatDateTime(orderTyped.created_at)} />
          {orderTyped.customer_name && (
            <DetailRow label="Pelanggan" value={orderTyped.customer_name} />
          )}
          <DetailRow label="Tipe pesanan" value={tipeLabel} />
          <DetailRow label="Sumber pesanan" value={sourceLabel} />
          {orderTyped.service_type === "dine_in" && orderTyped.table_number && (
            <DetailRow label="Meja" value={orderTyped.table_number} />
          )}
          {orderTyped.notes && (
            <DetailRow label="Catatan" value={orderTyped.notes} />
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
            <ListOrdered className="h-4 w-4 mr-2" /> Pesanan
          </Button>
          <Button className="flex-1" render={<Link href="/waiter/new" />}>
            <Plus className="h-4 w-4 mr-2" /> Pesanan baru
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

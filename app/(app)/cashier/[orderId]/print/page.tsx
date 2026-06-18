import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { type Order, type OrderItem } from "@/lib/types";
import { AutoPrint } from "@/components/auto-print";
import {
  ReceiptDocument,
  type ReceiptAppliedDiscount,
} from "@/components/receipt-document";

type Props = { params: Promise<{ orderId: string }> };

export default async function PrintReceiptPage({ params }: Props) {
  await requireRole(["cashier", "admin", "branch_manager", "waiter"]);
  const { orderId } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: discountsRaw }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("order_discounts")
        .select("name_snapshot, amount")
        .eq("order_id", orderId),
    ]);

  if (!order) notFound();

  return (
    <>
      <AutoPrint />
      <ReceiptDocument
        order={order as Order}
        items={(items ?? []) as OrderItem[]}
        appliedDiscounts={(discountsRaw ?? []) as ReceiptAppliedDiscount[]}
      />
    </>
  );
}

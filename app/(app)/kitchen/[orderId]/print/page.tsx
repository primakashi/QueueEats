import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { readWithRetry } from "@/lib/retry";
import type { Order, OrderItem } from "@/lib/types";
import { AutoPrint } from "@/components/auto-print";
import { KitchenTicketDocument } from "@/components/kitchen-ticket-document";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ reprint?: string }>;
};

export default async function KitchenTicketPage({ params, searchParams }: Props) {
  await requireRole(["kitchen", "admin", "branch_manager", "waiter"]);
  const { orderId } = await params;
  const { reprint } = await searchParams;
  const supabase = await createClient();

  const [orderRes, { data: items }] = await Promise.all([
    readWithRetry(() =>
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    ),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);

  if (orderRes.error) throw new Error(orderRes.error.message);
  const order = orderRes.data;
  if (!order) notFound();

  // For add-on orders, surface the parent's number + table on the ticket so
  // dapur knows which existing pesanan to attach the items to.
  let parent: { order_number: string; table_number: string | null } | null = null;
  const parentId = (order as Order).parent_order_id;
  if (parentId) {
    const { data: parentRow } = await supabase
      .from("orders")
      .select("order_number, table_number")
      .eq("id", parentId)
      .maybeSingle();
    if (parentRow) {
      parent = parentRow as { order_number: string; table_number: string | null };
    }
  }

  return (
    <>
      <AutoPrint />
      <KitchenTicketDocument
        order={order as Order}
        items={(items ?? []) as OrderItem[]}
        isReprint={reprint === "1"}
        parent={parent}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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

  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);

  if (!order) notFound();

  return (
    <>
      <AutoPrint />
      <KitchenTicketDocument
        order={order as Order}
        items={(items ?? []) as OrderItem[]}
        isReprint={reprint === "1"}
      />
    </>
  );
}

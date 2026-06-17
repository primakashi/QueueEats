"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "@/lib/types";

async function restoreStockForOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  actorId: string,
): Promise<void> {
  const { data: order } = await supabase
    .from("orders")
    .select("outlet_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.outlet_id) return;
  const { data: items } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .eq("order_id", orderId);
  if (!items || items.length === 0) return;
  const stockDate = new Date(order.created_at as string).toLocaleDateString("en-CA");
  const itemIds = (items as Array<{ menu_item_id: string | null }>).map((i) => i.menu_item_id).filter(Boolean) as string[];
  if (itemIds.length === 0) return;
  const { data: stockRows } = await supabase
    .from("daily_stock")
    .select("id, menu_item_id")
    .eq("outlet_id", order.outlet_id)
    .eq("stock_date", stockDate)
    .in("menu_item_id", itemIds);
  const stockByItem = new Map(
    ((stockRows ?? []) as Array<{ id: string; menu_item_id: string }>).map((r) => [r.menu_item_id, r.id]),
  );
  for (const it of items as Array<{ menu_item_id: string | null; quantity: number }>) {
    if (!it.menu_item_id) continue;
    const dsId = stockByItem.get(it.menu_item_id);
    if (!dsId) continue;
    await supabase.rpc("adjust_daily_stock", {
      p_daily_stock_id: dsId,
      p_change: it.quantity,
      p_reason: "cancel_restore",
      p_order_id: orderId,
      p_notes: null,
      p_actor: actorId,
    });
  }
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "ready", "completed", "cancelled"],
  preparing: ["ready", "completed", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(
  id: string,
  next: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["waiter", "kitchen", "cashier", "admin"]);

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "Pesanan tidak ditemukan" };

  if (!ALLOWED_TRANSITIONS[current.status as OrderStatus]?.includes(next)) {
    return {
      ok: false,
      error: `Tidak dapat mengubah dari ${ORDER_STATUS_LABEL[current.status as OrderStatus]} ke ${ORDER_STATUS_LABEL[next]}`,
    };
  }

  const updatePayload: Record<string, unknown> = { status: next };
  if (next === "cancelled" && current.status !== "cancelled") {
    updatePayload.cancelled_by = profile.id;
    updatePayload.cancelled_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0)
    return { ok: false, error: "Tidak dapat mengubah status — periksa izin akun ini di Supabase." };

  // Restore today's stock when an order is cancelled. Best-effort; no-op for
  // untracked items or for orders created on a different day (stock for past
  // dates intentionally doesn't get touched).
  if (next === "cancelled" && current.status !== "cancelled") {
    await restoreStockForOrder(supabase, id, profile.id);
  }

  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  revalidatePath("/admin/stok");
  return { ok: true };
}

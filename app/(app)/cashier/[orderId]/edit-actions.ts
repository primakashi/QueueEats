"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

async function recalcTotal(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("price_snapshot, quantity")
    .eq("order_id", orderId);

  const subtotal = (items ?? []).reduce(
    (s, i) => s + i.price_snapshot * i.quantity,
    0,
  );

  const { data: order } = await supabase
    .from("orders")
    .select("outlet_id")
    .eq("id", orderId)
    .maybeSingle();

  let taxRate = 0;
  let serviceRate = 0;
  if (order?.outlet_id) {
    const { data: outlet } = await supabase
      .from("outlets")
      .select("tax_rate, service_charge_rate")
      .eq("id", order.outlet_id)
      .maybeSingle();
    taxRate = (outlet as { tax_rate?: number } | null)?.tax_rate ?? 0;
    serviceRate = (outlet as { service_charge_rate?: number } | null)?.service_charge_rate ?? 0;
  }

  const tax_amount = Math.round(subtotal * taxRate);
  const service_charge_amount = Math.round(subtotal * serviceRate);
  const total = subtotal + tax_amount + service_charge_amount;

  await supabase
    .from("orders")
    .update({ subtotal, total, tax_amount, service_charge_amount })
    .eq("id", orderId);
}

export async function updateOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  if (qty <= 0) {
    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("id", itemId)
      .eq("order_id", orderId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: qty })
      .eq("id", itemId)
      .eq("order_id", orderId);
    if (error) return { ok: false, error: error.message };
  }

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  return { ok: true };
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  return { ok: true };
}

export async function addOrderItem(
  orderId: string,
  menuItemId: string,
  qty: number,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  const { data: menuItem } = await supabase
    .from("menu_items")
    .select("name, price")
    .eq("id", menuItemId)
    .maybeSingle();
  if (!menuItem) return { ok: false, error: "Item menu tidak ditemukan" };

  const { data: existing } = await supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: existing.quantity + qty })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      menu_item_id: menuItemId,
      name_snapshot: menuItem.name,
      price_snapshot: menuItem.price,
      quantity: qty,
      notes: notes?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
  }

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  return { ok: true };
}

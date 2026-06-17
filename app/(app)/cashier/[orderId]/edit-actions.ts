"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { DiscountScope, DiscountValueType } from "@/lib/types";

/**
 * Adjust today's daily_stock for an edit operation on an order line.
 * delta < 0 = consume (added/increased items), delta > 0 = restore (removed/decreased).
 * Best-effort: silently no-ops for untracked items, cancelled orders, or orders
 * created on a day with no daily_stock row.
 */
async function adjustStockForEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  menuItemId: string,
  delta: number,
  actorId: string,
): Promise<void> {
  if (delta === 0 || !menuItemId) return;
  const { data: order } = await supabase
    .from("orders")
    .select("outlet_id, created_at, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.outlet_id) return;
  if ((order.status as string) === "cancelled") return;
  const stockDate = new Date(order.created_at as string).toLocaleDateString("en-CA");
  const { data: stock } = await supabase
    .from("daily_stock")
    .select("id")
    .eq("outlet_id", order.outlet_id)
    .eq("menu_item_id", menuItemId)
    .eq("stock_date", stockDate)
    .maybeSingle();
  if (!stock) return;
  await supabase.rpc("adjust_daily_stock", {
    p_daily_stock_id: stock.id,
    p_change: delta,
    p_reason: "adjust",
    p_order_id: orderId,
    p_notes: "Edit pesanan",
    p_actor: actorId,
  });
}

function computeDiscountAmount(
  valueType: DiscountValueType,
  value: number,
  base: number,
): number {
  if (base <= 0) return 0;
  const raw =
    valueType === "amount" ? Math.round(value) : Math.round((value / 100) * base);
  return Math.max(0, Math.min(raw, base));
}

async function recalcTotal(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("id, price_snapshot, quantity")
    .eq("order_id", orderId);

  const itemRows = items ?? [];
  const subtotal = itemRows.reduce((s, i) => s + i.price_snapshot * i.quantity, 0);
  const itemTotalById = new Map<string, number>(
    itemRows.map((i) => [i.id as string, i.price_snapshot * i.quantity]),
  );

  const { data: order } = await supabase
    .from("orders")
    .select("outlet_id, restaurant_id, order_channel")
    .eq("id", orderId)
    .maybeSingle();

  let taxRate = 0;
  let serviceRate = 0;
  let roundTotal = false;
  if (order?.restaurant_id) {
    const { data: rest } = await supabase
      .from("restaurants")
      .select("tax_rate, service_charge_rate, service_charge_channels, round_total")
      .eq("id", order.restaurant_id)
      .maybeSingle();
    taxRate = (rest as { tax_rate?: number } | null)?.tax_rate ?? 0;
    const baseSvc = (rest as { service_charge_rate?: number } | null)?.service_charge_rate ?? 0;
    const svcChannels = ((rest as { service_charge_channels?: string[] } | null)?.service_charge_channels ?? []);
    const channelApplies = svcChannels.length === 0 || svcChannels.includes(order.order_channel ?? "");
    serviceRate = channelApplies ? baseSvc : 0;
    roundTotal = (rest as { round_total?: boolean } | null)?.round_total ?? false;
  }

  // Re-derive each applied discount's amount from current item state, in
  // insertion order so stacked discounts shrink the remaining base.
  const { data: discRows } = await supabase
    .from("order_discounts")
    .select("id, scope, value_type, value_snapshot, amount, order_item_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const remainingItemBase = new Map(itemTotalById);
  let remainingTxnBase = subtotal;
  let discount_amount = 0;

  for (const d of (discRows ?? []) as Array<{
    id: string;
    scope: DiscountScope;
    value_type: DiscountValueType;
    value_snapshot: number;
    amount: number;
    order_item_id: string | null;
  }>) {
    let base: number;
    if (d.scope === "menu_item" && d.order_item_id) {
      base = remainingItemBase.get(d.order_item_id) ?? 0;
    } else {
      base = remainingTxnBase;
    }
    const newAmount = computeDiscountAmount(d.value_type, Number(d.value_snapshot), base);
    if (newAmount !== d.amount) {
      await supabase
        .from("order_discounts")
        .update({ amount: newAmount })
        .eq("id", d.id);
    }
    if (d.scope === "menu_item" && d.order_item_id) {
      remainingItemBase.set(d.order_item_id, base - newAmount);
    }
    remainingTxnBase = Math.max(0, remainingTxnBase - newAmount);
    discount_amount += newAmount;
  }

  const discountedSubtotal = Math.max(0, subtotal - discount_amount);
  const tax_amount = Math.round(discountedSubtotal * taxRate);
  const service_charge_amount = Math.round(discountedSubtotal * serviceRate);
  const rawTotal = discountedSubtotal + tax_amount + service_charge_amount;
  const total = roundTotal ? Math.round(rawTotal / 1000) * 1000 : rawTotal;

  await supabase
    .from("orders")
    .update({
      subtotal,
      total,
      tax_amount,
      service_charge_amount,
      discount_amount,
    })
    .eq("id", orderId);
}

export async function updateOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  // Capture the old line so we can compute the stock delta after the write.
  const { data: existing } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const oldQty = (existing?.quantity as number | undefined) ?? 0;
  const menuItemId = (existing?.menu_item_id as string | null | undefined) ?? null;

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

  // Stock delta: oldQty - newQty. Positive = restore (qty reduced), negative = consume (qty increased).
  if (menuItemId) {
    const newQty = qty <= 0 ? 0 : qty;
    await adjustStockForEdit(supabase, orderId, menuItemId, oldQty - newQty, profile.id);
  }

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  // Capture the line being removed so we can restore its stock after delete.
  const { data: existing } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };

  const menuItemId = (existing?.menu_item_id as string | null | undefined) ?? null;
  const oldQty = (existing?.quantity as number | undefined) ?? 0;
  if (menuItemId && oldQty > 0) {
    await adjustStockForEdit(supabase, orderId, menuItemId, oldQty, profile.id);
  }

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function applyDiscount(params: {
  orderId: string;
  discountId?: string | null;
  scope: DiscountScope;
  name: string;
  valueType: DiscountValueType;
  value: number;
  reason?: string;
  orderItemId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["cashier", "admin", "branch_manager"]);
  const supabase = await createClient();
  const {
    orderId,
    discountId = null,
    scope,
    name,
    valueType,
    value,
    reason,
    orderItemId = null,
  } = params;

  if (!name.trim()) return { ok: false, error: "Nama diskon wajib diisi" };
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Nilai diskon harus > 0" };
  }
  if (valueType === "percent" && value > 100) {
    return { ok: false, error: "Persen tidak boleh > 100" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") {
    return { ok: false, error: "Pesanan sudah dibayar" };
  }

  // Validate target item exists for item-scope discounts.
  if (scope === "menu_item") {
    if (!orderItemId) {
      return { ok: false, error: "Pilih item untuk diskon per item" };
    }
    const { data: row } = await supabase
      .from("order_items")
      .select("id")
      .eq("id", orderItemId)
      .eq("order_id", orderId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Item tidak ditemukan" };
  }

  // Insert with amount=0; recalcTotal computes the final amount with
  // stack-aware base derivation so multiple discounts can't over-deduct.
  const { error } = await supabase.from("order_discounts").insert({
    order_id: orderId,
    discount_id: discountId,
    scope,
    name_snapshot: name.trim(),
    value_type: valueType,
    value_snapshot: value,
    amount: 0,
    order_item_id: scope === "menu_item" ? orderItemId : null,
    reason: reason?.trim() || null,
    applied_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  return { ok: true };
}

export async function autoApplyDailyDiscounts(
  orderId: string,
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "branch_manager", "waiter"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status, restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: true, applied: 0 };

  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("discounts")
    .select("id, name, value_type, value, active_from, active_until")
    .eq("scope", "daily")
    .eq("is_active", true);
  if (order.restaurant_id) q = q.eq("restaurant_id", order.restaurant_id);
  const { data: dailiesRaw } = await q;
  const dailies = (dailiesRaw ?? []).filter((d) => {
    const from = (d as { active_from: string | null }).active_from;
    const until = (d as { active_until: string | null }).active_until;
    if (from && from > today) return false;
    if (until && until < today) return false;
    return true;
  });
  if (dailies.length === 0) return { ok: true, applied: 0 };

  const { data: appliedRows } = await supabase
    .from("order_discounts")
    .select("discount_id")
    .eq("order_id", orderId);
  const appliedIds = new Set(
    (appliedRows ?? [])
      .map((r) => (r as { discount_id: string | null }).discount_id)
      .filter(Boolean),
  );

  const toInsert = dailies
    .filter((d) => !appliedIds.has(d.id as string))
    .map((d) => ({
      order_id: orderId,
      discount_id: d.id,
      scope: "daily" as const,
      name_snapshot: d.name,
      value_type: d.value_type,
      value_snapshot: Number(d.value),
      amount: 0,
      order_item_id: null,
      reason: null,
      applied_by: null,
    }));
  if (toInsert.length === 0) return { ok: true, applied: 0 };

  const { error } = await supabase.from("order_discounts").insert(toInsert);
  if (error) return { ok: false, error: error.message };

  await recalcTotal(supabase, orderId);
  return { ok: true, applied: toInsert.length };
}

export async function removeOrderDiscount(
  orderId: string,
  discountRowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "branch_manager"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") {
    return { ok: false, error: "Pesanan sudah dibayar" };
  }

  const { error } = await supabase
    .from("order_discounts")
    .delete()
    .eq("id", discountRowId)
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  return { ok: true };
}

export async function addOrderItem(
  orderId: string,
  menuItemId: string,
  qty: number,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["cashier", "admin", "waiter"]);
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

  // Consume stock for the added quantity (whether new line or qty bump).
  if (qty > 0) {
    await adjustStockForEdit(supabase, orderId, menuItemId, -qty, profile.id);
  }

  await recalcTotal(supabase, orderId);
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/admin/stok");
  return { ok: true };
}

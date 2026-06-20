"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function updateOrderItemQty(
  orderId: string,
  itemId: string,
  qty: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole(["cashier", "admin", "waiter"]);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("update_order_item_with_recalc", {
    p_order_id: orderId,
    p_item_id: itemId,
    p_qty: qty,
    p_actor: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "Gagal memperbarui pesanan" };

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Removing is the same as setting qty=0; the RPC handles delete + stock
  // restore + recalc in one transaction.
  return updateOrderItemQty(orderId, itemId, 0);
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

  await supabase.rpc("recalc_order_total", { p_order_id: orderId });
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  return { ok: true };
}

export async function autoApplyDailyDiscounts(
  orderId: string,
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  // Runs inside the cashier order page's Promise.all on every render.
  // If anything below throws (Supabase blip, RLS quirk, missing env), the
  // whole page would crash — so we catch everything and return ok:false.
  // Worst case: daily discounts aren't auto-applied this load; user can
  // reopen the page or apply them manually.
  try {
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
    const adminDb = createAdminClient();
    let q = adminDb
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

    await supabase.rpc("recalc_order_total", { p_order_id: orderId });
    return { ok: true, applied: toInsert.length };
  } catch (err) {
    // Re-throw Next.js control-flow exceptions (redirect, notFound).
    // Other errors are swallowed so the page render continues.
    if (err && typeof err === "object" && "digest" in err) {
      const digest = String((err as { digest?: unknown }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_HTTP_ERROR_FALLBACK;404") {
        throw err;
      }
    }
    console.error("[autoApplyDailyDiscounts] failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Gagal memuat diskon harian" };
  }
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

  await supabase.rpc("recalc_order_total", { p_order_id: orderId });
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  return { ok: true };
}

// Reopen a completed order back to fulfillment (status=ready) so staff can
// add/change items. Refuses paid orders — those must use an add-on instead so
// payment totals stay immutable.
export async function reopenOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin", "branch_manager", "waiter"]);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.status !== "completed") return { ok: false, error: "Hanya pesanan selesai yang bisa dibuka kembali" };
  if (order.payment_status === "paid") {
    return {
      ok: false,
      error: "Pesanan sudah dibayar — gunakan Pesanan Tambahan untuk menambah item",
    };
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "ready" })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
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

  await supabase.rpc("recalc_order_total", { p_order_id: orderId });
  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  revalidatePath("/admin/stok");
  return { ok: true };
}

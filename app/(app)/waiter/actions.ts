"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { Order, OrderChannel, OrderServiceType } from "@/lib/types";

export type CreateOrderInput = {
  service_type?: OrderServiceType;
  table_number?: string | null;
  customer_name?: string;
  notes?: string;
  outlet_id?: string | null;
  order_channel?: OrderChannel;
  parent_order_id?: string | null;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    notes?: string;
  }>;
};

export async function createOrder(
  input: CreateOrderInput,
): Promise<
  | { ok: true; order: Order }
  | { ok: false; error: string }
> {
  const profile = await requireRole(["waiter", "cashier", "admin", "branch_manager"]);
  const restaurantId = getRestaurantFilter(profile);
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "Keranjang kosong" };
  }

  const supabase = await createClient();

  const serviceType: OrderServiceType = input.service_type ?? "dine_in";
  const tableTrimmed =
    typeof input.table_number === "string"
      ? input.table_number.trim()
      : "";
  const payload = {
    service_type: serviceType,
    table_number: tableTrimmed.length > 0 ? tableTrimmed : null,
    customer_name:
      input.customer_name && input.customer_name.trim().length > 0
        ? input.customer_name.trim()
        : null,
    notes:
      input.notes && input.notes.trim().length > 0 ? input.notes.trim() : null,
    outlet_id: input.outlet_id ?? null,
    order_channel: input.order_channel ?? "direct",
    items: input.items.map((i) => ({
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
      ...(i.notes && i.notes.trim().length > 0
        ? { notes: i.notes.trim() }
        : {}),
    })),
  };

  const { data, error } = await supabase.rpc("create_order", {
    payload,
  });
  if (error) return { ok: false, error: error.message };

  const order = data as Order;

  // Stamp restaurant_id if the DB trigger didn't catch it (e.g. order has no outlet_id)
  if (restaurantId && !order.restaurant_id) {
    await supabase.from("orders").update({ restaurant_id: restaurantId }).eq("id", order.id);
  }

  // Link to parent order when this is an add-on (F12). create_order RPC doesn't
  // accept parent_order_id, so patch it post-insert.
  if (input.parent_order_id) {
    await supabase
      .from("orders")
      .update({ parent_order_id: input.parent_order_id })
      .eq("id", order.id);
    order.parent_order_id = input.parent_order_id;
  }

  // The create_order RPC ignores service_type in the payload and falls back to
  // the column default ('takeaway'), so we patch it here from the caller intent.
  if (order.service_type !== serviceType) {
    await supabase.from("orders").update({ service_type: serviceType }).eq("id", order.id);
    order.service_type = serviceType;
  }

  // Decrement today's daily_stock for each ordered item (per outlet). Stock
  // tracking is opt-in: rows only exist when the kasir has opened stok for the
  // day, so this is a best-effort decrement that no-ops for untracked items.
  if (order.outlet_id) {
    const stockDate = new Date().toLocaleDateString("en-CA");
    const itemIds = input.items.map((i) => i.menu_item_id);
    const { data: stockRows } = await supabase
      .from("daily_stock")
      .select("id, menu_item_id")
      .eq("outlet_id", order.outlet_id)
      .eq("stock_date", stockDate)
      .in("menu_item_id", itemIds);
    const stockByItem = new Map(
      ((stockRows ?? []) as Array<{ id: string; menu_item_id: string }>).map((r) => [r.menu_item_id, r.id]),
    );
    await Promise.all(
      input.items.flatMap((it) => {
        const dsId = stockByItem.get(it.menu_item_id);
        if (!dsId) return [];
        return [
          supabase.rpc("adjust_daily_stock", {
            p_daily_stock_id: dsId,
            p_change: -it.quantity,
            p_reason: "sale",
            p_order_id: order.id,
            p_notes: null,
            p_actor: profile.id,
          }),
        ];
      }),
    );
  }

  // Apply restaurant-level tax/service if configured. Service charge applies
  // only when the order's channel is in service_charge_channels (empty = all).
  const targetRestaurantId = restaurantId ?? order.restaurant_id;
  if (targetRestaurantId) {
    const { data: rest } = await supabase
      .from("restaurants")
      .select("tax_rate, service_charge_rate, service_charge_channels, round_total")
      .eq("id", targetRestaurantId)
      .maybeSingle();
    const taxRate = (rest as { tax_rate?: number } | null)?.tax_rate ?? 0;
    const serviceRate = (rest as { service_charge_rate?: number } | null)?.service_charge_rate ?? 0;
    const svcChannels = ((rest as { service_charge_channels?: string[] } | null)?.service_charge_channels ?? []);
    const roundTotal = (rest as { round_total?: boolean } | null)?.round_total ?? false;
    const channelApplies = svcChannels.length === 0 || svcChannels.includes(order.order_channel ?? "");
    const appliedServiceRate = channelApplies ? serviceRate : 0;
    if (taxRate > 0 || appliedServiceRate > 0 || roundTotal) {
      const subtotal = order.subtotal ?? order.total;
      const tax_amount = Math.round(subtotal * taxRate);
      const service_charge_amount = Math.round(subtotal * appliedServiceRate);
      const raw = subtotal + tax_amount + service_charge_amount;
      const total = roundTotal ? Math.round(raw / 1000) * 1000 : raw;
      await supabase
        .from("orders")
        .update({ tax_amount, service_charge_amount, total })
        .eq("id", order.id);
      return { ok: true, order: { ...order, subtotal, tax_amount, service_charge_amount, total } };
    }
  }

  return { ok: true, order };
}

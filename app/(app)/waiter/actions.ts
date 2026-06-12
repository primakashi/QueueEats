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
  const profile = await requireRole(["waiter", "admin", "branch_manager"]);
  const restaurantId = getRestaurantFilter(profile);
  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "Keranjang kosong" };
  }

  const supabase = await createClient();

  const serviceType: OrderServiceType = input.service_type ?? "takeaway";
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

  // Apply outlet tax/service charge to total if rates are configured
  if (input.outlet_id) {
    const { data: outlet } = await supabase
      .from("outlets")
      .select("tax_rate, service_charge_rate")
      .eq("id", input.outlet_id)
      .maybeSingle();
    const taxRate = (outlet as { tax_rate?: number } | null)?.tax_rate ?? 0;
    const serviceRate = (outlet as { service_charge_rate?: number } | null)?.service_charge_rate ?? 0;
    if (taxRate > 0 || serviceRate > 0) {
      const subtotal = order.subtotal ?? order.total;
      const tax_amount = Math.round(subtotal * taxRate);
      const service_charge_amount = Math.round(subtotal * serviceRate);
      const total = subtotal + tax_amount + service_charge_amount;
      await supabase
        .from("orders")
        .update({ tax_amount, service_charge_amount, total })
        .eq("id", order.id);
      return { ok: true, order: { ...order, subtotal, tax_amount, service_charge_amount, total } };
    }
  }

  return { ok: true, order };
}

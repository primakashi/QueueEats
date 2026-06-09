"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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
  await requireRole(["waiter", "admin"]);
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
  return { ok: true, order: data as Order };
}

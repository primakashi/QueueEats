"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Order } from "@/lib/types";

export type CreateOrderInput = {
  table_number?: string;
  customer_name?: string;
  notes?: string;
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
    return { ok: false, error: "Cart is empty" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    payload: input,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, order: data as Order };
}

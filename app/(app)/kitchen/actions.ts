"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "@/lib/types";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(
  id: string,
  next: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["kitchen", "cashier", "admin"]);

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

  const { error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  return { ok: true };
}

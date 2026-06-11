"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUS_LABEL } from "@/lib/types";

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
  await requireRole(["waiter", "kitchen", "cashier", "admin"]);

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

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0)
    return { ok: false, error: "Tidak dapat mengubah status — periksa izin akun ini di Supabase." };

  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/cashier");
  return { ok: true };
}
